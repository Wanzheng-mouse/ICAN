"""Resource-center endpoints (formerly in main.py).

Moved verbatim during the phase-2 router split (M4). All paths and behaviours
are preserved, including the `/api/v1/resource/templates` (POST) and
`/api/v1/resource/templates` (GET) pair which share a path but differ by method.
"""

from __future__ import annotations

import re
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import User, get_current_user, require_project_access
from app.models import LearningResource, ResourceCase, Template, TemplateEvent
from app.schemas import (
    TemplateCreate,
    TemplateEventCreate,
    TemplateRead,
    TemplateRecommendationRead,
)
from app.shared import PREFIX, _utcnow

router = APIRouter()


def _match_score(tpl: Template, requirement: str) -> float:
    """Rank a scene template against a project's free-text requirement.

    Scoring is deliberately transparent: industry keywords dominate, numeric
    capacity fit (daily orders / AGV count) adds a strong bonus when the
    requirement states them, compliance keywords bump regulated-industry
    templates, and quality_score acts as the final tie-breaker.
    """
    score = 0.0
    profile = tpl.profile or {}
    industries = [str(item).lower() for item in profile.get("industries", [])] + [
        str(tpl.industry or "").lower()
    ]
    industry_text = " ".join(industries)
    if not requirement:
        return float(tpl.quality_score or 60) * 0.2

    # Industry keyword match.
    if any(kw in requirement for kw in ("医药", "药品", "药房", "gsp", "gdp", "合规追溯")) and (
        "医" in industry_text or "gsp" in industry_text or "药" in industry_text
    ):
        score += 60.0
    if "冷链" in requirement and "冷链" in industry_text:
        score += 60.0
    if ("3c" in requirement or "电子" in requirement) and (
        "3c" in industry_text or "电子" in industry_text
    ):
        score += 60.0
    if any(kw in requirement for kw in ("电商", "快递", "包裹", "3pl")) and (
        "电商" in industry_text or "3pl" in industry_text
    ):
        score += 60.0
    if any(kw in requirement for kw in ("制造", "托盘", "高位")) and (
        "制造" in industry_text or "托盘" in industry_text
    ):
        score += 60.0

    # Daily-order capacity fit.
    orders = re.search(r"日均\s*(\d+)", requirement)
    if orders:
        daily = float(orders.group(1))
        low = profile.get("min_orders")
        high = profile.get("max_orders")
        if low is not None and high is not None:
            if low <= daily <= high:
                score += 30.0
            elif daily <= high * 1.2:
                score += 10.0

    # AGV fleet fit.
    agvs = re.search(r"(\d+)\s*(?:台|辆)?\s*(?:agv|机器人|amr)", requirement)
    if agvs:
        count = float(agvs.group(1))
        low = profile.get("min_agvs")
        high = profile.get("max_agvs")
        if low is not None and high is not None and low <= count <= high:
            score += 20.0

    # Compliance / traceability keywords favour regulated-industry templates.
    if any(kw in requirement for kw in ("合规", "追溯", "批号")) and (
        "医" in industry_text or "gsp" in industry_text
    ):
        score += 15.0

    score += float(tpl.quality_score or 60) * 0.2
    return score


@router.post(
    f"{PREFIX}/resource/templates", response_model=TemplateRead, status_code=201, tags=["resource"]
)
def create_user_template(
    payload: TemplateCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> TemplateRead:
    tpl = Template(
        id=f"usr-{uuid4().hex[:12]}",
        category=payload.category or "scene",
        title=payload.title,
        description=payload.description or "",
        cover=payload.cover,
        industry=payload.industry,
        difficulty=payload.difficulty,
        scenario=payload.scenario.model_dump() if payload.scenario is not None else {},
        updated_at=str(_utcnow().date()),
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return TemplateRead(
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
    )


@router.get(f"{PREFIX}/resource/hot-resources", tags=["resource"])
def list_hot_resources(db: Session = Depends(get_db)) -> list[dict]:
    items = (
        db.query(Template)
        .filter(Template.published.is_(True))
        .order_by(Template.downloads.desc())
        .limit(10)
        .all()
    )
    return [
        {"rank": i + 1, "name": t.title, "downloads": t.downloads, "views": t.views}
        for i, t in enumerate(items)
    ]


@router.get(f"{PREFIX}/resource/featured-cases", tags=["resource"])
def list_featured_cases(db: Session = Depends(get_db)) -> list[dict]:
    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "cover": c.cover,
            "industry": c.industry,
            **c.metrics,
        }
        for c in db.query(ResourceCase).filter(ResourceCase.published.is_(True)).all()
    ]


@router.get(f"{PREFIX}/resource/learning-path", tags=["resource"])
def list_learning_path(db: Session = Depends(get_db)) -> list[dict]:
    return [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "progress": r.progress,
            "sort_order": r.sort_order,
        }
        for r in db.query(LearningResource)
        .filter(LearningResource.published.is_(True))
        .order_by(LearningResource.sort_order)
        .all()
    ]


@router.get(f"{PREFIX}/resource/categories", tags=["resource"])
def list_categories(db: Session = Depends(get_db)) -> list[dict]:
    counts = (
        db.query(Template.category, func.count(Template.id))
        .filter(Template.published.is_(True))
        .group_by(Template.category)
        .all()
    )
    items = [{"key": "all", "label": "全部", "count": sum(c for _, c in counts)}]
    items += [
        {
            "key": cat,
            "label": {
                "scene": "场景模板",
                "strategy": "策略模板",
                "report": "报告模板",
                "device": "设备配置",
                "case": "案例",
                "doc": "文档",
            }.get(cat, cat),
            "count": cnt,
        }
        for cat, cnt in counts
    ]
    return items


@router.get(f"{PREFIX}/resource/templates", response_model=list[TemplateRead], tags=["resource"])
def list_resource_templates(db: Session = Depends(get_db)) -> list[Template]:
    return list(db.query(Template).filter(Template.published.is_(True)).all())


@router.get(
    f"{PREFIX}/resource/recommendations",
    response_model=list[TemplateRecommendationRead],
    tags=["resource"],
)
def recommend_templates(
    project_id: str | None = None,
    scenario_id: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TemplateRecommendationRead]:
    requirement = ""
    if project_id:
        project = require_project_access(project_id, user, db)
        requirement = (project.requirement or "").lower()
    templates = (
        db.query(Template).filter(Template.published.is_(True), Template.category == "scene").all()
    )
    ranked = sorted(
        ((_match_score(t, requirement), t) for t in templates),
        key=lambda item: item[0],
        reverse=True,
    )
    return [
        TemplateRecommendationRead(
            id=t.id,
            category=t.category,
            title=t.title,
            description=t.description,
            cover=t.cover,
            industry=t.industry,
            difficulty=t.difficulty,
            downloads=t.downloads,
            views=t.views,
            updated_at=t.updated_at,
            profile=t.profile,
            quality_score=t.quality_score,
            match_score=min(100, int(score)),
            reasons=["基于项目需求匹配推荐", f"匹配度 {min(100, int(score))}%"],
            cautions=[],
        )
        for score, t in ranked[:6]
    ]


@router.post(f"{PREFIX}/resource/templates/{{template_id}}/events", tags=["resource"])
def record_template_event(
    template_id: str,
    payload: TemplateEventCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    db.add(TemplateEvent(template_id=template_id, user_id=user.id, event_type=payload.event_type))
    db.commit()
    return {"status": "ok"}
