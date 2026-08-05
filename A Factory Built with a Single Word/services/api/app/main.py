"""ICAN Unmanned Warehouse API — application assembly.

Phase-2 refactor (M4/M5, 2026-07-26): every HTTP and WebSocket route handler
was extracted into ``app/routers/*`` (and ``app/ws/*`` for the websocket
transport + connection manager). This module now owns only application wiring —
FastAPI app creation, CORS/rate-limit middleware, exception handlers, the
lifespan seed routine, and router registration. Request/response behaviour is
byte-for-byte preserved versus the pre-split ``main.py``.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import timedelta
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import configure_logging
from app.database import SessionLocal, new_id
from app.domain import seed_users
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.migrations import upgrade_database
from app.models import (
    AuthToken,
    LearningResource,
    Notification,
    PasswordResetToken,
    ProjectMembership,
    ResourceCase,
    Template,
    User,
)

# Routers — each module owns one domain's handlers.
from app.routers import (
    audit,
    auth,
    dashboard,
    evolutions,
    generation,
    health,
    notifications,
    orchestration,
    projects,
    reports,
    resource,
    scenarios,
    search,
    simulations,
    templates,
    ws,
)
from app.services.llm_analysis import (
    analyze_with_agnes,  # noqa: F401  (re-export: test seam / extension point)
)
from app.services.runtime_scheduler import runtime_scheduler
from app.shared import _create_scenario_data, _utcnow

configure_logging(settings)


# ---- Error envelope --------------------------------------------------------


def _error_envelope(
    status_code: int, code: str, detail: Any, request_id: str | None = None
) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "detail": detail}
    if request_id:
        body["request_id"] = request_id
    return JSONResponse(status_code=status_code, content=body)


# ---- Lifespan -------------------------------------------------------------


@asynccontextmanager
async def lifespan(_: FastAPI):
    upgrade_database()
    with SessionLocal() as db:
        seed_templates(db)
        seed_resources(db)
        seed_users(db)
        seed_notifications(db)
        seed_project_memberships(db)
        seed_scenario_versions(db)
        db.query(AuthToken).filter(AuthToken.expires_at < _utcnow()).delete()
        db.query(PasswordResetToken).filter(
            PasswordResetToken.created_at < _utcnow() - timedelta(hours=1)
        ).delete()
        db.commit()
    await runtime_scheduler.start()
    try:
        yield
    finally:
        await runtime_scheduler.stop()


app = FastAPI(
    title="ICAN Unmanned Warehouse API",
    version="0.6.0",
    description="ICAN 无人仓仿真决策平台 API：覆盖认证、项目、场景、仿真、进化、报告与审计闭环。",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, default_limit=600, auth_limit=30)
# Outermost middleware: every response (including 429 / 4xx / 5xx produced by
# inner middleware and exception handlers) carries a correlatable X-Request-ID.
app.add_middleware(RequestContextMiddleware)


# ---- Exception handlers ---------------------------------------------------


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = (
        getattr(request.state, "request_id", None)
        or request.headers.get("X-Request-ID")
        or str(uuid4())
    )
    errors = jsonable_encoder(exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "code": "UNPROCESSABLE_ENTITY",
            "detail": errors,
            "errors": errors,
            "request_id": request_id,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = (
        getattr(request.state, "request_id", None)
        or request.headers.get("X-Request-ID")
        or str(uuid4())
    )
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.detail.get("code", "ERROR"),
                "detail": exc.detail,
                "request_id": request_id,
            },
        )
    return _error_envelope(
        exc.status_code,
        {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
        }.get(exc.status_code, "ERROR"),
        exc.detail,
        request_id,
    )


# ---- Seed data helpers ----------------------------------------------------


def seed_templates(db: Session) -> None:
    if db.query(Template).count() > 0:
        return
    templates = [
        Template(
            id="tpl-1",
            category="scene",
            title="电商中型仓模板",
            description="中型 3PL 电商履约仓，日处理 3000–8000 单。",
            cover="ecom",
            industry="电商",
            difficulty="easy",
            downloads=1280,
            views=4200,
            updated_at="2024-05-20",
            scenario=deepcopy(_create_scenario_data(180, 400)),
            profile={
                "industries": ["电商", "3PL"],
                "min_area": 1500,
                "max_area": 5000,
                "min_orders": 3000,
                "max_orders": 8000,
                "min_agvs": 8,
                "max_agvs": 16,
                "min_staff": 5,
                "max_staff": 12,
            },
            quality_score=85,
            published=True,
        ),
        Template(
            id="tpl-2",
            category="scene",
            title="冷链小型仓",
            description="小型冷链仓，日处理 500–2000 单，温区隔离。",
            cover="coldchain",
            industry="冷链",
            difficulty="medium",
            downloads=760,
            views=2300,
            updated_at="2024-04-18",
            scenario=deepcopy(_create_scenario_data(120, 280)),
            profile={
                "industries": ["冷链", "食品"],
                "min_area": 800,
                "max_area": 2500,
                "min_orders": 500,
                "max_orders": 2000,
                "min_agvs": 4,
                "max_agvs": 10,
                "min_staff": 3,
                "max_staff": 8,
            },
            quality_score=78,
            published=True,
        ),
        Template(
            id="tpl-3",
            category="scene",
            title="3C 电子制造仓",
            description="高频率、小批量、多 SKU 的 3C 电子制造仓。",
            cover="3c",
            industry="3C 电子",
            difficulty="hard",
            downloads=540,
            views=1900,
            updated_at="2024-03-10",
            scenario=deepcopy(_create_scenario_data(200, 500)),
            profile={
                "industries": ["3C", "电子", "制造"],
                "min_area": 2000,
                "max_area": 8000,
                "min_orders": 5000,
                "max_orders": 15000,
                "min_agvs": 12,
                "max_agvs": 30,
                "min_staff": 8,
                "max_staff": 20,
            },
            quality_score=88,
            published=True,
        ),
        Template(
            id="tpl-4",
            category="scene",
            title="医药合规仓",
            description="GSP 医药仓，满足批号管理和温湿度合规要求。",
            cover="medical",
            industry="医药",
            difficulty="hard",
            downloads=890,
            views=3100,
            updated_at="2024-05-15",
            scenario=deepcopy(_create_scenario_data(160, 380)),
            profile={
                "industries": ["医药", "医疗"],
                "min_area": 1200,
                "max_area": 4000,
                "min_orders": 1000,
                "max_orders": 5000,
                "min_agvs": 6,
                "max_agvs": 14,
                "min_staff": 4,
                "max_staff": 10,
            },
            quality_score=82,
            published=True,
        ),
        Template(
            id="tpl-5",
            category="scene",
            title="电商大型仓",
            description="大型电商自动化仓，超 10000 平方米。",
            cover="ecom",
            industry="电商",
            difficulty="hard",
            downloads=2300,
            views=8900,
            updated_at="2024-05-22",
            scenario=deepcopy(_create_scenario_data(300, 700)),
            profile={
                "industries": ["电商", "3PL"],
                "min_area": 8000,
                "max_area": 20000,
                "min_orders": 15000,
                "max_orders": 50000,
                "min_agvs": 20,
                "max_agvs": 50,
                "min_staff": 15,
                "max_staff": 30,
            },
            quality_score=92,
            published=True,
        ),
        Template(
            id="tpl-6",
            category="scene",
            title="医药合规仓标杆",
            description="GSP 医药仓标杆方案，含双深位货架、冷库隔间。",
            cover="medical",
            industry="医药",
            difficulty="expert",
            downloads=450,
            views=1500,
            updated_at="2024-05-28",
            scenario=deepcopy(_create_scenario_data(220, 520)),
            profile={
                "industries": ["医药"],
                "min_area": 3000,
                "max_area": 10000,
                "min_orders": 3000,
                "max_orders": 10000,
                "min_agvs": 10,
                "max_agvs": 20,
                "min_staff": 6,
                "max_staff": 15,
            },
            quality_score=95,
            published=True,
        ),
        Template(
            id="tpl-7",
            category="strategy",
            title="绕行策略模板",
            description="遇到障碍物时主动绕行而非等待。",
            cover="strategy",
            industry="通用",
            difficulty="easy",
            downloads=320,
            views=980,
            updated_at="2024-03-05",
            scenario={},
            profile={},
            quality_score=70,
            published=True,
        ),
        Template(
            id="tpl-mock-0",
            category="scene",
            title="演示轻量仓",
            description="用于开发/演示的最小场景。",
            cover="warehouse",
            industry="通用",
            difficulty="easy",
            downloads=9999,
            views=9999,
            updated_at="2024-01-01",
            scenario=deepcopy(_create_scenario_data(80, 160)),
            profile={
                "industries": ["通用"],
                "min_area": 500,
                "max_area": 2000,
                "min_orders": 100,
                "max_orders": 500,
                "min_agvs": 2,
                "max_agvs": 6,
                "min_staff": 1,
                "max_staff": 3,
            },
            quality_score=50,
            published=True,
        ),
    ]
    for item in templates:
        db.add(item)
    db.commit()


def seed_resources(db: Session) -> None:
    if db.query(ResourceCase).count() > 0:
        return
    cases = [
        ResourceCase(
            id="case-1",
            title="某头部电商 618 大促峰值弹性扩容",
            description="通过多策略仿真在 72 小时内完成 3 倍产能评估与扩容方案输出，节省 30% 临时设备租赁成本。",
            cover="ecom",
            industry="电商",
            metrics={"efficiency": "+35%", "roi": "8 个月", "manpower": "-40%"},
            published=True,
        ),
        ResourceCase(
            id="case-2",
            title="华东冷链中心布局与调度优化",
            description="针对多温区冷链仓，通过 AGV 路径优化与动态调度策略，搬运效率提升 28%，能耗降低 15%。",
            cover="coldchain",
            industry="冷链",
            metrics={"efficiency": "+28%", "energy": "-15%", "complaint": "-60%"},
            published=True,
        ),
        ResourceCase(
            id="case-3",
            title="3C 电子制造仓料箱拣选升级",
            description="从人工+输送线升级为料箱到人方案，单站处理能力从 80 件/h 提升至 220 件/h。",
            cover="3c",
            industry="3C 电子",
            metrics={"efficiency": "+175%", "roi": "14 个月", "manpower": "-55%"},
            published=True,
        ),
    ]
    for item in cases:
        db.add(item)
    learn = [
        LearningResource(
            id="learn-1",
            title="无人仓规划入门",
            description="了解无人仓的基本构成、主流设备与规划流程。",
            progress=0,
            sort_order=1,
            published=True,
        ),
        LearningResource(
            id="learn-2",
            title="AGV 选型与部署",
            description="学习不同 AGV 类型的特点、适用场景和部署要点。",
            progress=0,
            sort_order=2,
            published=True,
        ),
        LearningResource(
            id="learn-3",
            title="仿真模型构建",
            description="掌握仿真建模方法论，从布局设计到参数配置。",
            progress=0,
            sort_order=3,
            published=True,
        ),
    ]
    for item in learn:
        db.add(item)
    db.commit()


def seed_notifications(db: Session) -> None:
    if db.query(Notification).count() > 0:
        return
    admin = db.query(User).filter(User.login_name == "admin").first()
    if not admin:
        return
    notes = [
        Notification(
            id=new_id(),
            user_id=admin.id,
            type="info",
            title="欢迎使用 ICAN 一言造厂",
            content="这是你的第一个通知，未来仿真完成和进化方案生成时会收到通知。",
            read=False,
            target_url="/",
        ),
        Notification(
            id=new_id(),
            user_id=admin.id,
            type="alert",
            title="拥堵告警：Aisle 08",
            content="Aisle 08 拥堵等级升至高，建议启动分流策略。",
            read=False,
            target_url="/simulation",
        ),
    ]
    for item in notes:
        db.add(item)
    db.commit()


def seed_project_memberships(db: Session) -> None:
    if db.query(ProjectMembership).count() > 0:
        return
    admin = db.query(User).filter(User.login_name == "admin").first()
    if not admin:
        return
    memberships = [
        ProjectMembership(id=new_id(), project_id="proj-demo", user_id=admin.id, role="owner"),
    ]
    try:
        for item in memberships:
            db.add(item)
        db.commit()
    except IntegrityError:
        db.rollback()


def seed_scenario_versions(db: Session) -> None:
    pass


# ---- Router registration --------------------------------------------------

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(projects.router)
app.include_router(scenarios.router)
app.include_router(simulations.router)
app.include_router(reports.router)
app.include_router(evolutions.router)
app.include_router(resource.router)
app.include_router(generation.router)
app.include_router(search.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(audit.router)
app.include_router(orchestration.router)
app.include_router(ws.router)
