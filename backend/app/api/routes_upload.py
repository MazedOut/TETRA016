"""API routes: upload."""
from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.post("/")
async def upload_batch(files: list[UploadFile] = File(...)):
    from app.ingestion.batch_handler import process_batch
    payload = [(f.filename, await f.read()) for f in files]
    return process_batch(payload)