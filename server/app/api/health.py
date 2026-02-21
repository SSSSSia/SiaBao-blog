"""Health check API routes."""
from fastapi import APIRouter

from app.core import R

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> R:
    """Health check endpoint."""
    return R.ok(message="Server is running", data={"status": "ok"})
