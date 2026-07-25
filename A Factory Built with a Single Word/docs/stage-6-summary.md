# 第六阶段完成说明：稳定性、安全与交付

## 已完成

- REST 与 WebSocket 使用同一登录身份和项目成员权限。
- 仿真运行时间保存在数据库中，断线重连不会从 0 秒重新开始。
- 达到 100% 后发送 `simulation_completed`，运行状态持久化为 `completed`。
- 仿真创建支持固定 `random_seed`，同一输入具备可复验基础。
- 管理员可读取审计日志；仿真控制、异常注入、进化创建、PDF 导出和成员变更均留下记录。
- 管理员头像菜单新增“审计日志”页面，可按关键词和资源类型筛选，查看操作时间、用户、资源和附加详情；非管理员访问显示 403。
- 仿真达到 100%、进化分析完成、进化方案生成新场景时，系统会为相关用户创建持久化通知并链接到对应业务页面。
- 项目所有者可添加、更新和移除协作成员，角色分为所有者、可编辑和只读。
- 搜索、通知、个人资料、密码和偏好设置均使用真实 API 与持久化数据。
- 前端覆盖缺少上下文、401/403/404、数据加载失败、实时连接中断和空数据状态。
- 提供本地一键启动脚本、Docker Compose、前后端健康检查与 GitHub Actions 持续检查。
- 后端保留版本化迁移记录，旧 SQLite 数据库启动时自动补齐缺失结构。

## 自动验收

```powershell
# 项目根目录
npm run lint
npm run typecheck
npm run test --workspace=@ican/web
npm run build

# 后端目录 services/api
.\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```

CI 会重复执行以上检查，并构建前后端容器镜像。
