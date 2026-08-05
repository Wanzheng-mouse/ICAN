"""WebSocket connection helpers (M5, 2026-07-26).

Extracted from the two websocket handlers so the shared auth / user-resolution
logic lives in one place. The underlying pub-sub still goes through
``runtime_scheduler`` — this module only encapsulates the duplicated bits so
the handlers stay focused on their transport loop.
"""

from __future__ import annotations

from app.database import SessionLocal
from app.models import AuthToken, User
from app.shared import _utcnow


def authenticate_ws(token: str | None) -> User | None:
    """Resolve the authenticated user for a websocket connection.

    Mirrors the inline auth block that previously lived in both handlers:
    returns ``None`` when the token is missing/expired so the caller can close
    the socket with a 4401.
    """
    with SessionLocal() as db:
        stored = db.get(AuthToken, token) if token else None
        if stored and stored.expires_at >= _utcnow():
            return db.get(User, stored.user_id)
    return None
