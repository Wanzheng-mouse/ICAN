import os
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

# 读取后端 main.py 的关键设计
with open('services/api/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

out = []

# 1. 检查是否有 Alembic
if os.path.exists('services/api/alembic'):
    out.append('Alembic: YES')
else:
    out.append('Alembic: NO (using ensure_schema)')

# 2. 检查 .gitignore
if os.path.exists('.gitignore'):
    with open('.gitignore', 'r', encoding='utf-8') as f:
        gi = f.read()
    out.append('.gitignore has uploads: ' + str('uploads' in gi))
    out.append('.gitignore has ican.db: ' + str('ican.db' in gi))
    out.append('.gitignore has .env: ' + str('.env' in gi))
else:
    out.append('.gitignore: NOT FOUND')

# 3. 检查 CORS 配置
cors_idx = content.find('CORSMiddleware')
if cors_idx >= 0:
    out.append('CORS: ' + repr(content[cors_idx:cors_idx+200]))

# 4. 检查数据库 URL
db_idx = content.find('database_url')
if db_idx >= 0:
    out.append('DB URL: ' + repr(content[db_idx:db_idx+80]))

# 5. 检查 upload_dir
upload_idx = content.find('upload_dir')
if upload_idx >= 0:
    out.append('Upload dir: ' + repr(content[upload_idx:upload_idx+80]))

# 6. 检查暴露重置凭据
expose_idx = content.find('expose_reset_token')
if expose_idx >= 0:
    out.append('Expose reset: ' + repr(content[expose_idx:expose_idx+60]))

# 7. 检查前端 USE_MOCK 使用情况
import subprocess
result = subprocess.run(
    ['powershell', '-Command', 
     "Get-ChildItem 'apps/web/src' -Recurse -Include *.ts,*.tsx | Select-String 'USE_MOCK' | Select-Object -First 20 | ForEach-Object { $_.Filename + ':' + $_.LineNumber }"],
    capture_output=True, text=True, cwd=r'E:\UJN\ICAN\A Factory Built with a Single Word'
)
out.append('USE_MOCK usages: ' + str(len(result.stdout.strip().split('\n'))) + ' lines')

with open('C:/Users/HJ/AppData/Local/Temp/.tmpPXNJNL/design_audit.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
