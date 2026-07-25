import json
import logging
import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.logging import JsonFormatter
from app.main import app
from app.models import SimulationRun
from app.schemas import SimulationCreate
from app.services.simulation import evolution_service, simulation_service


def test_production_cannot_expose_password_reset_tokens():
    with pytest.raises(ValidationError):
        Settings(environment="production", expose_reset_token=True)


def test_structured_log_formatter_includes_request_context():
    record = logging.LogRecord("ican.test", logging.INFO, __file__, 1, "completed", (), None)
    record.request_id = "request-1"
    record.status_code = 200
    payload = json.loads(JsonFormatter().format(record))
    assert payload["message"] == "completed"
    assert payload["request_id"] == "request-1"
    assert payload["status_code"] == 200


def test_backend_tick_is_the_authoritative_robot_pose_source():
    run = SimulationRun(
        id="simulation-1",
        status="running",
        config={"robot_count": 8, "order_count": 20, "random_seed": 42, "elapsed": 0},
        events=[],
    )
    tick = simulation_service.tick(run, 15)
    poses = {(robot["x"], robot["y"]) for robot in tick["robots"]}
    assert len(poses) == 8
    assert all(robot["route"] and robot["task_id"] for robot in tick["robots"])


def test_simulation_is_reproducible_and_persists_task_lifecycle():
    config = {"robot_count": 4, "order_count": 8, "random_seed": 17, "elapsed": 0}
    first = SimulationRun(id="first", status="running", config=config.copy(), events=[])
    second = SimulationRun(id="second", status="running", config=config.copy(), events=[])
    first_tick = simulation_service.tick(first, 180)
    second_tick = simulation_service.tick(second, 180)
    assert first_tick["metrics"] == second_tick["metrics"]
    assert [(item["x"], item["y"], item["state"]) for item in first_tick["robots"]] == [
        (item["x"], item["y"], item["state"]) for item in second_tick["robots"]
    ]
    assert first.config["runtime_snapshot"]["tasks"]
    assert first_tick["metrics"]["collision_avoided"] >= 0
    assert first_tick["tasks"]["completed"] > 0
    for index, robot in enumerate(first_tick["robots"]):
        for other in first_tick["robots"][index + 1:]:
            assert math.hypot(robot["x"] - other["x"], robot["y"] - other["y"]) >= 41.9


def test_scene_runtime_preserves_station_pools_and_routes_around_obstacles():
    component = lambda ident, kind, x, y, w, h, **props: {
        "id": ident, "type": kind, "name": ident, "x": x, "y": y,
        "width": w, "height": h, "rotation": 0, "properties": props,
    }
    scene = {
        "schema_version": "1.0", "canvas": {"width": 1200, "height": 800, "scale": 1},
        "components": [
            component("agv", "agv", 60, 360, 50, 40, agv_type="tote_amr"),
            component("in", "station", 820, 360, 120, 60, station_type="inbound"),
            component("pick-a", "station", 900, 100, 120, 60, station_type="pick"),
            component("pick-b", "station", 900, 620, 120, 60, station_type="pick"),
            component("out", "station", 1030, 360, 120, 60, station_type="outbound"),
            component("wall", "obstacle", 500, 180, 120, 440),
        ],
    }
    run = simulation_service.create(
        SimulationCreate(project_id="p", scenario_id="s", order_count=3, random_seed=7),
        scenario_data=scene,
        scenario_version=1,
    )
    runtime = run.config["runtime_snapshot"]
    assert len(runtime["station_pools"]["pick"]) == 2
    tick = simulation_service.tick(run, 1)
    route = tick["robots"][0]["route"]
    for left, right in zip(route, route[1:]):
        for step in range(21):
            ratio = step / 20
            x = left["x"] + (right["x"] - left["x"]) * ratio
            y = left["y"] + (right["y"] - left["y"]) * ratio
            assert not (474 <= x <= 646 and 154 <= y <= 646)


def test_evolution_compares_real_candidate_trials():
    run = SimulationRun(
        id="evolution-source",
        status="completed",
        config={"robot_count": 4, "order_count": 8, "random_seed": 9},
        metrics={},
        events=[],
    )
    evolution = evolution_service.create(run)
    trials = next(item for item in evolution.diagnosis if item["type"] == "trials")["items"]
    assert len(trials) == 40
    assert {item["generation"] for item in trials} == {1, 2, 3, 4}
    assert all(item["runs"] == 2 and item["parameters"] for item in trials)
    assert evolution.optimized_metrics["strategy"] in {item["strategy"] for item in trials}


def test_rate_limit_headers_are_visible_to_clients():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert int(response.headers["X-RateLimit-Limit"]) > 0
    assert int(response.headers["X-RateLimit-Remaining"]) >= 0
