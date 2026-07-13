# ICAN 后端

无人仓仿真决策平台的可运行后端骨架，使用 FastAPI 和 SQLite。

启动：
1. 进入 E:\grade1\project\project\ICAN-backend
2. python -m venv .venv
3. .\.venv\Scripts\Activate.ps1
4. pip install -r requirements.txt
5. Copy-Item .env.example .env
6. uvicorn app.main:app --reload --port 8000

启动后通过 http://127.0.0.1:8000/docs 访问接口文档。

工程分层：
- app.main：API、数据层、场景、仿真、优化和报告的 MVP 实现
- contracts：请求与响应协议由 Pydantic 模型固定
- SimulationService：可替换为 SimPy、NetworkX、A-star 和真实 AGV 调度
- SQLite：项目、场景、仿真运行和优化结果持久化

已实现的接口：
- GET /api/v1/health
- POST 和 GET /api/v1/projects
- GET /api/v1/templates
- POST、GET、PUT /api/v1/scenarios
- POST、GET /api/v1/simulations，仿真控制、异常注入和 WebSocket 实时流
- POST、GET /api/v1/evolutions
- GET /api/v1/reports/{simulation_id}/pdf

报告导出目前是 MVP 占位返回；下一阶段可接入 Jinja2 与 Chromium 生成正式 PDF。
