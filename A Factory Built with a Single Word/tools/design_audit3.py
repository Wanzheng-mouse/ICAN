import os
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

with open('services/api/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

out = []

# 1. 检查 WebSocket 的具体实现
ws_start = content.find('@app.websocket')
if ws_start >= 0:
    out.append('WS decorator found at: ' + str(ws_start))
    out.append('WS code: ' + repr(content[ws_start:ws_start+500]))
else:
    out.append('WS decorator: NOT FOUND')

# 2. 检查 SimulationService 是否为真实仿真
sim_start = content.find('class SimulationService')
if sim_start >= 0:
    sim_end = content.find('\n\nclass ', sim_start + 1)
    if sim_end < 0:
        sim_end = content.find('\n\ndef ', sim_start + 1)
    sim_code = content[sim_start:sim_end]
    out.append('SimulationService code length: ' + str(len(sim_code)))
    has_det = 'deterministic' in sim_code.lower() or 'Replace' in sim_code
    has_simpy = 'simpy' in sim_code.lower()
    out.append('Has deterministic calc: ' + str(has_det))
    out.append('Has SimPy: ' + str(has_simpy))

# 3. 检查前端路由配置
if os.path.exists('apps/web/src/routes.tsx'):
    with open('apps/web/src/routes.tsx', 'r', encoding='utf-8') as f:
        routes = f.read()
    out.append('Routes has /projects: ' + str('/projects' in routes))
    out.append('Routes has /editor: ' + str('/editor' in routes))
    out.append('Routes has /simulation: ' + str('/simulation' in routes))
    out.append('Routes has /evolution: ' + str('/evolution' in routes))
    out.append('Routes has /report: ' + str('/report' in routes))
    out.append('Routes has /search: ' + str('/search' in routes))
    out.append('Routes has /notifications: ' + str('/notifications' in routes))

# 4. 检查前端是否有路由守卫
if os.path.exists('apps/web/src/components/RequireAuth/index.tsx'):
    with open('apps/web/src/components/RequireAuth/index.tsx', 'r', encoding='utf-8') as f:
        auth = f.read()
    out.append('RequireAuth blocks /login: ' + str("'/login'" in auth))
    out.append('RequireAuth allows /login: ' + str("'/login'" in auth and 'PUBLIC_PATHS' in auth))

# 5. 检查前端是否有 404 页面
pages_dir = 'apps/web/src/pages'
if os.path.exists(pages_dir):
    pages = os.listdir(pages_dir)
    out.append('Pages: ' + str(pages))

# 6. 检查后端是否有 404 页面
out.append('Has 404 handler: ' + str('404' in content))

# 7. 检查前端是否有全局错误处理
if os.path.exists('apps/web/src/api/client.ts'):
    with open('apps/web/src/api/client.ts', 'r', encoding='utf-8') as f:
        client = f.read()
    out.append('client.ts has error interceptor: ' + str('interceptors.response' in client))
    out.append('client.ts has 401 handling: ' + str('401' in client))
    out.append('client.ts has 403 handling: ' + str('403' in client))

# 8. 检查前端是否有全局 loading 处理
if os.path.exists('apps/web/src/api/queryClient.ts'):
    with open('apps/web/src/api/queryClient.ts', 'r', encoding='utf-8') as f:
        qc = f.read()
    out.append('queryClient.ts exists: ' + str(len(qc) > 0))
    out.append('queryClient has onError: ' + str('onError' in qc))

# 9. 检查后端是否有数据库迁移机制
out.append('Has Alembic: ' + str(os.path.exists('services/api/alembic')))
out.append('Has ensure_schema: ' + str('ensure_schema' in content))

# 10. 检查前端是否有 .env 文件
out.append('Has .env.local: ' + str(os.path.exists('apps/web/.env.local')))
out.append('Has .env.development: ' + str(os.path.exists('apps/web/.env.development')))

with open('C:/Users/HJ/AppData/Local/Temp/.tmpPXNJNL/design_audit3.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
