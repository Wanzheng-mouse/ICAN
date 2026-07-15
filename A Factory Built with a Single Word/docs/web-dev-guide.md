# ICAN 前端开发指南

## 1. 环境与命令

- Node.js 18+（推荐 20+）
- npm 8+

在项目根目录运行：

```powershell
npm install
npm run dev
cd apps/web
npx vitest run --testTimeout=15000
cd ../..
npm run typecheck
npm run lint
npm run build
```

Vite 默认地址为 <http://localhost:5173>，生产预览可在 `apps/web` 中运行 `npm run preview`（端口 4173）。

## 2. 目录结构

```text
apps/web/src/
├─ api/
│  ├─ client.ts             # Axios、Token 与统一错误处理
│  ├─ dtos/backend.ts       # 与 Pydantic 对齐的后端 DTO
│  ├─ mappers/              # 后端 DTO → 页面领域模型
│  ├─ modules/              # 项目/场景/仿真/进化等领域 API
│  ├─ queryClient.ts        # TanStack Query 配置
│  └─ ws.ts                 # WebSocket 客户端
├─ components/              # 通用组件
├─ layouts/                 # 页面布局
├─ pages/                   # 页面与业务交互
├─ stores/                  # Zustand 状态和项目上下文
├─ styles/                  # 主题与全局样式
├─ utils/                   # URL、场景编辑和仿真工具
├─ App.tsx
├─ main.tsx
└─ routes.tsx
```

共享类型在 `packages/contracts/src/`，演示数据在 `packages/mock-data/src/`。修改 Mock 结构时同步核对共享类型和 Mapper。

## 3. Mock 与真实后端

`apps/web/.env.development` 默认使用 Mock。真实联调时新建 `apps/web/.env.local` 并设置 `VITE_USE_MOCK=false`，不要提交个人环境配置。环境变量只在 Vite 启动时读取，修改后必须重启。

当前真实闭环：模板列表/详情/应用、项目创建/列表/详情、场景创建/读取/校验/自动布局/保存/版本历史、仿真创建/读取/控制/异常注入/WebSocket tick、进化创建/读取和 PDF 占位报告下载。

当前仅在 Mock 模式可完整演示：资源中心、任务编排、仿真 agents/events 列表、进化趋势和报告图表。认证、用户资料、搜索和通知始终使用前端本地实现。由于 `VITE_USE_MOCK` 是全局开关，真实模式下进入未接入页面会请求不存在的后端接口。

## 4. API 分层规则

1. 页面只调用 `api/modules` 导出的函数或 hooks，不直接拼 URL。
2. URL 通过 `utils/apiUrl.ts` 生成；模板和健康检查走 `/api`，其余默认走 `/api/v1`。
3. 后端响应先在 `api/dtos/backend.ts` 建模，再由 `api/mappers` 转为页面领域类型。
4. TanStack Query key 必须包含领域和资源 ID；写操作成功后更新或失效相关缓存。
5. 新增真实接口时保留可控的 Mock 分支，并为两种模式补充测试。

场景编辑器需要完整保留服务器的 `components`、`canvas`、`schema_version` 和 `version`；保存携带 `expected_version`，分别处理 409、422 和网络错误；自动布局只更新本地状态，保存后才持久化。

## 5. 路由与登录

公开路由：`/login`、`/register`、`/forgot-password`。其余页面由 `RequireAuth` 保护。

认证当前为前端 Mock，演示账号是 `admin / ican2026`。`VITE_USE_MOCK=false` 会使使用 `USE_MOCK` 的领域模块转向真实 API，但认证仍不会切换到后端；真实联调时只访问上文列出的已接入模块。

## 6. 命名与提交规范

- React 组件和组件目录：PascalCase
- 普通函数/变量：camelCase；常量：UPPER_SNAKE_CASE
- 组件文件优先 `.tsx`，纯逻辑和类型使用 `.ts`
- 测试文件与被测模块相邻，命名为 `*.test.ts` 或 `*.test.tsx`

```text
feat(web): 接入场景版本历史
fix(web): 修复场景保存冲突提示
docs: 更新前后端联调说明
test(web): 补充场景 Mapper 测试
```

## 7. 联调与排错

- 先访问后端 `/health`，再排查 Vite 或页面请求。
- 在浏览器 Network 中确认 URL、HTTP 状态和响应 `detail`。
- WebSocket 路径为 `/api/v1/simulations/{id}/stream`。
- 场景 409 表示版本已过期，应重新加载；422 表示 schema 或布局校验失败。
- 完整步骤见[本地开发与联调指南](./local-development.md)。
