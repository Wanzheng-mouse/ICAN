"""Generation / AI-analysis endpoints (formerly in main.py).

Moved verbatim during the phase-2 router split (M4). The two profile/scene
helpers live in ``app.shared`` so this module stays free of an import cycle.
"""

from __future__ import annotations

import concurrent.futures
from copy import deepcopy
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.domain import (
    User,
    add_scenario_version,
    get_current_user,
    get_or_404,
    scenario_to_read,
)
from app.models import GenerationJob, Scenario, Template
from app.schemas import (
    GenerationCandidateApplyCreate,
    GenerationCandidatesRead,
    RequirementAnalysisRead,
    RequirementAnalyzeCreate,
    ScenarioRead,
)
from app.shared import PREFIX, _requirement_profile, _smart_candidate_scene, logger

router = APIRouter()


@router.post(
    f"{PREFIX}/generation/analyze", response_model=RequirementAnalysisRead, tags=["generation"]
)
def analyze_requirement(
    payload: RequirementAnalyzeCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RequirementAnalysisRead:
    requirement = payload.requirement.strip()
    sources = [s.model_dump() for s in (payload.sources or [])]
    job = GenerationJob(
        user_id=user.id, requirement=requirement, source_files=sources, status="analyzing"
    )
    db.add(job)
    db.flush()
    profile = _requirement_profile(requirement, sources)
    analysis_result: dict[str, Any] = {}
    if settings.agnes_api_key:
        # The frontend already enforces a 5-minute timeout.  We cap the LLM
        # call server-side so a hung upstream cannot pin the worker thread.
        try:
            # Imported lazily through app.main (which re-exports it) so tests
            # can monkeypatch ``app.main.analyze_with_agnes`` without creating
            # an import cycle.
            from app.main import analyze_with_agnes

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(analyze_with_agnes, requirement, sources, settings)
                analysis_result = future.result(timeout=240)
        except concurrent.futures.TimeoutError:
            job.status = "failed"
            job.analysis = {
                "profile": profile,
                "error": "AI 分析超时，请使用异步接口 /generation/analyze-async",
            }
            db.commit()
            raise HTTPException(
                status_code=504, detail="AI 分析超时，请使用异步接口 /generation/analyze-async"
            ) from None
        except Exception:  # noqa: BLE001 - a failed LLM call must not break analysis
            logger.exception("LLM analysis failed for job %s", job.id)
    job.analysis = {
        "profile": profile,
        "assumptions": [],
        "questions": [],
        "risks": [],
        "confidence": 85,
        "candidate_guidance": [],
        **analysis_result,
    }
    job.status = "analyzed"
    db.commit()
    db.refresh(job)
    return RequirementAnalysisRead(
        job_id=job.id,
        status=job.status,
        summary=job.analysis.get("summary", "需求已分析"),
        profile=job.analysis.get("profile", profile),
        assumptions=job.analysis.get("assumptions", []),
        questions=job.analysis.get("questions", []),
        risks=job.analysis.get("risks", []),
        confidence=job.analysis.get("confidence", 85),
        operational_design=job.analysis.get("operational_design", {}),
        candidate_guidance=job.analysis.get("candidate_guidance", []),
    )


@router.post(
    f"{PREFIX}/generation/{{job_id}}/candidates",
    response_model=GenerationCandidatesRead,
    tags=["generation"],
)
def generate_candidates(
    job_id: str,
    payload: dict[str, Any] | None = Body(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    job = get_or_404(GenerationJob, job_id, db, "Generation job")
    if job.user_id != user.id:
        raise HTTPException(status_code=404, detail="需求分析任务不存在")
    profile = (payload and payload.get("profile")) or (job.analysis or {}).get("profile", {})
    templates = (
        db.query(Template).filter(Template.category == "scene", Template.published.is_(True)).all()
    )
    modes = [
        (
            "balanced",
            "均衡方案",
            "在吞吐、能耗和部署成本之间保持平衡。",
            {"throughput": 0.78, "wait_seconds": 42.0, "energy": 0.64},
        ),
        (
            "throughput",
            "高吞吐方案",
            "增加并发与拣选资源，优先保障高峰时效。",
            {"throughput": 0.91, "wait_seconds": 28.0, "energy": 0.82},
        ),
        (
            "energy_saver",
            "低能耗方案",
            "以充电窗口和设备利用率为约束，降低运行能耗。",
            {"throughput": 0.70, "wait_seconds": 51.0, "energy": 0.45},
        ),
    ]
    guidance = {
        item.get("strategy"): item
        for item in (job.analysis or {}).get("candidate_guidance", [])
        if isinstance(item, dict)
    }
    candidates = []
    for index, (strategy, title, description, metrics) in enumerate(modes):
        if not templates:
            break
        llm_guidance = guidance.get(strategy, {})
        title = str(llm_guidance.get("title") or title)
        description = str(llm_guidance.get("description") or description)
        template = templates[min(index, len(templates) - 1)]
        candidate_data = deepcopy(template.scenario)
        total_agv = (
            (profile.get("tote_agv_count") or 0)
            + (profile.get("pallet_agv_count") or 0)
            + (profile.get("agv_count") or 0)
        )
        if bool(profile.get("warehouse_area_m2") or profile.get("daily_orders")) and bool(
            total_agv
        ):
            candidate_data = _smart_candidate_scene(
                profile, strategy, llm_guidance.get("deployment")
            )
        deployment_summary = f"按{strategy}策略部署 {total_agv or 8} 台 AGV"
        fit_explanation = f"匹配度：{(profile.get('daily_orders') or 3000)} 单/日"
        candidates.append(
            {
                "id": f"{job.id[:8]}-{strategy}",
                "title": title,
                "strategy": strategy,
                "description": description,
                "template_id": template.id,
                "suitability": 75 + index * 8,
                "reasons": [*llm_guidance.get("reasons", []), deployment_summary, fit_explanation],
                "cautions": llm_guidance.get("cautions", []),
                "expected_metrics": {
                    "throughput": round(metrics["throughput"] * 100),
                    "wait_seconds": metrics["wait_seconds"],
                    "energy": round(metrics["energy"] * 100),
                },
                "data": candidate_data,
            }
        )
    return {"job_id": job_id, "status": "ready", "candidates": candidates}


@router.post(
    f"{PREFIX}/generation/candidates/{{candidate_id}}/apply",
    response_model=ScenarioRead,
    status_code=201,
    tags=["generation"],
)
def apply_generation_candidate(
    candidate_id: str,
    payload: GenerationCandidateApplyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioRead:
    # candidate_id has the shape "{job_id[:8]}-{strategy}".  Resolve the
    # originating job by that prefix instead of blindly picking the user's
    # most recent job, which could apply a candidate to the wrong requirement.
    job_prefix = candidate_id.split("-")[0] if "-" in candidate_id else candidate_id[:8]
    job = (
        db.query(GenerationJob)
        .filter(GenerationJob.user_id == user.id, GenerationJob.id.startswith(job_prefix))
        .order_by(GenerationJob.created_at.desc())
        .first()
    )
    if not job:
        # Fallback: search every job and look for a candidate whose id matches.
        for candidate_job in (
            db.query(GenerationJob)
            .filter(GenerationJob.user_id == user.id)
            .order_by(GenerationJob.created_at.desc())
            .all()
        ):
            if any(
                isinstance(c, dict) and c.get("id") == candidate_id
                for c in (candidate_job.candidates or [])
            ):
                job = candidate_job
                break
    if not job:
        raise HTTPException(status_code=404, detail="未找到与该候选方案关联的需求分析任务")
    # Idempotency: if this candidate was already applied, return the existing
    # scenario instead of creating a duplicate under concurrent retries.
    if job.selected_candidate_id == candidate_id and job.scenario_id:
        existing_scenario = db.get(Scenario, job.scenario_id)
        if existing_scenario:
            return scenario_to_read(existing_scenario, db)
    candidate = next(
        (c for c in (job.candidates or []) if isinstance(c, dict) and c.get("id") == candidate_id),
        None,
    )
    data = (candidate or {}).get(
        "data",
        {
            "components": [],
            "canvas": {"width": 1200, "height": 800, "scale": 1},
            "schema_version": "1.0",
        },
    )
    scenario = Scenario(
        project_id=payload.project_id,
        name=payload.name or f"{candidate.get('title', '方案') if candidate else '方案'}场景",
        data=data,
    )
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    job.selected_candidate_id = candidate_id
    job.scenario_id = scenario.id
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)
