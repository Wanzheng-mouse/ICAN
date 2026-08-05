"""Simulation endpoints (formerly in main.py)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, new_id
from app.domain import (
    get_current_user,
    latest_scenario_version,
    record_audit,
    require_project_access,
    require_scenario_access,
    require_simulation_access,
)
from app.models import Notification, SimulationRun, User
from app.schemas import AnomalyCreate, SimulationControl, SimulationCreate, SimulationRead
from app.services.runtime_scheduler import hydrate_runtime, persist_runtime, persist_tick
from app.services.simulation import simulation_service
from app.shared import PREFIX

router = APIRouter()


@router.post(
    f"{PREFIX}/simulations", response_model=SimulationRead, status_code=201, tags=["simulations"]
)
def create_simulation(
    payload: SimulationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SimulationRun:
    require_project_access(payload.project_id, user, db, write=True)
    scenario = require_scenario_access(payload.scenario_id, user, db)
    if scenario.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="场景不属于指定项目")
    run = simulation_service.create(
        payload,
        scenario_data=scenario.data,
        scenario_version=latest_scenario_version(db, scenario.id),
    )
    db.add(run)
    db.flush()
    persist_runtime(db, run)
    record_audit(db, user, "simulation.create", "simulation", run.id, payload.model_dump())
    db.commit()
    db.refresh(run)
    return run


@router.get(
    f"{PREFIX}/simulations/{{simulation_id}}", response_model=SimulationRead, tags=["simulations"]
)
def get_simulation(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SimulationRun:
    return require_simulation_access(simulation_id, user, db)


@router.post(
    f"{PREFIX}/simulations/{{simulation_id}}/control",
    response_model=SimulationRead,
    tags=["simulations"],
)
def control_simulation(
    simulation_id: str,
    payload: SimulationControl,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulationRun:
    run = require_simulation_access(simulation_id, user, db, write=True)
    if payload.action == "start" and run.status in ("running", "completed"):
        raise HTTPException(status_code=409, detail=f"仿真已在「{run.status}」状态，不能重复启动")
    run = simulation_service.control(run, payload.action)
    persist_runtime(db, run)
    record_audit(db, user, f"simulation.{payload.action}", "simulation", run.id)
    db.commit()
    db.refresh(run)
    return run


@router.post(
    f"{PREFIX}/simulations/{{simulation_id}}/anomalies",
    response_model=SimulationRead,
    tags=["simulations"],
)
def inject_anomaly(
    simulation_id: str,
    payload: AnomalyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulationRun:
    run = require_simulation_access(simulation_id, user, db, write=True)
    run = simulation_service.add_anomaly(run, payload.type, payload.description)
    persist_runtime(db, run)
    db.commit()
    db.refresh(run)
    return run


@router.get(
    f"{PREFIX}/simulations/{{simulation_id}}/events",
    response_model=list[dict[str, Any]],
    tags=["simulations"],
)
def list_simulation_events(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    """Return the durable event stream consumed by the runtime log and reports."""
    run = require_simulation_access(simulation_id, user, db)
    return list(run.events or [])


@router.post(
    f"{PREFIX}/simulations/{{simulation_id}}/tasks/{{task_id}}/reassign",
    response_model=SimulationRead,
    tags=["simulations"],
)
def reassign_simulation_task(
    simulation_id: str,
    task_id: str,
    payload: dict[str, Any] | None = Body(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulationRun:
    """Reassign a task to a different AGV or return it to the pending queue."""
    run = require_simulation_access(simulation_id, user, db, write=True)
    hydrate_runtime(db, run)
    body = payload or {}
    try:
        run = simulation_service.reassign_task(
            run, task_id, body.get("robot_id"), body.get("priority")
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"未找到资源：{exc}") from None
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    persist_runtime(db, run)
    record_audit(
        db,
        user,
        "simulation.reassign_task",
        "simulation",
        run.id,
        {"task_id": task_id, "robot_id": body.get("robot_id"), "priority": body.get("priority")},
    )
    db.commit()
    db.refresh(run)
    return run


@router.post(
    f"{PREFIX}/simulations/{{simulation_id}}/devices/{{robot_id}}/charge",
    response_model=SimulationRead,
    tags=["simulations"],
)
def charge_simulation_robot(
    simulation_id: str,
    robot_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulationRun:
    """Force an AGV into charging state immediately."""
    run = require_simulation_access(simulation_id, user, db, write=True)
    hydrate_runtime(db, run)
    try:
        run = simulation_service.charge_robot(run, robot_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"未找到机器人：{exc}") from None
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    persist_runtime(db, run)
    record_audit(db, user, "simulation.charge_robot", "simulation", run.id, {"robot_id": robot_id})
    db.commit()
    db.refresh(run)
    return run


@router.post(
    f"{PREFIX}/simulations/{{simulation_id}}/orders",
    response_model=SimulationRead,
    status_code=201,
    tags=["simulations"],
)
def create_simulation_order(
    simulation_id: str,
    payload: dict[str, Any] | None = Body(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulationRun:
    """Dynamically add a new order (task + cargo) to a running simulation."""
    run = require_simulation_access(simulation_id, user, db, write=True)
    hydrate_runtime(db, run)
    body = payload or {}
    run = simulation_service.add_order(
        run, priority=int(body.get("priority", 3)), kind=str(body.get("kind", "outbound"))
    )
    persist_runtime(db, run)
    record_audit(
        db,
        user,
        "simulation.add_order",
        "simulation",
        run.id,
        {"priority": body.get("priority", 3), "kind": body.get("kind", "outbound")},
    )
    db.commit()
    db.refresh(run)
    return run


@router.post(
    f"{PREFIX}/simulations/{{simulation_id}}/run-to-completion",
    response_model=SimulationRead,
    tags=["simulations"],
)
def run_simulation_to_completion(
    simulation_id: str,
    max_seconds: int = 3600,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulationRun:
    run = require_simulation_access(simulation_id, user, db, write=True)
    if run.status not in ("running", "created"):
        raise HTTPException(status_code=409, detail=f"仿真状态为「{run.status}」，无法运行到完成")
    hydrate_runtime(db, run)
    elapsed = int((run.config or {}).get("elapsed", 0))
    limit = elapsed + max(1, min(max_seconds, 86400))
    while elapsed < limit and float((run.metrics or {}).get("completion_rate", 0)) < 1:
        elapsed = min(limit, elapsed + 60)
        hydrate_runtime(db, run)
        tick = simulation_service.tick(run, elapsed)
        persist_tick(db, run, tick)
    if float((run.metrics or {}).get("completion_rate", 0)) >= 1:
        run.status = "completed"
        db.add(
            Notification(
                id=new_id(),
                user_id=user.id,
                type="task",
                title="仿真运行已完成",
                content=f"仿真 {simulation_id[:8]} 已运行完成，可查看运行报告。",
                target_url=f"/report?simulationId={simulation_id}",
            )
        )
    record_audit(
        db, user, "simulation.run_to_completion", "simulation", run.id, {"elapsed": elapsed}
    )
    db.commit()
    db.refresh(run)
    return run


@router.get(f"{PREFIX}/simulations/{{simulation_id}}/agents", tags=["simulations"])
def list_simulation_agents(
    simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run := db.get(SimulationRun, simulation_id))
    runtime = (run.config or {}).get("runtime_snapshot", {})
    return [
        {
            "id": r.get("id"),
            "name": r.get("name", f"AGV-{r.get('id', '?')[:6]}"),
            "status": r.get("status", "idle"),
            "battery": r.get("battery", 100),
            "position": {"x": r.get("x", 0), "y": r.get("y", 0)},
            "task_id": r.get("task_id"),
            "completed_tasks": r.get("completed_tasks", 0),
            "total_distance": r.get("total_distance", 0),
        }
        for r in runtime.get("robots", [])
    ]
