"""Evolution endpoints (formerly in main.py)."""

from __future__ import annotations

from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, new_id
from app.domain import (
    add_scenario_version,
    get_current_user,
    get_or_404,
    record_audit,
    require_project_access,
    require_simulation_access,
    scenario_to_read,
)
from app.models import Evolution, Notification, Scenario, SimulationRun, User
from app.schemas import (
    EvolutionApplyRead,
    EvolutionCreate,
    EvolutionRead,
    ScenarioRead,
)
from app.services.simulation import evolution_service
from app.shared import PREFIX

router = APIRouter()


@router.post(
    f"{PREFIX}/evolutions", response_model=EvolutionRead, status_code=201, tags=["evolutions"]
)
def create_evolution(
    payload: EvolutionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> EvolutionRead:
    run = require_simulation_access(payload.simulation_id, user, db)
    evolution = evolution_service.create(run)
    db.add(evolution)
    db.flush()  # materialize evolution.id before recording it in the audit log
    record_audit(
        db,
        user,
        "evolution.create",
        "evolution",
        evolution.id,
        {"simulation_id": payload.simulation_id},
    )
    db.commit()
    db.refresh(evolution)
    return EvolutionRead(
        id=evolution.id,
        simulation_id=evolution.simulation_id,
        diagnosis=evolution.diagnosis,
        baseline_metrics=evolution.baseline_metrics,
        optimized_metrics=evolution.optimized_metrics,
        applied_scenario_id=evolution.applied_scenario_id,
        created_at=str(evolution.created_at),
    )


@router.get(
    f"{PREFIX}/evolutions/{{evolution_id}}", response_model=EvolutionRead, tags=["evolutions"]
)
def get_evolution(
    evolution_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> EvolutionRead:
    evolution = get_or_404(Evolution, evolution_id, db, "Evolution")
    require_simulation_access(evolution.simulation_id, user, db)
    return EvolutionRead(
        id=evolution.id,
        simulation_id=evolution.simulation_id,
        diagnosis=evolution.diagnosis,
        baseline_metrics=evolution.baseline_metrics,
        optimized_metrics=evolution.optimized_metrics,
        applied_scenario_id=evolution.applied_scenario_id,
        created_at=str(evolution.created_at),
    )


@router.post(
    f"{PREFIX}/evolutions/{{evolution_id}}/apply",
    response_model=EvolutionApplyRead,
    tags=["evolutions"],
)
def apply_evolution(
    evolution_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> EvolutionApplyRead:
    evolution = get_or_404(Evolution, evolution_id, db, "Evolution")
    run = db.get(SimulationRun, evolution.simulation_id)
    if run is None:
        raise HTTPException(status_code=404, detail="关联的仿真运行不存在")
    project_id = run.project_id
    require_project_access(project_id, user, db, write=True)
    changes = [
        f"{d.get('target', 'layout')}: {d.get('suggestion', '进化优化调整')}"
        for d in evolution.diagnosis
    ]
    if evolution.applied_scenario_id:
        existing = db.get(Scenario, evolution.applied_scenario_id)
        if existing:
            return EvolutionApplyRead(
                evolution_id=evolution_id,
                project_id=project_id,
                scenario=scenario_to_read(existing, db),
                changes=changes,
            )
    scenario = Scenario(
        project_id=project_id,
        name=f"{run.id[:8]}进化方案",
        data={
            "components": [],
            "canvas": {"width": 1200, "height": 800, "scale": 1},
            "schema_version": "1.0",
        },
    )
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    evolution.applied_scenario_id = scenario.id
    db.add(
        Notification(
            id=new_id(),
            user_id=user.id,
            type="task",
            title="进化方案已生成新场景",
            content=f"进化方案 {evolution_id[:8]} 已落地为新场景，可进入编辑器查看。",
            target_url=f"/editor?projectId={project_id}&scenarioId={scenario.id}",
        )
    )
    record_audit(
        db, user, "evolution.apply", "evolution", evolution_id, {"scenario_id": scenario.id}
    )
    db.commit()
    db.refresh(scenario)
    return EvolutionApplyRead(
        evolution_id=evolution_id,
        project_id=project_id,
        scenario=scenario_to_read(scenario, db),
        changes=changes,
    )


@router.get(f"{PREFIX}/evolutions/{{evolution_id}}/versions", tags=["evolutions"])
def list_evolution_scenarios(
    evolution_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ScenarioRead]:
    evolution = get_or_404(Evolution, evolution_id, db, "Evolution")
    require_simulation_access(evolution.simulation_id, user, db)
    run = db.get(SimulationRun, evolution.simulation_id)
    base_data = (run.config or {}).get("scenario_snapshot") or {
        "components": [],
        "canvas": {"width": 1200, "height": 800, "scale": 1},
        "schema_version": "1.0",
    }
    trial_items: list[dict] = []
    for item in evolution.diagnosis or []:
        if isinstance(item, dict) and item.get("type") == "trials":
            trial_items = [t for t in item.get("items", []) if isinstance(t, dict)]
            break
    top = sorted(trial_items, key=lambda t: t.get("score", 0), reverse=True)[:3]
    project_id = run.project_id if run else (evolution.simulation_id or "unknown")
    created = str(evolution.created_at)
    versions: list[ScenarioRead] = []
    for index, _trial in enumerate(top, start=1):
        versions.append(
            ScenarioRead(
                id=f"{evolution_id}-v{index}",
                project_id=project_id,
                name=f"进化方案 v{index}",
                data=deepcopy(base_data),
                version=index,
                updated_at=created,
            )
        )
    return versions
