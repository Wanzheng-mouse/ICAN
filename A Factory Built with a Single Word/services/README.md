# 服务端代码（负责人 B 维护）

> 负责人 A 不要修改本目录的代码。

本目录将由负责人 B 在阶段 1 后填充：
- `api/`：FastAPI 后端（项目、场景、仿真、报告、用户等接口）
- `simulation/`：SimPy 仿真引擎、AGV 调度、路径规划、智能体

负责人 A 的工作边界：
- 仅修改 `apps/web/` 与 `packages/mock-data/`
- 跨域接口规范以 `docs/api-contract.md` 为准
- 需要新增前端依赖时，单独提交 PR 并在 README 记录
