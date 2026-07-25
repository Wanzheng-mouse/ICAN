from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import secrets
import zipfile
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import Depends, Header, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import SessionLocal, get_db, new_id
from app.models import *
from app.schemas import *


def _utcnow() -> datetime:
    """Naive UTC now — compatible with SQLite-stored datetimes."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_or_404(model, item_id: str, db: Session, label: str):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return item


DEFAULT_PREFERENCES = {
    "theme": "system",
    "defaultPage": "/",
    "demoMode": False,
    "notifyAlert": True,
    "notifyTask": True,
    "notifyReport": True,
    "notifySystem": True,
}


def hash_password(password: str, salt: str | None = None) -> str:
    actual_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), actual_salt.encode(), 120_000)
    return f"{actual_salt}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt, expected = encoded.split("$", 1)
    except ValueError:
        return False
    actual = hash_password(password, salt).split("$", 1)[1]
    return secrets.compare_digest(actual, expected)


def user_to_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        name=user.name,
        email=user.email,
        department=user.department,
        role=user.role,
        avatar=user.avatar,
        preferences={**DEFAULT_PREFERENCES, **(user.preferences or {})},
    )


def issue_token(db: Session, user: User, remember: bool = False) -> str:
    token = secrets.token_urlsafe(48)
    expires_at = _utcnow() + timedelta(days=30 if remember else 1)
    db.add(AuthToken(token=token, user_id=user.id, expires_at=expires_at))
    db.commit()
    return token


def get_current_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    return authorization.removeprefix("Bearer ").strip()


def get_current_user(token: str = Depends(get_current_token), db: Session = Depends(get_db)) -> User:
    stored = db.get(AuthToken, token)
    if stored is None or stored.expires_at is None or stored.expires_at < _utcnow():
        if stored is not None:
            db.delete(stored)
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, stored.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_project_access(project_id: str, user: User, db: Session, *, write: bool = False) -> Project:
    project = get_or_404(Project, project_id, db, "Project")
    if user.role == "admin":
        return project
    membership = db.query(ProjectMembership).filter(
        ProjectMembership.project_id == project_id,
        ProjectMembership.user_id == user.id,
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="无权访问该项目")
    if write and (user.role == "viewer" or membership.role == "viewer"):
        raise HTTPException(status_code=403, detail="只读用户不能修改项目")
    return project


def require_project_owner(project_id: str, user: User, db: Session) -> Project:
    project = require_project_access(project_id, user, db, write=True)
    if user.role == "admin":
        return project
    membership = db.query(ProjectMembership).filter(
        ProjectMembership.project_id == project_id,
        ProjectMembership.user_id == user.id,
    ).first()
    if membership is None or membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only project owners can manage members")
    return project


def require_scenario_access(scenario_id: str, user: User, db: Session, *, write: bool = False) -> Scenario:
    scenario = get_or_404(Scenario, scenario_id, db, "Scenario")
    require_project_access(scenario.project_id, user, db, write=write)
    return scenario


def require_simulation_access(simulation_id: str, user: User, db: Session, *, write: bool = False) -> SimulationRun:
    run = get_or_404(SimulationRun, simulation_id, db, "Simulation run")
    require_project_access(run.project_id, user, db, write=write)
    return run


def require_evolution_access(evolution_id: str, user: User, db: Session) -> Evolution:
    evolution = get_or_404(Evolution, evolution_id, db, "Evolution")
    require_simulation_access(evolution.simulation_id, user, db)
    return evolution


def record_audit(
    db: Session,
    user: User,
    action: str,
    resource_type: str,
    resource_id: str,
    detail: dict[str, Any] | None = None,
) -> None:
    db.add(AuditLog(
        user_id=user.id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        detail=detail or {},
    ))


def get_idempotent_scenario(request_key: str | None, user: User, db: Session) -> Scenario | None:
    if not request_key:
        return None
    if len(request_key) > 128:
        raise HTTPException(status_code=400, detail="幂等键过长")
    previous = db.query(ScenarioRequestKey).filter(
        ScenarioRequestKey.user_id == user.id,
        ScenarioRequestKey.request_key == request_key,
    ).first()
    if not previous:
        return None
    scenario = db.get(Scenario, previous.scenario_id)
    if scenario:
        require_project_access(scenario.project_id, user, db)
    return scenario


def project_file_to_read(item: ProjectFile) -> ProjectFileRead:
    return ProjectFileRead(
        id=item.id,
        project_id=item.project_id,
        filename=item.filename,
        content_type=item.content_type,
        size=item.size,
        kind=item.kind,
        created_at=item.created_at,
        download_url=f"/api/v1/projects/{item.project_id}/files/{item.id}/download",
    )


def validate_project_file_content(extension: str, body: bytes) -> None:
    """Reject obvious extension/content mismatches before persisting project inputs."""
    try:
        if extension == ".json":
            json.loads(body.decode("utf-8-sig"))
        elif extension == ".csv":
            rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
            if not rows or not any(cell.strip() for row in rows for cell in row):
                raise ValueError("CSV 没有有效数据")
        elif extension in {".yaml", ".yml", ".txt", ".dxf"}:
            content = body.decode("utf-8-sig")
            if extension == ".dxf" and "SECTION" not in content.upper():
                raise ValueError("DXF 结构无效")
        elif extension == ".png" and not body.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("PNG 文件头无效")
        elif extension in {".jpg", ".jpeg"} and not body.startswith(b"\xff\xd8\xff"):
            raise ValueError("JPEG 文件头无效")
        elif extension == ".pdf" and not body.startswith(b"%PDF-"):
            raise ValueError("PDF 文件头无效")
        elif extension == ".xlsx":
            with zipfile.ZipFile(io.BytesIO(body)) as archive:
                if "[Content_Types].xml" not in archive.namelist():
                    raise ValueError("XLSX 结构无效")
        elif extension == ".xls" and not body.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
            raise ValueError("XLS 文件头无效")
        elif extension == ".dwg" and not body.startswith(b"AC"):
            raise ValueError("DWG 文件头无效")
    except (UnicodeDecodeError, json.JSONDecodeError, csv.Error, zipfile.BadZipFile, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"文件内容与 {extension} 格式不匹配") from exc


DEFAULT_TEMPLATES = [
    {"id": "tpl-1", "category": "scene", "title": "电商中型仓模板", "description": "适用于日均单量 1-5 万单的电商仓，覆盖高频拣选、打包与出库。", "cover": "ecom", "industry": "电商", "difficulty": "easy", "downloads": 1200, "views": 356, "updated_at": "2024-05-20", "quality_score": 86, "profile": {"industries": ["电商", "零售"], "daily_orders": [10000, 50000], "flows": ["拣选", "打包", "出库"], "device_types": ["agv", "station", "charger"]}},
    {"id": "tpl-2", "category": "scene", "title": "冷链双温区模板", "description": "双温区冷链仓库，支持温区隔离、复核工位和低温设备调度。", "cover": "coldchain", "industry": "冷链", "difficulty": "medium", "downloads": 987, "views": 298, "updated_at": "2024-05-18", "quality_score": 91, "profile": {"industries": ["冷链", "食品"], "daily_orders": [3000, 20000], "flows": ["入库", "复核", "出库"], "device_types": ["agv", "station", "charger"], "constraints": ["温区隔离"]}},
    {"id": "tpl-3", "category": "strategy", "title": "AGV 拥堵优化策略", "description": "基于路径重规划与分区调度的拥堵优化策略，提升通行效率。", "cover": "strategy", "industry": "通用", "difficulty": "medium", "downloads": 2300, "views": 512, "updated_at": "2024-05-15", "quality_score": 80, "profile": {"industries": ["通用"], "flows": ["调度", "拥堵优化"]}},
    {"id": "tpl-4", "category": "report", "title": "医药合规报告模板", "description": "符合 GSP/GDP 要求的合规报告模板，自动生成关键指标与审计日志。", "cover": "report", "industry": "医药", "difficulty": "hard", "downloads": 1100, "views": 277, "updated_at": "2024-05-12", "quality_score": 94, "profile": {"industries": ["医药", "制药"], "flows": ["复核", "追溯", "出库"], "constraints": ["合规", "隔离"]}},
    {"id": "tpl-5", "category": "scene", "title": "3C 高峰订单模板", "description": "面向高密度 SKU 与高峰订单的多拣选工位、分拣缓冲方案。", "cover": "3c", "industry": "3C", "difficulty": "hard", "downloads": 1412, "views": 421, "updated_at": "2026-07-17", "quality_score": 88, "profile": {"industries": ["3C", "电子", "数码"], "daily_orders": [20000, 80000], "flows": ["拣选", "分拣", "打包"], "device_types": ["agv", "station", "arm", "charger"]}},
    {"id": "tpl-6", "category": "scene", "title": "医药合规仓模板", "description": "适用于医药追溯、复核与受控出库流程，保留审计和隔离区域。", "cover": "medical", "industry": "医药", "difficulty": "hard", "downloads": 1100, "views": 277, "updated_at": "2026-07-16", "quality_score": 94, "profile": {"industries": ["医药", "制药"], "daily_orders": [1000, 15000], "flows": ["复核", "追溯", "出库"], "device_types": ["agv", "station", "charger"], "constraints": ["合规", "隔离"]}},
    {"id": "tpl-7", "category": "scene", "title": "托盘高位库模板", "description": "面向整托入出库的高位货架、缓冲区和托盘 AMR 作业方案。", "cover": "pallet", "industry": "制造", "difficulty": "medium", "downloads": 760, "views": 205, "updated_at": "2026-07-15", "quality_score": 82, "profile": {"industries": ["制造", "物流"], "daily_orders": [1000, 12000], "flows": ["入库", "上架", "出库"], "device_types": ["agv", "shelf", "charger"]}},
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
    "tpl-5": {
        "schema_version": "1.0", "canvas": {"width": 1400, "height": 900, "scale": 1},
        "components": [
            {"id": "3c-shelf-1", "type": "shelf", "name": "高密度货架 A", "x": 110, "y": 130, "width": 260, "height": 80, "rotation": 0, "properties": {"zone": "A", "capacity": 360}},
            {"id": "3c-shelf-2", "type": "shelf", "name": "高密度货架 B", "x": 110, "y": 260, "width": 260, "height": 80, "rotation": 0, "properties": {"zone": "B", "capacity": 360}},
            {"id": "3c-pick-1", "type": "station", "name": "拣选工位 01", "x": 850, "y": 150, "width": 100, "height": 60, "rotation": 0, "properties": {"station_type": "pick"}},
            {"id": "3c-sort-1", "type": "station", "name": "分拣工位 01", "x": 1050, "y": 280, "width": 100, "height": 60, "rotation": 0, "properties": {"station_type": "sort"}},
            {"id": "3c-arm-1", "type": "arm", "name": "分拣机械臂", "x": 970, "y": 400, "width": 70, "height": 70, "rotation": 0, "properties": {"reach": 180}},
            {"id": "3c-agv-1", "type": "agv", "name": "料箱 AMR 01", "x": 540, "y": 560, "width": 50, "height": 50, "rotation": 0, "properties": {"agv_type": "tote_amr", "battery": 90}},
            {"id": "3c-charger-1", "type": "charger", "name": "充电桩 01", "x": 1200, "y": 620, "width": 45, "height": 45, "rotation": 0, "properties": {"power": 500}},
        ],
    },
    "tpl-6": {
        "schema_version": "1.0", "canvas": {"width": 1200, "height": 800, "scale": 1},
        "components": [
            {"id": "med-shelf-1", "type": "shelf", "name": "受控货架", "x": 120, "y": 150, "width": 240, "height": 80, "rotation": 0, "properties": {"zone": "controlled", "traceable": True}},
            {"id": "med-inspect", "type": "station", "name": "医药复核台", "x": 630, "y": 160, "width": 120, "height": 60, "rotation": 0, "properties": {"station_type": "inspect"}},
            {"id": "med-pack", "type": "station", "name": "合规打包台", "x": 880, "y": 160, "width": 120, "height": 60, "rotation": 0, "properties": {"station_type": "pack"}},
            {"id": "med-agv", "type": "agv", "name": "追溯 AMR 01", "x": 460, "y": 470, "width": 50, "height": 50, "rotation": 0, "properties": {"agv_type": "tote_amr", "battery": 92}},
            {"id": "med-obstacle", "type": "obstacle", "name": "隔离区", "x": 130, "y": 390, "width": 200, "height": 100, "rotation": 0, "properties": {"restricted": True}},
            {"id": "med-charger", "type": "charger", "name": "充电桩 01", "x": 930, "y": 540, "width": 45, "height": 45, "rotation": 0, "properties": {"power": 500}},
        ],
    },
    "tpl-7": {
        "schema_version": "1.0", "canvas": {"width": 1500, "height": 900, "scale": 1},
        "components": [
            {"id": "pal-shelf-1", "type": "shelf", "name": "高位库 A", "x": 140, "y": 120, "width": 340, "height": 100, "rotation": 0, "properties": {"zone": "high-bay", "capacity": 500}},
            {"id": "pal-shelf-2", "type": "shelf", "name": "高位库 B", "x": 140, "y": 290, "width": 340, "height": 100, "rotation": 0, "properties": {"zone": "high-bay", "capacity": 500}},
            {"id": "pal-inbound", "type": "station", "name": "入库缓冲工位", "x": 780, "y": 160, "width": 120, "height": 70, "rotation": 0, "properties": {"station_type": "inbound"}},
            {"id": "pal-outbound", "type": "station", "name": "出库缓冲工位", "x": 1050, "y": 160, "width": 120, "height": 70, "rotation": 0, "properties": {"station_type": "outbound"}},
            {"id": "pal-agv", "type": "agv", "name": "托盘 AMR 01", "x": 600, "y": 590, "width": 60, "height": 60, "rotation": 0, "properties": {"agv_type": "pallet_amr", "battery": 88}},
            {"id": "pal-charge", "type": "charger", "name": "大功率充电桩", "x": 1200, "y": 630, "width": 50, "height": 50, "rotation": 0, "properties": {"power": 900}},
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


def seed_resources(db: Session) -> None:
    """Seed editable resource-center content once; endpoints always read the database."""
    if db.query(ResourceCase).count() == 0:
        db.add_all([
            ResourceCase(
                title="电商仓智能升级",
                description="AGV 与机械臂协同完成入库、拣选、打包和出库作业。",
                cover="ecom",
                industry="电商",
                metrics={"efficiency": "+32%", "manpower": "-40%", "roi": "14个月"},
            ),
            ResourceCase(
                title="冷链双温区改造",
                description="温区隔离、设备调度与能耗监测一体化。",
                cover="coldchain",
                industry="冷链",
                metrics={"energy": "-18%", "temperature": "±0.5℃"},
            ),
        ])
    if db.query(LearningResource).count() == 0:
        db.add_all([
            LearningResource(title="仓储建模基础", description="从布局、区域和设备参数开始创建场景。", progress=100, sort_order=10),
            LearningResource(title="AGV 调度入门", description="理解路径规划、交通管制和冲突处理。", progress=65, sort_order=20),
            LearningResource(title="仿真与进化决策", description="通过多轮仿真比较策略并应用优化方案。", progress=20, sort_order=30),
        ])
    # Keep the catalogue broad as the product evolves.  This is intentionally
    # idempotent so existing deployments receive new industry cases too.
    existing_case_titles = {row[0] for row in db.query(ResourceCase.title).all()}
    additional_cases = [
        ("\u533b\u836f\u51b7\u94fe\u5408\u89c4\u4ed3", "medical", "\u533b\u836f", {"audit": "+45%", "complaint": "-36%", "roi": "18\u4e2a\u6708"}),
        ("3C\u5907\u4ef6\u67d4\u6027\u5206\u9009\u4e2d\u5fc3", "3c", "3C", {"efficiency": "+27%", "manpower": "-28%", "roi": "12\u4e2a\u6708"}),
        ("\u5236\u9020\u4e1a\u7ebf\u8fb9\u4ed3\u534f\u540c\u914d\u9001", "manufacturing", "\u5236\u9020", {"efficiency": "+22%", "energy": "-15%", "roi": "16\u4e2a\u6708"}),
        ("\u5546\u8d85\u96f6\u552e\u591a\u6e29\u533a\u524d\u7f6e\u4ed3", "retail", "\u96f6\u552e", {"efficiency": "+19%", "manpower": "-25%", "roi": "15\u4e2a\u6708"}),
    ]
    for title, cover, industry, metrics in additional_cases:
        if title not in existing_case_titles:
            db.add(ResourceCase(
                title=title,
                description=f"{industry}\u884c\u4e1a\u7684\u5b9e\u4f53\u4ed3\u50a8\u4e1a\u52a1\u6d41\u7a0b\u4e0e\u8bbe\u5907\u534f\u540c\u6539\u9020\u6848\u4f8b\u3002",
                cover=cover,
                industry=industry,
                metrics=metrics,
            ))
    db.commit()


def seed_users(db: Session) -> None:
    defaults = [
        ("u-001", "admin", "Wanzheng", "admin@ican-platform.com", "技术部", "admin"),
        ("u-002", "zss", "ZhangSan", "operator@ican-platform.com", "运营部", "operator"),
        ("u-003", "lisi", "LiSi", "viewer@ican-platform.com", "质量部", "viewer"),
    ]
    for user_id, login_name, name, email, department, role in defaults:
        if db.get(User, user_id) is None:
            db.add(User(
                id=user_id,
                login_name=login_name,
                name=name,
                email=email,
                department=department,
                role=role,
                password_hash=hash_password("ican2026"),
                avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={name}",
                preferences=deepcopy(DEFAULT_PREFERENCES),
            ))
    db.commit()


def seed_notifications(db: Session) -> None:
    if db.query(Notification).first() is not None:
        return
    defaults = [
        ("alert", "拥堵告警：Aisle 08", "Aisle 08 拥堵等级升至高，建议启动分流策略。", "/simulation"),
        ("task", "方案生成完成", "无人仓方案已生成，可进入编辑器检查布局。", "/"),
        ("report", "运行报告已就绪", "最新仿真运行报告已经生成。", "/report"),
        ("system", "真实后端已连接", "当前页面数据由 FastAPI 与 SQLite 提供。", None),
    ]
    for user in db.query(User).all():
        for item_type, title, content, target_url in defaults:
            db.add(Notification(
                user_id=user.id,
                type=item_type,
                title=title,
                content=content,
                target_url=target_url,
            ))
    db.commit()


def seed_project_memberships(db: Session) -> None:
    admin = db.query(User).filter(User.role == "admin").first()
    if admin is None:
        return
    owned = {row[0] for row in db.query(ProjectMembership.project_id).all()}
    for project in db.query(Project).all():
        if project.id not in owned:
            db.add(ProjectMembership(project_id=project.id, user_id=admin.id, role="owner"))
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

    @staticmethod
    def migrate_schema(raw_data: dict[str, Any]) -> dict[str, Any]:
        """Upgrade known legacy scene payloads before strict validation.

        v0/editor-preview payloads used ``schemaVersion`` and ``items``. The
        migration is deliberately explicit so future v1 -> v2 transforms can
        be added without weakening ScenarioData's strict schema.
        """
        data = deepcopy(raw_data)
        version = str(data.get("schema_version") or data.pop("schemaVersion", "0"))
        if version in {"0", "0.9"}:
            if "components" not in data and isinstance(data.get("items"), list):
                data["components"] = data.pop("items")
            data.setdefault("canvas", {"width": 1200, "height": 800, "scale": 1})
            data["schema_version"] = "1.0"
        return data

    def validate_raw(self, raw_data: dict[str, Any]) -> tuple[ScenarioData | None, ScenarioValidationRead]:
        try:
            data = ScenarioData.model_validate(self.migrate_schema(raw_data))
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
