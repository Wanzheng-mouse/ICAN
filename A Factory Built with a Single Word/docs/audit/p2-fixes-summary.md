# P2 问题修复总结

**修复时间**: 2026-07-25
**状态**: ✅ 全部 10 项 P2 修复完成（含 P0/P1 轮次已修复的 F1-4）

---

## 修复清单

| ID | 问题 | 修改文件 | 修复方案 |
|---|---|---|---|
| **F1-4** | `getProjectSimulations` 缺 Mock 分支 | `simulationApi.ts` | 添加 `if (USE_MOCK) return []` ✅ (P0/P1 轮次已修复) |
| **F2-3** | `run_simulation_to_completion` 未校验状态 | `main.py:774` | 添加 `if run.status not in ("running","created"): raise 409` |
| **F3-2** | `persist_tick` snapshot 写入无 IntegrityError 保护 | `runtime_scheduler.py:123` | savepoint + IntegrityError 重试快照写入 |
| **F3-3** | `update_scenario` 版本 TOCTOU 竞态 | `models.py:129` + `main.py:639` | UniqueConstraint + savepoint 原子化版本写入 |
| **F3-4** | `apply_generation_candidate` 无幂等保护 | `main.py:968` | 检查 `job.selected_candidate_id == candidate_id` 返回已有场景 |
| **F4-3** | `WsClient.onmessage` 非 JSON 消息静默丢弃 | `ws.ts:57` | catch 中创建 `ErrorEvent` 调用 `onError` |
| **F4-4** | `pollRequirementAnalysis` 固定 2s 轮询 | `generationApi.ts:173` | `1.5^x` 指数退避，2s→10s cap |
| **F4-5** | WS 首帧 `snapshot_from_run` 失败无限重连 | `main.py:824` | try/except 包裹，发送错误消息给客户端后关闭 |
| **F5-4** | `global_search` 全表扫描 | `main.py:1132` | SQL `ilike` 过滤 + `limit` 参数替代 Python 全量遍历 |
| **F5-5** | `snapshot_from_run` 每次 WS 连接都执行 tick | `runtime_scheduler.py:67` | elapsed=0 时跳过 tick+persist，直接构建响应 |

---

## 关键改动详情

### F3-3: 场景版本并发保护
- `ScenarioVersion` 模型添加 `UniqueConstraint("scenario_id", "version")`，防止重复版本号
- `update_scenario` 使用 `db.begin_nested()` (savepoint) 原子写入版本行
- 冲突时重新读取当前版本号并返回 409，客户端可重试

### F5-4: 全局搜索性能优化
- 原代码: `for project in db.query(Project).all(): if keyword in ...` → Python 全表扫描
- 新代码: `db.query(Project).filter(Project.name.ilike(pattern)).limit(limit)` → SQL 层面过滤
- 添加 `limit` 查询参数，默认 20，防止大结果集

### F5-5: WebSocket 首帧快照优化
- 原: 每次 WS 连接都调 `tick()` + `deepcopy` + `persist_runtime`，即使 elapsed=0
- 新: elapsed=0 时直接从 runtime 构建响应，跳过 deepcopy 和 persist

---

## 验证结果

```
1. Login:                                OK
2. Create project/scenario/sim:          OK
3. F2-3 run_to_completion 状态检查:      OK (stopped → 409)
4. F3-3 场景版本冲突:                    OK (409 预期版本不匹配)
5. F5-4 搜索 LIKE 过滤:                  OK (5 results)
6. F5-5 snapshot 快速路径:               OK (elapsed=0 sim)
7. F3-4 候选方案幂等:                    OK (相同 scenario_id)
```

## 完整质量门禁

累计审计问题: 3 P0 + 8 P1 + 10 P2 = **21 项全部修复 ✅**
