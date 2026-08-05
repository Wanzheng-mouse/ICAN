from fastapi.testclient import TestClient

from app.main import app, settings
from app.simulation_engine import WarehouseSimulationEngine


def test_simpy_engine_completes_ten_agv_twenty_orders():
    engine = WarehouseSimulationEngine()
    state = engine.create_state(robot_count=10, order_count=20, random_seed=20260717)
    events = []
    for _ in range(80):
        batch, completed = engine.advance(state)
        events.extend(batch)
        if completed:
            break

    metrics = engine.metrics(state)
    assert completed is True
    assert metrics["completed_orders"] == 20
    assert metrics["completion_rate"] == 1.0
    assert len(state["robots"]) == 10
    assert any(event["type"] == "charging_started" for event in events)
    assert any(event["type"] == "simulation_completed" for event in events)


def test_week_four_api_events_agents_anomaly_and_websocket_heartbeat():
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": "admin", "password": settings.seed_admin_password})
        assert login.status_code == 200
        client.headers.update({"Authorization": f"Bearer {login.json()['token']}"})
        project = client.post("/api/v1/projects", json={"name": "Week four project"}).json()
        scenario = client.post(
            "/api/v1/scenarios",
            json={"project_id": project["id"], "name": "Week four scenario", "data": {}},
        ).json()
        created = client.post(
            "/api/v1/simulations",
            json={
                "project_id": project["id"],
                "scenario_id": scenario["id"],
                "robot_count": 10,
                "order_count": 20,
                "random_seed": 20260717,
            },
        )
        assert created.status_code == 201
        run = created.json()
        assert run["id"]
        assert run["config"]["robot_count"] == 10
        assert run["config"]["order_count"] == 20

        queued_anomaly = client.post(
            f"/api/v1/simulations/{run['id']}/anomalies",
            json={"type": "road_closed"},
        )
        # Created runs accept an anomaly and carry it into the first runtime
        # snapshot; this is more useful than rejecting scenario preparation.
        assert queued_anomaly.status_code == 200

        started = client.post(
            f"/api/v1/simulations/{run['id']}/control",
            json={"action": "start"},
        )
        assert started.json()["status"] == "running"
        anomaly = client.post(
            f"/api/v1/simulations/{run['id']}/anomalies",
            json={"type": "road_closed", "description": "测试道路封闭"},
        )
        assert anomaly.status_code == 200
        assert any(event["type"] == "anomaly_injected" and event["data"]["anomaly_type"] == "road_closed" for event in anomaly.json()["events"])

        events = client.get(f"/api/v1/simulations/{run['id']}/events")
        agents = client.get(f"/api/v1/simulations/{run['id']}/agents")
        assert events.status_code == 200
        assert any(event["type"] == "anomaly_injected" and event["data"]["anomaly_type"] == "road_closed" for event in events.json())
        assert len(agents.json()) == 10

        token = login.json()["token"]
        with client.websocket_connect(f"/api/v1/simulations/{run['id']}/stream?token={token}") as stream:
            first = stream.receive_json()
            assert first["type"] == "simulation_tick"
            assert len(first["robots"]) == 10
            stream.send_json({"type": "ping"})
            assert stream.receive_json() == {"type": "pong"}
