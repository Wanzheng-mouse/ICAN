# ICAN 无人仓仿真决策平台开发方案

> 文档用途：将现有网站原型落实为可在两人团队内交付的 MVP（最小可用版本）开发计划。  
> 结论：项目应定位为“无人仓仿真决策平台”，而不是若干独立的数据大屏。

## 1. 原型解读与产品定位

现有原型覆盖了完整的业务闭环：用户提出需求并上传资料，系统生成或编辑仓库场景，进行 AGV 仿真，发现异常，优化方案，并输出结果报告。

```text
自然语言需求 / 上传订单与配置
  → 需求结构化与模板选型
  → 仓库场景生成、编辑与校验
  → 任务分配与 AGV 仿真
  → 异常检测、指标统计
  → 参数优化与二次仿真
  → 优化前后对比、报告导出
```

原型页面与实际系统能力对应如下：

| 原型图 | 页面 | MVP 必须实现的能力 | 优先级 |
| --- | --- | --- | --- |
| image01 | 首页 / 任务创建 | 需求输入、文件上传、模板选择、创建项目 | P0 |
| image07 | 场景编辑器 | 二维仓库布局展示、组件放置/属性编辑、保存 | P0 |
| image02 | 仿真空间 | AGV 移动、控制按钮、日志、异常和实时指标 | P0 |
| image06 | 任务编排 / 智能体协同 | 工作流、任务队列、策略参数、智能体状态 | P1 |
| image05 | 方案进化 | 问题诊断、优化动作、版本与前后指标对比 | P0 |
| image04 | 运行报告 / 数据洞察 | 历史运行指标、趋势和异常统计 | P1 |
| image03 | 资源中心 | 场景/策略模板的浏览与套用 | P2（可先静态） |

### MVP 演示主线（必须跑通）

```text
选择“电商中型仓”模板
→ 输入需求并生成项目
→ 查看或微调二维仓库场景
→ 启动 10 台 AGV 执行 20 个订单
→ 注入“道路封闭”或“低电量”异常
→ 系统发现拥堵 / 延迟问题
→ 自动生成一个优化方案并再次仿真
→ 在进化报告中展示改善结果并导出 PDF
```

资源交易、复杂权限、真实 CAD 解析、完整 3D、ROS/Gazebo、强化学习与自训练大模型均不进入首版。它们会显著提高风险，却不会增强演示闭环。

## 2. 对初步方案的评估与调整

现有方案的核心判断是合理的：前后端分离、二维离散事件仿真、算法智能体优先于大模型、通过固定 JSON 协议协作。这些应保留。

建议做以下收敛：

| 初步方案 | 建议 | 原因 |
| --- | --- | --- |
| Next.js + React | 保留；若只做纯前端展示，也可用 Vite + React | Next.js 适合路由和后续部署；两人无需同时引入 SSR 复杂度 |
| PostgreSQL + Redis + Celery | 第 1 个可运行版本先使用 SQLite + FastAPI 后台任务；第 2 阶段再接 PostgreSQL/Redis | 仿真、优化和报告是核心，基础设施不能抢占首周时间 |
| SimPy + NetworkX + A* | 保留 | 足以完成二维多 AGV、路径、冲突、充电和指标演示 |
| Optuna / OR-Tools | 先实现规则调参或小范围枚举；Optuna 作为增强项 | 首版重点是得到稳定、可解释的优化前后差异 |
| 大模型智能体 | 采用“规则解析 + 表单兜底”，大模型仅做可选增强 | 断网或模型调用失败时仍可完整演示 |
| React-Konva 编辑器 | 首版先做“模板加载 + 属性修改 + 关键组件拖动”，再补撤销/框选等高级编辑 | 避免编辑器占据过多开发时间 |
| 报告导出 | 首版只保证 PDF；PPT/视频/ZIP 放入增强项 | PDF 最符合答辩交付需求 |

**架构原则：** 逻辑上拆分 `web`、`api`、`simulation`，部署上保持一个仓库、一个后端服务即可；不要一开始做微服务。

## 3. 推荐技术方案

### 3.1 前端（负责人 A）

| 目标 | 技术 | 用途 |
| --- | --- | --- |
| 框架 | Next.js / React / TypeScript | 页面路由、组件开发、类型约束 |
| UI | Ant Design | 表单、上传、表格、抽屉、消息提示 |
| 画布 | React-Konva | 二维仓库、AGV、路径、热区的绘制与交互 |
| 图表 | ECharts | 指标卡、趋势图、优化前后对比 |
| 流程图 | React Flow | 智能体协同和任务编排流程 |
| 状态与请求 | Zustand + TanStack Query | 前端状态和接口缓存 |
| 实时通信 | 原生 WebSocket | 接收仿真 tick、事件和日志 |
| 测试 | Vitest（关键组件） | 保证数据转换和核心交互 |

### 3.2 后端与仿真（负责人 B）

| 目标 | 技术 | 用途 |
| --- | --- | --- |
| API | FastAPI + Pydantic | REST、WebSocket、数据校验、自动 Swagger |
| 持久化 | SQLAlchemy；SQLite 起步，PostgreSQL 交付前切换 | 项目、场景、运行、报告元数据 |
| 文件处理 | pandas + openpyxl + PyYAML | 订单 Excel、JSON/YAML 配置导入 |
| 仿真 | SimPy | 离散事件、任务队列、时间推进 |
| 图与路径 | NetworkX + A* | 地图图结构、最短路和重规划 |
| 数据分析 | NumPy + pandas | 指标、报告数据和对比 |
| 优化 | 规则搜索 / 参数枚举；后续可接 Optuna | 产生可解释的进化方案 |
| 报告 | Jinja2 HTML + Playwright/Chromium PDF | 导出可打印的方案报告 |
| 测试与部署 | pytest + Docker Compose | 仿真单测与统一运行环境 |

### 3.3 “智能体”的正确实现

首版的智能体是职责清晰的算法模块，不应让 LLM 直接控制每一步 AGV：

- 调度智能体：选择可执行任务的 AGV（优先级、距离、电量、负载）。
- 导航智能体：A* 规划、道路封闭后的重规划。
- 能源智能体：低电量预警、充电桩选择和充电调度。
- 安全智能体：节点冲突、道路占用、拥堵和死锁风险。
- 评估智能体：完成率、平均时长、拥堵次数、空驶率、能耗。

自然语言功能采用“关键词/规则解析 → 表单确认 → 可选 LLM 增强”三层设计。用户输入无法可靠解析时，界面要求补充结构化字段，而不是让系统猜测。

## 4. 数据协议与接口边界

共同维护 `contracts/`，并在每个开发阶段开始时冻结字段。任何变动通过 PR 讨论，协议包含 `schema_version`。

### 4.1 核心实体

```text
Project、Scenario、Robot、Station、Task、SimulationRun、
SimulationEvent、SimulationMetrics、EvolutionVersion、Report
```

### 4.2 最小场景协议（示意）

```json
{
  "schema_version": "1.0",
  "scenario_id": "scn-ecom-001",
  "canvas": { "width": 1200, "height": 800, "scale": 1 },
  "shelves": [],
  "stations": [],
  "charging_stations": [],
  "robots": [],
  "nodes": [],
  "edges": [],
  "restricted_areas": []
}
```

### 4.3 仿真实时协议（示意）

```json
{
  "type": "simulation_tick",
  "run_id": "run-001",
  "time": 120,
  "robots": [],
  "tasks": [],
  "events": [],
  "metrics": {
    "completion_rate": 0.86,
    "average_duration": 112.4,
    "congestion_count": 5,
    "energy": 126.4
  }
}
```

### 4.4 首版 API 清单

```text
GET  /health
POST /projects
GET  /projects/{id}
POST /projects/{id}/files
GET  /templates
GET  /scenarios/{id}
PUT  /scenarios/{id}
POST /simulations
POST /simulations/{id}/control          # start / pause / stop
POST /simulations/{id}/anomalies
GET  /simulations/{id}
WS   /simulations/{id}/stream
POST /evolutions
GET  /evolutions/{id}
GET  /reports/{id}/pdf
```

## 5. 代码目录与所有权

建议在当前代码目录建立如下结构：

```text
A Factory Built with a Single Word/
├─ apps/
│  └─ web/                 # A 拥有
├─ services/
│  ├─ api/                 # B 拥有
│  └─ simulation/          # B 拥有
├─ packages/
│  ├─ contracts/           # 双方共同维护，需评审
│  └─ mock-data/           # A 主维护，B 可引用
├─ scenarios/              # B 主维护
├─ reports/                # B 主维护，A 负责视觉模板建议
├─ docs/
├─ docker-compose.yml      # 共同维护，B 主合并
└─ README.md               # 共同维护
```

- A 不修改 `services/` 的业务实现；B 不修改 `apps/web/` 的页面实现。
- A 用 `packages/mock-data` 完成页面和动画，不等待接口完成。
- B 用 Swagger、pytest 和 WebSocket 客户端完成接口和仿真验证，不等待页面完成。
- 只有协议、启动说明和 Docker 文件属于交叉区域；修改前先同步。

## 6. 六周开发阶段与两人分工

> 若时间不足，优先完成第 1–4 阶段与第 6 阶段的 PDF；资源中心、复杂编辑交互和 PPT 导出可降级。

| 阶段 / 时间 | 阶段目标 | 负责人 A：前端与交互 | 负责人 B：后端与仿真 | 阶段验收 |
| --- | --- | --- | --- | --- |
| 0：第 1–2 天 | 定范围、冻结协议 | 整理页面流转、加载/错误状态、演示脚本、Mock 数据 | 定义实体、场景/实时协议、异常类型、指标和 API | 评审通过的 `contracts` 与一条端到端演示路径 |
| 1：第 1 周 | 跑起工程骨架 | 初始化 Next.js、导航/布局/主题、路由、请求层、Mock 切换 | 初始化 FastAPI、`/health`、数据库模型、模板种子数据、Swagger | 前后端独立启动；首页能读取模板或 Mock |
| 2：第 2 周 | 创建项目与场景 | 完成首页、需求表单、上传卡片、模板选择、创建反馈 | 创建项目/上传/模板 API；Excel 和 JSON/YAML 基础解析；默认场景生成 | 从首页可创建项目并加载一个场景 JSON |
| 3：第 3 周 | 场景编辑 | Konva 地图、缩放/拖动、关键对象添加和选择、属性面板、保存 | 场景校验、货架边界/重叠检查、导航节点与边生成、场景版本保存 | 修改场景后刷新仍一致，并能生成可通行图 |
| 4：第 4 周 | 仿真闭环 | 仿真画布、AGV 动画、控制按钮、实时日志/指标、Mock 与 WS 适配 | SimPy 任务队列、A*、AGV 分配、电量/充电、冲突/拥堵、WS 推送 | 10 AGV 完成 20 订单；异常注入后产生事件和指标 |
| 5：第 5 周 | 优化与进化报告 | 工作流页、策略参数、问题清单、版本线、优化前后图表 | 诊断规则、2–5 轮规则调参、方案评分、版本和结果保存 | 至少识别 3 类问题，优化后至少 2 项指标改善 |
| 6：第 6 周 | 交付与稳定性 | 报告页、PDF 下载入口、1920×1080 适配、演示模式、录屏与备用静态数据 | PDF 生成、固定随机种子、pytest、Docker、一键启动、数据库初始化 | 连续 20 次演示稳定，断网时使用本地演示数据 |

### 每个阶段的协作方式

1. 阶段开始：双方共同确认协议样例和验收条件（不超过 30 分钟）。
2. 阶段中：A 对 Mock 协议编写页面；B 对同一协议编写 API 与测试。
3. 阶段末：先把 A 的数据源从 Mock 切到真实 API/WS，再做一次端到端回归。
4. 每天固定 15 分钟同步：已完成、协议变更、阻塞项、明日目标。

## 7. Git 协作规范

```text
main                     可演示的稳定版本
develop                  阶段集成分支
feat/web-home            A
feat/web-editor          A
feat/web-simulation      A
feat/api-project         B
feat/api-scenario        B
feat/sim-engine          B
feat/evolution-engine    B
```

- 不直接向 `main` 或 `develop` 推送。
- 一个功能分支只解决一个清晰的需求；提交信息使用 `feat:`、`fix:`、`docs:`、`test:`。
- 合并前由另一人检查：是否修改越界目录、是否变更协议、是否有测试或可复现演示步骤。
- 每周至少一次从 `develop` 同步到自己的分支，尽早解决冲突。

## 8. 最先要做的技术验证

不要先平铺七个页面。第一个可运行里程碑应在第 1 周末或第 2 周初完成：

```text
读取固定仓库场景
→ 后端创建 10 台 AGV 与 20 个订单
→ A* 得到路径，仿真每秒推送状态
→ 前端画布显示 AGV 移动
→ 页面显示完成率、平均时长与拥堵次数
```

这条链路跑通后，再依次增加：场景编辑、异常注入、优化进化、自然语言增强与报告。这样能确保项目始终是可演示的真实系统，而非只有静态原型的界面集合。

## 9. 首版完成标准

以下全部满足即可称为 MVP 完成：

- 可从模板创建项目，支持自然语言描述和订单文件上传。
- 可查看并修改二维场景，且场景可保存、可再次加载。
- 可运行多 AGV 仿真，至少包含任务分配、路径规划、电量与一种冲突处理。
- 可注入至少两种异常（推荐道路封闭、低电量或订单激增）。
- 可生成诊断结果，运行至少两轮方案并展示优化前后指标。
- 可导出一份 PDF 报告。
- 在一台演示电脑上可通过 Docker 或一键脚本稳定启动；外部模型或网络不可用时仍能完成演示。
