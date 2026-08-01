"""SQLAlchemy model: purchase ledger row, loaded from the ledger CSV."""
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.db.database import Base


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, index=True)
    vendor_name = Column(String, index=True)
    total_amount = Column(Float, nullable=True)
    posting_date = Column(DateTime, nullable=True)
    matched_invoice_id = Column(Integer, nullable=True)     # set once reconciled
