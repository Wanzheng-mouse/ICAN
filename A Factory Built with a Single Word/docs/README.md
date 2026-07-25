# ICAN 文档索引

实现与文档不一致时，优先以 `services/api/app/main.py`、`apps/web/src/api/dtos/backend.ts`、领域 API 模块和测试为准。

| 文档 | 用途 |
| --- | --- |
| [项目 README](../README.md) | 当前能力、安装与验证 |
| [本地开发与联调](./local-development.md) | 全栈启动、模块级 Mock、联调排错 |
| [API 接口契约](./api-contract.md) | REST/WebSocket 字段和状态码 |
| [第 4 周仿真说明](./simulation-week4.md) | SimPy 运行模型、异常和恢复机制 |
| [前端开发指南](./web-dev-guide.md) | 前端数据层与协作规范 |
| [API 服务 README](../services/api/README.md) | 后端安装、测试与限制 |
| [总开发方案](../ICAN-无人仓仿真决策平台开发方案.md) | 项目计划与分工 |

历史文档 [阶段 1 完成总结](./stage-1-summary.md) 仅保留当时快照，不代表当前状态。

更新后端字段、路径、依赖或启动配置时，应在同一提交同步更新本文档、README、API 契约和相关测试。