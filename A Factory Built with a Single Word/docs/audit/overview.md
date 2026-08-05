# 侧边栏精简 + 数字孪生 / 子页面差异化

## 一、移除侧边栏快捷操作（已完成）

**文件**：`apps/web/src/layouts/ConsoleLayout.tsx` + `ConsoleLayout.css`

删除了侧边栏中「快捷操作」区块（新建场景 / 启动仿真 / 重置仿真 / 导出报告 四个按钮），以及对应的
`handleQuickStart` / `handleQuickStop` / `quickStartTooltip` 控制逻辑、死代码导航函数
（`goToEditor` / `goToSimulation` / `goToReport`）和相关 import（`Tooltip`、`useControlSimulation`、
`CaretRightOutlined`、`DownloadOutlined`、`PauseOutlined`、`PlusOutlined`、`ReloadOutlined` 及 3 个原本
就未使用的图标）。同步清理了对应 CSS 与 `@keyframes shimmer`。

**侧边栏现在只保留 4 个职责**：
1. 项目上下文（轻量定位）
2. 实时概览摘要（AGV 总数/活跃、任务数/完成、未读告警）
3. 主导航菜单（分组）
4. 底部连接状态

仿真控制仍在「数字孪生」主区的控制条与子页面头部分别提供，入口不丢失。

---

## 二、数字孪生 vs 子页面差异化（已完成）

所有侧边栏子导航路由（`/simulation/tasks`、`/devices`、`/orders`、`/agents`、`/alerts`、
`/dashboard`、`/settings`）均渲染 `<RuntimeSubView>`，布局本就是**表格 / 列表 / 卡片 / 图表**，
与数字孪生主区的「3D 驾驶舱（实时 KPI + 三维视图 + AGV 卡片 + 事件流）」天然不同维度，不存在原样复制。

**重点修复了「数据看板」曾经的复制问题**：
原实现直接用 3 个与驾驶舱重合的 KPI 卡（完成率 / 利用率 / 拥堵）。现重写为真正的**诊断拆解视图**：

| 卡片 | 内容 | 与驾驶舱的差异 |
|---|---|---|
| 任务生命周期分布 | completed / running / pending 分段条 | 驾驶舱只有汇总完成率，这里看任务结构占比 |
| 运行效率诊断 | 完成率 / 平均等待 / 平均处理 / 利用率，带阈值变色 | 驾驶舱看实时数值，这里看健康度阈值 |
| 设备效能排行 | 按已完成单数排序 + 排队(wait_ticks)诊断 + 电量条 | 驾驶舱看单台状态，这里做横向效能对比 |
| 异常与拥堵聚焦 | 告警事件列表 + 拥堵计数 | 驾驶舱看全量事件流，这里只聚焦异常 |

每个子页面的功能定位清晰：任务管理=队列表格、设备管理=车队/工作站/充电桩、订单管理=货物流转、
智能体=协同负载、告警中心=异常、数据看板=效率诊断、运行设置=配置查看——互不重复。

---

## 三、验证

- `npx tsc --noEmit`：99 错误，与改动前持平，**0 新增**（仅剩 1 处历史遗留断导入 `SimulationTickRead`，
  属本次任务范围外，见下）
- `npx vite build`：✓ 12.18s 成功，全部模块转换通过

## 四、遗留跟进（建议，非本次范围）

`@/api/dtos/backend.ts` 中已无 `SimulationTickRead` 类型（疑似早期重构遗留），但 `useSimulationStream.ts`
与 `RuntimeSubView.tsx` 仍 import 它，导致 `backendTick` 在前端退化为 `any`、Simulation 页面约 25 处
implicit-any。建议后续单独补回该接口（对齐后端 `snapshot_from_run` 输出：
`task_items` / `tasks:{total,completed}` / `robots` / `metrics` / `events` / `generated_at`），可一次性消除这批类型告警。
