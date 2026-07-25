import os, sys
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

with open('services/api/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复登录端点 - 从 request body 中获取 remember 参数
# 当前后端 LoginRequest 没有 remember 字段，需要添加
# 或者在前端传递 remember 参数

# 方法：修改 login 端点，让它从 password 字段推断（不推荐）
# 更好的方法：修改 LoginRequest 添加 remember 字段

# 查找并修改 LoginRequest
old_login_request = '''class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=6, max_length=128)'''

new_login_request = '''class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=6, max_length=128)
    remember: bool = False'''

if old_login_request in content:
    content = content.replace(old_login_request, new_login_request)
    print("[OK] 添加 LoginRequest.remember 字段")
else:
    print("[SKIP] LoginRequest 已有 remember 字段或格式不同")

# 修改登录端点调用
old_login_call = '''return AuthRead(token=issue_token(db, user, remember=True), user=user_to_read(user))'''
new_login_call = '''return AuthRead(token=issue_token(db, user, remember=payload.remember), user=user_to_read(user))'''

if old_login_call in content:
    content = content.replace(old_login_call, new_login_call)
    print("[OK] 修改登录端点使用 payload.remember")
else:
    print("[SKIP] 登录端点调用已修改或格式不同")

with open('services/api/app/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n后端修复完成！")
