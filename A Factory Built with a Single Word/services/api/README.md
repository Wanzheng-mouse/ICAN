# ICAN 后端

无人仓仿真决策平台的可运行后端骨架，使用 FastAPI 和 SQLite。

启动：
1. 进入 `A Factory Built with a Single Word/services/api`
2. python -m venv .venv
3. .\.venv\Scripts\Activate.ps1
4. pip install -r requirements.txt
5. Copy-Item .env.example .env
6. uvicorn app.main:app --reload --port 8000

启动后可访问 `/health`（兼容 `/api/health`）、`/api/templates?category=scene` 和 `/docs`（Swagger 可交互接口文档）。

工程分层：
- app.main：API、数据层、场景、仿真、优化和报告的 MVP 实现
- contracts：请求与响应协议由 Pydantic 模型固定
- SimulationService：可替换为 SimPy、NetworkX、A-star 和真实 AGV 调度
- SQLite：项目、场景、仿真运行和优化结果持久化

已实现的接口：
- GET /health（兼容 GET /api/health、GET /api/v1/health）
- POST、GET /api/v1/projects，GET /api/v1/projects/{id}
- GET /api/templates、GET /api/templates/{id}（兼容 /api/v1/templates），详情包含可保存的场景 data
- POST /api/templates/{id}/apply（兼容 /api/v1/templates/{id}/apply），将场景模板应用到指定项目并持久化 Scenario
- POST、GET、PUT /api/v1/scenarios
- POST、GET /api/v1/simulations，仿真控制、异常注入和 WebSocket 实时流
- POST、GET /api/v1/evolutions
- GET /api/v1/reports/{simulation_id}/pdf

报告导出目前是 MVP 占位返回；下一阶段可接入 Jinja2 与 Chromium 生成正式 PDF。
