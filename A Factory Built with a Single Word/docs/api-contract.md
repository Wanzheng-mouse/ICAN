# ICAN 无人仓仿真平台 API 接口契约

> 最后对齐：2026-07-17。后端事实来源：`services/api/app/main.py`；前端 DTO：`apps/web/src/api/dtos/backend.ts`。

## 通用约定

- Base URL：`http://localhost:8000`
- 业务前缀：`/api/v1`；模板兼容 `/api/templates`
- JSON，时间字段为 ISO 8601
- 场景保存 `expected_version` 冲突返回 409；场景校验失败返回 422。

项目、模板、场景与版本接口沿用前三周契约；场景数据为 `components`、`canvas` 和 `schema_version: "1.0"`。

## 第 4 周仿真 REST

```http
POST /api/v1/simulations
Body: { project_id, scenario_id, robot_count?: 10, order_count?: 20, random_seed?: 20260717 }
→ SimulationRead (201)

GET /api/v1/simulations/{id}
→ SimulationRead

POST /api/v1/simulations/{id}/control
Body: { action: "start" | "pause" | "stop" }
→ SimulationRead

POST /api/v1/simulations/{id}/anomalies
Body: { type: "road_closed" | "low_battery" | "order_surge" | "station_down", description?: string }
→ SimulationRead
→ 409：运行未启动

GET /api/v1/simulations/{id}/events
→ SimulationEventRead[]

GET /api/v1/simulations/{id}/agents
→ SimulationAgentRead[]
```

```ts
SimulationRead {
  id, project_id, scenario_id,
  status: "created" | "running" | "paused" | "stopped" | "finished",
  config: { robot_count, order_count, random_seed, engine_version },
  metrics: { completion_rate, average_duration, congestion_count, energy,
             robot_utilization, charging_count, completed_orders, total_orders },
  events: SimulationEventRead[], robots: SimulationRobotRead[],
  tasks: SimulationTaskRead[], sim_time: number, created_at
}

SimulationRobotRead {
  id, name, state: "idle" | "moving" | "moving_to_charge" | "charging",
  battery, position: { x, y }, path, path_index, current_task_id?,
  completed_tasks, wait_ticks
}

SimulationTaskRead {
  id, status: "pending" | "running" | "completed",
  priority: "high" | "normal" | "low", pickup, dropoff,
  assigned_robot_id?, progress
}

SimulationEventRead { id, type, level: "info" | "warn" | "error" | "success", time, message, source, data }
SimulationAgentRead { id, name, role, status, load, latency, successRate, isPrimary, details, sparkline }
```

## WebSocket

```text
WS /api/v1/simulations/{id}/stream
```

连接成功立即收到 `simulation_tick` 快照；运行中每秒推进一次并发送新 tick。若有变化，服务端先逐条发 `simulation_event`，所有订单结束后再发 `simulation_completed`。

```ts
{ type: "simulation_tick", run_id, time, robots, tasks, events, metrics }
{ type: "simulation_event", run_id, event: SimulationEventRead }
{ type: "simulation_completed", run_id, time, metrics }
{ type: "pong" }
```

客户端可发送 `{ type: "ping" }`，服务端应立即回应 `{ type: "pong" }`。连接不存在的运行返回 `error` 后以 1008 关闭。

## 其他已实现接口

- `POST/GET /api/v1/projects`、`GET /api/v1/projects/{id}`
- `POST/GET/PUT /api/v1/scenarios/{id}`、`validate`、`auto-layout`、`versions`
- `POST/GET /api/v1/evolutions`
- `GET /api/v1/reports/{simulation_id}/pdf`（占位 PDF 响应）

未实现的认证、资源中心、编排、进化趋势和报告图表必须保留 Mock 数据，不能假设存在真实端点。