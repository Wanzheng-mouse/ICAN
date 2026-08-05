# 全链路修复报告（2026-08-01）

> 范围：E:\UJN\ICAN 完整项目（FastAPI 后端 + React 前端 monorepo）
> 基线：后端 11/21 测试失败、前端 4/81 测试失败、eslint 8 警告、ruff 24 错误
> 结果：后端 21/21 通过、前端 81/81 通过、eslint 0 警告、ruff 0 错误、生产构建通过

---

## 一、后端问题与修复（services/api）

### 1. 模板详情接口 500（P0）
- **现象**：`GET /api/templates/{id}` 抛 Pydantic `ValidationError` → 500。
- **根因**：`TemplateDetailRead.data` 声明了 `validation_alias="scenario"`，路由却以 `data=` 构造，字段名与别名不匹配。
- **修复**：`schemas.py` 移除别名，统一字段名为 `data`，路由负责把 ORM 的 `Template.scenario` 映射进来。

### 2. 资源中心创建模板 422 / NOT NULL（P0）
- **现象**：`POST /api/v1/resource/templates` 返回 422；补上 schema 后 `templates.updated_at` NOT NULL 失败。
- **根因**：路由误用 `TemplateEventCreate`（事件模型）接收模板数据；`updated_at` 未赋值。
- **修复**：新增 `TemplateCreate` schema；创建时写入 `updated_at`。

### 3. 场景校验 / 自动布局 500（P0）
- **根因**：`validate_scenario` 对 `dict` 调用 `.model_dump()`；`auto_layout` 传入 dict 而服务端期望模型。
- **修复**：`scenarios.py` 修正传参。

### 4. 场景创建缺幂等与状态流转（P1）
- **现象**：同 `X-Idempotency-Key` 重试会重复创建场景；创建场景后项目仍为 `draft`。
- **修复**：使用已有的 `ScenarioRequestKey` 表实现场景幂等；首个场景创建后项目置为 `active`。

### 5. 通知已读返回 204 与契约不符（P1）
- **修复**：`PATCH /notifications/{id}/read` 改为 200 + `{"status":"ok"}`。

### 6. 缺失请求追踪（P1）
- **现象**：响应无 `X-Request-ID`，错误信封不带 `request_id`。
- **修复**：新增 `app/middleware/request_context.py`（生成/透传 request id、注入结构化日志）；注册为最外层中间件；异常处理器统一使用 `request.state.request_id`；422 信封同时输出 `errors`（JSON 序列化修复，原 `exc.errors()` 含 `ValueError` 无法序列化）。

### 7. 仿真运行回放为空（P0）
- **根因**：`persist_tick` 已把快照写入 `simulation_snapshots` 表，但 `/reports/{id}/log-playback` 仍读废弃的 `config.snapshot_history`。
- **修复**：改为从 `SimulationSnapshot` 表读取并组装帧，保留旧 config 回退。

### 8. 仿真机器人位置重叠（P0）
- **现象**：8 台 AGV 聚集到同一工位坐标，3D 视图堆叠；后端权威 tick 无法给出唯一位姿。
- **根因**：`_route` 的停靠位偏移只按 `lane % 3` 生成 3 个 x 偏移；导航（A*）模式完全丢失偏移。
- **修复**：新增 `_berth_point`，按 `lane % 8` 生成 4 列 x 2 行的唯一停靠位（相邻间距 ≥ 42）；A* 直接规划到停靠位，最终点钳制在画布内。

### 9. 演示账号与权限模型不一致（P1）
- **现象**：`lisi` 种子为 operator/demo1234，而契约与前端角色模型为 viewer/ican2026。
- **修复**：种子统一为 `lisi`（viewer / ican2026）；`create_project` 对 viewer 角色返回 403。

### 10. LLM 分析测试注入点失效（P1）
- **根因**：Phase-2 重构把 `analyze_with_agnes` 移出 `app.main`，测试的 `monkeypatch.setattr("app.main.analyze_with_agnes")` 失效。
- **修复**：`app.main` 重新导出该函数，路由在调用时经 `app.main` 惰性解析（避免循环导入）。

### 11. 生成候选响应与 schema 不一致（P1）
- **修复**：`/generation/{id}/candidates` 补充顶层 `status`，字段 `metrics` → `expected_metrics`。

### 12. 进化链路（P1）
- **现象**：`/evolutions/{id}/apply` 重复调用不幂等；响应缺 `evolution_id/project_id`、`changes` 类型错误；`/versions` 恒为空；应用与读取无权限校验；`evolution.id` 未 flush 即写审计日志导致 NOT NULL。
- **修复**：应用幂等 + 事件通知（“仿真运行已完成”“进化方案已生成新场景”）；`versions` 返回 Top3 候选；补齐权限校验与 `db.flush()`。

### 13. 其他
- 场景版本列表改为升序（契约要求 `[1,2]`）。
- `advanced_search` 修复把 `user/db` 位置参数传给 `global_search` 的历史 bug。
- 资源推荐改为按项目需求文本打分排序（行业关键词 + 产能匹配 + 合规词 + 质量分），医药需求正确命中 tpl-6。
- 模板应用必须提供场景名（缺名 400，替代原先的 500/NOT NULL）。
- 种子数据与 `domain.seed_users` 契约对齐；ruff 24 个问题清零并统一格式。

## 二、前端问题与修复（apps/web）

1. **Home 页 lint 失败**：清理未使用的 import/state（EyeOutlined、Skeleton、Select、templatesLoading、refetchTemplates、projects、cards 等）。
2. **首页补齐真实 KPI**：接入 `useDashboardKpis` 并渲染项目/场景/仿真/完成率卡片（此前契约要求但页面未调用）。
3. **API 契约测试不再依赖真实后端**：`api.test.ts` 将 axios 客户端 mock 为内存存储，断言模块调用的 URL/方法与响应透传，无需启动服务即可稳定运行。
4. **清理 Mock 残留配置**：`.env.test`、`vitest.config.ts` 移除已废弃的 `VITE_USE_MOCK`（与“只走真实后端”架构一致）。

## 三、仓库卫生

- 敏感文件复核：`.env`/数据库/日志/上传目录均未被 Git 跟踪（仅有安全默认值的 `.env.*` 样例入库）。
- `.gitignore` 补充：`vite.config.js.timestamp-*.mjs`、`~/`（pre-commit 缓存误落仓库根目录时不再污染状态）。
- 遗留 `~/.cache/pre-commit` 与 vite timestamp 产物建议手动删除（本环境删除策略受限，已忽略避免提交）。

## 四、验证结果

| 检查项 | 修复前 | 修复后 |
|---|---|---|
| 后端 pytest | 11 failed / 21 | **21 passed** |
| 后端 ruff check | 24 errors | **0 errors** |
| 后端 ruff format | 22 文件待格式化 | 已统一 |
| 前端 vitest | 4 failed / 81 | **81 passed** |
| 前端 eslint | 8 warnings（fail） | **0 warnings** |
| 前端 tsc --noEmit | 通过 | 通过 |
| 生产构建 vite build | 通过 | 通过 |
| CI 等价全仓命令（lint/typecheck/test/build） | 部分失败 | 全部通过 |

## 五、仍建议跟踪（非本轮阻塞）

- `.pytest_cache` 在部分 Windows 环境存在 ACL 拒绝写入（CI 已用 `-p no:cacheprovider` 规避）。
- `starlette.testclient` 的 httpx 弃用警告来自依赖版本组合，可待库升级时统一处理。
- 多 worker 部署时内存限流器按进程计数，生产建议单 worker 或接入 Redis（代码内已有注释说明）。
