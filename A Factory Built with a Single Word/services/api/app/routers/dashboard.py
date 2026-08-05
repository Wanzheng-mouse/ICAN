"""Dashboard KPI endpoints (formerly in main.py).

Moved verbatim during the phase-2 router split (M4).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import User, get_current_user
from app.models import Project, ProjectMembership, Scenario, SimulationRun
from app.shared import PREFIX

router = APIRouter()


@router.get(f"{PREFIX}/dashboard/kpis", tags=["dashboard"])
def dashboard_kpis(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    # Show only the current user's own projects (consistent with list_projects
    # non-admin behaviour) — the homepage should reflect "my data", not every
    # record in the database.
    user_project_ids = [
        row[0]
        for row in db.query(ProjectMembership.project_id)
        .filter(ProjectMembership.user_id == user.id)
        .all()
    ]
    project_count = (
        db.query(Project)
        .filter(Project.id.in_(user_project_ids), Project.status != "archived")
        .count()
    )
    scenario_count = db.query(Scenario).filter(Scenario.project_id.in_(user_project_ids)).count()
    sim_count = (
        db.query(SimulationRun).filter(SimulationRun.project_id.in_(user_project_ids)).count()
    )
    active_sim_count = (
        db.query(SimulationRun)
        .filter(SimulationRun.project_id.in_(user_project_ids), SimulationRun.status == "running")
        .count()
    )
    avg_rate = 0.0
    avg_energy = 0.0
    completed_runs = (
        db.query(SimulationRun)
        .filter(SimulationRun.project_id.in_(user_project_ids), SimulationRun.status == "completed")
        .all()
    )
    for run in completed_runs:
        rate = (run.metrics or {}).get("completion_rate")
        if rate is not None:
            avg_rate += float(rate)
        energy = (run.metrics or {}).get("energy")
        if energy is not None:
            avg_energy += float(energy)
    if completed_runs:
        avg_rate /= len(completed_runs)
        avg_energy /= len(completed_runs)
    return {
        "projects": project_count,
        "scenarios": scenario_count,
        "simulations": sim_count,
        "active_simulations": active_sim_count,
        "average_completion_rate": round(float(avg_rate), 4),
        "average_energy": round(float(avg_energy), 2),
    }
