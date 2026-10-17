#!/usr/bin/env python3
"""从 Azgaar 导出 JSON 生成平面地图的矢量 / 栅格数据 js/atlas-data.js。

平面地图完全由代码渲染：海岸、湖泊、国界、河流、航线是矢量，
高程 / 生物群系 / 政区是小尺寸数据栅格（base64 Uint8），
山丘、森林等符号由客户端按高程 / 群系确定性撒点。重新导出地图后运行：
    python3 tools/build_atlas.py
"""
import base64, json, math, random, sys
from pathlib import Path
import numpy as np
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / '素材/地图/Pierteia Full 2026-09-19-01-11.json'
OUT = ROOT / 'js/atlas-data.js'
STEP = 5  # 栅格单元（地图单位）

d = json.loads(SRC.read_text())
W, H = d['info']['width'], d['info']['height']
pack = d['pack']
cells, verts = pack['cells'], pack['vertices']
VP = [v['p'] for v in verts]
LAND = 20


def r1(v):
    return round(v * 10)


def ring_flat(pts):
    out = []
    for x, y in pts:
        out += [r1(min(max(x, 0), W)), r1(min(max(y, 0), H))]
    return out


# ---------- 海岸与湖泊 ----------
coast, lakes = [], []
for f in pack['features'][1:]:
    if not f or not f.get('vertices'):
        continue
    pts = [VP[v] for v in f['vertices']]
    if f['type'] == 'island':
        coast.append(ring_flat(pts))
    elif f['type'] == 'lake':
        lakes.append(ring_flat(pts))

# ---------- 政区环与国界线 ----------
def is_land(i):
    return 0 <= i < len(cells) and cells[i]['h'] >= LAND


def neighbour_across(ci, a, b):
    sa, sb = set(verts[a]['c']), set(verts[b]['c'])
    for n in sa & sb:
        if n != ci:
            return n
    return -1


edges_by_state = {}
border_edges = {}  # (sa,sb) -> list of (a,b)
for c in cells:
    if c['h'] < LAND:
        continue
    s = c['state']
    vs = c['v']
    for k in range(len(vs)):
        a, b = vs[k], vs[(k + 1) % len(vs)]
        n = neighbour_across(c['i'], a, b)
        ns = cells[n]['state'] if is_land(n) else -1
        if ns != s:
            edges_by_state.setdefault(s, []).append((a, b))
            if ns >= 0 and s < ns:
                border_edges.setdefault((s, ns), []).append((a, b))


def chain_rings(edges):
    nxt = {}
    for a, b in edges:
        nxt.setdefault(a, []).append(b)
    rings = []
    while nxt:
        start = next(iter(nxt))
        ring, cur = [start], start
        while True:
            lst = nxt.get(cur)
            if not lst:
                break
            n = lst.pop()
            if not lst:
                del nxt[cur]
            if n == start:
                break
            ring.append(n)
            cur = n
        if len(ring) > 2:
            rings.append(ring)
    return rings


def chain_lines(edges):
    adj = {}
    for a, b in edges:
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    lines = []
    def take(a, b):
        adj[a].discard(b); adj[b].discard(a)
    # 从端点（度≠2）开始，再处理闭环
    starts = [v for v, s in adj.items() if len(s) != 2]
    for st in starts + list(adj.keys()):
        while adj.get(st):
            line, cur = [st], st
            while adj.get(cur):
                n = next(iter(adj[cur]))
                take(cur, n)
                line.append(n)
                cur = n
                if len(adj.get(cur, ())) != 1:
                    break
            if len(line) > 1:
                lines.append(line)
    return lines


# 每个政区的环（同一顶点序列，客户端用同样的平滑，海岸段与海岸线重合）
regions = {}
for s, edges in edges_by_state.items():
    # 单元顶点顺序在 Azgaar 中一致，但为稳妥起见，补上方向：用有向边链接，失败的再反向尝试
    rings = chain_rings(edges)
    regions[s] = [ring_flat([VP[v] for v in r]) for r in rings]

borders = []
for (sa, sb), edges in border_edges.items():
    for line in chain_lines(edges):
        borders.append([sa, sb] + ring_flat([VP[v] for v in line]))

# ---------- 数据栅格 ----------
GW, GH = math.ceil(W / STEP), math.ceil(H / STEP)
pts = np.array([c['p'] for c in cells])
hs = np.array([c['h'] for c in cells], dtype=float)
# 用 grid 补充海域与四角
grid = d['grid']
gpts = np.array(grid['points'])
ghs = np.array([g['h'] for g in grid['cells']], dtype=float)
gtemp = np.array([g.get('temp', 0) for g in grid['cells']], dtype=float)
gx, gy = np.meshgrid((np.arange(GW) + .5) * STEP, (np.arange(GH) + .5) * STEP)
allp = np.vstack([pts, gpts]); allh = np.concatenate([hs, ghs])
lin = LinearNDInterpolator(allp, allh)
near = NearestNDInterpolator(allp, allh)
hf = lin(gx, gy)
mask = np.isnan(hf)
hf[mask] = near(gx[mask], gy[mask])
hf = gaussian_filter(hf, 1.1)
height = np.clip(hf * 2.55, 0, 255).astype(np.uint8)

ni = NearestNDInterpolator(pts, np.arange(len(cells)))
cidx = ni(gx, gy).astype(int)
biome = np.array([c['biome'] for c in cells], dtype=np.uint8)[cidx]
state = np.array([c['state'] if c['h'] >= LAND else 255 for c in cells], dtype=np.uint8)[cidx]
temp = NearestNDInterpolator(gpts, gtemp)(gx, gy)
temp = np.clip(gaussian_filter(temp, 2) + 40, 0, 255).astype(np.uint8)  # +40 偏移

def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()

# ---------- 河流 ----------
rivers = []
for r in pack['rivers']:
    cs = [c for c in r['cells'] if 0 <= c < len(cells)]
    mouth = None
    while len(cs) > 2 and cells[cs[-1]]['h'] < LAND:  # 河口那一格在海里：只画到两格中点（约在海岸线上）
        mouth = cs.pop()
    if len(cs) < 2:
        continue
    p = [cells[c]['p'] for c in cs]
    if mouth is not None:
        a, b = cells[cs[-1]]['p'], cells[mouth]['p']
        p.append([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    rivers.append([round(r.get('sourceWidth', .05) * 100), round(max(r.get('width', .3), .1) * 100), round(r['discharge'])] + ring_flat(p))
rivers.sort(key=lambda r: -r[2])

# ---------- 道路与航线 ----------
routes = {'roads': [], 'trails': [], 'searoutes': []}
for rt in pack['routes']:
    g = rt.get('group')
    if g in routes and len(rt['points']) >= 2:
        routes[g].append(ring_flat([(p[0], p[1]) for p in rt['points']]))

# ---------- 常灵群岛的礁群（地点志：主岛与周围数十座岛礁） ----------
rng2 = random.Random(901)
CX, CY = 1471, 575
islets = []
tries = 0
while len(islets) < 26 and tries < 6000:
    tries += 1
    a = rng2.uniform(0, math.tau)
    rad = 8 + abs(rng2.gauss(0, 1)) * 22
    x, y = CX + math.cos(a) * rad * 1.2, CY + math.sin(a) * rad * .95
    # 避开时空裂缝主线（x≈1457–1486）
    if 1455 < x < 1487:
        continue
    gi, gj = int(y / STEP), int(x / STEP)
    if hf[gi, gj] >= LAND - 1:
        continue
    r = rng2.uniform(1.2, 3.2) if rng2.random() < .72 else rng2.uniform(3.4, 6.2)
    if any(math.hypot(x - i[0], y - i[1]) < r * 1.6 + i[2] * 1.6 + 1.8 for i in islets):
        continue
    islets.append((x, y, r))
islet_rings = []
for x, y, r in islets:
    n = 12
    ph = rng2.uniform(0, math.tau)
    rot = rng2.uniform(0, math.pi)
    asp = rng2.uniform(1.2, 2.1)
    pts = []
    for k in range(n):
        t = k / n * math.tau
        rr = r * (1 + .22 * math.sin(t * 3 + ph) + rng2.uniform(-.16, .16))
        ex, ey = math.cos(t) * rr * asp, math.sin(t) * rr
        pts.append((x + ex * math.cos(rot) - ey * math.sin(rot), y + ex * math.sin(rot) + ey * math.cos(rot)))
    islet_rings.append(ring_flat(pts))

# ---------- 政区配色：浅彩，相邻不同色 ----------
states = {}
for s in pack['states']:
    if not s or s.get('removed'):
        continue
    states[s['i']] = {'n': s.get('neighbors', []), 'pole': s.get('pole')}

out = {
    'W': W, 'H': H, 'kmPerUnit': d['settings']['distanceScale'],
    'step': STEP, 'gw': GW, 'gh': GH,
    'height': b64(height), 'biome': b64(biome), 'state': b64(state), 'temp': b64(temp),
    'coast': coast, 'lakes': lakes, 'islets': islet_rings,
    'regions': {str(k): v for k, v in regions.items() if k > 0},
    'borders': borders,
    'rivers': rivers,
    'routes': routes,
    'neighbors': {str(k): v['n'] for k, v in states.items() if k > 0},
}
js = ('/* 由 tools/build_atlas.py 从 Azgaar 导出数据生成，请勿手改。 */\n'
      'window.ATLAS_DATA=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
OUT.write_text(js)
print('wrote', OUT, len(js) // 1024, 'KB', 'rivers', len(rivers), 'borders', len(borders),
      'regions', sum(len(v) for v in regions.values()), 'islets', len(islets), 'grid', GW, GH)
