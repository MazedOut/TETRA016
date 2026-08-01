"""API routes: tickets."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def placeholder():
    return {"message": "tickets route scaffold - not yet implemented"}
