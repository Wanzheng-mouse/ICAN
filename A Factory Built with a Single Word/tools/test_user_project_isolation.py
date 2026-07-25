"""
用户-项目隔离测试
=================
测试后端是否按用户角色和 ProjectMembership 正确过滤项目列表。

前置条件：
  - 后端运行在 http://127.0.0.1:8000
  - 数据库已重置（含 3 个演示用户）

运行：
  cd services/api && pip install requests
  python ../../tools/test_user_project_isolation.py
"""

import requests, json, sys, time

BASE = "http://127.0.0.1:8000/api/v1"
PASS = 0
FAIL = 0

def check(label, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {label}")
    else:
        FAIL += 1
        print(f"  [FAIL] {label}  {detail}")

def login(username, password):
    r = requests.post(f"{BASE}/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login failed for {username}: {r.text}"
    return r.json()["token"], r.json()["user"]

def create_project(token, name):
    r = requests.post(f"{BASE}/projects", json={"name": name}, headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 403:
        return None  # viewer cannot create
    assert r.status_code in (200, 201), f"Create project failed: {r.status_code} {r.text}"
    data = r.json()
    if isinstance(data, list):
        data = data[0]
    print(f"    创建项目: {data['name']} (id={data['id'][:12]}...)")
    return data

def list_projects(token):
    r = requests.get(f"{BASE}/projects", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"List projects failed: {r.text}"
    return r.json()

def delete_project(token, project_id):
    r = requests.patch(f"{BASE}/projects/{project_id}", json={"status": "archived"}, headers={"Authorization": f"Bearer {token}"})
    return r.status_code in (200, 204)

def run():
    global PASS, FAIL
    PASS = 0
    FAIL = 0

    print("\n" + "="*60)
    print("1. 健康检查")
    print("="*60)
    try:
        r = requests.get(f"http://127.0.0.1:8000/api/v1/health", timeout=3)
        check("后端可达", r.status_code == 200)
    except requests.ConnectionError:
        check("后端可达", False, "请先启动后端：python -m uvicorn app.main:app --port 8000")
        return

    print("\n" + "="*60)
    print("2. 登录测试")
    print("="*60)

    # 清理之前的测试数据
    admin_token, admin_user = login("admin", "ican2026")
    old = list_projects(admin_token)
    for p in old:
        delete_project(admin_token, p["id"])
    remaining = list_projects(admin_token)
    check(f"清理旧项目: {len(old)}->{len(remaining)}", len(remaining) == 0)
    check("admin 登录成功", admin_user["role"] == "admin", f"role={admin_user['role']}")

    zss_token, zss_user = login("zss", "ican2026")
    check("zss (operator) 登录成功", zss_user["role"] == "operator")

    lisi_token, lisi_user = login("lisi", "ican2026")
    check("lisi (viewer) 登录成功", lisi_user["role"] == "viewer")

    print("\n" + "="*60)
    print("3. 创建项目 — admin 创建 2 个")
    print("="*60)
    admin_p1 = create_project(admin_token, "admin-电商华南仓")
    admin_p2 = create_project(admin_token, "admin-冷链华东仓")
    check("admin 创建项目 1", admin_p1 is not None and admin_p1["status"] in ("active", "draft"))
    check("admin 创建项目 2", admin_p2 is not None and admin_p2["status"] in ("active", "draft"))

    print("\n" + "="*60)
    print("4. 创建项目 — zss (operator) 创建 1 个")
    print("="*60)
    zss_p1 = create_project(zss_token, "zss-质检区优化方案")
    check("zss 创建项目", zss_p1 is not None and zss_p1["status"] in ("active", "draft"))

    print("\n" + "="*60)
    print("5. 创建项目 — lisi (viewer) 应被拒绝")
    print("="*60)
    lisi_p1 = create_project(lisi_token, "lisi-测试项目")
    check("lisi 创建被拒绝", lisi_p1 is None, f"got={lisi_p1}")

    print("\n" + "="*60)
    print("6. 项目列表隔离验证")
    print("="*60)

    admin_projects = list_projects(admin_token)
    check("admin 看到所有项目(3)", len(admin_projects) == 3, f"got={len(admin_projects)}")
    admin_names = [p["name"] for p in admin_projects]
    check("admin 看到 admin-电商华南仓", "admin-电商华南仓" in admin_names)
    check("admin 看到 zss-质检区优化方案", "zss-质检区优化方案" in admin_names)

    zss_projects = list_projects(zss_token)
    check("zss 只看到自己的项目(1)", len(zss_projects) == 1, f"got={len(zss_projects)}")
    check("zss 看到自己的项目", zss_projects[0]["name"] == "zss-质检区优化方案")
    check("zss 看不到 admin 的项目", all("admin-" not in p["name"] for p in zss_projects))

    lisi_projects = list_projects(lisi_token)
    check("lisi (viewer) 看到 0 个项目", len(lisi_projects) == 0, f"got={len(lisi_projects)}")

    print("\n" + "="*60)
    print("7. 项目成员查询")
    print("="*60)
    r = requests.get(f"{BASE}/projects/{admin_p1['id']}/members", headers={"Authorization": f"Bearer {admin_token}"})
    check("admin 能查看项目成员", r.status_code == 200)
    members = r.json()
    check("项目有 1 个成员(admin)", len(members) == 1, f"got={len(members)}")
    check("成员是 admin", members[0]["user_id"] == "u-001")

    r2 = requests.get(f"{BASE}/projects/{zss_p1['id']}/members", headers={"Authorization": f"Bearer {zss_token}"})
    check("zss 能查看自己项目的成员", r2.status_code == 200)
    zss_members = r2.json()
    check("zss 项目有 1 个成员", len(zss_members) == 1)
    check("成员是 zss", zss_members[0]["user_id"] == "u-002")

    print("\n" + "="*60)
    print("8. 权限隔离验证")
    print("="*60)
    r3 = requests.get(f"{BASE}/projects/{admin_p1['id']}", headers={"Authorization": f"Bearer {zss_token}"})
    check("zss 不能访问 admin 的项目", r3.status_code in (403, 404), f"got {r3.status_code}")
    r4 = requests.get(f"{BASE}/projects/{admin_p1['id']}", headers={"Authorization": f"Bearer {admin_token}"})
    check("admin 能访问自己的项目", r4.status_code == 200)

    print("\n" + "="*60)
    print(f"结果: {PASS} 通过 / {PASS+FAIL} 总计")
    print("="*60)
    if FAIL == 0:
        print("ALL PASS - 所有测试通过")
    else:
        print(f"{FAIL} 个测试失败")
        sys.exit(1)

if __name__ == "__main__":
    run()
