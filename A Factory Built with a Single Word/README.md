# ICAN — 无人仓生成与进化平台（DuMate）

> A Factory Built with a Single Word · 一言造厂

ICAN 是一个面向无人仓规划、仿真和方案进化的 Web 平台。用户可以从模板或自然语言需求创建项目，在二维编辑器中调整仓库场景，启动 AGV 仿真、注入异常，并查看优化结果与报告。

## 当前实现状态

| 模块 | 当前能力 | 数据来源 |
| --- | --- | --- |
| 首页与项目 | 模板列表/详情、创建项目、应用场景模板 | Mock 或真实 API |
| 场景编辑器 | 场景读取、画布编辑、校验、自动布局、乐观锁保存、版本历史 | Mock 或真实 API |
| 仿真 | 创建运行、开始/暂停/停止、异常注入、WebSocket 状态流 | 基础真实 API；agents/events 仅 Mock 模式可用 |
| 方案进化 | 根据仿真生成诊断和优化指标 | 基础真实 API；趋势仅 Mock 模式可用 |
| 报告 | 下载 PDF 占位报告 | 图表仅 Mock 模式可用；后端仅提供 PDF 端点 |
| 认证、资源、编排 | 前端演示流程 | 认证始终为前端 Mock；资源/编排仅 Mock 模式可用 |

第 1–3 周的前后端场景闭环已完成：项目创建 → 模板应用 → 场景编辑 → 校验/自动布局 → 带版本号保存。

## 技术栈

- 前端：React 18、TypeScript、Vite、Ant Design、TanStack Query、Zustand、Konva、ECharts
- 后端：FastAPI、Pydantic、SQLAlchemy、SQLite
- 仿真：当前为可运行的确定性 MVP 服务，预留 SimPy、NetworkX 与 A* 扩展位置
- 工程：npm workspaces；Python 后端使用独立虚拟环境

## 目录结构

```text
A Factory Built with a Single Word/
├─ apps/web/                 # React 前端
├─ packages/contracts/       # 前端共享 TypeScript 类型
├─ packages/mock-data/       # 前端演示数据
├─ services/api/             # FastAPI、SQLite 与仿真/进化 MVP
├─ scenarios/                # 生成的场景文件目录
├─ reports/                  # 生成的报告文件目录
├─ docs/                     # 契约、开发与阶段文档
├─ package.json              # npm workspace 命令
└─ README.md
```

## 快速开始

环境要求：Node.js 18+（推荐 20+）、npm 8+、Python 3.10+。

### 1. 启动后端

```powershell
cd "A Factory Built with a Single Word/services/api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

启动后可访问健康检查 <http://localhost:8000/health>、Swagger <http://localhost:8000/docs> 和 OpenAPI <http://localhost:8000/openapi.json>。SQLite 数据库默认生成在 `services/api/ican.db`，该本地文件已被 Git 忽略。

### 2. 启动前端

```powershell
cd "A Factory Built with a Single Word"
npm install
npm run dev
```

默认开发配置 `VITE_USE_MOCK=true`，无需后端也能演示。若要联调真实后端，请新建不提交到 Git 的 `apps/web/.env.local`：

```dotenv
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_USE_MOCK=false
```

修改环境变量后需要重启 Vite，再访问 <http://localhost:5173>。演示账号：`admin / ican2026`（认证当前仍为前端 Mock）。完整步骤见[本地开发与联调指南](./docs/local-development.md)。

## 验证命令

前端（项目根目录）：

```powershell
cd apps/web
npx vitest run --testTimeout=15000
cd ../..
npm run typecheck
npm run lint
npm run build
```

后端（`services/api`，激活虚拟环境后）：

```powershell
python -m pytest tests -q
```

## 前后端契约

- API 基地址：`http://localhost:8000`
- 业务 API 前缀：`/api/v1`；模板兼容前缀：`/api/templates`
- 仿真流：`ws://localhost:8000/api/v1/simulations/{simulation_id}/stream`
- 场景结构版本：`schema_version: "1.0"`
- 场景保存应携带 `expected_version`；版本过期返回 HTTP 409

字段、错误码及未实现的真实接口以 [API 接口契约](./docs/api-contract.md) 为准。

## 文档

- [文档索引](./docs/README.md)
- [本地开发与联调指南](./docs/local-development.md)
- [前端开发指南](./docs/web-dev-guide.md)
- [API 接口契约](./docs/api-contract.md)
- [项目总开发方案](./ICAN-无人仓仿真决策平台开发方案.md)
- [阶段 1 历史总结](./docs/stage-1-summary.md)

## 当前边界

- 后端认证、文件上传、资源中心和任务编排尚未实现；真实模式下不要进入未接入页面，需要演示时切回 Mock 模式。
- 后端仿真目前提供运行级状态和 WebSocket tick，不提供独立 agents/events 列表接口。
- 进化趋势和报告图表接口尚未实现；PDF 下载返回 MVP 占位内容。
- `services/api/app/main.py` 是后端契约事实来源；前端 DTO 位于 `apps/web/src/api/dtos/backend.ts`。
