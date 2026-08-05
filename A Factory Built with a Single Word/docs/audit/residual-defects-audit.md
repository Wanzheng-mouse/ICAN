# 本轮整改后残留缺陷审计报告

> 审计时间：2026-07-18
> 审计范围：核心链路 + 系统设计
> 审计方式：只读代码审查（未修改任何代码）
> 验证结果：用户声明的 11 项整改均已落地，代码核对通过

---

## 一、已落地整改确认（11/11 全部通过）

| # | 整改项 | 核心代码位置 | 状态 |
|---|--------|--------------|------|
| 1 | 后端调度器统一推进 | `services/api/app/services/runtime_scheduler.py` | ✅ 已实现 |
| 2 | 独立快照/任务/货物持久化表 | `models.py: SimulationSnapshot/TaskRecord/CargoRecord` | ✅ 已实现 |
| 3 | WebSocket 仅订阅 | `main.py: stream_simulation` 使用 `subscribe()` | ✅ 已实现 |
| 4 | 快照查询读 DB | `SimulationSnapshot` 带唯一约束 | ✅ 已实现 |
| 5 | AI 分析异步化 | `analyze-async` + `BackgroundTasks.add_task` | ✅ 已实现 |
| 6 | 候选方案采用为后端事务 | `apply_generation_candidate` 原子事务 | ✅ 已实现 |
| 7 | 仿真页渲染结构修复 | KPI/3D/控制栏/事件/摘要/AGV 详情齐全 | ✅ 已实现 |
| 8 | 三维平滑插值 | `SimScene.ts: alpha = 1 - Math.exp(-12*delta)` | ✅ 已实现 |
| 9 | 机械臂状态驱动 | `hasHandlingTask` 逻辑 | ✅ 已实现 |
| 10 | prefers-reduced-motion 支持 | `global.ts` + `ArmAnimator.ts` | ✅ 已实现 |
| 11 | DB 迁移 20260721_0005 | `alembic/versions/20260721_0005_*` | ✅ 已实现 |

---

## 二、残留缺陷（20 项，按严重度分级）

### 🔴 P0 — 生产事故级（3 项，必须修复）

#### P0-1：调度器无分布式锁，多 worker 必然双重推进

**位置**：`services/api/app/services/runtime_scheduler.py`、`main.py: lifespan`

**问题**：
- `runtime_scheduler` 是单进程 `asyncio.Task`
- `lifespan` 启动时 `await runtime_scheduler.start()`
- 每个 worker 独立启动自己的调度器实例
- `uvicorn --workers N` → N 个调度器同时 tick 所有 `running` 状态的仿真
- 每个 tick 都会写 `run.config` 和 `SimulationSnapshot` → 唯一约束会抛异常，仿真中断

**影响**：
- 刚修复的 "WS 关闭 → 仿真停" 架构在多 worker 部署下立即崩坏
- 快照表唯一约束 `(simulation_id, elapsed)` 会因双写触发 `IntegrityError`
- 生产环境无法水平扩展

**复现**：`uvicorn app.main:app --workers 2`，启动一个仿真，观察日志将出现两个调度器同时 tick

**推荐方案**：
- 短期：单 worker 部署 + README 标注
- 中期：PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` 抢占式 tick，或 Redis 分布式锁
- 长期：调度器独立为单独服务（Celery worker 或专用进程）

---

#### P0-2：scene_stations 仍是 dict 覆盖，多同类站点信息丢失

**位置**：`services/api/app/services/simulation.py:222`

**问题代码**：
```python
for comp in components:
    if comp.type == "station":
        role = comp.properties.get("role", "station")
        center = (x_center, y_center)
        scene_stations[role] = center  # ← 同 role 的后一个覆盖前一个
```

**影响**：
- 场景里有 3 个拣选站时，`scene_stations["pick"]` 只保留最后一个
- AGV 订单分配永远只送到最后一个站
- `scenarioMapper.ts` 已经把每个站点的坐标和 `properties.role` 都正确传到后端，但后端只用了最后一个
- 这直接破坏了场景编辑器 "多站点布局" 的核心价值

**验证**：在 2D 编辑器放 3 个拣选站，保存场景，启动仿真，观察 AGV 是否只去最后一个站

**推荐方案**：改为 `scene_stations[role] = scene_stations.get(role, []) + [center]`，下游路由按就近原则选择

---

#### P0-3：后端 _route() 不使用 roadNetwork，可能穿货架

**位置**：`services/api/app/services/simulation.py:36`

**问题代码**：
```python
def _route(start, end, stations):
    lanes = [(start[0], start[1], end[0], start[1]),
             (end[0], start[1], end[0], end[1])]
    return lanes  # ← Manhattan 折线，无障碍检测
```

**影响**：
- `scenarioMapper.ts` 已经把 `roadNetwork`（图结构）传到 `scenario_snapshot`
- 后端 `_route()` 完全忽略 `roadNetwork`，纯 Manhattan 折线
- 当货架不在通道线上时，AGV 路径会穿过货架
- 3D 渲染会显示 AGV "穿模"，视觉上非常突兀
- 前端 3D 用的是 `roadNetwork` 的边渲染路径，后端用的是 Manhattan，**两个引擎的路径不一致**

**验证**：在 2D 编辑器放一个货架挡在通道上，启动仿真，观察 3D 中 AGV 是否穿过货架

**推荐方案**：`_route()` 读取 `scenario_snapshot["roadNetwork"]`，使用 BFS/A* 在图上找最短路径

---

### 🟠 P1 — 架构级缺陷（4 项，强烈建议修复）

#### P1-1：run.config 仍是全量 JSON 重写

**位置**：`runtime_scheduler.py: persist_tick`

**问题**：
- 每个 tick 都把整个 `run.config` 反序列化 → 修改 → 序列化回写
- `metric_history`、`runtime_snapshot` 越积越大
- 1000 tick 后，单次写入可能 > 100KB
- SQLite 单写者锁，长事务阻塞读

**影响**：
- 仿真跑 10 分钟后明显卡顿
- WAL 日志膨胀
- 已经有 `SimulationSnapshot` 表了，`run.config` 里的 `runtime_snapshot` 字段是冗余双写

**推荐方案**：`run.config` 只保留 `scenario_snapshot`、`final_summary`；运行时数据全部去 `SimulationSnapshot` 查

---

#### P1-2：runtime 双写（run.config + SimulationSnapshot）

**位置**：`runtime_scheduler.py: persist_tick`

**问题**：
- 同一 tick 的 runtime 状态同时写入 `run.config["runtime_snapshot"]` 和 `SimulationSnapshot.runtime` 行
- 两份数据可能短暂不一致（一次写入失败时）
- 前端 `detailQuery.data.config.runtime_snapshot` 读 JSON，3D 页用；快照恢复走 DB 查询，两条路径不同源

**推荐方案**：删掉 `run.config["runtime_snapshot"]`，3D 页直接查 `GET /simulations/{id}/snapshots/latest`

---

#### P1-3：进化引擎是固定对比，不是优化器

**位置**：`simulation.py: EvolutionService.create` (line 658)

**问题代码**：
```python
candidates = ["balanced", "throughput", "energy_saver", "congestion_aware"]
for strategy in candidates:
    for sample in range(3):
        ...
```

**影响**：
- 4 策略 × 3 样本 = 12 个固定配置，无迭代、无目标权重、无 Pareto 前沿
- 用户期望 "进化" → 实际是 "枚举对比"
- 12 个仿真跑完选最高分，本质上是 grid search

**推荐方案**：
- 短期：明确产品文案为 "策略对比" 而非 "进化"
- 中期：引入 NSGA-II 多目标优化，或贝叶斯优化

---

#### P1-4：evaluate() 忽略场景数据

**位置**：`simulation.py: EvolutionService.evaluate` (line 643)

**问题**：
- `evaluate(config, strategy, seed)` 调用 `_initial_runtime(robot_count, order_count, seed)` 用默认 `STATIONS`
- 不传 `scenario_data`、`agv_positions`、`scene_stations`
- 进化对比的 AGV 起点和站点全用默认值，与真实场景无关
- 导致 "进化结果好" ≠ "真实场景好"

**推荐方案**：`evaluate` 接收 `scenario_snapshot`，与 `create` 共用 `_initial_runtime` 的场景化重载

---

### 🟡 P2 — 产品体验缺陷（8 项，按优先级排）

#### P2-1：无行业布局生成器

- `generateComponents.ts` 只做关键词解析 → 固定示例
- 用户输入 "电商仓" 和 "汽车零部件仓" 得到的是同一套组件（只是数量不同）
- 缺少按行业特征生成货架排列、通道宽度、拣选站数量的逻辑

#### P2-2：无米制/边界校验

- 2D 编辑器 `width/height` 单位不明确
- 拖拽组件不检测是否超出画布、是否重叠
- 后端不校验 AGV 起点是否在通道上

#### P2-3：3D 无点击详情

- 3D 画布点击 AGV/货架无响应
- 缺少 hover tooltip 显示 AGV 当前任务、货架库存

#### P2-4：无延迟/拥堵指示器

- KPI 区只有吞吐量、完成率，无平均延迟、最大延迟
- 3D 不高亮拥堵区域（多个 AGV 排队）

#### P2-5：无设计 Token 系统

- 颜色、间距、圆角散落在各组件 `style` 属性
- 缺少 `tokens.ts` 或 CSS 变量集中管理
- 暗色模式切换靠 `theme.isDark` 散点判断

#### P2-6：Home Hero 静态

- 首页 Hero 区无 3D 粒子或动态背景
- 与 "premium" 定位不符

#### P2-7：AI 分析无 SSE 进度推送

- `analyze-async` 返回 202 后前端轮询
- 5 分钟分析期间用户只看到 spinner
- 缺少 "正在解析需求 / 正在生成候选 / 正在评估" 的阶段进度

#### P2-8：运行事件不持久化

- `SimulationEvent` 只在 `run.config["events"]` 内存数组
- 刷新页面后事件丢失
- 无法回看 "第 30 秒发生了什么"

---

### ⚪ P3 — 代码卫生（5 项，低优先级）

#### P3-1：main.py 存在死代码

- `stream_simulation` WebSocket handler 中 `return` 之后的旧 tick 循环未删除
- 容易让后续维护者误以为还在执行

#### P3-2：Simulation/index.tsx `_getWarehouseConfig` 死代码

- `services/api/app/main.py` 旁边的 `_getWarehouseConfig` 缓存工厂已无人调用
- 与 `scenarioToWarehouseConfig` 重复

#### P3-3：大量 `as any` 类型断言

- `displayAgvs`、`backendTick` 等多处 `as any`
- 丢失类型安全

#### P3-4：scenario_hash 不校验

- `create_simulation` 存储 `scenario_hash` 但不校验
- 无法防止 "前端改了场景但 version 没变" 的数据不一致

#### P3-5：schema_version 无迁移机制

- `ScenarioData.schema_version = "1.0"` 是硬编码
- 缺少升级 v1 → v2 的迁移函数

---

## 三、整改优先级建议

### 第一波（必须先做，否则整改成果被抵消）
1. **P0-1 调度器分布式锁** — 否则多 worker 部署直接崩
2. **P0-2 scene_stations 改列表** — 否则多站点场景无效
3. **P0-3 _route 接入 roadNetwork** — 否则穿货架 + 前后端路径不一致

### 第二波（架构收口）
4. P1-1 + P1-2 删除 run.config 的 runtime 双写
5. P1-4 evaluate 接入场景数据

### 第三波（产品打磨）
6. P2-3 3D 点击详情
7. P2-4 延迟/拥堵指示器
8. P2-7 AI 分析 SSE 进度

### 第四波（代码卫生）
9. P3-1 ~ P3-5 清理死代码、补类型、加 hash 校验

---

## 四、与上轮整改的对照

| 上轮发现的问题 | 本轮状态 |
|----------------|----------|
| WebSocket 关闭 → 仿真停 | ✅ 已修复（调度器接管） |
| 两个浏览器双 viewer 双 tick | ✅ 已修复（WS 仅订阅） |
| AI 分析 5min 同步阻塞 | ✅ 已修复（异步任务） |
| 候选方案前端创建场景 | ✅ 已修复（后端事务） |
| Mutation 反馈不及时 | ✅ 已修复（setQueryData） |
| 3D 卡顿 | ✅ 已修复（插值 + visibility） |
| 机械臂常亮 | ✅ 已修复（状态驱动） |
| scene_stations dict 覆盖 | ❌ 仍未修复（P0-2） |
| Manhattan 路由穿货架 | ❌ 仍未修复（P0-3） |
| 进化非优化器 | ❌ 仍未修复（P1-3） |

**结论**：本轮整改把 "运行时架构" 层面的 7 个问题全部解决，但 "仿真引擎内核" 层面的 3 个 P0 问题原封不动。下一轮应聚焦仿真内核。

---

**审计人**：Senior Developer
**审计方式**：只读代码审查
**未修改任何代码**
