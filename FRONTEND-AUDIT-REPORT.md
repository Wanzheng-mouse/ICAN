# ICAN 前端—后端对接审计报告（整改后）

> 更新时间：2026-07-19  
> 审计对象：`A Factory Built with a Single Word/apps/web` 与 `services/api`  
> 说明：旧版报告由简单关键字扫描生成，存在大量误判。本报告以页面实际调用、API 实现、运行环境和自动化接口测试为准。

## 1. 整改结论

旧报告列出的 17 项问题已经全部完成或被证实为误报：

- 开发环境默认关闭总 Mock 和所有领域 Mock；
- 16 个主要业务页面均保留真实领域 API 调用；
- 页面层不再直接 import `@ican/mock-data`；
- 仿真页面使用真实鉴权 WebSocket；
- 后端已提供仿真、进化、编排、资源、报告、通知、搜索和审计接口；
- Mock 只作为测试和显式本地演示回退，不参与默认开发联调。

因此，不应再把“代码里存在 Mock 分支”等同于“页面没有连接后端”。判断运行时数据源必须同时检查 `.env`、`isMockEnabled()` 和页面实际调用。

## 2. 页面逐项核验

| 页面 | 实际对接 | 运行数据来源 | 状态 |
|---|---|---|---|
| Home | `useDashboardKpis`、`useTemplates`、`createProject`、`createScenario` | Dashboard、模板、项目、场景 API | 已闭环 |
| Projects | `useProjects`、`useProjectWorkspace`、`useProjectMembers`、更新/成员/文件接口 | 项目工作区 API | 已闭环 |
| Editor | 场景读取、保存、校验、自动布局、版本历史 | Scenario API | 已闭环 |
| Simulation | 详情、控制、异常、智能体、事件、`useSimulationStream` | REST + 后端 WebSocket | 已闭环 |
| Evolution | `useEvolutionReport`、`useEvolutionTrend`、应用方案、PDF/JSON 导出 | Evolution/Report API | 已闭环 |
| Orchestration | 智能体、队列、流程、目标、分支、策略、执行、模板保存 | Orchestration API | 已闭环 |
| Resource | 分类、模板、案例、热门资源、学习路径、创建模板 | Resource API | 已闭环 |
| Search | `useAdvancedPlatformSearch` | 服务端搜索、过滤、分页 | 已闭环 |
| Notifications | 列表、单条已读、全部已读、通知 WebSocket | Notification REST + WS | 已闭环 |
| Report | 8 类报告数据、真实状态回放、PDF | Report API | 已闭环 |
| AuditLogs | `useAuditLogs` | 审计日志 API | 已闭环，管理员权限 |
| Help | `useLearningPath` | Resource API | 已闭环 |
| Login | `loginUser` | Auth API | 已闭环 |
| Register | `registerUser` | Auth API | 已闭环 |
| Profile/Preferences | `updateProfile` | User API | 已闭环 |
| Settings | `changePassword` | User API | 已闭环 |
| ForgotPassword | 请求和提交重置凭据 | Auth API | 已闭环 |

## 3. Mock 运行规则

### 默认开发联调

`apps/web/.env.development`：

```env
VITE_USE_MOCK=false
VITE_MOCK_AUTH=false
VITE_MOCK_PROJECT=false
VITE_MOCK_SCENARIO=false
VITE_MOCK_SIMULATION=false
VITE_MOCK_EVOLUTION=false
VITE_MOCK_REPORT=false
VITE_MOCK_RESOURCE=false
VITE_MOCK_ORCHESTRATION=false
VITE_MOCK_SEARCH=false
VITE_MOCK_NOTIFICATIONS=false
VITE_MOCK_AUDIT=false
```

正常执行 `npm run dev` 时，页面全部访问真实后端。

### 测试与演示

`.env.test` 中 `VITE_USE_MOCK=true`，用于前端单元测试不依赖后端进程。需要临时调试某个领域时，可在不提交的 `.env.local` 中单独开启 `VITE_MOCK_*`。

保留 Mock 回退是正常测试基础设施，不是生产数据源缺陷。

## 4. WebSocket 核验

### 仿真实时流

- 前端：`useSimulationStream.ts` 创建 `WsClient`；
- 地址：`/api/v1/simulations/{simulationId}/stream?token=...`；
- 后端：FastAPI `@app.websocket` 已实现鉴权、tick、完成事件和断线处理；
- 开发代理：`/api` 已开启 `ws: true`；
- 前端会校验 `simulation_tick` 数据结构并在断线后自动重连。

### 通知实时流

- 前端 `notificationApi.ts` 建立通知 `WsClient`；
- 后端提供鉴权通知 WebSocket；
- 收到变更后刷新 TanStack Query 缓存。

所以旧报告“`useSimulationStream` 是纯 Mock、没有 WebSocket”的结论不成立。

## 5. 静态配置不等于虚拟业务数据

以下内容是随前端发布的产品配置，不需要每次从数据库读取：

- 首页产品文案、功能介绍、生成流程；
- 编辑器可用设备组件目录；
- 仿真控制台 KPI 字段定义；
- 进化导出菜单。

它们已经从 `@ican/mock-data` 迁移到 `src/config`，并且不包含运行中的项目、场景、设备或指标值。业务数据仍全部来自 API。

## 6. 防回退措施

新增 `src/api/connectivity.contract.test.ts`，自动检查：

1. 16 个主要页面保留各自真实领域调用；
2. 业务页面不得直接引用 `@ican/mock-data`；
3. 仿真 hook 必须创建并连接真实 `WsClient`；
4. 开发环境总 Mock 和领域 Mock 必须全部为 `false`。

后端测试同时覆盖登录、项目、场景、仿真控制、WebSocket、进化、报告、资源、搜索、通知、权限与审计链路。

## 7. 仍可增强但不属于“未对接”

- 将 PostgreSQL、Redis 和后台任务队列用于多实例生产部署；
- 将最近 300 帧回放升级为独立快照表和长期归档；
- 对接真实 WMS、PLC、设备厂商控制器与现场数据；
- 引入更高保真的刚体/传感器仿真；
- 增加 Playwright 端到端浏览器测试。

这些属于工业化和规模化工作，不影响当前前后端功能闭环。

## 8. 验收基线

整改必须同时满足：

- 后端 `py_compile` 与 API/基础设施测试通过；
- 前端 ESLint、TypeScript、Vitest 和生产构建通过；
- 页面目录扫描不到 `@ican/mock-data`；
- 开发环境所有 Mock 开关为 `false`；
- 仿真 WebSocket、设备运行统计和状态回放有自动化断言。

项目内更详细的数据流说明见 `docs/frontend-backend-connectivity-audit.md`。
