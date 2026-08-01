"""API routes: reports & portfolio-level risk analysis."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.invoice import Invoice
from app.models.ticket import Ticket
from app.reconciliation.portfolio_analyzer import run_portfolio_analysis

router = APIRouter()


@router.get("/portfolio")
def get_portfolio_analysis(db: Session = Depends(get_db)):
    invoices = db.query(Invoice).all()
    return run_portfolio_analysis(invoices)


@router.post("/generate")
def generate_report(payload: dict, db: Session = Depends(get_db)):
    from_date = payload.get("from")
    to_date = payload.get("to")
    min_risk = payload.get("minRisk", 0)
    selected_types = payload.get("types", [])

    invoices = db.query(Invoice).all()
    if min_risk > 0:
        invoices = [inv for inv in invoices if (inv.risk_score or 0) >= min_risk]

    portfolio = run_portfolio_analysis(invoices)

    tickets_q = db.query(Ticket)
    if min_risk > 0:
        tickets_q = tickets_q.filter(Ticket.risk_contribution >= min_risk)
    tickets = tickets_q.all()

    if selected_types:
        tickets = [t for t in tickets if t.exception_type in selected_types]

    flagged_invoices_detail = []
    for inv in invoices:
        inv_tickets = [t for t in tickets if t.invoice_id == inv.id]
        if inv_tickets or not selected_types:
            flagged_invoices_detail.append({
                "id": f"INV-{inv.id}",
                "invoice_number": inv.invoice_number,
                "vendor_name": inv.vendor_name,
                "vendor_gstin": inv.vendor_gstin,
                "total_amount": inv.total_amount,
                "risk_score": inv.risk_score,
                "risk_level": inv.risk_level,
                "flags_count": len(inv_tickets),
                "tickets": [
                    {
                        "id": f"TCK-{t.id}",
                        "check": t.exception_type,
                        "narrative": t.narrative,
                        "msme_narrative": getattr(t, "msme_narrative", None),
                    }
                    for t in inv_tickets
                ],
            })

    return {
        "ok": True,
        "from": from_date or "2026-06-01",
        "to": to_date or "2026-08-01",
        "minRisk": min_risk,
        "types": selected_types,
        "summary": portfolio["summary"],
        "invoices_analyzed": portfolio["invoices_analyzed"],
        "high_risk_count": portfolio["high_risk_count"],
        "review_risk_count": portfolio["review_risk_count"],
        "clear_count": portfolio["clear_count"],
        "itc_at_risk_inr": portfolio["itc_at_risk_inr"],
        "msme_penalty_exposure_inr": portfolio["msme_penalty_exposure_inr"],
        "insufficient_data_notes": portfolio["insufficient_data_notes"],
        "flagged_invoices": flagged_invoices_detail,
        "url": None, # Rendered dynamically in frontend
    }
