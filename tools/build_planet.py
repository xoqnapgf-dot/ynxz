#!/usr/bin/env python3
"""从 Azgaar 导出数据与 js/atlas-data.js 烘焙 3D 地球的贴图（素材/globe/）。

与平面地图同一套海岸（同样的确定性粗糙化 + Chaikin 平滑），所以两种视图的陆地轮廓一致。
贴图不含任何光照：阴影、昼夜、大气、海面高光都在着色器里实时计算。

地形：Azgaar 高程作为宏观骨架 → 域扭曲山脊噪声 → 河网侵蚀（D8 汇流 + 河流功率律，
带构造抬升与坡面扩散，迭代出树枝状沟谷）→ 8k 上叠加细节。只是美术近似，不是测绘。

输出：
  albedo-8k.jpg / albedo-4k.jpg  地表反照率（陆地 / 浅海海床），sRGB
  normal-4k.jpg                  地形法线（东、北切线空间）
  data-4k.jpg                    R 陆地高程 · G 海深（海）/ 灯火（陆）· B 地形遮蔽（4:4:4）
  water-8k.png / water-4k.png    水体蒙版（海 / 湖 / 河 = 255，抗锯齿）
  clouds-4k.jpg                  R 低云 · G 卷云（4:4:4）
运行：python3 tools/build_planet.py [all|terrain|clouds]（all 约 6–9 分钟；
terrain / clouds 只在 scratch 目录输出预览，便于调参）。需要 numpy / scipy / Pillow。
"""
import json, math, sys, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy.ndimage import gaussian_filter, distance_transform_edt, zoom

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / '素材/地图/Pierteia Full 2026-09-19-01-11.json'
ATLAS = ROOT / 'js/atlas-data.js'
OUT = ROOT / '素材/globe'
TW, TH = 8192, 4096          # 反照率 / 水体
MW, MH = 2048, 1024          # 侵蚀与群系的中分辨率
Image.MAX_IMAGE_PIXELS = None
T0 = time.time()
LAND = 20


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


# ---------------------------------------------------------------- 与 js/atlas.js 相同的轮廓处理
def i32(x):
    x = int(x) & 0xffffffff
    return x - 0x100000000 if x & 0x80000000 else x


def imul(a, b):
    return i32((i32(a) * i32(b)) & 0xffffffff)


def jhash(a, b):
    h = imul(i32(a) ^ i32(0x9e3779b9), 0x85ebca6b) ^ imul(b + 0x632be59b, 0xc2b2ae35)
    h = i32(h ^ ((h & 0xffffffff) >> 16))
    h = imul(h, 0x7feb352d)
    h = i32(h ^ ((h & 0xffffffff) >> 15))
    return (h & 0xffffffff) / 4294967296


def unflat(f):
    return [(f[i] / 10, f[i + 1] / 10) for i in range(0, len(f), 2)]


def roughen(pts, closed, k, levels):
    for _ in range(levels):
        out, n = [], len(pts)
        m = n if closed else n - 1
        for i in range(m):
            a, b = pts[i], pts[(i + 1) % n]
            out.append(a)
            lo, hi = (a, b)
            if a[0] > b[0] or (a[0] == b[0] and a[1] > b[1]):
                lo, hi = b, a
            dx, dy = hi[0] - lo[0], hi[1] - lo[1]
            ln = math.hypot(dx, dy)
            if ln < .6:
                continue
            mx, my = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
            r = (jhash(math.floor(mx * 100 + .5), math.floor(my * 100 + .5)) - .5) * 2 * k
            out.append((mx - dy / ln * r * ln, my + dx / ln * r * ln))
        if not closed:
            out.append(pts[n - 1])
        pts = out
    return pts


def chaikin(pts, closed, it):
    for _ in range(it):
        out, n = [], len(pts)
        m = n if closed else n - 1
        if not closed:
            out.append(pts[0])
        for i in range(m):
            a, b = pts[i], pts[(i + 1) % n]
            out += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25), (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
        if not closed:
            out.append(pts[n - 1])
        pts = out
    return pts


def shape(f, closed):
    return chaikin(roughen(unflat(f), closed, .2, 2), closed, 2)


# ---------------------------------------------------------------- 三维梯度噪声（在球面上取样：无接缝、无极点拉伸）
_rng = np.random.default_rng(59812824)
PN = 4096
PERM = np.concatenate([_rng.permutation(PN), _rng.permutation(PN)]).astype(np.int32)
_G = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
               [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1], [1, 1, 0], [0, -1, 1], [-1, 1, 0], [0, -1, -1]], np.float32)
GX, GY, GZ = _G[:, 0], _G[:, 1], _G[:, 2]


def perlin(x, y, z):
    xf, yf, zf = np.floor(x), np.floor(y), np.floor(z)
    xi = xf.astype(np.int64) & (PN - 1); yi = yf.astype(np.int64) & (PN - 1); zi = zf.astype(np.int64) & (PN - 1)
    x = (x - xf).astype(np.float32); y = (y - yf).astype(np.float32); z = (z - zf).astype(np.float32)
    u = x * x * x * (x * (x * 6 - 15) + 10); v = y * y * y * (y * (y * 6 - 15) + 10); w = z * z * z * (z * (z * 6 - 15) + 10)
    a = PERM[xi] + yi; b = PERM[xi + 1] + yi
    aa, ab, ba, bb = PERM[a] + zi, PERM[a + 1] + zi, PERM[b] + zi, PERM[b + 1] + zi

    def g(hh, dx, dy, dz):
        h = PERM[hh] & 15
        return GX[h] * dx + GY[h] * dy + GZ[h] * dz
    x1, y1, z1 = x - 1, y - 1, z - 1
    l0 = g(aa, x, y, z) + u * (g(ba, x1, y, z) - g(aa, x, y, z))
    l1 = g(ab, x, y1, z) + u * (g(bb, x1, y1, z) - g(ab, x, y1, z))
    l2 = g(aa + 1, x, y, z1) + u * (g(ba + 1, x1, y, z1) - g(aa + 1, x, y, z1))
    l3 = g(ab + 1, x, y1, z1) + u * (g(bb + 1, x1, y1, z1) - g(ab + 1, x, y1, z1))
    m0 = l0 + v * (l1 - l0)
    m1 = l2 + v * (l3 - l2)
    return m0 + w * (m1 - m0)


def fbm(p, freq, octaves, gain=.5, lac=2.03, off=0.):
    x, y, z = p
    s, amp, norm = 0., 1., 0.
    for o in range(octaves):
        f = freq * lac ** o
        s = s + amp * perlin(x * f + off + o * 17.3, y * f - off * .7 + o * 31.1, z * f + off * 1.3 + o * 7.7)
        norm += amp
        amp *= gain
    return s / norm


def ridged(p, freq, octaves, gain=.5, lac=2.07, off=0.):
    """Ridged multifractal：前一层的脊决定下一层的权重，生成连贯的山脊。"""
    x, y, z = p
    s, amp, weight, norm = 0., 1., 1., 0.
    for o in range(octaves):
        f = freq * lac ** o
        n = 1 - np.abs(perlin(x * f + off + o * 11.9, y * f + o * 5.3, z * f - off + o * 23.7))
        n = n * n * weight
        weight = np.clip(n * 1.6, 0, 1)
        s = s + n * amp
        norm += amp
        amp *= gain
    return s / norm


def sphere(u, v):
    lon = (u - .5) * 2 * np.pi
    lat = (.5 - v) * np.pi
    c = np.cos(lat)
    return (np.sin(lon) * c).astype(np.float32), np.sin(lat).astype(np.float32), (np.cos(lon) * c).astype(np.float32)


def grid_uv(w, h, r0=0, r1=None):
    r1 = h if r1 is None else r1
    return np.meshgrid((np.arange(w) + .5) / w, (np.arange(r0, r1) + .5) / h)


def up(a, shape, order=1):
    f = (shape[0] / a.shape[0], shape[1] / a.shape[1]) + ((1,) if a.ndim == 3 else ())
    return zoom(a, f, order=order, mode='grid-wrap', grid_mode=True)


def scratch():
    p = Path('/tmp/planet-preview'); p.mkdir(exist_ok=True); return p


# ---------------------------------------------------------------- 数据
def load():
    d = json.loads(SRC.read_text())
    A = json.loads(ATLAS.read_text().split('window.ATLAS_DATA=', 1)[1].rstrip().rstrip(';'))
    global KV
    KV = 2 * A['H'] / A['W']
    return d, A


KV = 1.0  # 纬向压缩：地图纵向只占 ±180·H/W 度（load() 里按地图尺寸设定）


def tex_y(y, H):
    """地图 y → 贴图 v（0..1）。"""
    return .5 + KV * (y / H - .5)


def map_y(v, H):
    """贴图 v → 地图 y（可能落在 0..H 之外 = 地图以外的高纬海域）。"""
    return ((v - .5) / KV + .5) * H


def raster_mask(A, coast, lakes, w, h, rivers=True):
    """陆地 = 1。2× 超采样抗锯齿。河流宽度按真实比例收窄（8k 上 0.4–2.4 像素）。"""
    W, H = A['W'], A['H']
    SS = 2
    sx = w * SS / W
    ty = lambda y: tex_y(y, H) * h * SS
    im = Image.new('L', (w * SS, h * SS), 0)
    dr = ImageDraw.Draw(im)
    for r in coast:
        dr.polygon([(x * sx, ty(y)) for x, y in r], fill=255)
    for r in lakes:
        dr.polygon([(x * sx, ty(y)) for x, y in r], fill=0)
    if rivers:
        k = w / 8192
        for rv in A['rivers']:
            disc = rv[2]
            pts = chaikin(roughen(unflat(rv[3:]), False, .16, 2), False, 2)
            n = len(pts)
            wmax = min(2.4, .5 + math.sqrt(max(disc, 1)) * .042) * k
            for i in range(n - 1):
                t = i / max(1, n - 2)
                wpx = max(.32 * k, wmax * (.3 + .7 * t ** .7)) * SS
                a, b = pts[i], pts[i + 1]
                dr.line([(a[0] * sx, ty(a[1])), (b[0] * sx, ty(b[1]))], fill=0, width=max(1, int(round(wpx))))
    im = im.resize((w, h), Image.BOX)
    return np.asarray(im, np.float32) / 255


# ---------------------------------------------------------------- 河网侵蚀
DIRS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def receivers(h, cx, cy):
    """D8 最陡下降。返回（接收者扁平索引, 坡度）。顶/底行不向外流。"""
    Hh, Ww = h.shape
    idx = np.arange(Hh * Ww).reshape(Hh, Ww)
    best = np.zeros_like(h)
    rec = idx.copy()
    for dy, dx in DIRS:
        nb = np.roll(h, (-dy, -dx), (0, 1))
        if dy == -1:
            nb[0] = np.inf
        if dy == 1:
            nb[-1] = np.inf
        dist = np.sqrt((dx * cx) ** 2 + (dy * cy) ** 2)
        s = (h - nb) / dist
        m = s > best
        best[m] = s[m]
        rec[m] = np.roll(idx, (-dy, -dx), (0, 1))[m]
    return rec.ravel(), best


def accumulate(h, rec, land_ids):
    """按高度从高到低把汇流面积传给接收者（Python 循环，约 0.5 s / 百万格）。"""
    hf = h.ravel()
    order = land_ids[np.argsort(-hf[land_ids], kind='stable')].tolist()
    A = np.ones(hf.size, np.float64)
    al = A.tolist()
    rl = rec.tolist()
    for i in order:
        r = rl[i]
        if r != i:
            al[r] += al[i]
    return np.array(al).reshape(h.shape)


def erode(h, land, uplift, iters=48, K=2.6e-4, D=.12, dt=1.):
    Hh, Ww = h.shape
    lat = (.5 - (np.arange(Hh) + .5) / Hh) * np.pi
    cx = (2 * np.pi / Ww * np.maximum(np.cos(lat), .05))[:, None] * np.ones((1, Ww))
    cy = np.pi / Hh
    land_ids = np.flatnonzero(land.ravel())
    acc = None
    for it in range(iters):
        rec, slope = receivers(h, cx, cy)
        acc = accumulate(h, rec, land_ids)
        drop = h - h.ravel()[rec].reshape(h.shape)
        E = K * dt * np.sqrt(acc) * np.minimum(slope, 6.0)
        E = np.minimum(E, .7 * np.maximum(drop, 0))
        E[~land] = 0
        h = h - E + uplift * dt
        # 坡面扩散：圆滑山脊，防止针状尖峰
        lap = (np.roll(h, 1, 0) + np.roll(h, -1, 0) + np.roll(h, 1, 1) + np.roll(h, -1, 1) - 4 * h)
        h = np.where(land, h + D * lap * .25, h)
        h = np.where(land, np.maximum(h, .003), h)
        if it % 6 == 0:
            log(' erosion', it, float(h[land].mean()), float(acc.max()))
    return h, acc


def terrain_mid(d, A, land2):
    W, H = A['W'], A['H']
    cells = d['pack']['cells']
    pts = np.array([c['p'] for c in cells])
    hs = np.array([c['h'] for c in cells], float)
    gpts = np.array(d['grid']['points'])
    ghs = np.array([g['h'] for g in d['grid']['cells']], float)
    allp = np.vstack([pts, gpts]); allh = np.concatenate([hs, ghs])
    su, sv = grid_uv(MW, MH)
    mx, my = su * W, map_y(sv, H)
    outside = (my < 0) | (my > H)
    hm = LinearNDInterpolator(allp, allh)(mx, my)
    bad = np.isnan(hm)
    hm[bad] = NearestNDInterpolator(allp, allh)(mx[bad], my[bad])
    hm[outside] = np.minimum(hm[outside], 4)
    hm = gaussian_filter(hm, (1.6, 2.6), mode=('nearest', 'wrap'))
    e = np.clip((hm - LAND) / (100 - LAND), 0, 1).astype(np.float32)
    P = sphere(su, sv)
    q = tuple(P[i] + fbm(P, 6, 3, off=4.4 + i * 3.3) * .07 for i in range(3))
    rid = ridged(q, 11, 6, off=1.7)
    hill = fbm(P, 34, 5, off=-8.8)
    mount = np.clip((e - .12) / .45, 0, 1) ** 1.2
    h0 = e * .55 + mount * (rid - .3) * .42 + hill * (.004 + .05 * mount) + fbm(P, 9, 3, off=3.3) * .02
    h0 = np.where(land2, np.maximum(h0, .004), -.05).astype(np.float64)
    log('mid noise')
    uplift = np.where(land2, (e * .55 + mount * .25) * 2.0e-3, 0)
    h, acc = erode(h0, land2, uplift)
    log('erosion done')
    return h.astype(np.float32), acc.astype(np.float32), hm.astype(np.float32), e


def hillshade(h, z=40):
    gy, gx = np.gradient(h)
    nx, ny = -gx * z, gy * z
    n = 1 / np.sqrt(nx * nx + ny * ny + 1)
    l = np.array([-.5, .6, .62]); l /= np.linalg.norm(l)
    return np.clip((nx * l[0] + ny * l[1] + l[2]) * n, 0, 1)


# ---------------------------------------------------------------- 云
def clouds_tex(w=4096, h=2048, block=256):
    crng = np.random.default_rng(11)
    cyc = []
    for hemi in (1, -1):
        for _ in range(7):
            cyc.append((crng.uniform(0, 1), .5 - hemi * crng.uniform(.2, .34), crng.uniform(.07, .13), hemi * crng.uniform(2.2, 3.6)))
    out = np.zeros((h, w, 3), np.uint8)
    for r0 in range(0, h, block):
        r1 = min(h, r0 + block)
        uu, vv = grid_uv(w, h, r0, r1)
        x, y, z = sphere(uu, vv)
        lat = (.5 - vv) * 180
        al = np.abs(lat)
        # 气旋：绕各自中心按距离衰减旋转取样点 → 宽阔的旋臂
        for cu, cv, rad, spin in cyc:
            c = np.array(sphere(np.array(cu), np.array(cv)), np.float64).ravel()
            dot = np.clip(x * c[0] + y * c[1] + z * c[2], -1, 1)
            ang = np.arccos(dot)
            a = spin * np.exp(-(ang / rad) ** 1.6)
            ca_, sa_ = np.cos(a), np.sin(a)
            kx, ky, kz = c
            cx_, cy_, cz_ = ky * z - kz * y, kz * x - kx * z, kx * y - ky * x
            x, y, z = (x * ca_ + cx_ * sa_ + kx * dot * (1 - ca_), y * ca_ + cy_ * sa_ + ky * dot * (1 - ca_), z * ca_ + cz_ * sa_ + kz * dot * (1 - ca_))
        p = (x, y, z)
        # 两级域扭曲（锋面卷曲），纬向略拉长
        ps = (x, y * 1.6, z)
        w1 = tuple(fbm(ps, 2.2, 4, off=1 + i * 2.1) for i in range(3))
        ps2 = (x + w1[0] * .55, y * 1.6 + w1[1] * .55, z + w1[2] * .55)
        w2 = tuple(fbm(ps2, 4.5, 4, off=7 + i * 1.7) for i in range(3))
        ps3 = (ps2[0] + w2[0] * .3, ps2[1] + w2[1] * .3, ps2[2] + w2[2] * .3)
        n = fbm(ps3, 5.5, 8, gain=.5, off=5.5)
        cover = (.55 * np.exp(-((lat - 4) / 6.5) ** 2) + .5 * np.exp(-((al - 56) / 12) ** 2) + .3 * np.exp(-((al - 78) / 9) ** 2) + .06
                 - .12 * np.exp(-((al - 24) / 7) ** 2))
        base = np.maximum(n * 1.2 + cover * .75 - .24, 0)
        soft = 1 - np.exp(-base * 3.4)                 # 软肩：中心饱满、边缘渐薄
        det = fbm(ps3, 30, 5, gain=.55, off=12.5)        # 高频蚀刻 → 丝缕状云边
        dens = np.clip(soft * (1 + .75 * det) - (1 - soft) * .08, 0, 1)
        # 海洋上空的胞状积云
        bill = 1 - np.abs(fbm(p, 90, 3, off=-3))
        cells = np.clip((bill - .72) * 4, 0, 1) * np.clip(cover * 1.3 + fbm(p, 9, 3, off=2) * .6 - .25, 0, 1) * .5
        low = np.clip(np.maximum(dens * (.75 + .25 * bill), cells), 0, 1) ** 1.1
        # 卷云：沿急流弯曲的细丝
        jw = fbm(p, 3, 3, off=8)
        pc = (x * 4 + jw * 1.4, y * 13, z * 4 + jw * 1.4)
        cw = tuple(fbm(pc, 1.1, 3, off=9 + i) * .8 for i in range(3))
        fil = fbm((pc[0] + cw[0], pc[1] + cw[1], pc[2] + cw[2]), 1.6, 6, gain=.6, off=9.1)
        cir = np.clip(fil * 2.6 - .2, 0, 1) * np.clip((al - 20) / 20, 0, 1) * np.clip(cover * 1.6, 0, 1) * .75
        out[r0:r1, :, 0] = np.clip(low * 255, 0, 255).astype(np.uint8)
        out[r0:r1, :, 1] = np.clip(cir * 255, 0, 255).astype(np.uint8)
    # 柔化：真实云边是渐隐的，不是硬切的白片
    for ch in (0, 1):
        out[..., ch] = np.clip(gaussian_filter(out[..., ch].astype(np.float32), .8 * w / 4096, mode=('nearest', 'wrap')), 0, 255).astype(np.uint8)
    return out


# ---------------------------------------------------------------- 主流程
def main(mode):
    d, A = load()
    W, H = A['W'], A['H']
    pack = d['pack']
    if mode == 'clouds-final':
        Image.fromarray(clouds_tex()).save(OUT / 'clouds-4k.jpg', quality=90, subsampling=0, optimize=True)
        log('clouds written')
        return
    if mode == 'clouds':
        c = clouds_tex(1024, 512, 512)
        Image.fromarray(c).save(scratch() / 'clouds.png')
        log('preview', scratch() / 'clouds.png')
        return
    coast = [shape(r, True) for r in A['coast']] + [chaikin(unflat(r), True, 3) for r in A['islets']]
    lakes = [shape(r, True) for r in A['lakes']]
    land2 = raster_mask(A, coast, lakes, MW, MH, rivers=False) > .5
    h2, acc2, hm2, e2 = terrain_mid(d, A, land2)
    if mode == 'terrain':
        hs = hillshade(h2, 45)
        Image.fromarray((hs * 255).astype(np.uint8)).save(scratch() / 'terrain.png')
        Image.fromarray((np.clip(np.log1p(acc2) / 8, 0, 1) * 255).astype(np.uint8)).save(scratch() / 'acc.png')
        log('preview', scratch())
        return
    OUT.mkdir(parents=True, exist_ok=True)
    cells = pack['cells']
    pts = np.array([c['p'] for c in cells])

    # ---- 群系颜色（中分辨率，低频扭曲 + 较宽过渡）
    land_idx = np.array([i for i, c in enumerate(cells) if c['h'] >= LAND])
    bio_cells = np.array([cells[i]['biome'] for i in land_idx])
    ni = NearestNDInterpolator(pts[land_idx], np.arange(len(land_idx)))
    su, sv = grid_uv(MW, MH)
    P = sphere(su, sv)
    wx = fbm(P, 7, 4, off=3.1) * 16 + fbm(P, 26, 3, off=9.4) * 4
    wy = fbm(P, 7, 4, off=-5.7) * 14 + fbm(P, 26, 3, off=1.9) * 4
    biome = bio_cells[ni(np.clip(su * W + wx, 0, W), np.clip(map_y(sv, H) + wy, 0, H)).astype(int)]
    gpts = np.array(d['grid']['points'])
    gtemp = np.array([g.get('temp', 0) for g in d['grid']['cells']], float)
    tm = gaussian_filter(NearestNDInterpolator(gpts, gtemp)(su * W, np.clip(map_y(sv, H), 0, H)), (3, 5), mode=('nearest', 'wrap')).astype(np.float32)
    PAL = {
        1: ((204, 172, 122), (186, 140, 96)),    # 炎热荒漠
        2: ((166, 154, 128), (140, 130, 110)),   # 寒冷荒漠
        3: ((160, 148, 92), (138, 132, 78)),     # 稀树草原
        4: ((124, 138, 80), (146, 148, 92)),     # 草原
        5: ((76, 100, 50), (96, 112, 62)),       # 热带季雨林
        6: ((60, 84, 44), (84, 102, 58)),        # 温带落叶林
        7: ((34, 68, 36), (46, 80, 40)),         # 热带雨林
        8: ((42, 72, 48), (58, 84, 54)),         # 温带雨林
        9: ((46, 64, 50), (64, 76, 58)),         # 针叶林
        10: ((124, 120, 100), (144, 138, 116)),  # 苔原
        11: ((228, 234, 240), (208, 218, 228)),  # 冰川
        12: ((60, 80, 56), (80, 94, 64)),        # 湿地
        0: ((96, 106, 74), (96, 106, 74)),
    }
    ca = np.zeros((MH, MW, 3), np.float32); cb = np.zeros_like(ca)
    for k, (c1, c2) in PAL.items():
        m = biome == k
        ca[m] = c1; cb[m] = c2
    for arr in (ca, cb):
        for ch in range(3):
            arr[..., ch] = gaussian_filter(arr[..., ch], (4.2, 5.2), mode=('nearest', 'wrap'))
    # 沟谷更绿、更暗（水分沿汇流线），山脊偏干
    wet = np.clip(np.log1p(acc2) / 7 - .25, 0, 1)
    wet = gaussian_filter(wet, 1.0)
    log('biome colours')

    # ---- 8k 高程：中分辨率侵蚀结果 + 细节
    landsolid = raster_mask(A, coast, lakes, TW, TH, rivers=False)
    land8 = raster_mask(A, coast, lakes, TW, TH)
    log('masks', float(land8.mean()))
    dist_land = distance_transform_edt(landsolid > .5).astype(np.float32)
    dist_sea = distance_transform_edt(landsolid <= .5).astype(np.float32)
    log('distance fields')
    h8 = up(np.where(land2, h2, 0).astype(np.float32), (TH, TW), order=3)
    e8 = up(e2, (TH, TW))
    BLOCK = 256
    height = np.zeros((TH, TW), np.float32)
    for r0 in range(0, TH, BLOCK):
        r1 = min(TH, r0 + BLOCK)
        uu, vv = grid_uv(TW, TH, r0, r1)
        L = landsolid[r0:r1] > .01
        if not L.any():
            continue
        p = sphere(uu[L], vv[L])
        ee = e8[r0:r1][L]
        mount = np.clip((ee - .12) / .45, 0, 1)
        det = ridged(p, 260, 4, off=6.1) - .3
        cd = np.clip(dist_land[r0:r1][L] / 8, 0, 1)
        hh = np.maximum(h8[r0:r1][L], .003) + det * (.006 + .05 * mount) * cd
        row = np.zeros(L.shape, np.float32)
        row[L] = np.maximum(hh * (.4 + .6 * cd), .002)
        height[r0:r1] = row
    log('height 8k', float(height.max()))

    lat_all = (.5 - (np.arange(TH) + .5) / TH) * np.pi
    RELIEF = .045
    dxm = (2 * np.pi * np.maximum(np.cos(lat_all), .02) / TW)[:, None]
    dym = np.pi / TH
    hx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / 2
    hy = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) / 2
    hy[0] = hy[-1] = 0
    nx = -hx * RELIEF / dxm
    ny = -hy * RELIEF / dym
    inv = 1 / np.sqrt(nx * nx + ny * ny + 1)
    nx *= inv; ny *= inv
    nz = inv
    slope = np.sqrt(1 - nz * nz)  # sin(坡角)
    blur = gaussian_filter(height, 5, mode=('nearest', 'wrap'))
    cav = gaussian_filter(np.clip(1 - (blur - height) * 7, .45, 1.15), .7)
    log('normals / cavity')

    # ---- 反照率
    ca8 = up(ca, (TH, TW)); cb8 = up(cb, (TH, TW))
    tm8 = up(tm, (TH, TW)); wet8 = up(wet.astype(np.float32), (TH, TW))
    alb = np.zeros((TH, TW, 3), np.uint8)
    for r0 in range(0, TH, BLOCK):
        r1 = min(TH, r0 + BLOCK)
        uu, vv = grid_uv(TW, TH, r0, r1)
        p = sphere(uu, vv)
        n1 = fbm(p, 11, 5, off=2.5)
        n2 = fbm(p, 95, 4, off=-6.1)
        n3 = perlin(p[0] * 800, p[1] * 800, p[2] * 800)
        t = np.clip(.5 + n1 * 1.3, 0, 1)[..., None]
        col = ca8[r0:r1] * (1 - t) + cb8[r0:r1] * t
        col *= (1 + n2 * .14 + n3 * .045)[..., None]
        wv = wet8[r0:r1][..., None]
        col = col * (1 - wv * .35) + np.array([52, 74, 42], np.float32) * wv * .35
        h = height[r0:r1]
        s = slope[r0:r1]
        temp = tm8[r0:r1]
        lat = np.degrees(lat_all[r0:r1])[:, None]
        # 裸岩只出现在陡坡与林线以上
        rock_alt = np.clip((h - .52) * 3.2, 0, 1)
        rockmix = np.clip(np.clip((s - .30) * 2.8, 0, 1) * .85 + rock_alt * .6 + n2 * .15, 0, 1)
        rock = np.array([118, 108, 98], np.float32) * (1 + n2[..., None] * .22 + fbm(p, 330, 2, off=4)[..., None] * .14)
        col = col * (1 - rockmix[..., None]) + rock * rockmix[..., None]
        # 雪线：随纬度降低，气温很低处（极地）整片覆雪；边缘用噪声柔化
        snowline = .80 - .55 * np.clip(np.abs(lat) / 80, 0, 1) ** 1.6
        snow = np.clip((h - snowline) / .10 + n2 * .5 + n1 * .3, 0, 1)
        snow = np.maximum(snow, np.clip((-temp - 4) / 8, 0, 1))
        snow *= np.clip(1.25 - s * 1.1, .35, 1)
        col = col * (1 - snow[..., None]) + np.array([236, 240, 246], np.float32) * snow[..., None]
        dl = dist_land[r0:r1]
        beach = np.clip(1 - dl / 2.2, 0, 1) * np.clip((temp - 8) / 10, 0, 1) * (n2 > -.1)
        col = col * (1 - beach[..., None] * .5) + np.array([196, 182, 144], np.float32) * beach[..., None] * .5
        ds = dist_sea[r0:r1]
        bed = np.array([142, 150, 120], np.float32) * np.clip(1 - ds / 50, .3, 1)[..., None]
        Lm = landsolid[r0:r1][..., None]
        col = col * Lm + bed * (1 - Lm)
        alb[r0:r1] = np.clip(col, 0, 255).astype(np.uint8)
    log('albedo')

    # ---- 极地冰盖（地图范围以外的高纬海面）：边缘破碎成浮冰
    ice = np.zeros((TH, TW), np.float32)
    rows = np.flatnonzero(np.abs(np.degrees(lat_all)) > 60)
    for r0 in range(0, len(rows), BLOCK):
        rr = rows[r0:r0 + BLOCK]
        uu, vv = np.meshgrid((np.arange(TW) + .5) / TW, (rr + .5) / TH)
        p = sphere(uu, vv)
        la = np.abs(np.degrees(lat_all[rr]))[:, None]
        edge = fbm(p, 9, 5, off=12.1) * 7 + fbm(p, 60, 3, off=3.7) * 2.5
        floe = np.clip((1 - np.abs(fbm(p, 140, 3, off=7.7))) * 3 - 1.9, 0, 1)
        base = np.clip((la - 70 + edge) / 1.2, 0, 1)
        fringe = np.clip((la - 66 + edge) / 3, 0, 1) * floe
        ice[rr] = np.maximum(base, fringe) * (1 - landsolid[rr])
        n2 = fbm(p, 95, 4, off=-6.1)
        crack = np.clip(1 - np.abs(fbm(p, 70, 3, off=1.1)) * 9, 0, 1)
        icecol = np.array([226, 233, 240], np.float32) * (1 + n2[..., None] * .06) - crack[..., None] * np.array([40, 30, 18], np.float32)
        k = ice[rr][..., None]
        alb[rr] = np.clip(alb[rr] * (1 - k) + icecol * k, 0, 255).astype(np.uint8)
    land8 = np.maximum(land8, ice)
    height = np.maximum(height, ice * .012)
    log('sea ice', float(ice.mean()))

    # ---- 数据贴图（4k）
    DW, DH = 4096, 2048
    ds4 = zoom(dist_sea, .5, order=1)
    sea_h = up(hm2, (DH, DW))
    shelf = 1 - np.exp(-ds4 / 20)
    deep = np.clip((LAND - sea_h) / 14, 0, 1)
    depth = gaussian_filter(np.clip(np.maximum(shelf * .6, deep * .9 + shelf * .25), 0, 1), 1.2, mode=('nearest', 'wrap'))
    lights = np.zeros((DH, DW), np.float32)
    for b in pack['burgs'][1:]:
        if not b or b.get('removed'):
            continue
        ix, iy = int(b['x'] / W * DW), int(tex_y(b['y'], H) * DH)
        if 0 <= ix < DW and 0 <= iy < DH:
            lights[iy, ix] += min(6, .4 + b.get('population', 1) ** .55 * .5)
    lights = np.clip(gaussian_filter(lights, 1.1) * 2.2 + gaussian_filter(lights, 4) * 3, 0, 1)
    land4 = zoom(landsolid, .5, order=1)
    ice4 = zoom(ice, .5, order=1)
    g = np.where(ice4 > .5, 0, np.where(land4 > .5, lights, depth))
    data = np.stack([np.clip(zoom(height, .5, order=1) * 255, 0, 255), np.clip(g * 255, 0, 255),
                     np.clip((zoom(cav, .5, order=1) - .45) / .7 * 255, 0, 255)], -1).astype(np.uint8)
    Image.fromarray(data).save(OUT / 'data-4k.jpg', quality=93, subsampling=0)
    log('data')

    norm = np.stack([nx * .5 + .5, ny * .5 + .5, nz * .5 + .5], -1)
    norm8 = Image.fromarray(np.clip(norm * 255 + .5, 0, 255).astype(np.uint8))
    norm8.resize((TW // 2, TH // 2), Image.LANCZOS).save(OUT / 'normal-4k.jpg', quality=90, subsampling=0, optimize=True)
    water = Image.fromarray(np.clip((1 - land8) * 255 + .5, 0, 255).astype(np.uint8))
    water.save(OUT / 'water-8k.png', optimize=True)
    water.resize((TW // 2, TH // 2), Image.BOX).save(OUT / 'water-4k.png', optimize=True)
    a = Image.fromarray(alb)
    a.save(OUT / 'albedo-8k.jpg', quality=90, optimize=True)
    a.resize((TW // 2, TH // 2), Image.LANCZOS).save(OUT / 'albedo-4k.jpg', quality=90, subsampling=0, optimize=True)
    log('surface textures')

    Image.fromarray(clouds_tex()).save(OUT / 'clouds-4k.jpg', quality=90, subsampling=0, optimize=True)
    log('clouds')
    prov = {
        'source': SRC.name, 'outline': 'js/atlas-data.js（与平面地图同一套 roughen(.2,2)+chaikin(2)）',
        'size': {'albedo': [TW, TH], 'normal': [TW // 2, TH // 2], 'data': [DW, DH], 'clouds': [4096, 2048]},
        'data': 'R=land height, G=ocean depth (sea) / night lights (land), B=cavity',
        'terrain': 'Azgaar heights + ridged noise + D8 stream-power erosion with uplift (artistic, not measured)',
        'clouds': 'procedural: zonal bands, 14 cyclone swirls, ocean cells, jet-stream cirrus; not a weather record',
    }
    (OUT / 'provenance.json').write_text(json.dumps(prov, ensure_ascii=False, indent=1) + '\n')
    log('done')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'all')
