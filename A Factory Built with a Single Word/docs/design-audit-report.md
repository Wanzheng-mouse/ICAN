# ICAN 设计审计与修复验收报告

更新日期：2026-07-18

## 结论

原审计列出的 13 项问题已经逐项处理。审计中有两项判断需要校正：仓库原本已经忽略 `*.db` / `*.sqlite3`，而 `.env.local` 本就不应该提交。此次保留这些安全规则，并新增可提交的环境变量模板。

## 修复结果

| # | 原问题 | 状态 | 最终实现 |
|---|---|---|---|
| 1 | 后端单文件过大 | 已完成 | 配置、数据库、模型、接口契约、领域逻辑、仿真服务、日志和中间件已拆到独立模块；`main.py` 从约 102 KB 降到约 60 KB，职责集中为应用装配、异常处理和路由入口。 |
| 2 | 前后端存在两套仿真状态 | 已完成 | 真实联调模式下不再推进浏览器本地引擎；后端通过 WebSocket 返回 AGV 位姿、朝向、路线、载货状态和任务号，三维视图直接消费该状态。前端引擎只在仿真 Mock 开关开启时运行。 |
| 3 | 没有数据库迁移 | 已完成 | 引入 Alembic 基线迁移；应用启动执行 `upgrade head`，同时兼容旧 SQLite 数据库缺失字段，并提供升级、降级和自动生成命令。 |
| 4 | 无全局错误边界 | 已完成 | 新增 `ErrorBoundary`，组件崩溃时显示可恢复页面，并提供重试和返回首页操作。 |
| 5 | 无 404 页面 | 已完成 | 新增真正的 404 页面；登录用户访问未知业务路由时不再被静默重定向首页。 |
| 6 | QueryClient 无统一错误处理 | 已完成 | Query/Mutation 全局缓存统一展示可读错误，并做短时间去重；单个请求可通过 `meta.silentError` 关闭全局提示。 |
| 7 | 后端无结构化日志 | 已完成 | 请求日志改为 JSON，包含请求号、路径、状态码、耗时和客户端；同时输出终端与轮转文件。 |
| 8 | 数据库连接池未配置 | 已完成 | 非 SQLite 数据库配置 `pool_size`、`max_overflow`、`pool_recycle` 和断线检测；SQLite 使用兼容连接参数，避免错误套用生产连接池配置。 |
| 9 | 无接口限流 | 已完成 | 增加滑动窗口限流，认证接口使用更严格额度，返回 `429`、`Retry-After` 与 `X-RateLimit-*`。 |
| 10 | 路由守卫缺少公共路径声明 | 已完成 | `RequireAuth` 增加公共路径白名单作为防御性保护，登录、注册和找回密码保持公开。 |
| 11 | 缺少本地环境配置 | 已校正并完成 | 新增 `apps/web/.env.example`；开发者复制为 `.env.local` 使用，后者继续被 Git 忽略，避免提交个人地址和密钥。 |
| 12 | `.gitignore` 缺少数据库规则 | 原本已完成 | 已复核存在 `*.db`、`*.sqlite3`、虚拟环境、上传目录、日志和本地环境文件规则，无需重复添加。 |
| 13 | Mock 开关粒度太粗 | 已完成 | 增加认证、项目、场景、仿真、进化、报告、资源、编排、搜索、通知和审计的独立开关；全局开关只用于纯前端演示。 |

## 后端模块边界

```text
services/api/app/
├── core/config.py          # 环境配置和生产安全校验
├── core/logging.py         # JSON 日志与文件轮转
├── middleware/rate_limit.py
├── database.py             # 引擎、连接池、会话
├── models.py               # SQLAlchemy 模型
├── schemas.py              # Pydantic 契约
├── domain.py               # 权限、场景、种子数据等领域逻辑
├── services/simulation.py  # 权威仿真状态与进化计算
├── migrations.py           # Alembic 启动入口
└── main.py                 # FastAPI 装配、异常处理与路由入口
```

当前拆分已消除“模型、配置、服务和路由全部耦合在一个文件”的严重风险。后续如果继续扩大接口数量，可以再把 `main.py` 中路由按 auth/projects/scenarios/simulations/reports 拆为多个 `APIRouter`，属于不改变功能的维护性优化。

## 仿真数据流

```text
后端 SimulationService
  → HTTP 控制运行状态
  → WebSocket 推送 tick（指标 + AGV 位姿/路线/载货/任务）
  → useSimulationStream 校验消息
  → Simulation 页面映射权威 AGV 状态
  → SimView3D 只负责渲染
```

当 `VITE_MOCK_SIMULATION=true` 或全局 Mock 开启时，前端本地引擎作为演示数据源；真实联调默认关闭全部 Mock。

## 运维约束

- 单实例内存限流适合当前部署；多实例部署应由 Redis、Nginx 或 API Gateway 统一计数。
- 生产环境必须设置 `ICAN_ENVIRONMENT=production`，此时泄露密码重置凭据的配置会导致服务拒绝启动。
- 数据库结构变更必须新增 Alembic revision，不再手写启动补字段逻辑。
- `.env.local`、`.env`、数据库文件、上传文件和日志不得进入版本库。

## 验收命令

```powershell
npm run lint
npm run typecheck
npm test
npm run build

cd services/api
python -m alembic current
python -m pytest tests -q
```
