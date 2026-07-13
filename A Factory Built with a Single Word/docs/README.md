# ICAN 无人仓生成与进化平台 (DuMate)

> A Factory Built with a Single Word.

## 项目简介

ICAN（DuMate / 一言造厂）是一个**无人仓生成与进化平台**：用户通过自然语言描述需求并上传订单/平面图等资料，系统自动生成仓库场景、编排任务、运行仿真、诊断问题并迭代优化方案，最终输出可对比的进化报告。

## MVP 演示主线

1. 选择「电商中型仓」模板
2. 输入需求并生成项目
3. 查看/微调二维仓库场景
4. 启动 10 台 AGV 执行 20 个订单
5. 注入「道路封闭」或「低电量」异常
6. 系统发现拥堵/延迟问题
7. 自动生成优化方案并再次仿真
8. 在进化报告中展示改善结果并导出 PDF

## 团队分工

- **负责人 A**：前端（`apps/web/`、`packages/mock-data/`、`packages/contracts/`）
- **负责人 B**：后端 + 仿真（`services/api/`、`services/simulation/`、`scenarios/`、`reports/`）

## 文档索引

- [总开发方案](../ICAN-无人仓仿真决策平台开发方案.md) — 完整技术方案与阶段计划
- [API 接口契约](./api-contract.md) — REST/WebSocket 协议
- [前端开发指南](./web-dev-guide.md) — 前端规范与目录说明

## 技术栈

- 前端：Vite + React 18 + TypeScript + Ant Design 5 + ECharts + Konva + React Flow + Zustand + TanStack Query
- 后端：FastAPI + Pydantic + SQLAlchemy + SimPy + NetworkX + A*
- 部署：Docker + Docker Compose
