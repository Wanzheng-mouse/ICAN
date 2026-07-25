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
        commands.extend(["BT", f"{color} rg", f"/F1 {size} Tf", f"{x} {y} Td", f"({_escape(value)}) Tj", "ET"])

    text(42, 752, "ICAN DIGITAL TWIN REPORT", 19, "1 1 1")
    text(42, 726, f"Run {run.id}  |  Status {run.status}  |  Seed {config.get('random_seed', '-')}", 9, "0.72 0.82 1")

    cards = [
        ("Completion", f"{float(metrics.get('completion_rate', 0)) * 100:.1f}%", "0.16 0.43 0.95"),
        ("Average duration", f"{float(metrics.get('average_duration', 0)):.1f}s", "0.04 0.65 0.5"),
        ("Energy", f"{float(metrics.get('energy', 0)):.2f} kWh", "0.58 0.3 0.9"),
        ("Congestion", str(int(metrics.get('congestion_count', 0))), "0.95 0.55 0.08"),
    ]
    for index, (label, value, color) in enumerate(cards):
        x = 42 + index * 132
        commands.extend(["1 1 1 rg", f"{x} 626 120 58 re f", f"{color} rg", f"{x} 626 4 58 re f"])
        text(x + 12, 664, label, 8, "0.4 0.46 0.58")
        text(x + 12, 640, value, 15)

    text(42, 598, "Completion trend", 12)
    commands.extend(["1 1 1 rg", "42 430 528 152 re f", "0.82 0.86 0.93 RG", "1 w", "58 454 m 554 454 l S", "58 454 m 58 562 l S"])
    points = history[-40:] if history else [{"completion_rate": metrics.get("completion_rate", 0)}]
    if points:
        width = 476 / max(len(points) - 1, 1)
        coords = [(58 + index * width, 454 + float(item.get("completion_rate", 0)) * 100) for index, item in enumerate(points)]
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
        ("Robots", len(robots)), ("Charging", charging), ("Loaded", loaded),
        ("Tasks", len(tasks)), ("Active", active), ("Completed", completed),
        ("Collision avoided", int(metrics.get("collision_avoided", 0))),
    ]
    for index, (label, value) in enumerate(facts):
        y = 370 - index * 28
        text(48, y, label, 9, "0.35 0.42 0.54")
        text(180, y, value, 10)
        max_value = max(len(tasks), len(robots), 1)
        bar = min(300, 300 * float(value) / max_value)
        commands.extend(["0.9 0.93 0.98 rg", f"230 {y - 2} 300 10 re f", "0.16 0.43 0.95 rg", f"230 {y - 2} {bar:.1f} 10 re f"])

    text(42, 66, "Generated from persisted simulation snapshots. Metrics are reproducible with the recorded seed and strategy.", 8, "0.4 0.46 0.58")
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
    document.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(document)
