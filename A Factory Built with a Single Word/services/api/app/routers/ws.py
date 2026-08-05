"""WebSocket endpoints (formerly in main.py) — phase-2 modularization (M5).

Updated 2026-08-05: notification stream now uses push-based pub/sub model
instead of polling the database every 30 seconds.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.database import SessionLocal
from app.domain import require_simulation_access
from app.models import Notification, SimulationRun
from app.services.runtime_scheduler import runtime_scheduler, snapshot_from_run
from app.shared import PREFIX, logger
from app.ws.manager import authenticate_ws
from app.ws.notification_broadcaster import NotificationListPayload, notification_broadcaster

router = APIRouter()


@router.websocket(f"{PREFIX}/simulations/{{simulation_id}}/stream")
async def stream_simulation(
    websocket: WebSocket, simulation_id: str, token: str | None = None
) -> None:
    await websocket.accept()
    with SessionLocal() as db:
        user = authenticate_ws(token)
        if user is None:
            await websocket.send_json({"type": "error", "message": "Authentication required"})
            await websocket.close(code=4401)
            return
        try:
            require_simulation_access(simulation_id, user, db)
        except HTTPException:
            await websocket.send_json({"type": "error", "message": "Simulation access denied"})
            await websocket.close(code=4403)
            return
    queue = runtime_scheduler.subscribe(simulation_id)
    try:
        with SessionLocal() as db:
            run = db.get(SimulationRun, simulation_id)
            if run is None:
                await websocket.send_json({"type": "error", "message": "Simulation run not found"})
                await websocket.close(code=1008)
                return
            try:
                await websocket.send_json(snapshot_from_run(db, run))
            except Exception:  # noqa: BLE001 - isolate one bad snapshot from the stream
                logger.exception(
                    "Failed to build initial snapshot for simulation %s", simulation_id
                )
                await websocket.send_json(
                    {"type": "error", "message": "无法加载仿真快照，请检查仿真配置"}
                )
                await websocket.close(code=1011)
                return
        # Listen for client heartbeats while independently forwarding scheduler
        # snapshots.  The previous queue-only loop never consumed `ping`, so
        # browsers appeared connected but could not verify a live transport.
        queue_task = asyncio.create_task(queue.get())
        receive_task = asyncio.create_task(websocket.receive_text())
        try:
            while True:
                done, _ = await asyncio.wait(
                    {queue_task, receive_task}, return_when=asyncio.FIRST_COMPLETED
                )
                if queue_task in done:
                    await websocket.send_json(queue_task.result())
                    queue_task = asyncio.create_task(queue.get())
                if receive_task in done:
                    raw = receive_task.result()
                    try:
                        payload = json.loads(raw)
                    except json.JSONDecodeError:
                        payload = {}
                    if payload.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                    receive_task = asyncio.create_task(websocket.receive_text())
        finally:
            queue_task.cancel()
            receive_task.cancel()
    except WebSocketDisconnect:
        logger.info("Simulation WebSocket disconnected for %s", simulation_id)
    except Exception:  # noqa: BLE001 - socket teardown must never crash the loop
        logger.exception("Simulation WebSocket error for %s", simulation_id)
    finally:
        runtime_scheduler.unsubscribe(simulation_id, queue)


@router.websocket(f"{PREFIX}/notifications/stream")
async def stream_notifications(websocket: WebSocket, token: str | None = None) -> None:
    """Real-time notification stream using push-based pub/sub model.

    Instead of polling the database every 30 seconds, this now subscribes to
    a notification broadcaster that pushes updates immediately when notifications
    are created.
    """
    await websocket.accept()
    user = authenticate_ws(token)
    if user is None:
        await websocket.send_json({"type": "error", "message": "Authentication required"})
        await websocket.close(code=4401)
        return

    queue = await notification_broadcaster.subscribe(user.id)
    try:
        # Send initial unread list
        with SessionLocal() as db:
            notes = (
                db.query(Notification)
                .filter(Notification.user_id == user.id, Notification.read.is_(False))
                .order_by(Notification.created_at.desc())
                .limit(10)
                .all()
            )
            total = db.query(Notification).filter(Notification.user_id == user.id).count()
            unread = (
                db.query(Notification)
                .filter(Notification.user_id == user.id, Notification.read.is_(False))
                .count()
            )
            await websocket.send_json(
                {
                    "type": "notification_list",
                    "items": [
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
                    "total": total,
                    "unread": unread,
                }
            )

        # Listen for push notifications and client heartbeats concurrently
        queue_task = asyncio.create_task(queue.get())
        receive_task = asyncio.create_task(websocket.receive_text())
        while True:
            done, _ = await asyncio.wait(
                {queue_task, receive_task}, return_when=asyncio.FIRST_COMPLETED
            )
            if queue_task in done:
                # Got a push from the broadcaster
                payload = await queue_task
                if isinstance(payload, NotificationListPayload):
                    # Full list push
                    await websocket.send_json(payload.to_dict())
                else:
                    # Single notification push (NotificationPayload)
                    await websocket.send_json(
                        {
                            "type": "notification_changed",
                            "items": [
                                {
                                    "id": payload.id,
                                    "type": payload.type,
                                    "title": payload.title,
                                    "content": payload.content,
                                    "target_url": payload.target_url,
                                    "created_at": payload.created_at,
                                }
                            ],
                        }
                    )
                # Re-create the queue getter
                queue_task = asyncio.create_task(queue.get())
            if receive_task in done:
                raw = receive_task.result()
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    message = {}
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "refresh":
                    # Client requested a full refresh - push the current list
                    await notification_broadcaster.push_unread_list(user.id)
                receive_task = asyncio.create_task(websocket.receive_text())
    except WebSocketDisconnect:
        logger.info(
            "Notification WebSocket disconnected for user %s", user.id if user else "unknown"
        )
    except Exception:  # noqa: BLE001 - socket teardown must never crash the loop
        logger.exception("Notification WebSocket error for user %s", user.id if user else "unknown")
    finally:
        queue_task.cancel()
        receive_task.cancel()
        await notification_broadcaster.unsubscribe(user.id, queue)
