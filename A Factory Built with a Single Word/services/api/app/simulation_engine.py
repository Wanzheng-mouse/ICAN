"""Persistable SimPy warehouse simulation for Week 4."""

from __future__ import annotations

from copy import deepcopy
from math import hypot
from typing import Any

import simpy


def point(x: float, y: float) -> dict[str, float]:
    return {"x": round(float(x), 2), "y": round(float(y), 2)}


def sim_time(seconds: int) -> str:
    h, rest = divmod(max(0, seconds), 3600)
    m, s = divmod(rest, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


class WarehouseSimulationEngine:
    """A deterministic, JSON-persistable multi-AGV simulator."""

    version = "week4-simpy-mvp-1.0"

    def create_state(
        self,
        robot_count: int,
        order_count: int,
        canvas: dict[str, Any] | None = None,
        chargers: list[dict[str, Any]] | None = None,
        random_seed: int = 20260717,
    ) -> dict[str, Any]:
        width = float((canvas or {}).get("width", 1200))
        height = float((canvas or {}).get("height", 800))
        charger_points = [
            point(item.get("x", width / 2), item.get("y", height - 60)) for item in (chargers or [])
        ]
        charger_points = charger_points or [point(width / 2, height - 60)]
        robots = []
        for index in range(robot_count):
            robots.append(
                {
                    "id": f"AGV-{index + 1:02d}",
                    "name": f"AGV-{index + 1:02d}",
                    "state": "idle",
                    "battery": 18.0 if index == robot_count - 1 else float(max(45, 96 - index * 4)),
                    "position": point(
                        80 + (index % 5) * ((width - 160) / 4),
                        height - 100 - (index // 5) * 45,
                    ),
                    "path": [],
                    "path_index": 0,
                    "current_task_id": None,
                    "phase": None,
                    "completed_tasks": 0,
                    "wait_ticks": 0,
                }
            )
        state = {
            "time": 0,
            "random_seed": random_seed,
            "canvas": {"width": width, "height": height},
            "chargers": charger_points,
            "robots": robots,
            "tasks": [],
            "blocked_aisles": [],
            "energy_used": 0.0,
            "charging_count": 0,
            "congestion_count": 0,
            "event_sequence": 0,
            "finished_emitted": False,
        }
        self.add_orders(state, order_count)
        return state

    def reset_state(self, state: dict[str, Any]) -> dict[str, Any]:
        return self.create_state(
            len(state.get("robots", [])) or 10,
            len(state.get("tasks", [])) or 20,
            state.get("canvas"),
            state.get("chargers"),
            int(state.get("random_seed", 20260717)),
        )

    def add_orders(self, state: dict[str, Any], count: int) -> None:
        w, h = state["canvas"]["width"], state["canvas"]["height"]
        pickups = [
            point(w * 0.18, h * 0.22),
            point(w * 0.42, h * 0.22),
            point(w * 0.62, h * 0.58),
            point(w * 0.82, h * 0.58),
        ]
        drops = [point(w * 0.12, 55), point(w * 0.88, 55)]
        start = len(state["tasks"])
        for offset in range(count):
            index = start + offset
            state["tasks"].append(
                {
                    "id": f"ORD-{index + 1:03d}",
                    "status": "pending",
                    "priority": "high" if index % 7 == 0 else "normal",
                    "pickup": pickups[index % len(pickups)],
                    "dropoff": drops[index % len(drops)],
                    "assigned_robot_id": None,
                    "assigned_at": None,
                    "completed_at": None,
                    "progress": 0,
                }
            )

    def event(
        self,
        state: dict[str, Any],
        event_type: str,
        level: str,
        message: str,
        source: str = "simulation",
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        state["event_sequence"] += 1
        return {
            "id": f"evt-{state['event_sequence']:05d}",
            "type": event_type,
            "level": level,
            "time": sim_time(state["time"]),
            "message": message,
            "source": source,
            "data": data or {},
        }

    def path(
        self, state: dict[str, Any], start: dict[str, float], target: dict[str, float]
    ) -> list[dict[str, float]]:
        if start == target:
            return [deepcopy(start)]
        result = [deepcopy(start)]
        blocked = next(
            (
                item
                for item in state["blocked_aisles"]
                if min(start["x"], target["x"]) <= item["x"] <= max(start["x"], target["x"])
            ),
            None,
        )
        if blocked:
            detour = min(state["canvas"]["height"] - 40, max(40, blocked["detour_y"]))
            result.extend([point(start["x"], detour), point(target["x"], detour)])
        else:
            result.append(point(target["x"], start["y"]))
        result.append(deepcopy(target))
        compact = []
        for item in result:
            if not compact or compact[-1] != item:
                compact.append(item)
        return compact

    def _task(self, state: dict[str, Any], task_id: str | None) -> dict[str, Any] | None:
        return next((task for task in state["tasks"] if task["id"] == task_id), None)

    def _charger(self, state: dict[str, Any], position: dict[str, float]) -> dict[str, float]:
        return deepcopy(
            min(
                state["chargers"],
                key=lambda item: hypot(item["x"] - position["x"], item["y"] - position["y"]),
            )
        )

    def _send_to_charge(
        self, state: dict[str, Any], robot: dict[str, Any], events: list[dict[str, Any]]
    ) -> None:
        task = self._task(state, robot["current_task_id"])
        if task and task["status"] != "completed":
            task.update(
                {
                    "status": "pending",
                    "assigned_robot_id": None,
                    "assigned_at": None,
                    "progress": 0,
                }
            )
        robot.update(
            {
                "state": "moving_to_charge",
                "current_task_id": None,
                "phase": None,
                "path_index": 0,
            }
        )
        robot["path"] = self.path(state, robot["position"], self._charger(state, robot["position"]))
        events.append(
            self.event(
                state,
                "charging_started",
                "warn",
                f"{robot['name']} 电量低，已调度至充电桩",
                robot["id"],
                {"battery": robot["battery"]},
            )
        )

    def _assign(self, state: dict[str, Any], events: list[dict[str, Any]]) -> None:
        pending = sorted(
            (task for task in state["tasks"] if task["status"] == "pending"),
            key=lambda task: (task["priority"] != "high", task["id"]),
        )
        for robot in state["robots"]:
            if robot["state"] != "idle":
                continue
            if robot["battery"] <= 20:
                self._send_to_charge(state, robot, events)
                continue
            if not pending:
                return
            task = pending.pop(0)
            task.update(
                {
                    "status": "running",
                    "assigned_robot_id": robot["id"],
                    "assigned_at": state["time"],
                    "progress": 10,
                }
            )
            robot.update(
                {
                    "state": "moving",
                    "current_task_id": task["id"],
                    "phase": "pickup",
                    "path_index": 0,
                }
            )
            robot["path"] = self.path(state, robot["position"], task["pickup"])
            events.append(
                self.event(
                    state,
                    "task_assigned",
                    "info",
                    f"{task['id']} 已分配给 {robot['name']}",
                    "dispatcher",
                    {"task_id": task["id"], "robot_id": robot["id"]},
                )
            )

    def _arrive(
        self, state: dict[str, Any], robot: dict[str, Any], events: list[dict[str, Any]]
    ) -> None:
        if robot["state"] == "moving_to_charge":
            robot.update({"state": "charging", "path": [], "path_index": 0})
            state["charging_count"] += 1
            return
        task = self._task(state, robot["current_task_id"])
        if task is None:
            robot["state"] = "idle"
            return
        if robot["phase"] == "pickup":
            robot.update({"phase": "dropoff", "path_index": 0})
            robot["path"] = self.path(state, robot["position"], task["dropoff"])
            task["progress"] = 50
            return
        task.update({"status": "completed", "completed_at": state["time"], "progress": 100})
        robot.update(
            {
                "state": "idle",
                "current_task_id": None,
                "phase": None,
                "path": [],
                "path_index": 0,
            }
        )
        robot["completed_tasks"] += 1
        events.append(
            self.event(
                state,
                "task_completed",
                "success",
                f"{robot['name']} 已完成 {task['id']}",
                robot["id"],
                {"task_id": task["id"]},
            )
        )

    def _step_robot(
        self,
        env: simpy.Environment,
        state: dict[str, Any],
        robot: dict[str, Any],
        reservations: set[tuple[float, float]],
        events: list[dict[str, Any]],
    ):
        yield env.timeout(1)
        if robot["state"] == "charging":
            robot["battery"] = min(100.0, robot["battery"] + 25)
            if robot["battery"] >= 80:
                robot["state"] = "idle"
                events.append(
                    self.event(
                        state,
                        "charging_completed",
                        "success",
                        f"{robot['name']} 充电完成，重新加入调度",
                        robot["id"],
                        {"battery": robot["battery"]},
                    )
                )
            return
        if robot["state"] not in {"moving", "moving_to_charge"}:
            return
        next_index = robot["path_index"] + 1
        if next_index >= len(robot["path"]):
            self._arrive(state, robot, events)
            return
        destination = robot["path"][next_index]
        reservation = (round(destination["x"], 1), round(destination["y"], 1))
        if reservation in reservations:
            robot["wait_ticks"] += 1
            state["congestion_count"] += 1
            if robot["wait_ticks"] == 1 or robot["wait_ticks"] % 3 == 0:
                events.append(
                    self.event(
                        state,
                        "congestion_detected",
                        "warn",
                        f"{robot['name']} 检测到路径冲突，已等待一个 tick",
                        "navigation",
                        {"robot_id": robot["id"]},
                    )
                )
            return
        reservations.add(reservation)
        robot["position"], robot["path_index"] = deepcopy(destination), next_index
        robot["battery"] = max(0.0, round(robot["battery"] - 4, 1))
        state["energy_used"] = round(state["energy_used"] + 0.12, 2)
        task = self._task(state, robot["current_task_id"])
        if task:
            task["progress"] = 30 if robot["phase"] == "pickup" else 70
        if next_index >= len(robot["path"]) - 1:
            self._arrive(state, robot, events)
        elif robot["battery"] <= 8:
            self._send_to_charge(state, robot, events)

    def advance(self, state: dict[str, Any], seconds: int = 1) -> tuple[list[dict[str, Any]], bool]:
        events: list[dict[str, Any]] = []
        for _ in range(max(1, seconds)):
            if self.finished(state):
                break
            self._assign(state, events)
            env = simpy.Environment(initial_time=float(state["time"]))
            reservations: set[tuple[float, float]] = set()
            for robot in state["robots"]:
                env.process(self._step_robot(env, state, robot, reservations, events))
            env.run()
            state["time"] = int(env.now)
        done = self.finished(state)
        if done and not state["finished_emitted"]:
            state["finished_emitted"] = True
            events.append(
                self.event(
                    state,
                    "simulation_completed",
                    "success",
                    f"仿真完成，共处理 {len(state['tasks'])} 个订单",
                    data={"metrics": self.metrics(state)},
                )
            )
        return events, done

    def apply_anomaly(
        self, state: dict[str, Any], anomaly_type: str, description: str = ""
    ) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        if anomaly_type == "road_closed":
            blocked = {
                "x": round(state["canvas"]["width"] / 2, 2),
                "detour_y": round(state["canvas"]["height"] * 0.82, 2),
            }
            if blocked not in state["blocked_aisles"]:
                state["blocked_aisles"].append(blocked)
            for robot in state["robots"]:
                if robot["state"] in {"moving", "moving_to_charge"} and robot["path"]:
                    robot["path"], robot["path_index"] = (
                        self.path(state, robot["position"], robot["path"][-1]),
                        0,
                    )
        elif anomaly_type == "low_battery":
            robot = max(state["robots"], key=lambda item: item["battery"])
            robot["battery"] = 8.0
            self._send_to_charge(state, robot, events)
        elif anomaly_type == "order_surge":
            self.add_orders(state, max(5, len(state["tasks"]) // 4))
        elif anomaly_type == "station_down":
            state["congestion_count"] += 1
        labels = {
            "road_closed": "已注入道路封闭，运行中路径已重新规划",
            "low_battery": "已注入低电量，目标 AGV 已转入充电调度",
            "order_surge": "已注入订单激增，任务队列已扩容",
            "station_down": "已注入站点故障，拥堵风险上升",
        }
        events.append(
            self.event(
                state,
                "anomaly_injected",
                "warn",
                description or labels[anomaly_type],
                "operator",
                {"anomaly_type": anomaly_type},
            )
        )
        return events

    def finished(self, state: dict[str, Any]) -> bool:
        return bool(state["tasks"]) and all(
            task["status"] == "completed" for task in state["tasks"]
        )

    def metrics(self, state: dict[str, Any]) -> dict[str, Any]:
        tasks = state["tasks"]
        completed = [task for task in tasks if task["status"] == "completed"]
        durations = [
            task["completed_at"] - task["assigned_at"]
            for task in completed
            if task["assigned_at"] is not None
        ]
        busy = [robot for robot in state["robots"] if robot["state"] not in {"idle", "charging"}]
        return {
            "completion_rate": round(len(completed) / max(len(tasks), 1), 4),
            "average_duration": round(sum(durations) / max(len(durations), 1), 2),
            "congestion_count": state["congestion_count"],
            "energy": round(state["energy_used"], 2),
            "robot_utilization": round(len(busy) / max(len(state["robots"]), 1), 4),
            "charging_count": state["charging_count"],
            "completed_orders": len(completed),
            "total_orders": len(tasks),
        }

    def snapshot(self, state: dict[str, Any]) -> dict[str, Any]:
        return {
            "sim_time": state["time"],
            "robots": deepcopy(state["robots"]),
            "tasks": deepcopy(state["tasks"]),
            "metrics": self.metrics(state),
        }
