from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import JSON, DateTime, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


# ---- Configuration ---------------------------------------------------------
class Settings(BaseSettings):
    database_url: str = "sqlite:///./ican.db"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ICAN_", extra="ignore")

    @property
    def origin_list(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]


settings = Settings()


# ---- Persistence -----------------------------------------------------------
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def new_id() -> str:
    return str(uuid4())


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), index=True)
    requirement: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Template(Base):
    """A reusable scenario or resource template shown by the web application."""

    __tablename__ = "templates"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    cover: Mapped[str] = mapped_column(String(64), default="warehouse")
    industry: Mapped[str] = mapped_column(String(64), default="通用")
    difficulty: Mapped[str] = mapped_column(String(16), default="easy")
    downloads: Mapped[int] = mapped_column(default=0)
    views: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[str] = mapped_column(String(10))
    scenario: Mapped[dict] = mapped_column(JSON, default=dict)


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(120))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    scenario_id: Mapped[str] = mapped_column(String(36), index=True)
    status: Mapped[str] = mapped_column(String(32), default="created")
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    events: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Evolution(Base):
    __tablename__ = "evolutions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    simulation_id: Mapped[str] = mapped_column(String(36), index=True)
    diagnosis: Mapped[list] = mapped_column(JSON, default=list)
    baseline_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    optimized_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---- Contracts -------------------------------------------------------------
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    requirement: str = ""


class ProjectRead(ProjectCreate):
    id: str
    status: str
    owner: str = "demo-admin"
    created_at: datetime
    model_config = {"from_attributes": True}


class TemplateRead(BaseModel):
    id: str
    category: str
    title: str
    description: str
    cover: str
    industry: str
    difficulty: str
    downloads: int
    views: int
    updated_at: str = Field(serialization_alias="updatedAt")
    model_config = {"from_attributes": True}


class ScenarioCanvas(BaseModel):
    width: int = Field(default=1200, gt=0)
    height: int = Field(default=800, gt=0)
    scale: float = Field(default=1, gt=0)


class ScenarioData(BaseModel):
    """第 1 周冻结的场景 JSON 最小结构。"""

    components: list[Any] = Field(default_factory=list)
    canvas: ScenarioCanvas = Field(default_factory=ScenarioCanvas)
    schema_version: Literal["1.0"] = "1.0"


class ScenarioCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=120)
    data: ScenarioData = Field(default_factory=ScenarioData)


class ScenarioRead(ScenarioCreate):
    id: str
    updated_at: datetime
    model_config = {"from_attributes": True}


class ScenarioUpdate(BaseModel):
    name: str | None = None
    data: ScenarioData


class SimulationCreate(BaseModel):
    project_id: str
    scenario_id: str
    robot_count: int = Field(default=10, ge=1, le=100)
    order_count: int = Field(default=20, ge=1, le=1000)


class SimulationRead(BaseModel):
    id: str
    project_id: str
    scenario_id: str
    status: str
    config: dict[str, Any]
    metrics: dict[str, Any]
    events: list[dict[str, Any]]
    created_at: datetime
    model_config = {"from_attributes": True}


class SimulationControl(BaseModel):
    action: Literal["start", "pause", "stop"]


class AnomalyCreate(BaseModel):
    type: Literal["road_closed", "low_battery", "order_surge"]
    description: str = ""


class EvolutionCreate(BaseModel):
    simulation_id: str


class EvolutionRead(BaseModel):
    id: str
    simulation_id: str
    diagnosis: list[dict[str, Any]]
    baseline_metrics: dict[str, Any]
    optimized_metrics: dict[str, Any]
    created_at: datetime
    model_config = {"from_attributes": True}


# ---- Domain services -------------------------------------------------------
DEFAULT_TEMPLATES = [
    {"id": "tpl-1", "category": "scene", "title": "电商中型仓模板", "description": "适用于日均单量 1-5 万单的电商中型仓场景，含标准货架与设备配置。", "cover": "ecom", "industry": "电商", "difficulty": "easy", "downloads": 1200, "views": 356, "updated_at": "2024-05-20", "scenario": {"schema_version": "1.0", "canvas": {"width": 1200, "height": 800, "scale": 1}, "shelves": [], "stations": [], "charging_stations": [], "robots": [], "nodes": [], "edges": [], "restricted_areas": []}},
    {"id": "tpl-2", "category": "scene", "title": "冷链双温区模板", "description": "双温区冷链仓库场景，支持温区隔离、温控策略与专用设备配置。", "cover": "coldchain", "industry": "冷链", "difficulty": "medium", "downloads": 987, "views": 298, "updated_at": "2024-05-18", "scenario": {}},
    {"id": "tpl-3", "category": "strategy", "title": "AGV 拥堵优化策略", "description": "基于路径重规划与分区调度的拥堵优化策略，提升通行效率。", "cover": "strategy", "industry": "通用", "difficulty": "medium", "downloads": 2300, "views": 512, "updated_at": "2024-05-15", "scenario": {}},
    {"id": "tpl-4", "category": "report", "title": "医药合规报告模板", "description": "符合 GSP/GDP 要求的合规报告模板，自动生成关键指标与审计日志。", "cover": "report", "industry": "医药", "difficulty": "hard", "downloads": 1100, "views": 277, "updated_at": "2024-05-12", "scenario": {}},
]


def seed_templates(db: Session) -> None:
    """Insert the Week 1 templates once, without replacing user-managed records."""
    for template in DEFAULT_TEMPLATES:
        if db.get(Template, template["id"]) is None:
            db.add(Template(**template))
    db.commit()



class SimulationService:
    """Replace these deterministic calculations with SimPy and AGV algorithms later."""

    def create(self, payload: SimulationCreate) -> SimulationRun:
        return SimulationRun(
            project_id=payload.project_id,
            scenario_id=payload.scenario_id,
            config={"robot_count": payload.robot_count, "order_count": payload.order_count},
            metrics={"completion_rate": 0.0, "average_duration": 0.0, "congestion_count": 0, "energy": 0.0},
            events=[],
        )

    def tick(self, run: SimulationRun, elapsed: int) -> dict[str, Any]:
        robots = int(run.config["robot_count"])
        orders = int(run.config["order_count"])
        completion = min(1.0, round(elapsed * robots / max(orders * 10, 1), 2))
        return {
            "type": "simulation_tick", "run_id": run.id, "time": elapsed,
            "robots": [{"id": f"agv-{index + 1:02d}", "state": "working", "battery": max(20, 100 - elapsed)}
                       for index in range(robots)],
            "tasks": {"total": orders, "completed": round(orders * completion)},
            "events": run.events or [],
            "metrics": {
                "completion_rate": completion,
                "average_duration": round(120 - completion * 20, 1),
                "congestion_count": len(run.events or []),
                "energy": round(elapsed * robots * 0.12, 2),
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def control(self, run: SimulationRun, action: str) -> SimulationRun:
        run.status = {"start": "running", "pause": "paused", "stop": "stopped"}[action]
        if action == "start":
            run.metrics = self.tick(run, 10)["metrics"]
        return run

    def add_anomaly(self, run: SimulationRun, anomaly_type: str, description: str) -> SimulationRun:
        events = deepcopy(run.events or [])
        events.append({"type": anomaly_type, "description": description or anomaly_type, "severity": "warning"})
        run.events = events
        return run


class EvolutionService:
    def create(self, run: SimulationRun) -> Evolution:
        baseline = run.metrics or {}
        optimized = {
            "completion_rate": min(1.0, round(float(baseline.get("completion_rate", 0)) + 0.15, 2)),
            "average_duration": round(float(baseline.get("average_duration", 120)) * 0.85, 1),
            "congestion_count": max(0, int(baseline.get("congestion_count", 0)) - 1),
            "energy": round(float(baseline.get("energy", 0)) * 0.92, 2),
        }
        return Evolution(
            simulation_id=run.id,
            diagnosis=[
                {"type": "congestion", "message": "检测到通道拥堵风险，建议调整任务分配优先级。"},
                {"type": "energy", "message": "建议提前将低电量 AGV 导向充电桩。"},
            ],
            baseline_metrics=baseline,
            optimized_metrics=optimized,
        )


simulation_service = SimulationService()
evolution_service = EvolutionService()


# ---- HTTP and WebSocket interface -----------------------------------------
def get_or_404(model, item_id: str, db: Session, label: str):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return item


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_templates(db)
    yield


app = FastAPI(
    title="ICAN Unmanned Warehouse API",
    version="0.1.0",
    description="第 1 周后端契约：提供健康检查、模板、项目与场景接口；认证、搜索和通知仍由前端 Mock 提供。",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
PREFIX = "/api/v1"


@app.get("/health", tags=["system"], summary="Check API health")
@app.get("/api/health", tags=["system"], summary="Check API health")
@app.get(f"{PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ican-api"}


@app.get("/api/templates", response_model=list[TemplateRead], tags=["templates"], summary="List seeded templates")
@app.get(f"{PREFIX}/templates", response_model=list[TemplateRead], tags=["templates"], summary="List seeded templates")
def list_templates(category: str | None = None, db: Session = Depends(get_db)) -> list[Template]:
    query = db.query(Template)
    if category:
        query = query.filter(Template.category == category)
    return list(query.order_by(Template.id).all())

@app.get("/api/templates/{template_id}", response_model=TemplateRead, tags=["templates"], summary="Get template detail")
@app.get(f"{PREFIX}/templates/{{template_id}}", response_model=TemplateRead, tags=["templates"], summary="Get template detail")
def get_template(template_id: str, db: Session = Depends(get_db)) -> Template:
    return get_or_404(Template, template_id, db, "Template")

@app.post(f"{PREFIX}/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@app.get(f"{PREFIX}/projects", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    return list(db.query(Project).order_by(Project.created_at.desc()).all())


@app.get(f"{PREFIX}/projects/{{project_id}}", response_model=ProjectRead)
def get_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    return get_or_404(Project, project_id, db, "Project")
@app.post(f"{PREFIX}/scenarios", response_model=ScenarioRead, status_code=status.HTTP_201_CREATED)
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)) -> Scenario:
    get_or_404(Project, payload.project_id, db, "Project")
    scenario = Scenario(**payload.model_dump())
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@app.get(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead)
def get_scenario(scenario_id: str, db: Session = Depends(get_db)) -> Scenario:
    return get_or_404(Scenario, scenario_id, db, "Scenario")


@app.put(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead)
def update_scenario(scenario_id: str, payload: ScenarioUpdate, db: Session = Depends(get_db)) -> Scenario:
    scenario = get_or_404(Scenario, scenario_id, db, "Scenario")
    if payload.name is not None:
        scenario.name = payload.name
    scenario.data = payload.data.model_dump()
    db.commit()
    db.refresh(scenario)
    return scenario


@app.post(f"{PREFIX}/simulations", response_model=SimulationRead, status_code=status.HTTP_201_CREATED)
def create_simulation(payload: SimulationCreate, db: Session = Depends(get_db)) -> SimulationRun:
    get_or_404(Project, payload.project_id, db, "Project")
    get_or_404(Scenario, payload.scenario_id, db, "Scenario")
    run = simulation_service.create(payload)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@app.get(f"{PREFIX}/simulations/{{simulation_id}}", response_model=SimulationRead)
def get_simulation(simulation_id: str, db: Session = Depends(get_db)) -> SimulationRun:
    return get_or_404(SimulationRun, simulation_id, db, "Simulation run")


@app.post(f"{PREFIX}/simulations/{{simulation_id}}/control", response_model=SimulationRead)
def control_simulation(simulation_id: str, payload: SimulationControl, db: Session = Depends(get_db)) -> SimulationRun:
    run = simulation_service.control(get_or_404(SimulationRun, simulation_id, db, "Simulation run"), payload.action)
    db.commit()
    db.refresh(run)
    return run


@app.post(f"{PREFIX}/simulations/{{simulation_id}}/anomalies", response_model=SimulationRead)
def inject_anomaly(simulation_id: str, payload: AnomalyCreate, db: Session = Depends(get_db)) -> SimulationRun:
    run = simulation_service.add_anomaly(
        get_or_404(SimulationRun, simulation_id, db, "Simulation run"), payload.type, payload.description
    )
    db.commit()
    db.refresh(run)
    return run


@app.websocket(f"{PREFIX}/simulations/{{simulation_id}}/stream")
async def stream_simulation(websocket: WebSocket, simulation_id: str) -> None:
    await websocket.accept()
    elapsed = 0
    try:
        while True:
            with SessionLocal() as db:
                run = db.get(SimulationRun, simulation_id)
                if run is None:
                    await websocket.send_json({"type": "error", "message": "Simulation run not found"})
                    await websocket.close(code=1008)
                    return
                if run.status == "running":
                    elapsed += 1
                await websocket.send_json(simulation_service.tick(run, elapsed))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


@app.post(f"{PREFIX}/evolutions", response_model=EvolutionRead, status_code=status.HTTP_201_CREATED)
def create_evolution(payload: EvolutionCreate, db: Session = Depends(get_db)) -> Evolution:
    evolution = evolution_service.create(get_or_404(SimulationRun, payload.simulation_id, db, "Simulation run"))
    db.add(evolution)
    db.commit()
    db.refresh(evolution)
    return evolution


@app.get(f"{PREFIX}/evolutions/{{evolution_id}}", response_model=EvolutionRead)
def get_evolution(evolution_id: str, db: Session = Depends(get_db)) -> Evolution:
    return get_or_404(Evolution, evolution_id, db, "Evolution")


@app.get(f"{PREFIX}/reports/{{simulation_id}}/pdf")
def download_report(simulation_id: str, db: Session = Depends(get_db)) -> Response:
    run = get_or_404(SimulationRun, simulation_id, db, "Simulation run")
    body = f"ICAN Simulation Report\nStatus: {run.status}\nMetrics: {run.metrics}".encode("utf-8")
    return Response(
        body,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ican-report-{simulation_id}.pdf"'},
    )
