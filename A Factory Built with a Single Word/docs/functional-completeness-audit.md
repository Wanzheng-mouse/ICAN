# ICAN 无人仓仿真平台 — 功能完整性审计报告

> **整改状态（2026-07-19）：本报告中的缺口已完成代码整改。** 下文第 0–8 节保留为整改前基线，不再代表当前代码状态；最终实现与验证结果见文末“整改完成记录”。

> 审计日期：2026-07-18
> 方式：只读代码核查（未修改任何代码）。覆盖 `services/api/app/main.py`、前端 `apps/web/src` 路由/页面/API 层/mock 配置/主题系统。
> 目标：在不改代码的前提下，定位系统功能完整性缺口并给出可落地建议。

---

## 0. 结论速览

| 维度 | 状态 |
| --- | --- |
| 认证 / 账户闭环 | ✅ 真实、测试通过 |
| 项目 / 场景 / 文件 / 成员 归属模型 | ✅ 真实、CRUD + 权限双校验 |
| 后端基础质量（错误信封 / 追踪 / 迁移 / 审计） | ✅ 真实 |
| 通知（列表 / 已读 / 角标） | ✅ 真实后端 |
| **仿真引擎（核心）** | ❌ 后端为假公式，前端用本地引擎旁路 |
| **进化引擎** | ❌ 硬编码 +0.15，无多轮对比 |
| **编排引擎** | ❌ 端点返回硬编码常量 |
| 首页数据看板 | ⚠️ 静态 mock，无聚合 KPI 端点 |
| 资源中心 | ⚠️ 案例/学习路径/分类为后端常量 |
| 搜索 | ⚠️ 仅子串匹配，无分页/过滤/排序 |
| 报告 PDF | ⚠️ 仅 5 行文本，无图表可视化 |
| 主题切换 | ⚠️ 深色开关被禁用，且无 system 模式 |
| 通知实时推送 / 生产安全项 / CI-CD | ⚠️ 缺失 |

> 阶段一（认证）+ 阶段二（项目—场景）验收路径（注册→登录→建项目→建场景→归档）已闭环且测试通过；**最大缺口集中在阶段三/四的「仿真—进化—编排」真实引擎**，即原始 `COMPREHENSIVE-FIX-PLAN.md` 的 P0/P1 主体，目前基本未启动。

---

## 1. 已具备的扎实能力（确认无问题，可放心）

1. **认证闭环**：注册（邮箱唯一、加盐 PBKDF2、成功直发 token）、登录、登出（吊销 token）、`GET /users/me` 启动态恢复、忘记/重置密码（一次性凭据·30 分钟·防枚举·生产不回传·旧 token 失效）、改密。后端 pytest 覆盖。
2. **项目—场景—文件—成员 模型**：Project + ProjectMembership 归属真实；CRUD + workspace；状态 `draft→active→archived`（不物理删除）；真实文件上传（白名单 / 10MB / 防目录穿越 / 物理清理）；场景创建绑定项目与权限；编辑器刷新恢复同一场景。
3. **权限矩阵**：admin / operator / viewer 前后端双重校验；viewer 写操作 403；项目列表按成员过滤。`Projects/index.tsx` 具备成员邀请（含角色 operator/viewer）、移除、角色标签 UI。
4. **后端基础质量**：统一错误信封 `{detail, code, request_id, errors?}` + `X-Request-ID` 追踪 + 结构化日志；`ensure_schema()` 安全迁移；敏感目录 gitignore；CORS 仅放行显式来源。
5. **审计日志**：`record_audit()` 在 profile / 改密 / 成员 / 仿真 / 进化 / 报告导出处落地；`GET /audit-logs` 仅管理员可见——**已真实实现**（原方案未将其列为已完成的偏差点，需注意）。
6. **通知**：`Notifications/index.tsx` 经 `useNotifications()` 调真实 `GET /notifications`，含已读/全部已读/角标（MainLayout 拉取）。本地 `useNotificationStore` 仅提供类型与过滤 helper，非数据源。
7. **前端工程化**：路由懒加载 + Suspense、TanStack Query 缓存、Zustand 持久化、类型安全 DTO、`@ican/contracts` 契约、前端 77 + 后端 8 测试全绿、生产构建 4033 模块 ~11s。

---

## 2. 严重缺口：核心引擎为假 / 未与后端连通（最高优先）

### 2.1 仿真引擎（原计划 P0 #1–5，完全未启动）
- **后端**：`SimulationService.tick()` 是公式 `completion = min(1, elapsed*robots/(orders*10))`，机器人状态与 KPI 全部硬编码；源码注释明写 *"Replace these deterministic calculations with SimPy and AGV algorithms later"*。
- **前端**：`pages/Simulation/index.tsx` 直接 `new SimulationEngine(...)` + `requestAnimationFrame(tick)` 驱动 3D（`components/SimView3D/simulationEngine.ts` 内有较真实的 AGV/交通几何实现 + 单测）。**即前端跑的是本地引擎，后端仿真被旁路。**
- **没有**：后端真实仿真循环、WebSocket 实时流（`api-contract.md` §3 自述「后端尚未读取心跳或返回 pong」、`main.py` 无 WS endpoint）、仿真快照落库。
- **后果**：仿真结果不可复现、不持久化、不跨端共享；「单一数据源」原则被破坏；多用户/保存的运行记录无意义。
- **建议**：按 `COMPREHENSIVE-FIX-PLAN.md` §1.1 落地 Python 引擎（`engine/road_network/cargo/agv/station/anomaly`）+ `asyncio` 仿真循环 + `simulation_snapshots` 表 + WS 10Hz 推送；前端 `Simulation/index.tsx` 改为订阅 WS 快照，移除本地 `requestAnimationFrame` 自驱。

### 2.2 进化引擎（原计划 P1 #6–7）
- `EvolutionService.create()` 硬编码 `baseline + 0.15` / `duration * 0.85`，诊断文案写死，无多轮仿真对比。
- **建议**：实现 `EvolutionOptimizer`，对候选策略跑 N 次不同随机种子，返回最优策略 + 与基线对比；前端 `Evolution/index.tsx` 已用 `Segmented` 展示对比位，可直接接 `GET /evolutions/{id}/compare`。

### 2.3 编排引擎（原计划 P1 #8–9）
- `orchestration_agents/strategy/goal/branches` 端点返回**硬编码常量**（agents_data 列表、`{"dispatch":"nearest_available",...}` 等）；仅 `orchestration_queue` 读真实 `SimulationRun`。
- **建议**：实现 `TaskDispatcher`（按距离/电量/类型/工位负载派单）+ `CongestionDetector`；端点改为反映真实调度状态。

---

## 3. 数据真实度 / 前后端一致性（design-router 维度：路由—数据源完整性）

### 3.1 首页无真实数据看板
- `Home/index.tsx` 的 特性卡 / 步骤 / 上传引导来自 `homeStaticData`（静态 mock）；全仓**无** `GET /dashboard/kpis` 或聚合 KPI 端点。
- **建议**：新增 `GET /dashboard/kpis`（项目数/场景数/仿真数/模板数/最近活动），首页接入真实数据，替换静态块。

### 3.2 资源中心部分硬编码
- 后端 `featured_cases` / `learning_path` / `categories` 返回常量；`hot_resources` / `templates` 读真实 DB。前端 `resourceApi.ts` 受 `isMockEnabled('resource')` 门控。
- **建议**：案例库 / 学习路径落库或配置化；分类至少从模板类别动态生成。

### 3.3 搜索能力弱
- `GET /search` 仅子串匹配，无分页 / 类型过滤（project/scenario/template/report）/ 排序。
- **建议**：加 `?q=&type=&page=&page_size=&sort=relevance|created_at`，返回分页结构。

### 3.4 Mock 门控不一致（架构 coherence 风险）
- `isMockEnabled(module)` 按模块读 `VITE_USE_MOCK`，但：
  - **simulation** 前端无论如何都不调后端（本地引擎），门控形同虚设；
  - 其余模块切到生产（`VITE_USE_MOCK=false`）会命中「真实后端但内容为硬编码」的端点（evolution / orchestration / 资源案例）。
- **建议**：收敛为单一事实来源——要么后端补全真实数据，要么在开发/演示环境显式标注「演示数据」并避免误标为真实。前端统一通过 `isMockEnabled` 切换，消除「假后端」的中间态。

---

## 4. 报告 PDF 为最小实现
- `build_simple_pdf()` 仅生成 5 行纯文本 PDF（`%PDF-1.4` 手写），无 KPI 图表、事件日志、可视化。属于「能下载 PDF 但不是报告」。
- **建议**：引入 `weasyprint` / `reportlab` 渲染含 KPI 图表、事件时间线、设备/拥堵分布的真实报告（对应 P1 #10）。

---

## 5. 体验与产品化缺口（premium 标准）

### 5.1 主题切换不可用（明确缺口）
- 深色主题系统**已在代码层完整实现**（`styles/theme.ts` 的 `darkAlgorithm`、`App.tsx` 按 `user.preferences.theme` 应用、`global.css` 有 `data-theme='dark'` 覆盖样式）——但 `Preferences.tsx` 中切换开关被 `disabled` 且打了「即将上线」标签。
- 类型仅 `light | dark`，**缺 system / 跟随系统**（premium 标准要求 light/dark/system 三态）。
- **后果**：用户无法切换；实际永远停留在浅色。
- **建议**：① 启用开关并对接 `updateProfile` 偏好（后端已支持 `preferences.theme`）；② 增加 `system` 模式 + 监听 `prefers-color-scheme`。

### 5.2 通知无实时推送
- 仅 TanStack Query 轮询（`staleTime: 15s`），无 `WS /notifications/stream`。
- **建议**：补充通知 WebSocket 推送，降低延迟、减负轮询。

### 5.3 生产就绪小项
- 密码重置无邮件通道（开发态返回 token），上线前需接入邮件或站内信。
- 登录无限流 / 无账户锁死（暴力破解风险）。
- 注册无邮箱验证。
- 缺部署文档 / 环境变量清单（`.env.example` 已有，但无 README 部署说明）。

---

## 6. 工程化与运维

- **无 CI/CD、无 Docker、无部署脚本**——作为「完整系统」尚缺交付链路。
- **测试覆盖偏科**：后端 8 项仅覆盖 auth/projects/scenarios；仿真/进化/编排因本身是假实现，无后端测试；一旦补全引擎需同步补测试。
- **建议**：加 GitHub Actions（lint + typecheck + 双端测试 + build），提供 `Dockerfile` + `docker-compose`（api + web）。

---

## 7. 建议落地路线图

| 优先级 | 项 | 对应原方案 | 工作量 |
| --- | --- | --- | --- |
| **P0** | 仿真引擎后端化 + WebSocket 实时流 + 快照持久化；前端订阅 WS 取代本地引擎 | 计划 P0 #1–5 | 大 |
| **P0** | 首页真实数据看板（dashboard 端点 + 接入） | 计划 P2 #11–12 | 小 |
| **P1** | 进化引擎真实化（多轮仿真对比） + 前端对比图 | 计划 P1 #6–7 | 大 |
| **P1** | 编排引擎真实化（dispatcher/congestion） + 前端对接 | 计划 P1 #8–9 | 大 |
| **P1** | 报告 PDF 含图表可视化 | 计划 P1 #10 | 中 |
| **P1** | 启用主题切换 + 增加 system 模式 | —（premium 标准） | 小 |
| **P2** | 资源案例库/学习路径落库 | 计划 P2 #13 | 中 |
| **P2** | 搜索分页/过滤/排序 | 计划 P2 #14 | 中 |
| **P2** | 通知 WebSocket 推送 | 计划 P2 #15 | 中 |
| **P2** | 生产安全项（邮件重置 / 登录限流 / 邮箱验证） | — | 中 |
| **P2** | CI/CD + Docker + 部署文档 | — | 中 |

---

## 8. 一句话总结
阶段一/二「能用且真实」，但**仿真、进化、编排三大决策引擎仍是演示级假实现**，且首页看板、报告图表、主题切换、搜索、实时通知存在一致性或产品化缺口。补齐仿真后端化（P0）是让平台从「外壳完整」走向「内核可用」的关键一步。

---

## 9. 整改完成记录（2026-07-19）

| 原缺口 | 当前实现 | 状态 |
| --- | --- | --- |
| 前后端仿真割裂 | 后端持久化离散事件引擎统一驱动 AGV、任务生命周期、电量、充电、安全距离、拥堵与能耗；前端真实模式只消费后端快照 | ✅ |
| 无实时流/快照 | 仿真 WebSocket、通知 WebSocket、`runtime_snapshot` 与指标历史均已落地 | ✅ |
| 进化硬编码 | 4 种策略 × 3 个随机种子的 12 次真实候选仿真，记录逐轮指标和评分 | ✅ |
| 编排返回常量 | 智能体、任务队列、流程、策略、目标和异常分支均由当前运行快照计算；启动、保存策略、保存模板已接真实写接口 | ✅ |
| 首页无看板 | 新增权限隔离的 `/dashboard/kpis`，首页展示项目、场景、仿真、运行中、完成率和能耗 | ✅ |
| 资源中心常量 | 案例与学习路径落库，分类从模板表聚合；新增 Alembic `20260719_0002` | ✅ |
| 搜索无分页过滤 | 新增 `/search/advanced`，支持类型、页码、页大小和排序；搜索页使用服务端分页 | ✅ |
| PDF 仅 5 行 | PDF 改为矢量 KPI 卡、完成率趋势、机器人/任务运行事实图表 | ✅ |
| 主题不可切换 | light / dark / system 三态持久化，system 监听系统配色变化 | ✅ |
| 通知仅轮询 | 新增鉴权通知 WebSocket，变更后主动刷新通知缓存 | ✅ |
| 密码重置无投递通道 | 增加 SMTP 配置和 30 分钟重置链接邮件；生产环境不回传令牌 | ✅ |
| 交付链路缺失 | Alembic、结构化日志、限流、Docker、Compose、GitHub Actions、启动脚本和部署文档已具备 | ✅ |

验证基线：后端完整测试、Alembic head、前端 lint、typecheck、Vitest 与生产构建必须同时通过；具体数量以最后一次本地验证输出为准。
