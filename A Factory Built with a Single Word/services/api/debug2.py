import os
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

with open('services/api/app/main.py', 'rb') as f:
    data = f.read()

out = []

# Find the file download endpoint
idx = data.find(b'/files/')
while idx >= 0 and idx < len(data):
    ctx = data[idx-30:idx+80]
    if b'project' in ctx.lower() or b'file' in ctx.lower():
        out.append('file_endpoint at ' + str(idx) + ': ' + repr(ctx))
    idx = data.find(b'/files/', idx+1)

# Find the file listing endpoint
idx = data.find(b'list_project')
out.append('list_project_files at ' + str(idx) + ': ' + repr(data[idx:idx+200]))

# Find login context
idx = data.find(b'def login(payload')
out.append('login at ' + str(idx) + ': ' + repr(data[idx:idx+300]))

# Find the project file download route
idx = data.find(b'projects/{{project_id}}/files/{{file_id}}/download')
out.append('file_download_route at ' + str(idx))
if idx >= 0:
    out.append(repr(data[idx-50:idx+200]))

# Find the project file routes
idx = data.find(b'projects/{{project_id}}/files')
out.append('file_routes at ' + str(idx))
if idx >= 0:
    out.append(repr(data[idx-30:idx+300]))

with open('C:/Users/HJ/AppData/Local/Temp/.tmpPXNJNL/backend_debug2.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
