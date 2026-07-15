# ICAN 无人仓仿真平台 - API 接口契约

> 最后对齐时间：2026-07-15
> 以 `services/api/app/main.py` 的 FastAPI 响应字段为唯一事实来源。
> 前端 DTO 位于 `apps/web/src/api/dtos/backend.ts`，与本文档逐字段一致。

## 1. 通用约定

- Base URL: `http://localhost:8000`
- API 前缀: `/api/v1`（模板 `/api/templates` 除外）
- 认证: 当前阶段 Mock；后续使用 `Authorization: Bearer <token>`
- 数据格式: JSON
- 时间格式: ISO 8601 字符串 (`datetime.isoformat()`)

## 第 1 周已对齐范围

- 已接入真实后端：`/health`、`/api/health`、模板、项目与场景接口；模板与健康检查使用 `/api`，项目和场景使用 `/api/v1`。
- 本周不提供认证、搜索、通知接口；前端继续以 Mock 实现这些模块，不能假设存在后端登录态或通知数据。
- 场景请求的 `data` 固定包含 `components`、`canvas` 和 `schema_version: "1.0"`；模板时间字段为 `updatedAt`。
## 第 2 周已对齐范围

- 项目响应严格使用 `ProjectRead`，默认状态为 `draft`，不再返回前端 DTO 中不存在的 `owner`。
- 模板详情使用 `TemplateDetailRead`，其中 `data` 是可直接保存的 `ScenarioData`。
- `POST /api/templates/{id}/apply`（兼容 `/api/v1/templates/{id}/apply`）会校验项目和场景模板，并创建持久化场景；返回的 `scenario.id` 可直接传给编辑器。
- 首页创建/应用模板后必须同时保存并传递真实 `projectId` 与 `scenarioId`；编辑器刷新时按该 `scenarioId` 重新加载同一场景。
## 第 3 周已对齐范围

- `ScenarioData` 严格包含 `components`、`canvas` 和 `schema_version: "1.0"`；组件字段禁止缺失或携带未声明字段。
- 场景创建和保存执行 schema、组件 ID、画布边界与矩形重叠校验；独立校验接口返回结构化错误码。
- 保存使用 `expected_version` 乐观锁。版本不一致返回 HTTP 409 和 `SCENARIO_VERSION_CONFLICT`，成功保存生成不可变版本快照。
- 自动布局接口只返回重新排布后的 `ScenarioData`，不隐式保存；前端确认布局后再调用保存接口。
- 编辑器显示服务器版本及保存、校验失败、冲突和网络失败状态。
## 2. REST 接口

### 2.1 健康检查

```http
GET  /health
→ { "status": "ok", "service": "ican-api" }
```

### 2.2 模板（前缀 /api/templates）

```http
GET  /api/templates?category=scene
→ [ TemplateRead, ... ]

GET  /api/templates/{id}
→ TemplateDetailRead

POST /api/templates/{id}/apply
兼容 POST /api/v1/templates/{id}/apply
Body: { project_id: str, name?: str }
→ ScenarioRead (201)

TemplateRead {
  id: str, category: str, title: str, description: str,
  cover: str, industry: str, difficulty: str,
  downloads: int, views: int, updatedAt: str   // serialization_alias
}

TemplateDetailRead extends TemplateRead {
  data: ScenarioData
}
```

### 2.3 项目（前缀 /api/v1/projects）

```http
POST /api/v1/projects
Body: { name: str, requirement?: str }
→ ProjectRead

GET  /api/v1/projects
→ [ ProjectRead, ... ]

GET  /api/v1/projects/{id}
→ ProjectRead

ProjectRead {
  id: str, name: str, requirement: str,
  status: str, created_at: datetime
}
```

### 2.4 场景（前缀 /api/v1/scenarios）

```http
POST /api/v1/scenarios
Body: { project_id: str, name: str, data?: ScenarioData }
→ ScenarioRead (201)

GET  /api/v1/scenarios/{id}
→ ScenarioRead

PUT  /api/v1/scenarios/{id}
Body: { name?: str, data: ScenarioData, expected_version?: int }
→ ScenarioRead
→ 409 SCENARIO_VERSION_CONFLICT（expected_version 已过期）
→ 422 SCENARIO_VALIDATION_FAILED（边界、重叠或组件 ID 校验失败）

POST /api/v1/scenarios/{id}/validate
Body: { data: dict }
→ ScenarioValidationRead

POST /api/v1/scenarios/{id}/auto-layout
Body: { data: ScenarioData }
→ { data: ScenarioData, validation: ScenarioValidationRead }

GET /api/v1/scenarios/{id}/versions
→ [ ScenarioVersionRead, ... ]

ScenarioRead {
  id: str, project_id: str, name: str,
  data: ScenarioData, version: int, updated_at: datetime
}

ScenarioData {
  components: list[SceneComponent],
  canvas: { width: number, height: number, scale: number },
  schema_version: "1.0"
}

ScenarioValidationRead {
  valid: bool,
  errors: [{ code, message, component_ids, field? }],
  warnings: [{ code, message, component_ids, field? }]
}

校验错误码：
- SCHEMA_INVALID
- DUPLICATE_COMPONENT_ID
- OUT_OF_BOUNDS
- COMPONENT_OVERLAP
```

### 2.5 仿真（前缀 /api/v1/simulations）

```http
POST /api/v1/simulations
Body: { project_id, scenario_id, robot_count?, order_count? }
→ SimulationRead

POST /api/v1/simulations/{id}/control
Body: { action: "start"|"pause"|"stop" }
→ SimulationRead（status 已更新）

POST /api/v1/simulations/{id}/anomalies
Body: { type: "road_closed"|"low_battery"|"order_surge", description?: "" }
→ SimulationRead (with event appended)

GET  /api/v1/simulations/{id}
→ SimulationRead

WS  /api/v1/simulations/{id}/stream
→ simulation_tick events

SimulationRead {
  id, project_id, scenario_id, status: str,
  config: dict,       // { robot_count, order_count }
  metrics: dict,      // { completion_rate, average_duration, congestion_count, energy }
  events: list[dict], // [{ type, description, severity }]
  created_at: datetime
}
```

### 2.6 进化（前缀 /api/v1/evolutions）

```http
POST /api/v1/evolutions
Body: { simulation_id: str }
→ EvolutionRead

GET  /api/v1/evolutions/{id}
→ EvolutionRead

EvolutionRead {
  id, simulation_id,
  diagnosis: list[dict],           // [{ type, message }]
  baseline_metrics: dict,          // 进化前的 metrics
  optimized_metrics: dict,         // 进化后的 metrics
  created_at: datetime
}
```

### 2.7 报告（前缀 /api/v1/reports）

```http
GET  /api/v1/reports/{simulationId}/pdf
→ application/pdf (binary, 当前为文本占位)
```

**注意**：`/api/v1/reports/{id}/kpis`、`/trend`、`/anomalies` 等数据接口
  后端当前未提供。前端在 `VITE_USE_MOCK=false` 时调用这些地址会返回 404，真实联调期间不要进入对应页面。
  新增对应后端接口和契约测试后，前端才能逐项切换为真实数据。

## 3. WebSocket

```text
WS /api/v1/simulations/{id}/stream
```

服务端连接成功后每秒推送一次：

```ts
{
  type: "simulation_tick",
  run_id: string,
  time: number,
  robots: Array<{ id: string; state: string; battery: number }>,
  tasks: { total: number; completed: number },
  events: Array<Record<string, unknown>>,
  metrics: Record<string, number>,
  generated_at: string
}
```

前端 `WsClient` 当前每 15 秒发送一次 `{"type":"ping"}`，但后端尚未读取心跳或返回 `pong`；客户端不能依赖 `pong` 判断连接健康。服务端当前也不推送 `simulation_done`。

## 4. 当前真实接口边界

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 认证（登录/注册/退出） | Mock | 后端当前未提供 |
| 用户资料/修改密码 | Mock | 后端当前未提供 |
| 搜索 | Mock | 本地索引，无后端接口 |
| 通知 | Mock | 本地 Store，无后端接口 |
| 资源中心 | Mock | 后端当前未提供 |
| 任务编排 | Mock | 后端当前未提供 |
| 仿真 agents/events 列表 | Mock | 后端只提供运行级响应与 WebSocket tick |
| 进化趋势/versions | Mock | 后端当前只提供创建和按 ID 读取 |
| 报告图表（KPI/趋势/异常分布） | Mock | 后端当前只提供 PDF 占位下载 |

## 5. 错误响应

```json
{
  "detail": "错误描述信息"
}
```

HTTP 状态码：`400`（模板类型不可应用）、`404`（资源不存在）、`409`（场景版本冲突）、`422`（schema 或场景业务校验失败）、`500`（服务器错误）。
