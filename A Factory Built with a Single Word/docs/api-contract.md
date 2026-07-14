# ICAN 无人仓仿真平台 - API 接口契约

> 最后对齐时间：2026-07-14
> 以 `services/api/app/main.py` 的 FastAPI 响应字段为唯一事实来源。
> 前端 DTO 位于 `apps/web/src/api/dtos/backend.ts`，与本文档逐字段一致。

## 1. 通用约定

- Base URL: `http://localhost:8000`
- API 前缀: `/api/v1`（模板 `/api/templates` 除外）
- 认证: 当前阶段 Mock；后续使用 `Authorization: Bearer <token>`
- 数据格式: JSON
- 时间格式: ISO 8601 字符串 (`datetime.isoformat()`)

## 第 1 周冻结范围

- 已接入真实后端：`/health`、`/api/health`、模板、项目与场景接口；模板与健康检查使用 `/api`，项目和场景使用 `/api/v1`。
- 本周不提供认证、搜索、通知接口；前端继续以 Mock 实现这些模块，不能假设存在后端登录态或通知数据。
- 场景请求的 `data` 固定包含 `components`、`canvas` 和 `schema_version: "1.0"`；模板时间字段为 `updatedAt`。
## 2. REST 接口

### 2.1 健康检查

```http
GET  /health
→ { "status": "ok" }
```

### 2.2 模板（前缀 /api/templates）

```http
GET  /api/templates?category=scene
→ [ TemplateRead, ... ]

GET  /api/templates/{id}
→ TemplateRead

TemplateRead {
  id: str, category: str, title: str, description: str,
  cover: str, industry: str, difficulty: str,
  downloads: int, views: int, updatedAt: str   // serialization_alias
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
Body: { project_id: str, name: str, data?: dict }
→ ScenarioRead

GET  /api/v1/scenarios/{id}
→ ScenarioRead

PUT  /api/v1/scenarios/{id}
Body: { name?: str, data: dict }
→ ScenarioRead

ScenarioRead {
  id: str, project_id: str, name: str,
  data: dict, updated_at: datetime
}
```

### 2.5 仿真（前缀 /api/v1/simulations）

```http
POST /api/v1/simulations
Body: { project_id, scenario_id, robot_count?, order_count? }
→ SimulationRead

POST /api/v1/simulations/{id}/control
Body: { action: "start"|"pause"|"stop" }
→ { "status": "ok" }

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
  后端当前未提供。前端在 VITE_USE_MOCK=false 时不应调用这些地址。
  复杂图表数据源将在阶段 2 后端补齐后逐项切换。

## 3. WebSocket

```text
WS /api/v1/simulations/{id}/stream
```

推送消息：

```ts
// simulation_tick: 仿真状态更新
{ type: "simulation_tick", run_id, time, robots, events, metrics }

// simulation_done: 仿真完成
{ type: "simulation_done", run_id, final_metrics }

// pong: 心跳回复
{ type: "pong" }
```

心跳：客户端每 15s 发送 `{"type":"ping"}`，服务端回复 `{"type":"pong"}`。

## 4. 阶段 1 边界说明

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 认证（登录/注册/退出） | Mock | 后端阶段 2 提供 |
| 用户资料/修改密码 | Mock | 后端阶段 2 提供 |
| 搜索 | Mock | 本地索引，无后端接口 |
| 通知 | Mock | 本地 Store，无后端接口 |
| 资源中心 | Mock | 后端阶段 2 提供 |
| 任务编排 | Mock | 后端阶段 2 提供 |
| 报告图表（KPI/趋势/异常分布） | Mock | 后端阶段 2 提供 |

## 5. 错误响应

```json
{
  "detail": "错误描述信息"
}
```

HTTP 状态码：`422`（参数校验失败）、`404`（资源不存在）、`500`（服务器错误）。
