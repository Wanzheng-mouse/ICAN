"""Agnes Chat Completions integration for semantic warehouse analysis."""
from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import Settings

SYSTEM_PROMPT = """你是资深无人仓自动化方案架构师。请严谨分析用户的中文或英文仓储需求，只输出符合要求的 JSON，不要 Markdown 或解释性前后缀。

重要：所有 string 类型的字段必须用中文书写，包括 summary、industry、zones、flows、objectives、assumptions、questions、risks、traffic_policy、collision_policy、charging_policy、workflow_summary、title、description、reasons、cautions、layout_focus，全部使用简体中文。

事实抽取规则：
1. 必须逐项提取用户明确给出的数值；不可因字段名不同而遗漏。例如"6000平方米"写入 warehouse_area_m2=6000，"每日8000单"写入 daily_orders=8000，"高峰每小时1200单"写入 peak_orders_per_hour=1200，"SKU约3000种"写入 sku_count=3000。
2. "12台料箱AGV"必须写 tote_agv_count=12；"4台托盘AGV"必须写 pallet_agv_count=4；agv_count 是已知两种 AGV 的数量之和。机械臂、拣选工位、充电桩同样逐项填入对应数字字段。
3. 只有用户确实未提供事实时才用 null。事实充足且关键字段都明确的需求，confidence 必须在 85 到 100 之间；只有几乎没有可提取信息时才允许低于 30，不能为 0。
4. zones、flows 和 objectives 只列出用户明确提出的内容；不得虚构设备数量、面积、吞吐或 KPI。
5. candidate_guidance 必须恰好包含三项，strategy 按顺序且唯一为 balanced、throughput、energy_saver；每项要基于已提取的业务事实给出不同理由和注意项。每项 deployment 必须给出可执行的设备增减建议和货架拓扑：所有 delta 只能在 -2 到 4，storage_rows 为 1 到 4，layout_focus 描述该方案如何布置路线、工位和充电区。不能只重复三种策略的套话。
6. operational_design 必须给出可实施的单向路网、路段/节点预约避碰、低电量阈值充电和入库到出库作业链建议。

在给出最终 JSON 前自行核对：每个明确数字均已进入 profile；三种策略没有重复；所有字段完整。"""

# Kept deliberately explicit so the response can be accepted only when it has
# the business facts and three actionable strategy alternatives we need.
ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "confidence": {"type": "integer", "minimum": 0, "maximum": 100},
        "profile": {
            "type": "object", "additionalProperties": False,
            "properties": {
                "industry": {"type": ["string", "null"]}, "warehouse_area_m2": {"type": ["integer", "null"]},
                "daily_orders": {"type": ["integer", "null"]}, "peak_orders_per_hour": {"type": ["integer", "null"]},
                "sku_count": {"type": ["integer", "null"]}, "tote_agv_count": {"type": ["integer", "null"]},
                "pallet_agv_count": {"type": ["integer", "null"]}, "agv_count": {"type": ["integer", "null"]},
                "robotic_arm_count": {"type": ["integer", "null"]}, "pick_station_count": {"type": ["integer", "null"]},
                "charger_count": {"type": ["integer", "null"]},
                "zones": {"type": "array", "items": {"type": "string"}},
                "flows": {"type": "array", "items": {"type": "string"}},
                "objectives": {"type": "array", "items": {"type": "string"}},
                "targets": {"type": "object", "additionalProperties": False, "properties": {
                    "order_completion_rate": {"type": ["integer", "null"]}, "average_wait_seconds": {"type": ["integer", "null"]}, "device_utilization_rate": {"type": ["integer", "null"]}},
                    "required": ["order_completion_rate", "average_wait_seconds", "device_utilization_rate"]},
            },
            "required": ["industry", "warehouse_area_m2", "daily_orders", "peak_orders_per_hour", "sku_count", "tote_agv_count", "pallet_agv_count", "agv_count", "robotic_arm_count", "pick_station_count", "charger_count", "zones", "flows", "objectives", "targets"],
        },
        "assumptions": {"type": "array", "items": {"type": "string"}}, "questions": {"type": "array", "items": {"type": "string"}}, "risks": {"type": "array", "items": {"type": "string"}},
        "operational_design": {"type": "object", "additionalProperties": False, "properties": {
            "traffic_policy": {"type": "string"}, "collision_policy": {"type": "string"}, "charging_policy": {"type": "string"}, "workflow_summary": {"type": "string"}},
            "required": ["traffic_policy", "collision_policy", "charging_policy", "workflow_summary"]},
        "candidate_guidance": {"type": "array", "minItems": 3, "maxItems": 3, "items": {"type": "object", "additionalProperties": False, "properties": {
            "strategy": {"type": "string", "enum": ["balanced", "throughput", "energy_saver"]}, "title": {"type": "string"}, "description": {"type": "string"},
            "reasons": {"type": "array", "items": {"type": "string"}}, "cautions": {"type": "array", "items": {"type": "string"}},
            "deployment": {"type": "object", "additionalProperties": False, "properties": {
                "tote_agv_delta": {"type": "integer", "minimum": -2, "maximum": 4}, "pallet_agv_delta": {"type": "integer", "minimum": -2, "maximum": 3},
                "pick_station_delta": {"type": "integer", "minimum": -2, "maximum": 3}, "pack_station_delta": {"type": "integer", "minimum": -1, "maximum": 3},
                "arm_delta": {"type": "integer", "minimum": -1, "maximum": 3}, "charger_delta": {"type": "integer", "minimum": -1, "maximum": 3},
                "storage_rows": {"type": "integer", "minimum": 1, "maximum": 4}, "layout_focus": {"type": "string"}},
                "required": ["tote_agv_delta", "pallet_agv_delta", "pick_station_delta", "pack_station_delta", "arm_delta", "charger_delta", "storage_rows", "layout_focus"]}},
            "required": ["strategy", "title", "description", "reasons", "cautions", "deployment"]}},
    },
    "required": ["summary", "confidence", "profile", "assumptions", "questions", "risks", "operational_design", "candidate_guidance"],
}


def _output_text(response: dict[str, Any]) -> str:
    """Read the first Chat Completions message without leaking provider details."""
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("missing assistant message") from exc
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") for item in content
            if isinstance(item, dict) and isinstance(item.get("text"), str)
        )
    raise ValueError("assistant message is not text")


def _calibrated_confidence(profile: dict[str, Any], sources: list[dict[str, Any]]) -> int:
    """Calibrate UI confidence from fields the model actually extracted.

    The LLM performs semantic extraction; this guard prevents an inconsistent
    model self-score (for example `0` alongside a complete profile) from being
    presented to users as a meaningful confidence value.
    """
    factual_fields = (
        "warehouse_area_m2", "daily_orders", "peak_orders_per_hour", "sku_count",
        "tote_agv_count", "pallet_agv_count", "robotic_arm_count",
        "pick_station_count", "charger_count",
    )
    extracted = sum(profile.get(field) is not None for field in factual_fields)
    contextual = sum(bool(profile.get(field)) for field in ("zones", "flows", "objectives"))
    return min(95, 20 + extracted * 7 + contextual * 4 + min(len(sources), 3) * 3)


def analyze_with_agnes(requirement: str, sources: list[dict[str, Any]], settings: Settings) -> dict[str, Any]:
    """Use Agnes' Chat Completions-compatible endpoint for server-side analysis."""
    if not settings.agnes_api_key:
        raise HTTPException(status_code=503, detail="LLM_ANALYSIS_NOT_CONFIGURED: set ICAN_AGNES_API_KEY in services/api/.env and restart the backend.")
    files = "\n".join(f"- {item.get('kind', 'file')}: {item.get('name', 'unnamed')}" for item in sources) or "- no uploaded files"
    body = {
        "model": settings.llm_model,
        "temperature": 0.1,
        "max_tokens": settings.llm_max_tokens,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"用户需求：\n{requirement}\n\n上传文件（元信息）：\n{files}"},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "warehouse_requirement_analysis", "strict": True, "schema": ANALYSIS_SCHEMA},
        },
    }
    try:
        response = httpx.post(
            f"{settings.agnes_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.agnes_api_key}", "Content-Type": "application/json"},
            json=body,
            timeout=settings.agnes_request_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"LLM_ANALYSIS_UPSTREAM_UNAVAILABLE: {exc}") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"LLM_ANALYSIS_UPSTREAM_ERROR: {response.status_code} {response.text[:300]}")
    response_data = response.json()
    finish_reason = (
        response_data.get("choices", [{}])[0].get("finish_reason")
        if isinstance(response_data.get("choices"), list) and response_data.get("choices")
        else None
    )
    if finish_reason == "length":
        raise HTTPException(status_code=502, detail="LLM_ANALYSIS_OUTPUT_TRUNCATED: increase ICAN_LLM_MAX_TOKENS or request a shorter response.")
    try:
        result = json.loads(_output_text(response_data))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="LLM_ANALYSIS_INVALID_STRUCTURED_OUTPUT") from exc
    if not isinstance(result, dict) or not isinstance(result.get("profile"), dict):
        raise HTTPException(status_code=502, detail="LLM_ANALYSIS_SCHEMA_VALIDATION_FAILED")
    strategies = [item.get("strategy") for item in result.get("candidate_guidance", []) if isinstance(item, dict)]
    if strategies != ["balanced", "throughput", "energy_saver"]:
        raise HTTPException(status_code=502, detail="LLM_ANALYSIS_SCHEMA_VALIDATION_FAILED: candidate strategies must be balanced, throughput, energy_saver in order.")
    result["confidence"] = _calibrated_confidence(result["profile"], sources)
    return result
