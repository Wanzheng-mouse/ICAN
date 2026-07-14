from fastapi.testclient import TestClient
from app.main import app

def test_mvp_flow():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"
        templates = client.get("/api/templates", params={"category": "scene"})
        assert templates.status_code == 200
        assert templates.json()[0]["title"] == "电商中型仓模板"
        assert client.get("/docs").status_code == 200
        assert "updatedAt" in templates.json()[0]
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


def test_week_one_contract():
    with TestClient(app) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        templates = client.get("/api/templates", params={"category": "scene"})
        assert templates.status_code == 200
        template = templates.json()[0]
        assert template["updatedAt"] == "2024-05-20"
        assert client.get(f"/api/templates/{template['id']}").json()["id"] == template["id"]

        project = client.post("/api/v1/projects", json={"name": "Week one project"}).json()
        assert project["status"] == "draft"
        assert "owner" not in project
        assert client.get(f"/api/v1/projects/{project['id']}").json()["id"] == project["id"]

        data = {"components": [], "canvas": {"width": 1200, "height": 800, "scale": 1}, "schema_version": "1.0"}
        scenario = client.post("/api/v1/scenarios", json={"project_id": project["id"], "name": "Week one scenario", "data": data})
        assert scenario.status_code == 201
        assert scenario.json()["data"] == data

        paths = client.get("/openapi.json").json()["paths"]
        assert "/api/templates/{template_id}/apply" in paths
        assert "/api/v1/templates/{template_id}/apply" in paths


def test_week_two_template_application_flow():
    with TestClient(app) as client:
        project_response = client.post(
            "/api/v1/projects",
            json={"name": "Week two project", "requirement": "Apply a real scene template"},
        )
        assert project_response.status_code == 201
        project = project_response.json()

        detail_response = client.get("/api/templates/tpl-1")
        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["data"]["schema_version"] == "1.0"
        assert len(detail["data"]["components"]) > 0

        apply_response = client.post(
            "/api/templates/tpl-1/apply",
            json={"project_id": project["id"], "name": "Applied warehouse"},
        )
        assert apply_response.status_code == 201
        scenario = apply_response.json()
        assert scenario["project_id"] == project["id"]
        assert scenario["data"] == detail["data"]

        persisted = client.get(f"/api/v1/scenarios/{scenario['id']}")
        assert persisted.status_code == 200
        assert persisted.json()["data"] == detail["data"]

        invalid = client.post(
            "/api/templates/tpl-3/apply",
            json={"project_id": project["id"]},
        )
        assert invalid.status_code == 400