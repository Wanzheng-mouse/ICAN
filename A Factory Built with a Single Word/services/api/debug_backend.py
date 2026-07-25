import os
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

with open('services/api/app/main.py', 'rb') as f:
    data = f.read()

out = []
out.append(f'file_size={len(data)}')

# Find download endpoint
idx = data.find(b'download')
out.append(f'download_at={idx}')
if idx >= 0:
    out.append(f'download_ctx={data[idx-30:idx+80]!r}')

# Find login endpoint
idx2 = data.find(b'def login')
out.append(f'login_at={idx2}')
if idx2 >= 0:
    out.append(f'login_ctx={data[idx2:idx2+250]!r}')

# Find project file endpoint
idx3 = data.find(b'project_file')
out.append(f'project_file_at={idx3}')
if idx3 >= 0:
    out.append(f'pf_ctx={data[idx3-20:idx3+100]!r}')

with open('C:/Users/HJ/AppData/Local/Temp/.tmpPXNJNL/backend_debug.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
