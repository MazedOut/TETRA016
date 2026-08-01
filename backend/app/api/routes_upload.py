"""API routes: upload."""
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.ingestion.batch_handler import process_batch
from app.orchestrator import process_invoice

router = APIRouter()

@router.post("/")
async def upload_batch(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    payload = [(f.filename, await f.read()) for f in files]
    result = process_batch(payload)
    for item in result["processed"]:
        item["risk"] = process_invoice(db, item["filename"], item["extraction"], item["forensics"])
    return result