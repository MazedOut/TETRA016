"""SQLAlchemy model: extracted + scored invoice record."""
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from app.db.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, index=True)
    invoice_date = Column(DateTime, nullable=True)
    vendor_name = Column(String, index=True)
    vendor_gstin = Column(String, index=True)
    po_number = Column(String, nullable=True)

    taxable_value = Column(Float, nullable=True)
    cgst = Column(Float, nullable=True)
    sgst = Column(Float, nullable=True)
    igst = Column(Float, nullable=True)
    total_amount = Column(Float, nullable=True)

    field_confidence = Column(JSON, nullable=True)      # per-field confidence scores
    extracted_raw = Column(JSON, nullable=True)          # full raw extraction payload

    risk_score = Column(Float, default=0)
    risk_level = Column(String, default="low")           # low / medium / high
    confidence_score = Column(Float, default=0)
    ocr_source = Column(String, nullable=True)           # tesseract / gemini / pdf_text


    folder = Column(String, nullable=True)                # auto-sorted or user-assigned
    folder_id = Column(Integer, nullable=True)             # linked Folder model ID
    source_file_path = Column(String, nullable=True)
    edit_history = Column(JSON, nullable=True)              # append-only list: {actor, field, old_value, new_value, timestamp}

    record_hash = Column(String, nullable=True)            # SHA-256 seal
    seal_signature = Column(String, nullable=True)         # HMAC-SHA256 signature
    sealed_at = Column(DateTime, nullable=True)            # when seal was applied
    forensic_metadata = Column(JSON, nullable=True)        # pikepdf/fitz forensic results
    registry_status = Column(JSON, nullable=True)          # Tier 3 GSTIN registry result (independent signal)
    pipeline_log = Column(JSON, nullable=True)             # array of {event, detail, timestamp, actor} entries
    created_at = Column(DateTime)
