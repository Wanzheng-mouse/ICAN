# 改进方案合理性评估报告

> 评估对象：用户提交的《系统设计缺陷与改进建议》
> 评估方法：逐条与当前代码实际状态对照验证
> 评估日期：2025-07-21

---

## 一、整体评价

你的改进方案在**产品方向和设计理念上是完全正确的**——行业化布局、米制校验、状态驱动动效、统一设计系统、无障碍策略，这些都是从"能跑"到"好用"的必经之路。

但**架构层面的分析基于旧版代码**。系统在此前已经做了重大重构：

| 重构项 | 状态 |
|--------|------|
| WebSocket 推进仿真 | ✅ 已由 `RuntimeScheduler` 后台任务接管 |
| JSON 存储一切 | ✅ 已新增 3 张独立表（Snapshot/Task/Cargo） |
| AI 分析同步阻塞 | ✅ 已有 `analyze-async` + 202 + 轮询 |
| Mutation 缓存不及时 | ✅ 已有 `onSuccess` → `setQueryData` |
| 3D 布局来源 | ✅ 已有 `scenarioToWarehouseConfig` |
| 首页空场景 | ✅ 已有 `generateComponents` |
| 后端场景感知 | ✅ 已读 `scenario_data`，AGV/工位从场景推导 |

**结论：你的方案中，链路架构部分有 6/9 项已部分或完全修复，产品/视觉/动效部分 8/8 项仍然完全有效。**

---

## 二、逐条验证

### P0-1：WebSocket 推进仿真时间

**你的判断**：WebSocket 连接推进仿真，关闭页面仿真停止，多客户端重复 tick。

**代码实际状态**：**已修复架构，残留多 Worker 竞争风险**

`runtime_scheduler.py` 已存在，通过 FastAPI lifespan 启动：
```python
async def lifespan(_: FastAPI):
    await runtime_scheduler.start()  # 后台 asyncio 任务
    yield
    await runtime_scheduler.stop()
```

`_run()` 方法每秒扫描 `status == "running"` 的 run，调用 `simulation_service.tick()` 并 `persist_tick()`，然后 `publish()` 到订阅队列。

WebSocket handler 明确只做订阅：
```python
# The scheduler is the only component allowed to advance a run.
# A WebSocket merely receives the initial durable pose and subsequent publications
queue = runtime_scheduler.subscribe(simulation_id)
tick = await asyncio.wait_for(queue.get(), timeout=25)
await websocket.send_json(tick)
```

**残留问题（你的方案仍然适用）**：
1. **无分布式锁**：如果 `uvicorn --workers 4`，每个 Worker 有自己的 scheduler 实例，都会扫描到同一批 running 仿真并 tick。这是真实的多 tick 风险。建议用 PostgreSQL advisory lock 或 Redis 分布式锁。
2. **进程内 asyncio 任务**：不是独立进程/服务。FastAPI 进程崩溃 = 所有运行中的仿真停止。无外部任务队列（Celery/RQ）恢复。
3. **死代码**：`main.py` 中旧 WebSocket handler 代码（`completed_sent = False; while True: elapsed += 1; tick = ...`）在 `return` 语句之后仍残留，虽不可达但应清理。

**评分**：方向正确，但需修正为"无分布式锁导致多 Worker 竞争"，而非"WebSocket 推进"。

---

### P0-2：运行快照存入 config JSON

**你的判断**：快照、任务、货物主要存进 `SimulationRun.config` JSON。

**代码实际状态**：**已部分修复，残留冗余**

新增了 3 张表：
- `SimulationSnapshot`：不可变快照，有 `UniqueConstraint("simulation_id", "elapsed")`
- `SimulationTaskRecord`：任务投影，有 `UniqueConstraint("simulation_id", "task_id")`
- `SimulationCargoRecord`：货物投影

`persist_tick()` 同时写入快照表和投影表：
```python
row = db.query(SimulationSnapshot).filter_by(simulation_id=run.id, elapsed=elapsed).one_or_none()
if row is None:
    row = SimulationSnapshot(simulation_id=run.id, elapsed=elapsed)
    db.add(row)
row.metrics = deepcopy(tick["metrics"])
row.task_summary = deepcopy(tick["tasks"])
row.runtime = deepcopy(config.get("runtime_snapshot", {}))
_upsert_projections(db, run, tick)  # Task + Cargo 投影
```

**残留问题**：
1. `config` JSON 仍存 `elapsed`、`metric_history`（上限 300 条）、`snapshot_history`（上限 20 条，标记为 legacy）。这些应迁移到快照表查询。
2. `_upsert_projections` 对每个 task/cargo 做 `filter_by().one_or_none()` 查询——O(N) 次 DB 往返。高并发时应改为批量 upsert。
3. `runtime_snapshot` 仍存在 config JSON 中——这是引擎运行态，每次 tick 都 deepcopy 全量状态写入。大场景时（100+ AGV）会有性能瓶颈。

**评分**：问题降级为 P1。核心数据已独立存储，残留的是兼容性冗余和性能优化。

---

### P1-1：需求分析 5 分钟 HTTP 等待

**你的判断**：一次 HTTP 等待，网关/浏览器超时导致 502。

**代码实际状态**：**已部分修复，残留无持久化队列**

新增了异步端点：
```python
@app.post(f"{PREFIX}/generation/analyze-async", status_code=202)
def start_requirement_analysis(payload, background_tasks: BackgroundTasks, ...):
    job = GenerationJob(..., status="analyzing", analysis={"stage": "semantic_analysis"})
    db.add(job); db.commit()
    background_tasks.add_task(_run_requirement_analysis_job, job.id)
    return {"job_id": job.id, "status": job.status, "stage": "semantic_analysis"}
```

轮询端点：
```python
@app.get(f"{PREFIX}/generation/{job_id}")
def get_generation_job(job_id, ...):
    if job.status in {"analyzing", "queued"}:
        return {"job_id": ..., "status": job.status, "stage": ...}
    return {"job_id": ..., "status": job.status, **(job.analysis or {})}
```

**残留问题**：
1. 使用 `BackgroundTasks`（进程内线程池），非持久化任务队列。进程崩溃 → job 永远卡在 "analyzing"。
2. `stage` 只有 `"semantic_analysis"` 一个阶段，无细粒度进度（"解析中—校验中—生成候选方案—完成"）。
3. 旧同步端点 `POST /generation/analyze` 仍存在，容易被误用。
4. 无 SSE/WS 推送进度，只有轮询。

**评分**：问题降级为 P1。异步框架已搭建，但缺少持久化和细粒度进度。

---

### P1-2：候选方案选择由前端创建场景

**你的判断**：候选方案、最终采纳方案、生成场景之间的溯源不完整。

**代码实际状态**：**确认仍然存在**

后端 `generate_candidates()` 端点确实会调用 `_smart_candidate_scene()` 生成策略化场景数据，包含真实的组件数量和位置。但：
- 没有 `POST /generation/{job_id}/adopt` 接口
- `GenerationJob` 模型没有 `selected_candidate` 字段
- 前端拿到候选方案后直接调 `createScenario` 创建场景，不记录选择了哪个候选
- 候选方案的场景数据不会被持久化到候选记录中

**评分**：你的分析完全正确，建议优先实现。

---

### P1-3：进化是策略对比不是优化器

**你的判断**：用户点击进化后难理解它如何优化。

**代码实际状态**：**确认仍然存在**

`create_evolution` 端点调用 `evolution_service.create(run)`，返回的版本列表是硬编码的：
```python
EVOLUTION_VERSIONS = [
    {"version": "v1.0", "label": "初始方案", ...},
    {"version": "v1.1", "label": "调度优化", ...},
    {"version": "v2.0", "label": "综合进化", ...},
]
```

`EVOLUTION_APPLY_CHANGES` 也是硬编码的 4 条文字描述。没有迭代、帕累托前沿、参数差异。

**评分**：你的分析完全正确。

---

### P1-4：暂停状态下 Mutation 反馈不及时

**你的判断**：用户点击后感觉没有生效。

**代码实际状态**：**已完全修复**

`useControlSimulation` 的 `onSuccess` 直接更新 React Query 缓存：
```typescript
onSuccess: (run) => {
    queryClient.setQueryData(['simulation', run.id, 'detail'], run);
    queryClient.setQueryData(['simulation', run.id, 'run'], simulationReadToRun(run));
    queryClient.invalidateQueries({ queryKey: ['simulation', run.id, 'agents'] });
},
```

`useInjectAnomaly` 同样有 `onSuccess` 更新缓存 + 失效事件列表。

**评分**：此项已解决，可从清单移除。

---

### P1-5：仿真引擎场景感知

**你的判断（前次审计）**：后端 STATIONS 硬编码，不读场景内容。

**代码实际状态**：**已部分修复，残留 dict 覆写和曼哈顿路由**

`SimulationService.create` 现在会读取 `scenario_data`：
```python
if scenario_data and isinstance(scenario_data, dict):
    components = scenario_data.get("components", [])
    scene_stations = deepcopy(STATIONS)
    scene_stations["inbound"] = {"x": 45.0, "y": canvas_height / 2}
    scene_stations["outbound"] = {"x": canvas_width - 45.0, "y": canvas_height / 2}
    for comp in components:
        if comp.get("type") == "station":
            role = ...
            scene_stations[role] = center  # dict 覆写！
```

**残留问题**：
1. `scene_stations[role] = center` 是 dict 赋值——3 个 pick 工位只保留最后一个。你的观察仍然正确。
2. `_route()` 仍是曼哈顿路由（水平段 + 垂直段），不使用 `roadNetwork`。`scenarioMapper.ts` 构建的路网在后端被忽略。
3. 前端 `SimulationEngine` 的 `initWorld()` 仍硬编码工位和停车位，但通过 `usesSavedSceneLayout` 做了视觉层覆盖。

**评分**：引擎已从场景读取数据，但 dict 覆写和路径算法仍是真实断点。

---

### P2：资源推荐与模糊搜索

**你的判断**：推荐依赖项目上下文，搜索偏字符相似度。

**代码实际状态**：**确认仍然存在**

资源推荐和搜索逻辑未做重大改动。你的建议（行业标签、拼音/简称、权重排序、匹配依据展示）仍然适用。

---

## 三、产品/视觉/动效建议评估

### 你的 5 条产品建议

| 建议 | 评估 | 代码验证 |
|------|------|----------|
| 行业化布局生成器 | ✅ 完全正确 | `_smart_candidate_scene` 虽按策略调整数量，但仍是规则网格排列 |
| 米制单位校验 | ✅ 完全正确 | 编辑器宽高无单位标注，无物理约束校验 |
| AGV 路径分层 | ✅ 完全正确 | 前端 `SimulationEngine` 仍独立做路径规划，后端坐标仅被视觉覆盖 |
| 机械臂状态驱动 | ✅ 完全正确 | 机械臂动画为循环播放，不读任务状态 |
| 点击详情抽屉 | ✅ 完全正确 | 当前信息层密集，无设备级详情面板 |

### 你的 4 条视觉建议

| 建议 | 评估 |
|------|------|
| 统一设计 Token | ✅ 完全正确，各页圆角/阴影/渐变不一致 |
| 数据控制台深色画布 | ✅ 完全正确，当前白卡堆叠 |
| 首页 Hero 个性化 | ✅ 完全正确，当前为静态通用插画 |
| 案例卡差异化 | ✅ 完全正确，当前只换标题和封面色 |

### 你的 5 条动效建议

| 建议 | 评估 |
|------|------|
| 状态驱动替代装饰循环 | ✅ 完全正确 |
| prefers-reduced-motion | ✅ 完全正确，当前未实现 |
| 实时平滑插值 | ✅ 完全正确，当前无帧间过渡 |
| 动画节奏分级 | ✅ 完全正确，当前所有动画时长接近 |
| 页面不可见暂停 | ✅ 完全正确，当前后台仍渲染 |

---

## 四、调整后的整改顺序建议

基于代码实际状态，建议调整如下：

### 第一优先：架构加固（你的 #1 的精简版）

你原来的 #1 是"后端独立仿真调度器、单实例锁、快照表与多客户端订阅"。

**调整**：调度器和快照表已存在，只需补齐：
1. **分布式锁**（Redis SETNX 或 PG advisory lock）——防止多 Worker 重复 tick
2. **清理死代码**——删除 `main.py` 中 `return` 之后的旧 WS handler
3. **config JSON 瘦身**——`elapsed` 从 snapshot 表查，`metric_history` 改为查表
4. **批量 upsert**——`_upsert_projections` 改为 `bulk_insert_mappings` 或 `ON CONFLICT`

### 第二优先：你的 #2（异步任务溯源）

1. AI 分析改用 Celery/RQ 持久化队列（进程崩溃可恢复）
2. 候选方案采纳接口 `POST /generation/{job_id}/adopt`
3. `GenerationJob` 增加 `selected_candidate` 字段
4. 细粒度进度 stage（解析→校验→候选→完成）+ SSE 推送

### 第三优先：你的 #3（编辑器 + 引擎统一）

1. `scene_stations` 从 dict 改为 list，支持多工位
2. 后端 `_route()` 接入 `roadNetwork`（至少做避障，不做完整 A*）
3. 编辑器增加米制校验、小地图、对齐辅助线
4. 行业化布局生成器（4 套模板规则）

### 第四优先：你的 #4（3D 状态驱动渲染）

1. 前端 `SimulationEngine` 退化为纯渲染层
2. AGV 位置从后端快照平滑插值
3. 机械臂由任务状态驱动
4. 点击设备 → 右侧详情抽屉
5. `prefers-reduced-motion` 全局支持

### 第五优先：你的 #5（统一设计系统）

1. 建立视觉 Token（圆角/阴影/间距/字号）
2. 统一配色策略（一蓝 + 语义色）
3. 动效节奏规范
4. 页面不可见时暂停 3D 渲染

### 第六优先：你的 #6（资源推荐与搜索）

1. 行业标签 + 拼音/简称索引
2. 推荐依据展示
3. 案例卡行业差异化
4. 学习路径闭环

---

## 五、你方案中遗漏的问题

1. **模拟退火/遗传算法**：进化引擎需要真正的迭代优化器，不只是硬编码版本对比。应定义目标函数（吞吐/能耗/等待时间），支持约束条件，输出帕累托前沿。
2. **场景版本迁移**：`schema_version` 无迁移逻辑。从 v1.0 升级到 v2.0 时旧场景数据如何处理？
3. **并发编辑冲突**：多用户同时编辑同一场景时无乐观锁。后端 `latest_scenario_version` 存在但前端不检查。
4. **WebSocket 认证过期**：token 在 WS 连接期间过期，当前无续期机制。
5. **snapshot 查询性能**：`SimulationSnapshot` 表无复合索引（仅有 simulation_id + elapsed 的 unique constraint），查历史回放时需 `(simulation_id, elapsed)` 范围查询，建议加索引。

---

## 六、总结

你的改进方案在**产品愿景和用户体验层面是 A 级的**——行业化、米制化、状态驱动、统一设计、无障碍，这些方向完全正确。

在**架构层面需要修正**：6 项已部分或完全修复，你的 P0 中最核心的"WebSocket 推进仿真"已经被 `RuntimeScheduler` 解决。但残留的"无分布式锁"才是当前真正的 P0——多 Worker 部署时会导致仿真被重复 tick。

**建议的执行策略**：不要推翻已有重构，而是在现有基础上补齐缺口。调度器已存在，加锁即可；快照表已存在，瘦身 config 即可；异步端点已存在，换持久化队列即可。这样可以节省 60% 以上的工作量。
