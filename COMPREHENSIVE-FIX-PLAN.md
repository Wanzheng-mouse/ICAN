# ICAN 无人仓仿真平台 — 阶段一 & 阶段二 完整修复方案

## 一、现状诊断

### 后端（FastAPI `main.py`, 1435行）

**已实现但功能不完整：**

| 模块 | 已实现API | 缺失/伪实现 |
|---|---|---|
| 认证 | login, register, forgot-password, reset-password, logout, profile, change-password | 密码重置邮件未配置（开发模式返回token）、无JWT过期刷新 |
| 项目 | CRUD + 成员权限 + 文件上传/下载 | 无项目归档/恢复、无项目模板批量导入 |
| 场景 | CRUD + 校验 + 自动布局 + 版本历史 + 模板应用 | 场景无GIS坐标、无3D属性（层高/承重） |
| 仿真 | 创建/控制/异常注入 + WebSocket流 | **tick()是假公式**（completion=elapsed*robots/orders*10）、**无真实物理引擎**、WebSocket每秒发假数据 |
| 进化 | 创建/读取 | **硬编码+15%**（baseline+0.15、duration*0.85）、无真实多轮仿真对比 |
| 编排 | 假数据端点（agents/queue/flow-nodes/flow-edges/strategy/goal/branches） | 全部返回内存常量，无真实调度逻辑 |
| 资源 | featured-cases/hot-resources/learning-path/categories/templates | 全部硬编码，无真实案例库 |
| 搜索 | 跨项目/场景/模板/仿真搜索 | 无全文索引、无分页 |
| 通知 | CRUD + 标记已读 | 无WebSocket推送、无系统广播 |
| 报告 | GET /reports/{id}/pdf | 返回纯文本，非PDF |

**数据库表（SQLite）：**
- `projects` — 项目 ✓
- `templates` — 模板 ✓
- `scenarios` — 场景 ✓
- `scenario_versions` — 场景版本 ✓
- `simulation_runs` — 仿真运行（仅有status/config/metrics/events）✗ 缺snapshot、cargo、sub-task数据
- `evolutions` — 进化分析（仅有baseline/optimized）✗ 缺多轮仿真数据
- `users` — 用户 ✓
- `auth_tokens` — 认证令牌 ✓
- `notifications` — 通知 ✓
- `project_files` — 项目文件 ✓
- `project_memberships` — 项目成员 ✓

### 前端（React + TypeScript + Three.js）

**已实现但数据源不一致：**

| 页面 | 功能 | 数据源 | 后端对接 |
|---|---|---|---|
| 登录/注册 | 表单验证 | 前端 | ✅ POST /auth/login |
| 首页 | KPI卡片 | mock-data | ❌ 不调用后端 |
| 场景编辑器 | 拖拽编辑 | 前端state | ✅ PUT /scenarios/{id} |
| 仿真页面 | 3D动画+KPI | **本地SimulationEngine** | ⚠️ 只调control/anomaly |
| 进化页面 | 对比图表 | mock-data | ❌ 不调用后端 |
| 编排页面 | 流程图+队列 | mock-data | ❌ 不调用后端 |
| 资源中心 | 模板列表 | mock-data | ❌ 不调用后端 |
| 报告页面 | 图表 | mock-data | ❌ 不调用后端 |
| 搜索 | 全局搜索 | mock-data | ❌ 不调用后端 |
| 通知 | 消息列表 | mock-data | ❌ 不调用后端 |

---

## 二、超级完整修复方案

### 阶段一补全：后端真实化（让后端真正可用）

#### 1.1 仿真引擎后端化（最关键）

**现状**：`SimulationService.tick()` 是假公式 `completion = elapsed * robots / orders * 10`

**方案**：将前端 `SimulationEngine` 移植到后端 Python

```
新建文件: services/api/app/simulation/engine.py
- SimulationEngine (Python版，对齐前端TS)
  - 子任务链（SubTask）调度
  - AGV状态机（14种状态）
  - BFS/A* 路径规划
  - 碰撞检测（spatial + wall）
  - 货物生命周期（Cargo lifecycle）
  - 充电站/工位/机械臂推进
  - 异常注入（AGV故障/充电桩故障/工位停机/道路封锁）
  - 死锁检测与恢复

新建文件: services/api/app/simulation/road_network.py
- RoadNetwork (Python版)
- BFS pathfinding
- A* with reservation table

新建文件: services/api/app/simulation/cargo.py
- Cargo 实体管理
- SKU/inventory 追踪
- 入库/出库流程状态机

新建文件: services/api/app/simulation/agv.py
- AGV 类型约束（tote_amr / pallet_amr）
- 电池模型
- 载重/速度/转弯半径

新建文件: services/api/app/simulation/station.py
- 工位状态机（idle/working/blocked）
- 队列管理
- 机械臂联动

新建文件: services/api/app/simulation/anomaly.py
- 异常注入服务
- 道路封锁（标记edge blocked）
- 设备故障（AGV/充电桩/工位）
- 订单激增（缩短订单间隔）
```

**API改造**：
```
POST /api/v1/simulations/{id}/start  → 启动后端引擎
POST /api/v1/simulations/{id}/pause  → 暂停
POST /api/v1/simulations/{id}/stop   → 停止并保存快照
WS  /api/v1/simulations/{id}/stream  → 实时推送快照（10Hz）
POST /api/v1/simulations/{id}/anomaly  → 注入异常（agv_fault/charger_fault/station_down/road_closure）
GET  /api/v1/simulations/{id}/snapshot  → 获取最新快照
GET  /api/v1/simulations/{id}/cargos    → 获取货物列表
GET  /api/v1/simulations/{id}/subtasks  → 获取子任务链
GET  /api/v1/simulations/{id}/metrics   → 获取KPI
```

**数据库改造**：
```sql
-- 新增表
CREATE TABLE simulation_snapshots (
    id TEXT PRIMARY KEY,
    simulation_id TEXT REFERENCES simulation_runs(id),
    sim_time REAL,
    agvs JSON,           -- 所有AGV状态
    stations JSON,       -- 所有工位状态
    cargos JSON,         -- 所有货物
    sub_tasks JSON,      -- 所有子任务
    metrics JSON,        -- KPI
    timeline JSON,       -- 事件日志
    created_at TIMESTAMP
);

CREATE TABLE simulation_cargos (
    id TEXT PRIMARY KEY,
    simulation_id TEXT,
    cargo_id TEXT,
    sku TEXT,
    type TEXT,
    quantity INTEGER,
    status TEXT,         -- on_shelf/on_agv/at_station/shipped
    location_id TEXT,
    sub_task_id TEXT,
    updated_at TIMESTAMP
);

CREATE TABLE simulation_sub_tasks (
    id TEXT PRIMARY KEY,
    simulation_id TEXT,
    parent_task_id TEXT,
    type TEXT,           -- recv_at_dock/recv_to_buffer/putaway/retrieve/pick/pack/deliver_outbuf/deliver_ship
    status TEXT,
    cargo_id TEXT,
    source_station_id TEXT,
    dest_station_id TEXT,
    required_agv_type TEXT,
    assigned_agv_id TEXT,
    progress REAL,
    created_at TIMESTAMP
);
```

#### 1.2 进化引擎真实化

**现状**：`EvolutionService.create()` 硬编码 `baseline + 0.15`

**方案**：
```
新建文件: services/api/app/evolution/optimizer.py
- EvolutionOptimizer
  - 读取 baseline 仿真结果
  - 生成候选策略（AGV数量/派单权重/充电阈值/路径成本权重）
  - 调用 SimulationEngine 运行 N 次（不同随机种子）
  - 收集 KPI：完成任务量/平均等待/空驶率/拥堵率/能耗/设备利用率
  - 返回最优策略 + 对比报告

API改造：
POST /api/v1/evolutions  → 触发进化分析（异步）
GET  /api/v1/evolutions/{id}  → 获取进化结果
GET  /api/v1/evolutions/{id}/compare  → 获取多轮仿真对比数据
```

#### 1.3 编排引擎真实化

**现状**：所有编排端点返回内存常量

**方案**：
```
新建文件: services/api/app/orchestration/dispatcher.py
- TaskDispatcher
  - 接收订单/子任务
  - AGV派单（考虑距离/电量/类型/工位负载）
  - 路径规划（A* + 预约表）
  - 冲突检测与让行

新建文件: services/api/app/orchestration/congestion.py
- CongestionDetector
  - 检测拥堵区域
  - 计算拥堵指数
  - 推荐分流策略

API改造：
GET  /api/v1/orchestration/agents  → 返回真实调度状态
GET  /api/v1/orchestration/queue   → 返回真实任务队列
GET  /api/v1/orchestration/flow-nodes  → 返回真实流程节点状态
GET  /api/v1/orchestration/strategy  → 返回当前调度策略参数
```

#### 1.4 报告生成真实化

**现状**：`/reports/{id}/pdf` 返回纯文本

**方案**：
```
安装依赖: reportlab, weasyprint
新建文件: services/api/app/reports/generator.py
- ReportGenerator
  - 生成PDF报告（仿真结果摘要、KPI图表、事件日志）
  - 支持HTML模板渲染

API改造：
GET /api/v1/reports/{id}/pdf → 返回真实PDF文件
```

#### 1.5 搜索增强

**现状**：简单字符串匹配，无分页

**方案**：
```
API改造：
GET /api/v1/search?q=&type=&page=1&page_size=20
  - 支持按类型过滤（project/scenario/template/report）
  - 支持分页
  - 支持排序（relevance/created_at）
```

#### 1.6 通知WebSocket推送

**现状**：仅HTTP GET

**方案**：
```
WS /api/v1/notifications/stream → 实时推送新通知
```

#### 1.7 文件管理增强

**现状**：文件上传/下载已实现

**补充**：
```
GET /api/v1/projects/{id}/files  → 列出项目文件
DELETE /api/v1/projects/{id}/files/{id}  → 删除文件
```

---

### 阶段二补全：前端真实化（让前端真正使用后端数据）

#### 2.1 仿真页面后端化

**现状**：前端本地 `SimulationEngine` 驱动3D动画，后端只改status

**方案**：
```
1. 前端 Simulation/index.tsx 改造：
   - 启动仿真时 POST /api/v1/simulations/{id}/start
   - 通过 WebSocket 订阅实时快照
   - 移除本地 SimulationEngine
   - 3D渲染直接消费 WebSocket 推送的 snapshot

2. 前端 API hooks 改造：
   - simulationApi.ts 新增：
     - startSimulation(id)
     - pauseSimulation(id)
     - stopSimulation(id)
     - subscribeSimulation(id, callback)  // WebSocket
     - getSnapshot(id)
     - getCargos(id)
     - getSubTasks(id)
     - getMetrics(id)
     - injectAnomaly(id, type)

3. 前端 SimView3D 改造：
   - 接收 WebSocket snapshot 而非本地引擎数据
   - 3D渲染器消费统一数据源
```

#### 2.2 首页KPI后端化

**现状**：硬编码 mock-data

**方案**：
```
1. 新建后端端点：
   GET /api/v1/dashboard/kpis
     - 返回所有项目的汇总KPI
     - 包括：项目数/场景数/仿真运行数/模板数
   
   GET /api/v1/dashboard/recent-activity
     - 返回最近活动（项目创建/场景保存/仿真完成）

2. 前端 Home/index.tsx 改造：
   - 调用真实API获取KPI
   - 显示真实数据
```

#### 2.3 进化页面后端化

**现状**：mock-data

**方案**：
```
1. 前端 Evolution/index.tsx 改造：
   - 触发进化分析：POST /api/v1/evolutions
   - 获取结果：GET /api/v1/evolutions/{id}
   - 获取对比数据：GET /api/v1/evolutions/{id}/compare
   - 显示真实的多轮仿真对比图表
```

#### 2.4 编排页面后端化

**现状**：mock-data

**方案**：
```
1. 前端 Orchestration/index.tsx 改造：
   - 获取真实代理状态：GET /api/v1/orchestration/agents
   - 获取真实任务队列：GET /api/v1/orchestration/queue
   - 获取真实流程节点：GET /api/v1/orchestration/flow-nodes
   - 获取真实策略参数：GET /api/v1/orchestration/strategy
```

#### 2.5 资源中心后端化

**现状**：mock-data

**方案**：
```
1. 前端 Resource/index.tsx 改造：
   - 获取特色案例：GET /api/v1/resource/featured-cases（后端已有）
   - 获取热门资源：GET /api/v1/resource/hot-resources（后端已有）
   - 获取学习路径：GET /api/v1/resource/learning-path（后端已有）
   - 获取模板列表：GET /api/v1/resource/templates（后端已有）
   → 这些端点后端已实现，只需前端对接
```

#### 2.6 搜索功能后端化

**现状**：mock-data

**方案**：
```
1. 前端 Search/index.tsx 改造：
   - 调用 GET /api/v1/search?q=&type=&page=1&page_size=20
   - 显示搜索结果
```

#### 2.7 通知功能后端化

**现状**：mock-data

**方案**：
```
1. 前端 Notification/index.tsx 改造：
   - 获取通知列表：GET /api/v1/notifications
   - 标记已读：PATCH /api/v1/notifications/{id}/read
   - 全部已读：POST /api/v1/notifications/read-all
   - WebSocket实时推送：WS /api/v1/notifications/stream
```

#### 2.8 报告页面后端化

**现状**：mock-data

**方案**：
```
1. 前端 Report/index.tsx 改造：
   - 获取仿真报告：GET /api/v1/reports/{id}/pdf（下载真实PDF）
   - 获取仿真快照：GET /api/v1/simulations/{id}/snapshot
   - 显示仿真KPI图表
```

---

## 三、实施优先级

### P0（立即实施，影响核心功能）

| 序号 | 任务 | 工作量 | 依赖 |
|---|---|---|---|
| 1 | 仿真引擎后端化（engine.py + road_network.py + cargo.py + agv.py + station.py） | 大 | 无 |
| 2 | 数据库迁移（新增 snapshots/cargos/sub_tasks 表） | 小 | 1 |
| 3 | 仿真API改造（start/pause/stop/stream/snapshot/cargos/subtasks/metrics） | 中 | 1,2 |
| 4 | 前端仿真页面后端化（移除本地引擎，接入WebSocket） | 大 | 3 |
| 5 | 异常注入后端化（agv_fault/charger_fault/station_down/road_closure） | 中 | 1 |

### P1（第二批次，完善核心体验）

| 序号 | 任务 | 工作量 | 依赖 |
|---|---|---|---|
| 6 | 进化引擎真实化（optimizer.py + 多轮仿真对比） | 大 | 1 |
| 7 | 前端进化页面后端化 | 中 | 6 |
| 8 | 编排引擎真实化（dispatcher.py + congestion.py） | 大 | 1 |
| 9 | 前端编排页面后端化 | 中 | 8 |
| 10 | 报告生成真实化（PDF） | 中 | 1 |

### P2（第三批次，锦上添花）

| 序号 | 任务 | 工作量 | 依赖 |
|---|---|---|---|
| 11 | 首页KPI后端化 | 小 | 1 |
| 12 | 前端首页后端化 | 小 | 11 |
| 13 | 资源中心前端对接 | 小 | 后端已有 |
| 14 | 搜索功能增强（分页/排序） | 中 | 1 |
| 15 | 通知WebSocket推送 | 中 | 1 |
| 16 | 前端通知/搜索/资源页面后端化 | 中 | 13-15 |

---

## 四、关键技术决策

### 4.1 仿真引擎技术栈

- **Python**：使用 `asyncio` 实现异步仿真循环
- **路径规划**：BFS + A*（与前端TS版算法保持一致）
- **随机种子**：每次仿真使用固定种子，支持可复现
- **快照频率**：10Hz（每秒10次快照），通过WebSocket推送
- **数据存储**：SQLite（轻量）→ PostgreSQL（生产环境升级）

### 4.2 前后端数据一致性

- **单一数据源**：后端是唯一可信数据源，前端只负责渲染
- **WebSocket流**：仿真运行时通过WebSocket推送实时快照
- **快照差分**：只推送变化的字段，减少网络传输
- **离线降级**：后端不可用时自动切换到mock模式

### 4.3 进化引擎策略

- **可进化参数**：
  - AGV数量及类型配比
  - 派单权重（距离/电量/任务优先级/工位负载）
  - 路径成本权重（距离/拥堵/转弯次数/风险）
  - 充电阈值和目标电量
  - 工位数量和缓冲区容量
  - 订单分波策略和优先级策略

- **评估指标**：
  - 任务完成量最大化
  - 平均等待时间最小化
  - AGV空驶率最小化
  - 拥堵率最小化
  - 能耗最小化
  - 设备利用率合理化

- **多轮仿真**：每个候选策略运行N次（不同随机种子），取平均值

---

## 五、验收标准

### 5.1 仿真功能验收

- [ ] 启动仿真后，后端引擎真实运行，前端通过WebSocket接收实时快照
- [ ] AGV按子任务链执行：入库（RECV→INBUF→HIGH_BAY）/出库（HIGH_BAY→PICK→PACK→OUTBUF→SHIP）
- [ ] Cargo实体在3D场景中正确显示，位置随子任务变化
- [ ] AGV类型约束生效：tote_amr只执行料箱任务，pallet_amr只执行托盘任务
- [ ] 碰撞检测生效：AGV不会穿墙、不会重叠
- [ ] 异常注入生效：AGV故障后停止维护，充电桩故障后队列清空，工位停机后无法派单
- [ ] 死锁检测生效：AGV等待超时时自动重规划
- [ ] 仿真停止后，快照持久化到数据库

### 5.2 进化功能验收

- [ ] 触发进化分析后，后端运行多轮仿真（不同随机种子）
- [ ] 返回最优策略及与基线的对比数据
- [ ] 前端显示对比图表（完成率/等待时间/空驶率/拥堵率/能耗/利用率）
- [ ] 支持一键应用最优策略到当前仿真场景

### 5.3 编排功能验收

- [ ] 代理状态反映真实调度结果
- [ ] 任务队列显示真实子任务链
- [ ] 流程节点状态与实际进度一致
- [ ] 策略参数可配置并实时生效

### 5.4 数据一致性验收

- [ ] 前端3D渲染与后端快照数据完全一致
- [ ] 侧边栏KPI与后端metrics完全一致
- [ ] 事件日志与后端timeline完全一致
- [ ] 货物追踪与后端cargos完全一致

---

## 六、文件清单

### 后端新增文件

```
services/api/app/simulation/
├── __init__.py
├── engine.py              # 仿真引擎主类
├── road_network.py        # 路网+BFS+A*
├── cargo.py               # 货物实体管理
├── agv.py                 # AGV类型/电池/载重
├── station.py             # 工位/机械臂状态机
├── anomaly.py             # 异常注入
└── models.py              # 仿真相关数据库模型

services/api/app/evolution/
├── __init__.py
├── optimizer.py           # 进化优化器
└── models.py              # 进化相关数据库模型

services/api/app/orchestration/
├── __init__.py
├── dispatcher.py          # 任务调度器
├── congestion.py          # 拥堵检测
└── models.py              # 编排相关数据库模型

services/api/app/reports/
├── __init__.py
└── generator.py           # PDF报告生成
```

### 后端修改文件

```
services/api/app/main.py           # 新增仿真/进化/编排API端点
services/api/app/models.py         # 新增仿真快照/货物/子任务表
```

### 前端新增文件

```
apps/web/src/api/modules/simulationWebSocket.ts  # WebSocket订阅
apps/web/src/api/modules/simulationReal.ts       # 真实仿真API
apps/web/src/hooks/useSimulationStream.ts        # 仿真流hook
apps/web/src/hooks/useEvolutionReal.ts           # 进化API hook
apps/web/src/hooks/useOrchestrationReal.ts       # 编排API hook
apps/web/src/hooks/useDashboardReal.ts           # 首页KPI hook
```

### 前端修改文件

```
apps/web/src/pages/Simulation/index.tsx          # 接入后端仿真
apps/web/src/pages/Evolution/index.tsx           # 接入后端进化
apps/web/src/pages/Orchestration/index.tsx       # 接入后端编排
apps/web/src/pages/Home/index.tsx                # 接入后端KPI
apps/web/src/pages/Resource/index.tsx            # 接入后端资源
apps/web/src/pages/Search/index.tsx              # 接入后端搜索
apps/web/src/pages/Notification/index.tsx        # 接入后端通知
apps/web/src/pages/Report/index.tsx              # 接入后端报告
```
