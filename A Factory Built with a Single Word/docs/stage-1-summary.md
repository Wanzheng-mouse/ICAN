# 阶段 1 完成情况总结

> 项目：ICAN 一言造厂（DuMate）· 无人仓生成与进化平台
> 文档用途：记录第 1 阶段（工程骨架）的实际交付内容，作为与开发方案（[ICAN-无人仓仿真决策平台开发方案.md](../ICAN-无人仓仿真决策平台开发方案.md)）的对照
> 负责人：负责人 A · 前端
> 完成时间：第 1 周内（首版 + 4 轮迭代修正）
> 包管理：npm（npm workspaces）
> 文档状态：阶段 1 已完成并通过自动化测试；阶段 2 可直接对接真实 API

---

## 1. 阶段目标回顾

> 来自《ICAN-无人仓仿真决策平台开发方案.md》第 6 节"六周开发阶段与两人分工"

**阶段 1：第 1 周 · 跑起工程骨架**

- A：初始化 Next.js（或 Vite+React）、导航/布局/主题、路由、请求层、Mock 切换
- B：初始化 FastAPI、`/health`、数据库模型、模板种子数据、Swagger
- 验收：前后端独立启动；首页能读取模板或 Mock

实际落地技术选型：Vite + React 18 + TypeScript（按开发方案收敛建议：纯前端展示场景下不需 SSR，Vite 启动更快、与 Canvas/ECharts/React Flow 集成最干净）。

包管理器：**npm**（npm workspaces），不使用 pnpm。根目录有 `package-lock.json`，无 `pnpm-workspace.yaml`。

---

## 2. 交付清单

### 2.1 工程脚手架

- 在仓库根目录建立 npm workspaces monorepo 结构（`apps/`、`packages/`）
- 搭建 Vite + React 18 + TypeScript 前端工程
- 配置 tsconfig、vite.config、ESLint、Prettier
- 配置开发与生产两套环境变量，`VITE_USE_MOCK` 控制 mock / 真实后端切换
- 编写共用类型包 `packages/contracts`（前后端共享的 TypeScript 契约）
- 编写 mock 数据包 `packages/mock-data`（覆盖 8 个页面的演示数据）
- 提交占位目录（`services/`、`scenarios/`、`reports/`）与说明，避免后续冲突
- 完成 3 份文档：`docs/api-contract.md`、`docs/web-dev-guide.md`、根 `README.md`
- 添加 Vitest 测试框架，4 个测试文件 / 45 个测试用例

### 2.2 通用基础层

- 顶部导航布局：Logo + 6 个一级菜单 + 搜索框 + 通知 + 项目中心 + 用户头像
- 仿真空间侧栏布局：9 项垂直菜单 + 折叠入口；8 个子路由**标注为路由占位**
- 主题：Ant Design 5 深蓝科技主题（主色 `#2b6fff`），含状态色、圆角、字体、卡片样式
- 全局工具类与动效：状态点、动画脉冲、数字字体
- 路由：React Router v6，8 个一级路由 + 8 个仿真空间子路由（占位），按页面 lazy 加载
- 请求层：Axios 封装（拦截器、Token、统一错误处理），TanStack Query 客户端配置
- 实时通信：WebSocket 客户端封装（自动重连 + 心跳 + 消息订阅）
- 状态管理：Zustand 持久化用户/Token/项目上下文
- 通用组件：KpiCard、SectionCard、TaskStatusTag、RiskTag、RunStatusTag、EChart 自研封装
- 自研 `HeroIllustration` SVG 组件，5 种风格（仓库/AGV/机械臂/电商/冷链/3C/医药），用于 Hero 与模板卡

### 2.3 领域 API 层（6 个模块全部到位）

```
apps/web/src/api/modules/
├── projectApi.ts        # 模板/项目/首页静态数据
├── scenarioApi.ts       # 场景读写（mutation）
├── simulationApi.ts     # 仿真运行/智能体/事件/控制
├── evolutionApi.ts      # 进化报告/趋势
├── reportApi.ts         # 报告 KPI/趋势/异常/排行
├── resourceApi.ts       # 资源中心（案例/学习/热门）
├── orchestrationApi.ts  # 任务编排（工作流/智能体/队列/策略）
└── index.ts             # 统一导出
```

每个模块提供：
- **纯函数**：`getXxx()` 按 `VITE_USE_MOCK` 切 mock 或真实 API
- **React Hooks**：`useXxx()` 基于 TanStack Query，含 5min staleTime 与自动缓存

**8 个页面全部完成 API 迁移**（`@ican/mock-data` 直接 import 已清除），符合「阶段 1 允许 mock，但 2 起逐页切到 API 层」的承诺。

### 2.4 八个一级页面 1:1 还原（按原型图）

| 页面 | 路由 | 完成功能 | 数据源 |
| --- | --- | --- | --- |
| 首页 / 创建任务 | `/` | Hero SVG 仓库插画、需求输入（含 7 步进度联动）、4 文件上传、7 步流程 Steps、4 模板卡（HeroIllustration）、5 大特性 | `homeStaticData` + `useTemplates` |
| 仿真空间 | `/simulation` | 6 KPI、2D Canvas 实时仿真（4 AGV 移动 + 4 区货架 + 拥堵热区 + 充电桩 + 异常点 + 出入口）、5 智能体、实时日志、控制条（**启动/暂停/重置/注入异常/运行进化/速度**）、异常 Modal、AGV 状态联动 | `useSimulationAgents`/`Events`/`Run` + `useControlSimulation` + `useInjectAnomaly` |
| 方案进化 | `/evolution` | 报告标题/状态、6 对比柱图（按版本动态插值）、问题/动作/版本时间线（**点击切换**）、ECharts 多线图、5 导出 | `useEvolutionReport` + `useEvolutionTrend` |
| 运行报告 | `/report` | 项目/场景/时间/版本筛选、6 KPI、趋势 ECharts 折线（带 dataZoom）、异常饼图（中心总数）、场景排行（进度条）、订单履约堆叠、设备明细、日志回放 | 8 个 `useReport*` Hook |
| 资源中心 | `/resource` | 6 分类 tab + 3 筛选 + **搜索过滤**、8 模板卡（HeroIllustration 多风格）、3 案例（Before/After 对比图）、预览 Modal、创建模板 Modal、学习路径、热门资源 | `useResourceTemplates`/`Categories`/`FeaturedCases`/`Hot`/`Learning` |
| 任务编排 | `/orchestration` | 返回导航、运行状态、任务目标（用户需求 + 解析结果 + 约束 + 上传文件）、React Flow 9 节点（4 状态自定义 + 异常分支回路）、6 智能体（sparkline）、任务队列表、6 策略参数（保存并应用） | 7 个 `useOrchestration*` Hook |
| 场景编辑器 | `/editor` | 资源库（17 组件 × 7 分类）、网格画布（7 区 + 14 组件 + 出入口 + 工具栏 + 缩放）、属性面板（14 字段实时同步）、场景规则、**撤销/重做（Ctrl+Z/Y，30 步历史栈）**、**6 向对齐**、**保存（useSaveScenario mutation）**、**重新加载（带未保存提示 Modal）**、进入仿真校验 | `useScenario` + `useSaveScenario` |
| 帮助中心 | `/help` | Hero 搜索、6 文档分类、3 步学习路径、5 FAQ、联系方式 | 静态 |

### 2.5 仿真关键修复（P0：仿真时间负数）

**问题**：tab 隐藏后 `performance.now()` 跳变或回调顺序异常导致 `dt` 为负，仿真计时显示 `-1:-1:-15`。

**修复**：
- 新增 `src/utils/simTime.ts` 工具函数（`formatSimTime` + `safeDeltaSeconds`）
- `safeDeltaSeconds` 防呆：`dt <= 0` 视为 0；`dt > 1000ms` 视为 tab 休眠丢弃
- `formatSimTime` 防呆：负数夹到 0
- `visibilitychange` 事件：tab 恢复可见时重置 `lastTickRef`
- 单元测试 13 项覆盖：边界值、60fps、speed 倍率、tab 休眠等

### 2.6 场景编辑器增强（P1）

- **撤销/重做**：30 步历史栈；`Ctrl+Z` / `Ctrl+Y` 快捷键；新操作清空 redo 栈
- **6 向对齐**：左/右/水平居中/顶/底/垂直居中
- **保存（mutation）**：`useSaveScenario` 调用，loading 状态、操作日志、消息提示
- **重新加载**：未保存时弹 Modal 确认；保留历史栈边界
- **进入仿真前置校验**：未保存时拦截

### 2.7 已具备的非功能性能力

- 全部页面支持 1280px+ 响应式布局
- TypeScript 严格模式 0 错误
- ESLint（`--max-warnings 0`）通过，0 条 warning
- Vite 生产构建通过（7.21s）
- 加载态通过 `<Skeleton />` 呈现，避免白屏
- 顶部导航与侧栏状态联动（菜单高亮跟随当前路由）
- 各页面有完整的样式（hover、focus、active、disabled 状态）
- 8 个页面用 `useXxx` Hook 而非直接 import mock，VITE_USE_MOCK 切换可立即生效

### 2.8 自动化测试覆盖（Vitest）

```text
Test Files  4 passed (4)
Tests       45 passed (45)
Duration    ~3.2s
```

| 测试文件 | 测试数 | 覆盖点 |
| --- | ---: | --- |
| `src/utils/simTime.test.ts` | 13 | 时间格式化（负数/小数/24h+）+ safeDeltaSeconds（边界/speed/60fps） |
| `src/utils/simStateMachine.test.ts` | 10 | 仿真状态机（idle/running/paused/injected 转换、异常注入、tick 累积） |
| `src/utils/sceneEditor.test.ts` | 12 | 组件 CRUD + 6 向对齐 + 撤销/重做 + 历史上限 + 空栈保护 |
| `src/api/modules/api.test.ts` | 10 | 7 个 mock API 函数在 USE_MOCK=true 时返回 mock 数据 |

---

## 3. 阶段验收对照

| 原方案阶段验收项 | 完成状态 | 说明 |
| --- | :---: | --- |
| 前后端独立启动 | ✅ | 前端 `npm run dev` 启动成功；后端由负责人 B 推进 |
| 首页能读取模板或 Mock | ✅ | 首页通过 `homeStaticData` + `useTemplates` 展示 4 模板 + 5 特性 |
| 工程骨架可扩展 | ✅ | 路由、状态、请求层、组件库、领域 API 层均预留扩展点 |
| 类型契约可共享 | ✅ | `packages/contracts` 涵盖 7 类核心实体；后端 Pydantic 同步规则已在 `api-contract.md` |
| Lint 零警告 | ✅ | `--max-warnings 0` 通过 |
| TypeScript 编译通过 | ✅ | `tsc --noEmit` 0 错误 |
| 生产构建通过 | ✅ | `vite build` 成功 |
| Mock / 真实后端可切换 | ✅ | 8 个页面均通过 `useXxx` Hook 调用；`VITE_USE_MOCK=false` 可立即切真实 API |
| 自动化测试 | ✅ | 45 个 Vitest 测试用例全通过 |

---

## 4. 当前已知问题与改进计划

| # | 问题 | 级别 | 负责人 | 计划 |
| --- | --- | :---: | --- | --- |
| 1 | 仿真空间 8 个子路由共用同一页面，需实现独立功能子页 | P2 | A | 阶段 3-4 跟随后端接口逐步实现 |
| 2 | Vitest 仅覆盖纯函数与状态机，组件级快照测试待补 | P3 | A | 阶段 2 起按页补 React Testing Library 快照测试 |
| 3 | 真实接口契约同步：OpenAPI ↔ Pydantic ↔ TS 类型的自动化校验 | P3 | A+B | 阶段 2 引入 `openapi-typescript`，每接口变更自动生成前端类型 |

---

## 5. 变更记录

| 日期 | 阶段 | 操作人 | 说明 |
| --- | --- | --- | --- |
| 第 1 周 | Stage 1 初始交付 | 负责人 A | 工程骨架 + 8 页面 1:1 还原 |
| 第 1 周末 | Stage 1 修正 #1 | 负责人 A | 修复 lint 14 条 warning；建立领域 API 层；修正文档链接 |
| 第 1 周+1 | Stage 1 修正 #2 | 负责人 A | 修复 ECharts 图表渲染；仿真控制状态机；8 处交互反馈；场景编辑器增删改；AntD 弃用警告 |
| 第 1 周+2 | Stage 1 修正 #3（当前） | 负责人 A | **P0 修复仿真时间负数**（safeDeltaSeconds + visibilitychange）；8 个页面全部迁移到领域 API 层；场景编辑器增强（撤销/重做/对齐/保存/重载）；新增 Vitest 45 个测试用例覆盖时间/状态机/CRUD/API；HeroIllustration 自研 SVG 替换渐变占位 |

---

## 6. 关联文档

- [开发方案](../ICAN-无人仓仿真决策平台开发方案.md) — 完整的 6 周开发计划与技术方案
- [API 接口契约](./api-contract.md) — REST + WebSocket 协议
- [前端开发指南](./web-dev-guide.md) — 前端规范与目录说明
