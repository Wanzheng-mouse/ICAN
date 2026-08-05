"""Report / analytics endpoints (formerly in main.py)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import get_current_user, record_audit, require_simulation_access
from app.models import SimulationSnapshot, User
from app.services.report import (
    build_anomalies,
    build_anomaly_total,
    build_device_usages,
    build_fulfillment,
    build_kpis,
    build_scene_rankings,
    build_simulation_pdf,
    build_trend,
)
from app.services.runtime_scheduler import hydrate_runtime
from app.shared import PREFIX

router = APIRouter()


@router.get(f"{PREFIX}/reports/{{simulation_id}}/pdf")
def download_report(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    run = require_simulation_access(simulation_id, user, db, write=True)
    hydrate_runtime(db, run)
    body = build_simulation_pdf(run)
    record_audit(db, user, "export", "simulation_report", run.id, {"format": "pdf"})
    db.commit()
    return Response(
        body,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ican-report-{simulation_id}.pdf"'},
    )


@router.get(f"{PREFIX}/reports/{{simulation_id}}/kpis", tags=["reports"])
def report_kpis(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return build_kpis(run)


@router.get(f"{PREFIX}/reports/{{simulation_id}}/trend", tags=["reports"])
def report_trend(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return build_trend(run)


@router.get(f"{PREFIX}/reports/{{simulation_id}}/device-usages", tags=["reports"])
def report_device_usages(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return build_device_usages(run)


@router.get(f"{PREFIX}/reports/{{simulation_id}}/anomalies", tags=["reports"])
def report_anomalies(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return build_anomalies(run)


@router.get(f"{PREFIX}/reports/{{simulation_id}}/anomaly-total", tags=["reports"])
def report_anomaly_total(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> int:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return build_anomaly_total(run)


@router.get(f"{PREFIX}/reports/{{simulation_id}}/scene-rankings", tags=["reports"])
def report_scene_rankings(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return build_scene_rankings(run)


@router.get(f"{PREFIX}/reports/{{simulation_id}}/fulfillment", tags=["reports"])
def report_fulfillment(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return build_fulfillment(run)


@router.get(f"{PREFIX}/reports/{{simulation_id}}/log-playback", tags=["reports"])
def report_log_playback(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    run = require_simulation_access(simulation_id, user, db)
    rows = (
        db.query(SimulationSnapshot)
        .filter(SimulationSnapshot.simulation_id == simulation_id)
        .order_by(SimulationSnapshot.elapsed.asc())
        .all()
    )
    if rows:
        frames = []
        for row in rows:
            runtime = row.runtime or {}
            tasks = runtime.get("tasks", [])
            summary = row.task_summary or {}
            running_states = {
                "active",
                "to_pickup",
                "to_dropoff",
                "loading",
                "unloading",
                "waiting_pickup_resource",
                "waiting_dropoff_resource",
                "returning",
            }
            frames.append(
                {
                    "time": row.elapsed,
                    "robots": [
                        {
                            "id": r.get("id"),
                            "position": {"x": r.get("x", 0), "y": r.get("y", 0)},
                            "status": r.get("state") or r.get("status", "idle"),
                        }
                        for r in runtime.get("robots", [])
                    ],
                    "tasks": {
                        "pending": sum(1 for t in tasks if t.get("status") == "pending"),
                        "running": sum(1 for t in tasks if t.get("status") in running_states),
                        "completed": int(summary.get("completed", 0)),
                    },
                }
            )
        return {"frameCount": len(frames), "frames": frames}
    # Legacy fallback: older installs kept a bounded history inside run config.
    snapshot_history = (run.config or {}).get("snapshot_history", [])
    frames = [
        {
            "time": s.get("time", 0),
            "robots": [
                {
                    "id": r.get("id"),
                    "position": {"x": r.get("x", 0), "y": r.get("y", 0)},
                    "status": r.get("status", "idle"),
                }
                for r in s.get("robots", [])
            ],
            "tasks": {
                "pending": s.get("tasks_pending", 0),
                "running": s.get("tasks_running", 0),
                "completed": s.get("tasks_completed", 0),
            },
        }
        for s in snapshot_history
    ]
    return {"frameCount": len(frames), "frames": frames}
