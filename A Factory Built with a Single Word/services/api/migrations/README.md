# 数据库升级

当前版本使用 SQLite。应用启动时会创建缺失表，并通过 `ensure_schema` 补齐旧数据库字段；`001_audit_and_deterministic_runs.sql` 记录审计表，`002_evolution_apply.sql` 记录进化结果关联新场景的字段。

升级前请停止 API 并备份 `ican.db`。通常只需启动新版本，由 `ensure_schema` 判断字段是否存在后安全补齐；不要在未知数据库状态下重复手工执行 `ALTER TABLE`。启动后访问 `/health`，再用管理员账号访问 `/api/v1/audit-logs` 验证结果。仿真固定随机种子、已运行时间和指标历史保存在 `simulation_runs.config` 的 `random_seed`、`elapsed`、`metric_history` 字段中，因此不需要修改表结构。
