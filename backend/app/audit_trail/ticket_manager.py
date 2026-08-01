"""Ticket CRUD and status transitions: open / in-review / resolved / escalated.

Pipeline stage: Stage 7 - Audit trail
"""
import datetime as dt
from sqlalchemy.orm import Session
from app.models.ticket import Ticket
from .history_log import append_history

VALID_STATUSES = {"open", "in-review", "resolved", "escalated"}

def create_ticket(db: Session, invoice_id: int, exception_type: str,
                   risk_contribution: int, narrative: str = None) -> Ticket:
    ticket = Ticket(
        invoice_id=invoice_id,
        exception_type=exception_type,
        status="open",
        risk_contribution=risk_contribution,
        narrative=narrative,
        history=[],
        created_at=dt.datetime.utcnow(),
        updated_at=dt.datetime.utcnow(),
    )
    append_history(ticket, actor="system", action="created", details=exception_type)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

def update_status(db: Session, ticket_id: int, new_status: str, actor: str, reason: str = "") -> Ticket:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"invalid status '{new_status}', must be one of {VALID_STATUSES}")
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise ValueError(f"ticket {ticket_id} not found")
    old_status = ticket.status
    ticket.status = new_status
    ticket.updated_at = dt.datetime.utcnow()
    if new_status == "resolved":
        ticket.resolution_reason = reason
    append_history(ticket, actor=actor, action=f"status_changed:{old_status}->{new_status}", details=reason)
    db.commit()
    db.refresh(ticket)
    return ticket

def mark_false_positive(db: Session, ticket_id: int, actor: str, reason: str) -> Ticket:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket is None:
        raise ValueError(f"ticket {ticket_id} not found")
    ticket.is_false_positive = 1
    ticket.status = "resolved"
    ticket.resolution_reason = reason
    ticket.updated_at = dt.datetime.utcnow()
    append_history(ticket, actor=actor, action="marked_false_positive", details=reason)
    db.commit()
    db.refresh(ticket)
    return ticket

def merge_tickets(db: Session, source_ticket_id: int, target_ticket_id: int, actor: str, reason: str) -> Ticket:
    """Merges source into target. Human must have confirmed this — see
    ai_layer/merge_suggester.py, which only proposes, never auto-merges."""
    source = db.query(Ticket).filter(Ticket.id == source_ticket_id).first()
    if source is None:
        raise ValueError(f"ticket {source_ticket_id} not found")
    source.merged_into_ticket_id = target_ticket_id
    source.merge_reason = reason
    source.status = "resolved"
    source.updated_at = dt.datetime.utcnow()
    append_history(source, actor=actor, action=f"merged_into:{target_ticket_id}", details=reason)
    db.commit()
    db.refresh(source)
    return source

def list_tickets(db: Session, status: str = None, exception_type: str = None) -> list[Ticket]:
    q = db.query(Ticket)
    if status:
        q = q.filter(Ticket.status == status)
    if exception_type:
        q = q.filter(Ticket.exception_type == exception_type)
    return q.all()