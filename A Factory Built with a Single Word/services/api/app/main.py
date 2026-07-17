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
from app.simulation_engine import WarehouseSimulationEngine
from pydantic import BaseModel, Field, ValidationError
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
    status: Mapped[str] = mapped_column(String(32), default="draft")
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


class ScenarioVersion(Base):
    __tablename__ = "scenario_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    scenario_id: Mapped[str] = mapped_column(String(36), index=True)
    version: Mapped[int] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(120))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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
    model_config = {"extra": "forbid"}


class ScenarioComponent(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    type: Literal["shelf", "agv", "arm", "conveyor", "station", "charger", "obstacle"]
    name: str = Field(min_length=1, max_length=120)
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    rotation: float = 0
    properties: dict[str, Any] = Field(default_factory=dict)
    model_config = {"extra": "forbid"}


class ScenarioData(BaseModel):
    """第三周冻结的统一场景 JSON 结构。"""

    components: list[ScenarioComponent] = Field(default_factory=list)
    canvas: ScenarioCanvas = Field(default_factory=ScenarioCanvas)
    schema_version: Literal["1.0"] = "1.0"
    model_config = {"extra": "forbid"}


class TemplateDetailRead(TemplateRead):
    data: ScenarioData = Field(validation_alias="scenario")


class TemplateApplyCreate(BaseModel):
    project_id: str
    name: str | None = Field(default=None, min_length=1, max_length=120)


class ScenarioCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=120)
    data: ScenarioData = Field(default_factory=ScenarioData)


class ScenarioRead(ScenarioCreate):
    id: str
    version: int = Field(ge=1)
    updated_at: datetime


class ScenarioUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    data: ScenarioData
    expected_version: int | None = Field(default=None, ge=1)


class ScenarioValidationRequest(BaseModel):
    data: dict[str, Any]


class ScenarioValidationIssue(BaseModel):
    code: str
    message: str
    component_ids: list[str] = Field(default_factory=list)
    field: str | None = None


class ScenarioValidationRead(BaseModel):
    valid: bool
    errors: list[ScenarioValidationIssue] = Field(default_factory=list)
    warnings: list[ScenarioValidationIssue] = Field(default_factory=list)


class ScenarioAutoLayoutRequest(BaseModel):
    data: ScenarioData


class ScenarioAutoLayoutRead(BaseModel):
    data: ScenarioData
    validation: ScenarioValidationRead


class ScenarioVersionRead(BaseModel):
    id: str
    scenario_id: str
    version: int
    name: str
    data: ScenarioData
    created_at: datetime
    model_config = {"from_attributes": True}


class SimulationCreate(BaseModel):
    project_id: str
    scenario_id: str
    robot_count: int = Field(default=10, ge=1, le=100)
    order_count: int = Field(default=20, ge=1, le=1000)
    random_seed: int = Field(default=20260717, ge=0)


class SimulationRobotRead(BaseModel):
    id: str
    name: str
    state: str
    battery: float
    position: dict[str, float]
    path: list[dict[str, float]] = Field(default_factory=list)
    path_index: int = 0
    current_task_id: str | None = None
    completed_tasks: int = 0
    wait_ticks: int = 0


class SimulationTaskRead(BaseModel):
    id: str
    status: str
    priority: str
    pickup: dict[str, float]
    dropoff: dict[str, float]
    assigned_robot_id: str | None = None
    progress: int = 0


class SimulationEventRead(BaseModel):
    id: str
    type: str
    level: Literal["info", "warn", "error", "success"]
    time: str
    message: str
    source: str = "simulation"
    data: dict[str, Any] = Field(default_factory=dict)


class SimulationAgentRead(BaseModel):
    id: str
    name: str
    role: str
    status: str
    load: float
    latency: int
    successRate: float
    isPrimary: bool = False
    details: list[dict[str, Any]] = Field(default_factory=list)
    sparkline: list[float] = Field(default_factory=list)


class SimulationRead(BaseModel):
    id: str
    project_id: str
    scenario_id: str
    status: str
    config: dict[str, Any]
    metrics: dict[str, Any]
    events: list[SimulationEventRead]
    robots: list[SimulationRobotRead] = Field(default_factory=list)
    tasks: list[SimulationTaskRead] = Field(default_factory=list)
    sim_time: int = 0
    created_at: datetime


class SimulationControl(BaseModel):
    action: Literal["start", "pause", "stop"]


class AnomalyCreate(BaseModel):
    type: Literal["road_closed", "low_battery", "order_surge", "station_down"]
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

TEMPLATE_SCENARIOS: dict[str, dict[str, Any]] = {
    "tpl-1": {
        "schema_version": "1.0",
        "canvas": {"width": 1200, "height": 800, "scale": 1},
        "components": [
            {"id": "shelf-a1", "type": "shelf", "name": "A 区货架 01", "x": 180, "y": 180, "width": 240, "height": 80, "rotation": 0, "properties": {"zone": "A", "capacity": 200}},
            {"id": "shelf-a2", "type": "shelf", "name": "A 区货架 02", "x": 460, "y": 180, "width": 240, "height": 80, "rotation": 0, "properties": {"zone": "A", "capacity": 200}},
            {"id": "station-pick-1", "type": "station", "name": "拣选工作站 01", "x": 260, "y": 90, "width": 100, "height": 50, "rotation": 0, "properties": {"station_type": "pick"}},
            {"id": "charger-1", "type": "charger", "name": "充电桩 01", "x": 540, "y": 520, "width": 40, "height": 40, "rotation": 0, "properties": {}},
            {"id": "agv-1", "type": "agv", "name": "AGV-001", "x": 420, "y": 360, "width": 32, "height": 24, "rotation": 0, "properties": {"battery": 90}},
        ],
    },
    "tpl-2": {
        "schema_version": "1.0",
        "canvas": {"width": 1200, "height": 800, "scale": 1},
        "components": [
            {"id": "cold-shelf-1", "type": "shelf", "name": "冷藏区货架", "x": 160, "y": 180, "width": 240, "height": 80, "rotation": 0, "properties": {"zone": "cold", "temperature": "2-8°C"}},
            {"id": "frozen-shelf-1", "type": "shelf", "name": "冷冻区货架", "x": 650, "y": 180, "width": 240, "height": 80, "rotation": 0, "properties": {"zone": "frozen", "temperature": "-18°C"}},
            {"id": "cold-station-1", "type": "station", "name": "冷链复核台", "x": 470, "y": 90, "width": 110, "height": 50, "rotation": 0, "properties": {"station_type": "inspect"}},
            {"id": "cold-charger-1", "type": "charger", "name": "低温充电桩", "x": 540, "y": 520, "width": 40, "height": 40, "rotation": 0, "properties": {"temperature_protected": True}},
            {"id": "cold-agv-1", "type": "agv", "name": "冷链 AGV-001", "x": 500, "y": 360, "width": 32, "height": 24, "rotation": 0, "properties": {"battery": 88, "temperature_protected": True}},
        ],
    },
}

for default_template in DEFAULT_TEMPLATES:
    default_template["scenario"] = deepcopy(TEMPLATE_SCENARIOS.get(default_template["id"], {}))


def seed_templates(db: Session) -> None:
    """Insert or refresh built-in templates while preserving other records."""
    for template_data in DEFAULT_TEMPLATES:
        template = db.get(Template, template_data["id"])
        if template is None:
            db.add(Template(**deepcopy(template_data)))
            continue
        for field_name, value in template_data.items():
            setattr(template, field_name, deepcopy(value))
    db.commit()


def latest_scenario_version(db: Session, scenario_id: str) -> int:
    snapshot = (
        db.query(ScenarioVersion)
        .filter(ScenarioVersion.scenario_id == scenario_id)
        .order_by(ScenarioVersion.version.desc())
        .first()
    )
    return snapshot.version if snapshot else 1


def add_scenario_version(db: Session, scenario: Scenario, version: int) -> ScenarioVersion:
    snapshot = ScenarioVersion(
        scenario_id=scenario.id,
        version=version,
        name=scenario.name,
        data=deepcopy(scenario.data),
    )
    db.add(snapshot)
    return snapshot


def seed_scenario_versions(db: Session) -> None:
    """Create version 1 snapshots for scenarios created before Week 3."""
    for scenario in db.query(Scenario).all():
        exists = db.query(ScenarioVersion).filter(ScenarioVersion.scenario_id == scenario.id).first()
        if exists is None:
            add_scenario_version(db, scenario, 1)
    db.commit()


def scenario_to_read(scenario: Scenario, db: Session) -> ScenarioRead:
    return ScenarioRead(
        id=scenario.id,
        project_id=scenario.project_id,
        name=scenario.name,
        data=ScenarioData.model_validate(scenario.data),
        version=latest_scenario_version(db, scenario.id),
        updated_at=scenario.updated_at,
    )


class ScenarioService:
    """Validation and deterministic layout for editor scenarios."""

    @staticmethod
    def _schema_issues(error: ValidationError) -> list[ScenarioValidationIssue]:
        issues: list[ScenarioValidationIssue] = []
        for item in error.errors():
            field = ".".join(str(value) for value in item["loc"])
            issues.append(
                ScenarioValidationIssue(
                    code="SCHEMA_INVALID",
                    message=f"{field}: {item['msg']}",
                    field=field,
                )
            )
        return issues

    def validate_raw(self, raw_data: dict[str, Any]) -> tuple[ScenarioData | None, ScenarioValidationRead]:
        try:
            data = ScenarioData.model_validate(raw_data)
        except ValidationError as error:
            issues = self._schema_issues(error)
            return None, ScenarioValidationRead(valid=False, errors=issues)
        return data, self.validate(data)

    def validate(self, data: ScenarioData) -> ScenarioValidationRead:
        errors: list[ScenarioValidationIssue] = []
        warnings: list[ScenarioValidationIssue] = []
        seen_ids: set[str] = set()

        for component in data.components:
            if component.id in seen_ids:
                errors.append(
                    ScenarioValidationIssue(
                        code="DUPLICATE_COMPONENT_ID",
                        message=f"组件 ID {component.id} 重复",
                        component_ids=[component.id],
                        field="components.id",
                    )
                )
            seen_ids.add(component.id)

            if (
                component.x < 0
                or component.y < 0
                or component.x + component.width > data.canvas.width
                or component.y + component.height > data.canvas.height
            ):
                errors.append(
                    ScenarioValidationIssue(
                        code="OUT_OF_BOUNDS",
                        message=f"组件 {component.name} 超出画布边界",
                        component_ids=[component.id],
                        field="components.position",
                    )
                )

        for index, left in enumerate(data.components):
            for right in data.components[index + 1 :]:
                overlaps = (
                    left.x < right.x + right.width
                    and left.x + left.width > right.x
                    and left.y < right.y + right.height
                    and left.y + left.height > right.y
                )
                if overlaps:
                    errors.append(
                        ScenarioValidationIssue(
                            code="COMPONENT_OVERLAP",
                            message=f"组件 {left.name} 与 {right.name} 发生重叠",
                            component_ids=[left.id, right.id],
                            field="components.position",
                        )
                    )

        if not data.components:
            warnings.append(
                ScenarioValidationIssue(
                    code="EMPTY_SCENARIO",
                    message="场景中暂无组件",
                    field="components",
                )
            )

        return ScenarioValidationRead(valid=not errors, errors=errors, warnings=warnings)

    def auto_layout(self, data: ScenarioData) -> ScenarioAutoLayoutRead:
        padding = 24.0
        gap = 24.0
        cursor_x = padding
        cursor_y = padding
        row_height = 0.0
        laid_out: list[ScenarioComponent] = []

        for component in data.components:
            if component.width > data.canvas.width - padding * 2 or component.height > data.canvas.height - padding * 2:
                raise HTTPException(
                    status_code=422,
                    detail={"code": "LAYOUT_CANVAS_TOO_SMALL", "message": f"画布无法容纳组件 {component.name}"},
                )
            if cursor_x + component.width > data.canvas.width - padding:
                cursor_x = padding
                cursor_y += row_height + gap
                row_height = 0.0
            if cursor_y + component.height > data.canvas.height - padding:
                raise HTTPException(
                    status_code=422,
                    detail={"code": "LAYOUT_CANVAS_TOO_SMALL", "message": "画布高度不足，无法完成自动布局"},
                )

            laid_out.append(component.model_copy(update={"x": cursor_x, "y": cursor_y}))
            cursor_x += component.width + gap
            row_height = max(row_height, component.height)

        result = data.model_copy(update={"components": laid_out})
        validation = self.validate(result)
        if not validation.valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "SCENARIO_VALIDATION_FAILED",
                    "message": "自动布局后场景仍存在不可修复的校验错误",
                    "issues": [issue.model_dump() for issue in validation.errors],
                },
            )
        return ScenarioAutoLayoutRead(data=result, validation=validation)


scenario_service = ScenarioService()


class SimulationService:
    """Week 4 SimPy-backed service. Runtime state lives in config.runtime."""

    def __init__(self) -> None:
        self.engine = WarehouseSimulationEngine()

    def create(self, payload: SimulationCreate, scenario: Scenario) -> SimulationRun:
        scenario_data = ScenarioData.model_validate(scenario.data)
        chargers = [
            {"x": component.x + component.width / 2, "y": component.y + component.height / 2}
            for component in scenario_data.components if component.type == "charger"
        ]
        runtime = self.engine.create_state(
            payload.robot_count, payload.order_count, scenario_data.canvas.model_dump(), chargers, payload.random_seed,
        )
        created = self.engine.event(runtime, "simulation_created", "info", "已创建 10 AGV / 20 订单仿真" if payload.robot_count == 10 and payload.order_count == 20 else "已创建仿真")
        return SimulationRun(
            project_id=payload.project_id,
            scenario_id=payload.scenario_id,
            config={
                "robot_count": payload.robot_count, "order_count": payload.order_count,
                "random_seed": payload.random_seed, "engine_version": self.engine.version, "runtime": runtime,
            },
            metrics=self.engine.metrics(runtime),
            events=[created],
        )

    def runtime(self, run: SimulationRun) -> dict[str, Any]:
        runtime = (run.config or {}).get("runtime")
        if runtime:
            return runtime
        runtime = self.engine.create_state(
            int((run.config or {}).get("robot_count", 10)),
            int((run.config or {}).get("order_count", 20)),
        )
        run.config = {**(run.config or {}), "runtime": runtime, "engine_version": self.engine.version}
        return runtime

    def _persist(self, run: SimulationRun, runtime: dict[str, Any], events: list[dict[str, Any]] = []) -> None:
        run.config = {**(run.config or {}), "runtime": runtime, "order_count": len(runtime["tasks"])}
        run.metrics = self.engine.metrics(runtime)
        if events:
            run.events = [*(run.events or []), *events][-200:]

    def read(self, run: SimulationRun) -> SimulationRead:
        runtime = self.runtime(run)
        snapshot = self.engine.snapshot(runtime)
        public_config = {key: value for key, value in (run.config or {}).items() if key != "runtime"}
        return SimulationRead(
            id=run.id, project_id=run.project_id, scenario_id=run.scenario_id, status=run.status,
            config=public_config, metrics=snapshot["metrics"], events=run.events or [],
            robots=snapshot["robots"], tasks=snapshot["tasks"], sim_time=snapshot["sim_time"], created_at=run.created_at,
        )

    def control(self, run: SimulationRun, action: str) -> SimulationRun:
        runtime = self.runtime(run)
        if action == "start":
            if run.status == "finished":
                raise HTTPException(status_code=409, detail="Simulation is already finished; create a new run")
            if run.status == "stopped":
                runtime = self.engine.reset_state(runtime)
                self._persist(run, runtime, [self.engine.event(runtime, "simulation_reset", "info", "仿真已重置")])
            run.status = "running"
            self._persist(run, runtime, [self.engine.event(runtime, "simulation_started", "success", "仿真已启动")])
        elif action == "pause":
            if run.status != "running":
                raise HTTPException(status_code=409, detail="Only a running simulation can be paused")
            run.status = "paused"
            self._persist(run, runtime, [self.engine.event(runtime, "simulation_paused", "warn", "仿真已暂停")])
        else:
            run.status = "stopped"
            self._persist(run, runtime, [self.engine.event(runtime, "simulation_stopped", "info", "仿真已停止")])
        return run

    def add_anomaly(self, run: SimulationRun, anomaly_type: str, description: str) -> SimulationRun:
        if run.status != "running":
            raise HTTPException(status_code=409, detail="Start the simulation before injecting an anomaly")
        runtime = self.runtime(run)
        events = self.engine.apply_anomaly(runtime, anomaly_type, description)
        self._persist(run, runtime, events)
        return run

    def advance(self, run: SimulationRun) -> tuple[list[dict[str, Any]], bool]:
        runtime = self.runtime(run)
        events, completed = self.engine.advance(runtime)
        if completed:
            run.status = "finished"
        self._persist(run, runtime, events)
        return events, completed

    def agents(self, run: SimulationRun) -> list[SimulationAgentRead]:
        metrics = self.engine.metrics(self.runtime(run))
        status = "running" if run.status == "running" else "paused"
        return [
            SimulationAgentRead(id="agent-dispatch", name="总调度智能体", role="dispatch", status=status, load=round(metrics["robot_utilization"] * 100, 1), latency=120, successRate=99.1, isPrimary=True, details=[{"label": "已完成订单", "value": metrics["completed_orders"]}, {"label": "队列总量", "value": metrics["total_orders"]}], sparkline=[34, 42, 38, 46, 41, 44]),
            SimulationAgentRead(id="agent-navigation", name="导航智能体", role="navigation", status=status, load=round(min(100, metrics["congestion_count"] * 8 + 24), 1), latency=90, successRate=98.8, details=[{"label": "拥堵次数", "value": metrics["congestion_count"]}, {"label": "路径重规划", "value": len(self.runtime(run)["blocked_aisles"])}], sparkline=[21, 24, 28, 26, 31, 29]),
            SimulationAgentRead(id="agent-energy", name="能源智能体", role="energy", status=status, load=round(min(100, metrics["charging_count"] * 20 + 16), 1), latency=75, successRate=99.4, details=[{"label": "充电调度", "value": metrics["charging_count"]}, {"label": "能耗", "value": metrics["energy"], "unit": "kWh"}], sparkline=[14, 16, 19, 22, 18, 20]),
        ]


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
        seed_scenario_versions(db)
    yield


app = FastAPI(
    title="ICAN Unmanned Warehouse API",
    version="0.2.0",
    description="第 4 周后端与仿真契约：提供可恢复的 SimPy 运行态、实时事件流、异常注入与多智能体状态。",
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

@app.get("/api/templates/{template_id}", response_model=TemplateDetailRead, tags=["templates"], summary="Get template detail")
@app.get(f"{PREFIX}/templates/{{template_id}}", response_model=TemplateDetailRead, tags=["templates"], summary="Get template detail")
def get_template(template_id: str, db: Session = Depends(get_db)) -> Template:
    return get_or_404(Template, template_id, db, "Template")


@app.post("/api/templates/{template_id}/apply", response_model=ScenarioRead, status_code=status.HTTP_201_CREATED, tags=["templates"])
@app.post(f"{PREFIX}/templates/{{template_id}}/apply", response_model=ScenarioRead, status_code=status.HTTP_201_CREATED, tags=["templates"])
def apply_template(template_id: str, payload: TemplateApplyCreate, db: Session = Depends(get_db)) -> Scenario:
    template = get_or_404(Template, template_id, db, "Template")
    get_or_404(Project, payload.project_id, db, "Project")
    if template.category != "scene":
        raise HTTPException(status_code=400, detail="Only scene templates can be applied")

    data = ScenarioData.model_validate(deepcopy(template.scenario)).model_dump()
    scenario = Scenario(project_id=payload.project_id, name=payload.name or template.title, data=data)
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


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
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)) -> ScenarioRead:
    get_or_404(Project, payload.project_id, db, "Project")
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
    scenario = Scenario(**payload.model_dump())
    db.add(scenario)
    db.flush()
    add_scenario_version(db, scenario, 1)
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


@app.get(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead)
def get_scenario(scenario_id: str, db: Session = Depends(get_db)) -> ScenarioRead:
    scenario = get_or_404(Scenario, scenario_id, db, "Scenario")
    return scenario_to_read(scenario, db)


@app.post(f"{PREFIX}/scenarios/{{scenario_id}}/validate", response_model=ScenarioValidationRead)
def validate_scenario(
    scenario_id: str,
    payload: ScenarioValidationRequest,
    db: Session = Depends(get_db),
) -> ScenarioValidationRead:
    get_or_404(Scenario, scenario_id, db, "Scenario")
    _, validation = scenario_service.validate_raw(payload.data)
    return validation


@app.post(f"{PREFIX}/scenarios/{{scenario_id}}/auto-layout", response_model=ScenarioAutoLayoutRead)
def auto_layout_scenario(
    scenario_id: str,
    payload: ScenarioAutoLayoutRequest,
    db: Session = Depends(get_db),
) -> ScenarioAutoLayoutRead:
    get_or_404(Scenario, scenario_id, db, "Scenario")
    return scenario_service.auto_layout(payload.data)


@app.get(f"{PREFIX}/scenarios/{{scenario_id}}/versions", response_model=list[ScenarioVersionRead])
def list_scenario_versions(scenario_id: str, db: Session = Depends(get_db)) -> list[ScenarioVersion]:
    get_or_404(Scenario, scenario_id, db, "Scenario")
    return list(
        db.query(ScenarioVersion)
        .filter(ScenarioVersion.scenario_id == scenario_id)
        .order_by(ScenarioVersion.version.asc())
        .all()
    )


@app.put(f"{PREFIX}/scenarios/{{scenario_id}}", response_model=ScenarioRead)
def update_scenario(scenario_id: str, payload: ScenarioUpdate, db: Session = Depends(get_db)) -> ScenarioRead:
    scenario = get_or_404(Scenario, scenario_id, db, "Scenario")
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
    add_scenario_version(db, scenario, current_version + 1)
    db.commit()
    db.refresh(scenario)
    return scenario_to_read(scenario, db)


@app.post(f"{PREFIX}/simulations", response_model=SimulationRead, status_code=status.HTTP_201_CREATED)
def create_simulation(payload: SimulationCreate, db: Session = Depends(get_db)) -> SimulationRead:
    get_or_404(Project, payload.project_id, db, "Project")
    scenario = get_or_404(Scenario, payload.scenario_id, db, "Scenario")
    run = simulation_service.create(payload, scenario)
    db.add(run)
    db.commit()
    db.refresh(run)
    return simulation_service.read(run)


@app.get(f"{PREFIX}/simulations/{{simulation_id}}", response_model=SimulationRead)
def get_simulation(simulation_id: str, db: Session = Depends(get_db)) -> SimulationRead:
    return simulation_service.read(get_or_404(SimulationRun, simulation_id, db, "Simulation run"))


@app.post(f"{PREFIX}/simulations/{{simulation_id}}/control", response_model=SimulationRead)
def control_simulation(simulation_id: str, payload: SimulationControl, db: Session = Depends(get_db)) -> SimulationRead:
    run = simulation_service.control(get_or_404(SimulationRun, simulation_id, db, "Simulation run"), payload.action)
    db.commit()
    db.refresh(run)
    return simulation_service.read(run)


@app.post(f"{PREFIX}/simulations/{{simulation_id}}/anomalies", response_model=SimulationRead)
def inject_anomaly(simulation_id: str, payload: AnomalyCreate, db: Session = Depends(get_db)) -> SimulationRead:
    run = simulation_service.add_anomaly(get_or_404(SimulationRun, simulation_id, db, "Simulation run"), payload.type, payload.description)
    db.commit()
    db.refresh(run)
    return simulation_service.read(run)


@app.get(f"{PREFIX}/simulations/{{simulation_id}}/events", response_model=list[SimulationEventRead])
def list_simulation_events(simulation_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return list(get_or_404(SimulationRun, simulation_id, db, "Simulation run").events or [])


@app.get(f"{PREFIX}/simulations/{{simulation_id}}/agents", response_model=list[SimulationAgentRead])
def list_simulation_agents(simulation_id: str, db: Session = Depends(get_db)) -> list[SimulationAgentRead]:
    return simulation_service.agents(get_or_404(SimulationRun, simulation_id, db, "Simulation run"))


@app.websocket(f"{PREFIX}/simulations/{{simulation_id}}/stream")
async def stream_simulation(websocket: WebSocket, simulation_id: str) -> None:
    await websocket.accept()
    async def send_snapshot(run: SimulationRun) -> None:
        snapshot = simulation_service.read(run)
        await websocket.send_json({"type": "simulation_tick", "run_id": run.id, "time": snapshot.sim_time, "robots": [item.model_dump() for item in snapshot.robots], "tasks": [item.model_dump() for item in snapshot.tasks], "events": [item.model_dump() for item in snapshot.events[-10:]], "metrics": snapshot.metrics})

    try:
        with SessionLocal() as db:
            run = db.get(SimulationRun, simulation_id)
            if run is None:
                await websocket.send_json({"type": "error", "message": "Simulation run not found"})
                await websocket.close(code=1008)
                return
            await send_snapshot(run)
        while True:
            try:
                incoming = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
                if incoming.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                continue
            except asyncio.TimeoutError:
                pass
            with SessionLocal() as db:
                run = db.get(SimulationRun, simulation_id)
                if run is None:
                    await websocket.close(code=1008)
                    return
                events: list[dict[str, Any]] = []
                completed = False
                if run.status == "running":
                    events, completed = simulation_service.advance(run)
                    db.commit()
                    db.refresh(run)
                for event in events:
                    await websocket.send_json({"type": "simulation_event", "run_id": run.id, "event": event})
                await send_snapshot(run)
                if completed:
                    await websocket.send_json({"type": "simulation_completed", "run_id": run.id, "time": simulation_service.read(run).sim_time, "metrics": run.metrics})
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
