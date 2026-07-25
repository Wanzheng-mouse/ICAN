from __future__ import annotations

import hashlib
import heapq
import json
import math
import random
from copy import deepcopy
from datetime import datetime, timezone
from statistics import mean
from typing import Any

from app.models import Evolution, SimulationRun


STATIONS = {
    "inbound": {"x": 150.0, "y": 500.0},
    "storage": {"x": 430.0, "y": 260.0},
    "pick": {"x": 650.0, "y": 500.0},
    "pack": {"x": 850.0, "y": 650.0},
    "outbound": {"x": 1050.0, "y": 500.0},
    "charge": {"x": 240.0, "y": 820.0},
}

STRATEGIES: dict[str, dict[str, float]] = {
    "balanced": {"speed": 1.55, "distance_weight": 1.0, "battery_weight": 2.0, "charge_threshold": 18},
    "throughput": {"speed": 1.85, "distance_weight": 1.3, "battery_weight": 0.8, "charge_threshold": 14},
    "energy_saver": {"speed": 1.3, "distance_weight": 1.5, "battery_weight": 2.5, "charge_threshold": 24},
    "congestion_aware": {"speed": 1.45, "distance_weight": 0.9, "battery_weight": 1.8, "charge_threshold": 20},
}


def _distance(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _route(
    start: dict[str, float], end: dict[str, float], lane: int,
    stations: dict[str, dict[str, float]], use_berth: bool = True,
    navigation: dict[str, Any] | None = None,
) -> list[dict[str, float]]:
    """Build an obstacle-aware route, falling back to separated Manhattan lanes."""
    if navigation:
        planned = _astar_route(start, end, navigation)
        if planned:
            return planned
    # Keep navigation lanes inside the actual service corridor immediately
    # before the pick/pack work area.  Fixed legacy y-values made routes cross
    # racks whenever a user generated a larger or differently shaped scene.
    service_y = min(
        float(stations.get("pick", {}).get("y", 650.0)),
        float(stations.get("pack", {}).get("y", 650.0)),
    )
    # Six explicitly separated lanes: 0-2 are pickup/return lanes and 3-5
    # are loaded delivery lanes.  Opposing AGVs therefore never share a
    # centreline, rather than relying on a last-moment collision stop.
    lane_y = max(60.0, service_y - 180.0) + (lane % 6) * 38.0
    origin = {"x": float(start["x"]), "y": float(start["y"])}
    # Each directed lane has its own berth at a shared station.  This prevents
    # several completed routes from collapsing onto precisely the same pose.
    destination = {"x": float(end["x"]) + (((lane % 3) - 1) * 24.0 if use_berth else 0.0), "y": float(end["y"])}
    # Stations use a lateral exit segment. Incoming robots queue on the vertical
    # approach, while the active robot can leave without meeting them head-on.
    at_station = any(_distance(origin, station) < 1.0 for station in stations.values())
    if at_station:
        escape_x = origin["x"] + (-60.0 if origin["x"] > 900 else 60.0)
        points = [
            origin,
            {"x": escape_x, "y": origin["y"]},
            {"x": escape_x, "y": lane_y},
            {"x": destination["x"], "y": lane_y},
            destination,
        ]
    else:
        points = [
            origin,
            {"x": origin["x"], "y": lane_y},
            {"x": destination["x"], "y": lane_y},
            destination,
        ]
    result: list[dict[str, float]] = []
    for point in points:
        if not result or _distance(result[-1], point) > 0.1:
            result.append(point)
    return result


def _astar_route(start: dict[str, float], end: dict[str, float], navigation: dict[str, Any]) -> list[dict[str, float]]:
    """Plan a collision-free grid path around scene components.

    Start and destination cells remain traversable so AGVs can leave parking
    bays and enter workstations.  Shelf/obstacle rectangles are expanded by
    the AGV safety radius before graph search.
    """
    width = max(120.0, float(navigation.get("width", 1200)))
    height = max(120.0, float(navigation.get("height", 800)))
    step = max(24.0, float(navigation.get("grid_size", 40)))
    clearance = max(12.0, float(navigation.get("clearance", 26)))
    cols, rows = max(2, int(width // step) + 1), max(2, int(height // step) + 1)

    def cell(point: dict[str, float]) -> tuple[int, int]:
        return (
            max(0, min(cols - 1, round(float(point["x"]) / step))),
            max(0, min(rows - 1, round(float(point["y"]) / step))),
        )

    origin, target = cell(start), cell(end)
    obstacles = navigation.get("obstacles", [])

    def blocked(node: tuple[int, int]) -> bool:
        if node in {origin, target}:
            return False
        x, y = node[0] * step, node[1] * step
        return any(
            float(item.get("x", 0)) - clearance <= x <= float(item.get("x", 0)) + float(item.get("w", 0)) + clearance
            and float(item.get("y", 0)) - clearance <= y <= float(item.get("y", 0)) + float(item.get("h", 0)) + clearance
            for item in obstacles
        )

    frontier: list[tuple[float, int, tuple[int, int]]] = [(0.0, 0, origin)]
    came_from: dict[tuple[int, int], tuple[int, int] | None] = {origin: None}
    cost: dict[tuple[int, int], float] = {origin: 0.0}
    serial = 0
    while frontier:
        _, _, current = heapq.heappop(frontier)
        if current == target:
            break
        for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            nxt = current[0] + dx, current[1] + dy
            if not (0 <= nxt[0] < cols and 0 <= nxt[1] < rows) or blocked(nxt):
                continue
            next_cost = cost[current] + 1
            if next_cost >= cost.get(nxt, float("inf")):
                continue
            cost[nxt] = next_cost
            came_from[nxt] = current
            serial += 1
            heuristic = abs(target[0] - nxt[0]) + abs(target[1] - nxt[1])
            heapq.heappush(frontier, (next_cost + heuristic, serial, nxt))
    if target not in came_from:
        return []
    nodes: list[tuple[int, int]] = []
    current: tuple[int, int] | None = target
    while current is not None:
        nodes.append(current)
        current = came_from[current]
    nodes.reverse()
    points = [{"x": float(start["x"]), "y": float(start["y"])}]
    # Collapse collinear grid nodes, reducing route payload and rendering work.
    for index, node in enumerate(nodes[1:-1], 1):
        previous, following = nodes[index - 1], nodes[index + 1]
        if (previous[0] == node[0] == following[0]) or (previous[1] == node[1] == following[1]):
            continue
        points.append({"x": node[0] * step, "y": node[1] * step})
    points.append({"x": float(end["x"]), "y": float(end["y"])})
    return points


def _initial_runtime(
    robot_count: int,
    order_count: int,
    seed: int,
    agv_positions: list[dict[str, float]] | None = None,
    stations: dict[str, dict[str, float]] | None = None,
    station_pools: dict[str, list[dict[str, float]]] | None = None,
    navigation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the initial runtime state.

    When *agv_positions* is provided (from a saved scenario), robots are placed
    at those coordinates instead of the legacy fixed grid.  This is the key
    change that makes the simulation engine honour editor-placed AGVs.
    """
    rng = random.Random(seed)
    robots = []
    for index in range(robot_count):
        if agv_positions and index < len(agv_positions):
            home = {
                "x": float(agv_positions[index].get("x", 165.0)),
                "y": float(agv_positions[index].get("y", 820.0)),
            }
        else:
            home = {"x": 165.0 + (index % 5) * 58.0, "y": 820.0 + (index // 5) * 54.0}
        robots.append(
            {
                "id": f"agv-{index + 1:02d}",
                "state": "idle",
                "battery": float(82 + rng.randint(0, 18)),
                "x": home["x"],
                "y": home["y"],
                "heading": 0.0,
                "home": home,
                "route": [home],
                "target_index": 0,
                "task_id": None,
                "load_status": "empty",
                "remaining": 0.0,
                "distance": 0.0,
                "energy": 0.0,
                "completed_tasks": 0,
                "waiting_seconds": 0.0,
                "blocked_streak": 0.0,
                "active_seconds": 0.0,
                "charging_seconds": 0.0,
                "idle_seconds": 0.0,
                "lane": index,
                "route_lane": index % 3,
                "type": str(agv_positions[index].get("type", "tote_amr")) if agv_positions and index < len(agv_positions) else "tote_amr",
            }
        )
    tasks = []
    cargos = []
    for index in range(order_count):
        inbound = index % 3 == 0
        task_id = f"TASK-{index + 1:04d}"
        cargo_id = f"CARGO-{index + 1:04d}"
        tasks.append(
            {
                "id": task_id,
                "kind": "inbound" if inbound else "outbound",
                "source": "inbound" if inbound else "storage",
                "destination": "storage" if inbound else "outbound",
                "priority": rng.randint(1, 5),
                "weight": rng.randint(8, 45),
                "status": "pending",
                "assigned_robot": None,
                "created_at": 0,
                "started_at": None,
                "completed_at": None,
                "waiting_seconds": 0,
                "cargo_id": cargo_id,
            }
        )
        cargos.append({
            "id": cargo_id,
            "order_id": f"ORDER-{index + 1:04d}",
            "sku": f"SKU-{1000 + index % 80:04d}",
            "type": "pallet" if inbound else "tote",
            "quantity": 1 + index % 4,
            "weight": round(2.5 + (index % 12) * 1.4, 1),
            "status": "receiving" if inbound else "on_shelf",
            "location_id": "inbound" if inbound else "storage",
            "task_id": task_id,
        })
    return {
        "version": 2,
        "time": 0,
        "robots": robots,
        "tasks": tasks,
        "cargos": cargos,
        "congestion_count": 0,
        "collision_avoided": 0,
        "blocked_until": 0,
        "last_elapsed": 0,
        "stations": stations or deepcopy(STATIONS),
        "station_pools": station_pools or {role: [deepcopy(position)] for role, position in (stations or STATIONS).items()},
        "navigation": navigation or {},
    }


class SimulationService:
    """Persistent discrete-event warehouse runtime used by HTTP and WebSocket."""

    def create(self, payload: Any, scenario_data: dict | None = None, scenario_version: int | None = None) -> SimulationRun:
        """Create a simulation run.

        When *scenario_data* is provided, robot_count and AGV home positions are
        derived from the saved scene components.  This ensures the simulation
        engine uses the exact same devices the editor saw.

        The full scenario snapshot (data + version + content hash) is stored in
        ``run.config`` so historical runs are always reproducible.
        """
        agv_positions: list[dict[str, float]] = []
        scene_robot_count: int | None = None
        scene_stations: dict[str, dict[str, float]] | None = None
        scene_station_pools: dict[str, list[dict[str, float]]] | None = None
        scene_navigation: dict[str, Any] | None = None
        scene_strategy = "balanced"
        scene_strategy_parameters: dict[str, float] | None = None

        if scenario_data and isinstance(scenario_data, dict):
            components = scenario_data.get("components", [])
            canvas = scenario_data.get("canvas", {}) if isinstance(scenario_data.get("canvas"), dict) else {}
            canvas_width = float(canvas.get("width", 1200))
            canvas_height = float(canvas.get("height", 1000))
            # Keep the standard workflow roles, but relocate every role that
            # was explicitly placed in the editor. This makes routing use the
            # saved scene rather than the legacy fixed factory coordinates.
            scene_stations = deepcopy(STATIONS)
            scene_station_pools = {role: [] for role in STATIONS}
            scene_stations["inbound"] = {"x": 45.0, "y": canvas_height / 2}
            scene_stations["outbound"] = {"x": canvas_width - 45.0, "y": canvas_height / 2}
            scene_navigation = {"width": canvas_width, "height": canvas_height, "grid_size": 40, "clearance": 26, "obstacles": []}
            # Extract AGV components → positions + count
            for comp in components:
                x = float(comp.get("x", 0))
                y = float(comp.get("y", 0))
                width = float(comp.get("width", 0))
                height = float(comp.get("height", 0))
                center = {"x": x + width / 2, "y": y + height / 2}
                if comp.get("type") == "agv":
                    properties = comp.get("properties") or {}
                    scene_strategy = str(properties.get("optimized_strategy", scene_strategy))
                    if isinstance(properties.get("evolution_parameters"), dict):
                        scene_strategy_parameters = {key: float(value) for key, value in properties["evolution_parameters"].items() if key in {"speed", "distance_weight", "battery_weight", "charge_threshold"}}
                    agv_positions.append({
                        **center,
                        "type": str((comp.get("properties") or {}).get("agv_type", "tote_amr")),
                    })
                elif comp.get("type") == "station":
                    station_type = str((comp.get("properties") or {}).get("station_type", "pick")).lower()
                    role = {"pick": "pick", "pack": "pack", "storage": "storage", "inbound": "inbound", "outbound": "outbound"}.get(station_type)
                    if role:
                        scene_station_pools.setdefault(role, []).append(center)
                        scene_stations[role] = scene_station_pools[role][0]
                elif comp.get("type") == "charger":
                    scene_station_pools.setdefault("charge", []).append(center)
                    scene_stations["charge"] = scene_station_pools["charge"][0]
                elif comp.get("type") == "shelf":
                    # Storage service points sit in the aisle outside the rack
                    # envelope; routing to the rack centre would still create
                    # a final visual segment through the shelf mesh.
                    access = {"x": center["x"], "y": min(canvas_height - 35.0, y + height + 52.0)}
                    scene_station_pools.setdefault("storage", []).append(access)
                    scene_stations["storage"] = scene_station_pools["storage"][0]
                    scene_navigation["obstacles"].append({"x": x, "y": y, "w": width, "h": height, "id": comp.get("id")})
                elif comp.get("type") == "obstacle":
                    scene_navigation["obstacles"].append({"x": x, "y": y, "w": width, "h": height, "id": comp.get("id")})
            scene_robot_count = len(agv_positions)
            for role, fallback in scene_stations.items():
                if not scene_station_pools.get(role):
                    scene_station_pools[role] = [deepcopy(fallback)]

        # robot_count priority: explicit payload > scene-derived > default 10
        if payload.robot_count is not None:
            robot_count = int(payload.robot_count)
        elif scene_robot_count is not None and scene_robot_count > 0:
            robot_count = scene_robot_count
        else:
            robot_count = 10

        order_count = int(payload.order_count)
        seed = int(payload.random_seed)
        runtime = _initial_runtime(
            robot_count, order_count, seed, agv_positions or None, scene_stations,
            scene_station_pools, scene_navigation,
        )

        # Build scenario snapshot for reproducibility
        scenario_snapshot: dict[str, Any] | None = None
        scenario_hash: str | None = None
        if scenario_data is not None:
            scenario_snapshot = deepcopy(scenario_data)
            scenario_hash = hashlib.sha256(
                json.dumps(scenario_data, sort_keys=True, ensure_ascii=False).encode()
            ).hexdigest()[:16]

        config: dict[str, Any] = {
            "robot_count": robot_count,
            "order_count": order_count,
            "random_seed": seed,
            "strategy": scene_strategy if scene_strategy in STRATEGIES else "balanced",
            "elapsed": 0,
            "runtime_snapshot": runtime,
            "initial_runtime_snapshot": deepcopy(runtime),
        }
        if scene_strategy_parameters:
            config["strategy_parameters"] = scene_strategy_parameters
        if scenario_snapshot is not None:
            config["scenario_snapshot"] = scenario_snapshot
            config["scenario_version"] = scenario_version or 1
            config["scenario_hash"] = scenario_hash
            config["scene_robot_count"] = scene_robot_count or 0
            config["fallback"] = scene_robot_count == 0
        else:
            config["fallback"] = True

        return SimulationRun(
            project_id=payload.project_id,
            scenario_id=payload.scenario_id,
            config=config,
            metrics=self._metrics(runtime),
            events=[],
        )

    @staticmethod
    def _station_for_role(runtime: dict[str, Any], role: str, origin: dict[str, float]) -> dict[str, float]:
        pools = runtime.get("station_pools", {})
        options = pools.get(role) or [runtime.get("stations", STATIONS).get(role, STATIONS["pick"])]
        return deepcopy(min(options, key=lambda item: _distance(origin, item)))

    def _dispatch(self, runtime: dict[str, Any], strategy: dict[str, float]) -> None:
        pending = sorted(
            (task for task in runtime["tasks"] if task["status"] == "pending"),
            key=lambda task: (-task["priority"], task["created_at"], task["id"]),
        )
        idle = [robot for robot in runtime["robots"] if robot["state"] == "idle"]
        for task in pending:
            candidates = [robot for robot in idle if robot["battery"] > strategy["charge_threshold"]]
            if not candidates:
                break
            stations = runtime.get("stations", STATIONS)
            robot = min(
                candidates,
                key=lambda item: _distance(item, self._station_for_role(runtime, task["source"], item)) * strategy["distance_weight"]
                + (100 - item["battery"]) * strategy["battery_weight"],
            )
            source = self._station_for_role(runtime, task["source"], robot)
            destination = self._station_for_role(runtime, task["destination"], source)
            task.update(status="active", assigned_robot=robot["id"], started_at=runtime["time"], source_position=source, destination_position=destination)
            robot.update(
                state="to_pickup",
                task_id=task["id"],
                route=_route(robot, source, robot["lane"], stations, navigation=runtime.get("navigation")),
                route_lane=robot["lane"] % 3,
                target_index=1,
            )
            idle.remove(robot)

    @staticmethod
    def _cargo_for_task(runtime: dict[str, Any], task_id: str | None) -> dict[str, Any] | None:
        if not task_id:
            return None
        return next((cargo for cargo in runtime.get("cargos", []) if cargo.get("task_id") == task_id), None)

    @staticmethod
    def _move(robot: dict[str, Any], dt: float, speed_factor: float, occupied: list[dict[str, Any]]) -> bool:
        route = robot["route"]
        target_index = int(robot["target_index"])
        if target_index >= len(route):
            return True
        target = route[target_index]
        dx, dy = target["x"] - robot["x"], target["y"] - robot["y"]
        distance = math.hypot(dx, dy)
        if distance < 0.5:
            robot["target_index"] += 1
            return robot["target_index"] >= len(route)
        step = min(distance, 52.0 * speed_factor * dt)
        candidate = {"x": robot["x"] + dx / distance * step, "y": robot["y"] + dy / distance * step}
        # Route centre-lines are 38 scene units apart; a 28-unit reservation
        # radius gives adjacent lanes clearance while still protecting AGVs on
        # the same path.
        # A reservation only conflicts with AGVs using the same directed
        # lane.  Adjacent lanes are physically separate; treating every AGV
        # as an obstacle was the source of repeated false collision stops.
        if any(
            int(other.get("route_lane", -1)) == int(robot.get("route_lane", -2))
            and _distance(candidate, other) < 28.0
            for other in occupied
        ):
            robot["waiting_seconds"] += dt
            return False
        robot["heading"] = math.atan2(dy, dx)
        robot["x"], robot["y"] = candidate["x"], candidate["y"]
        robot["distance"] += step
        robot["energy"] += step * (0.0018 + (0.0004 if robot["load_status"] == "loaded" else 0))
        robot["battery"] = max(0.0, robot["battery"] - step * 0.0032)
        if step >= distance - 0.1:
            robot["target_index"] += 1
        return robot["target_index"] >= len(route)

    def _advance(self, runtime: dict[str, Any], seconds: float, strategy_name: str | dict[str, float]) -> None:
        strategy = strategy_name if isinstance(strategy_name, dict) else STRATEGIES.get(strategy_name, STRATEGIES["balanced"])
        runtime["time"] += seconds
        self._dispatch(runtime, strategy)
        task_map = {task["id"]: task for task in runtime["tasks"]}
        for robot in sorted(runtime["robots"], key=lambda item: (item["state"] == "idle", item["id"])):
            state = robot["state"]
            # Older persisted snapshots may not contain the counters introduced in v3.
            robot.setdefault("active_seconds", 0.0)
            robot.setdefault("charging_seconds", 0.0)
            robot.setdefault("idle_seconds", 0.0)
            if state == "idle":
                robot["idle_seconds"] += seconds
            elif state == "charging":
                robot["charging_seconds"] += seconds
            else:
                robot["active_seconds"] += seconds
            if state == "idle":
                if robot["battery"] <= strategy["charge_threshold"]:
                    robot.update(state="charging", remaining=18.0)
                continue
            if state == "charging":
                robot["remaining"] -= seconds
                robot["battery"] = min(100.0, robot["battery"] + 3.0 * seconds)
                if robot["remaining"] <= 0 or robot["battery"] >= 90:
                    robot.update(state="idle", remaining=0.0)
                continue
            if state in {"loading", "unloading"}:
                robot["remaining"] -= seconds
                if robot["remaining"] > 0:
                    continue
                task = task_map.get(robot["task_id"])
                if not task:
                    robot.update(state="idle", task_id=None, load_status="empty")
                    continue
                if state == "loading":
                    cargo = self._cargo_for_task(runtime, robot.get("task_id"))
                    if cargo:
                        cargo.update(status="on_agv", location_id=robot["id"])
                    stations = runtime.get("stations", STATIONS)
                    destination = task.get("destination_position") or self._station_for_role(runtime, task["destination"], robot)
                    robot.update(
                        state="to_dropoff",
                        load_status="loaded",
                        route=_route(robot, destination, robot["lane"] + 3, stations, navigation=runtime.get("navigation")),
                        route_lane=(robot["lane"] + 3) % 6,
                        target_index=1,
                    )
                else:
                    cargo = self._cargo_for_task(runtime, robot.get("task_id"))
                    if cargo and task:
                        delivered = task.get("destination", "outbound")
                        cargo.update(
                            status="on_shelf" if delivered == "storage" else "shipped",
                            location_id=delivered,
                        )
                    task.update(status="completed", completed_at=runtime["time"])
                    robot.update(
                        state="returning",
                        task_id=None,
                        load_status="empty",
                        completed_tasks=robot["completed_tasks"] + 1,
                        remaining=0.0,
                        route=_route(robot, robot["home"], robot["lane"], runtime.get("stations", STATIONS), use_berth=False, navigation=runtime.get("navigation")),
                        route_lane=robot["lane"] % 3,
                        target_index=1,
                    )
                continue
            before_wait = robot["waiting_seconds"]
            occupied = [
                {"x": float(other["x"]), "y": float(other["y"]), "route_lane": int(other.get("route_lane", other.get("lane", 0) % 3))}
                for other in runtime["robots"]
                if other["id"] != robot["id"]
            ]
            reached = self._move(robot, seconds, strategy["speed"], occupied)
            if robot["waiting_seconds"] > before_wait:
                runtime["collision_avoided"] += 1
                robot["blocked_streak"] = float(robot.get("blocked_streak", 0.0)) + seconds
                if int(robot["waiting_seconds"]) % 5 == 0:
                    runtime["congestion_count"] += 1
                # Do not leave a follower staring at a reserved berth.  After
                # a short, visible yield it switches to the next compatible
                # lane and replans to the same task endpoint.
                if robot["blocked_streak"] >= 3.0:
                    stations = runtime.get("stations", STATIONS)
                    task = task_map.get(robot.get("task_id"))
                    if state == "to_pickup" and task:
                        target = task.get("source_position") or self._station_for_role(runtime, task["source"], robot)
                        robot["route_lane"] = (int(robot.get("route_lane", 0)) + 1) % 3
                    elif state == "to_dropoff" and task:
                        target = task.get("destination_position") or self._station_for_role(runtime, task["destination"], robot)
                        robot["route_lane"] = 3 + ((int(robot.get("route_lane", 3)) - 2) % 3)
                    else:
                        target = robot["home"]
                        robot["route_lane"] = (int(robot.get("route_lane", 0)) + 1) % 3
                    robot.update(route=_route(robot, target, int(robot["route_lane"]), stations, navigation=runtime.get("navigation")), target_index=1, blocked_streak=0.0)
            else:
                robot["blocked_streak"] = 0.0
            if reached:
                if state == "returning":
                    robot.update(state="idle", route=[robot["home"]], target_index=0)
                else:
                    robot.update(
                        state="loading" if state == "to_pickup" else "unloading",
                        remaining=3.0 if state == "to_pickup" else 2.0,
                    )
        for task in runtime["tasks"]:
            if task["status"] == "pending":
                task["waiting_seconds"] += seconds

    @staticmethod
    def _metrics(runtime: dict[str, Any]) -> dict[str, Any]:
        tasks = runtime["tasks"]
        completed = [task for task in tasks if task["status"] == "completed"]
        durations = [task["completed_at"] - task["started_at"] for task in completed if task["started_at"] is not None]
        active = [task for task in tasks if task["status"] == "active"]
        waits = [float(task.get("waiting_seconds", 0)) for task in tasks]
        average_duration = mean(durations) if durations else (mean([runtime["time"] - task["started_at"] for task in active]) if active else 0)
        return {
            "completion_rate": round(len(completed) / max(len(tasks), 1), 4),
            "average_duration": round(float(average_duration), 2),
            "average_wait_seconds": round(mean(waits), 2) if waits else 0.0,
            "max_wait_seconds": round(max(waits), 2) if waits else 0.0,
            "congestion_count": int(runtime["congestion_count"]),
            "energy": round(sum(float(robot["energy"]) for robot in runtime["robots"]), 3),
            "collision_avoided": int(runtime["collision_avoided"]),
            "active_tasks": len(active),
            "pending_tasks": sum(task["status"] == "pending" for task in tasks),
        }

    def tick(self, run: SimulationRun, elapsed: int) -> dict[str, Any]:
        config = deepcopy(run.config or {})
        runtime = deepcopy(config.get("runtime_snapshot")) or _initial_runtime(
            int(config.get("robot_count", 8)), int(config.get("order_count", 20)), int(config.get("random_seed", 42))
        )
        previous = int(runtime.get("last_elapsed", 0))
        steps = max(0, elapsed - previous)
        for _ in range(steps):
            self._advance(runtime, 1.0, config.get("strategy_parameters") or str(config.get("strategy", "balanced")))
        runtime["last_elapsed"] = elapsed
        metrics = self._metrics(runtime)
        config["runtime_snapshot"] = runtime
        run.config = config
        run.metrics = metrics
        robots = [
            {
                "id": robot["id"],
                "state": robot["state"],
                "battery": round(robot["battery"], 1),
                "x": round(robot["x"], 2),
                "y": round(robot["y"], 2),
                "heading": round(robot["heading"], 4),
                "route": robot["route"],
                "load_status": robot["load_status"],
                "task_id": robot["task_id"],
            }
            for robot in runtime["robots"]
        ]
        completed = sum(task["status"] == "completed" for task in runtime["tasks"])
        return {
            "type": "simulation_tick",
            "run_id": run.id,
            "time": elapsed,
            "robots": robots,
            "tasks": {"total": len(runtime["tasks"]), "completed": completed},
            "task_items": runtime["tasks"],
            "cargos": runtime.get("cargos", []),
            "stations": runtime.get("stations", STATIONS),
            "events": run.events or [],
            "metrics": metrics,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def control(self, run: SimulationRun, action: str) -> SimulationRun:
        run.status = {"start": "running", "pause": "paused", "stop": "stopped"}[action]
        if action == "start":
            run.metrics = self.tick(run, int((run.config or {}).get("elapsed", 0)))["metrics"]
        elif action == "stop":
            config = deepcopy(run.config or {})
            runtime = deepcopy(config.get("initial_runtime_snapshot")) or _initial_runtime(
                int(config.get("robot_count", 8)), int(config.get("order_count", 20)), int(config.get("random_seed", 42))
            )
            run.config = {
                **config,
                "elapsed": 0,
                "metric_history": [],
                "snapshot_history": [],
                "runtime_snapshot": runtime,
            }
            run.metrics = self._metrics(runtime)
        return run

    def add_anomaly(self, run: SimulationRun, anomaly_type: str, description: str) -> SimulationRun:
        config = deepcopy(run.config or {})
        runtime = deepcopy(config.get("runtime_snapshot")) or _initial_runtime(
            int(config.get("robot_count", 8)), int(config.get("order_count", 20)), int(config.get("random_seed", 42))
        )
        affected_robot_id = None
        if anomaly_type == "low_battery" and runtime["robots"]:
            runtime["robots"][0]["battery"] = 8.0
            affected_robot_id = runtime["robots"][0]["id"]
        elif anomaly_type == "order_surge":
            start = len(runtime["tasks"])
            for index in range(5):
                runtime["tasks"].append(
                    {
                        "id": f"TASK-{start + index + 1:04d}", "kind": "outbound", "source": "storage",
                        "destination": "outbound", "priority": 5, "weight": 20, "status": "pending",
                        "assigned_robot": None, "created_at": runtime["time"], "started_at": None,
                        "completed_at": None, "waiting_seconds": 0,
                    }
                )
        elif anomaly_type in {"road_closed", "station_down"}:
            runtime["congestion_count"] += 1
            for robot in runtime["robots"][:2]:
                robot["waiting_seconds"] += 5
        config["runtime_snapshot"] = runtime
        run.config = config
        events = deepcopy(run.events or [])
        events.append(
            {
                "type": anomaly_type,
                "description": description or anomaly_type,
                "severity": "warning",
                "robot_id": affected_robot_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        run.events = events
        return run

    def reassign_task(self, run: SimulationRun, task_id: str, robot_id: str | None = None, priority: int | None = None) -> SimulationRun:
        """Return a task to the real runtime queue or assign it to an idle AGV."""
        config = deepcopy(run.config or {})
        runtime = deepcopy(config.get("runtime_snapshot"))
        if not runtime:
            raise ValueError("Simulation runtime is not initialized")
        task = next((item for item in runtime.get("tasks", []) if item.get("id") == task_id), None)
        if task is None:
            raise KeyError(task_id)
        old_robot = next((item for item in runtime.get("robots", []) if item.get("id") == task.get("assigned_robot")), None)
        if old_robot and old_robot.get("task_id") == task_id:
            old_robot.update(state="idle", task_id=None, load_status="empty", route=[old_robot["home"]], target_index=0)
        task.update(status="pending", assigned_robot=None, started_at=None)
        if priority is not None:
            task["priority"] = max(1, min(5, int(priority)))
        if robot_id:
            robot = next((item for item in runtime.get("robots", []) if item.get("id") == robot_id), None)
            if robot is None:
                raise KeyError(robot_id)
            if robot.get("state") != "idle":
                raise ValueError("Target AGV is busy")
            stations = runtime.get("stations", STATIONS)
            source = self._station_for_role(runtime, task["source"], robot)
            destination = self._station_for_role(runtime, task["destination"], source)
            robot.update(state="to_pickup", task_id=task_id, route=_route(robot, source, int(robot.get("lane", 0)), stations, navigation=runtime.get("navigation")), route_lane=int(robot.get("lane", 0)) % 3, target_index=1)
            task.update(source_position=source, destination_position=destination)
            task.update(status="active", assigned_robot=robot_id, started_at=runtime.get("time", 0))
        config["runtime_snapshot"] = runtime
        run.config = config
        return run

    def charge_robot(self, run: SimulationRun, robot_id: str) -> SimulationRun:
        config = deepcopy(run.config or {})
        runtime = deepcopy(config.get("runtime_snapshot"))
        if not runtime:
            raise ValueError("Simulation runtime is not initialized")
        robot = next((item for item in runtime.get("robots", []) if item.get("id") == robot_id), None)
        if robot is None:
            raise KeyError(robot_id)
        if robot.get("task_id"):
            raise ValueError("AGV is executing a task")
        robot.update(state="charging", remaining=18.0, route=[{"x": robot["x"], "y": robot["y"]}], target_index=0)
        config["runtime_snapshot"] = runtime
        run.config = config
        return run

    def add_order(self, run: SimulationRun, priority: int = 3, kind: str = "outbound") -> SimulationRun:
        config = deepcopy(run.config or {})
        runtime = deepcopy(config.get("runtime_snapshot"))
        if not runtime:
            raise ValueError("Simulation runtime is not initialized")
        index = len(runtime.get("tasks", [])) + 1
        task_id, cargo_id = f"TASK-{index:04d}", f"CARGO-{index:04d}"
        inbound = kind == "inbound"
        runtime.setdefault("tasks", []).append({
            "id": task_id, "kind": "inbound" if inbound else "outbound",
            "source": "inbound" if inbound else "storage", "destination": "storage" if inbound else "outbound",
            "priority": max(1, min(5, int(priority))), "weight": 20, "status": "pending", "assigned_robot": None,
            "created_at": runtime.get("time", 0), "started_at": None, "completed_at": None, "waiting_seconds": 0, "cargo_id": cargo_id,
        })
        runtime.setdefault("cargos", []).append({
            "id": cargo_id, "order_id": f"ORDER-{index:04d}", "sku": f"SKU-{1000 + index % 80:04d}",
            "type": "pallet" if inbound else "tote", "quantity": 1, "weight": 5.0,
            "status": "receiving" if inbound else "on_shelf", "location_id": "inbound" if inbound else "storage", "task_id": task_id,
        })
        config["runtime_snapshot"] = runtime
        config["order_count"] = len(runtime["tasks"])
        run.config = config
        return run

    def evaluate(self, config: dict[str, Any], strategy: str | dict[str, float], seed: int) -> dict[str, Any]:
        # Every optimization trial starts from the exact editor-derived
        # devices, stations, obstacles and AGV homes captured at run creation.
        runtime = deepcopy(config.get("initial_runtime_snapshot"))
        if not runtime:
            runtime = _initial_runtime(int(config.get("robot_count", 8)), int(config.get("order_count", 20)), seed)
        runtime["time"] = 0
        runtime["last_elapsed"] = 0
        for _ in range(900):
            self._advance(runtime, 1.0, strategy)
            if all(task["status"] == "completed" for task in runtime["tasks"]):
                break
        return self._metrics(runtime)


class EvolutionService:
    """Small deterministic multi-objective evolutionary optimizer."""

    def __init__(self, simulator: SimulationService):
        self.simulator = simulator

    def create(self, run: SimulationRun) -> Evolution:
        config = run.config or {}
        base_seed = int(config.get("random_seed", 42))
        rng = random.Random(base_seed)
        population: list[dict[str, float]] = [deepcopy(item) for item in STRATEGIES.values()]
        while len(population) < 10:
            population.append({
                "speed": rng.uniform(1.15, 2.0), "distance_weight": rng.uniform(.7, 1.8),
                "battery_weight": rng.uniform(.6, 3.0), "charge_threshold": rng.uniform(12, 28),
            })
        trials: list[dict[str, Any]] = []
        for generation in range(4):
            generation_rows: list[dict[str, Any]] = []
            for index, genome in enumerate(population):
                samples = [self.simulator.evaluate(config, genome, base_seed + generation * 20 + offset) for offset in range(2)]
                aggregate = {key: round(mean(float(sample.get(key, 0)) for sample in samples), 4) for key in ("completion_rate", "average_duration", "congestion_count", "energy", "collision_avoided")}
                score = aggregate["completion_rate"] * 100 - aggregate["average_duration"] * .12 - aggregate["congestion_count"] * 1.8 - aggregate["energy"] * .4
                generation_rows.append({"strategy": f"evolved-g{generation + 1}-{index + 1}", "generation": generation + 1, "parameters": {key: round(value, 4) for key, value in genome.items()}, "score": round(score, 3), "metrics": aggregate, "runs": 2})
            trials.extend(generation_rows)
            elites = sorted(generation_rows, key=lambda item: item["score"], reverse=True)[:4]
            population = [deepcopy(item["parameters"]) for item in elites]
            while len(population) < 10:
                parent = deepcopy(rng.choice(elites)["parameters"])
                parent["speed"] = max(1.0, min(2.2, parent["speed"] + rng.uniform(-.16, .16)))
                parent["distance_weight"] = max(.5, min(2.2, parent["distance_weight"] + rng.uniform(-.18, .18)))
                parent["battery_weight"] = max(.4, min(3.5, parent["battery_weight"] + rng.uniform(-.25, .25)))
                parent["charge_threshold"] = max(10, min(32, parent["charge_threshold"] + rng.uniform(-3, 3)))
                population.append(parent)
        best = max(trials, key=lambda item: item["score"])
        baseline = self.simulator.evaluate(config, "balanced", base_seed)
        # Pareto front: no other trial is at least as good on all objectives.
        def dominates(left: dict[str, Any], right: dict[str, Any]) -> bool:
            lm, rm = left["metrics"], right["metrics"]
            return lm["completion_rate"] >= rm["completion_rate"] and lm["average_duration"] <= rm["average_duration"] and lm["congestion_count"] <= rm["congestion_count"] and lm["energy"] <= rm["energy"] and lm != rm
        pareto = [item for item in trials if not any(dominates(other, item) for other in trials if other is not item)]
        optimized = {**best["metrics"], "strategy": best["strategy"], "score": best["score"], "parameters": best["parameters"], "pareto_size": len(pareto)}
        return Evolution(
            simulation_id=run.id,
            diagnosis=[
                {"type": "optimizer", "message": f"已完成 4 代、{len(trials)} 次多目标候选评估，最优策略为 {best['strategy']}。"},
                {"type": "comparison", "message": "所有评估均复用当前编辑器场景的设备、工位、障碍物与 AGV 起点。"},
                {"type": "pareto", "message": f"得到 {len(pareto)} 个吞吐、等待、拥堵与能耗互不支配方案。", "items": pareto[:12]},
                {"type": "trials", "message": "每一代参数、指标和评分均已记录，可用于复核和复现。", "items": trials},
            ],
            baseline_metrics=baseline,
            optimized_metrics=optimized,
        )


simulation_service = SimulationService()
evolution_service = EvolutionService(simulation_service)
