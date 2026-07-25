import os, sys
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

with open('services/api/app/main.py', 'rb') as f:
    data = f.read()

# 查找 issue_token 函数
idx = data.find(b'def issue_token')
if idx >= 0:
    end = data.find(b'\n\ndef ', idx+1)
    if end < 0:
        end = data.find(b'\n\nclass ', idx+1)
    print("issue_token 函数:")
    print(data[idx:end].decode('utf-8', errors='replace'))

# 查找 login 端点
idx2 = data.find(b'def login(payload')
if idx2 >= 0:
    end2 = data.find(b'\n\n@app', idx2+1)
    if end2 < 0:
        end2 = idx2 + 300
    print("\nlogin 端点:")
    print(data[idx2:end2].decode('utf-8', errors='replace'))

# 查找 get_current_user 函数
idx3 = data.find(b'def get_current_user')
if idx3 >= 0:
    end3 = data.find(b'\n\ndef ', idx3+1)
    if end3 < 0:
        end3 = data.find(b'\n\nclass ', idx3+1)
    print("\nget_current_user 函数:")
    print(data[idx3:end3].decode('utf-8', errors='replace'))
