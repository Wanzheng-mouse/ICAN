"""Scenario endpoints (formerly in main.py)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import (
    add_scenario_version,
    get_current_user,
    latest_scenario_version,
    require_project_access,
    require_scenario_access,
    scenario_to_read,
)
from app.models import Project, Scenario, ScenarioRequestKey, ScenarioVersion, User
from app.schemas import (
    ScenarioAutoLayoutRead,
    ScenarioAutoLayoutRequest,
    ScenarioCreate,
    ScenarioData,
    ScenarioRead,
    ScenarioUpdate,
    ScenarioValidationRead,
    ScenarioValidationRequest,
    ScenarioVersionRead,
)
from app.shared import PREFIX, scenario_service

router = APIRouter()


@router.post(
    f"{PREFIX}/scenarios", response_model=ScenarioRead, status_code=201, tags=["scenarios"]
)
def create_scenario(
    payload: ScenarioCreate,
    user: User = Depends(get_current_user),
    request: Request = None,
    db: Session = Depends(get_db),
) -> ScenarioRead:
    require_project_access(payload.project_id, user, db, write=True)
    request_key: str | None = None
    if request:
        request_key = (request.headers.get("X-Idempotency-Key") or "").strip() or None
        if request_key:
            existing = (
                db.query(ScenarioRequestKey)
                .filter(
                    ScenarioRequestKey.request_key == request_key,
                    ScenarioRequestKey.user_id == user.id,
                )
                .first()
            )
            if existing:
                return scenario_to_read(db.get(Scenario, existing.scenario_id), db)
    scenario = Scenario(
        project_id=payload.project_id,
        name=payload.name,
        data=payload.data.model_dump() if isinstance(payload.data, ScenarioData) else payload.data,
    )
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    if request_key:
        db.add(
            ScenarioRequestKey(request_key=request_key, user_id=user.id, scenario_id=scenario.id)
        )
    project = db.get(Project, payload.project_id)
    if project is not None and project.status == "draft":
        project.status = "active"
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


@router.get(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead, tags=["scenarios"])
def get_scenario(
    scenario_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ScenarioRead:
    return scenario_to_read(require_scenario_access(scenario_id, user, db), db)


@router.put(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead, tags=["scenarios"])
def update_scenario(
    scenario_id: str,
    payload: ScenarioUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioRead:
    scenario = require_scenario_access(scenario_id, user, db, write=True)
    current_version = latest_scenario_version(db, scenario_id)
    if payload.expected_version is not None and payload.expected_version != current_version:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SCENARIO_VERSION_CONFLICT",
                "message": "场景已被其他会话更新，请重新加载后再保存",
                "current_version": current_version,
            },
        )
    validation = scenario_service.validate(payload.data)
    if not validation.valid:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "SCENARIO_VALIDATION_FAILED",
                "message": "场景校验失败",
                "issues": [issue.model_dump() for issue in validation.errors],
            },
        )
    if payload.name is not None:
        scenario.name = payload.name
    scenario.data = payload.data.model_dump()
    db.flush()
    # Use savepoint to atomically insert the version row.  If a concurrent
    # request committed version=N+1 between our read and write, the
    # UniqueConstraint on (scenario_id, version) fires and we re-raise
    # with the actual current version so the caller can retry.
    try:
        with db.begin_nested():
            add_scenario_version(db, scenario, current_version + 1)
            db.flush()
    except IntegrityError:
        db.rollback()
        actual_version = latest_scenario_version(db, scenario_id)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SCENARIO_VERSION_CONFLICT",
                "message": "保存时检测到版本冲突，请重新加载后再保存",
                "current_version": actual_version,
            },
        ) from None
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


@router.post(
    f"{PREFIX}/scenarios/{{scenario_id}}/validate",
    response_model=ScenarioValidationRead,
    tags=["scenarios"],
)
def validate_scenario(
    scenario_id: str,
    payload: ScenarioValidationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioValidationRead:
    require_scenario_access(scenario_id, user, db)
    return scenario_service.validate_raw(payload.data)[1]


@router.post(
    f"{PREFIX}/scenarios/{{scenario_id}}/auto-layout",
    response_model=ScenarioAutoLayoutRead,
    tags=["scenarios"],
)
def auto_layout_scenario(
    scenario_id: str,
    payload: ScenarioAutoLayoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioAutoLayoutRead:
    require_scenario_access(scenario_id, user, db, write=True)
    return scenario_service.auto_layout(payload.data)


@router.get(
    f"{PREFIX}/scenarios/{{scenario_id}}/versions",
    response_model=list[ScenarioVersionRead],
    tags=["scenarios"],
)
def list_scenario_versions(
    scenario_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ScenarioVersionRead]:
    require_scenario_access(scenario_id, user, db)
    versions = (
        db.query(ScenarioVersion)
        .filter(ScenarioVersion.scenario_id == scenario_id)
        .order_by(ScenarioVersion.version.asc())
        .all()
    )
    return [
        ScenarioVersionRead(
            id=v.id,
            scenario_id=v.scenario_id,
            version=v.version,
            name=v.name,
            data=v.data,
            created_at=str(v.created_at),
        )
        for v in versions
    ]
