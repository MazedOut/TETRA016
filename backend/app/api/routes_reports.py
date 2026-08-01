"""API routes: reports."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def placeholder():
    return {"message": "reports route scaffold - not yet implemented"}
