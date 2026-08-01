"""Adapter layer: exposes exactly what frontend/src/api/client.js expects,
translating our real DB shapes underneath. Mounted at /api."""
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.invoice import Invoice
from app.models.ticket import Ticket
from app.audit_trail.ticket_manager import update_status, mark_false_positive, merge_tickets
from app.ingestion.batch_handler import process_batch
from app.orchestrator import process_invoice

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

@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Invoice.id)).scalar() or 0
    open_tickets = db.query(func.count(Ticket.id)).filter(Ticket.status == "open").scalar() or 0
    avg_conf = db.query(func.avg(Invoice.confidence_score)).scalar() or 0
    return {
        "itcAtRiskInr": 0,  # TODO: wire once itc_calculator.py output is available per-invoice
        "invoicesProcessed": total,
        "openTickets": open_tickets,
        "avgConfidence": round(avg_conf, 2),
        "msmePenaltyExposureInr": 0,  # TODO: wire once msme_penalty.py output is available
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

@router.get("/tickets")
def tickets(status: str = None, db: Session = Depends(get_db)):
    q = db.query(Ticket)
    if status and status != "all":
        q = q.filter(Ticket.status == status)
    rows = q.all()
    out = []
    for t in rows:
        inv = db.query(Invoice).filter(Invoice.id == t.invoice_id).first()
        out.append(_ticket_to_frontend_shape(t, inv))
    out.sort(key=lambda x: x["riskScore"] or 0, reverse=True)
    return out

@router.get("/tickets/{ticket_id}")
def ticket_detail(ticket_id: str, db: Session = Depends(get_db)):
    real_id = int(ticket_id.replace("TCK-", ""))
    t = db.query(Ticket).filter(Ticket.id == real_id).first()
    inv = db.query(Invoice).filter(Invoice.id == t.invoice_id).first() if t else None
    return _ticket_to_frontend_shape(t, inv) if t else {}

@router.post("/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: str, payload: dict, db: Session = Depends(get_db)):
    real_id = int(ticket_id.replace("TCK-", ""))
    actor = payload.get("actor", "auditor")
    reason = payload.get("reason", "")
    if payload.get("falsePositive"):
        t = mark_false_positive(db, real_id, actor, reason)
    else:
        t = update_status(db, real_id, "resolved", actor, reason)
    return {"ok": True, "ticketId": ticket_id, "status": t.status}

@router.post("/tickets/bulk-resolve")
def bulk_resolve_tickets(payload: dict, db: Session = Depends(get_db)):
    ticket_ids = payload.get("ticketIds", [])
    reason = payload.get("reason", "Bulk resolved by auditor")
    actor = payload.get("actor", "auditor")
    for tid in ticket_ids:
        real_id = int(str(tid).replace("TCK-", ""))
        update_status(db, real_id, "resolved", actor, reason)
    return {"ok": True, "count": len(ticket_ids)}

@router.get("/invoices/{invoice_id}")
def invoice_detail(invoice_id: str, db: Session = Depends(get_db)):
    real_id = int(invoice_id.replace("INV-", ""))
    inv = db.query(Invoice).filter(Invoice.id == real_id).first()
    if not inv:
        return {}
    tickets = db.query(Ticket).filter(Ticket.invoice_id == real_id).all()
    fields = inv.extracted_raw or {}
    conf = inv.field_confidence or {}
    return {
        "id": invoice_id,
        "fileUrl": None,
        "vendor": inv.vendor_name,
        "gstin": inv.vendor_gstin,
        "invoiceDate": inv.invoice_date.isoformat()[:10] if inv.invoice_date else None,
        "extractionConfidence": inv.confidence_score,
        "fields": [
            {"label": k.replace("_", " ").title(), "value": v, "confidence": conf.get(k, 0)}
            for k, v in fields.items()
        ],
        "flags": [
            {
                "type": t.exception_type,
                "detail": t.narrative,
                "msmeNarrative": getattr(t, "msme_narrative", None) or get_msme_fallback(t.exception_type, t.narrative),
            }
            for t in tickets
        ],
    }

@router.post("/invoices/upload")
async def upload_invoices(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    payload = [(f.filename, await f.read()) for f in files]
    result = process_batch(payload)
    out = []
    for item in result["processed"]:
        risk = process_invoice(db, item["filename"], item["extraction"], item["forensics"])
        needs_review = risk.get("needs_review", [])
        out.append({
            "filename": item["filename"],
            "status": "needs-review" if needs_review else "accepted",
        })
    for item in result["rejected"]:
        out.append({"filename": item["filename"], "status": "rejected"})
    return out

@router.post("/dev/reset")
def reset_database(db: Session = Depends(get_db)):
    db.query(Ticket).delete()
    db.query(Invoice).delete()
    db.commit()
    return {"ok": True, "message": "All invoices and tickets cleared."}