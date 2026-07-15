# ICAN FastAPI 服务

当前后端版本 `0.2.0`，提供无人仓项目、场景、仿真、进化和报告的可运行 MVP，并与前端第 1–3 周场景编辑闭环保持一致。

## 环境要求

- Python 3.10+
- 推荐使用项目内 `.venv`
- 默认使用 SQLite，无需单独安装数据库

## 安装与启动

PowerShell：

```powershell
cd "A Factory Built with a Single Word/services/api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

macOS/Linux：

```bash
cd "A Factory Built with a Single Word/services/api"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

服务地址：健康检查 <http://localhost:8000/health>、Swagger <http://localhost:8000/docs>、OpenAPI <http://localhost:8000/openapi.json>。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ICAN_DATABASE_URL` | `sqlite:///./ican.db` | SQLAlchemy 数据库地址；相对路径基于启动目录 |
| `ICAN_CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | 允许的前端源，逗号分隔 |

应用启动时自动建表、写入模板，并为旧场景补齐首个版本快照。`ican.db`、`.env`、虚拟环境和测试缓存均不会提交到 Git。

## 主要接口

| 领域 | 接口 |
| --- | --- |
| 系统 | `GET /health`、`GET /api/health`、`GET /api/v1/health` |
| 模板 | 列表、详情、应用模板（`/api/templates`，兼容 `/api/v1/templates`） |
| 项目 | `POST/GET /api/v1/projects`、`GET /api/v1/projects/{id}` |
| 场景 | 创建/读取/保存、校验、自动布局、版本历史 |
| 仿真 | 创建/读取/控制、异常注入、WebSocket 状态流 |
| 进化 | 创建和读取进化结果 |
| 报告 | `GET /api/v1/reports/{simulation_id}/pdf` |

完整请求体、响应体和错误码见 [API 接口契约](../../docs/api-contract.md)。

## 场景保存规则

- `ScenarioData` 必须使用 `schema_version: "1.0"`。
- 创建和保存检查 schema、重复组件 ID、越界和矩形重叠。
- 保存传入当前 `expected_version`；成功后版本加一并生成快照。
- 过期版本返回 `409 SCENARIO_VERSION_CONFLICT`；校验失败返回 `422 SCENARIO_VALIDATION_FAILED`。
- 自动布局只返回建议结果，不会自动写入数据库，仍需调用保存接口。

## 测试

```powershell
python -m pytest tests -q
```

测试覆盖健康检查、模板契约、项目/场景创建、模板应用、仿真启动，以及场景校验、自动布局、版本历史和并发冲突。

## 当前限制

- 认证、文件上传、资源中心和任务编排接口尚未实现。
- 仿真逻辑是确定性 MVP，尚未接入独立的 SimPy/NetworkX 调度引擎。
- PDF 端点当前返回占位内容，不是正式排版报告。
- 所有实现暂集中在 `app/main.py`，后续可按领域拆分 router/service/model。
