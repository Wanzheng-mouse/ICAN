# ICAN 无人仓仿真决策平台 — 系统设计缺陷审计报告

> 审计日期: 2025-07-19
> 审计范围: 需求生成 → 场景保存 → 仿真运行 → 3D 显示 全链路
> 审计方式: 只读代码审查，未修改任何代码

---

## 一、P0 — 破坏数据闭环的断点（4 项）

### 断点 1: 双仿真引擎坐标系完全脱节

**位置**: `services/api/app/services/simulation.py` vs `apps/web/src/components/SimView3D/simulationEngine.ts`

系统存在两个**完全独立**的仿真引擎，它们使用不同的坐标系、不同的工位定义、不同的路径算法：

| 维度 | 后端 SimulationService | 前端 SimulationEngine |
|------|----------------------|----------------------|
| AGV 位置 | 从 scenario 组件提取 ✓ | PARKING_BAYS 硬编码 ✗ |
| AGV ID | `agv-01`, `agv-02` | `TAMR-01`, `PAMR-01` |
| 工位系统 | STATIONS dict（6 角色） | 硬编码 7 个工位（ST-PICK-A/B...） |
| 路径规划 | `_route()` 曼哈顿路由 | `bfsPathOnNetwork()` BFS 走路网 |
| 坐标空间 | STATIONS 坐标系 | warehouseConfig 坐标系 |
| route 格式 | `list[dict[str,float]]` | `Array<[number, number]>` |

**后果**: 后端 tick 返回的 `robot.x/y` 在前端 3D 视图中被直接用作渲染坐标，但两个坐标空间不一致。用户看到 AGV 在 3D 场景中"瞬移"或穿越货架。

**关键代码**:
- 后端 `_route()` (simulation.py:36-73): 曼哈顿路由，不走 roadNetwork
- 前端 `SimulationEngine.initWorld()` (simulationEngine.ts:301-446): 硬编码 PARKING_BAYS 和 7 个工位
- 前端 `displayAgvs` (Simulation/index.tsx:474-533): `backendTick.robots` 的坐标被直接映射到 3D 渲染

### 断点 2: 后端 STATIONS dict 无法表达多工位场景

**位置**: `services/api/app/services/simulation.py:15-22`

```python
STATIONS = {
    "inbound": {"x": 150.0, "y": 500.0},
    "storage": {"x": 430.0, "y": 260.0},
    "pick": {"x": 650.0, "y": 500.0},
    "pack": {"x": 850.0, "y": 650.0},
    "outbound": {"x": 1050.0, "y": 500.0},
    "charge": {"x": 240.0, "y": 820.0},
}
```

后端 `SimulationService.create` 在提取场景工位时：

```python
if comp.get("type") == "station":
    station_type = str((comp.get("properties") or {}).get("station_type", "pick")).lower()
    role = {"pick": "pick", "pack": "pack", ...}.get(station_type)
    if role:
        scene_stations[role] = center  # ← dict 覆写！
```

如果场景有 3 个 pick 工位，**只保留最后一个的位置**。缺少的工位类型回退到 STATIONS 默认值，该默认值与场景布局无关。

### 断点 3: 后端路径规划可穿越货架

**位置**: `services/api/app/services/simulation.py:36-73`

后端 `_route()` 函数使用曼哈顿路由（水平段 + 垂直段），完全不考虑 roadNetwork 或场景中的障碍物：

```python
def _route(start, end, lane, stations):
    lane_y = max(60.0, service_y - 155.0) + (lane % 3) * 52.0
    points = [
        origin,
        {"x": origin["x"], "y": lane_y},
        {"x": float(end["x"]), "y": lane_y},
        {"x": float(end["x"]), "y": float(end["y"])},
    ]
```

前端 `scenarioMapper.ts` 的 `buildRoadNetwork()` 精心构建了避障路网（过滤障碍物、BFS 连通性检查），但后端完全不使用这个路网。后端 AGV 的运动路径可能直接穿过货架区域。

### 断点 4: 前端 SimulationEngine.initWorld() 忽略场景组件

**位置**: `apps/web/src/components/SimView3D/simulationEngine.ts:301-446`

虽然 `SimulationEngine` 构造函数接收 `warehouseConfig` 参数，但 `initWorld()` 方法：

1. **AGV**: 从 `PARKING_BAYS` 硬编码数组创建，位置和数量与场景 AGV 组件无关
2. **工位**: 硬编码 7 个工位（ST-PICK-A/B, ST-PACK-1/2, ST-INBOUND, ST-OUTBOUND, ST-RECV）
3. **充电桩**: 硬编码 2 个（CHG-01, CHG-02），位置从 `ZONE-CHARGE` 区域中心偏移
4. **货架**: 不从 `warehouseConfig.shelfZones` 初始化货位状态

`Simulation/index.tsx` 的 `displayAgvs` 和 `sim3DProps` 通过 `usesSavedSceneLayout` 标志做了视觉覆盖（渲染时用场景组件位置替代引擎位置），但底层引擎逻辑（任务分配、路径规划、拥堵计算）仍然使用硬编码世界。

---

## 二、P1 — 架构设计缺陷（4 项）

### 缺陷 5: Mock 模式完全绕过数据闭环

**位置**: `apps/web/src/hooks/useSimulationStream.ts:45-68`, `apps/web/src/api/modules/simulationApi.ts:86-101`

当 `isMockEnabled('simulation')` 为 true 时：

- `mockTick()` 硬编码 `robotCount = 10`, `total = 20`，不读场景
- `createSimulation` mock 不存储 `scenario_snapshot`
- `mockRead()` 返回的 config 只有 `{ robot_count: 10, order_count: 20 }`

Mock 模式下整个数据闭环形同虚设。开发和演示环境如果开启 mock，用户看到的仿真与编辑器场景完全无关。

### 缺陷 6: 首页双生成路径可能产生冲突结果

**位置**: `apps/web/src/pages/Home/index.tsx`

当前 `handleGenerate` 调用 LLM 分析流程（`analyzeRequirement` → `handleGenerateCandidates` → `handleSelectCandidate`），候选方案由后端 `_smart_candidate_scene()` 生成组件。

但 `handleUseExample` 打开示例 Modal 后，`handleSelectExample` 只是把示例文本填入输入框：

```typescript
const handleSelectExample = (example) => {
  setRequirement(example.requirement);  // 只填文本
  setShowExampleModal(false);
  message.info('已填入示例需求，点击开始生成即可创建场景');
};
```

用户选择"电商仓储"示例（预期 5 台料箱 AGV + 8 组货架）后点击"开始生成"，LLM 分析可能生成**完全不同**的设备组合，因为 LLM 的解析逻辑与示例的 `counts` 无关。

### 缺陷 7: 场景版本漂移风险（无乐观锁）

**位置**: `services/api/app/main.py` create_simulation 端点, `apps/web/src/pages/Editor/index.tsx:496`

编辑器发送 `scenario_version: scenarioVersion ?? undefined`，但 `scenarioVersion` 来自本地 React state。如果用户在编辑器保持打开的同时，另一个会话保存了新版本：

- `scenario_version` 会指向旧版本
- 后端 `latest_scenario_version(db, scenario.id)` 会返回最新版本
- 但 `payload.scenario_version or latest_scenario_version(...)` 中，如果前端发了非 null 的旧版本，后端会用旧版本号存储快照
- 快照内容（`scenario.data`）始终是最新版本的数据，但 `scenario_version` 标签是旧的

### 缺陷 8: 3D 场景加载无错误边界

**位置**: `apps/web/src/pages/Simulation/index.tsx:148-153`

```typescript
const scenarioResult = useMemo(
  () => scenarioToWarehouseConfig(scenarioSnapshot),
  [scenarioSnapshot],
);
```

如果 `scenarioSnapshot` 数据格式异常（如缺少 `canvas`、`components` 含非法值），`scenarioToWarehouseConfig` 抛出的异常没有 try/catch 包裹，会导致整个 Simulation 页面白屏崩溃。

---

## 三、P2 — 功能完整性缺陷（5 项）

### 缺陷 9: 传送带和障碍物组件无仿真语义

`conveyor` 和 `obstacle` 类型在 `ScenarioComponent` 中有定义，编辑器可以放置，`scenarioMapper.ts` 将它们视为路网障碍物。但：

- 后端 `_initial_runtime` 不处理 conveyor
- 前端 `SimulationEngine` 不建模传送带行为
- 没有货物在传送带上流动的仿真逻辑

### 缺陷 10: 仿真事件在运行期间从不更新

**位置**: `services/api/app/services/simulation.py:403-442`

`tick()` 方法返回 `events: run.events or []`，但整个 tick 过程中 `run.events` 从未被追加新事件。仿真运行期间产生的拥堵、低电量、任务完成等事件不会被持久化或推送到前端。

### 缺陷 11: 历史仿真不可重放

后端存储了 `scenario_snapshot` + `scenario_hash` 用于可复现性，但：

- 没有"重放" API 端点
- `runtime_snapshot` 在每次 tick 中被原地修改（deepcopy 后修改再写回），历史快照丢失
- `snapshot_history` 存储了机器人位置历史，但前端从不读取或展示

### 缺陷 12: 进化引擎与仿真运行无关联校验

**位置**: `apps/web/src/pages/Simulation/index.tsx:421-441`

`handleEvolution` 创建进化分析时，不检查仿真是否已运行足够时间或完成足够任务。用户可以在仿真刚创建、0 任务完成的情况下触发进化分析。

### 缺陷 13: schema_version 与 scenario_version 概念混淆

系统有两个版本概念但无关联：
- `schema_version`: 字符串 `"1.0"`，在 `ScenarioData` 中定义，无迁移逻辑
- `scenario_version`: 整数，每次保存递增，存在 `ScenarioRead` 和 `run.config` 中

未来 schema 变更时，旧版本的 `scenario_snapshot` 没有 migration 路径。

---

## 四、P3 — 性能与安全缺陷（4 项）

### 缺陷 14: tick 每次 deepcopy 全部运行时状态

**位置**: `services/api/app/services/simulation.py:404`

```python
runtime = deepcopy(config.get("runtime_snapshot"))
```

每个 WebSocket tick（每秒 1 次）都 deepcopy 整个 runtime（包含所有 robots、tasks、stations）。对于 100 台 AGV + 1000 个订单的场景，每次 deepcopy 可能耗时数十毫秒。

### 缺陷 15: WebSocket 连接无超时和会话清理

**位置**: `services/api/app/main.py` stream_simulation 端点

`while True` 循环没有最大连接时长。如果客户端断开但未发送 close frame，服务端会持续循环。每个连接持有独立 DB session，大量僵尸连接会耗尽连接池。

### 缺陷 16: 仿真创建无速率限制

`create_simulation` 端点无 rate limiting，用户可以对同一场景创建无限数量的仿真运行。每次创建都 deepcopy 场景数据存入 `run.config`。

### 缺陷 17: scenario_hash 存储但不校验

后端在创建仿真时计算 `scenario_hash`（SHA256 前 16 位）存入 `run.config`，但后续读取时从不验证 hash 是否匹配。hash 目前只是一个标签，没有完整性校验功能。

---

## 五、代码卫生问题（3 项）

### 18: 死代码 — `_getWarehouseConfig` 缓存

`Simulation/index.tsx:62-68` 定义了模块级缓存的 `_getWarehouseConfig()` 函数，但该函数从未被调用（实际使用 `scenarioResult.config`）。

### 19: 类型安全绕过 — `as any` 类型断言

`Simulation/index.tsx` 多处使用 `as any` 绕过类型检查：
- 第 503 行: `(a as any).type ?? 'tote_amr'`
- 第 515 行: `(agv as { type?: string }).type`
- 第 524 行: `(saved?.properties.agv_type ?? (agv as { type?: string }).type ?? 'tote_amr')`

### 20: `buildLegacyRoadNetwork` 函数被 `buildRoadNetwork` 替代但仍保留

`scenarioMapper.ts:313-409` 的 `buildLegacyRoadNetwork` 已被 `buildRoadNetwork` (417-509) 替代，但旧函数仍保留在文件中，增加维护负担。

---

## 六、优先级排序建议

| 优先级 | 编号 | 问题 | 影响范围 |
|--------|------|------|----------|
| P0 | 1 | 双引擎坐标系脱节 | 3D 渲染坐标错误 |
| P0 | 2 | STATIONS dict 无法表达多工位 | 多工位场景仿真失真 |
| P0 | 3 | 后端路径可穿越货架 | 仿真路径不真实 |
| P0 | 4 | 前端引擎忽略场景组件 | 引擎逻辑与视觉脱节 |
| P1 | 5 | Mock 模式绕过闭环 | 开发环境数据不一致 |
| P1 | 6 | 双生成路径冲突 | 示例结果不可预期 |
| P1 | 7 | 版本漂移风险 | 历史仿真不可复现 |
| P1 | 8 | 3D 加载无错误边界 | 页面白屏风险 |
| P2 | 9-13 | 功能完整性缺陷 | 仿真精度和可用性 |
| P3 | 14-17 | 性能与安全 | 大规模场景和安全性 |
| — | 18-20 | 代码卫生 | 可维护性 |
