# ICAN 服务端

`services/` 由后端与仿真负责人维护。目前可运行实现位于 `api/`，包含 FastAPI 接口、SQLite 持久化以及仿真和方案进化的 MVP 服务。

## 目录

```text
services/
├─ api/
│  ├─ app/main.py        # 数据模型、业务服务、REST 与 WebSocket 入口
│  ├─ tests/test_api.py  # 第 1–3 周接口闭环测试
│  ├─ requirements.txt   # Python 依赖
│  ├─ .env.example       # 环境变量模板
│  └─ README.md          # 后端启动与接口说明
└─ README.md
```

计划中的独立 `services/simulation/` 尚未拆分；当前 `SimulationService` 和 `EvolutionService` 仍在 `api/app/main.py` 中，后续可在保持 API 契约不变的前提下迁出。

## 已实现能力

- 项目、模板和场景持久化
- 场景结构、边界、重叠与组件 ID 校验
- 确定性自动布局、乐观锁保存和不可变版本快照
- 仿真创建/控制、异常注入和 WebSocket tick
- 基础方案进化与 PDF 占位报告

启动、测试和环境变量见 [API 服务 README](./api/README.md)，跨端字段约定见 [API 接口契约](../docs/api-contract.md)。
