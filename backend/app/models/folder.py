"""SQLAlchemy model: folder / category grouping."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.db.database import Base


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    category = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
