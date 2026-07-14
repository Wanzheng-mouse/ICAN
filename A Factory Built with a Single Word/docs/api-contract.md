# ICAN 无人仓仿真平台 - API 接口契约

> 双方共同维护。任何字段变更需要走 PR 评审。

## 1. 通用约定

- Base URL: `http://localhost:8000`
- 认证: `Authorization: Bearer <token>`
- 数据格式: JSON
- 时间格式: ISO 8601 字符串
- 错误码：HTTP 4xx/5xx + 业务 code（200 成功，4xx 客户端错误，5xx 服务端错误）

## 第 1 周冻结范围

- 已接入真实后端：`/health`、`/api/health`、模板、项目与场景接口；模板与健康检查使用 `/api`，项目和场景使用 `/api/v1`。
- 本周不提供认证、搜索、通知接口；前端继续以 Mock 实现这些模块，不能假设存在后端登录态或通知数据。
- 场景请求的 `data` 固定包含 `components`、`canvas` 和 `schema_version: "1.0"`；模板时间字段为 `updatedAt`。
## 2. REST 接口

### 2.1 项目

```http
POST   /api/projects                 # 创建项目
GET    /api/projects                 # 项目列表
GET    /api/projects/{id}            # 项目详情
DELETE /api/projects/{id}            # 删除项目
```

### 2.2 文件

```http
POST   /api/projects/{id}/files      # 上传文件（multipart）
GET    /api/files/{fileId}           # 下载/预览
```

### 2.3 模板

```http
GET    /api/templates                # 模板列表（支持 ?category=scene|strategy|report|device）
GET    /api/templates/{id}           # 模板详情
POST   /api/templates/{id}/apply     # 套用模板
```

### 2.4 场景

```http
GET    /api/scenarios/{id}           # 场景详情
PUT    /api/scenarios/{id}           # 保存场景
POST   /api/scenarios/{id}/validate  # 场景校验
POST   /api/scenarios/{id}/auto-layout # 自动生成布局
```

### 2.5 仿真

```http
POST   /api/simulations              # 创建仿真运行
POST   /api/simulations/{id}/control # 控制：start / pause / stop
POST   /api/simulations/{id}/anomalies # 注入异常
GET    /api/simulations/{id}         # 运行状态
GET    /api/simulations/{id}/metrics # 指标历史
```

### 2.6 方案进化

```http
POST   /api/evolutions               # 触发方案进化
GET    /api/evolutions/{id}          # 进化报告详情
GET    /api/evolutions/{id}/versions # 版本对比
```

### 2.7 报告

```http
GET    /api/reports/{id}/pdf         # 导出 PDF
GET    /api/reports/{id}/pptx        # 导出 PPT
```

## 3. WebSocket

### 3.1 仿真流

```text
WS /api/simulations/{id}/stream
```

推送消息类型：

```ts
type WsMessage =
  | { type: 'simulation_tick'; runId: string; time: number; robots: Robot[]; tasks: Task[]; events: SimulationEvent[]; metrics: SimulationMetrics }
  | { type: 'simulation_event'; level: 'info'|'warn'|'error'; time: string; message: string }
  | { type: 'simulation_done'; runId: string; finalMetrics: SimulationMetrics }
  | { type: 'pong' };
```

心跳：客户端每 15s 发送 `{type:'ping'}`，服务端回复 `{type:'pong'}`。

## 4. 错误响应

```json
{
  "code": 4001,
  "message": "场景 schema 不匹配",
  "details": { "expected": "1.0", "actual": "0.9" }
}
```

## 5. 数据协议

完整 TypeScript 类型定义见 `packages/contracts/src/index.ts`：
- `Scenario`、`Robot`、`Task`、`SimulationRun`、`SimulationTick`、`SimulationMetrics`
- `EvolutionReport`、`KpiCardData`、`ReportTrendPoint` 等

后端使用 Pydantic 模型一一对应，校验后存入数据库。
