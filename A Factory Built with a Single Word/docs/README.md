# ICAN 文档索引

这里集中维护当前前后端契约、开发流程和历史交付记录。若文档描述与实现不一致，按以下事实来源核对：

1. 后端路由与 Pydantic 模型：`services/api/app/main.py`
2. 前端 DTO：`apps/web/src/api/dtos/backend.ts`
3. 前端请求路径：`apps/web/src/api/modules/` 与 `apps/web/src/utils/apiUrl.ts`
4. 可执行验证：`services/api/tests/` 与 `apps/web/src/**/*.test.ts`

## 当前文档

| 文档 | 用途 | 适用读者 |
| --- | --- | --- |
| [项目 README](../README.md) | 项目能力、快速启动、目录和当前边界 | 所有人 |
| [本地开发与联调](./local-development.md) | 全栈启动、Mock/真实模式、验证和排错 | 前后端开发者 |
| [API 接口契约](./api-contract.md) | REST/WebSocket 字段、状态码和未实现边界 | 前后端开发者 |
| [前端开发指南](./web-dev-guide.md) | 前端目录、数据层、环境变量和协作规范 | 前端开发者 |
| [API 服务 README](../services/api/README.md) | FastAPI 安装、配置、测试与限制 | 后端开发者 |
| [总开发方案](../ICAN-无人仓仿真决策平台开发方案.md) | 完整目标、分工和周计划 | 项目成员 |

## 历史文档

- [阶段 1 完成总结](./stage-1-summary.md)：第 1 周前端交付快照，其中测试数量和待办只代表当时状态；当前状态以项目 README 和实际测试结果为准。

## 更新规则

- 修改后端字段或路径时，同一提交更新 `api-contract.md` 和前端 DTO/调用层。
- 修改启动方式、端口、环境变量或依赖时，同一提交更新项目 README 与对应开发指南。
- 新增真实接口时，从“当前边界”删除对应 Mock 说明，并补充至少一个契约测试。
- 阶段总结作为历史快照保留，不用新状态覆盖旧记录。
