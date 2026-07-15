# 阶段 1 完成情况总结

> **历史快照**：本文记录第 1 周完成时的状态，其中测试数量、待办和分支说明不代表当前 `main`。最新启动方式、能力边界和验证结果请查看[项目 README](../README.md)与[文档索引](./README.md)。

> 项目：ICAN 一言造厂（DuMate）· 无人仓生成与进化平台
> 负责人：负责人 A · 前端
> 完成时间：第 1 周（含多轮修正）
> 包管理：npm workspaces
> 测试：66 通过（6 文件） · Lint 0 · TypeCheck 0 · Build 0
> 文档状态：第一周前端的 Mock 功能已基本完成，真实后端联动待阶段 2 统一推进。

---

## 1. 已交付的内容

### 认证体系（Mock）
- 登录页（深色卡片布局 + 演示账号一键填充 + 记住登录）
- 注册页（与登录一致的卡片布局 + 表单校验）
- 找回密码页（邮箱输入 + 演示标注 + 返回登录）
- `RequireAuth` 路由守卫（未登录跳转 /login + 回跳来源页）
- 退出登录（清除 user/token/上下文）

### 账户中心
- `/account/profile` 资料页（头像预览 + 昵称/邮箱/部门/角色 + 账号状态 Tag）
- `/account/settings` 安全页（密码强度 + 修改时间 + 改密码后强制重登）
- `/account/preferences` 偏好页（默认首页 + 演示模式 + 3 类通知开关；深色主题标注"即将上线"并禁用）
- 桌面端 224px 侧栏 + 内容区两栏布局，`<900px` 自动 Tabs

### 搜索与通知
- 顶栏搜索框 + 下拉建议面板（8 条 Mock 索引，携带实体 ID 跳转）
- `/search` 搜索结果页（类型筛选 Segmented + 关键词高亮 + 加载态 + 空结果插画 + 建议标签）
- 顶栏铃铛角标 + 通知抽屉（预览 + 标记已读 + 跳转）
- `/notifications` 通知中心页（严重等级色 + 标为已读/查看详情按钮 + 工具栏）

### 首页
- Hero Banner + 需求输入（7 步进度联动 + 项目/场景创建链路 + try/catch/finally 错误恢复）
- 补充资料默认折叠 + 热门模板卡片（消费 `useTemplates()` API 数据，回退 Mock）
- 5 大特性展示

### DTO 与接口契约
- `backend.ts` 与 `services/api/app/main.py` Pydantic 模型逐字段对齐
- `docs/api-contract.md` 更新：路径、请求体、响应格式、阶段 1 Mock 边界
- Mapper 层：`scenarioMapper` / `simulationMapper` / `evolutionMapper`
- `apiUrl()` 统一前缀（`/api/v1` + `/api/templates` 例外）

### 前后端对齐
- 项目上下文 Store（`currentProjectId/scenarioId/simulationId/evolutionId`）
- 首页 `handleGenerate` 调用 `createProject → createScenario → setProjectContext`
- 角色权限系统：`useCan(action)` 支持 `edit_scene` / `run_simulation` 等 6 类权限

### 测试覆盖（66 用例）
| 文件 | 用例 | 覆盖点 |
| --- | ---: | --- |
| `simTime.test.ts` | 13 | 时间格式化 + safeDeltaSeconds |
| `simStateMachine.test.ts` | 10 | 仿真状态机 4 态转换 |
| `sceneEditor.test.ts` | 12 | 组件 CRUD + 对齐 + 撤销/重做 |
| `api.test.ts` | 18 | 模板/仿真/进化/报告/认证 API |
| `stage1.test.ts` | 10 | 登录状态 + 搜索索引 + 通知 + 项目上下文 |
| `stores/week1.test.ts` | 2 | 额外状态测试 |

---

## 2. 已确认未完成（阶段 2 补齐）

| 问题 | 原因 | 计划 |
| --- | --- | --- |
| 真实 API 整体联调 | DTO 已对齐，Mock 与真实模式均就绪，待后端 pytest 通过后正式验证 | 阶段 2 初 |
| 后端 pytest 未执行 | 当前环境缺少 `fastapi` 依赖 | 配好 `.venv` 后运行 |
| 首页模板卡完全消费 API | 已消费 `useTemplates()` 但 `homeStaticData.cards()` 仍作为 fallback | 后端模板数据稳定后移除 fallback |
| 页面级角色控制 | `useCan()` 已建立，尚未接入各页面的渲染条件 | 阶段 2 逐页接入 |
| 阶段 1 成果纳入 Git | 所有改动均在 working tree 中 | `feat/stage1-summary` 分支提交 |
