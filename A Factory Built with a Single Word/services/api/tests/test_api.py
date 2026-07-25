from fastapi.testclient import TestClient
from app.main import app, settings
from uuid import uuid4

# 测试环境启用一次性重置凭据回显，模拟开发模式（生产默认关闭）。
settings.expose_reset_token = True


def authenticate(client: TestClient, username: str = "admin", password: str = "ican2026") -> str:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.json()["token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return token

def test_mvp_flow():
    with TestClient(app) as client:
        authenticate(client)
        assert client.get("/api/v1/health").json()["status"] == "ok"
        templates = client.get("/api/templates", params={"category": "scene"})
        assert templates.status_code == 200
        assert any(item["title"] == "电商中型仓模板" for item in templates.json())
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
        authenticate(client)
        assert client.get("/api/v1/health").json()["status"] == "ok"
        templates = client.get("/api/templates", params={"category": "scene"})
        assert templates.status_code == 200
        template = next(item for item in templates.json() if item["title"] == "电商中型仓模板")
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
        authenticate(client)
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


def test_requirement_analysis_candidates_and_contextual_recommendations(monkeypatch):
    """Recommendation order must be driven by persisted project requirements."""
    monkeypatch.setattr("app.main.analyze_with_agnes", lambda requirement, sources, _settings: {
        "summary": "医药仓履约需求已识别", "confidence": 88,
        "profile": {"industry": "医药", "warehouse_area_m2": None, "daily_orders": 6000, "peak_orders_per_hour": None, "sku_count": None, "tote_agv_count": 4, "pallet_agv_count": 0, "agv_count": 4, "robotic_arm_count": 0, "pick_station_count": 2, "charger_count": 2, "zones": [], "flows": ["复核", "出库"], "objectives": ["合规"], "targets": {"order_completion_rate": None, "average_wait_seconds": None, "device_utilization_rate": None}},
        "assumptions": [], "questions": [], "risks": [],
        "operational_design": {"traffic_policy": "分区", "collision_policy": "预约", "charging_policy": "阈值", "workflow_summary": "复核后出库"},
        "candidate_guidance": [
            {"strategy": "balanced", "title": "均衡", "description": "均衡", "reasons": [], "cautions": []},
            {"strategy": "throughput", "title": "吞吐", "description": "吞吐", "reasons": [], "cautions": []},
            {"strategy": "energy_saver", "title": "节能", "description": "节能", "reasons": [], "cautions": []},
        ],
    })
    with TestClient(app) as client:
        authenticate(client)
        requirement = "\u533b\u836f\u4ed3\u65e5\u5747 6000 \u5355\uff0c\u5305\u542b\u590d\u6838\u3001\u51fa\u5e93\u3001\u5408\u89c4\u8ffd\u6eaf"
        analysis = client.post("/api/v1/generation/analyze", json={"requirement": requirement})
        assert analysis.status_code == 200
        assert analysis.json()["profile"]["industry"] == "\u533b\u836f"

        candidates = client.post(f"/api/v1/generation/{analysis.json()['job_id']}/candidates")
        assert candidates.status_code == 200
        assert len(candidates.json()["candidates"]) == 3
        assert all(candidate["data"]["components"] for candidate in candidates.json()["candidates"])

        project = client.post("/api/v1/projects", json={"name": "Medical recommendation", "requirement": requirement})
        assert project.status_code == 201
        recommendations = client.get("/api/v1/resource/recommendations", params={"project_id": project.json()["id"]})
        assert recommendations.status_code == 200
        assert recommendations.json()[0]["id"] == "tpl-6"

def test_week_three_scenario_validation_layout_and_versioning():
    with TestClient(app) as client:
        authenticate(client)
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


def test_real_frontend_endpoints():
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "ican2026"})
        assert login.status_code == 200
        token = login.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        client.headers.update(headers)

        profile = client.put(
            "/api/v1/users/me",
            headers=headers,
            json={"preferences": {"notifyAlert": False}},
        )
        assert profile.status_code == 200
        assert profile.json()["preferences"]["notifyAlert"] is False

        notifications = client.get("/api/v1/notifications", headers=headers)
        assert notifications.status_code == 200
        assert len(notifications.json()) > 0
        first_notification = notifications.json()[0]["id"]
        assert client.patch(f"/api/v1/notifications/{first_notification}/read", headers=headers).status_code == 200

        assert client.get("/api/v1/resource/featured-cases").status_code == 200
        assert client.get("/api/v1/orchestration/agents").status_code == 200

        suffix = uuid4().hex[:8]
        project = client.post("/api/v1/projects", json={"name": f"Full stack {suffix}"}).json()
        scenario = client.post(
            "/api/v1/scenarios",
            json={"project_id": project["id"], "name": "Connected scene", "data": {}},
        ).json()
        simulation = client.post(
            "/api/v1/simulations",
            json={"project_id": project["id"], "scenario_id": scenario["id"], "robot_count": 8, "order_count": 40},
        ).json()
        simulation_id = simulation["id"]
        assert client.post(f"/api/v1/simulations/{simulation_id}/control", json={"action": "start"}).json()["status"] == "running"
        assert client.post(f"/api/v1/simulations/{simulation_id}/anomalies", json={"type": "station_down"}).status_code == 200
        assert len(client.get(f"/api/v1/simulations/{simulation_id}/agents").json()) == 8
        assert len(client.get(f"/api/v1/reports/{simulation_id}/kpis").json()) == 6
        assert client.get(f"/api/v1/reports/{simulation_id}/pdf").content.startswith(b"%PDF-1.4")
        with client.websocket_connect(f"/api/v1/simulations/{simulation_id}/stream?token={token}") as websocket:
            tick = websocket.receive_json()
            assert tick["type"] == "simulation_tick"
            assert len(tick["robots"]) == 8

        evolution = client.post("/api/v1/evolutions", json={"simulation_id": simulation_id}).json()
        assert len(client.get(f"/api/v1/evolutions/{evolution['id']}/versions").json()) == 3

        search = client.get("/api/v1/search", params={"q": suffix})
        assert search.status_code == 200
        assert any(item["id"] == project["id"] for item in search.json())


def test_stage_five_six_security_completion_and_audit_contract():
    with TestClient(app) as client:
        token = authenticate(client)
        suffix = uuid4().hex[:8]
        project = client.post("/api/v1/projects", json={"name": f"Delivery {suffix}"}).json()
        scenario = client.post(
            "/api/v1/scenarios",
            json={"project_id": project["id"], "name": "Deterministic scene", "data": {}},
        ).json()
        simulation = client.post(
            "/api/v1/simulations",
            json={
                "project_id": project["id"],
                "scenario_id": scenario["id"],
                "robot_count": 100,
                "order_count": 1,
                "random_seed": 42,
            },
        ).json()
        simulation_id = simulation["id"]
        assert simulation["config"]["random_seed"] == 42
        assert client.post(f"/api/v1/simulations/{simulation_id}/control", json={"action": "start"}).status_code == 200

        with client.websocket_connect(f"/api/v1/simulations/{simulation_id}/stream?token={token}") as websocket:
            tick = websocket.receive_json()
            assert tick["type"] == "simulation_tick"

        completed = client.post(f"/api/v1/simulations/{simulation_id}/run-to-completion")
        assert completed.status_code == 200
        assert completed.json()["metrics"]["completion_rate"] == 1

        persisted = client.get(f"/api/v1/simulations/{simulation_id}")
        assert persisted.json()["status"] == "completed"
        assert persisted.json()["config"]["elapsed"] >= 1
        trend = client.get(f"/api/v1/reports/{simulation_id}/trend").json()
        assert trend[-1]["date"].startswith("T+")
        assert trend[-1]["completionRate"] == 100
        device_usages = client.get(f"/api/v1/reports/{simulation_id}/device-usages").json()
        assert len(device_usages) == 100
        assert sum(device["tasks"] for device in device_usages) == 1
        assert any(device["mileage"] > 0 for device in device_usages)
        playback = client.get(f"/api/v1/reports/{simulation_id}/log-playback").json()
        assert playback["frameCount"] == len(playback["frames"])
        assert playback["frameCount"] > 0
        assert playback["frames"][-1]["tasks"]["completed"] == 1
        assert "videoCover" not in playback

        evolution = client.post("/api/v1/evolutions", json={"simulation_id": simulation_id})
        assert evolution.status_code == 201
        evolution_id = evolution.json()["id"]
        assert client.get(f"/api/v1/evolutions/{evolution_id}").status_code == 200
        applied = client.post(f"/api/v1/evolutions/{evolution_id}/apply")
        assert applied.status_code == 200
        assert applied.json()["scenario"]["name"].endswith("进化方案")
        assert len(applied.json()["changes"]) >= 3
        assert client.post(f"/api/v1/evolutions/{evolution_id}/apply").json()["scenario"]["id"] == applied.json()["scenario"]["id"]
        assert client.get(f"/api/v1/evolutions/{evolution_id}").json()["applied_scenario_id"] == applied.json()["scenario"]["id"]
        assert client.get(f"/api/v1/reports/{simulation_id}/pdf").content.startswith(b"%PDF-1.4")
        notifications = client.get("/api/v1/notifications").json()
        assert any(item["title"] == "仿真运行已完成" for item in notifications)
        assert any(item["title"] == "进化方案已生成新场景" for item in notifications)

        audit = client.get("/api/v1/audit-logs")
        assert audit.status_code == 200
        assert any(item["resource_id"] == simulation_id for item in audit.json())
        membership = client.post(
            f"/api/v1/projects/{project['id']}/members",
            json={"identity": "lisi", "role": "viewer"},
        )
        assert membership.status_code == 200
        assert membership.json()["role"] == "viewer"

    with TestClient(app) as viewer:
        viewer_token = authenticate(viewer, "lisi")
        assert viewer.get(f"/api/v1/simulations/{simulation_id}").status_code == 200
        assert viewer.post(f"/api/v1/simulations/{simulation_id}/control", json={"action": "start"}).status_code == 403
        assert viewer.get(f"/api/v1/reports/{simulation_id}/kpis").status_code == 200
        assert viewer.get(f"/api/v1/reports/{simulation_id}/pdf").status_code == 403
        assert viewer.post(f"/api/v1/evolutions/{evolution_id}/apply").status_code == 403
        assert viewer.get("/api/v1/audit-logs").status_code == 403
        with viewer.websocket_connect(f"/api/v1/simulations/{simulation_id}/stream?token={viewer_token}") as websocket:
            tick = websocket.receive_json()
            assert tick["type"] == "simulation_tick"


def test_stage_one_two_real_workspace_security_files_and_password_reset():
    suffix = uuid4().hex[:8]
    email = f"owner-{suffix}@example.com"
    with TestClient(app) as client:
        registered = client.post(
            "/api/v1/auth/register",
            json={
                "loginName": f"owner_{suffix}",
                "name": "Workspace Owner",
                "email": email,
                "department": "仓储规划部",
                "password": "initial123",
                "remember": False,
            },
        )
        assert registered.status_code == 201
        assert registered.json()["user"]["department"] == "仓储规划部"
        duplicate = client.post(
            "/api/v1/auth/register",
            json={
                "loginName": f"OWNER_{suffix}",
                "name": "Duplicate",
                "email": f"another-{suffix}@example.com",
                "password": "initial123",
            },
        )
        assert duplicate.status_code == 409
        client.headers.update({"Authorization": f"Bearer {registered.json()['token']}"})

        project = client.post(
            "/api/v1/projects",
            json={"name": "Owned warehouse", "requirement": "Persist files and scenes"},
        ).json()
        scenario = client.post(
            "/api/v1/scenarios",
            json={"project_id": project["id"], "name": "Owned scene"},
        )
        assert scenario.status_code == 201
        uploaded = client.post(
            f"/api/v1/projects/{project['id']}/files",
            params={"kind": "order"},
            content=b"order_id,sku\n1,A-001\n",
            headers={"X-Filename": "orders.csv", "Content-Type": "text/csv"},
        )
        assert uploaded.status_code == 201
        workspace = client.get(f"/api/v1/projects/{project['id']}/workspace")
        assert workspace.status_code == 200
        assert workspace.json()["scenarios"][0]["id"] == scenario.json()["id"]
        assert workspace.json()["files"][0]["filename"] == "orders.csv"
        downloaded = client.get(workspace.json()["files"][0]["download_url"])
        assert downloaded.content.startswith(b"order_id")

        ticket = client.post("/api/v1/auth/forgot-password", json={"email": email})
        assert ticket.status_code == 200
        assert ticket.json()["reset_token"]
        reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": ticket.json()["reset_token"], "new_password": "changed123"},
        )
        assert reset.status_code == 204
        assert client.post(
            "/api/v1/auth/login",
            json={"username": f"owner_{suffix}", "password": "changed123"},
        ).status_code == 200

    with TestClient(app) as viewer:
        authenticate(viewer, "lisi")
        assert viewer.get(f"/api/v1/projects/{project['id']}").status_code == 403
        assert viewer.post("/api/v1/projects", json={"name": "Forbidden"}).status_code == 403


def test_error_envelope_and_request_tracing():
    """统一错误结构 + 请求追踪 ID + 认证守卫。"""
    with TestClient(app) as client:
        # 未认证访问业务接口 → 401 且结构统一
        anon = client.get("/api/v1/projects")
        assert anon.status_code == 401
        body = anon.json()
        assert body["code"] == "UNAUTHORIZED"
        assert "detail" in body and "request_id" in body
        assert anon.headers.get("X-Request-ID")

        authenticate(client)
        # 404 错误码
        missing = client.get("/api/v1/projects/not-a-real-id")
        assert missing.status_code == 404
        assert missing.json()["code"] == "NOT_FOUND"

        # 422 参数校验统一结构（缺少必填字段）
        bad = client.post("/api/v1/projects", json={})
        assert bad.status_code == 422
        assert bad.json()["code"] == "UNPROCESSABLE_ENTITY"
        assert isinstance(bad.json()["errors"], list)

        # 自定义追踪 ID 透传
        traced = client.get("/api/v1/health", headers={"X-Request-ID": "trace-xyz-001"})
        assert traced.headers.get("X-Request-ID") == "trace-xyz-001"


def test_forgot_password_hides_credential_in_production_mode():
    """expose_reset_token=False 时接口不得回显一次性凭据（防用户枚举同时保持通用文案）。"""
    from app.main import settings as app_settings

    original = app_settings.expose_reset_token
    app_settings.expose_reset_token = False
    try:
        with TestClient(app) as client:
            # 已存在的演示账号邮箱
            known = client.post("/api/v1/auth/forgot-password", json={"email": "admin@ican-platform.com"})
            assert known.status_code == 200
            assert known.json()["reset_token"] is None
            # 未注册邮箱返回同样的通用文案，避免用户枚举
            unknown = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@nowhere.dev"})
            assert unknown.status_code == 200
            assert unknown.json()["message"] == known.json()["message"]
            assert unknown.json()["reset_token"] is None
    finally:
        app_settings.expose_reset_token = original


def test_stage_one_two_completion_contracts():
    """阶段一/二收尾：输入校验、项目幂等、深链接、状态流转和真实文件检查。"""
    with TestClient(app) as client:
        authenticate(client)

        key = f"project-{uuid4()}"
        first = client.post(
            "/api/v1/projects",
            json={"name": "Idempotent warehouse", "requirement": "stage two"},
            headers={"X-Idempotency-Key": key},
        )
        retried = client.post(
            "/api/v1/projects",
            json={"name": "Should not duplicate"},
            headers={"X-Idempotency-Key": key},
        )
        assert first.status_code == 201
        assert retried.status_code == 201
        assert retried.json()["id"] == first.json()["id"]
        project_id = first.json()["id"]

        scenario = client.post(
            "/api/v1/scenarios",
            json={"project_id": project_id, "name": "Active scene"},
            headers={"X-Idempotency-Key": key},
        )
        assert scenario.status_code == 201
        scenario_retry = client.post(
            "/api/v1/scenarios",
            json={"project_id": project_id, "name": "Must not duplicate"},
            headers={"X-Idempotency-Key": key},
        )
        assert scenario_retry.json()["id"] == scenario.json()["id"]
        assert client.get(f"/api/v1/projects/{project_id}").json()["status"] == "active"

        search = client.get("/api/v1/search", params={"q": "Idempotent"})
        assert search.status_code == 200
        assert any(item["url"] == f"/projects/{project_id}" for item in search.json())

        text_upload = client.post(
            f"/api/v1/projects/{project_id}/files",
            params={"kind": "rule"},
            content="priority=high".encode(),
            headers={"X-Filename": "rules.txt", "Content-Type": "text/plain"},
        )
        assert text_upload.status_code == 201
        assert text_upload.json()["kind"] == "rule"

        fake_json = client.post(
            f"/api/v1/projects/{project_id}/files",
            content=b"this is not json",
            headers={"X-Filename": "orders.json", "Content-Type": "application/json"},
        )
        assert fake_json.status_code == 422

        invalid_preferences = client.put(
            "/api/v1/users/me",
            json={"preferences": {"theme": "neon"}},
        )
        assert invalid_preferences.status_code == 422

        invalid_email = client.post(
            "/api/v1/auth/register",
            json={
                "loginName": f"bad_{uuid4().hex[:8]}",
                "name": "Bad email",
                "email": "not-an-email",
                "password": "password123",
            },
        )
        assert invalid_email.status_code == 422


def test_product_completeness_dashboard_search_resources_theme_and_notifications():
    with TestClient(app) as client:
        token = authenticate(client)
        dashboard = client.get("/api/v1/dashboard/kpis")
        assert dashboard.status_code == 200
        assert {"projects", "scenarios", "simulations", "average_completion_rate"} <= dashboard.json().keys()

        cases = client.get("/api/v1/resource/featured-cases").json()
        learning = client.get("/api/v1/resource/learning-path").json()
        categories = client.get("/api/v1/resource/categories").json()
        assert cases and cases[0]["id"]
        assert learning and learning[0]["id"]
        assert all("count" in item for item in categories)
        created_template = client.post(
            "/api/v1/resource/templates",
            json={"title": f"Custom {uuid4().hex[:6]}", "description": "Persisted resource", "category": "scene"},
        )
        assert created_template.status_code == 201
        assert created_template.json()["downloads"] == 0

        advanced = client.get("/api/v1/search/advanced", params={"q": "仓", "type": "all", "page": 1, "page_size": 2})
        assert advanced.status_code == 200
        assert {"items", "total", "page", "page_size", "type_counts"} <= advanced.json().keys()

        profile = client.put("/api/v1/users/me", json={"preferences": {"theme": "system"}})
        assert profile.status_code == 200
        assert profile.json()["preferences"]["theme"] == "system"

        with client.websocket_connect(f"/api/v1/notifications/stream?token={token}") as websocket:
            notification = websocket.receive_json()
            assert notification["type"] == "notification_changed"
            assert notification["total"] >= notification["unread"]
