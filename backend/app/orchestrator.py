"""Orchestrates the full per-invoice pipeline: extraction -> forensics ->
reconciliation checks -> risk scoring -> narrative -> persistence -> tickets."""
import datetime as dt
from sqlalchemy.orm import Session

from app.reconciliation.gstin_validator import validate as gstin_validate
from app.reconciliation.duplicate_detector import detect_duplicates
from app.scoring.risk_scorer import score_invoice
from app.ai_layer.narrative_generator import generate_narratives
from app.ai_layer.msme_translator import translate_for_msme
from app.audit_trail.ticket_manager import create_ticket
from app.audit_trail.hash_sealer import seal
from app.models.invoice import Invoice


def _to_float(v):
    try:
        return float(str(v).replace(",", "")) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _to_date(v):
    if not v:
        return None
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(v, fmt)
        except ValueError:
            continue
    return None


def _normalize_for_checks(fields: dict) -> dict:
    """Converts our extraction field dict (all strings) into the numeric/date
    shape the reconciliation modules expect."""
    return {
        "invoice_number": fields.get("invoice_number"),
        "vendor_name": fields.get("vendor_name"),
        "vendor_gstin": fields.get("vendor_gstin"),
        "invoice_date": _to_date(fields.get("invoice_date")),
        "total_amount": _to_float(fields.get("total_amount")),
        "taxable_value": _to_float(fields.get("taxable_value")),
        "cgst": _to_float(fields.get("cgst")),
        "sgst": _to_float(fields.get("sgst")),
        "igst": _to_float(fields.get("igst")),
    }


def process_invoice(db: Session, filename: str, extraction: dict, forensics: dict) -> dict:
    """Runs reconciliation + risk scoring + narrative + persistence for ONE
    already-extracted invoice."""
    norm = _normalize_for_checks(extraction["fields"])
    flags = []

    if not extraction["math_ok"]:
        flags.append({"check": "internal_math_error", "reason": extraction["math_reason"]})

    if forensics and forensics.get("metadata_tamper", {}).get("flagged"):
        flags.append({"check": "pdf_metadata_tamper", "reason": forensics["metadata_tamper"].get("reason", "")})
    if forensics and forensics.get("invisible_text", {}).get("flagged"):
        spans = forensics["invisible_text"].get("suspicious_spans", 0)
        flags.append({"check": "invisible_text_detected", "reason": f"{spans} suspicious text span(s) found."})

    flags.extend(gstin_validate(norm))

    # duplicate check against everything already saved in the DB
    existing = db.query(Invoice).all()
    existing_dicts = [{
        "invoice_number": e.invoice_number, "vendor_gstin": e.vendor_gstin,
        "total_amount": e.total_amount, "invoice_date": e.invoice_date,
    } for e in existing]
    all_invoices = existing_dicts + [norm]
    dup_flags = detect_duplicates(all_invoices)
    my_index = len(all_invoices) - 1
    for d in dup_flags:
        if d["invoice_index"] == my_index:
            flags.append({"check": "duplicate_invoice", "reason": d["reason"]})

    # TODO: vendor_matcher.match_vendor() — needs a vendor_master.csv, not yet
    # available anywhere in config/synthetic_data. Wire in once that exists.
    # TODO: mismatch_checks.check_mismatches() — needs a ledger row per invoice,
    # not yet available. Wire in once ledger loading exists.

    scoring = score_invoice(flags)
    scoring = generate_narratives(scoring)
    try:
        scoring = translate_for_msme(scoring)
    except Exception:
        pass

    inv = Invoice(
        invoice_number=norm["invoice_number"],
        invoice_date=norm["invoice_date"],
        vendor_name=norm["vendor_name"],
        vendor_gstin=norm["vendor_gstin"],
        taxable_value=norm["taxable_value"],
        cgst=norm["cgst"], sgst=norm["sgst"], igst=norm["igst"],
        total_amount=norm["total_amount"],
        field_confidence=extraction["field_confidence"],
        extracted_raw=extraction["fields"],
        risk_score=scoring["risk_score"],
        risk_level=scoring["risk_level"],
        confidence_score=extraction["avg_conf"] / 100,
        source_file_path=filename,
        created_at=dt.datetime.utcnow(),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    inv.record_hash = seal({
        "invoice_number": inv.invoice_number,
        "total_amount": inv.total_amount,
        "vendor_gstin": inv.vendor_gstin,
    })
    db.commit()

    ticket_ids = []
    for c in scoring["contributing_checks"]:
        t = create_ticket(
            db,
            invoice_id=inv.id,
            exception_type=c["check"],
            risk_contribution=c["points"],
            narrative=c.get("narrative", c["reason"]),
            msme_narrative=c.get("msme_narrative"),
        )
        ticket_ids.append(t.id)

    return {
        "invoice_id": inv.id,
        "risk_score": scoring["risk_score"],
        "risk_level": scoring["risk_level"],
        "summary": scoring.get("summary"),
        "ticket_ids": ticket_ids,
        "needs_review": extraction.get("needs_review", []),
    }