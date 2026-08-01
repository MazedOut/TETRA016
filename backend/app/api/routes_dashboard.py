"""API routes: dashboard."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.invoice import Invoice
from app.models.ticket import Ticket

router = APIRouter()

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0
    by_risk = dict(
        db.query(Invoice.risk_level, func.count(Invoice.id)).group_by(Invoice.risk_level).all()
    )
    open_tickets = db.query(func.count(Ticket.id)).filter(Ticket.status == "open").scalar() or 0
    resolved_tickets = db.query(func.count(Ticket.id)).filter(Ticket.status == "resolved").scalar() or 0
    avg_confidence = db.query(func.avg(Invoice.confidence_score)).scalar() or 0

    return {
        "total_invoices": total_invoices,
        "by_risk_level": {
            "low": by_risk.get("low", 0),
            "medium": by_risk.get("medium", 0),
            "high": by_risk.get("high", 0),
        },
        "open_tickets": open_tickets,
        "resolved_tickets": resolved_tickets,
        "avg_confidence_score": round(avg_confidence, 2),
    }