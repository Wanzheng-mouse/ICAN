"""Health-check endpoints (formerly in main.py)."""

from __future__ import annotations

from fastapi import APIRouter

from app.shared import PREFIX

router = APIRouter()


@router.get(f"{PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health")
@router.get("/api/health")
def health_alt() -> dict[str, str]:
    return {"status": "ok"}
