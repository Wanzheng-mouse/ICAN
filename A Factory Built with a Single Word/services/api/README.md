# ICAN FastAPI 服务

FastAPI 后端提供项目、场景、**第 4 周 SimPy 仿真**、进化和报告 MVP。运行版本为 `0.2.0`。

## 安装与启动

```powershell
cd "A Factory Built with a Single Word/services/api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

访问：<http://localhost:8000/health>、<http://localhost:8000/docs>、<http://localhost:8000/openapi.json>。

## 第 4 周仿真能力

- `simpy>=4.1,<5.0` 驱动的确定性多 AGV MVP；状态持久化在 `SimulationRun.config.runtime`。
- 默认 10 台 AGV、20 个订单；支持分配、路径绕行、拥堵预约、充电调度与异常注入。
- 运行状态可通过 `GET /api/v1/simulations/{id}` 恢复；事件由 `GET .../events` 查询。
- WebSocket `ws://localhost:8000/api/v1/simulations/{id}/stream` 先发快照，随后发 tick、事件和完成通知；支持 `{"type":"ping"}` / `{"type":"pong"}`。

## 主要接口

| 领域 | 接口 |
| --- | --- |
| 场景 | 创建、读取、校验、自动布局、保存、版本历史 |
| 仿真 | 创建、读取、控制、异常、事件、智能体、WebSocket 流 |
| 进化 | 创建与读取进化结果 |
| 报告 | `GET /api/v1/reports/{simulation_id}/pdf` |

完整字段见 [API 接口契约](../../docs/api-contract.md)。

## 测试

```powershell
python -m pytest tests -q
```

测试覆盖前三周场景流程和第 4 周 10 AGV/20 订单完成、异常/事件、智能体与 WebSocket 心跳。

## 限制

- SQLite 适合本地单实例；不要把运行时 JSON 当作分布式调度存储。
- 认证、文件上传、资源中心和任务编排未实现。
- PDF 为占位响应。