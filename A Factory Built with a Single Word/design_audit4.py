import os
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

out = []

# 1. 检查 RequireAuth 实际逻辑
if os.path.exists('apps/web/src/components/RequireAuth/index.tsx'):
    with open('apps/web/src/components/RequireAuth/index.tsx', 'r', encoding='utf-8') as f:
        auth = f.read()
    out.append('RequireAuth PUBLIC_PATHS: ' + str('PUBLIC_PATHS' in auth))
    out.append('RequireAuth checks !user: ' + str('!user' in auth))
    out.append('RequireAuth redirects to /login: ' + str('/login' in auth))

# 2. 检查 routes.tsx 路由守卫
if os.path.exists('apps/web/src/routes.tsx'):
    with open('apps/web/src/routes.tsx', 'r', encoding='utf-8') as f:
        routes = f.read()
    out.append('routes.tsx has RequireAuth: ' + str('RequireAuth' in routes))
    out.append('routes.tsx has /login route: ' + str('/login' in routes))
    out.append('routes.tsx has /register route: ' + str('/register' in routes))
    out.append('routes.tsx has /forgot-password route: ' + str('/forgot-password' in routes))

# 3. 检查前端环境变量
if os.path.exists('apps/web/.env.development'):
    with open('apps/web/.env.development', 'r', encoding='utf-8') as f:
        env = f.read()
    out.append('.env.development has VITE_BACKEND_URL: ' + str('VITE_BACKEND_URL' in env))
    out.append('.env.development has VITE_USE_MOCK: ' + str('VITE_USE_MOCK' in env))
    out.append('env content: ' + repr(env[:200]))

# 4. 检查前端是否有 404 页面
if os.path.exists('apps/web/src/pages/NotFound'):
    out.append('404 page: EXISTS')
else:
    out.append('404 page: NOT FOUND')

# 5. 检查前端 queryClient 配置
if os.path.exists('apps/web/src/api/queryClient.ts'):
    with open('apps/web/src/api/queryClient.ts', 'r', encoding='utf-8') as f:
        qc = f.read()
    out.append('queryClient config length: ' + str(len(qc)))
    out.append('queryClient has onError: ' + str('onError' in qc))

# 6. 检查前端 ws.ts 实现
if os.path.exists('apps/web/src/api/ws.ts'):
    with open('apps/web/src/api/ws.ts', 'r', encoding='utf-8') as f:
        ws = f.read()
    out.append('ws.ts has reconnect: ' + str('reconnect' in ws.lower() or 'retry' in ws.lower()))
    out.append('ws.ts has ping/pong: ' + str('ping' in ws.lower() or 'pong' in ws.lower()))
    out.append('ws.ts has heartbeat: ' + str('heartbeat' in ws.lower() or 'interval' in ws.lower()))

# 7. 检查后端是否有文件上传大小限制
with open('services/api/app/main.py', 'r', encoding='utf-8') as f:
    main = f.read()
out.append('max_upload_bytes defined: ' + str('max_upload_bytes' in main))
out.append('allowed_extensions defined: ' + str('allowed_extensions' in main))
out.append('Path traversal protection: ' + str('unquote' in main and 'Path' in main))
out.append('Structured logging: ' + str('logging.basicConfig' in main))
out.append('Request ID tracing: ' + str('request_id' in main.lower()))

# 8. 检查前端是否有全局错误边界
if os.path.exists('apps/web/src/App.tsx'):
    with open('apps/web/src/App.tsx', 'r', encoding='utf-8') as f:
        app = f.read()
    out.append('App.tsx has ErrorBoundary: ' + str('ErrorBoundary' in app))

# 9. 检查后端是否有 Rate Limiting
out.append('Rate limiting: ' + str('rate_limit' in main.lower() or 'throttle' in main.lower()))

# 10. 检查后端是否有数据库连接池配置
out.append('Connection pool: ' + str('pool_size' in main or 'pool_pre_ping' in main))

with open('C:/Users/HJ/AppData/Local/Temp/.tmpPXNJNL/design_audit4.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
