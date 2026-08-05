"""Audit-log endpoints (formerly in main.py).

Moved verbatim during the phase-2 router split (M4).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import User, get_current_user
from app.models import AuditLog
from app.shared import PREFIX

router = APIRouter()


@router.get(f"{PREFIX}/audit-logs", response_model=list[dict], tags=["audit"])
def list_audit_logs(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看审计日志")
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "detail": log.detail,
            "created_at": str(log.created_at),
        }
        for log in logs
    ]
