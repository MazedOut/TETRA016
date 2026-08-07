import os
import pandas as pd
import datetime as dt
from sqlalchemy.orm import Session

from app.reconciliation.gstin_validator import validate as gstin_validate
from app.reconciliation.duplicate_detector import detect_duplicates
from app.reconciliation.ledger_matcher import match_ledger
from app.reconciliation.mismatch_checks import check_mismatches
from app.reconciliation.vendor_matcher import match_vendor
from app.scoring.risk_scorer import score_invoice
from app.ai_layer.narrative_generator import generate_narratives
from app.ai_layer.msme_translator import translate_for_msme
from app.audit_trail.ticket_manager import create_ticket
from app.audit_trail.hash_sealer import seal, generate_signature, build_seal_record
from app.audit_trail.history_log import build_pipeline_event
from app.reconciliation.forensics import build_forensic_report
from app.models.invoice import Invoice
from app.models.vendor import Vendor
from app.models.ledger_entry import LedgerEntry

SYNTHETIC_DIR = os.path.join(os.path.dirname(__file__), "..", "synthetic_data", "output")


def _get_ledger_df(db: Session = None) -> pd.DataFrame | None:
    if db is not None:
        try:
            entries = db.query(LedgerEntry).all()
            if entries:
                return pd.DataFrame([{
                    "invoice_number": e.invoice_number,
                    "vendor_name": e.vendor_name,
                    "total_amount": e.total_amount,
                    "posting_date": pd.to_datetime(e.posting_date) if e.posting_date else None,
                } for e in entries])
        except Exception:
            pass

    path = os.path.join(SYNTHETIC_DIR, "ledger.csv")
    if os.path.exists(path):
        try:
            df = pd.read_csv(path)
            if "posting_date" in df.columns:
                df["posting_date"] = pd.to_datetime(df["posting_date"])
            return df
        except Exception:
            return None
    return None


def _get_vendor_master_df(db: Session = None) -> pd.DataFrame | None:
    if db is not None:
        try:
            vendors = db.query(Vendor).all()
            if vendors:
                return pd.DataFrame([{
                    "vendor_name": v.name,
                    "gstin": v.gstin,
                    "category": v.category,
                } for v in vendors])
        except Exception:
            pass

    path = os.path.join(SYNTHETIC_DIR, "vendor_master.csv")
    if os.path.exists(path):
        try:
            return pd.read_csv(path)
        except Exception:
            return None
    return None


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


from app.classification.folder_sorter import sort_invoice
from app.classification.vendor_cache import VendorCache


def process_invoice(
    db: Session,
    filename: str,
    extraction: dict,
    forensics: dict,
    ledger_df: pd.DataFrame = None,
    vendor_master_df: pd.DataFrame = None,
    file_bytes: bytes = None,
) -> dict:
    """Runs reconciliation + risk scoring + narrative + persistence for ONE
    already-extracted invoice."""
    norm = _normalize_for_checks(extraction["fields"])
    flags = []

    if not extraction.get("math_ok", True):
        flags.append({"check": "internal_math_error", "reason": extraction.get("math_reason", "Calculation mismatch.")})

    if forensics and forensics.get("metadata_tamper", {}).get("flagged"):
        flags.append({"check": "pdf_metadata_tamper", "reason": forensics["metadata_tamper"].get("reason", "")})
    if forensics and forensics.get("invisible_text", {}).get("flagged"):
        spans = forensics["invisible_text"].get("suspicious_spans", 0)
        flags.append({"check": "invisible_text_detected", "reason": f"{spans} suspicious text span(s) found."})

    needs_review_fields = extraction.get("needs_review", [])
    if needs_review_fields:
        flags.append({
            "check": "needs_review",
            "reason": f"Invoice requires human review. Missing/uncertain fields: {', '.join(needs_review_fields)}.",
        })

    flags.extend(gstin_validate(norm))

    # Tier 3: Live GSTIN registry check (DEMO MODE: Run for ALL invoices)
    registry_result = None
    if True: # Demo Mode Override: Run registry check on every invoice
        gstin_to_check = norm.get("vendor_gstin")
        print(f"--- [START] Live GSTIN Registry Check for: {gstin_to_check} ---")
        from app.reconciliation.gstin_registry import verify_gstin_registry
        registry_result = verify_gstin_registry(
            gstin_to_check,
            invoice_vendor_name=norm.get("vendor_name")
        )
        print(f"--- [END] GSTIN Registry Check Result: {registry_result} ---")
        
        # Exception Generation: if the status is bad, generate a flag so a Ticket is created
        if registry_result:
            status = registry_result.get("registry_status")
            if status in ("cancelled", "suspended"):
                flags.append({
                    "check": "gstin_registry_failed",
                    "reason": f"GSTIN is {status.upper()}. Legal name: {registry_result.get('legal_name', 'Unknown')}."
                })
            elif status == "mismatch":
                flags.append({
                    "check": "gstin_name_mismatch",
                    "reason": registry_result.get("mismatch_reason", "Vendor name does not match registry data.")
                })

    # duplicate check against everything already saved in the DB
    existing = db.query(Invoice).all()
    existing_dicts = [{
        "id": e.id,
        "invoice_number": e.invoice_number, "vendor_gstin": e.vendor_gstin,
        "total_amount": e.total_amount, "invoice_date": e.invoice_date,
    } for e in existing]
    all_invoices = existing_dicts + [norm]
    dup_flags = detect_duplicates(all_invoices)
    my_index = len(all_invoices) - 1
    for d in dup_flags:
        if d["invoice_index"] == my_index:
            flags.append({
                "check": "duplicate_invoice", 
                "reason": d["reason"],
                "duplicate_of_id": d.get("duplicate_of_id")
            })

    # vendor_matcher check
    vm_df = vendor_master_df if vendor_master_df is not None else _get_vendor_master_df(db)
    if vm_df is not None and not vm_df.empty:
        vm_res = match_vendor(norm, vm_df)
        if vm_res.get("flagged"):
            flags.append({"check": vm_res["check"], "reason": vm_res["reason"]})

    # ledger_matcher & mismatch checks
    l_df = ledger_df if ledger_df is not None else _get_ledger_df(db)
    if l_df is not None and not l_df.empty:
        lm_res = match_ledger(norm, l_df)
        if not lm_res.get("matched"):
            if "flag" in lm_res:
                flags.append({"check": lm_res["flag"]["check"], "reason": lm_res["flag"]["reason"]})
        else:
            ledger_row = lm_res.get("ledger_row")
            if ledger_row:
                mismatches = check_mismatches(norm, ledger_row)
                for m in mismatches:
                    if m.get("flagged"):
                        flags.append({"check": m["check"], "reason": m["reason"]})

    # Auto classification & folder sorting
    cache_path = os.path.join(SYNTHETIC_DIR, "vendor_cache.csv")
    master_path = os.path.join(SYNTHETIC_DIR, "vendor_master.csv")
    v_cache = VendorCache(cache_path=cache_path, seed_path=master_path)
    sort_res = sort_invoice(extraction.get("fields", {}), v_cache)

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
        field_confidence=extraction.get("field_confidence"),
        extracted_raw=extraction.get("fields"),
        risk_score=scoring["risk_score"],
        risk_level=scoring["risk_level"],
        confidence_score=extraction.get("avg_conf", 100) / 100,
        ocr_source=extraction.get("ocr_source", "tesseract"),
        folder=sort_res.get("folder", "extra"),
        source_file_path=filename,
        registry_status=registry_result,
        created_at=dt.datetime.utcnow(),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    # Build pipeline log for audit trail
    pipeline_events = [
        build_pipeline_event("ingestion", f"File '{filename}' ingested"),
        build_pipeline_event("extraction", f"{len(extraction.get('fields', {}))} fields extracted (confidence: {extraction.get('avg_conf', 0):.0f}%)"),
        build_pipeline_event("classification", f"Auto-classified to folder: {sort_res.get('folder', 'extra')}"),
    ]
    
    # Log validation results  
    for flag in flags:
        check_type = flag.get("check", "unknown")
        if check_type == "invalid_gstin":
            pipeline_events.append(build_pipeline_event("gstin_validation_failed", flag.get("reason", "")))
        elif check_type == "pdf_metadata_tamper":
            pipeline_events.append(build_pipeline_event("metadata_tamper_detected", flag.get("reason", "")))
        elif check_type == "invisible_text_detected":
            pipeline_events.append(build_pipeline_event("invisible_text_detected", flag.get("reason", "")))
        elif check_type == "duplicate_invoice":
            pipeline_events.append(build_pipeline_event("duplicate_detected", flag.get("reason", "")))
        else:
            pipeline_events.append(build_pipeline_event(check_type, flag.get("reason", "")))
    
    if not any(f.get("check") == "invalid_gstin" for f in flags):
        pipeline_events.append(build_pipeline_event("gstin_validation", "GSTIN validation passed"))
    
    pipeline_events.append(build_pipeline_event("metadata_scan", "PDF forensic metadata scan completed"))
    pipeline_events.append(build_pipeline_event("risk_scoring", f"Risk score: {scoring['risk_score']} ({scoring['risk_level']})"))
    
    if scoring.get("contributing_checks"):
        for c in scoring["contributing_checks"]:
            if c.get("narrative") and c["narrative"] != c.get("reason"):
                pipeline_events.append(build_pipeline_event("ai_narrative", f"Narrative generated for {c['check']}"))
            if c.get("msme_narrative"):
                pipeline_events.append(build_pipeline_event("ai_msme_translation", f"MSME translation for {c['check']}"))

    if file_bytes:
        uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads", str(inv.id))
        os.makedirs(uploads_dir, exist_ok=True)
        rel_path = f"uploads/{inv.id}/{filename}"
        full_path = os.path.join(os.path.dirname(__file__), "..", rel_path)
        with open(full_path, "wb") as f:
            f.write(file_bytes)
        inv.source_file_path = rel_path
        db.commit()

    # Build and store forensic report
    forensic_report = None
    if file_bytes:
        invoice_date_for_forensics = norm.get("invoice_date")
        forensic_report = build_forensic_report(file_bytes, filename, invoice_date_for_forensics)
    
    # Enhanced cryptographic seal
    seal_record = build_seal_record(inv)
    inv.record_hash = seal(seal_record)
    inv.seal_signature = generate_signature(seal_record)
    inv.sealed_at = dt.datetime.utcnow()
    inv.forensic_metadata = forensic_report
    
    pipeline_events.append(build_pipeline_event("seal_applied", f"SHA-256: {inv.record_hash[:16]}…"))
    
    # Store pipeline log
    inv.pipeline_log = pipeline_events
    db.commit()

    ticket_ids = []
    for c in scoring["contributing_checks"]:
        evidence = {}
        if c.get("duplicate_of_id"):
            evidence["duplicate_invoice_id"] = c["duplicate_of_id"]
            
        t = create_ticket(
            db,
            invoice_id=inv.id,
            exception_type=c["check"],
            risk_contribution=c["points"],
            narrative=c.get("narrative", c["reason"]),
            msme_narrative=c.get("msme_narrative"),
            evidence_data=evidence if evidence else None
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