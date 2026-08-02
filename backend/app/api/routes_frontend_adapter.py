"""Adapter layer: exposes exactly what frontend/src/api/client.js expects,
translating our real DB shapes underneath. Mounted at /api."""
from fastapi import APIRouter, UploadFile, File, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.invoice import Invoice
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.folder import Folder
from app.audit_trail.ticket_manager import update_status, mark_false_positive, merge_tickets
from app.ingestion.batch_handler import process_batch
from app.orchestrator import process_invoice
import datetime as dt

router = APIRouter()

MSME_FALLBACK_MAP = {
    "duplicate_invoice": "This invoice appears to be a duplicate of a previously uploaded invoice. Verify with supplier before paying.",
    "invalid_gstin": "The vendor's GSTIN failed verification. Ask supplier for their registered GST number.",
    "amount_mismatch": "Line items do not match total amount. Check invoice figures with supplier.",
    "internal_math_error": "Subtotal, tax, and total amount calculation error detected. Request corrected invoice.",
    "phantom_vendor": "Vendor is not in registered vendor list. Confirm vendor credentials.",
    "typo_squatting_vendor": "Vendor name closely resembles a known supplier. Confirm vendor identity.",
    "pdf_metadata_tamper": "File metadata indicates document editing. Verify original scan with issuer.",
    "invisible_text_detected": "Hidden text was found in document layer. Inspect original physical document.",
    "benford_deviation": "Invoice totals show unusual numeric distribution. Audit payment records.",
    "vendor_activity_anomaly": "Unusual volume or billing frequency for vendor. Verify approval workflow.",
}

def get_msme_fallback(exception_type: str, narrative: str = None) -> str:
    if exception_type in MSME_FALLBACK_MAP:
        return MSME_FALLBACK_MAP[exception_type]
    return narrative or "Please review this invoice with your vendor or accountant."

def _ticket_to_frontend_shape(t: Ticket, inv: Invoice = None) -> dict:
    msme_nar = getattr(t, "msme_narrative", None) or get_msme_fallback(t.exception_type, t.narrative)
    return {
        "id": f"TCK-{t.id}",
        "invoiceId": f"INV-{t.invoice_id}",
        "vendor": inv.vendor_name if inv else None,
        "flag": t.exception_type,
        "riskScore": inv.risk_score if inv else t.risk_contribution,
        "confidenceScore": round((inv.confidence_score or 0) * 100) if inv else 0,
        "status": t.status,
        "amount": f"{inv.total_amount:.2f}" if inv and inv.total_amount else "0.00",
        "date": inv.invoice_date.isoformat()[:10] if inv and inv.invoice_date else None,
        "aiNarrative": t.narrative,
        "msmeNarrative": msme_nar,
    }

from fastapi.responses import FileResponse
import os
from app.models.folder import Folder
from app.scoring.itc_calculator import calculate_itc_at_risk
from app.scoring.msme_penalty import calculate_batch_penalties
from app.db.seed import seed


def _require_auditor(request: Request):
    """FastAPI dependency — raises 403 if the caller is not the auditor role.

    Reads X-Role header set by the frontend axios interceptor on every request.
    SECURITY NOTE: This is demo-grade protection, not cryptographic auth.
    A caller who sets X-Role: auditor themselves will bypass this check.
    """
    role = request.headers.get("X-Role", "")
    if role != "auditor":
        raise HTTPException(
            status_code=403,
            detail="Auditor role required. Set X-Role: auditor header.",
        )

@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    invoices = db.query(Invoice).all()
    total = len(invoices)
    open_tickets = db.query(func.count(Ticket.id)).filter(Ticket.status == "open").scalar() or 0
    avg_conf = db.query(func.avg(Invoice.confidence_score)).scalar() or 0

    invoices_data = [{
        "risk_level": inv.risk_level,
        "cgst": inv.cgst,
        "sgst": inv.sgst,
        "igst": inv.igst,
        "total_amount": inv.total_amount,
        "invoice_date": inv.invoice_date,
        "invoice_number": inv.invoice_number,
    } for inv in invoices]

    itc_res = calculate_itc_at_risk(invoices_data)
    msme_res = calculate_batch_penalties(invoices_data)

    gemini_count = sum(1 for inv in invoices if getattr(inv, "ocr_source", None) == "gemini")
    avoided_count = total - gemini_count

    # Top Risk Drivers
    tickets = db.query(Ticket).all()
    driver_counts = {}
    for t in tickets:
        if t.status != "resolved":
            driver_counts[t.exception_type] = driver_counts.get(t.exception_type, 0) + 1
    top_drivers = [{"type": k, "count": v} for k, v in sorted(driver_counts.items(), key=lambda x: x[1], reverse=True)[:5]]

    # Recent Exceptions — expose narrative (clean AI text) as the display field
    recent_exceptions = [{
        "id": f"TCK-{t.id}",
        "type": t.exception_type,
        "narrative": t.narrative,  # already the AI-cleaned narrative
        "created_at": t.created_at.isoformat() if t.created_at else None
    } for t in sorted(tickets, key=lambda x: x.created_at or dt.datetime.min, reverse=True)[:5]]

    # Vendor count for dashboard summary string
    unique_vendors = len(set(inv.vendor_name for inv in invoices if inv.vendor_name))

    by_risk_level = {"low": 0, "medium": 0, "high": 0}
    for inv in invoices:
        lvl = (inv.risk_level or "low").lower()
        if lvl in by_risk_level:
            by_risk_level[lvl] += 1

    return {
        "itcAtRiskInr": itc_res["itc_at_risk"],
        "invoicesProcessed": total,
        "openTickets": open_tickets,
        "avgConfidence": round(avg_conf, 2),
        "msmePenaltyExposureInr": msme_res["total_estimated_penalty"],
        "aiFallbackCount": gemini_count,
        "aiCallsAvoided": max(0, avoided_count),
        "topDrivers": top_drivers,
        "recentExceptions": recent_exceptions,
        "uniqueVendors": unique_vendors,
        "by_risk_level": by_risk_level,
    }


@router.get("/stats/risk-distribution")
def risk_distribution(db: Session = Depends(get_db)):
    buckets = [(0, 20), (21, 40), (41, 60), (61, 80), (81, 100)]
    result = []
    for lo, hi in buckets:
        count = db.query(func.count(Invoice.id)).filter(
            Invoice.risk_score >= lo, Invoice.risk_score <= hi
        ).scalar() or 0
        result.append({"bucket": f"{lo}-{hi}", "count": count})
    return result


@router.get("/stats/exception-breakdown")
def exception_breakdown(db: Session = Depends(get_db)):
    """Per exception_type: ticket count + total financial exposure (sum of invoice amounts)."""
    all_tickets = db.query(Ticket).all()
    breakdown = {}
    for t in all_tickets:
        key = t.exception_type or "unknown"
        if key not in breakdown:
            breakdown[key] = {"type": key, "count": 0, "exposure": 0.0}
        breakdown[key]["count"] += 1
        inv = db.query(Invoice).filter(Invoice.id == t.invoice_id).first()
        if inv and inv.total_amount:
            breakdown[key]["exposure"] += float(inv.total_amount)
    result = sorted(breakdown.values(), key=lambda x: x["count"], reverse=True)
    return result


@router.get("/stats/flags-over-time")
def flags_over_time(db: Session = Depends(get_db)):
    """Weekly flag counts grouped by invoice date. Only returned if date spread >= 14 days."""
    invoices = db.query(Invoice).filter(Invoice.invoice_date.isnot(None)).all()
    if not invoices:
        return {"supported": False, "reason": "No dated invoices in dataset"}

    dates = [inv.invoice_date for inv in invoices if inv.invoice_date]
    if not dates:
        return {"supported": False, "reason": "No invoice dates found"}

    date_min = min(d.date() if hasattr(d, 'date') else d for d in dates)
    date_max = max(d.date() if hasattr(d, 'date') else d for d in dates)
    spread_days = (date_max - date_min).days

    if spread_days < 14:
        return {"supported": False, "reason": f"Date spread only {spread_days} days — too narrow for a meaningful trend chart"}

    # Build weekly buckets
    import datetime as dt_mod
    from collections import defaultdict
    weekly = defaultdict(int)
    for inv in invoices:
        if not inv.invoice_date:
            continue
        d = inv.invoice_date.date() if hasattr(inv.invoice_date, 'date') else inv.invoice_date
        # ISO week string: e.g. "2026-W23"
        week_key = d.strftime("%Y-W%V")
        tickets = db.query(Ticket).filter(Ticket.invoice_id == inv.id).all()
        weekly[week_key] += len(tickets)

    series = sorted([{"week": k, "flags": v} for k, v in weekly.items()], key=lambda x: x["week"])
    return {"supported": True, "series": series, "spread_days": spread_days}

@router.get("/folders")
def get_folders(db: Session = Depends(get_db)):
    folder_counts = db.query(
        Invoice.folder,
        func.count(Invoice.id).label("count")
    ).group_by(Invoice.folder).all()

    db_folders = {f.name: f for f in db.query(Folder).all()}
    vendors_map = {v.name: v.category for v in db.query(Vendor).all()}

    out = []
    seen = set()
    for f_name, count in folder_counts:
        if not f_name:
            continue
        seen.add(f_name)
        f_obj = db_folders.get(f_name)
        cat = f_obj.category if f_obj else (vendors_map.get(f_name, "General") or "General")
        out.append({
            "id": f_obj.id if f_obj else None,
            "vendor": f_name,
            "folder": f_name,
            "count": count,
            "category": str(cat).replace("_", " ").title(),
        })

    for f_name, f_obj in db_folders.items():
        if f_name not in seen:
            out.append({
                "id": f_obj.id,
                "vendor": f_name,
                "folder": f_name,
                "count": 0,
                "category": str(f_obj.category or "General").replace("_", " ").title(),
            })

    return out


@router.post("/folders")
def create_folder(payload: dict, db: Session = Depends(get_db), _: None = Depends(_require_auditor)):
    name = payload.get("name")
    category = payload.get("category", "General")
    if not name:
        return {"error": "Folder name required"}
    
    existing = db.query(Folder).filter(Folder.name == name).first()
    if existing:
        return {"ok": True, "folder": existing.name, "message": "Folder already exists"}

    f = Folder(name=name, category=category)
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"ok": True, "id": f.id, "folder": f.name, "category": f.category}


@router.post("/invoices/{invoice_id}/move")
def move_invoice_folder(invoice_id: str, payload: dict, db: Session = Depends(get_db), _: None = Depends(_require_auditor)):
    real_id = int(invoice_id.replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv:
        return {"error": "Invoice not found"}
    
    target_folder = payload.get("folder") or payload.get("folderName")
    if not target_folder:
        return {"error": "Target folder required"}

    inv.folder = target_folder
    f_obj = db.query(Folder).filter(Folder.name == target_folder).first()
    if f_obj:
        inv.folder_id = f_obj.id
    db.commit()
    return {"ok": True, "invoiceId": invoice_id, "folder": target_folder}


@router.get("/tickets")
def tickets(
    status: str = None,
    minRisk: float = 0,
    minConfidence: float = 0,
    query: str = None,
    folder: str = None,
    db: Session = Depends(get_db)
):
    q = db.query(Ticket)
    if status and status != "all":
        q = q.filter(Ticket.status == status)
    rows = q.all()
    out = []
    for t in rows:
        inv = db.query(Invoice).filter(Invoice.id == t.invoice_id).first()
        shape = _ticket_to_frontend_shape(t, inv)

        if minRisk > 0 and (shape["riskScore"] or 0) < minRisk:
            continue
        if minConfidence > 0 and (shape["confidenceScore"] or 0) < minConfidence:
            continue
        if folder and inv and inv.folder != folder:
            continue
        if query:
            q_lower = query.lower()
            vendor_match = inv and inv.vendor_name and q_lower in inv.vendor_name.lower()
            inv_id_match = shape["invoiceId"] and q_lower in shape["invoiceId"].lower()
            if not (vendor_match or inv_id_match):
                continue

        out.append(shape)
    out.sort(key=lambda x: x["riskScore"] or 0, reverse=True)
    return out

@router.get("/tickets/{ticket_id}")
def ticket_detail(ticket_id: str, db: Session = Depends(get_db)):
    real_id = int(ticket_id.replace("TCK-", ""))
    t = db.query(Ticket).filter(Ticket.id == real_id).first()
    inv = db.query(Invoice).filter(Invoice.id == t.invoice_id).first() if t else None
    return _ticket_to_frontend_shape(t, inv) if t else {}

@router.post("/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: str, payload: dict, db: Session = Depends(get_db), _: None = Depends(_require_auditor)):
    real_id = int(ticket_id.replace("TCK-", ""))
    actor = payload.get("actor", "auditor")
    reason = payload.get("reason", "")
    if payload.get("falsePositive"):
        t = mark_false_positive(db, real_id, actor, reason)
    else:
        t = update_status(db, real_id, "resolved", actor, reason)
    return {"ok": True, "ticketId": ticket_id, "status": t.status}

@router.post("/tickets/bulk-resolve")
def bulk_resolve_tickets(payload: dict, db: Session = Depends(get_db), _: None = Depends(_require_auditor)):
    ticket_ids = payload.get("ticketIds", [])
    reason = payload.get("reason", "Bulk resolved by auditor")
    actor = payload.get("actor", "auditor")
    for tid in ticket_ids:
        real_id = int(str(tid).replace("TCK-", ""))
        update_status(db, real_id, "resolved", actor, reason)
    return {"ok": True, "count": len(ticket_ids)}

@router.get("/invoices/{invoice_id}/file")
def get_invoice_file(invoice_id: str, db: Session = Depends(get_db)):
    real_id = int(invoice_id.replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv or not inv.source_file_path:
        return {"error": "File not found"}
    
    full_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", inv.source_file_path))
    if not os.path.exists(full_path):
        return {"error": "File not found on disk"}

    ext = full_path.rsplit(".", 1)[-1].lower()
    mime = "application/pdf" if ext == "pdf" else f"image/{ext}"
    return FileResponse(full_path, media_type=mime, filename=os.path.basename(full_path))

@router.get("/invoices/{invoice_id}")
def invoice_detail(invoice_id: str, db: Session = Depends(get_db)):
    real_id = int(invoice_id.replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv:
        return {}
    tickets = db.query(Ticket).filter(Ticket.invoice_id == real_id).all()
    fields = inv.extracted_raw or {}
    conf = inv.field_confidence or {}

    file_url = f"/api/invoices/{invoice_id}/file" if inv.source_file_path else None

    from app.scoring.msme_penalty import check_msme_penalty
    msme_penalty_res = check_msme_penalty(
        {"invoice_date": inv.invoice_date, "total_amount": inv.total_amount}, 
        is_paid=False
    )

    return {
        "id": invoice_id,
        "fileUrl": file_url,
        "vendor": inv.vendor_name,
        "gstin": inv.vendor_gstin,
        "folder": inv.folder,
        "riskScore": inv.risk_score or 0,
        "riskLevel": inv.risk_level or "low",
        "invoiceDate": inv.invoice_date.isoformat()[:10] if inv.invoice_date else None,
        "extractionConfidence": inv.confidence_score,
        "fields": [
            {"label": k.replace("_", " ").title(), "key": k, "value": v, "confidence": conf.get(k, 0)}
            for k, v in fields.items()
        ],
        "flags": [
            {
                "type": t.exception_type,
                # 'detail' = the AI-generated clean narrative (what we show by default)
                "detail": t.narrative,
                # 'rawReason' = the raw rule-engine reason string (shown in "Show technical detail" toggle)
                # narrative IS the fallback to reason in narrative_generator.py line 73,
                # so we attempt to pull the original reason from history if available;
                # otherwise expose narrative as both (still cleaner than nothing)
                "rawReason": (
                    (t.history[-1].get("reason") if t.history else None)
                    or t.narrative
                ),
                "status": t.status,
                "msmeNarrative": getattr(t, "msme_narrative", None) or get_msme_fallback(t.exception_type, t.narrative),
                "evidenceData": getattr(t, "evidence_data", None)
            }
            for t in tickets
        ],
        "editHistory": inv.edit_history or [],
        "financialExposure": {
            "itcAtRisk": (float(inv.cgst or 0) + float(inv.sgst or 0) + float(inv.igst or 0)) if inv.risk_level == "high" else 0,
            "msmePenalty": msme_penalty_res.get("penalty_amount", 0) if "msme_penalty_res" in locals() else 0
        },
        "seal": {
            "hash": inv.record_hash,
            "signature": inv.seal_signature,
            "algorithm": "HMAC-SHA256",
            "sealed_at": inv.sealed_at.isoformat() if inv.sealed_at else None,
        } if inv.record_hash else None,
        "forensicMetadata": inv.forensic_metadata,
    }

@router.post("/invoices/upload")
async def upload_invoices(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    payload = []
    file_bytes_map = {}
    for f in files:
        content = await f.read()
        payload.append((f.filename, content))
        file_bytes_map[f.filename] = content

    result = process_batch(payload)
    out = []
    for item in result["processed"]:
        f_name = item["filename"]
        risk = process_invoice(
            db,
            filename=f_name,
            extraction=item["extraction"],
            forensics=item["forensics"],
            file_bytes=file_bytes_map.get(f_name),
        )
        needs_review = risk.get("needs_review", [])
        out.append({
            "filename": f_name,
            "status": "needs-review" if needs_review else "accepted",
            "invoice_id": risk.get("invoice_id"),
            "risk_level": risk.get("risk_level")
        })
    for item in result["rejected"]:
        out.append({"filename": item["filename"], "status": "rejected"})
    return out

@router.post("/invoices/{invoice_id}/verify-seal")
def verify_invoice_seal(invoice_id: str, db: Session = Depends(get_db)):
    """Re-hash current invoice data and compare to stored cryptographic seal."""
    from app.audit_trail.hash_sealer import verify_full_seal, build_seal_record, seal
    real_id = int(invoice_id.replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if not inv.record_hash:
        return {"valid": False, "reason": "No seal exists for this invoice"}
    
    result = verify_full_seal(inv, inv.record_hash, inv.seal_signature or "")
    return result

@router.get("/invoices/{invoice_id}/forensics")
def get_invoice_forensics(invoice_id: str, db: Session = Depends(get_db)):
    """Return stored forensic metadata for an invoice."""
    real_id = int(invoice_id.replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv.forensic_metadata or {}

@router.get("/invoices/{invoice_id}/audit-trail")
def get_invoice_audit_trail(invoice_id: str, db: Session = Depends(get_db)):
    """Return complete chronological audit trail for an invoice."""
    from app.audit_trail.history_log import build_audit_trail
    real_id = int(invoice_id.replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    tickets = db.query(Ticket).filter(Ticket.invoice_id == real_id).all()
    trail = build_audit_trail(inv, tickets)
    return {"invoice_id": invoice_id, "events": trail, "total": len(trail)}

@router.post("/dev/reset")
def reset_database(db: Session = Depends(get_db)):
    seed()
    return {"ok": True, "message": "Demo dataset reloaded successfully (60 invoices seeded)."}


@router.patch("/invoices/{invoice_id}")
def patch_invoice(invoice_id: str, payload: dict, request: Request, db: Session = Depends(get_db), _: None = Depends(_require_auditor)):
    """Auditor-only: correct extracted fields and log each change to edit_history."""
    real_id = int(str(invoice_id).replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    actor = request.headers.get("X-Actor", "auditor")
    raw = inv.extracted_raw or {}
    conf = inv.field_confidence or {}
    history = list(inv.edit_history or [])
    changed = []

    for field_key, new_value in payload.items():
        if field_key.startswith("_"):
            continue  # skip meta fields
        old_value = raw.get(field_key)
        if str(old_value) != str(new_value):
            history.append({
                "actor": actor,
                "field": field_key,
                "old_value": old_value,
                "new_value": new_value,
                "timestamp": dt.datetime.utcnow().isoformat(),
            })
            raw[field_key] = new_value
            changed.append(field_key)

    inv.extracted_raw = raw
    inv.field_confidence = conf
    inv.edit_history = history
    db.commit()
    return {"ok": True, "invoiceId": invoice_id, "changed": changed, "editHistory": history}


@router.get("/folders/{folder_name}/invoices")
def folder_invoices(folder_name: str, db: Session = Depends(get_db)):
    """List invoices belonging to a named folder (vendor/category bucket)."""
    invs = db.query(Invoice).filter(Invoice.folder == folder_name).all()
    result = []
    for inv in invs:
        open_count = db.query(func.count(Ticket.id)).filter(
            Ticket.invoice_id == inv.id,
            Ticket.status == "open"
        ).scalar() or 0
        result.append({
            "id": f"INV-{inv.id}",
            "invoiceNumber": inv.invoice_number or f"INV-{inv.id}",
            "vendor": inv.vendor_name or "Unknown",
            "amount": f"{inv.total_amount:.2f}" if inv.total_amount else "0.00",
            "date": inv.invoice_date.isoformat()[:10] if inv.invoice_date else None,
            "riskScore": inv.risk_score or 0,
            "riskLevel": inv.risk_level or "low",
            "openTickets": open_count,
        })
    result.sort(key=lambda x: x["riskScore"], reverse=True)
    return result
