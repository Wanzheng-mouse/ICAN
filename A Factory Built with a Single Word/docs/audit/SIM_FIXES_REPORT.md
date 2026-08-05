# 仿真空间问题修复报告（更正版）

> **更正声明**：上一版 "全部修复并验证通过" 的结论**不严谨，已撤销**。
> 实际核查发现：验证此前**并未真正通过**——它依赖 `vite build`，而 `vite build`
> 会跳过 `tsc` 类型检查，掩盖了真实的类型错误。本轮在真实门禁
> （`npm run typecheck` / `npm run lint` / 单元与后端语义冒烟）下重新核验，
> 并按你的评分表逐项修正。结论保留 "UI 与基础联动已有进展"，
> **不建议标记为全部修复**。

---

## 一、评分表（按你的核查结论）

| 项目 | 你的判定 | 本轮处置 | 状态 |
|------|----------|----------|------|
| 连接状态 | 基本合理 | 补齐 `'connecting'` 全局类型（此前被我回退破坏，本轮修复） | ✅ 已闭回归 |
| 侧边栏精简 | 基本合理 | 保留精简，未丢失高优先级告警入口 | ✅ 维持 |
| 平均等待时间 | 不合理，需重做 | 队列等待与服务时间解耦，新增 FSM 状态 + 指标 + KPI 改标 | ✅ 已重做+冒烟 |
| 多策略路径 | 名义完成，实际不足 | 注入真实拥堵输入驱动策略分叉；`congestion_aware` 现仅在真实拥堵时分叉 | ✅ 部分闭环（见下） |
| 机械臂联动 | 单工位可用，多工位不可靠 | 绑定到具体工位组件 id，不再按角色合并 | ✅ 已修+冒烟 |
| 类型与验证 | 未通过 | 关闭我引入的契约回归 + 导出缺失 DTO；`lint` 达 0/0；`typecheck` 仍有 25 个遗留基线错误 | 🟡 契约已闭/基线待清 |

---

## 二、本轮实际完成的工作

### 1. 关闭我自身引入的契约回归（P0）
- `apps/web/src/api/dtos/backend.ts`：`SimulationTickRead` 的 `any[]` 替换为
  `SimulationRobotTickRead[]` / `SimulationTaskTickRead[]` / `SimulationCargoTickRead[]`
  / `SimulationEventTickRead[]`，并新增 `ArmStateRead[]` 与 `scenario_version` 字段。
- `apps/web/src/stores/useAppStore.ts`：全局连接状态联合类型补齐 `'connecting'`
  （此前被我误改为不可用，导致 `Simulation/index.tsx` 编译失败）。

### 2. 导出缺失 DTO（P0-1，对齐 `services/api/app/schemas.py`）
新增导出：`ProjectUpdate`、`ProjectMemberUpsert`、`ProjectMemberRead`、
`ProjectFileRead`、`ProjectWorkspaceRead`、`RequirementAnalyzeCreate`、
`RequirementAnalysisRead`、`GenerationCandidateRead`、`GenerationCandidatesRead`、
`SimulationAgentRead`、`EvolutionApplyRead`。
此外：
- `EvolutionRead` 补 `applied_scenario_id?`；
- `SimulationRead.config` 补 `scenario_snapshot?` 等后端真实持久化字段；
- `SimulationRead.status` 由字面量联合放宽为 `string`（后端为自由字符串），
  由 `simulationReadToRun` 归一为前端 `RunStatus`，并据 `completion_rate`
  计算 `completedOrders`（修复潜在 UI 收到非法 `RunStatus` 的隐患）。

### 3. 等待时间业务语义重做（评分项③）
- `services/api/app/services/simulation.py` 新增 FSM 状态
  `waiting_pickup_resource` / `waiting_dropoff_resource`：`station_queue_wait_seconds`
  累计"到达→资源被占→开始服务"的排队时长，`station_wait_seconds` 仅累计服务时长，
  二者彻底分离。
- `_metrics` 新增 `average_queue_wait_seconds` / `p95_queue_wait_seconds` /
  `max_queue_wait_seconds`。
- 前端 `Simulation/index.tsx` KPI 由"平均等待时间（服务时长）"改标为
  "工位排队等待"，并附"派单 / 服务(s)"分解。

### 4. 多策略路径真实性（评分项④）
- `_astar_route` 的 `congestion_cells` 改为结构化解析；`tick` 前向真实受阻/排队
  机器人坐标注入为拥堵单元，`congestion_aware` 因此**仅在真实拥堵输入时分叉**。
- 冒烟验证：无拥堵时 `shortest` 与 `congestion_aware` 等长(2)；注入真实拥堵单元后
  后者长度变为 5。证明分叉由真实输入驱动，而非虚标。
- **仍待办（非本轮范围，已记录）**：完整道路网 + 边预约表、`priority_lane` 路权、
  `lane-band` 偏置进入 A\* 代价、`detour_offset` 平移越界安全包络——这些属 P1 重构。

### 5. 机械臂多工位绑定（评分项⑤）
- `arm_states` 改为按**最近的具体工位组件 id** 绑定（角色 + 邻近被服务 AGV 点 <60），
  不再按 `role` 合并同类型多工位。冒烟验证：storage-1 / storage-2 各有独立 arm
  绑定，互不影响。

### 6. 验证门禁恢复（P0-1）
- 将 `simulationMapper.test.ts` 对齐当前 `SimulationRead` 契约并修正映射断言；
  `projectApi.useProjectMembers` 显式 `request<ProjectMemberRead[]>()` 消除类型漂移。
- 清除全部 8 个 lint 警告（含我改动文件内 4 个 + 其他模块 4 个无用符号）。

---

## 三、当前真实验证状态（以真实门禁为准）

| 门禁 | 命令 | 结果 |
|------|------|------|
| ESLint | `npm run lint --workspace=@ican/web` | ✅ **0 errors / 0 warnings** |
| 类型检查 | `npm run typecheck --workspace=@ican/web` | 🟡 25 错误，全部为遗留基线；**我改动文件 0 错误** |
| 单元（映射） | `simulationMapper.test.ts` | ✅ 2/2 通过 |
| 后端语义冒烟 | `smoke_v2.py` (T1/T2/T3) | ✅ 全部通过 |
| 后端 pytest | `pytest tests/` | ⚠️ 未在本轮执行 |
| e2e | — | ⚠️ 未执行 |
| `evolutionMapper.test.ts` | — | ❌ **预存运行时断言失败**（`report.metrics` 形状不符），非本轮引入 |

### typecheck 遗留 25 错误的分布（均为历史债务，非本轮引入）
- `src/pages/Home/index.tsx` × 9
- `src/pages/Report/index.tsx` × 8
- `src/pages/Editor/index.tsx` × 3
- `src/pages/Orchestration/index.tsx` × 2
- `src/pages/Resource/index.tsx` × 1
- `src/api/ws.ts` × 1
- `src/App.tsx` × 1

这些多为 `implicit any` 回调参数、`useQuery` 返回 `unknown` 未收窄、`Report` 接收 `{}` 形参等
**结构性类型缺陷**，需独立一轮"typecheck 清零"重构，风险较高，不在本 5 项范围内。

---

## 四、已知残留契约偏差（待跟进）
1. **`SimulationAgentRead` 运行时形状偏差**：前端消费端 `agentReadToAgent` 读取
   AI-agent 语义字段（`responseTime`/`load`/`successRate`/`taskCount`/`role`），
   而后端 `list_simulation_agents` 实际返回运营遥测
   （`battery`/`position`/`completed_tasks`/`total_distance`）。DTO 已同时容纳两类字段，
   但运行时映射需进一步统一。
2. **`evolutionMapper.test.ts` 运行时失败**：`report.metrics` 断言与
   `evolutionReadToReport` 实际输出不符，属独立遗留缺陷。
3. **路径策略 P1 重构项**：见第二节第 4 点"仍待办"。

---

## 五、本轮新增三项修复（标签裁剪 / 机械臂不运行 / AGV 路线穿模）

> 针对你最新提出的三个问题，已在 `apps/web` 与 `services/api` 分别修复，
> 并用后端语义冒烟 + 前端 `lint`/`typecheck` 真实核验。**核验层级说明**：
> 后端行为已由冒烟脚本逐 tick 验证；前端标签为代码层修复，`lint`/`typecheck`
> 通过，但**真机 3D 画面观感需在浏览器内人工确认**（本环境无法直接看画布）。

### 状态总览

| 问题 | 根因 | 处置 | 验证 |
|------|------|------|------|
| 标签文字被裁剪 | CSS2D 标签层 `overflow:hidden` + `nowrap` 无溢出保护 + 区域标签锚在边角 | `SimScene.ts`：标签层改 `overflow:visible`；`createLabel` 改 `inline-block`/`maxWidth:none`/`overflow:visible`、字号放大（zone 11px / 普通 10px）、`obj.center` 锚点居中（zone 标签抬到地面之上，避免被地面裁切） | `lint` 0/0；改动文件 `typecheck` 0 错 |
| 机械臂完全不运行 | `arm_states` 仅当"工位角色 == 任务角色"才置 `working`；而编辑器放置的是 `pick/pack/sort` 工位，与硬编码 `inbound/storage/outbound` 任务角色错位，导致 arm 永远不触发 | `simulation.py` `arm_states` 改为：按 `properties.station_id` 或最近工位组件把每个 arm 绑定到具体工位；只要有 AGV 在该工位 **130 场景单位内**处于 `loading`/`unloading` 即置 `working`（与角色词汇表解耦） | `smoke_sim3`：`arm_states` 命中 **36/600** tick（此前 0）；任务 **12/12** 完成 |
| AGV 路线穿模/走歪 | A* 对"站位中心点"这类被自身障碍包络**完全包围**的目标返回空路径 → `_route` 退回水平 lane 折线，直线穿过工位/货架 | ① 所有实体（station/charger/arm/conveyor/shelf）均纳入 A* `obstacles`；② 任务端点从**实际放置的工位**推导，而非固定工厂坐标；③ A* 目标点若被障碍包围则 **snap 到最近可通行 aisle 单元**，最终 berth 段进入工位（运行时豁免） | `smoke_sim3`：**482** 条路线、**327** 条工位向路线全部抵达真实工位；**途经设备的路点/线段 = 0**，跨设备误闯 = 0；货架类违规归零 |

### 根因定位关键（AGV 路线）
- 占位目标 `(940,310)` 为 pack 站位中心，其按 `clearance=26` 膨胀后的包络覆盖
  `x∈[874,1006], y∈[254,366]`，将该栅格单元**及其 4 邻域全部封死**；A* 永远无法
  "走进"目标，返回 `[]`，于是退回 lane 折线直线穿越 pick 站位。
- 修复不在"放宽障碍"，而在**让目标可达**：被包围时 BFS 外扩到最近可通行 aisle
  单元作为 A* 目标，最后一小段 berth 进站位（已在验证中按端点豁免，不算穿模）。
- 另确认并保留早前已修的 A* Y 轴 `w→h` 笔误（障碍纵向按高度而非宽度膨胀）。

### 验证命令与结果
- 后端语义冒烟：`PYTHONPATH=. .venv/Scripts/python.exe /tmp/smoke_sim3.py`
  → `VERDICT: PASS`（arm 运行 / 路线避障 / 任务完成 三项全绿）。
- 遗留场景回归：无障碍开放走廊 A* 仍返回直线（len 2）；包围目标正确 snap 出
  （len 3）；无组件障碍的旧版运行仍 **8/8** 完成任务——确认重构未引入回归。
- 前端门禁：`npm run lint --workspace=@ican/web` → **0 errors/0 warnings**；
  `npm run typecheck --workspace=@ican/web` → 25 错均为历史基线，本文件改动 **0 错**。

---

## 六、结论
- 保留："UI 与基础联动已有进展"。
- **不标记"全部修复"**：等待时间 / 多策略路径 / 机械臂联动的**业务语义已真正修正并经冒烟验证**；
  契约回归与缺失 DTO 已闭合；`lint` 门禁达标；但 `typecheck` 仍有 25 个历史基线错误，
  `evolutionMapper.test` 预存运行时失败，均需独立跟进。
- **本轮新增三项（第五节）已修复并经后端真实验证**：标签裁剪（前端 `lint`/改动文件
  `typecheck` 通过）、机械臂联动（冒烟命中 36/600 tick，此前 0）、AGV 路线避障
  （482 条路线、0 次穿越设备）。其中后端行为已由逐 tick 冒烟确认；**标签实际观感需
  在浏览器内人工确认**，本环境无法直视 3D 画布，故不单凭代码改动标记为"视觉已验收"。
- 建议下一步：① 发起"typecheck 清零"重构轮（Home/Report/Editor/Orchestration/Resource/ws/App）；
  ② 修复 `evolutionMapper.test`；③ 跑通后端 `pytest` + e2e；④ 推进路径策略 P1 重构；
  ⑤ 浏览器内人工核验标签完整性与机械臂/AGV 动效观感。
