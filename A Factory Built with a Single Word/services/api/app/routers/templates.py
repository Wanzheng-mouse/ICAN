"""Template endpoints (formerly in main.py)."""

from __future__ import annotations

from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import (
    add_scenario_version,
    get_current_user,
    get_or_404,
    scenario_to_read,
)
from app.models import Scenario, Template, User
from app.schemas import (
    ScenarioData,
    ScenarioRead,
    TemplateApplyCreate,
    TemplateDetailRead,
    TemplateRead,
)
from app.shared import PREFIX

router = APIRouter()


@router.get("/api/templates", response_model=list[TemplateRead], tags=["templates"])
@router.get(f"{PREFIX}/templates", response_model=list[TemplateRead], tags=["templates"])
def list_templates(category: str | None = None, db: Session = Depends(get_db)) -> list[Template]:
    query = db.query(Template).filter(Template.published.is_(True))
    if category:
        query = query.filter(Template.category == category)
    return list(query.all())


@router.get("/api/templates/{template_id}", response_model=TemplateDetailRead, tags=["templates"])
@router.get(
    f"{PREFIX}/templates/{{template_id}}", response_model=TemplateDetailRead, tags=["templates"]
)
def get_template(template_id: str, db: Session = Depends(get_db)) -> TemplateDetailRead:
    tpl = get_or_404(Template, template_id, db, "Template")
    return TemplateDetailRead(
        id=tpl.id,
        category=tpl.category,
        title=tpl.title,
        description=tpl.description,
        cover=tpl.cover,
        industry=tpl.industry,
        difficulty=tpl.difficulty,
        downloads=tpl.downloads,
        views=tpl.views,
        updated_at=tpl.updated_at,
        profile=tpl.profile,
        quality_score=tpl.quality_score,
        data=ScenarioData.model_validate(tpl.scenario),
    )


@router.post(
    "/api/templates/{template_id}/apply",
    response_model=ScenarioRead,
    status_code=201,
    tags=["templates"],
)
@router.post(
    f"{PREFIX}/templates/{{template_id}}/apply",
    response_model=ScenarioRead,
    status_code=201,
    tags=["templates"],
)
def apply_template(
    template_id: str,
    payload: TemplateApplyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioRead:
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="应用模板时必须提供场景名称")
    tpl = get_or_404(Template, template_id, db, "Template")
    scenario = Scenario(
        project_id=payload.project_id, name=payload.name.strip(), data=deepcopy(tpl.scenario)
    )
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)
