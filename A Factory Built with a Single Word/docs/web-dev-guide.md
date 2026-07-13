# 前端开发指南（负责人 A）

## 1. 环境要求

- Node.js ≥ 18（建议 20+）
- npm ≥ 8（随 Node.js 一同安装）
- Git

## 2. 启动项目

```bash
# 克隆代码
git clone git@github.com:Wanzheng-mouse/ICAN.git
cd ICAN

# 安装依赖（首次）
npm install

# 启动前端（默认 http://localhost:5173）
npm run dev

# 构建生产版本
npm run build

# 类型检查 & Lint
npm run typecheck
npm run lint
```

## 3. 目录结构

```text
apps/web/                          # 负责人 A 主目录
├── public/                        # 静态资源
├── src/
│   ├── main.tsx                   # 入口
│   ├── App.tsx                    # 根组件
│   ├── routes.tsx                 # 路由配置
│   ├── api/                       # API 请求层
│   │   ├── client.ts              # Axios 封装
│   │   ├── ws.ts                  # WebSocket 客户端
│   │   └── queryClient.ts         # TanStack Query 配置
│   ├── components/                # 通用组件
│   │   ├── KpiCard/
│   │   ├── SectionCard/
│   │   └── StatusTag/
│   ├── constants/                 # 常量
│   │   └── menu.ts
│   ├── layouts/                   # 布局
│   │   ├── MainLayout.tsx         # 顶部导航
│   │   └── ConsoleLayout.tsx      # 仿真空间侧栏
│   ├── pages/                     # 页面（按一级菜单）
│   │   ├── Home/                  # 首页 / 创建任务
│   │   ├── Simulation/            # 仿真空间
│   │   ├── Evolution/             # 方案进化
│   │   ├── Report/                # 运行报告
│   │   ├── Resource/              # 资源中心
│   │   ├── Orchestration/         # 任务编排
│   │   ├── Editor/                # 场景编辑器
│   │   └── Help/                  # 帮助中心
│   ├── stores/                    # Zustand
│   │   └── useAppStore.ts
│   └── styles/
│       ├── theme.ts               # AntD 主题
│       └── global.ts              # 全局样式
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.development
```

## 4. 命名规范

- 文件：组件用 PascalCase (`KpiCard.tsx`)，其他 kebab-case
- 组件：PascalCase
- 变量 / 函数：camelCase
- 常量：UPPER_SNAKE_CASE
- CSS 类名：kebab-case
- 目录：PascalCase（组件）、kebab-case（其他）

## 5. 与后端协作

1. 第一周前端使用 `packages/mock-data` 中的静态数据，**不依赖后端**
2. 后端就绪后，通过 `import.meta.env.VITE_USE_MOCK` 切换：
   - `true`：纯 mock 模式
   - `false`：调用真实后端（默认开发时为 `true`）
3. 任何接口字段变更需要在 `docs/api-contract.md` 中更新

## 6. 提交规范

```text
feat(web): 实现首页需求输入与 4 文件上传
fix(web): 修复仿真页面 Canvas 渲染抖动
docs: 更新 API 契约文档
style(web): 调整 KPI 卡片间距
refactor(web): 抽出 KpiCard 通用组件
test(web): 为 Axios 拦截器添加单测
```

格式：`<type>(<scope>): <subject>`

## 7. Mock 数据

所有 mock 数据集中在 `packages/mock-data/src/`，按页面拆文件：

```text
packages/mock-data/src/
├── home.ts            # 首页 mock
├── simulation.ts      # 仿真空间 mock
├── evolution.ts       # 方案进化 mock
├── report.ts          # 运行报告 mock
├── orchestration.ts   # 任务编排 mock
├── editor.ts          # 场景编辑器 mock
└── index.ts           # 统一导出
```

修改 mock 时同步更新 `packages/contracts/src/index.ts` 中的 TypeScript 类型。

## 8. 调试技巧

- React DevTools + AntD 主题切换：`localStorage.setItem('antd-theme', 'dark')`
- ECharts 图表：右键 → 导出图片
- Konva 画布：在 `Stage` 上加 `onMouseMove` 实时打印坐标
- WebSocket：用浏览器 Network → WS 面板查看消息帧
