# ICAN — 无人仓生成与进化平台（DuMate）

> A Factory Built with a Single Word · 一言造厂

ICAN 用于从仓库场景设计到 AGV 仿真、异常推演和方案进化。当前已完成项目、场景编辑和第 4 周可恢复实时仿真闭环。

## 当前实现状态

| 模块 | 当前能力 | 数据来源 |
| --- | --- | --- |
| 项目与模板 | 模板列表/应用、项目创建与场景持久化 | Mock 或真实 API |
| 场景编辑器 | 校验、自动布局、乐观锁保存、版本历史 | Mock 或真实 API |
| 仿真（第 4 周） | 创建真实运行 ID、10 AGV/20 订单、调度、路径、充电、拥堵、异常、事件与实时流 | Mock 或真实 API（可按模块切换） |
| 方案进化 | 基于运行指标生成诊断和优化指标 | 基础真实 API |
| 报告与其余演示页面 | PDF 占位下载、图表/认证等演示流程 | 部分 Mock |

## 第 4 周后端与仿真交付

- SimPy 驱动、可持久化的运行状态；默认创建 **10 台 AGV、20 个订单**。
- 任务分配、曼哈顿路径与道路封闭后的绕行、路径预约拥堵、低电量充电和订单完成指标。
- REST：创建、查询、开始/暂停/停止、异常注入、事件历史、三类智能体状态。
- WebSocket：初始快照、每秒 tick、单条事件、完成通知和 `ping`/`pong`。
- 前端编辑器会先创建真实 `simulationId`；仿真页用 REST 恢复快照并自动重连实时流。

## 快速开始

环境：Node.js 18+、npm 8+、Python 3.10+。

```powershell
cd "A Factory Built with a Single Word/services/api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

另开终端：

```powershell
cd "A Factory Built with a Single Word"
npm install
npm run dev
```

默认 `VITE_USE_MOCK=true`，可以不用后端展示页面。要只让仿真模块走真实服务，创建不提交的 `apps/web/.env.local`：

```dotenv
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_USE_MOCK=true
VITE_USE_SIMULATION_MOCK=false
```

这会保持其他未接入模块的 Mock 数据，同时把编辑器创建运行和仿真页面切到真实 API。修改环境变量后重启 Vite。

## 验证

```powershell
# 前端
cd apps/web
npx vitest run --testTimeout=15000
npx tsc --noEmit
cd ../..
npm run lint
npm run build

# 后端（services/api）
python -m pytest tests -q
```

## 文档

- [本地开发与联调](./docs/local-development.md)
- [API 接口契约](./docs/api-contract.md)
- [第 4 周仿真说明](./docs/simulation-week4.md)
- [前端开发指南](./docs/web-dev-guide.md)
- [API 服务 README](./services/api/README.md)
- [总开发方案](./ICAN-无人仓仿真决策平台开发方案.md)

## 当前边界

- 认证、资源中心、任务编排和报告图表仍未接入真实后端。
- 运行时状态保存在 SQLite 的 `SimulationRun.config.runtime` 中，适用于 MVP 单实例；多实例部署需迁移到共享状态/任务队列。
- PDF 端点是占位文本响应，不是正式排版报告。