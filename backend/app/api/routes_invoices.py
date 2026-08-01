"""API routes: invoices."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def placeholder():
    return {"message": "invoices route scaffold - not yet implemented"}
