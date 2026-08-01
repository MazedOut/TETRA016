"""SQLAlchemy model: exception ticket in the audit trail."""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from app.db.database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    exception_type = Column(String, index=True)              # duplicate, gstin_invalid, mismatch, etc.
    status = Column(String, default="open")                   # open / in-review / resolved / escalated
    risk_contribution = Column(Integer, default=0)
    narrative = Column(String, nullable=True)                 # AI-generated explanation
    resolution_reason = Column(String, nullable=True)
    is_false_positive = Column(Integer, default=0)
    merged_into_ticket_id = Column(Integer, nullable=True)
    merge_reason = Column(String, nullable=True)
    history = Column(JSON, nullable=True)                      # append-only action log
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
