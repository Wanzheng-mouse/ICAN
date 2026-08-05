# ICAN 无人仓仿真决策平台 — 完整调用链路审计报告

**审计时间**: 2026-07-25
**审计范围**: 前端入口 → 后端服务 → 数据持久化的完整调用链
**审计方法**: 逐文件代码审查 + 跨层调用追踪

---

## 审计摘要

| 严重级别 | 数量 | 说明 |
|---------|------|------|
| **P0 (阻断/数据损坏)** | 3 | 必须立即修复，影响核心功能可用性 |
| **P1 (高优先级)** | 8 | 影响可靠性、一致性或性能 |
| **P2 (中优先级)** | 11 | 边界场景或非关键路径问题 |

**已验证修复的历史问题** (上次审计的 P0/P1 已在代码中确认修复):
- ✅ P0-1: `RuntimeScheduler` 分布式锁 — `_acquire_lease()` 使用 `SimulationRuntimeLease` 表
- ✅ P0-2: `scene_stations` 字典覆盖 — 改用 `scene_station_pools` 列表
- ✅ P0-3: Manhattan 路由穿货架 — `_astar_route()` A* 寻路 + 障碍物膨胀
- ✅ P1-3: 进化引擎固定对比 — 4 代 NSGA 多目标优化 + Pareto 前沿
- ✅ P1-4: evaluate 忽略场景 — 复用 `initial_runtime_snapshot`

---

## 审计维度一：数据流转路径完整性

### F1-1 [P0] `add_anomaly` 调用缺少必需参数 `description`

**位置**:
- 调用方: `services/api/app/main.py:716`
- 定义方: `services/api/app/services/simulation.py:655`

**问题**:
```python
# main.py:716 — 只传了 2 个参数
run = simulation_service.add_anomaly(run, payload.type)

# simulation.py:655 — 需要 3 个参数
def add_anomaly(self, run: SimulationRun, anomaly_type: str, description: str) -> SimulationRun:
```

**影响**: 调用注入异常 API (`POST /simulations/{id}/anomalies`) 时抛出 `TypeError: add_anomaly() missing 1 required positional argument: 'description'`，返回 500 错误。**异常注入功能完全不可用**。

**修复方案**:
```python
# main.py:716
run = simulation_service.add_anomaly(run, payload.type, payload.description)
```

---

### F1-2 [P0] 后端缺失三个仿真操作端点

**位置**:
- 前端调用方: `apps/web/src/api/modules/simulationApi.ts:155-171`
- 后端: `services/api/app/main.py` (无对应端点)

**问题**: 前端定义了三个 API 调用，但后端 `main.py` 中没有对应的路由定义:

| 前端函数 | 调用路径 | 后端状态 |
|---------|---------|---------|
| `reassignSimulationTask` | `POST /simulations/{id}/tasks/{taskId}/reassign` | ❌ 缺失 |
| `chargeSimulationRobot` | `POST /simulations/{id}/devices/{robotId}/charge` | ❌ 缺失 |
| `createSimulationOrder` | `POST /simulations/{id}/orders` | ❌ 缺失 |

**影响**: 这三个功能在生产环境返回 404。`simulation.py:694-762` 已实现 `reassign_task`、`charge_robot`、`add_order` 方法，但未被任何 HTTP 端点调用。任务改派、强制充电、动态加单功能完全不可用。

**修复方案**: 在 `main.py` 中补充三个端点:
```python
@app.post(f"{PREFIX}/simulations/{{simulation_id}}/tasks/{{task_id}}/reassign", response_model=SimulationRead, tags=["simulations"])
def reassign_task(simulation_id: str, task_id: str, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    run = require_simulation_access(simulation_id, user, db, write=True)
    run = simulation_service.reassign_task(run, task_id, payload.get("robot_id"), payload.get("priority"))
    persist_runtime(db, run)
    db.commit()
    db.refresh(run)
    return run

@app.post(f"{PREFIX}/simulations/{{simulation_id}}/devices/{{robot_id}}/charge", response_model=SimulationRead, tags=["simulations"])
def charge_robot(simulation_id: str, robot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    run = require_simulation_access(simulation_id, user, db, write=True)
    run = simulation_service.charge_robot(run, robot_id)
    persist_runtime(db, run)
    db.commit()
    db.refresh(run)
    return run

@app.post(f"{PREFIX}/simulations/{{simulation_id}}/orders", response_model=SimulationRead, tags=["simulations"])
def add_order(simulation_id: str, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    run = require_simulation_access(simulation_id, user, db, write=True)
    run = simulation_service.add_order(run, payload.get("priority", 3), payload.get("kind", "outbound"))
    persist_runtime(db, run)
    db.commit()
    db.refresh(run)
    return run
```

---

### F1-3 [P1] Mock 模式与生产模式数据结构不一致

**位置**:
- Mock 路径: `apps/web/src/api/modules/simulationApi.ts:28-48, 88-99`
- 生产路径: `services/api/app/services/simulation.py:359-377`
- 消费方: `apps/web/src/pages/Simulation/index.tsx:164-174`

**问题**:
Mock 的 `SimulationRead` 缺少关键字段:
```typescript
// simulationApi.ts:36 — mock 返回的 config
config: { robot_count: 10, order_count: mockRun.totalOrders || 20 },

// simulation.py:359-377 — 生产返回的 config 包含
config = {
    "robot_count": ..., "order_count": ..., "random_seed": ...,
    "strategy": ..., "elapsed": 0,
    "runtime_snapshot": runtime,
    "initial_runtime_snapshot": deepcopy(runtime),
    "scenario_snapshot": scenario_snapshot,  // ← mock 缺失
    "scenario_version": ...,                 // ← mock 缺失
    "scenario_hash": ...,                    // ← mock 缺失
    "scene_robot_count": ...,                // ← mock 缺失
    "fallback": ...,                         // ← mock 缺失
}
```

前端 `Simulation/index.tsx:164` 依赖 `detailQuery.data.config.scenario_snapshot` 构建 3D 场景。Mock 模式下此字段为 `undefined`，导致 `scenarioToWarehouseConfig` 降级到 fallback 工厂配置。

**影响**: 开发环境（`VITE_USE_MOCK=true`）无法复现生产环境的场景渲染行为，开发与生产数据形状不一致。

**修复方案**: 在 mock 路径中补充完整字段，或让 mock 也走 `scenarioToWarehouseConfig` 的 fallback 路径并明确标注。

---

### F1-4 [P2] `getProjectSimulations` 缺少 Mock 分支

**位置**: `apps/web/src/api/modules/simulationApi.ts:109-111`

**问题**:
```typescript
export async function getProjectSimulations(projectId: string): Promise<SimulationRead[]> {
  return request({ url: apiUrl(`/projects/${projectId}/simulations`) });
  // 没有 if (USE_MOCK) 分支
}
```

其他所有仿真 API 都有 `if (USE_MOCK)` 分支，唯独此函数遗漏。

**影响**: Mock 模式下项目仿真列表请求会失败（无后端）。

**修复方案**: 补充 mock 分支返回空数组或 mock 数据。

---

## 审计维度二：服务间参数与异常处理

### F2-1 [P1] `apply_generation_candidate` 使用错误逻辑查找 Job

**位置**: `services/api/app/main.py:957-958`

**问题**:
```python
# 前端调用: POST /generation/candidates/{candidate_id}/apply
# 后端接收: candidate_id 来自 URL，jobId 不在 URL 中

# main.py:957-958 — 不使用 candidate_id 中的 job 前缀，而是取用户最新 job
job = db.query(GenerationJob).filter(
    GenerationJob.user_id == user.id
).order_by(GenerationJob.created_at.desc()).first()
```

前端 `generationApi.ts:203` 的 `candidate_id` 格式为 `{job_id[:8]}-{strategy}`（见 `main.py:952`），但后端不解析此前缀，直接取用户最新的 GenerationJob。

**影响**: 用户有多个需求分析任务时，候选方案可能应用到错误的 Job，导致场景数据与需求不匹配。

**修复方案**:
```python
# 方案 A: 从 candidate_id 解析 job_id 前缀
job_prefix = candidate_id.split("-")[0] if "-" in candidate_id else None
job = db.query(GenerationJob).filter(
    GenerationJob.user_id == user.id,
    GenerationJob.id.startswith(job_prefix) if job_prefix else True
).order_by(GenerationJob.created_at.desc()).first()

# 方案 B (推荐): 修改 URL 为 /generation/{job_id}/candidates/{candidate_id}/apply
```

---

### F2-2 [P1] `upload_project_file` 在同步路由中使用 `asyncio.run(request.body())`

**位置**: `services/api/app/main.py:511`

**问题**:
```python
@app.post(f"{PREFIX}/projects/{{project_id}}/files", ...)
def upload_project_file(...):  # 同步路由
    import asyncio
    body = asyncio.run(request.body())  # ← 在同步上下文中创建新事件循环
```

FastAPI 同步路由在 threadpool 中执行，但 `request.body()` 是 async 方法。`asyncio.run()` 会创建新事件循环，如果主事件循环正在运行，可能抛出 `RuntimeError: Cannot run the event loop while another loop is running`。

**影响**: 文件上传在某些 ASGI 服务器配置下可能失败。

**修复方案**:
```python
# 改为 async 路由
@app.post(f"{PREFIX}/projects/{{project_id}}/files", ...)
async def upload_project_file(...):
    body = await request.body()
```

---

### F2-3 [P2] `run_simulation_to_completion` 未校验 run 状态

**位置**: `services/api/app/main.py:723-739`

**问题**:
```python
def run_simulation_to_completion(simulation_id: str, max_seconds: int = 3600, ...):
    run = require_simulation_access(simulation_id, user, db, write=True)
    # 没有检查 run.status，即使已 stopped/paused 也会执行 tick 循环
    while elapsed < limit and float((run.metrics or {}).get("completion_rate", 0)) < 1:
        elapsed = min(limit, elapsed + 60)
        hydrate_runtime(db, run)
        tick = simulation_service.tick(run, elapsed)
        persist_tick(db, run, tick)
```

**影响**: 已停止或暂停的 run 可能被意外推进，与 `RuntimeScheduler` 的 tick 产生冲突。

**修复方案**:
```python
if run.status not in ("running", "created"):
    raise HTTPException(status_code=409, detail=f"仿真状态为「{run.status}」，无法运行到完成")
```

---

## 审计维度三：并发与数据一致性

### F3-1 [P1] `RateLimitMiddleware` 仅限单进程

**位置**: `services/api/app/middleware/rate_limit.py:13-14, 21-22`

**问题**:
```python
class RateLimitMiddleware(BaseHTTPMiddleware):
    """Small in-process sliding-window limiter suitable for a single API instance."""
    self.requests: dict[str, deque[float]] = defaultdict(deque)  # 内存存储
    self.lock = Lock()  # 线程锁，非进程锁
```

**影响**: 多 worker 部署（gunicorn -w 4）时，每个 worker 有独立的计数器。实际限流 = `limit × worker_count`。例如 auth_limit=30，4 worker 下实际允许 120 次/分钟，无法有效防御暴力破解。

**修复方案**: 使用 Redis 实现分布式滑动窗口，或使用数据库计数器。如果确认单进程部署，则在文档中明确标注限制。

---

### F3-2 [P2] `persist_tick` 的 snapshot 写入存在竞态

**位置**: `services/api/app/services/runtime_scheduler.py:123-126`

**问题**:
```python
row = db.query(SimulationSnapshot).filter_by(
    simulation_id=run.id, elapsed=elapsed
).one_or_none()
if row is None:
    row = SimulationSnapshot(simulation_id=run.id, elapsed=elapsed)
    db.add(row)
# 没有 try/except IntegrityError
```

虽然 `_acquire_lease` 防止多 worker 同时 tick，但 `snapshot_from_run`（WebSocket 首帧）不获取 lease，直接调用 `tick` + `persist_tick`。如果 scheduler 正好在同一秒 tick，两个事务可能都看到 `row is None`，都尝试 INSERT，第二个触发 `UniqueConstraint` 冲突。

**影响**: 极端情况下 WebSocket 首帧与 scheduler tick 冲突，导致一方事务回滚。

**修复方案**:
```python
try:
    with db.begin_nested():
        if row is None:
            db.add(SimulationSnapshot(simulation_id=run.id, elapsed=elapsed))
            db.flush()
except IntegrityError:
    db.rollback()
    row = db.query(SimulationSnapshot).filter_by(
        simulation_id=run.id, elapsed=elapsed
    ).one()
```

---

### F3-3 [P2] `update_scenario` 版本检查存在 TOCTOU 竞态

**位置**: `services/api/app/main.py:642-653`

**问题**:
```python
current_version = latest_scenario_version(db, scenario_id)
if payload.expected_version is not None and payload.expected_version != current_version:
    raise HTTPException(status_code=409, ...)
# ... 保存数据 ...
add_scenario_version(db, scenario, current_version + 1)
```

读版本号与写新版本之间没有锁。两个并发请求可能都读到 version=N，都写 version=N+1。

**影响**: 并发保存场景时可能丢失一个版本的变更，或产生重复版本号。

**修复方案**: 使用 `SELECT ... FOR UPDATE` 锁定 scenario 行，或在 `ScenarioVersion` 表上使用数据库序列。

---

### F3-4 [P2] `apply_generation_candidate` 无幂等保护

**位置**: `services/api/app/main.py:956-971`

**问题**: 与 `create_project`（有 `X-Idempotency-Key` 检查）不同，`apply_generation_candidate` 没有幂等保护。网络重试会创建多个同名场景。

**修复方案**: 添加 `X-Idempotency-Key` header 检查，或基于 `candidate_id` 去重。

---

## 审计维度四：错误处理与降级机制

### F4-1 [P1] WebSocket 端点静默吞掉所有异常

**位置**:
- `services/api/app/main.py:778-779` (`stream_simulation`)
- `services/api/app/main.py:1099-1100` (`stream_notifications`)

**问题**:
```python
# main.py:778-779
except Exception:
    pass  # 所有异常（包括数据库错误、序列化错误）被静默吞掉
```

**影响**:
- 连接断开原因无法排查
- 数据库错误不会被记录
- 客户端只收到连接关闭，不知道原因，导致无限重连

**修复方案**:
```python
except WebSocketDisconnect:
    logger.info("WebSocket disconnected for simulation %s", simulation_id)
except Exception:
    logger.exception("WebSocket error for simulation %s", simulation_id)
finally:
    runtime_scheduler.unsubscribe(simulation_id, queue)
```

---

### F4-2 [P1] `analyze_requirement` 同步调用 LLM 无后端超时

**位置**: `services/api/app/main.py:913-926`

**问题**:
```python
@app.post(f"{PREFIX}/generation/analyze", ...)
def analyze_requirement(payload, user, db):  # 同步路由
    # ...
    analysis_result = analyze_with_agnes(requirement, sources, settings) if settings.agnes_api_key else {}
    # 没有 timeout，LLM 卡住时请求一直挂着
```

前端设置了 5 分钟超时（`generationApi.ts:103`），但后端没有超时控制。如果 LLM API 卡住，请求会一直占用 worker 线程。

**影响**: 慢请求累积可能导致 worker 耗尽，服务不可用。

**修复方案**:
```python
import concurrent.futures

with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
    future = executor.submit(analyze_with_agnes, requirement, sources, settings)
    try:
        analysis_result = future.result(timeout=240)  # 4 分钟超时
    except concurrent.futures.TimeoutError:
        raise HTTPException(status_code=504, detail="AI 分析超时，请使用异步接口 /generation/analyze-async")
```

---

### F4-3 [P2] `WsClient.onmessage` 静默丢弃非 JSON 消息

**位置**: `apps/web/src/api/ws.ts:57-64`

**问题**:
```typescript
this.ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data?.type === 'pong') return;
    this.opts.onMessage?.(data);
  } catch {
    this.opts.onMessage?.(event.data);  // 传原始字符串
  }
};
```

`useSimulationStream.ts:146` 的 `isSimulationTick(payload)` 对字符串返回 `false`，非 JSON 消息被静默丢弃。

**影响**: 通信错误无法被前端感知。

**修复方案**: 在 catch 中调用 `onError` 或记录日志。

---

### F4-4 [P2] `pollRequirementAnalysis` 无指数退避

**位置**: `apps/web/src/api/modules/generationApi.ts:173-182`

**问题**: 固定 2 秒间隔轮询 150 次（5 分钟），对服务器造成稳定压力。

**修复方案**:
```typescript
const delay = Math.min(2000 * Math.pow(1.5, Math.floor(attempt / 5)), 10000);
await new Promise(resolve => window.setTimeout(resolve, delay));
```

---

### F4-5 [P2] `snapshot_from_run` 失败导致 WebSocket 无限重连

**位置**: `services/api/app/main.py:774`

**问题**:
```python
await websocket.send_json(snapshot_from_run(db, run))
# 如果 snapshot_from_run 抛异常（场景配置损坏），进入 except Exception: pass
# 客户端只收到连接关闭，触发自动重连
```

**影响**: 场景配置损坏时，客户端无限重连，每次都失败。

**修复方案**: 在 `snapshot_from_run` 外层 try/except，发送错误消息给客户端。

---

## 审计维度五：性能瓶颈

### F5-1 [P1] `tick` 每次深拷贝整个 `run.config`

**位置**: `services/api/app/services/simulation.py:594-595`

**问题**:
```python
def tick(self, run: SimulationRun, elapsed: int) -> dict[str, Any]:
    config = deepcopy(run.config or {})  # 深拷贝整个 config
    runtime = deepcopy(config.get("runtime_snapshot"))  # 再次深拷贝 runtime
```

`run.config` 包含 `scenario_snapshot`（可能数 KB）、`metric_history`（最多 300 条）、`initial_runtime_snapshot`（完整 runtime）等。每次 tick 都深拷贝两次。

**影响**: 大场景（100+ 货架）时，每次 tick 的 deepcopy 开销可达数毫秒，高频 tick 下 CPU 占用显著。

**修复方案**:
```python
def tick(self, run: SimulationRun, elapsed: int) -> dict[str, Any]:
    # 只拷贝 runtime_snapshot，不拷贝整个 config
    runtime = deepcopy((run.config or {}).get("runtime_snapshot")) or _initial_runtime(...)
    config = run.config or {}  # 不修改 config，只读取
    # ... 后续逻辑只修改 runtime 和 run.metrics/run.config["elapsed"]
```

---

### F5-2 [P1] `persist_tick` 的 `_upsert_projections` 逐行查询

**位置**: `services/api/app/services/runtime_scheduler.py:76-98`

**问题**:
```python
for task in tick.get("task_items", []):
    row = db.query(SimulationTaskRecord).filter_by(
        simulation_id=run.id, task_id=task_id
    ).one_or_none()  # 每个 task 一次查询
for cargo in tick.get("cargos", []):
    row = db.query(SimulationCargoRecord).filter_by(
        simulation_id=run.id, cargo_id=cargo_id
    ).one_or_none()  # 每个 cargo 一次查询
```

100 个 task + 100 个 cargo = 200 次数据库查询/tick。

**影响**: O(n) 数据库查询，n = 任务数 + 货物数。高频 tick 下数据库 I/O 成为瓶颈。

**修复方案**: 批量查询后建字典索引:
```python
existing_tasks = {r.task_id: r for r in db.query(SimulationTaskRecord).filter(
    SimulationTaskRecord.simulation_id == run.id,
    SimulationTaskRecord.task_id.in_([str(t.get("id", "")) for t in tick.get("task_items", [])])
).all()}
```

---

### F5-3 [P1] `EvolutionService.create` 串行执行 80+ 次仿真

**位置**: `services/api/app/services/simulation.py:796-803`

**问题**:
```python
for generation in range(4):          # 4 代
    for index, genome in enumerate(population):  # 10 个体
        samples = [self.simulator.evaluate(config, genome, ...) for offset in range(2)]  # 2 样本
```

4 × 10 × 2 = 80 次 `evaluate` 调用，每次最多推进 900 步。串行执行。

**影响**: 大场景下单次 evaluate 需数秒，80 次可能需数分钟，HTTP 请求超时。

**修复方案**:
- 使用 `asyncio.to_thread` 或 `concurrent.futures.ThreadPoolExecutor` 并行化
- 或改为异步任务：返回 job_id，后台执行，前端轮询

---

### F5-4 [P2] `global_search` 全表扫描

**位置**: `services/api/app/main.py:1024-1039`

**问题**: 遍历所有 Project、Scenario、Template，在 Python 中做字符串匹配。

**影响**: 数据量大时（1000+ 项目）查询慢。

**修复方案**: 使用 SQLite FTS5 全文索引，或限制查询结果数量并添加分页。

---

### F5-5 [P2] `snapshot_from_run` 在每个 WebSocket 连接时都 tick

**位置**: `services/api/app/main.py:774`, `services/api/app/services/runtime_scheduler.py:67-73`

**问题**:
```python
# 每个新 WebSocket 连接
await websocket.send_json(snapshot_from_run(db, run))

# snapshot_from_run 调用
def snapshot_from_run(db, run):
    hydrate_runtime(db, run)
    tick = simulation_service.tick(run, elapsed)  # 即使 elapsed=0 也执行 deepcopy
    persist_runtime(db, run)
    return tick
```

即使 `elapsed=0`（steps=0，不推进），仍执行两次 deepcopy + 一次 persist。

**影响**: 多个客户端同时连接时，重复无谓的 tick + persist。

**修复方案**: 直接从 `SimulationRuntimeState` 读取当前 runtime，构造 tick 响应，不调 `tick()`:
```python
def current_snapshot(db, run):
    state = db.get(SimulationRuntimeState, run.id)
    runtime = state.runtime if state else {}
    return {
        "type": "simulation_tick",
        "run_id": run.id,
        "time": (run.config or {}).get("elapsed", 0),
        "robots": [...],
        "metrics": run.metrics or {},
        ...
    }
```

---

## 修复优先级建议

### 立即修复 (P0)
1. **F1-1**: 补充 `add_anomaly` 的 `description` 参数
2. **F1-2**: 补充三个缺失的仿真操作端点
3. **F2-2**: 修复 `upload_project_file` 的 `asyncio.run` 问题

### 本周修复 (P1)
4. **F1-3**: 统一 Mock 与生产数据结构
5. **F2-1**: 修复 `apply_generation_candidate` 的 Job 查找逻辑
6. **F3-1**: 评估是否需要分布式限流
7. **F4-1**: WebSocket 异常日志记录
8. **F4-2**: `analyze_requirement` 添加后端超时
9. **F5-1**: 优化 `tick` 的 deepcopy
10. **F5-2**: 批量查询优化 `_upsert_projections`
11. **F5-3**: 并行化或异步化 Evolution

### 迭代修复 (P2)
12-22: 其余 P2 问题按迭代节奏逐步修复

---

## 附录：调用链路图

### 仿真创建链路
```
前端 Simulation/index.tsx
  → createSimulation (simulationApi.ts:85)
  → POST /api/v1/simulations
  → main.py:679 create_simulation()
  → simulation_service.create() (simulation.py:264)
    → 解析 scenario_data → agv_positions / scene_stations / scene_navigation
    → _initial_runtime() 构建初始 runtime
    → 存储 scenario_snapshot / scenario_hash
  → persist_runtime(db, run)  [分离 runtime 到 SimulationRuntimeState]
  → db.commit()
  ← 返回 SimulationRun
```

### 仿真运行链路
```
前端 useSimulationStream (useSimulationStream.ts:70)
  → WsClient.connect() (ws.ts:41)
  → WebSocket /api/v1/simulations/{id}/stream
  → main.py:750 stream_simulation()
    → 鉴权 (token query param)
    → snapshot_from_run() 发送首帧
    → runtime_scheduler.subscribe() 订阅队列

后台 RuntimeScheduler._run() (runtime_scheduler.py:210)
  → 查询 status="running" 的 runs
  → _acquire_lease() 获取分布式锁
  → hydrate_runtime() 加载 SimulationRuntimeState
  → simulation_service.tick() 推进仿真
  → persist_tick() 持久化
  → publish() 推送到订阅队列
  → WebSocket.send_json(tick) 推送到客户端
```

### AI 分析链路
```
前端 generationApi.ts:95 analyzeRequirement()
  → POST /api/v1/generation/analyze
  → main.py:913 analyze_requirement()
    → _requirement_profile() 规则提取
    → analyze_with_agnes() LLM 调用 [无超时 ⚠️]
  ← 返回 RequirementAnalysisRead

或异步路径:
  → POST /api/v1/generation/analyze-async
  → 返回 job_id
  → waitForRequirementAnalysis() SSE 或轮询
  → GET /api/v1/generation/{job_id}/stream (EventSource)
  或 GET /api/v1/generation/{job_id} (轮询)
```
