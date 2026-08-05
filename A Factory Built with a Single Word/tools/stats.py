import os, sys
os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')
out = []
for d in ['apps/web/src', 'services/api/app']:
    total = 0
    files = 0
    for root, _, fnames in os.walk(d):
        for fn in fnames:
            fp = os.path.join(root, fn)
            if fn.endswith(('.ts', '.tsx', '.py')):
                try:
                    sz = os.path.getsize(fp)
                    total += sz
                    files += 1
                except: pass
    out.append('{0}: {1} files, {2:.0f} KB'.format(d, files, total/1024))
with open('C:/Users/HJ/AppData/Local/Temp/.tmpPXNJNL/code_stats.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
