"""SQLAlchemy model: vendor master + cached classification/risk profile."""
from sqlalchemy import Column, Integer, String, Float, JSON
from app.db.database import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    gstin = Column(String, index=True, unique=True, nullable=True)
    category = Column(String, nullable=True)               # cached classification
    is_in_master_list = Column(Integer, default=1)          # 1 = known vendor, 0 = phantom
    vendor_risk_score = Column(Float, default=0)
    activity_profile = Column(JSON, nullable=True)          # invoice frequency/amount history stats
