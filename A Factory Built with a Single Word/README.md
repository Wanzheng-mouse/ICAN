# ICAN — 无人仓生成与进化平台（DuMate）

> A Factory Built with a Single Word.

## 项目结构

```text
A Factory Built with a Single Word/
├─ apps/
│  └─ web/                 # 负责人 A：前端
├─ packages/
│  ├─ contracts/           # 共同维护：共享 TypeScript 类型
│  └─ mock-data/           # A 主维护：mock 数据
├─ services/               # 负责人 B：后端 + 仿真（见 B 仓库）
├─ scenarios/              # B 主维护
├─ reports/                # B 主维护
├─ docs/
├─ package.json
└─ README.md
```

## 快速开始（前端）

```bash
# 要求 Node.js ≥ 18、npm ≥ 8（推荐 Node 20+）

# 在仓库根目录安装依赖
npm install

# 启动前端开发服务器
npm run dev
# → http://localhost:5173

# 构建
npm run build

# 类型检查 & Lint
npm run typecheck
npm run lint

# 单元测试（45 个用例覆盖时间/状态机/CRUD/API）
npm test
```

## 文档

- [前端开发指南](./docs/web-dev-guide.md)（负责人 A 维护）
- [API 接口契约](./docs/api-contract.md)（与负责人 B 共同维护）
- [项目总方案](./ICAN-无人仓仿真决策平台开发方案.md)
- [阶段 1 完成总结](./docs/stage-1-summary.md)

## 协作分支

```
main            可演示的稳定版本
develop         阶段集成分支
feat/web-*      负责人 A
feat/api-*      负责人 B
feat/sim-*      负责人 B
```

## 阶段进度

- [x] 阶段 0：定范围、冻结协议
- [x] 阶段 1：跑起工程骨架
- [ ] 阶段 2：创建项目与场景
- [ ] 阶段 3：场景编辑
- [ ] 阶段 4：仿真闭环
- [ ] 阶段 5：优化与进化报告
- [ ] 阶段 6：交付与稳定性
