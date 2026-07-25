from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    requirement: str = ""


class ProjectRead(ProjectCreate):
    id: str
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    requirement: str | None = Field(default=None, max_length=5000)
    status: Literal["draft", "active", "archived"] | None = None


class ProjectMemberUpsert(BaseModel):
    identity: str = Field(min_length=1, max_length=160)
    role: Literal["operator", "viewer"] = "viewer"


class ProjectMemberRead(BaseModel):
    user_id: str
    login_name: str
    name: str
    email: str
    role: str


class ProjectFileRead(BaseModel):
    id: str
    project_id: str
    filename: str
    content_type: str
    size: int
    kind: str
    created_at: datetime
    download_url: str


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
    profile: dict[str, Any] = Field(default_factory=dict)
    quality_score: int = 60
    model_config = {"from_attributes": True}


class TemplateEventCreate(BaseModel):
    event_type: Literal["view", "preview", "apply", "download", "favorite"]
    project_id: str | None = None


class TemplateRecommendationRead(TemplateRead):
    match_score: int = Field(ge=0, le=100)
    reasons: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)


class RequirementSource(BaseModel):
    kind: Literal["floorplan", "orders", "robot", "rules", "other"]
    name: str = Field(min_length=1, max_length=255)


class RequirementAnalyzeCreate(BaseModel):
    requirement: str = Field(min_length=8, max_length=5000)
    project_id: str | None = None
    sources: list[RequirementSource] = Field(default_factory=list)


class RequirementAnalysisRead(BaseModel):
    job_id: str
    status: str
    summary: str = ""
    analysis_method: str = "agnes_structured_output"
    profile: dict[str, Any]
    assumptions: list[str]
    questions: list[str]
    risks: list[str]
    confidence: int = Field(ge=0, le=100)
    source_summary: list[str] = Field(default_factory=list)
    operational_design: dict[str, str] = Field(default_factory=dict)


class GenerationCandidateRead(BaseModel):
    id: str
    title: str
    strategy: str
    description: str
    template_id: str | None = None
    suitability: int = Field(ge=0, le=100)
    reasons: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    expected_metrics: dict[str, float] = Field(default_factory=dict)
    data: "ScenarioData"


class GenerationCandidatesRead(BaseModel):
    job_id: str
    status: str
    candidates: list[GenerationCandidateRead]


class GenerationCandidateApplyCreate(BaseModel):
    project_id: str
    name: str | None = Field(default=None, min_length=1, max_length=120)


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


GenerationCandidateRead.model_rebuild()


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


class ProjectWorkspaceRead(BaseModel):
    project: ProjectRead
    scenarios: list[ScenarioRead]
    files: list[ProjectFileRead]


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
    robot_count: int | None = Field(default=None, ge=1, le=100)
    order_count: int = Field(default=20, ge=1, le=1000)
    random_seed: int = Field(default=2026, ge=0, le=2_147_483_647)
    scenario_version: int | None = Field(default=None, ge=1)
    scenario_hash: str | None = Field(default=None, min_length=16, max_length=64)


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
    applied_scenario_id: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class EvolutionApplyRead(BaseModel):
    evolution_id: str
    project_id: str
    scenario: ScenarioRead
    changes: list[str]


class UserPreferences(BaseModel):
    theme: Literal["light", "dark", "system"] = "system"
    defaultPage: Literal["/", "/simulation", "/report"] = "/"
    demoMode: bool = False
    notifyAlert: bool = True
    notifyTask: bool = True
    notifyReport: bool = True
    notifySystem: bool = True


class UserPreferencesUpdate(BaseModel):
    theme: Literal["light", "dark", "system"] | None = None
    defaultPage: Literal["/", "/simulation", "/report"] | None = None
    demoMode: bool | None = None
    notifyAlert: bool | None = None
    notifyTask: bool | None = None
    notifyReport: bool | None = None
    notifySystem: bool | None = None


class UserRead(BaseModel):
    id: str
    name: str
    email: str
    department: str
    role: Literal["admin", "operator", "viewer"]
    avatar: str
    preferences: UserPreferences = Field(default_factory=UserPreferences)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=6, max_length=128)
    remember: bool = False


class RegisterRequest(BaseModel):
    loginName: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9_]{2,19}$")
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=160)
    department: str = Field(default="未设置", min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    remember: bool = True

    @field_validator("loginName")
    @classmethod
    def normalize_login_name(cls, value: str) -> str:
        return value.lower()

    @field_validator("name", "department")
    @classmethod
    def validate_non_blank_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("内容不能为空")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("密码必须同时包含字母和数字")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("邮箱格式不正确")
        return normalized


class AuthRead(BaseModel):
    token: str
    user: UserRead


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar: str | None = Field(default=None, max_length=3_000_000)
    department: str | None = Field(default=None, min_length=1, max_length=120)
    preferences: UserPreferencesUpdate | None = None


class PasswordChange(BaseModel):
    old_password: str = Field(min_length=6, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=160)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("邮箱格式不正确")
        return normalized


class PasswordResetRequestRead(BaseModel):
    message: str
    reset_token: str | None = None


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
