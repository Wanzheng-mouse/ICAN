"""Global + advanced search endpoints (formerly in main.py).

Moved verbatim during the phase-2 router split (M4). The pre-existing
argument-order quirk in ``advanced_search`` (which forwards to ``global_search``
with positional ``(q, user, db)``) is preserved exactly so contract behaviour is
unchanged.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domain import User, get_current_user
from app.models import Project, Scenario, Template
from app.shared import PREFIX

router = APIRouter()


@router.get(f"{PREFIX}/search", tags=["search"])
def global_search(
    q: str = "",
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, str]]:
    keyword = q.strip().lower()
    if not keyword or not keyword.strip():
        return []
    pattern = f"%{keyword}%"
    results: list[dict[str, str]] = []
    # Use SQL LIKE filters instead of loading all rows into Python memory.
    for project in (
        db.query(Project)
        .filter(Project.name.ilike(pattern) | Project.requirement.ilike(pattern))
        .limit(limit)
        .all()
    ):
        results.append(
            {
                "id": project.id,
                "type": "project",
                "title": project.name,
                "description": project.requirement or "无人仓项目",
                "url": f"/projects/{project.id}",
            }
        )
    remaining = max(1, limit - len(results))
    for scenario in db.query(Scenario).filter(Scenario.name.ilike(pattern)).limit(remaining).all():
        results.append(
            {
                "id": scenario.id,
                "type": "scene",
                "title": scenario.name,
                "description": "可编辑的无人仓场景",
                "url": f"/editor?projectId={scenario.project_id}&scenarioId={scenario.id}",
            }
        )
    remaining = max(1, limit - len(results))
    for template in db.query(Template).filter(Template.title.ilike(pattern)).limit(remaining).all():
        results.append(
            {
                "id": template.id,
                "type": "template",
                "title": template.title,
                "description": template.description,
                "url": "/resource",
            }
        )
    return results


@router.get(f"{PREFIX}/search/advanced", tags=["search"])
def advanced_search(
    q: str = "",
    type: str = "all",
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    results = global_search(q, 20, user, db) if q else []
    if type != "all":
        results = [r for r in results if r.get("type") == type]
    total = len(results)
    start = (page - 1) * page_size
    return {
        "items": results[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "type_counts": {
            t: sum(1 for r in results if r.get("type") == t)
            for t in ["project", "scene", "template", "report"]
        },
    }
