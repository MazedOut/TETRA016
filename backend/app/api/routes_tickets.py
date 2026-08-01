"""API routes: tickets."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.audit_trail.ticket_manager import (
    create_ticket, update_status, mark_false_positive, merge_tickets, list_tickets
)
from app.models.ticket import Ticket

router = APIRouter()

@router.get("/")
def get_tickets(status: str = None, exception_type: str = None, db: Session = Depends(get_db)):
    tickets = list_tickets(db, status=status, exception_type=exception_type)
    return [_serialize(t) for t in tickets]

@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(404, "ticket not found")
    return _serialize(t)

@router.post("/")
def post_ticket(invoice_id: int, exception_type: str, risk_contribution: int,
                narrative: str = None, db: Session = Depends(get_db)):
    t = create_ticket(db, invoice_id, exception_type, risk_contribution, narrative)
    return _serialize(t)

@router.patch("/{ticket_id}/status")
def patch_status(ticket_id: int, new_status: str, actor: str, reason: str = "", db: Session = Depends(get_db)):
    try:
        t = update_status(db, ticket_id, new_status, actor, reason)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _serialize(t)

@router.patch("/{ticket_id}/false-positive")
def patch_false_positive(ticket_id: int, actor: str, reason: str, db: Session = Depends(get_db)):
    try:
        t = mark_false_positive(db, ticket_id, actor, reason)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _serialize(t)

@router.post("/{source_id}/merge/{target_id}")
def post_merge(source_id: int, target_id: int, actor: str, reason: str, db: Session = Depends(get_db)):
    try:
        t = merge_tickets(db, source_id, target_id, actor, reason)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _serialize(t)

def _serialize(t: Ticket) -> dict:
    return {
        "id": t.id,
        "invoice_id": t.invoice_id,
        "exception_type": t.exception_type,
        "status": t.status,
        "risk_contribution": t.risk_contribution,
        "narrative": t.narrative,
        "resolution_reason": t.resolution_reason,
        "is_false_positive": bool(t.is_false_positive),
        "merged_into_ticket_id": t.merged_into_ticket_id,
        "history": t.history,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }