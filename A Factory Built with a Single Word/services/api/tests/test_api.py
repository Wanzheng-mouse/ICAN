from fastapi.testclient import TestClient
from app.main import app

def test_mvp_flow():
    with TestClient(app) as client:
        assert client.get("/api/v1/health").json()["status"] == "ok"
        project = client.post("/api/v1/projects", json={"name": "MVP Warehouse"}).json()
        scenario = client.post(
            "/api/v1/scenarios",
            json={"project_id": project["id"], "name": "Demo Warehouse", "data": {}},
        ).json()
        simulation = client.post(
            "/api/v1/simulations",
            json={"project_id": project["id"], "scenario_id": scenario["id"]},
        )
        assert simulation.status_code == 201
        started = client.post(
            f"/api/v1/simulations/{simulation.json()['id']}/control",
            json={"action": "start"},
        )
    assert started.status_code == 200
    assert started.json()["status"] == "running"
