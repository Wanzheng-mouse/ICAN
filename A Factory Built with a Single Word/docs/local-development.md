# 本地开发与前后端联调指南

## 环境

Node.js 18+、npm 8+、Python 3.10+。前端依赖装在项目根目录；Python 依赖装在 `services/api/.venv`。不要提交 `.env.local`、`.env`、`ican.db` 或缓存。

## 启动

```powershell
cd "ICAN/A Factory Built with a Single Word"
npm install
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

另开终端在项目根目录运行 `npm run dev`。健康检查为 <http://localhost:8000/health>，Swagger 为 <http://localhost:8000/docs>。

## 推荐的第 4 周联调配置

已提交的开发配置默认全局 Mock。创建不提交的 `apps/web/.env.local`：

```dotenv
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_USE_MOCK=true
VITE_USE_SIMULATION_MOCK=false
```

`VITE_USE_SIMULATION_MOCK=false` 只让场景编辑器创建运行、仿真 REST 与 WebSocket 使用真实后端；其他演示模块仍保持 Mock。环境变量变更后必须重启 Vite。

若要所有已实现模块走真实 API，可把 `VITE_USE_MOCK=false`；此时不要进入资源、编排、报告图表等未实现页面。

## 第 4 周验证顺序

1. 访问 `/health` 和 `/docs`。
2. 在首页创建项目并应用模板，进入编辑器保存场景。
3. 点击“进入仿真”；地址栏应有真实 `simulationId`。
4. 仿真页显示 10 台 AGV、20 个订单，点击开始。
5. 查看实时 AGV、指标、事件和智能体卡片；注入道路封闭或低电量。
6. 刷新页面或短暂断网后恢复，页面会由 REST 快照恢复并重连实时流。

## 测试

```powershell
cd apps/web
npx vitest run --testTimeout=15000
npx tsc --noEmit
cd ../..
npm run lint
npm run build

cd services/api
python -m pytest tests -q
```

## 排错

- 浏览器请求 404：项目/场景/仿真使用 `/api/v1`，模板使用 `/api/templates`。
- WebSocket：确认地址是 `/api/v1/simulations/{simulationId}/stream` 且后端运行在 8000。
- 异常返回 409：先启动仿真，异常只允许在 `running` 状态注入。
- 刷新后找不到运行：检查路由 `simulationId` 或 Zustand 上下文；运行状态持久化于 SQLite。