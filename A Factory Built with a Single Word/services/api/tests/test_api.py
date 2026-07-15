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

def test_week_three_scenario_validation_layout_and_versioning():
    with TestClient(app) as client:
        project = client.post(
            "/api/v1/projects",
            json={"name": "Week three project"},
        ).json()
        valid_data = {
            "schema_version": "1.0",
            "canvas": {"width": 600, "height": 400, "scale": 1},
            "components": [
                {
                    "id": "shelf-1",
                    "type": "shelf",
                    "name": "Shelf 1",
                    "x": 20,
                    "y": 20,
                    "width": 120,
                    "height": 60,
                    "rotation": 0,
                    "properties": {},
                },
                {
                    "id": "agv-1",
                    "type": "agv",
                    "name": "AGV 1",
                    "x": 200,
                    "y": 20,
                    "width": 30,
                    "height": 20,
                    "rotation": 0,
                    "properties": {"battery": 80},
                },
            ],
        }
        created = client.post(
            "/api/v1/scenarios",
            json={"project_id": project["id"], "name": "Editable scene", "data": valid_data},
        )
        assert created.status_code == 201
        scenario = created.json()
        assert scenario["version"] == 1

        out_of_bounds = {
            **valid_data,
            "components": [{**valid_data["components"][0], "x": -10}],
        }
        validation = client.post(
            f"/api/v1/scenarios/{scenario['id']}/validate",
            json={"data": out_of_bounds},
        )
        assert validation.status_code == 200
        assert validation.json()["valid"] is False
        assert validation.json()["errors"][0]["code"] == "OUT_OF_BOUNDS"

        schema_invalid = client.post(
            f"/api/v1/scenarios/{scenario['id']}/validate",
            json={"data": {**valid_data, "schema_version": "2.0"}},
        )
        assert schema_invalid.status_code == 200
        assert schema_invalid.json()["errors"][0]["code"] == "SCHEMA_INVALID"

        overlapping = {
            **valid_data,
            "components": [
                valid_data["components"][0],
                {**valid_data["components"][1], "x": 40, "y": 30},
            ],
        }
        overlap_result = client.post(
            f"/api/v1/scenarios/{scenario['id']}/validate",
            json={"data": overlapping},
        )
        assert overlap_result.json()["valid"] is False
        assert overlap_result.json()["errors"][0]["code"] == "COMPONENT_OVERLAP"

        invalid_save = client.put(
            f"/api/v1/scenarios/{scenario['id']}",
            json={"data": out_of_bounds, "expected_version": 1},
        )
        assert invalid_save.status_code == 422

        layout = client.post(
            f"/api/v1/scenarios/{scenario['id']}/auto-layout",
            json={"data": overlapping},
        )
        assert layout.status_code == 200
        assert layout.json()["validation"]["valid"] is True

        duplicate_ids = {
            **valid_data,
            "components": [
                valid_data["components"][0],
                {**valid_data["components"][1], "id": "shelf-1"},
            ],
        }
        invalid_layout = client.post(
            f"/api/v1/scenarios/{scenario['id']}/auto-layout",
            json={"data": duplicate_ids},
        )
        assert invalid_layout.status_code == 422
        assert invalid_layout.json()["detail"]["code"] == "SCENARIO_VALIDATION_FAILED"

        saved = client.put(
            f"/api/v1/scenarios/{scenario['id']}",
            json={"data": layout.json()["data"], "expected_version": 1},
        )
        assert saved.status_code == 200
        assert saved.json()["version"] == 2

        refreshed = client.get(f"/api/v1/scenarios/{scenario['id']}")
        assert refreshed.status_code == 200
        assert refreshed.json()["version"] == 2
        assert refreshed.json()["data"] == saved.json()["data"]

        versions = client.get(f"/api/v1/scenarios/{scenario['id']}/versions")
        assert versions.status_code == 200
        assert [item["version"] for item in versions.json()] == [1, 2]

        stale_save = client.put(
            f"/api/v1/scenarios/{scenario['id']}",
            json={"data": valid_data, "expected_version": 1},
        )
        assert stale_save.status_code == 409
        assert stale_save.json()["detail"]["code"] == "SCENARIO_VERSION_CONFLICT"
        assert stale_save.json()["detail"]["current_version"] == 2