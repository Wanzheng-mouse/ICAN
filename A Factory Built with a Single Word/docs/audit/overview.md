# 数据闭环修复完成报告

## 问题诊断

"需求生成 → 场景保存 → 仿真运行" 没有形成同一个数据闭环，存在 5 个断点：

1. **Home/index.tsx**: `handleGenerate` 创建空场景 `components: []`
2. **Home/index.tsx**: `handleUseExample` 只随机填入文本，无示例场景
3. **Editor/index.tsx**: `enterSimulation` 硬编码 `robot_count: 10`，忽略场景内容
4. **后端 simulation.py**: `create_simulation` 只校验 scenario_id 存在，不读取场景内容
5. **Simulation/index.tsx**: 3D 页面总是调用 `createWarehouseConfig()` 固定工厂

## 修复内容

### 1. 桥接函数 — scenarioMapper.ts (Task #6)
- 新建 `apps/web/src/components/SimView3D/scenarioMapper.ts`
- `scenarioToWarehouseConfig(data)` 将 2D 编辑器场景转换为 3D 仓库布局
- 空场景降级到固定工厂，标记 `fallback: true`
- 映射规则: shelf→ShelfZone, agv→AGV位置, station→工位区, charger→充电区

### 2. 后端仿真服务 — simulation.py + schemas.py + main.py (Task #7)
- `SimulationCreate.robot_count` 改为 `int | None`（可从场景推导）
- 新增 `scenario_version` 字段
- `SimulationService.create()` 接收场景数据和版本，从 AGV 组件推导数量和位置
- `_initial_runtime()` 支持从场景提取 AGV 坐标
- `run.config` 存储 `scenario_snapshot`、`scenario_version`、`scenario_hash`、`fallback` 标志
- `create_simulation` 端点传递 `scenario.data` 和版本号给引擎

### 3. 仿真页面 — Simulation/index.tsx (Task #8)
- 从 `detailQuery.data?.config?.scenario_snapshot` 读取场景快照
- 通过 `scenarioToWarehouseConfig()` 转换为 3D 布局
- 有真实组件时显示绿色 "场景已加载" 横幅（含设备统计）
- 降级时显示蓝色提示横幅

### 4. 编辑器 — Editor/index.tsx (Task #9)
- `enterSimulation()` 从 `components.filter(c => c.type === 'agv')` 推导 AGV 数量
- 空场景/无 AGV 场景被拦截
- 不再硬编码 `robot_count: 10`，由后端从场景快照推导
- 发送 `scenario_version` 跟踪版本

### 5. 首页生成 — Home/index.tsx + generateComponents.ts (Task #10)
- 新建 `apps/web/src/utils/generateComponents.ts`
  - `parseRequirementForDevices()`: 关键词解析设备数量
  - `generateComponents()`: 生成带合理坐标的 SceneComponent[]
  - `INDUSTRY_EXAMPLES`: 4 个行业示例（电商/冷链/3C/医药）
- `handleGenerate()` 现在生成真实组件（不再 `components: []`）
- `handleUseExample` 改为弹出行业示例选择 Modal

## 数据闭环路径

```
用户输入需求 →(关键词解析)→ SceneComponent[] →(createScenario)→ 数据库场景
→(createSimulation + scenario_snapshot)→ run.config
→(scenarioToWarehouseConfig)→ WarehouseConfig → 3D 渲染
```

## 验证结果

| 门禁 | 状态 |
|------|------|
| 后端 pytest | 17/17 通过 |
| 前端 TypeScript | 0 错误 |
| 前端生产构建 | 38.52s 成功 |

## 修改文件清单

| 文件 | 变更类型 |
|------|---------|
| `apps/web/src/components/SimView3D/scenarioMapper.ts` | 新建 |
| `apps/web/src/utils/generateComponents.ts` | 新建 |
| `apps/web/src/pages/Home/index.tsx` | 修改 |
| `apps/web/src/pages/Editor/index.tsx` | 修改 |
| `apps/web/src/pages/Simulation/index.tsx` | 修改 |
| `apps/web/src/api/dtos/backend.ts` | 修改 |
| `services/api/app/services/simulation.py` | 修改 |
| `services/api/app/schemas.py` | 修改 |
| `services/api/app/main.py` | 修改 |
