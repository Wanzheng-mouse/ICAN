"""Authoritative background scheduler for warehouse simulations.

WebSocket consumers deliberately do not advance simulations.  A run therefore
continues when nobody is looking at it, and two viewers cannot advance the
same warehouse twice.  The scheduler owns ticking; sockets only subscribe to
published snapshots.
"""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    SimulationCargoRecord,
    SimulationRun,
    SimulationRuntimeLease,
    SimulationRuntimeState,
    SimulationSnapshot,
    SimulationTaskRecord,
)
from app.services.simulation import simulation_service


def _utcnow() -> datetime:
    """Naive UTC now — compatible with SQLite-stored datetimes."""
    return datetime.now(UTC).replace(tzinfo=None)


def hydrate_runtime(db: Session, run: SimulationRun) -> dict[str, Any]:
    """Attach runtime to a run only for the duration of an engine operation."""
    state = db.get(SimulationRuntimeState, run.id)
    config = deepcopy(run.config or {})
    if state is not None:
        config["runtime_snapshot"] = deepcopy(state.runtime)
        config["initial_runtime_snapshot"] = deepcopy(state.initial_runtime)
    run.config = config
    return config.get("runtime_snapshot", {})


def persist_runtime(db: Session, run: SimulationRun) -> SimulationRuntimeState:
    """Upsert mutable state, then remove it from the run configuration JSON."""
    config = deepcopy(run.config or {})
    runtime = deepcopy(config.pop("runtime_snapshot", {}))
    initial = deepcopy(config.pop("initial_runtime_snapshot", runtime))
    state = db.get(SimulationRuntimeState, run.id)
    if state is None:
        state = SimulationRuntimeState(
            simulation_id=run.id, runtime=runtime, initial_runtime=initial, revision=0
        )
        db.add(state)
    else:
        state.runtime = runtime
        if not state.initial_runtime:
            state.initial_runtime = initial
        state.revision += 1
    run.config = config
    return state


def snapshot_from_run(db: Session, run: SimulationRun) -> dict[str, Any]:
    """Serialize the latest durable runtime without advancing it."""
    elapsed = int((run.config or {}).get("elapsed", 0))
    hydrate_runtime(db, run)
    if elapsed <= 0:
        # No advancement needed: build tick from runtime without deep-copy
        # or persist_runtime.  This avoids pointless overhead for every new
        # WebSocket connection that joins an idle / completed simulation.
        runtime = (run.config or {}).get("runtime_snapshot", {})
        completed = sum(1 for t in runtime.get("tasks", []) if t.get("status") == "completed")
        # Use the latest persisted metrics when present; otherwise compute
        # them on the fly so the UI can still report real utilization /
        # completion numbers even on the first WebSocket connect.
        metrics = run.metrics or simulation_service._metrics(runtime)
        tick: dict[str, Any] = {
            "type": "simulation_tick",
            "run_id": run.id,
            "time": 0,
            "robots": [
                {
                    "id": r["id"],
                    "state": r["state"],
                    "battery": round(r["battery"], 1),
                    "x": round(r["x"], 2),
                    "y": round(r["y"], 2),
                    "heading": round(r["heading"], 4),
                    "route": r["route"],
                    "load_status": r["load_status"],
                    "task_id": r["task_id"],
                    "path_strategy": r.get("path_strategy", "balanced"),
                    "station_wait_seconds": round(float(r.get("station_wait_seconds", 0.0)), 2),
                    "station_queue_wait_seconds": round(
                        float(r.get("station_queue_wait_seconds", 0.0)), 2
                    ),
                    "waiting_seconds": round(float(r.get("waiting_seconds", 0.0)), 2),
                }
                for r in runtime.get("robots", [])
            ],
            "tasks": {"total": len(runtime.get("tasks", [])), "completed": completed},
            "task_items": runtime.get("tasks", []),
            "cargos": runtime.get("cargos", []),
            "stations": runtime.get("stations", {}),
            "arm_states": [],
            "events": run.events or [],
            "metrics": metrics,
            "generated_at": datetime.now(UTC).isoformat(),
        }
        return tick
    tick = simulation_service.tick(run, elapsed)
    persist_runtime(db, run)
    return tick


def _upsert_projections(db: Session, run: SimulationRun, tick: dict[str, Any]) -> None:
    # Batch-load existing task and cargo records to avoid per-row queries
    # (previously 200+ queries per tick for large simulations).
    task_items = tick.get("task_items", [])
    cargo_items = tick.get("cargos", [])

    task_ids = [str(t.get("id", "")) for t in task_items if t.get("id")]
    cargo_ids = [str(c.get("id", "")) for c in cargo_items if c.get("id")]

    existing_tasks: dict[str, SimulationTaskRecord] = {}
    if task_ids:
        existing_tasks = {
            row.task_id: row
            for row in db.query(SimulationTaskRecord)
            .filter(
                SimulationTaskRecord.simulation_id == run.id,
                SimulationTaskRecord.task_id.in_(task_ids),
            )
            .all()
        }

    existing_cargos: dict[str, SimulationCargoRecord] = {}
    if cargo_ids:
        existing_cargos = {
            row.cargo_id: row
            for row in db.query(SimulationCargoRecord)
            .filter(
                SimulationCargoRecord.simulation_id == run.id,
                SimulationCargoRecord.cargo_id.in_(cargo_ids),
            )
            .all()
        }

    for task in task_items:
        task_id = str(task.get("id", ""))
        if not task_id:
            continue
        row = existing_tasks.get(task_id)
        if row is None:
            row = SimulationTaskRecord(
                simulation_id=run.id, task_id=task_id, status="pending", payload={}
            )
            db.add(row)
        row.status = str(task.get("status", "pending"))
        row.assigned_robot = task.get("assigned_robot")
        row.payload = deepcopy(task)

    for cargo in cargo_items:
        cargo_id = str(cargo.get("id", ""))
        if not cargo_id:
            continue
        row = existing_cargos.get(cargo_id)
        if row is None:
            row = SimulationCargoRecord(
                simulation_id=run.id, cargo_id=cargo_id, status="receiving", payload={}
            )
            db.add(row)
        row.status = str(cargo.get("status", "receiving"))
        row.location_id = cargo.get("location_id")
        row.payload = deepcopy(cargo)


def persist_tick(
    db: Session,
    run: SimulationRun,
    tick: dict[str, Any],
    *,
    keep_legacy_history: bool = False,
) -> bool:
    """Persist one engine tick and return whether the run just completed."""
    elapsed = int(tick["time"])
    previous_status = run.status
    run.metrics = deepcopy(tick["metrics"])
    config = deepcopy(run.config or {})
    config["elapsed"] = elapsed
    history = list(config.get("metric_history", []))
    history.append(
        {
            "time": elapsed,
            **tick["metrics"],
            "completed_orders": tick["tasks"]["completed"],
        }
    )
    config["metric_history"] = history[-300:]
    # Older installs can still read this small compatibility history. New runs
    # use simulation_snapshots rather than growing an unbounded config JSON.
    if keep_legacy_history:
        snapshots = list(config.get("snapshot_history", []))
        snapshots.append(
            {
                "time": elapsed,
                "metrics": tick["metrics"],
                "tasks": tick["tasks"],
                "task_items": tick.get("task_items", []),
                "cargos": tick.get("cargos", []),
                "runtime": deepcopy(config.get("runtime_snapshot", {})),
            }
        )
        config["snapshot_history"] = snapshots[-20:]
    run.config = config
    state = persist_runtime(db, run)
    row = (
        db.query(SimulationSnapshot)
        .filter_by(simulation_id=run.id, elapsed=elapsed)
        .with_for_update()
        .one_or_none()
    )
    if row is None:
        try:
            with db.begin_nested():
                row = SimulationSnapshot(simulation_id=run.id, elapsed=elapsed)
                db.add(row)
                db.flush()
        except IntegrityError:
            db.rollback()
            row = (
                db.query(SimulationSnapshot).filter_by(simulation_id=run.id, elapsed=elapsed).one()
            )
    row.metrics = deepcopy(tick["metrics"])
    row.task_summary = deepcopy(tick["tasks"])
    row.runtime = deepcopy(state.runtime)
    _upsert_projections(db, run, tick)
    if float(tick["metrics"].get("completion_rate", 0)) >= 1:
        run.status = "completed"
    return previous_status != "completed" and run.status == "completed"


class SimulationRuntimeScheduler:
    """One in-process runtime owner with fan-out queues for socket clients."""

    def __init__(self, interval_seconds: float = 1.0) -> None:
        self.interval_seconds = interval_seconds
        self._task: asyncio.Task[None] | None = None
        # Created again in start(): TestClient and reloaders may provide a new
        # event loop for every application lifespan.
        self._stopping: asyncio.Event | None = None
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}
        self.owner_id = f"runtime-{uuid4().hex}"

    def _acquire_lease(self, db: Session, simulation_id: str) -> bool:
        """Atomically acquire/renew a short database lease across API workers."""
        now = _utcnow()
        expires = now + timedelta(seconds=max(4.0, self.interval_seconds * 4))
        updated = (
            db.query(SimulationRuntimeLease)
            .filter(
                SimulationRuntimeLease.simulation_id == simulation_id,
                or_(
                    SimulationRuntimeLease.owner_id == self.owner_id,
                    SimulationRuntimeLease.expires_at < now,
                ),
            )
            .update(
                {"owner_id": self.owner_id, "expires_at": expires, "updated_at": now},
                synchronize_session=False,
            )
        )
        if updated:
            return True
        try:
            with db.begin_nested():
                db.add(
                    SimulationRuntimeLease(
                        simulation_id=simulation_id,
                        owner_id=self.owner_id,
                        expires_at=expires,
                    )
                )
                db.flush()
            return True
        except IntegrityError:
            return False

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stopping = asyncio.Event()
        self._task = asyncio.create_task(self._run(), name="ican-simulation-runtime")

    async def stop(self) -> None:
        if self._stopping:
            self._stopping.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        self._stopping = None
        self._subscribers.clear()

    def subscribe(self, simulation_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=2)
        self._subscribers.setdefault(simulation_id, set()).add(queue)
        return queue

    def unsubscribe(self, simulation_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        subscribers = self._subscribers.get(simulation_id)
        if not subscribers:
            return
        subscribers.discard(queue)
        if not subscribers:
            self._subscribers.pop(simulation_id, None)

    def publish(self, simulation_id: str, tick: dict[str, Any]) -> None:
        for queue in tuple(self._subscribers.get(simulation_id, set())):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(tick)
            except asyncio.QueueFull:
                pass

    async def _run(self) -> None:
        stopping = self._stopping
        if stopping is None:
            return
        while not stopping.is_set():
            with SessionLocal() as db:
                runs = db.query(SimulationRun).filter(SimulationRun.status == "running").all()
                for run in runs:
                    if not self._acquire_lease(db, run.id):
                        continue
                    hydrate_runtime(db, run)
                    elapsed = int((run.config or {}).get("elapsed", 0)) + 1
                    tick = simulation_service.tick(run, elapsed)
                    persist_tick(db, run, tick)
                    self.publish(run.id, tick)
                if runs:
                    db.commit()
            try:
                await asyncio.wait_for(stopping.wait(), timeout=self.interval_seconds)
            except TimeoutError:
                continue


runtime_scheduler = SimulationRuntimeScheduler()
