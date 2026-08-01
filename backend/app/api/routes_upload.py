"""API routes: upload."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def placeholder():
    return {"message": "upload route scaffold - not yet implemented"}
