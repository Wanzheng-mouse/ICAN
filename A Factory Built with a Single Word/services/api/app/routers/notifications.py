"""Notification (HTTP) endpoints (formerly in main.py).

Moved verbatim during the phase-2 router split (M4). The WebSocket half of the
notifications feature lives in ``app/routers/ws.py``; this module owns only the
two REST endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import User, get_current_user
from app.models import Notification
from app.shared import PREFIX

router = APIRouter()


@router.get(f"{PREFIX}/notifications", tags=["notifications"])
def list_notifications(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    items = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "content": n.content,
            "read": n.read,
            "target_url": n.target_url,
            "created_at": str(n.created_at),
        }
        for n in items
    ]


@router.patch(f"{PREFIX}/notifications/{{notification_id}}/read", tags=["notifications"])
def mark_notification_read(
    notification_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    n = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .first()
    )
    if n:
        n.read = True
        db.commit()
    return {"status": "ok", "id": notification_id}


@router.post(f"{PREFIX}/notifications/read-all", tags=["notifications"])
def mark_all_notifications_read(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """Mark all notifications for the current user as read."""
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read.is_(False))
        .update({Notification.read: True})
    )
    db.commit()
    return {"status": "ok", "updated": updated}
