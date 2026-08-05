from __future__ import annotations

from typing import Any

from app.models import SimulationRun


def _escape(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_simulation_pdf(run: SimulationRun) -> bytes:
    """Build a vector PDF with KPI cards, a completion trend and robot/task facts."""
    metrics = run.metrics or {}
    config = run.config or {}
    history = list(config.get("metric_history", []))
    runtime = config.get("runtime_snapshot") or {}
    robots = runtime.get("robots", [])
    tasks = runtime.get("tasks", [])
    commands: list[str] = [
        "0.97 0.98 1 rg 0 0 612 792 re f",
        "0.05 0.12 0.26 rg 0 700 612 92 re f",
    ]

    def text(x: float, y: float, value: Any, size: int = 10, color: str = "0.12 0.18 0.3") -> None:
        commands.extend(
            [
                "BT",
                f"{color} rg",
                f"/F1 {size} Tf",
                f"{x} {y} Td",
                f"({_escape(value)}) Tj",
                "ET",
            ]
        )

    text(42, 752, "ICAN DIGITAL TWIN REPORT", 19, "1 1 1")
    text(
        42,
        726,
        f"Run {run.id}  |  Status {run.status}  |  Seed {config.get('random_seed', '-')}",
        9,
        "0.72 0.82 1",
    )

    cards = [
        (
            "Completion",
            f"{float(metrics.get('completion_rate', 0)) * 100:.1f}%",
            "0.16 0.43 0.95",
        ),
        (
            "Average duration",
            f"{float(metrics.get('average_duration', 0)):.1f}s",
            "0.04 0.65 0.5",
        ),
        ("Energy", f"{float(metrics.get('energy', 0)):.2f} kWh", "0.58 0.3 0.9"),
        ("Congestion", str(int(metrics.get("congestion_count", 0))), "0.95 0.55 0.08"),
    ]
    for index, (label, value, color) in enumerate(cards):
        x = 42 + index * 132
        commands.extend(["1 1 1 rg", f"{x} 626 120 58 re f", f"{color} rg", f"{x} 626 4 58 re f"])
        text(x + 12, 664, label, 8, "0.4 0.46 0.58")
        text(x + 12, 640, value, 15)

    text(42, 598, "Completion trend", 12)
    commands.extend(
        [
            "1 1 1 rg",
            "42 430 528 152 re f",
            "0.82 0.86 0.93 RG",
            "1 w",
            "58 454 m 554 454 l S",
            "58 454 m 58 562 l S",
        ]
    )
    points = history[-40:] if history else [{"completion_rate": metrics.get("completion_rate", 0)}]
    if points:
        width = 476 / max(len(points) - 1, 1)
        coords = [
            (58 + index * width, 454 + float(item.get("completion_rate", 0)) * 100)
            for index, item in enumerate(points)
        ]
        commands.extend(["0.16 0.43 0.95 RG", "2 w", f"{coords[0][0]:.1f} {coords[0][1]:.1f} m"])
        commands.extend(f"{x:.1f} {y:.1f} l" for x, y in coords[1:])
        commands.append("S")
    text(62, 438, "0%", 7, "0.45 0.5 0.62")
    text(62, 558, "100%", 7, "0.45 0.5 0.62")

    completed = sum(task.get("status") == "completed" for task in tasks)
    active = sum(task.get("status") == "active" for task in tasks)
    charging = sum(robot.get("state") == "charging" for robot in robots)
    loaded = sum(robot.get("load_status") == "loaded" for robot in robots)
    text(42, 397, "Runtime facts", 12)
    facts = [
        ("Robots", len(robots)),
        ("Charging", charging),
        ("Loaded", loaded),
        ("Tasks", len(tasks)),
        ("Active", active),
        ("Completed", completed),
        ("Collision avoided", int(metrics.get("collision_avoided", 0))),
    ]
    for index, (label, value) in enumerate(facts):
        y = 370 - index * 28
        text(48, y, label, 9, "0.35 0.42 0.54")
        text(180, y, value, 10)
        max_value = max(len(tasks), len(robots), 1)
        bar = min(300, 300 * float(value) / max_value)
        commands.extend(
            [
                "0.9 0.93 0.98 rg",
                f"230 {y - 2} 300 10 re f",
                "0.16 0.43 0.95 rg",
                f"230 {y - 2} {bar:.1f} 10 re f",
            ]
        )

    text(
        42,
        66,
        "Generated from persisted simulation snapshots. Metrics are reproducible with the recorded seed and strategy.",
        8,
        "0.4 0.46 0.58",
    )
    stream = "\n".join(commands).encode("latin-1", errors="replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    document = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(document))
        document.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(document)
    document.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        document.extend(f"{offset:010d} 00000 n \n".encode())
    document.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    )
    return bytes(document)


# ---------------------------------------------------------------------------
# Structured report data builders
#
# The web Report page consumes a richer contract (`KpiCardData`,
# `ReportTrendPoint`, `ReportAnomalyBucket`, `ReportSceneRanking`,
# `FulfillmentDay`, `DeviceUsage`) than the original `/kpis` / `/trend` /
# `/device-usages` endpoints returned.  These builders derive every field the
# frontend expects from the run's persisted metrics, metric history and the
# hydrated runtime snapshot, so the report page renders real data instead of
# empty/broken widgets.  They take a *hydrated* `SimulationRun` (metrics and
# config already attached) and contain no DB or auth dependencies, which keeps
# them trivially unit-testable.
# ---------------------------------------------------------------------------


def _metrics(run: SimulationRun) -> dict[str, Any]:
    return run.metrics or {}


def _runtime(run: SimulationRun) -> dict[str, Any]:
    return (run.config or {}).get("runtime_snapshot") or {}


def build_kpis(run: SimulationRun) -> list[dict[str, Any]]:
    """Six KPI cards matching the frontend `KpiCardData` contract."""
    metrics = _metrics(run)
    tasks = _runtime(run).get("tasks", [])
    completed_orders = sum(1 for t in tasks if t.get("status") == "completed")
    completion_rate = float(metrics.get("completion_rate", 0.0))
    avg_duration = float(metrics.get("average_duration", 0.0))
    energy = float(metrics.get("energy", 0.0))
    congestion = int(metrics.get("congestion_count", 0))
    device_util = float(metrics.get("device_utilization", 0.0))
    return [
        {
            "title": "完成率",
            "value": f"{completion_rate * 100:.1f}",
            "unit": "%",
            "trend": "up",
            "iconColor": "#3b82f6",
            "delta": round(completion_rate * 100, 1),
            "deltaLabel": "订单完成占比",
        },
        {
            "title": "平均时长",
            "value": f"{avg_duration:.1f}",
            "unit": "s",
            "iconColor": "#22c55e",
        },
        {
            "title": "完成订单",
            "value": completed_orders,
            "iconColor": "#0ea5e9",
        },
        {
            "title": "能耗",
            "value": f"{energy:.2f}",
            "unit": "kWh",
            "iconColor": "#a855f7",
        },
        {
            "title": "拥堵次数",
            "value": congestion,
            "iconColor": "#f59e0b",
        },
        {
            "title": "设备利用率",
            "value": f"{device_util * 100:.1f}",
            "unit": "%",
            "iconColor": "#14b8a6",
        },
    ]


def build_trend(run: SimulationRun) -> list[dict[str, Any]]:
    """Per-tick trend: completion rate, congestion rate and energy."""
    config = run.config or {}
    history = list(config.get("metric_history", []))
    points: list[dict[str, Any]] = []
    for index, entry in enumerate(history):
        completion = float(entry.get("completion_rate", 0.0)) * 100
        energy = float(entry.get("energy", 0.0))
        completed = int(entry.get("completed_orders", 0))
        congestion = int(entry.get("congestion_count", 0))
        congestion_rate = (
            round(min(100.0, congestion / max(completed, 1) * 100.0), 1) if completed else 0.0
        )
        points.append(
            {
                "date": f"T+{entry.get('time', index)}",
                "completionRate": round(completion, 1),
                "congestionRate": congestion_rate,
                "energy": round(energy, 3),
            }
        )
    if not points:
        metrics = _metrics(run)
        points.append(
            {
                "date": "T+0",
                "completionRate": round(float(metrics.get("completion_rate", 0.0)) * 100, 1),
                "congestionRate": 0.0,
                "energy": round(float(metrics.get("energy", 0.0)), 3),
            }
        )
    return points


def build_device_usages(run: SimulationRun) -> list[dict[str, Any]]:
    """Per-AGV utilization, mileage, task count and faults."""
    robots = _runtime(run).get("robots", [])
    usages: list[dict[str, Any]] = []
    for robot in robots:
        active = float(robot.get("active_seconds", 0.0))
        idle = float(robot.get("idle_seconds", 0.0))
        charging = float(robot.get("charging_seconds", 0.0))
        total = active + idle + charging
        utilization = round(active / total * 100.0, 1) if total > 0 else 0.0
        mileage = round(float(robot.get("distance", 0.0)) / 1000.0, 2)  # meters -> km
        usages.append(
            {
                "deviceId": robot.get("id"),
                "type": "AGV",
                "utilization": utilization,
                "mileage": mileage,
                "tasks": int(robot.get("completed_tasks", 0)),
                "faults": 0,
            }
        )
    return usages


def build_anomalies(run: SimulationRun) -> list[dict[str, Any]]:
    """Bucket congestion / collision-avoidance / long-wait signals into the
    anomaly pie chart.  These are real run signals, not fabricated numbers."""
    metrics = _metrics(run)
    tasks = _runtime(run).get("tasks", [])
    congestion = int(metrics.get("congestion_count", 0))
    collisions = int(metrics.get("collision_avoided", 0))
    long_wait = sum(1 for t in tasks if float(t.get("waiting_seconds", 0.0)) > 20.0)
    raw = [
        {"type": "拥堵", "count": congestion, "color": "#f59e0b"},
        {"type": "碰撞规避", "count": collisions, "color": "#3b82f6"},
        {"type": "长时等待", "count": long_wait, "color": "#ef4444"},
    ]
    total = sum(b["count"] for b in raw) or 1
    for bucket in raw:
        bucket["percent"] = round(bucket["count"] / total * 100.0, 1)
    return raw


def build_anomaly_total(run: SimulationRun) -> int:
    return sum(int(b["count"]) for b in build_anomalies(run))


def build_scene_rankings(run: SimulationRun) -> list[dict[str, Any]]:
    """Single-scene ranking row derived from the run's overall metrics.

    A simulation run covers one scenario, so there is nothing to rank against;
    we surface the current scenario's headline metrics as the top (and only)
    row so the ranking table is populated rather than empty.
    """
    metrics = _metrics(run)
    completed = int(metrics.get("completed_orders", 0))
    congestion = int(metrics.get("congestion_count", 0))
    congestion_rate = (
        round(min(100.0, congestion / max(completed, 1) * 100.0), 1) if completed else 0.0
    )
    return [
        {
            "rank": 1,
            "scene": "当前仿真场景",
            "completionRate": round(float(metrics.get("completion_rate", 0.0)) * 100, 1),
            "congestionRate": congestion_rate,
            "energy": round(float(metrics.get("energy", 0.0)), 2),
        }
    ]


def build_fulfillment(run: SimulationRun) -> list[dict[str, Any]]:
    """On-time / delayed / unfinished order breakdown for the fulfillment chart."""
    metrics = _metrics(run)
    tasks = _runtime(run).get("tasks", [])
    avg_duration = float(metrics.get("average_duration", 0.0)) or 0.0
    completed = [t for t in tasks if t.get("status") == "completed"]
    if avg_duration > 0:
        on_time = sum(
            1
            for t in completed
            if (float(t.get("completed_at") or 0) - float(t.get("started_at") or 0)) <= avg_duration
        )
    else:
        on_time = len(completed)
    delayed = len(completed) - on_time
    unfinished = sum(1 for t in tasks if t.get("status") != "completed")
    return [
        {
            "date": "运行周期",
            "onTime": on_time,
            "delayed": delayed,
            "unfinished": unfinished,
            "fulfillmentRate": round(float(metrics.get("completion_rate", 0.0)) * 100, 1),
        }
    ]
