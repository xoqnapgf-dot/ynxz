#!/usr/bin/env python3
"""把逐图设计好的主题（accent/accent2/hi/frame/dust）写入 js/gallery-data.js。
输入：scratchpad 里的 auth.json（按立绘序号 → 主题）与 rows.json（序号 → 意识形态/角色）。
规则：同一意识形态下，第一个角色的主题写在意识形态级；其余角色写在角色级。
"""
import json, re, sys
base = sys.argv[1]
auth = json.load(open(base + '/auth.json'))
rows = json.load(open(base + '/rows.json'))
IDEO_FROM_LAST = {'mysticism'}            # 意识形态级取最后一位（神秘主义取紫色那位）
P = 'js/gallery-data.js'
s = open(P, encoding='utf8').read()

def theme_str(t, motif=None):
    parts = [f"accent: '{t['a']}'", f"accent2: '{t['b']}'"]
    if t.get('h'): parts.append(f"hi: '{t['h']}'")
    if t.get('f'): parts.append(f"frame: '{t['f']}'")
    if t.get('d'): parts.append(f"dust: '{t['d']}'")
    if motif: parts.append(f"motif: '{motif}'")
    return '{ ' + ', '.join(parts) + ' }'

groups = {}
for i, r in enumerate(rows):
    groups.setdefault(r['id'], []).append(i)
for iid, idxs in groups.items():
    lead = idxs[-1] if iid in IDEO_FROM_LAST else idxs[0]
    # 意识形态级
    m = re.search(r"(  \{\n    id: '%s',.*?\n    theme: )\{ accent: '[^']*', accent2: '[^']*', motif: '([^']*)' \}" % re.escape(iid), s, re.S)
    if not m:
        print('no ideology theme for', iid); continue
    s = s[:m.start()] + m.group(1) + theme_str(auth[str(lead)], m.group(2)) + s[m.end():]
    # 角色级
    for i in idxs:
        if i == lead: continue
        cid = rows[i]['cid']
        pat = r"(        id: '%s',\n)" % re.escape(cid)
        if not re.search(pat, s):
            print('no char', cid); continue
        s = re.sub(pat, lambda mm: mm.group(1) + f"        theme: {theme_str(auth[str(i)])},\n", s, count=1)
    if iid in IDEO_FROM_LAST:
        # 另一位也需要角色级（与意识形态级不同）
        pass
open(P, 'w', encoding='utf8').write(s)
print('done', len(groups), 'ideologies')
