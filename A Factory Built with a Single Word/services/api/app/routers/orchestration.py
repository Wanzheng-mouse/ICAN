"""Orchestration endpoints (formerly in main.py).

Moved verbatim during the phase-2 router split (M4).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import User, get_current_user, record_audit
from app.shared import PREFIX, _utcnow

router = APIRouter()


@router.get(f"{PREFIX}/orchestration/agents", tags=["orchestration"])
def list_orchestration_agents(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    return [
        {"id": "agent-orch-1", "name": "规划决策体", "status": "ready", "type": "orch"},
        {"id": "agent-orch-2", "name": "调度执行体", "status": "ready", "type": "orch"},
    ]


@router.post(f"{PREFIX}/orchestration/execute", tags=["orchestration"])
def execute_orchestration(
    payload: dict[str, Any] | None = Body(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Start an auditable orchestration command instead of a client-only toast."""
    command = payload or {}
    record_audit(db, user, "orchestration.execute", "orchestration", None, command)
    db.commit()
    return {"status": "started", "started_at": _utcnow().isoformat(), "command": command}
