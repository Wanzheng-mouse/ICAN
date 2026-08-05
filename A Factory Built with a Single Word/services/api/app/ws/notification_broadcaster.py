"""Real-time notification broadcaster (M5, 2026-08-05).

Replaces the polling-based notification WebSocket with a pub/sub model.
Any part of the application can call ``NotificationBroadcaster.broadcast(user_id, notification)``
to push a notification to all connected clients for that user in real-time.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import asdict, dataclass
from typing import Any

from app.database import SessionLocal
from app.models import Notification
from app.shared import _utcnow


@dataclass
class NotificationPayload:
    """Single notification push payload."""

    id: str
    type: str
    title: str
    content: str
    target_url: str | None
    created_at: str


@dataclass
class NotificationListPayload:
    """Full notification list payload."""

    type: str
    items: list[dict[str, Any]]
    total: int
    unread: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class NotificationBroadcaster:
    """Manages WebSocket subscriptions per user and broadcasts notifications."""

    def __init__(self) -> None:
        # user_id -> list of asyncio.Queue instances
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def subscribe(self, user_id: str) -> asyncio.Queue:
        """Subscribe to notifications for a user. Returns a queue for receiving updates."""
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._subscribers[user_id].append(queue)
        return queue

    async def unsubscribe(self, user_id: str, queue: asyncio.Queue) -> None:
        """Unsubscribe a queue from notifications."""
        async with self._lock:
            if queue in self._subscribers[user_id]:
                self._subscribers[user_id].remove(queue)
            if not self._subscribers[user_id]:
                del self._subscribers[user_id]

    async def broadcast(self, user_id: str, notification_data: dict[str, Any]) -> int:
        """Broadcast a notification to all connected clients for this user.

        Returns the number of clients that received the notification.
        """
        payload = NotificationPayload(
            id=notification_data["id"],
            type=notification_data["type"],
            title=notification_data["title"],
            content=notification_data["content"],
            target_url=notification_data.get("target_url"),
            created_at=notification_data["created_at"],
        )
        async with self._lock:
            queues = list(self._subscribers.get(user_id, []))
        delivered = 0
        for queue in queues:
            try:
                queue.put_nowait(payload)
                delivered += 1
            except asyncio.QueueFull:
                pass  # Client is slow, skip this notification
        return delivered

    async def push_unread_list(self, user_id: str) -> int:
        """Push the current unread notification list to all connected clients.

        Called when a client first connects or requests a refresh.
        Returns the number of clients that received the list.
        """
        with SessionLocal() as db:
            notes = (
                db.query(Notification)
                .filter(Notification.user_id == user_id, Notification.read.is_(False))
                .order_by(Notification.created_at.desc())
                .limit(10)
                .all()
            )
            total = db.query(Notification).filter(Notification.user_id == user_id).count()
            unread_count = (
                db.query(Notification)
                .filter(Notification.user_id == user_id, Notification.read.is_(False))
                .count()
            )
            payload = NotificationListPayload(
                type="notification_list",
                items=[
                    {
                        "id": n.id,
                        "type": n.type,
                        "title": n.title,
                        "content": n.content,
                        "target_url": n.target_url,
                        "created_at": str(n.created_at),
                    }
                    for n in notes
                ],
                total=total,
                unread=unread_count,
            )
        async with self._lock:
            queues = list(self._subscribers.get(user_id, []))
        delivered = 0
        for queue in queues:
            try:
                queue.put_nowait(payload)
                delivered += 1
            except asyncio.QueueFull:
                pass
        return delivered


# Global singleton instance
notification_broadcaster = NotificationBroadcaster()


# Convenience function for creating and broadcasting a notification
def create_and_broadcast(
    user_id: str,
    notification_type: str,
    title: str,
    content: str,
    target_url: str | None = None,
) -> Notification | None:
    """Create a notification in the database and broadcast it to connected clients.

    This is the preferred way to create notifications that should be pushed in real-time.
    Returns the created Notification object, or None if creation failed.
    """
    with SessionLocal() as db:
        notification = Notification(
            id=f"n-{_utcnow().strftime('%Y%m%d%H%M%S')}-{user_id[:8]}",
            user_id=user_id,
            type=notification_type,
            title=title,
            content=content,
            read=False,
            target_url=target_url,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        # Broadcast to connected clients (async, non-blocking)
        notification_data = {
            "id": notification.id,
            "type": notification.type,
            "title": notification.title,
            "content": notification.content,
            "target_url": notification.target_url,
            "created_at": str(notification.created_at),
        }

    # Schedule the broadcast without blocking
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(notification_broadcaster.broadcast(user_id, notification_data))
        else:
            asyncio.run(notification_broadcaster.broadcast(user_id, notification_data))
    except RuntimeError:
        pass  # No event loop available

    return notification
