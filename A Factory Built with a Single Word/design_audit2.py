import os
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

with open('services/api/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

out = []

# 1. 检查 WebSocket 实现
if 'WebSocket' in content:
    ws_idx = content.find('WebSocket')
    out.append('WebSocket: FOUND at char ' + str(ws_idx))
    out.append('WS context: ' + repr(content[ws_idx:ws_idx+200]))

# 2. 检查 SimulationService 是否为真实仿真
if 'SimPy' in content or 'simpy' in content:
    out.append('SimPy: USED')
else:
    out.append('SimPy: NOT USED (deterministic calculations only)')

# 3. 检查是否有 A* 路径算法
if 'astar' in content.lower() or 'a_star' in content.lower():
    out.append('A*: FOUND')
else:
    out.append('A*: NOT FOUND')

# 4. 检查前端 SimView3D 是否消费后端 WS 数据
if os.path.exists('apps/web/src/components/SimView3D/index.tsx'):
    with open('apps/web/src/components/SimView3D/index.tsx', 'r', encoding='utf-8') as f:
        sim_view = f.read()
    has_ws = 'useSimulationStream' in sim_view or 'WsClient' in sim_view
    out.append('SimView3D consumes WS: ' + str(has_ws))

# 5. 检查前端 simulationEngine.ts 是否独立运行
if os.path.exists('apps/web/src/components/SimView3D/simulationEngine.ts'):
    with open('apps/web/src/components/SimView3D/simulationEngine.ts', 'r', encoding='utf-8') as f:
        engine = f.read()
    out.append('Local engine size: ' + str(len(engine)) + ' chars')
    out.append('Local engine has tick: ' + str('tick' in engine.lower()))

# 6. 检查前端是否有 useSimulationStream hook
if os.path.exists('apps/web/src/hooks/useSimulationStream.ts'):
    with open('apps/web/src/hooks/useSimulationStream.ts', 'r', encoding='utf-8') as f:
        hook = f.read()
    out.append('useSimulationStream: EXISTS, ' + str(len(hook)) + ' chars')
else:
    out.append('useSimulationStream: NOT FOUND')

# 7. 检查前端 Simulation 页面是否使用 WS
if os.path.exists('apps/web/src/pages/Simulation/index.tsx'):
    with open('apps/web/src/pages/Simulation/index.tsx', 'r', encoding='utf-8') as f:
        sim_page = f.read()
    uses_ws = 'useSimulationStream' in sim_page or 'WsClient' in sim_page
    uses_local = 'SimulationEngine' in sim_page
    out.append('Simulation page uses WS: ' + str(uses_ws))
    out.append('Simulation page uses local engine: ' + str(uses_local))

# 8. 检查前端是否有 Mock 文本残留
if os.path.exists('apps/web/src/api/client.ts'):
    with open('apps/web/src/api/client.ts', 'r', encoding='utf-8') as f:
        client = f.read()
    out.append('client.ts USE_MOCK: ' + str('USE_MOCK' in client))

# 9. 检查后端是否有文件解析
out.append('File parsing libs in main.py: ' + str('pandas' in content or 'openpyxl' in content))

# 10. 检查后端 requirements.txt
if os.path.exists('services/api/requirements.txt'):
    with open('services/api/requirements.txt', 'r', encoding='utf-8') as f:
        reqs = f.read()
    out.append('requirements.txt has simpy: ' + str('simpy' in reqs))
    out.append('requirements.txt has pandas: ' + str('pandas' in reqs))
    out.append('requirements.txt has networkx: ' + str('networkx' in reqs))
    out.append('requirements.txt has openpyxl: ' + str('openpyxl' in reqs))
else:
    out.append('requirements.txt: NOT FOUND')

with open('C:/Users/HJ/AppData/Local/Temp/.tmpPXNJNL/design_audit2.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
