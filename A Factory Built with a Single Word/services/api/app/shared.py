"""Shared helpers and singletons used across API route handlers.

Extracted from ``app/main.py`` during the phase-2 router split (M4/M5) so that
route modules can import them without creating an import cycle with ``app.main``.
Nothing here changes request/response behaviour — these are verbatim moves.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any

from app.domain import ScenarioService

# API route prefix — must match the value previously hard-coded in main.py.
PREFIX = "/api/v1"

# Shared logger name (identical to the one main.py used).
logger = logging.getLogger("ican.api")

# Single scenario-service instance (stateless validator / auto-layout helper).
scenario_service = ScenarioService()


def _utcnow() -> datetime:
    """Naive UTC now — compatible with SQLite-stored datetimes."""
    return datetime.now(UTC).replace(tzinfo=None)


def _create_scenario_data(component_count: int, area: int) -> dict[str, Any]:
    import math

    components: list[dict[str, Any]] = []
    units = max(1, math.ceil(math.sqrt(component_count)))
    spacing_x = area / units
    spacing_y = area / units
    for index in range(component_count):
        row = index // units
        col = index % units
        shelf_id = f"shelf-{index + 1:03d}"
        components.append(
            {
                "id": shelf_id,
                "type": "shelf",
                "name": f"Shelf {index + 1}",
                "x": 30 + col * spacing_x,
                "y": 30 + row * spacing_y,
                "width": spacing_x - 10,
                "height": spacing_y - 10,
                "rotation": 0,
                "properties": {"levels": 3, "color": "#94a3b8"},
            }
        )
    return {
        "schema_version": "1.0",
        "canvas": {"width": area + 60, "height": area + 60, "scale": 1},
        "components": components,
    }


def _requirement_profile(
    requirement: str, sources: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    text = requirement.lower()

    def n_after(patterns: list[str]) -> int | None:
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                return int(m.group(1))
        return None

    def has_words(words: list[str]) -> bool:
        return any(w in text for w in words)

    daily_orders = n_after(
        [r"日均(\d+)", r"日处理(\d+)", r"日订单[量约]*(\d+)", r"daily.orders?[:\s]*(\d+)"]
    )
    area = n_after([r"面积[约]*(\d+)", r"warehouse.area[:\s]*(\d+)"])
    agv_count = n_after(
        [
            r"(\d+)\s*台\s*(?:agv|机器人|AMR)",
            r"agv[:_\s]*(\d+)",
            r"tote_agv_count[:\s]*(\d+)",
            r"pallet_agv_count[:\s]*(\d+)",
        ]
    )
    industry = next(
        (
            name
            for name, words in {
                "冷链": ["冷链", "冷库", "温区", "冷藏", "冷冻"],
                "医药": ["医药", "药品", "gsp", "gdp", "制药"],
                "3C电子": ["3c", "电子", "数码"],
                "制造": ["制造", "托盘", "高位库", "整托"],
                "电商": ["电商", "电子商务", "快递", "包裹"],
            }.items()
            if has_words(words)
        ),
        "通用",
    )
    zones = [
        name
        for name, words in {
            "收货区": ["收货", "入库"],
            "存储区": ["存储", "货架", "高位"],
            "拣选区": ["拣选", "分拣"],
            "发货区": ["发货", "出库", "打包"],
            "充电区": ["充电"],
        }.items()
        if has_words(words)
    ]
    flows = [
        name
        for name, words in {
            "入库": ["入库", "收货"],
            "拣选": ["拣选", "pick"],
            "出库": ["出库", "发货"],
            "打包": ["打包", "包装"],
        }.items()
        if has_words(words)
    ]
    objectives = [
        name
        for name, words in {
            "高吞吐": ["高吞吐", "高效率", "产能"],
            "低能耗": ["低能耗", "节能", "省电"],
            "合规": ["合规", "gsp", "gdp", "批号"],
            "柔性": ["柔性", "弹性", "波峰", "大促"],
        }.items()
        if has_words(words)
    ]
    profile = {
        "industry": industry,
        "warehouse_area_m2": area,
        "daily_orders": daily_orders,
        "peak_orders_per_hour": None,
        "sku_count": None,
        "tote_agv_count": agv_count if agv_count else None,
        "pallet_agv_count": None,
        "agv_count": agv_count,
        "robotic_arm_count": None,
        "pick_station_count": None,
        "charger_count": None,
        "zones": zones,
        "flows": flows,
        "objectives": objectives,
        "targets": {},
        "mh_equipment": [],
        "storage_system": "",
    }
    return profile


def _smart_candidate_scene(profile: dict, strategy: str, deployment: dict | None = None) -> dict:
    import math

    w = profile.get("warehouse_area_m2") or 2000
    o = profile.get("daily_orders") or 2000
    agv = (
        (profile.get("tote_agv_count") or 0)
        + (profile.get("pallet_agv_count") or 0)
        + (profile.get("agv_count") or 8)
    )
    side = math.isqrt(int(w))
    side = max(400, min(side, 3000))
    arms = profile.get("robotic_arm_count") or max(1, o // 2000)
    chargers = profile.get("charger_count") or max(2, agv // 4)
    stations_count = profile.get("pick_station_count") or max(2, o // 1000)
    components = []
    for i in range(min(agv, 20)):
        components.append(
            {
                "id": f"agv-{i + 1:03d}",
                "type": "agv",
                "name": f"AGV {i + 1}",
                "x": 60 + (i % 5) * 50,
                "y": side - 80 - math.floor(i / 5) * 40,
                "width": 24,
                "height": 18,
                "rotation": 0,
                "properties": {"agv_type": "tote_amr", "color": "#3b82f6"},
            }
        )
    shelves_count = max(4, o // 200)
    cols = max(4, math.isqrt(shelves_count * 3))
    for i in range(min(shelves_count, 60)):
        row, col = divmod(i, cols)
        components.append(
            {
                "id": f"shelf-{i + 1:03d}",
                "type": "shelf",
                "name": f"Shelf {i + 1}",
                "x": 80 + col * 70,
                "y": 60 + row * 60,
                "width": 55,
                "height": 45,
                "rotation": 0,
                "properties": {"levels": 3, "color": "#94a3b8"},
            }
        )
    for i in range(min(stations_count, 6)):
        components.append(
            {
                "id": f"station-{i + 1:03d}",
                "type": "station",
                "name": f"{'拣选' if i % 2 == 0 else '打包'}工位 {i + 1}",
                "x": side - 140,
                "y": 100 + i * 100,
                "width": 40,
                "height": 40,
                "rotation": 0,
                "properties": {
                    "station_type": "pick" if i % 2 == 0 else "pack",
                    "color": "#f59e0b",
                },
            }
        )
    for i in range(min(chargers, 6)):
        components.append(
            {
                "id": f"charger-{i + 1:03d}",
                "type": "station",
                "name": f"充电桩 {i + 1}",
                "x": side - 140,
                "y": side - 80 - i * 50,
                "width": 20,
                "height": 20,
                "rotation": 0,
                "properties": {"station_type": "charge", "color": "#22c55e"},
            }
        )
    for i in range(min(arms, 4)):
        components.append(
            {
                "id": f"arm-{i + 1:03d}",
                "type": "arm",
                "name": f"机械臂 {i + 1}",
                "x": 80 + i * 120,
                "y": side * 0.55,
                "width": 20,
                "height": 20,
                "rotation": 0,
                "properties": {"color": "#8b5cf6"},
            }
        )
    return {
        "schema_version": "1.0",
        "canvas": {"width": side, "height": side, "scale": 1},
        "components": components,
    }
