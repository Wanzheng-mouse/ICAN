# ICAN 前端开发指南

## 环境与命令

Node.js 18+。在项目根目录安装依赖并启动：

```powershell
npm install
npm run dev
cd apps/web
npx vitest run --testTimeout=15000
npx tsc --noEmit
cd ../..
npm run lint
npm run build
```

## 目录与数据层

```text
apps/web/src/
├─ api/client.ts                 # Axios、统一错误处理和全局 Mock 开关
├─ api/dtos/backend.ts           # 与 FastAPI Pydantic 对齐的 DTO
├─ api/modules/simulationApi.ts  # 仿真 REST、React Query 与实时流 hooks
├─ api/ws.ts                     # 自动重连与 ping/pong 心跳客户端
├─ pages/Editor                  # 保存场景后创建真实 simulationId
├─ pages/Simulation              # 快照恢复、实时状态、异常和智能体
└─ stores/useAppStore.ts         # projectId/scenarioId/simulationId 持久化上下文
```

页面只使用 `api/modules` 导出的函数或 hooks；不要在页面中直接拼接接口地址。后端字段先写入 `backend.ts`，再由 mapper 转成页面领域模型。

## 第 4 周仿真数据流

1. 编辑器校验并保存场景后调用 `createSimulation`。
2. 返回的真实 `simulationId` 写入 URL 与 Zustand。
3. 仿真页读取 `GET /simulations/{id}` 快照，并查询 events/agents。
4. `useSimulationStream` 接收 tick、事件与完成消息；断线后 `WsClient` 重连，连接成功时失效快照缓存。
5. 控制和异常 mutation 成功后直接更新运行快照，并刷新事件缓存。

服务端心跳为 `{ type: "ping" }` → `{ type: "pong" }`。不要把前端动画或 Mock ID 当作真实运行状态。

## 模块级 Mock

全局 `VITE_USE_MOCK` 仍控制大多数页面。仿真模块额外支持 `VITE_USE_SIMULATION_MOCK`：

```dotenv
# apps/web/.env.local（不要提交）
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_USE_MOCK=true
VITE_USE_SIMULATION_MOCK=false
```

推荐该组合用于第 4 周联调：其余未接入页面继续使用演示数据，编辑器创建运行和仿真页改走真实后端。若未设置 `VITE_USE_SIMULATION_MOCK`，它继承全局开关。修改环境变量后重启 Vite。

## 约定

- Query key 必须包含资源 ID；写操作成功后更新或失效对应缓存。
- 场景保存携带 `expected_version`，分别显示 409 冲突、422 校验错误和网络错误。
- 运行 ID 必须来自后端 `POST /simulations`，不能用本地时间戳代替真实模式的 ID。
- 新增真实接口时，同步修改 DTO、API 模块、[接口契约](./api-contract.md) 和测试。

认证、资源、编排、进化趋势和报告图表仍以 Mock 为主。完整启动和排错见[本地开发与联调指南](./local-development.md)。