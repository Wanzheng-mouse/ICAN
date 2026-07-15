# 本地开发与前后端联调指南

本文档对应当前仓库 `main` 的 React/Vite 前端和 FastAPI 后端。

## 1. 环境准备

| 工具 | 最低版本 | 建议版本 |
| --- | ---: | ---: |
| Node.js | 18 | 20+ |
| npm | 8 | 随 Node.js LTS |
| Python | 3.10 | 3.11+ |
| Git | 2.x | 最新稳定版 |

前端依赖安装在项目根目录；Python 依赖安装在 `services/api/.venv`。不要提交 `.env.local`、`.env`、数据库或缓存文件。

## 2. 获取并安装

```powershell
git clone https://github.com/Wanzheng-mouse/ICAN.git
cd "ICAN/A Factory Built with a Single Word"
npm install

cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

macOS/Linux 激活命令为 `source .venv/bin/activate`，复制配置使用 `cp .env.example .env`。

## 3. 启动模式

### 仅前端演示（默认）

`apps/web/.env.development` 默认设置 `VITE_USE_MOCK=true`。在项目根目录运行：

```powershell
npm run dev
```

此模式不要求启动后端，适合查看认证、资源、编排、报告图表等演示页面。

### 前后端真实联调

终端 1，在 `services/api` 中：

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

终端 2，在项目根目录中创建 `apps/web/.env.local`：

```dotenv
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_USE_MOCK=false
```

然后运行 `npm run dev`。`.env.local` 优先于已提交的 `.env.development`，且已被 `.gitignore` 忽略。切换模式后必须重启 Vite。

## 4. 联调验证顺序

1. 打开 <http://localhost:8000/health>，确认返回 `status: "ok"`。
2. 打开 <http://localhost:8000/docs>，确认 Swagger 可加载。
3. 打开 <http://localhost:5173>，使用 `admin / ican2026` 登录。
4. 在首页选择场景模板并创建项目。
5. 进入编辑器，确认已传递真实 `projectId` 和 `scenarioId`。
6. 修改组件后保存，确认版本号递增；另一会话用旧版本保存应收到 409。
7. 运行自动布局后再次保存，确认重新加载仍能读取相同画布与组件。

认证目前是前端 Mock；即使 `VITE_USE_MOCK=false`，登录本身也不会调用后端。该开关会让其他使用 `USE_MOCK` 的领域模块统一转向真实 API，因此真实联调时只访问后端已实现的页面。

## 5. 环境变量

### 前端

| 变量 | 开发默认值 | 说明 |
| --- | --- | --- |
| `VITE_APP_TITLE` | `DuMate 一言造厂` | 页面标题 |
| `VITE_BACKEND_URL` | `http://localhost:8000` | Axios 基地址和 Vite HTTP 代理目标 |
| `VITE_WS_URL` | `ws://localhost:8000` | Vite WebSocket 代理目标 |
| `VITE_USE_MOCK` | `true` | `true` 使用本地数据，`false` 请求真实接口 |
| `VITE_API_PREFIX` | `/api/v1` | 大部分业务接口前缀 |

模板与健康检查由 `apiUrl()` 自动使用 `/api` 前缀，其余业务接口默认使用 `/api/v1`。

### 后端

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ICAN_DATABASE_URL` | `sqlite:///./ican.db` | 数据库连接 |
| `ICAN_CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | 允许的浏览器源 |

## 6. 测试与构建

项目根目录：

```powershell
cd apps/web
npx vitest run --testTimeout=15000
cd ../..
npm run typecheck
npm run lint
npm run build
```

后端目录：

```powershell
python -m pytest tests -q
```

文档改动至少应运行 `git diff --check`；涉及接口示例时还应运行对应前后端测试。前端测试从 `apps/web` 直接调用本地 Vitest，参数 `--testTimeout=15000` 用于避免 Windows 首次冷启动时动态导入超过默认 5 秒。

## 7. 常见问题

### 前端仍在使用 Mock

- 确认 `apps/web/.env.local` 中是 `VITE_USE_MOCK=false`。
- 修改后完全停止并重新运行 Vite。
- 在浏览器 Network 面板中确认出现 `/api/v1/projects` 或 `/api/templates` 请求。

### 请求 404

- 模板使用 `/api/templates`；项目、场景、仿真和进化使用 `/api/v1`。
- 真实后端目前没有资源、编排、仿真 agents/events、进化 versions 或报告图表接口；`VITE_USE_MOCK=false` 时进入这些页面会返回 404，需要演示时请切回 Mock 模式。

### 请求被 CORS 拒绝

- 确认前端地址已包含在 `ICAN_CORS_ORIGINS` 中。
- 修改 `.env` 后重启后端。

### 场景保存返回 409

当前页面持有的 `expected_version` 已过期。重新加载场景，基于服务器最新版本重新编辑和保存，不要直接覆盖。

### 场景保存返回 422

查看响应 `detail.issues`：常见原因为组件越界、矩形重叠、重复 ID 或 schema 不符合 `1.0`。

### SQLite 数据位置不符合预期

默认连接是相对路径，数据库生成在启动后端时的当前目录。建议始终从 `services/api` 启动。
