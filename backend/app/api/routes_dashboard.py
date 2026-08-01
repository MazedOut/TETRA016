"""API routes: dashboard."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def placeholder():
    return {"message": "dashboard route scaffold - not yet implemented"}
