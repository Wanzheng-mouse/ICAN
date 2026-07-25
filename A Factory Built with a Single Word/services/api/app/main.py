from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import re
import secrets
import zipfile
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from statistics import mean
from time import perf_counter
from typing import Any
from urllib.parse import quote, unquote
from uuid import uuid4

from fastapi import BackgroundTasks, Body, Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import configure_logging
from app.database import SessionLocal, get_db, new_id
from app.middleware.rate_limit import RateLimitMiddleware
from app.migrations import upgrade_database
from app.services.runtime_scheduler import hydrate_runtime, persist_runtime, persist_tick, runtime_scheduler, snapshot_from_run
from app.services.simulation import evolution_service, simulation_service
from app.services.report import build_simulation_pdf
from app.services.mail import send_password_reset
from app.services.llm_analysis import analyze_with_agnes

from app.schemas import (
    AnomalyCreate, AuthRead, EvolutionApplyRead, EvolutionCreate, EvolutionRead,
    GenerationCandidatesRead, GenerationCandidateApplyCreate, LoginRequest,
    PasswordResetConfirm, PasswordResetRequest, PasswordResetRequestRead, ProfileUpdate, PasswordChange,
    ProjectCreate, ProjectFileRead, ProjectMemberRead, ProjectMemberUpsert, ProjectRead, ProjectUpdate,
    ProjectWorkspaceRead, RegisterRequest, RequirementAnalyzeCreate, RequirementAnalysisRead,
    ScenarioAutoLayoutRead, ScenarioAutoLayoutRequest, ScenarioCanvas, ScenarioComponent,
    ScenarioCreate, ScenarioData, ScenarioRead, ScenarioUpdate, ScenarioValidationIssue,
    ScenarioValidationRead, ScenarioValidationRequest, ScenarioVersionRead, SimulationControl,
    SimulationCreate, SimulationRead, TemplateApplyCreate, TemplateDetailRead, TemplateEventCreate,
    TemplateRead, TemplateRecommendationRead, UserRead, UserPreferences,
)

from app.models import (
    AuditLog, AuthToken, Evolution, GenerationJob, LearningResource,
    Notification, PasswordResetToken, Project, ProjectFile, ProjectMembership, ProjectRequestKey,
    ResourceCase, Scenario, ScenarioRequestKey, ScenarioVersion,
    SimulationCargoRecord, SimulationEventRecord, SimulationRun, SimulationRuntimeLease,
    SimulationRuntimeState, SimulationSnapshot, SimulationTaskRecord, Template, TemplateEvent, User,
)

from app.domain import (
    ScenarioService,
    add_scenario_version, get_current_token, get_current_user,
    get_idempotent_scenario, get_or_404, hash_password, issue_token,
    latest_scenario_version, project_file_to_read, record_audit,
    require_project_access, require_evolution_access, require_project_owner,
    require_scenario_access, require_simulation_access, scenario_to_read,
    user_to_read, validate_project_file_content, verify_password, DEFAULT_PREFERENCES,
)

PREFIX = "/api/v1"

configure_logging(settings)

logger = logging.getLogger("ican.api")


# Scenario service for validation and auto-layout
scenario_service = ScenarioService()


def _utcnow() -> datetime:
    """Naive UTC now — compatible with SQLite-stored datetimes."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---- Helper ---------------------------------------------------------------


def _error_envelope(status_code: int, code: str, detail: Any, request_id: str | None = None) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "detail": detail}
    if request_id:
        body["request_id"] = request_id
    return JSONResponse(status_code=status_code, content=body)


# ---- Middleware -----------------------------------------------------------


# RequestContextMiddleware removed to avoid CORS interference.
# X-Request-ID and response logging are handled by middleware/request_context.py.


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


# ---- Exception handlers ---------------------------------------------------


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    return _error_envelope(422, "UNPROCESSABLE_ENTITY", exc.errors(), request_id)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content={"code": exc.detail.get("code", "ERROR"), "detail": exc.detail, "request_id": request_id})
    return _error_envelope(exc.status_code, {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 422: "UNPROCESSABLE_ENTITY"}.get(exc.status_code, "ERROR"), exc.detail, request_id)


# ---- Seed data helpers ----------------------------------------------------


def seed_templates(db: Session) -> None:
    if db.query(Template).count() > 0:
        return
    templates = [
        Template(id="tpl-1", category="scene", title="电商中型仓模板", description="中型 3PL 电商履约仓，日处理 3000–8000 单。", cover="ecom", industry="电商", difficulty="easy", downloads=1280, views=4200, updated_at="2024-05-20", scenario=deepcopy(_create_scenario_data(180, 400)), profile={"industries": ["电商", "3PL"], "min_area": 1500, "max_area": 5000, "min_orders": 3000, "max_orders": 8000, "min_agvs": 8, "max_agvs": 16, "min_staff": 5, "max_staff": 12}, quality_score=85, published=True),
        Template(id="tpl-2", category="scene", title="冷链小型仓", description="小型冷链仓，日处理 500–2000 单，温区隔离。", cover="coldchain", industry="冷链", difficulty="medium", downloads=760, views=2300, updated_at="2024-04-18", scenario=deepcopy(_create_scenario_data(120, 280)), profile={"industries": ["冷链", "食品"], "min_area": 800, "max_area": 2500, "min_orders": 500, "max_orders": 2000, "min_agvs": 4, "max_agvs": 10, "min_staff": 3, "max_staff": 8}, quality_score=78, published=True),
        Template(id="tpl-3", category="scene", title="3C 电子制造仓", description="高频率、小批量、多 SKU 的 3C 电子制造仓。", cover="3c", industry="3C 电子", difficulty="hard", downloads=540, views=1900, updated_at="2024-03-10", scenario=deepcopy(_create_scenario_data(200, 500)), profile={"industries": ["3C", "电子", "制造"], "min_area": 2000, "max_area": 8000, "min_orders": 5000, "max_orders": 15000, "min_agvs": 12, "max_agvs": 30, "min_staff": 8, "max_staff": 20}, quality_score=88, published=True),
        Template(id="tpl-4", category="scene", title="医药合规仓", description="GSP 医药仓，满足批号管理和温湿度合规要求。", cover="medical", industry="医药", difficulty="hard", downloads=890, views=3100, updated_at="2024-05-15", scenario=deepcopy(_create_scenario_data(160, 380)), profile={"industries": ["医药", "医疗"], "min_area": 1200, "max_area": 4000, "min_orders": 1000, "max_orders": 5000, "min_agvs": 6, "max_agvs": 14, "min_staff": 4, "max_staff": 10}, quality_score=82, published=True),
        Template(id="tpl-5", category="scene", title="电商大型仓", description="大型电商自动化仓，超 10000 平方米。", cover="ecom", industry="电商", difficulty="hard", downloads=2300, views=8900, updated_at="2024-05-22", scenario=deepcopy(_create_scenario_data(300, 700)), profile={"industries": ["电商", "3PL"], "min_area": 8000, "max_area": 20000, "min_orders": 15000, "max_orders": 50000, "min_agvs": 20, "max_agvs": 50, "min_staff": 15, "max_staff": 30}, quality_score=92, published=True),
        Template(id="tpl-6", category="scene", title="医药合规仓标杆", description="GSP 医药仓标杆方案，含双深位货架、冷库隔间。", cover="medical", industry="医药", difficulty="expert", downloads=450, views=1500, updated_at="2024-05-28", scenario=deepcopy(_create_scenario_data(220, 520)), profile={"industries": ["医药"], "min_area": 3000, "max_area": 10000, "min_orders": 3000, "max_orders": 10000, "min_agvs": 10, "max_agvs": 20, "min_staff": 6, "max_staff": 15}, quality_score=95, published=True),
        Template(id="tpl-7", category="strategy", title="绕行策略模板", description="遇到障碍物时主动绕行而非等待。", cover="strategy", industry="通用", difficulty="easy", downloads=320, views=980, updated_at="2024-03-05", scenario={}, profile={}, quality_score=70, published=True),
        Template(id="tpl-mock-0", category="scene", title="演示轻量仓", description="用于开发/演示的最小场景。", cover="warehouse", industry="通用", difficulty="easy", downloads=9999, views=9999, updated_at="2024-01-01", scenario=deepcopy(_create_scenario_data(80, 160)), profile={"industries": ["通用"], "min_area": 500, "max_area": 2000, "min_orders": 100, "max_orders": 500, "min_agvs": 2, "max_agvs": 6, "min_staff": 1, "max_staff": 3}, quality_score=50, published=True),
    ]
    for item in templates:
        db.add(item)
    db.commit()


def _create_scenario_data(component_count: int, area: int) -> dict:
    import math
    components: list[dict[str, Any]] = []
    units = max(1, math.ceil(math.sqrt(component_count)))
    spacing_x = area / units
    spacing_y = area / units
    for index in range(component_count):
        row = index // units
        col = index % units
        shelf_id = f"shelf-{index + 1:03d}"
        components.append({"id": shelf_id, "type": "shelf", "name": f"Shelf {index + 1}", "x": 30 + col * spacing_x, "y": 30 + row * spacing_y, "width": spacing_x - 10, "height": spacing_y - 10, "rotation": 0, "properties": {"levels": 3, "color": "#94a3b8"}})
    return {"schema_version": "1.0", "canvas": {"width": area + 60, "height": area + 60, "scale": 1}, "components": components}


def seed_resources(db: Session) -> None:
    if db.query(ResourceCase).count() > 0:
        return
    cases = [
        ResourceCase(id="case-1", title="某头部电商 618 大促峰值弹性扩容", description="通过多策略仿真在 72 小时内完成 3 倍产能评估与扩容方案输出，节省 30% 临时设备租赁成本。", cover="ecom", industry="电商", metrics={"efficiency": "+35%", "roi": "8 个月", "manpower": "-40%"}, published=True),
        ResourceCase(id="case-2", title="华东冷链中心布局与调度优化", description="针对多温区冷链仓，通过 AGV 路径优化与动态调度策略，搬运效率提升 28%，能耗降低 15%。", cover="coldchain", industry="冷链", metrics={"efficiency": "+28%", "energy": "-15%", "complaint": "-60%"}, published=True),
        ResourceCase(id="case-3", title="3C 电子制造仓料箱拣选升级", description="从人工+输送线升级为料箱到人方案，单站处理能力从 80 件/h 提升至 220 件/h。", cover="3c", industry="3C 电子", metrics={"efficiency": "+175%", "roi": "14 个月", "manpower": "-55%"}, published=True),
    ]
    for item in cases:
        db.add(item)
    learn = [
        LearningResource(id="learn-1", title="无人仓规划入门", description="了解无人仓的基本构成、主流设备与规划流程。", progress=0, sort_order=1, published=True),
        LearningResource(id="learn-2", title="AGV 选型与部署", description="学习不同 AGV 类型的特点、适用场景和部署要点。", progress=0, sort_order=2, published=True),
        LearningResource(id="learn-3", title="仿真模型构建", description="掌握仿真建模方法论，从布局设计到参数配置。", progress=0, sort_order=3, published=True),
    ]
    for item in learn:
        db.add(item)
    db.commit()


def seed_users(db: Session) -> None:
    if db.query(User).count() > 0:
        return
    users = [
        User(id=new_id(), login_name="admin", name="管理员", email="admin@ican-platform.com", password_hash=hash_password("ican2026"), department="平台管理", role="admin", avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed=admin", preferences=DEFAULT_PREFERENCES),
        User(id=new_id(), login_name="lisi", name="李思", email="lisi@demo.com", password_hash=hash_password("demo1234"), department="仓储运营部", role="operator", avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed=lisi", preferences=DEFAULT_PREFERENCES),
    ]
    for item in users:
        db.add(item)
    db.commit()


def seed_notifications(db: Session) -> None:
    if db.query(Notification).count() > 0:
        return
    admin = db.query(User).filter(User.login_name == "admin").first()
    if not admin:
        return
    notes = [
        Notification(id=new_id(), user_id=admin.id, type="info", title="欢迎使用 ICAN 一言造厂", content="这是你的第一个通知，未来仿真完成和进化方案生成时会收到通知。", read=False, target_url="/"),
        Notification(id=new_id(), user_id=admin.id, type="alert", title="拥堵告警：Aisle 08", content="Aisle 08 拥堵等级升至高，建议启动分流策略。", read=False, target_url="/simulation"),
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


# ---- HTTP and WebSocket interface -----------------------------------------


@app.get(f"{PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health")
@app.get("/api/health")
def health_alt() -> dict[str, str]:
    return {"status": "ok"}


# ---- Auth -----------------------------------------------------------------


@app.post(f"{PREFIX}/auth/login", response_model=AuthRead, tags=["auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthRead:
    username = payload.username.strip()
    user = db.query(User).filter(
        (func.lower(User.login_name) == username.lower()) |
        (User.name == username) |
        (func.lower(User.email) == username.lower())
    ).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    return AuthRead(token=issue_token(db, user, payload.remember), user=user_to_read(user))


@app.post(f"{PREFIX}/auth/register", response_model=AuthRead, status_code=201, tags=["auth"])
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthRead:
    login_name = payload.loginName
    email = payload.email
    duplicate = db.query(User).filter(
        (func.lower(User.login_name) == login_name.lower()) | (func.lower(User.email) == email.lower())
    ).first()
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="该账号或邮箱已被注册")
    user = User(
        login_name=login_name,
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        role="operator",
        department=payload.department,
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={quote(payload.name)}",
        preferences=DEFAULT_PREFERENCES,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="该账号或邮箱已被注册") from None
    db.refresh(user)
    return AuthRead(token=issue_token(db, user, payload.remember), user=user_to_read(user))


@app.post(f"{PREFIX}/auth/logout", status_code=204, tags=["auth"])
def logout(token: str = Depends(get_current_token), db: Session = Depends(get_db)) -> Response:
    stored = db.get(AuthToken, token)
    if stored is not None:
        db.delete(stored)
        db.commit()
    return Response(status_code=204)


@app.post(f"{PREFIX}/auth/forgot-password", response_model=PasswordResetRequestRead, tags=["auth"])
def request_password_reset(payload: PasswordResetRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> PasswordResetRequestRead:
    generic = "如果邮箱已注册，密码重置凭据已经生成"
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user is None:
        return PasswordResetRequestRead(message=generic)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used.is_(False)
    ).update({PasswordResetToken.used: True})
    token = secrets.token_urlsafe(40)
    db.add(PasswordResetToken(token=token, user_id=user.id))
    db.commit()
    background_tasks.add_task(send_password_reset, user.email, token)
    return PasswordResetRequestRead(message=generic, reset_token=token if settings.expose_reset_token else None)


@app.post(f"{PREFIX}/auth/reset-password", status_code=204, tags=["auth"])
def reset_password(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> Response:
    reset = db.get(PasswordResetToken, payload.token)
    if reset is None or reset.used or reset.created_at < _utcnow() - timedelta(minutes=30):
        raise HTTPException(status_code=400, detail="重置凭据无效或已过期")
    user = get_or_404(User, reset.user_id, db, "User")
    user.password_hash = hash_password(payload.new_password)
    reset.used = True
    db.query(AuthToken).filter(AuthToken.user_id == user.id).delete()
    db.commit()
    return Response(status_code=204)


# ---- Users / Profile ------------------------------------------------------


@app.get(f"{PREFIX}/users/me", response_model=UserRead, tags=["users"])
def get_my_profile(user: User = Depends(get_current_user)) -> UserRead:
    return user_to_read(user)


@app.put(f"{PREFIX}/users/me", response_model=UserRead, tags=["users"])
def update_profile(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserRead:
    data = payload.model_dump(exclude_unset=True)
    prefs = data.get("preferences")
    if prefs is not None:
        merged = {**(user.preferences or {}), **prefs}
        UserPreferences.model_validate({"defaultPage": merged.get("defaultPage", "/")})
        user.preferences = merged
    user.name = data.get("name", user.name)
    user.department = data.get("department", user.department)
    user.avatar = data.get("avatar", user.avatar)
    db.commit()
    db.refresh(user)
    return user_to_read(user)

# ---- Templates ------------------------------------------------------------

@app.get("/api/templates", response_model=list[TemplateRead], tags=["templates"])
@app.get(f"{PREFIX}/templates", response_model=list[TemplateRead], tags=["templates"])
def list_templates(category: str | None = None, db: Session = Depends(get_db)) -> list[Template]:
    query = db.query(Template).filter(Template.published.is_(True))
    if category:
        query = query.filter(Template.category == category)
    return list(query.all())


@app.get("/api/templates/{{template_id}}", response_model=TemplateDetailRead, tags=["templates"])
@app.get(f"{PREFIX}/templates/{{template_id}}", response_model=TemplateDetailRead, tags=["templates"])
def get_template(template_id: str, db: Session = Depends(get_db)) -> TemplateDetailRead:
    tpl = get_or_404(Template, template_id, db, "Template")
    return TemplateDetailRead(
        id=tpl.id, category=tpl.category, title=tpl.title, description=tpl.description,
        cover=tpl.cover, industry=tpl.industry, difficulty=tpl.difficulty, downloads=tpl.downloads,
        views=tpl.views, updated_at=tpl.updated_at, profile=tpl.profile, quality_score=tpl.quality_score,
        data=ScenarioData.model_validate(tpl.scenario),
    )


@app.post("/api/templates/{{template_id}}/apply", response_model=ScenarioRead, status_code=201, tags=["templates"])
@app.post(f"{PREFIX}/templates/{{template_id}}/apply", response_model=ScenarioRead, status_code=201, tags=["templates"])
def apply_template(template_id: str, payload: TemplateApplyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScenarioRead:
    tpl = get_or_404(Template, template_id, db, "Template")
    scenario = Scenario(project_id=payload.project_id, name=payload.name, data=deepcopy(tpl.scenario))
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)

# ---- Projects -------------------------------------------------------------

@app.post(f"{PREFIX}/projects", response_model=ProjectRead, status_code=201, tags=["projects"])
def create_project(payload: ProjectCreate, user: User = Depends(get_current_user), request: Request = None, db: Session = Depends(get_db)) -> Project:
    if request:
        key = request.headers.get("X-Idempotency-Key")
        if key:
            existing = db.query(ProjectRequestKey).filter(ProjectRequestKey.request_key == key.strip(), ProjectRequestKey.user_id == user.id).first()
            if existing:
                return db.get(Project, existing.project_id)
    project = Project(name=payload.name.strip(), requirement=payload.requirement.strip())
    db.add(project)
    db.flush()
    db.add(ProjectMembership(project_id=project.id, user_id=user.id, role="owner"))
    if request:
        key = request.headers.get("X-Idempotency-Key")
        if key:
            db.add(ProjectRequestKey(request_key=key.strip(), user_id=user.id, project_id=project.id))
    db.commit()
    db.refresh(project)
    return project


@app.get(f"{PREFIX}/projects", response_model=list[ProjectRead], tags=["projects"])
def list_projects(include_archived: bool = False, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Project]:
    query = db.query(Project)
    if user.role != "admin":
        query = query.join(ProjectMembership, ProjectMembership.project_id == Project.id).filter(ProjectMembership.user_id == user.id)
    if not include_archived:
        query = query.filter(Project.status != "archived")
    return list(query.order_by(Project.created_at.desc()).all())


# ---- Remaining project routes --------------------------------------------

@app.get(f"{PREFIX}/projects/{{project_id}}", response_model=ProjectRead, tags=["projects"])
def get_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Project:
    return require_project_access(project_id, user, db)


@app.patch(f"{PREFIX}/projects/{{project_id}}", response_model=ProjectRead, tags=["projects"])
def update_project(project_id: str, payload: ProjectUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Project:
    project = require_project_access(project_id, user, db, write=True)
    if payload.name is not None:
        existing = db.query(Project).join(ProjectMembership, ProjectMembership.project_id == Project.id).filter(
            ProjectMembership.user_id == user.id, Project.name == payload.name.strip(), Project.id != project_id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"项目名称「{payload.name}」已被占用")
        payload.name = payload.name.strip()
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            if field_name == "status" and value == "archived":
                project.archived_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).replace(tzinfo=None)
            setattr(project, field_name, value)
    project.updated_at = _utcnow()
    db.commit()
    db.refresh(project)
    return project


@app.get(f"{PREFIX}/projects/{{project_id}}/workspace", response_model=ProjectWorkspaceRead, tags=["projects"])
def get_project_workspace(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProjectWorkspaceRead:
    project = require_project_access(project_id, user, db)
    scenarios = db.query(Scenario).filter(Scenario.project_id == project_id).order_by(Scenario.updated_at.desc()).all()
    files = db.query(ProjectFile).filter(ProjectFile.project_id == project_id).order_by(ProjectFile.created_at.desc()).all()
    return ProjectWorkspaceRead(
        project=ProjectRead.model_validate(project),
        scenarios=[scenario_to_read(item, db) for item in scenarios],
        files=[project_file_to_read(item) for item in files],
    )


@app.get(f"{PREFIX}/projects/{{project_id}}/simulations", response_model=list[SimulationRead], tags=["projects"])
def list_project_simulations(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[SimulationRun]:
    require_project_access(project_id, user, db)
    return list(db.query(SimulationRun).filter(SimulationRun.project_id == project_id).order_by(SimulationRun.created_at.desc()).all())


@app.get(f"{PREFIX}/projects/{{project_id}}/files", response_model=list[ProjectFileRead], tags=["projects"])
def list_project_files(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProjectFileRead]:
    require_project_access(project_id, user, db)
    items = db.query(ProjectFile).filter(ProjectFile.project_id == project_id).order_by(ProjectFile.created_at.desc()).all()
    return [project_file_to_read(item) for item in items]


@app.post(f"{PREFIX}/projects/{{project_id}}/files", response_model=ProjectFileRead, status_code=201, tags=["projects"])
def upload_project_file(project_id: str, request: Request, kind: str = "attachment", user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProjectFileRead:
    require_project_access(project_id, user, db, write=True)
    import asyncio
    body = asyncio.run(request.body())
    filename = request.headers.get("X-Filename", f"file-{uuid4().hex[:8]}")
    content_type = request.headers.get("Content-Type", "application/octet-stream")
    ext = Path(filename).suffix.lower()
    ext_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf",
               ".csv": "text/csv", ".json": "application/json", ".yaml": "application/json", ".yml": "application/json", ".txt": "text/plain"}
    validate_project_file_content(ext, body)
    upload_dir = Path(settings.upload_dir).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    project_dir = upload_dir / project_id
    project_dir.mkdir(exist_ok=True)
    stored_name = f"{uuid4().hex}{ext}"
    (project_dir / stored_name).write_bytes(body)
    item = ProjectFile(project_id=project_id, uploader_id=user.id, filename=filename, stored_name=stored_name, content_type=ext_map.get(ext, content_type), size=len(body), kind=kind)
    db.add(item)
    db.commit()
    db.refresh(item)
    return project_file_to_read(item)


@app.get(f"{PREFIX}/projects/{{project_id}}/files/{{file_id}}/download", tags=["projects"])
def download_project_file(project_id: str, file_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    require_project_access(project_id, user, db)
    item = get_or_404(ProjectFile, file_id, db, "Project file")
    if item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Project file not found")
    path = Path(settings.upload_dir).resolve() / project_id / item.stored_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="文件内容不存在")
    return Response(content=path.read_bytes(), media_type=item.content_type,
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(item.filename)}"})


@app.delete(f"{PREFIX}/projects/{{project_id}}/files/{{file_id}}", status_code=204, tags=["projects"])
def delete_project_file(project_id: str, file_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    require_project_access(project_id, user, db, write=True)
    item = get_or_404(ProjectFile, file_id, db, "Project file")
    if item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Project file not found")
    db.delete(item)
    db.commit()
    return Response(status_code=204)


@app.get(f"{PREFIX}/projects/{{project_id}}/members", response_model=list[ProjectMemberRead], tags=["projects"])
def list_project_members(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProjectMemberRead]:
    require_project_access(project_id, user, db)
    memberships = db.query(ProjectMembership).filter(ProjectMembership.project_id == project_id).all()
    result: list[ProjectMemberRead] = []
    for m in memberships:
        member = db.get(User, m.user_id)
        if member:
            result.append(ProjectMemberRead(user_id=member.id, login_name=member.login_name, name=member.name, email=member.email, role=m.role))
    return result


@app.post(f"{PREFIX}/projects/{{project_id}}/members", response_model=ProjectMemberRead, tags=["projects"])
def add_project_member(project_id: str, payload: ProjectMemberUpsert, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProjectMemberRead:
    require_project_access(project_id, user, db, write=True)
    identity = payload.identity.strip().lower()
    member = db.query(User).filter(
        (func.lower(User.login_name) == identity) | (func.lower(User.email) == identity)
    ).first()
    if member is None:
        raise HTTPException(status_code=404, detail="用户不存在，请先注册")
    existing = db.query(ProjectMembership).filter(
        ProjectMembership.project_id == project_id, ProjectMembership.user_id == member.id
    ).first()
    if existing:
        existing.role = payload.role
        db.commit()
        db.refresh(existing)
        return ProjectMemberRead(user_id=member.id, login_name=member.login_name, name=member.name, email=member.email, role=existing.role)
    membership = ProjectMembership(project_id=project_id, user_id=member.id, role=payload.role)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return ProjectMemberRead(user_id=member.id, login_name=member.login_name, name=member.name, email=member.email, role=membership.role)


@app.delete(f"{PREFIX}/projects/{{project_id}}/members/{{user_id}}", status_code=204, tags=["projects"])
def remove_project_member(project_id: str, user_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    require_project_access(project_id, user, db, write=True)
    membership = db.query(ProjectMembership).filter(
        ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
    ).first()
    if membership:
        db.delete(membership)
        db.commit()
    return Response(status_code=204)


@app.post(f"{PREFIX}/resource/templates", response_model=TemplateRead, status_code=201, tags=["resource"])
def create_user_template(payload: TemplateEventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TemplateRead:
    tpl = Template(
        id=f"usr-{uuid4().hex[:12]}", category=payload.category or "scene",
        title=payload.title, description=payload.description or "",
        scenario=payload.scenario or {},
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return TemplateRead(
        id=tpl.id, category=tpl.category, title=tpl.title, description=tpl.description,
        cover=tpl.cover, industry=tpl.industry, difficulty=tpl.difficulty, downloads=tpl.downloads,
        views=tpl.views, updated_at=tpl.updated_at, profile=tpl.profile, quality_score=tpl.quality_score,
    )


# ---- Scenarios ------------------------------------------------------------

@app.post(f"{PREFIX}/scenarios", response_model=ScenarioRead, status_code=201, tags=["scenarios"])
def create_scenario(payload: ScenarioCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScenarioRead:
    require_project_access(payload.project_id, user, db, write=True)
    scenario = Scenario(project_id=payload.project_id, name=payload.name, data=payload.data.model_dump() if isinstance(payload.data, ScenarioData) else payload.data)
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


@app.get(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead, tags=["scenarios"])
def get_scenario(scenario_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScenarioRead:
    return scenario_to_read(require_scenario_access(scenario_id, user, db), db)


@app.put(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead, tags=["scenarios"])
def update_scenario(scenario_id: str, payload: ScenarioUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScenarioRead:
    scenario = require_scenario_access(scenario_id, user, db, write=True)
    current_version = latest_scenario_version(db, scenario_id)
    if payload.expected_version is not None and payload.expected_version != current_version:
        raise HTTPException(status_code=409, detail={"code": "SCENARIO_VERSION_CONFLICT", "message": "场景已被其他会话更新，请重新加载后再保存", "current_version": current_version})
    validation = scenario_service.validate(payload.data)
    if not validation.valid:
        raise HTTPException(status_code=422, detail={"code": "SCENARIO_VALIDATION_FAILED", "message": "场景校验失败", "issues": [issue.model_dump() for issue in validation.errors]})
    if payload.name is not None:
        scenario.name = payload.name
    scenario.data = payload.data.model_dump()
    db.flush()
    add_scenario_version(db, scenario, current_version + 1)
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


@app.post(f"{PREFIX}/scenarios/{{scenario_id}}/validate", response_model=ScenarioValidationRead, tags=["scenarios"])
def validate_scenario(scenario_id: str, payload: ScenarioValidationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScenarioValidationRead:
    require_scenario_access(scenario_id, user, db)
    return scenario_service.validate_raw(payload.data.model_dump())[1]


@app.post(f"{PREFIX}/scenarios/{{scenario_id}}/auto-layout", response_model=ScenarioAutoLayoutRead, tags=["scenarios"])
def auto_layout_scenario(scenario_id: str, payload: ScenarioAutoLayoutRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScenarioAutoLayoutRead:
    require_scenario_access(scenario_id, user, db, write=True)
    return scenario_service.auto_layout(payload.data.model_dump())


@app.get(f"{PREFIX}/scenarios/{{scenario_id}}/versions", response_model=list[ScenarioVersionRead], tags=["scenarios"])
def list_scenario_versions(scenario_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ScenarioVersionRead]:
    require_scenario_access(scenario_id, user, db)
    versions = db.query(ScenarioVersion).filter(ScenarioVersion.scenario_id == scenario_id).order_by(ScenarioVersion.version.desc()).all()
    return [ScenarioVersionRead(id=v.id, scenario_id=v.scenario_id, version=v.version, name=v.name, data=v.data, created_at=str(v.created_at)) for v in versions]


# ---- Simulations ----------------------------------------------------------

@app.post(f"{PREFIX}/simulations", response_model=SimulationRead, status_code=201, tags=["simulations"])
def create_simulation(payload: SimulationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SimulationRun:
    require_project_access(payload.project_id, user, db, write=True)
    scenario = require_scenario_access(payload.scenario_id, user, db)
    if scenario.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="场景不属于指定项目")
    run = simulation_service.create(payload, scenario_data=scenario.data, scenario_version=latest_scenario_version(db, scenario.id))
    db.add(run)
    db.flush()
    persist_runtime(db, run)
    record_audit(db, user, "simulation.create", "simulation", run.id, payload.model_dump())
    db.commit()
    db.refresh(run)
    return run


@app.get(f"{PREFIX}/simulations/{{simulation_id}}", response_model=SimulationRead, tags=["simulations"])
def get_simulation(simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SimulationRun:
    return require_simulation_access(simulation_id, user, db)


@app.post(f"{PREFIX}/simulations/{{simulation_id}}/control", response_model=SimulationRead, tags=["simulations"])
def control_simulation(simulation_id: str, payload: SimulationControl, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SimulationRun:
    run = require_simulation_access(simulation_id, user, db, write=True)
    if payload.action == "start" and run.status in ("running", "completed"):
        raise HTTPException(status_code=409, detail=f"仿真已在「{run.status}」状态，不能重复启动")
    run = simulation_service.control(run, payload.action)
    persist_runtime(db, run)
    record_audit(db, user, f"simulation.{payload.action}", "simulation", run.id)
    db.commit()
    db.refresh(run)
    return run


@app.post(f"{PREFIX}/simulations/{{simulation_id}}/anomalies", response_model=SimulationRead, tags=["simulations"])
def inject_anomaly(simulation_id: str, payload: AnomalyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SimulationRun:
    run = require_simulation_access(simulation_id, user, db, write=True)
    run = simulation_service.add_anomaly(run, payload.type)
    persist_runtime(db, run)
    db.commit()
    db.refresh(run)
    return run


@app.post(f"{PREFIX}/simulations/{{simulation_id}}/run-to-completion", response_model=SimulationRead, tags=["simulations"])
def run_simulation_to_completion(simulation_id: str, max_seconds: int = 3600, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SimulationRun:
    run = require_simulation_access(simulation_id, user, db, write=True)
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
    record_audit(db, user, "simulation.run_to_completion", "simulation", run.id, {"elapsed": elapsed})
    db.commit()
    db.refresh(run)
    return run


@app.get(f"{PREFIX}/simulations/{{simulation_id}}/agents", tags=["simulations"])
def list_simulation_agents(simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run := db.get(SimulationRun, simulation_id))
    runtime = (run.config or {}).get("runtime_snapshot", {})
    return [{"id": r.get("id"), "name": r.get("name", f"AGV-{r.get('id', '?')[:6]}"), "status": r.get("status", "idle"), "battery": r.get("battery", 100), "position": {"x": r.get("x", 0), "y": r.get("y", 0)}, "task_id": r.get("task_id"), "completed_tasks": r.get("completed_tasks", 0), "total_distance": r.get("total_distance", 0)} for r in runtime.get("robots", [])]


@app.websocket(f"{PREFIX}/simulations/{{simulation_id}}/stream")
async def stream_simulation(websocket: WebSocket, simulation_id: str, token: str | None = None) -> None:
    await websocket.accept()
    with SessionLocal() as db:
        stored = db.get(AuthToken, token) if token else None
        user = db.get(User, stored.user_id) if stored and stored.expires_at >= _utcnow() else None
        if user is None:
            await websocket.send_json({"type": "error", "message": "Authentication required"})
            await websocket.close(code=4401)
            return
        try:
            require_simulation_access(simulation_id, user, db)
        except HTTPException:
            await websocket.send_json({"type": "error", "message": "Simulation access denied"})
            await websocket.close(code=4403)
            return
    queue = runtime_scheduler.subscribe(simulation_id)
    try:
        with SessionLocal() as db:
            run = db.get(SimulationRun, simulation_id)
            if run is None:
                await websocket.send_json({"type": "error", "message": "Simulation run not found"})
                await websocket.close(code=1008)
                return
            await websocket.send_json(snapshot_from_run(db, run))
        while True:
            tick = await queue.get()
            await websocket.send_json(tick)
    except Exception:
        pass
    finally:
        runtime_scheduler.unsubscribe(simulation_id, queue)


# ---- Reports --------------------------------------------------------------

@app.get(f"{PREFIX}/reports/{{simulation_id}}/pdf")
def download_report(simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    run = require_simulation_access(simulation_id, user, db, write=True)
    hydrate_runtime(db, run)
    body = build_simulation_pdf(run)
    record_audit(db, user, "export", "simulation_report", run.id, {"format": "pdf"})
    db.commit()
    return Response(body, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="ican-report-{simulation_id}.pdf"'})


@app.get(f"{PREFIX}/reports/{{simulation_id}}/kpis", tags=["reports"])
def report_kpis(simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    return [{"key": k, "label": {"project_count": "项目", "scenarios": "场景", "simulations": "仿真", "completion_rate": "完成率", "avg_wait": "平均等待", "throughput": "吞吐量", "device_utilization": "设备利用率", "energy": "能耗", "anomaly_count": "异常次数", "completed_orders": "完成订单", "avg_fulfillment_time": "平均履约时间"}.get(k, k), "value": v} for k, v in (run.metrics or {}).items()]


@app.get(f"{PREFIX}/reports/{{simulation_id}}/trend", tags=["reports"])
def report_trend(simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    metric_history = (run.config or {}).get("metric_history", [])
    return [{"date": f"T+{i}", "completionRate": round(m.get("completion_rate", 0) * 100, 1), "avgWait": m.get("avg_wait", 0)} for i, m in enumerate(metric_history)]


@app.get(f"{PREFIX}/reports/{{simulation_id}}/device-usages", tags=["reports"])
def report_device_usages(simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    run = require_simulation_access(simulation_id, user, db)
    hydrate_runtime(db, run)
    runtime = (run.config or {}).get("runtime_snapshot", {})
    return [{"id": r.get("id"), "name": r.get("name", f"AGV-{r.get('id', '?')[:6]}"), "type": "AGV", "tasks": r.get("completed_tasks", 0), "mileage": r.get("total_distance", 0), "battery": r.get("battery", 100), "status": r.get("status", "idle")} for r in runtime.get("robots", [])]


@app.get(f"{PREFIX}/reports/{{simulation_id}}/log-playback", tags=["reports"])
def report_log_playback(simulation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    run = require_simulation_access(simulation_id, user, db)
    snapshot_history = (run.config or {}).get("snapshot_history", [])
    frames = [{"time": s.get("time", 0), "robots": [{"id": r.get("id"), "position": {"x": r.get("x", 0), "y": r.get("y", 0)}, "status": r.get("status", "idle")} for r in s.get("robots", [])], "tasks": {"pending": s.get("tasks_pending", 0), "running": s.get("tasks_running", 0), "completed": s.get("tasks_completed", 0)}} for s in snapshot_history]
    return {"frameCount": len(frames), "frames": frames}


# ---- Evolutions -----------------------------------------------------------

@app.post(f"{PREFIX}/evolutions", response_model=EvolutionRead, status_code=201, tags=["evolutions"])
def create_evolution(payload: EvolutionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> EvolutionRead:
    run = require_simulation_access(payload.simulation_id, user, db)
    evolution = evolution_service.create(run)
    db.add(evolution)
    record_audit(db, user, "evolution.create", "evolution", evolution.id, {"simulation_id": payload.simulation_id})
    db.commit()
    db.refresh(evolution)
    return EvolutionRead(id=evolution.id, simulation_id=evolution.simulation_id, diagnosis=evolution.diagnosis, baseline_metrics=evolution.baseline_metrics, optimized_metrics=evolution.optimized_metrics, applied_scenario_id=evolution.applied_scenario_id, created_at=str(evolution.created_at))


@app.get(f"{PREFIX}/evolutions/{{evolution_id}}", response_model=EvolutionRead, tags=["evolutions"])
def get_evolution(evolution_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> EvolutionRead:
    evolution = get_or_404(Evolution, evolution_id, db, "Evolution")
    return EvolutionRead(id=evolution.id, simulation_id=evolution.simulation_id, diagnosis=evolution.diagnosis, baseline_metrics=evolution.baseline_metrics, optimized_metrics=evolution.optimized_metrics, applied_scenario_id=evolution.applied_scenario_id, created_at=str(evolution.created_at))


@app.post(f"{PREFIX}/evolutions/{{evolution_id}}/apply", response_model=EvolutionApplyRead, tags=["evolutions"])
def apply_evolution(evolution_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> EvolutionApplyRead:
    evolution = get_or_404(Evolution, evolution_id, db, "Evolution")
    run = db.get(SimulationRun, evolution.simulation_id)
    if run is None:
        raise HTTPException(status_code=404, detail="关联的仿真运行不存在")
    project_id = run.project_id
    scenario = Scenario(project_id=project_id, name=f"{run.id[:8]}进化方案", data={"components": [], "canvas": {"width": 1200, "height": 800, "scale": 1}, "schema_version": "1.0"})
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    evolution.applied_scenario_id = scenario.id
    changes = [{"action": "optimize", "target": d.get("target", "layout"), "description": d.get("suggestion", "进化优化调整")} for d in evolution.diagnosis]
    record_audit(db, user, "evolution.apply", "evolution", evolution_id, {"scenario_id": scenario.id})
    db.commit()
    db.refresh(scenario)
    return EvolutionApplyRead(scenario=scenario_to_read(scenario, db), changes=changes)


@app.get(f"{PREFIX}/evolutions/{{evolution_id}}/versions", tags=["evolutions"])
def list_evolution_scenarios(evolution_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ScenarioRead]:
    evolution = get_or_404(Evolution, evolution_id, db, "Evolution")
    if not evolution.applied_scenario_id:
        return []
    scenario = db.get(Scenario, evolution.applied_scenario_id)
    return [scenario_to_read(scenario, db)] if scenario else []


# ---- Resource Center ------------------------------------------------------



@app.get(f"{PREFIX}/resource/hot-resources", tags=["resource"])
def list_hot_resources(db: Session = Depends(get_db)) -> list[dict]:
    items = db.query(Template).filter(Template.published.is_(True)).order_by(Template.downloads.desc()).limit(10).all()
    return [{"rank": i + 1, "name": t.title, "downloads": t.downloads, "views": t.views} for i, t in enumerate(items)]

@app.get(f"{PREFIX}/resource/featured-cases", tags=["resource"])
def list_featured_cases(db: Session = Depends(get_db)) -> list[dict]:
    return [{"id": c.id, "title": c.title, "description": c.description, "cover": c.cover, "industry": c.industry, **c.metrics} for c in db.query(ResourceCase).filter(ResourceCase.published.is_(True)).all()]


@app.get(f"{PREFIX}/resource/learning-path", tags=["resource"])
def list_learning_path(db: Session = Depends(get_db)) -> list[dict]:
    return [{"id": r.id, "title": r.title, "description": r.description, "progress": r.progress, "sort_order": r.sort_order} for r in db.query(LearningResource).filter(LearningResource.published.is_(True)).order_by(LearningResource.sort_order).all()]


@app.get(f"{PREFIX}/resource/categories", tags=["resource"])
def list_categories(db: Session = Depends(get_db)) -> list[dict]:
    counts = db.query(Template.category, func.count(Template.id)).filter(Template.published.is_(True)).group_by(Template.category).all()
    items = [{"key": "all", "label": "全部", "count": sum(c for _, c in counts)}]
    items += [{"key": cat, "label": {"scene": "场景模板", "strategy": "策略模板", "report": "报告模板", "device": "设备配置", "case": "案例", "doc": "文档"}.get(cat, cat), "count": cnt} for cat, cnt in counts]
    return items


@app.get(f"{PREFIX}/resource/templates", response_model=list[TemplateRead], tags=["resource"])
def list_resource_templates(db: Session = Depends(get_db)) -> list[Template]:
    return list(db.query(Template).filter(Template.published.is_(True)).all())


@app.get(f"{PREFIX}/resource/recommendations", response_model=list[TemplateRecommendationRead], tags=["resource"])
def recommend_templates(project_id: str | None = None, scenario_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TemplateRecommendationRead]:
    templates = db.query(Template).filter(Template.published.is_(True), Template.category == "scene").all()
    return [TemplateRecommendationRead(id=t.id, category=t.category, title=t.title, description=t.description, cover=t.cover, industry=t.industry, difficulty=t.difficulty, downloads=t.downloads, views=t.views, updated_at=t.updated_at, profile=t.profile, quality_score=t.quality_score, match_score=85 + (i % 10), reasons=["基于当前场景推荐"], cautions=[]) for i, t in enumerate(templates[:6])]


# ---- Generation / AI Analysis ---------------------------------------------

@app.post(f"{PREFIX}/generation/analyze", response_model=RequirementAnalysisRead, tags=["generation"])
def analyze_requirement(payload: RequirementAnalyzeCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> RequirementAnalysisRead:
    requirement = payload.requirement.strip()
    sources = [s.model_dump() for s in (payload.sources or [])]
    job = GenerationJob(user_id=user.id, requirement=requirement, source_files=sources, status="analyzing")
    db.add(job)
    db.flush()
    profile = _requirement_profile(requirement, sources)
    analysis_result = analyze_with_agnes(requirement, sources, settings) if settings.agnes_api_key else {}
    job.analysis = {**{"profile": profile, "assumptions": [], "questions": [], "risks": [], "confidence": 85, "candidate_guidance": []}, **analysis_result}
    job.status = "analyzed"
    db.commit()
    db.refresh(job)
    return RequirementAnalysisRead(job_id=job.id, status=job.status, summary=job.analysis.get("summary", "需求已分析"), profile=job.analysis.get("profile", profile), assumptions=job.analysis.get("assumptions", []), questions=job.analysis.get("questions", []), risks=job.analysis.get("risks", []), confidence=job.analysis.get("confidence", 85), operational_design=job.analysis.get("operational_design", {}), candidate_guidance=job.analysis.get("candidate_guidance", []))


@app.post(f"{PREFIX}/generation/{{job_id}}/candidates", response_model=GenerationCandidatesRead, tags=["generation"])
def generate_candidates(job_id: str, payload: dict[str, Any] | None = Body(None), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    job = get_or_404(GenerationJob, job_id, db, "Generation job")
    if job.user_id != user.id:
        raise HTTPException(status_code=404, detail="需求分析任务不存在")
    profile = (payload and payload.get("profile")) or (job.analysis or {}).get("profile", {})
    templates = db.query(Template).filter(Template.category == "scene", Template.published.is_(True)).all()
    modes = [("balanced", "均衡方案", "在吞吐、能耗和部署成本之间保持平衡。", {"throughput": .78, "wait_seconds": 42.0, "energy": .64}), ("throughput", "高吞吐方案", "增加并发与拣选资源，优先保障高峰时效。", {"throughput": .91, "wait_seconds": 28.0, "energy": .82}), ("energy_saver", "低能耗方案", "以充电窗口和设备利用率为约束，降低运行能耗。", {"throughput": .70, "wait_seconds": 51.0, "energy": .45})]
    guidance = {item.get("strategy"): item for item in (job.analysis or {}).get("candidate_guidance", []) if isinstance(item, dict)}
    candidates = []
    for index, (strategy, title, description, metrics) in enumerate(modes):
        if not templates:
            break
        llm_guidance = guidance.get(strategy, {})
        title = str(llm_guidance.get("title") or title)
        description = str(llm_guidance.get("description") or description)
        template = templates[min(index, len(templates) - 1)]
        candidate_data = deepcopy(template.scenario)
        total_agv = (profile.get("tote_agv_count") or 0) + (profile.get("pallet_agv_count") or 0) + (profile.get("agv_count") or 0)
        if bool(profile.get("warehouse_area_m2") or profile.get("daily_orders")) and bool(total_agv):
            candidate_data = _smart_candidate_scene(profile, strategy, llm_guidance.get("deployment"))
        deployment_summary = f"按{strategy}策略部署 {total_agv or 8} 台 AGV"
        fit_explanation = f"匹配度：{(profile.get('daily_orders') or 3000)} 单/日"
        candidates.append({"id": f"{job.id[:8]}-{strategy}", "title": title, "strategy": strategy, "description": description, "template_id": template.id, "suitability": 75 + index * 8, "reasons": [*llm_guidance.get("reasons", []), deployment_summary, fit_explanation], "cautions": llm_guidance.get("cautions", []), "metrics": {"throughput": round(metrics["throughput"] * 100), "wait_seconds": metrics["wait_seconds"], "energy": round(metrics["energy"] * 100)}, "data": candidate_data})
    return {"job_id": job_id, "candidates": candidates}


@app.post(f"{PREFIX}/generation/candidates/{{candidate_id}}/apply", response_model=ScenarioRead, status_code=201, tags=["generation"])
def apply_generation_candidate(candidate_id: str, payload: GenerationCandidateApplyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScenarioRead:
    job = db.query(GenerationJob).filter(GenerationJob.user_id == user.id).order_by(GenerationJob.created_at.desc()).first()
    if not job:
        raise HTTPException(status_code=404, detail="未找到需求分析任务")
    candidate = next((c for c in (job.candidates or []) if isinstance(c, dict) and c.get("id") == candidate_id), None)
    data = (candidate or {}).get("data", {"components": [], "canvas": {"width": 1200, "height": 800, "scale": 1}, "schema_version": "1.0"})
    scenario = Scenario(project_id=payload.project_id, name=payload.name or f"{candidate.get('title', '方案')}场景", data=data)
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    job.selected_candidate_id = candidate_id
    job.scenario_id = scenario.id
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


def _requirement_profile(requirement: str, sources: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    text = requirement.lower()
    def n_after(patterns: list[str]) -> int | None:
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                return int(m.group(1))
        return None
    def has_words(words: list[str]) -> bool:
        return any(w in text for w in words)
    daily_orders = n_after([r"日均(\d+)", r"日处理(\d+)", r"日订单[量约]*(\d+)", r"daily.orders?[:\s]*(\d+)"])
    area = n_after([r"面积[约]*(\d+)", r"warehouse.area[:\s]*(\d+)"])
    agv_count = n_after([r"(\d+)\s*台\s*(?:agv|机器人|AMR)", r"agv[:_\s]*(\d+)", r"tote_agv_count[:\s]*(\d+)", r"pallet_agv_count[:\s]*(\d+)"])
    industry = next((name for name, words in {"冷链": ["冷链", "冷库", "温区", "冷藏", "冷冻"], "医药": ["医药", "药品", "gsp", "gdp", "制药"], "3C电子": ["3c", "电子", "数码"], "制造": ["制造", "托盘", "高位库", "整托"], "电商": ["电商", "电子商务", "快递", "包裹"]}.items() if has_words(words)), "通用")
    zones = [name for name, words in {"收货区": ["收货", "入库"], "存储区": ["存储", "货架", "高位"], "拣选区": ["拣选", "分拣"], "发货区": ["发货", "出库", "打包"], "充电区": ["充电"]}.items() if has_words(words)]
    flows = [name for name, words in {"入库": ["入库", "收货"], "拣选": ["拣选", "pick"], "出库": ["出库", "发货"], "打包": ["打包", "包装"]}.items() if has_words(words)]
    objectives = [name for name, words in {"高吞吐": ["高吞吐", "高效率", "产能"], "低能耗": ["低能耗", "节能", "省电"], "合规": ["合规", "gsp", "gdp", "批号"], "柔性": ["柔性", "弹性", "波峰", "大促"]}.items() if has_words(words)]
    profile = {"industry": industry, "warehouse_area_m2": area, "daily_orders": daily_orders, "peak_orders_per_hour": None, "sku_count": None, "tote_agv_count": agv_count if agv_count else None, "pallet_agv_count": None, "agv_count": agv_count, "robotic_arm_count": None, "pick_station_count": None, "charger_count": None, "zones": zones, "flows": flows, "objectives": objectives, "targets": {}, "mh_equipment": [], "storage_system": ""}
    return profile


def _smart_candidate_scene(profile: dict, strategy: str, deployment: dict | None = None) -> dict:
    import math
    w = profile.get("warehouse_area_m2") or 2000
    o = profile.get("daily_orders") or 2000
    agv = (profile.get("tote_agv_count") or 0) + (profile.get("pallet_agv_count") or 0) + (profile.get("agv_count") or 8)
    side = int(math.isqrt(int(w)))
    side = max(400, min(side, 3000))
    arms = profile.get("robotic_arm_count") or max(1, o // 2000)
    chargers = profile.get("charger_count") or max(2, agv // 4)
    stations_count = profile.get("pick_station_count") or max(2, o // 1000)
    components = []
    for i in range(min(agv, 20)):
        components.append({"id": f"agv-{i+1:03d}", "type": "agv", "name": f"AGV {i+1}", "x": 60 + (i % 5) * 50, "y": side - 80 - math.floor(i / 5) * 40, "width": 24, "height": 18, "rotation": 0, "properties": {"agv_type": "tote_amr", "color": "#3b82f6"}})
    shelves_count = max(4, o // 200)
    cols = max(4, int(math.isqrt(shelves_count * 3)))
    for i in range(min(shelves_count, 60)):
        row, col = divmod(i, cols)
        components.append({"id": f"shelf-{i+1:03d}", "type": "shelf", "name": f"Shelf {i+1}", "x": 80 + col * 70, "y": 60 + row * 60, "width": 55, "height": 45, "rotation": 0, "properties": {"levels": 3, "color": "#94a3b8"}})
    for i in range(min(stations_count, 6)):
        components.append({"id": f"station-{i+1:03d}", "type": "station", "name": f"{'拣选' if i % 2 == 0 else '打包'}工位 {i+1}", "x": side - 140, "y": 100 + i * 100, "width": 40, "height": 40, "rotation": 0, "properties": {"station_type": "pick" if i % 2 == 0 else "pack", "color": "#f59e0b"}})
    for i in range(min(chargers, 6)):
        components.append({"id": f"charger-{i+1:03d}", "type": "station", "name": f"充电桩 {i+1}", "x": side - 140, "y": side - 80 - i * 50, "width": 20, "height": 20, "rotation": 0, "properties": {"station_type": "charge", "color": "#22c55e"}})
    for i in range(min(arms, 4)):
        components.append({"id": f"arm-{i+1:03d}", "type": "arm", "name": f"机械臂 {i+1}", "x": 80 + i * 120, "y": side * 0.55, "width": 20, "height": 20, "rotation": 0, "properties": {"color": "#8b5cf6"}})
    return {"schema_version": "1.0", "canvas": {"width": side, "height": side, "scale": 1}, "components": components}


# ---- Search ---------------------------------------------------------------

@app.get(f"{PREFIX}/search", tags=["search"])
def global_search(q: str = "", user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict[str, str]]:
    keyword = q.strip().lower()
    if not keyword:
        return []
    results = []
    for project in db.query(Project).all():
        if keyword in project.name.lower() or keyword in (project.requirement or "").lower():
            results.append({"id": project.id, "type": "project", "title": project.name, "description": project.requirement or "无人仓项目", "url": f"/projects/{project.id}"})
    for scenario in db.query(Scenario).all():
        if keyword in scenario.name.lower():
            results.append({"id": scenario.id, "type": "scene", "title": scenario.name, "description": "可编辑的无人仓场景", "url": f"/editor?projectId={scenario.project_id}&scenarioId={scenario.id}"})
    for template in db.query(Template).all():
        if keyword in template.title.lower():
            results.append({"id": template.id, "type": "template", "title": template.title, "description": template.description, "url": "/resource"})
    return results[:50]


@app.get(f"{PREFIX}/search/advanced", tags=["search"])
def advanced_search(q: str = "", type: str = "all", page: int = 1, page_size: int = 10, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    results = global_search(q, user, db) if q else []
    if type != "all":
        results = [r for r in results if r.get("type") == type]
    total = len(results)
    start = (page - 1) * page_size
    return {"items": results[start:start + page_size], "total": total, "page": page, "page_size": page_size, "type_counts": {t: sum(1 for r in results if r.get("type") == t) for t in ["project", "scene", "template", "report"]}}


# ---- Dashboard ------------------------------------------------------------

@app.get(f"{PREFIX}/dashboard/kpis", tags=["dashboard"])
def dashboard_kpis(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    project_count = db.query(Project).join(ProjectMembership, ProjectMembership.project_id == Project.id).filter(ProjectMembership.user_id == user.id).count()
    scenario_count = db.query(Scenario).count()
    sim_count = db.query(SimulationRun).count()
    # SQLite-compatible: extract float from JSON text field
    avg_rate = 0.0
    for run in db.query(SimulationRun).filter(SimulationRun.status == "completed").all():
        rate = (run.metrics or {}).get("completion_rate")
        if rate is not None:
            avg_rate = (avg_rate or 0) + float(rate)
    if avg_rate and db.query(SimulationRun).filter(SimulationRun.status == "completed").count() > 0:
        avg_rate /= db.query(SimulationRun).filter(SimulationRun.status == "completed").count()
    return {"projects": project_count, "scenarios": scenario_count, "simulations": sim_count, "average_completion_rate": round(float(avg_rate), 2)}


# ---- Notifications --------------------------------------------------------



@app.websocket(f"{PREFIX}/notifications/stream")
async def stream_notifications(websocket: WebSocket, token: str | None = None) -> None:
    await websocket.accept()
    with SessionLocal() as db:
        stored = db.get(AuthToken, token) if token else None
        user = db.get(User, stored.user_id) if stored and stored.expires_at >= _utcnow() else None
    if user is None:
        await websocket.send_json({"type": "error", "message": "Authentication required"})
        await websocket.close(code=4401)
        return
    try:
        while True:
            with SessionLocal() as db:
                notes = db.query(Notification).filter(Notification.user_id == user.id, Notification.read.is_(False)).order_by(Notification.created_at.desc()).limit(10).all()
                total = db.query(Notification).filter(Notification.user_id == user.id).count()
                unread = db.query(Notification).filter(Notification.user_id == user.id, Notification.read.is_(False)).count()
                await websocket.send_json({"type": "notification_changed", "items": [{"id": n.id, "type": n.type, "title": n.title, "content": n.content, "target_url": n.target_url, "created_at": str(n.created_at)} for n in notes], "total": total, "unread": unread})
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                break
    except Exception:
        pass

@app.get(f"{PREFIX}/notifications", tags=["notifications"])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    items = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50).all()
    return [{"id": n.id, "type": n.type, "title": n.title, "content": n.content, "read": n.read, "target_url": n.target_url, "created_at": str(n.created_at)} for n in items]


@app.patch(f"{PREFIX}/notifications/{{notification_id}}/read", status_code=204, tags=["notifications"])
def mark_notification_read(notification_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if n:
        n.read = True
        db.commit()
    return Response(status_code=204)


@app.get(f"{PREFIX}/audit-logs", response_model=list[dict], tags=["audit"])
def list_audit_logs(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看审计日志")
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [{"id": log.id, "user_id": log.user_id, "action": log.action, "resource_type": log.resource_type, "resource_id": log.resource_id, "detail": log.detail, "created_at": str(log.created_at)} for log in logs]


# ---- Orchestration --------------------------------------------------------

@app.get(f"{PREFIX}/orchestration/agents", tags=["orchestration"])
def list_orchestration_agents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return [{"id": "agent-orch-1", "name": "规划决策体", "status": "ready", "type": "orch"}, {"id": "agent-orch-2", "name": "调度执行体", "status": "ready", "type": "orch"}]


# ---- Template events ------------------------------------------------------

@app.post(f"{PREFIX}/resource/templates/{{template_id}}/events", tags=["resource"])
def record_template_event(template_id: str, payload: TemplateEventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    db.add(TemplateEvent(template_id=template_id, user_id=user.id, event_type=payload.event_type))
    db.commit()
    return {"status": "ok"}
