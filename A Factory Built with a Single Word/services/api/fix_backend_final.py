"""后端修复脚本：修复登录、文件列表、编码等问题"""
import os
import sys
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

# 修复控制台编码
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

with open('services/api/app/main.py', 'rb') as f:
    data = f.read()

results = []

# ============================================================
# 1. 修复登录端点 issue_token 调用
# ============================================================
old_login_return = b'return AuthRead(token=issue_token(db, user), user=user_to_read(user))'
new_login_return = b'return AuthRead(token=issue_token(db, user, remember=True), user=user_to_read(user))'
if old_login_return in data:
    data = data.replace(old_login_return, new_login_return)
    results.append("[OK] 修复登录端点 issue_token 调用")
else:
    results.append("[SKIP] 登录端点 issue_token 已修改过")

# ============================================================
# 2. 添加文件列表端点 (GET /projects/{id}/files)
# ============================================================
upload_marker = b'@app.post(f"{PREFIX}/projects/{{project_id}}/files"'
file_list_endpoint = b'''@app.get(f"{PREFIX}/projects/{{project_id}}/files")
def list_project_files(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectFileRead]:
    require_project_access(project_id, user, db)
    files = db.query(ProjectFile).filter(
        ProjectFile.project_id == project_id
    ).order_by(ProjectFile.created_at.desc()).all()
    return [project_file_to_read(item) for item in files]


'''
if upload_marker in data and b'list_project_files' not in data:
    data = data.replace(upload_marker, file_list_endpoint + upload_marker)
    results.append("[OK] 添加文件列表端点")
elif b'list_project_files' in data:
    results.append("[OK] 文件列表端点已存在")
else:
    results.append("[FAIL] 找不到上传端点标记")

# ============================================================
# 3. 修复编码问题 - 将所有 GBK 内容转为 UTF-8
# ============================================================
try:
    text_utf8 = data.decode('utf-8')
    results.append("[OK] 文件已经是 UTF-8 编码")
except UnicodeDecodeError:
    try:
        text_gbk = data.decode('gbk')
        data = text_gbk.encode('utf-8')
        results.append("[OK] 已将 GBK 编码转换为 UTF-8")
    except:
        results.append("[FAIL] 无法解码文件")

# 写回文件
with open('services/api/app/main.py', 'wb') as f:
    f.write(data)

# 打印结果
for r in results:
    print(r)

print("\n后端修复完成！")
