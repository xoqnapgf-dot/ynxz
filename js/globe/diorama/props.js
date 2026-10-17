/* 沙盘道具与建筑组合：每个函数接收引擎上下文 c（含 B 合并构建器、I 实例、fx、h、r 等）。 */
import { P, lin, house, tower, wall, boat } from './kit.js';
import { lerp, clamp, spline } from './noise.js';

export const pick = (c, v) => Array.isArray(v) ? c.r.pick(v) : v;
const rand = (c, a, b) => a + (b - a) * c.r();
const faceTo = (fx, fz) => Math.atan2(fx, fz); // 让局部 +z（门所在面）朝向 (fx,fz)

/* ---------------- 房屋风格 ---------------- */
export const STYLES = {
  harbour: { w: [5, 8], d: [4.5, 6.5], fl: [1, 3], wall: [0xf2ece0, 0xeadcc2, 0xe1d6c4, 0xf0dcb0, 0xd9e2e4], wpat: P.plaster, roof: ['gable', 'gable', 'hip'], rcol: [0xb4583e, 0xa24d35, 0xc26b49], rpat: P.tile, pitch: .5, win: 2.1, door: [0x3f5f7a, 0x5a3f2c, 0x2f4d3d, 0x7a3a2c], chim: .3 },
  workers: { w: [16, 26], d: [9, 11], fl: [3, 5], fh: 3, wall: [0xa98c72, 0xb79e82, 0x9e8f80, 0xc2b49c], wpat: P.brick, roof: ['flat'], rcol: [0x6d675f], rpat: P.concrete, win: 2.6, door: [0x4a4038], trim: [0x8f8478] },
  cottage: { w: [5, 7], d: [4, 5.5], fl: [1, 2], wall: [0xe6dccb, 0xd8c8ad, 0xcfc1a5], wpat: P.plaster, roof: ['gable'], rcol: [0x7b5236, 0x8a6a4a, 0x6a4e3a], rpat: P.wood, pitch: .7, win: 2.2, door: [0x4a3527], chim: .6 },
  ranch: { w: [6, 9], d: [5, 7], fl: [1, 1], wall: [0xf0e6d2, 0xe9d3b5, 0xd9b99a, 0xf3d9c4], wpat: P.plaster, roof: ['hip', 'gable'], rcol: [0xa9553a, 0xb46a46, 0x9a4a32], rpat: P.tile, pitch: .42, win: 2.4, door: [0x5a3f2c, 0x2e5a4a], over: .6 },
  frost: { w: [6, 10], d: [5, 7], fl: [1, 2], wall: [0x6b5a4a, 0x5e4f43, 0x7a6754], wpat: P.wood, roof: ['gable'], rcol: [0x3b3f45, 0x4a4540], rpat: P.metal, pitch: .8, win: 2.4, door: [0x3a2a22], chim: .9, chimCol: 0x6a5a50 },
  vine: { w: [5, 8], d: [5, 7], fl: [2, 3], wall: [0xe2c99a, 0xd9bc88, 0xe8d4ad, 0xcfae7c], wpat: P.stone, roof: ['gable', 'hip'], rcol: [0xc0683e, 0xb35b36, 0xcf7a48], rpat: P.tile, pitch: .45, win: 2, door: [0x5a3f2c, 0x40502e], chim: .3 },
  civic: { w: [10, 16], d: [9, 13], fl: [3, 4], fh: 3.3, wall: [0xf3efe6, 0xe9e3d6, 0xdcd6c8], wpat: P.stone, roof: ['hip', 'flat'], rcol: [0x5b6670, 0x6f6a62], rpat: P.slate, pitch: .35, win: 2.6, door: [0x3a3530], trim: [0xcfc8b8] },
  shrine: { w: [5, 7], d: [4.5, 6], fl: [1, 2], wall: [0x5a4232, 0x4d382a, 0x6a4e38, 0xd9cfbf], wpat: P.wood, roof: ['curve'], rcol: [0x4d555c, 0x3f474e, 0x585f63], rpat: P.tile, pitch: .55, win: 0, door: [0x2c221b], over: .7 },
  cloister: { w: [7, 11], d: [6, 9], fl: [2, 3], fh: 3.4, wall: [0xe4ded0, 0xd8d0be, 0xcfc7b4], wpat: P.stone, roof: ['gable'], rcol: [0x4f5964, 0x5b6470, 0x434c55], rpat: P.slate, pitch: .85, win: 2.6, door: [0x3c2e24] },
  highland: { w: [5, 8], d: [5, 7], fl: [1, 3], wall: [0xd8a774, 0xc98d5e, 0xe2c08c, 0xb9765a, 0xe9d6b0, 0x8fa3a1], wpat: P.paint, roof: ['flat', 'flat', 'shed'], rcol: [0x9c6a48, 0x7c6a58], rpat: P.wood, pitch: .3, win: 2.2, door: [0x2f4f6a, 0x7a2e2a, 0x3c5a34], trim: [0xf0e4cc, 0xcfbfa2] },
  future: { w: [9, 16], d: [9, 14], fl: [3, 7], fh: 3.4, wall: [0xf2f2ef, 0xe6ebec, 0xdde4e4], wpat: P.concrete, roof: ['flat'], rcol: [0x7c9a6a], rpat: P.plain, win: 1.8, door: [0x2c3a40], trim: [0xbfc8ca] },
  paddy: { w: [5, 7], d: [4, 5.5], fl: [1, 2], wall: [0xc8b08c, 0xb89c78, 0xd6c3a0, 0x8a6a4c], wpat: P.timber, roof: ['curve', 'hip'], rcol: [0x5a5f63, 0x6b6e6a, 0x8a7a58], rpat: P.tile, pitch: .5, win: 2.4, door: [0x3c2c22], over: .55 },
  colonial: { w: [8, 12], d: [7, 9], fl: [1, 2], wall: [0xf2ead8, 0xe8d8bd, 0xd6e0d4, 0xf0d6c0], wpat: P.plaster, roof: ['hip'], rcol: [0x9a4a32, 0x7a6252, 0x8a3a2a], rpat: P.metal, pitch: .38, win: 2.6, door: [0x2e4a3a, 0x4a3527], over: .9 },
  stilt: { w: [4, 6], d: [4, 5], fl: [1, 1], wall: [0x8a6a48, 0x7a5c3e, 0x9c7c58], wpat: P.wood, roof: ['gable'], rcol: [0xa08a5a, 0x8f7a4e, 0xb0985e], rpat: P.thatch, pitch: .9, win: 0, door: [0x3c2c22], over: .7, lift: 1.6 },
  feudal: { w: [5, 7], d: [4.5, 6], fl: [1, 2], wall: [0xece4d2, 0xe2d8c0, 0xd8cdb4], wpat: P.timber, roof: ['gable'], rcol: [0x7a4a34, 0x5d4d45, 0x8a5a3c], rpat: P.tile, pitch: 1.0, win: 2.4, door: [0x4a3527], chim: .5 },
  imperial: { w: [22, 34], d: [14, 18], fl: [4, 5], fh: 3.6, wall: [0xbdb7ad, 0xb2aca2, 0xc7c0b2], wpat: P.stone, roof: ['flat'], rcol: [0x7a756e], rpat: P.stone, win: 2.4, door: [0x3a3632], trim: [0xa39d92] },
  lantern: { w: [4, 6], d: [4, 5], fl: [2, 3], wall: [0x6a5a4c, 0x8a6a52, 0x5c6a6e, 0x9a7a5a, 0x7a4a3a], wpat: P.wood, roof: ['shed', 'gable'], rcol: [0x4a4440, 0x5a4a3c, 0x6a5040], rpat: P.metal, pitch: .45, win: 1.9, door: [0x2c221b], over: .4 },
  tide: { w: [4.5, 6], d: [4, 5.5], fl: [2, 2], wall: [0x6a5444, 0x5c483a, 0x7a604a], wpat: P.wood, roof: ['gable', 'curve'], rcol: [0x4a5258, 0x3e454a, 0x575c5e], rpat: P.tile, pitch: .5, win: 1.9, door: [0x2c221b], over: .45, awnK: .6, awn: [0x2f4f6a, 0x7a3a2a, 0x3a4a3a, 0xd9cfbf] },
  festival: { w: [5, 7], d: [4.5, 6], fl: [1, 2], wall: [0xf6efe0, 0xf2e2c4, 0xe8eef0, 0xf4d8c8], wpat: P.plaster, roof: ['gable'], rcol: [0x5a7a8a, 0xb4583e, 0x4a6a5a], rpat: P.tile, pitch: .55, win: 2.2, door: [0x3f6f8a, 0xb0503a, 0x4a7a4a], chim: .3 },
  coal: { w: [12, 18], d: [5, 6], fl: [1, 2], wall: [0x7a5a48, 0x6a4c3c, 0x86685a], wpat: P.brick, roof: ['gable'], rcol: [0x3a3634, 0x45403c], rpat: P.slate, pitch: .55, win: 2, door: [0x2c2420], chim: .9, chimCol: 0x5a4034 },
  barrack: { w: [14, 20], d: [6, 7], fl: [1, 1], wall: [0x5e5246, 0x6a5c4e, 0x4f463e], wpat: P.wood, roof: ['gable'], rcol: [0x3a3d42, 0x45484c], rpat: P.metal, pitch: .55, win: 2.4, door: [0x2a2420], chim: 1, chimCol: 0x5a5048 },
  scholar: { w: [8, 13], d: [7, 11], fl: [2, 4], fh: 3.3, wall: [0xe8d6b2, 0xdcc49a, 0xefe2c8, 0xd2b88e], wpat: P.stone, roof: ['flat', 'hip', 'dome'], rcol: [0x5a7f86, 0xb58a4a, 0x4f6f72], rpat: P.tile, pitch: .4, win: 2.2, door: [0x4a3527], trim: [0xf2e8d2] },
  academy: { w: [6, 10], d: [5, 8], fl: [1, 2], wall: [0xd9cbb0, 0xb9c2b0, 0xe6d9c0, 0xa86a50, 0xc4b49a], wpat: P.plaster, roof: ['gable', 'shed', 'flat'], rcol: [0x5d6b72, 0x7a5a44, 0x8a8a7a, 0x9a5038], rpat: P.metal, pitch: .45, win: 2.3, door: [0x2e4f6a, 0x7a3a2c, 0x4a6a3a], chim: .3 },
  fisher: { w: [4, 6], d: [3.5, 5], fl: [1, 1], wall: [0x8a7a68, 0x6e6458, 0x9c8a72], wpat: P.wood, roof: ['gable'], rcol: [0x4a5a4a, 0x5a6a5a, 0x6a5a48], rpat: P.thatch, pitch: .85, win: 0, door: [0x2c221b], over: .5 }
};

export function bld(c, st, x, z, o = {}) {
  const S = STYLES[st], r = c.r;
  const w = o.w ?? rand(c, S.w[0], S.w[1]), d = o.d ?? rand(c, S.d[0], S.d[1]);
  return c.house(x, z, {
    w, d, fl: o.fl ?? r.int(S.fl[0], S.fl[1]), fh: S.fh ?? 2.9, ry: o.ry ?? 0,
    wall: o.wall ?? pick(c, S.wall), wpat: S.wpat, roof: o.roof ?? pick(c, S.roof), rcol: o.rcol ?? pick(c, S.rcol), rpat: o.rpat ?? S.rpat,
    pitch: S.pitch, over: S.over, win: S.win, base: S.base, trim: S.trim ? pick(c, S.trim) : null, door: pick(c, S.door),
    chim: S.chim ? r() < S.chim : false, chimCol: S.chimCol, awn: S.awn && r() < (S.awnK ?? .3) ? pick(c, S.awn) : null,
    lift: o.lift ?? S.lift ?? 0, plinth: S.lift ? S.lift + .3 : undefined, ...(o.extra || {})
  });
}

/* 沿道路两侧排房，门朝路 */
export function street(c, pts0, st, o = {}) {
  const pts = spline(pts0, 4), roadW = o.roadW ?? 4, gap = o.gap ?? 1, sides = o.sides ?? [1, -1];
  let placed = 0;
  for (const side of sides) {
    let acc = o.start ?? 2;
    let i = 0, segAcc = 0;
    const segLen = [];
    for (let k = 0; k < pts.length - 1; k++) segLen.push(Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]));
    const total = segLen.reduce((a, b) => a + b, 0);
    while (acc < total - (o.end ?? 2)) {
      while (i < segLen.length - 1 && segAcc + segLen[i] < acc) { segAcc += segLen[i]; i++; }
      const t = (acc - segAcc) / segLen[i], [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const tx = (bx - ax) / segLen[i], tz = (bz - az) / segLen[i], nx = -tz * side, nz = tx * side;
      const S = STYLES[st], w = rand(c, S.w[0], S.w[1]), d = rand(c, S.d[0], S.d[1]);
      const off = roadW / 2 + (o.setback ?? .8) + d / 2;
      const x = ax + (bx - ax) * t + nx * off, z = az + (bz - az) * t + nz * off;
      if (!(o.skip && o.skip(x, z)) && c.usable(x, z, { r: Math.min(w, d) * .5, road: false, maxSlope: o.maxSlope ?? .6, margin: 2, river: true, riverPad: 1 }) && c.r() < (o.fill ?? .92)) {
        bld(c, st, x, z, { w, d, ry: faceTo(-nx, -nz), ...(o.house || {}) }); placed++;
      }
      acc += w + gap + c.r() * (o.jitter ?? 1.5);
    }
  }
  return placed;
}

/* 随机成片的房屋（按主方向排列，带少量偏转） */
export function cluster(c, st, cx, cz, rad, n, o = {}) {
  const base = o.angle ?? c.r() * Math.PI;
  return c.scatter(n, { at: [cx, cz, rad], r: o.r ?? 3.6, maxSlope: o.maxSlope ?? .5, tries: 30, ...o.where }, (x, z) => {
    const ry = base + (c.r() < .5 ? 0 : Math.PI / 2) + (c.r() - .5) * (o.jit ?? .25);
    bld(c, st, x, z, { ry, ...(o.house || {}) });
  });
}

/* ---------------- 水边 ---------------- */
export function pier(c, x, z, len, ry, o = {}) {
  const w = o.w ?? 2.6, y = c.wl + (o.up ?? .9), B = c.B, col = o.col ?? 0x7a6450;
  B.frame(x, y, z, ry);
  B.box(0, 0, len / 2, w, .3, len, col, P.wood);
  for (let k = 0; k <= len; k += 3) for (const s of [-1, 1]) B.put('cyl8', s * (w / 2 - .15), -6, k, .3, 6.2, .3, 0x4a3a2c, P.wood);
  if (o.stone) B.box(0, -6, len / 2, w + .4, 6, len, o.stone, P.stone);
  B.frame();
  c.occupyLine([[x, z], [x + Math.sin(ry) * len, z + Math.cos(ry) * len]], w);
}
export function breakwater(c, pts, o = {}) {
  const sp = spline(pts, 5);
  for (let i = 0; i < sp.length - 1; i++) {
    const [ax, az] = sp[i], [bx, bz] = sp[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
    c.B.frame((ax + bx) / 2, c.wl + (o.up ?? 1.1), (az + bz) / 2, ry);
    c.B.box(0, -7, 0, L + .4, 7, o.w ?? 3.4, o.col ?? 0x9a958a, P.stone);
    for (let k = 0; k < 3; k++) c.I.small('boulder', (ax + bx) / 2 + (c.r() - .5) * 2, c.wl - .4, (az + bz) / 2 + (c.r() - .5) * 4, rand(c, .9, 1.8), 0x8a857a, c.r() * 6);
  }
  c.B.frame();
  c.occupyLine(pts, o.w ?? 3.4);
}
export function boatAt(c, x, z, ry, o = {}) { boat(c.B, x, c.wl, z, ry, o); }
export function crane(c, x, z, ry, o = {}) {
  const y = c.ground(x, z, 4, 4), B = c.B, h = o.h ?? 16, col = o.col ?? 0xb6532e;
  B.frame(x, y, z, ry);
  for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) B.box(a, 0, b, .35, h, .35, col, P.metal);
  for (let k = 2; k < h; k += 3) { B.box(0, k, -1.6, 3.4, .2, .2, col, P.metal); B.box(0, k, 1.6, 3.4, .2, .2, col, P.metal); B.box(-1.6, k, 0, .2, .2, 3.4, col, P.metal); B.box(1.6, k, 0, .2, .2, 3.4, col, P.metal); }
  B.box(0, h, 0, 4, 2.4, 4, o.cab ?? 0xd9d2c4, P.metal);
  B.box(0, h + 1.6, (o.reach ?? 14) / 2 - 3, 1, 1, o.reach ?? 14, col, P.metal);
  B.box(0, h + 1.2, (o.reach ?? 14) - 3, .08, -(h - 2), .08, 0x2a2a2a, P.iron);
  B.frame();
  c.occupy(x, z, 4, 4, ry);
}
export function lighthouse(c, x, z, o = {}) {
  const y = c.ground(x, z, 4, 4), B = c.B, h = o.h ?? 14;
  B.frame(x, y, z, 0);
  B.put('frus16', 0, -1, 0, 4.2, h + 1, 4.2, o.col ?? 0xf2efe8, P.plaster);
  if (o.stripe) for (let k = 0; k < h; k += 4) B.put('frus16', 0, k, 0, 4.2 - k / h * 1.4 + .05, 1.5, 4.2 - k / h * 1.4 + .05, o.stripe, P.plain, null);
  B.put('cyl12', 0, h, 0, 3.2, .4, 3.2, 0x2f3438, P.iron);
  B.put('cyl12', 0, h + .4, 0, 2, 1.6, 2, 0xfff0c0, P.light);
  B.put('cone12', 0, h + 2, 0, 2.6, 1.4, 2.6, 0x2f3438, P.iron);
  B.frame();
  c.occupy(x, z, 5, 5);
  c.light(x, y + h + 1.2, z, 0xffe2a8, 3, 30);
}

/* ---------------- 宗教与公共建筑 ---------------- */
export function church(c, x, z, ry, o = {}) {
  const L = o.len ?? 18, W = o.w ?? 8, H = o.h ?? 9, B = c.B, y = c.ground(x, z, W, L, ry);
  const wallC = o.wall ?? 0xe0d6c2, roofC = o.roof ?? 0x55606b, rp = o.rpat ?? P.slate;
  B.frame(x, y, z, ry, [3.2, H, W / 2, L / 2]);
  B.box(0, -2, 0, W + .4, 2.4, L + .4, 0x8f887c, P.stone);
  B.box(0, 0, 0, W, H, L, wallC, o.wpat ?? P.stone, 0, true);
  B.put('gable', 0, H, 0, W, W * .75, L, wallC, o.wpat ?? P.stone);
  B.put('gable', 0, H - .1, 0, W + .8, W * .82, L + .6, roofC, rp);
  if (o.transept) { B.box(0, 0, L * .12, W * 2.2, H * .9, W * .9, wallC, o.wpat ?? P.stone, 0, true); B.put('gable', 0, H * .9 - .1, L * .12, W * .9 + .6, W * .7, W * 2.2 + .6, roofC, rp, [0, Math.PI / 2, 0]); }
  if (o.apse) { B.put('cyl16', 0, 0, -L / 2, W * .9, H * .85, W * .9, wallC, o.wpat ?? P.stone); B.put('hemi', 0, H * .85, -L / 2, W * .95, W * .5, W * .95, roofC, rp); }
  const tw = o.tower ?? W * .55, th = o.th ?? H * 2.2;
  const towers = o.twin ? [-W / 2 + tw / 2, W / 2 - tw / 2] : [0];
  for (const tx of towers) {
    B.box(tx, 0, L / 2 + tw / 2 - .4, tw, th, tw, wallC, o.wpat ?? P.stone);
    B.box(tx, th, L / 2 + tw / 2 - .4, tw + .3, .5, tw + .3, wallC, P.stone);
    if (o.dome) B.put('hemi', tx, th + .4, L / 2 + tw / 2 - .4, tw * 1.05, tw * .8, tw * 1.05, roofC, o.domePat ?? rp);
    else B.put('pyr', tx, th + .4, L / 2 + tw / 2 - .4, tw * .95, o.spire ?? tw * 2.6, tw * .95, roofC, rp);
  }
  // 玫瑰窗与门
  B.put('cyl16', 0, H * .62, L / 2 + (o.twin ? .02 : tw - .38), W * .32, .2, W * .32, o.glass ?? 0x3a4a6a, P.glass, [Math.PI / 2, 0, 0]);
  B.box(0, 0, L / 2 + (o.twin ? .05 : tw - .35), 2.2, 3.6, .3, 0x3c2e24, P.wood);
  B.frame();
  c.occupy(x, z, W * (o.transept ? 2.3 : 1.1), L + tw * 1.2, ry, 1.2);
}
export function temple(c, x, z, ry, o = {}) { // 柱廊 + 山花，台基三级
  const W = o.w ?? 14, L = o.len ?? 22, H = o.h ?? 7, B = c.B, y = c.ground(x, z, W + 4, L + 4, ry), col = o.col ?? 0xe9e1cf;
  B.frame(x, y, z, ry);
  for (let s = 0; s < 3; s++) B.box(0, -2 + s * .45, 0, W + 4 - s * 1.2, 2.45, L + 4 - s * 1.2, col, P.stone);
  const nx = o.cols ?? 6, nz = Math.round(nx * L / W);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
    B.put('cyl12', -W / 2 + .8 + i * (W - 1.6) / (nx - 1), 1.35, -L / 2 + .8 + j * (L - 1.6) / (nz - 1), .9, H, .9, col, P.stone);
  }
  B.box(0, 1.35, 0, W - 4, H, L - 4, o.cella ?? 0xd8cdb6, P.stone);
  B.box(0, H + 1.35, 0, W + .4, 1.1, L + .4, col, P.stone);
  B.put('gable', 0, H + 2.45, 0, W + .6, W * .22, L + .6, o.roof ?? 0xb0603e, P.tile);
  if (o.paint) B.box(0, H + 1.45, L / 2 + .22, W, .7, .05, o.paint, P.paint);
  B.frame();
  c.occupy(x, z, W + 4, L + 4, ry);
}
export function shrineGate(c, x, z, ry, o = {}) {
  const y = c.ground(x, z), B = c.B, w = o.w ?? 4.4, h = o.h ?? 4.2, col = o.col ?? 0xb3452e;
  B.frame(x, y, z, ry);
  for (const s of [-1, 1]) B.put('cyl12', s * w / 2, -.4, 0, .42, h + .4, .42, col, P.paint);
  B.box(0, h * .78, 0, w + .6, .3, .32, col, P.paint);
  B.put('shed', 0, h, 0, .5, .35, w + 1.6, o.top ?? 0x2b2522, P.wood, [0, Math.PI / 2, 0]);
  B.box(0, h - .05, 0, w + 1.5, .35, .5, o.top ?? 0x2b2522, P.wood);
  B.frame();
}
export function stoneLantern(c, x, z, lit = true) {
  const y = c.ground(x, z), B = c.B;
  B.frame(x, y, z, c.r() * 6);
  B.box(0, 0, 0, .7, .3, .7, 0x8a857c, P.stone); B.put('cyl8', 0, .3, 0, .3, .9, .3, 0x8a857c, P.stone);
  B.box(0, 1.2, 0, .6, .5, .6, lit ? 0xffd08a : 0x6a665e, lit ? P.light : P.stone); B.put('pyr', 0, 1.7, 0, 1, .45, 1, 0x7a756c, P.stone);
  B.frame();
}
export function pagoda(c, x, z, o = {}) {
  const y = c.ground(x, z, 7, 7), B = c.B, n = o.tiers ?? 3, col = o.wall ?? 0x5a4232, roof = o.roof ?? 0x4a5258;
  B.frame(x, y, z, o.ry ?? 0);
  B.box(0, -1.5, 0, 7.5, 2, 7.5, 0x8f887c, P.stone);
  let yy = .5, s = 5.4;
  for (let k = 0; k < n; k++) { B.box(0, yy, 0, s, 2.6, s, col, P.wood); B.put('curve', 0, yy + 2.4, 0, s + 2.6, 1.3, s + 2.6, roof, P.tile); yy += 3.4; s *= .8; }
  B.put('cyl8', 0, yy, 0, .2, 2.4, .2, 0xb58a4a, P.gold);
  B.frame();
  c.occupy(x, z, 7.5, 7.5);
}

/* ---------------- 防御 ---------------- */
export function castle(c, x, z, o = {}) {
  const rr = o.r ?? 14, y = c.ground(x, z, rr, rr), B = c.B, col = o.col ?? 0xb3aa98, n = o.sides ?? 6;
  const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2 + (o.rot ?? 0); pts.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]); }
  wall(B, pts, o.wh ?? 6, 1.6, col, P.stone, true, (px, pz) => Math.max(c.h(px, pz), y - 3));
  for (let i = 0; i < n; i++) tower(B, pts[i][0], c.h(pts[i][0], pts[i][1]) - .5, pts[i][1], { r: 2, h: (o.wh ?? 6) + 3, wall: col, rcol: o.roof ?? 0x4b5560, roof: o.flat ? 'flat' : 'cone' });
  // 主楼
  B.frame(x + (o.kx ?? 0), y, z + (o.kz ?? 0), o.ry ?? 0, [3, 4, 4.5, 4.5]);
  B.box(0, -2, 0, 9, (o.kh ?? 16) + 2, 9, col, P.stone, 0, true);
  B.box(0, o.kh ?? 16, 0, 9.6, .6, 9.6, col, P.stone);
  for (let i = 0; i < 12; i++) { const s = i % 3; const side = Math.floor(i / 3); const t = -3.6 + s * 3.6; const [bx, bz] = side === 0 ? [t, 4.6] : side === 1 ? [t, -4.6] : side === 2 ? [4.6, t] : [-4.6, t]; B.box(bx, (o.kh ?? 16) + .6, bz, 1, .8, 1, col, P.stone); }
  if (o.keepRoof) B.put('pyr', 0, (o.kh ?? 16) + .6, 0, 8, 5, 8, o.roof ?? 0x4b5560, P.slate);
  B.frame();
  tower(B, x + (o.kx ?? 0) + 4.5, y, z + (o.kz ?? 0) - 4.5, { r: 1.7, h: (o.kh ?? 16) + 5, wall: col, rcol: o.roof ?? 0x4b5560 });
  c.occupy(x, z, rr * 2.2, rr * 2.2, 0, 0);
  if (o.flag) flag(c, x + (o.kx ?? 0), y + (o.kh ?? 16) + .6, z + (o.kz ?? 0), 5, o.flag);
}
export function watchtower(c, x, z, o = {}) {
  const y = c.ground(x, z), B = c.B, h = o.h ?? 8, col = o.col ?? 0x5a4a3c;
  B.frame(x, y, z, o.ry ?? 0);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(a, 0, b, .3, h, .3, col, P.wood, 0);
  B.box(0, h, 0, 3, .3, 3, col, P.wood); B.box(0, h + .3, 0, 3, 1, .1, col, P.wood);
  B.put('pyr', 0, h + 2.2, 0, 3.4, 1.4, 3.4, o.roof ?? 0x3a3d42, P.metal);
  for (const s of [-1, 1]) B.box(s * 1.45, h + .3, 0, .1, 1, 3, col, P.wood);
  for (let k = 0; k < 4; k++) B.box(0, k * h / 4 + 1, 1, 2.2, .14, .14, col, P.wood, k % 2 ? .6 : -.6);
  B.frame();
  c.occupy(x, z, 3, 3);
  return y + h + 1;
}

/* ---------------- 工业 ---------------- */
export function chimney(c, x, z, h, o = {}) {
  const y = c.ground(x, z), B = c.B, rr = o.r ?? 1.2;
  B.frame(x, y, z, 0);
  B.put('frus12', 0, -1, 0, rr * 2.4, h + 1, rr * 2.4, o.col ?? 0x8a5a44, o.pat ?? P.brick);
  B.put('cyl12', 0, h - 1, 0, rr * 1.7, .8, rr * 1.7, 0x3a3230, P.brick);
  B.frame();
  if (o.smoke !== false) c.fx.smoke(x, y + h, z, { col: o.smokeCol ?? 0x6a655f, size: o.size ?? 5, h: o.sh ?? 30, n: o.n ?? 44, op: o.op ?? .6, speed: o.speed ?? .6 });
  c.occupy(x, z, rr * 3, rr * 3);
}
export function factory(c, x, z, ry, o = {}) {
  const W = o.w ?? 24, L = o.len ?? 34, H = o.h ?? 7, B = c.B, y = c.ground(x, z, W, L, ry), n = Math.max(2, Math.floor(L / 6));
  B.frame(x, y, z, ry, [3, H, W / 2, L / 2]);
  B.box(0, -2, 0, W + .3, 2.2, L + .3, 0x7a756c, P.concrete);
  B.box(0, 0, 0, W, H, L, o.wall ?? 0x9a6a52, o.wpat ?? P.brick, 0, true);
  for (let k = 0; k < n; k++) {
    const zz = -L / 2 + (k + .5) * L / n;
    B.put('shed', 0, H, zz, L / n, 3.2, W, o.roof ?? 0x4a4744, P.metal, [0, -Math.PI / 2, 0]);
    B.box(0, H, zz + L / n / 2 - .3, W, 3.1, .25, 0x8fa0a8, P.glass);
  }
  B.frame();
  c.occupy(x, z, W, L, ry);
  if (o.chimneys) o.chimneys.forEach(([cx, cz, h]) => { const cr = Math.cos(ry), sr = Math.sin(ry); chimney(c, x + cr * cx + sr * cz, z - sr * cx + cr * cz, h, o.chim || {}); });
}
export function blastFurnace(c, x, z, o = {}) {
  const y = c.ground(x, z, 10, 10), B = c.B, h = o.h ?? 22, col = o.col ?? 0x4a4440;
  B.frame(x, y, z, o.ry ?? 0);
  B.put('frus16', 0, 0, 0, 7, h * .7, 7, col, P.metal);
  B.put('cyl12', 0, h * .7, 0, 3.4, h * .3, 3.4, col, P.metal);
  for (let k = 0; k < 3; k++) { const a = k * 2.1; B.put('cyl12', Math.cos(a) * 6, 0, Math.sin(a) * 6, 3.6, h * .75, 3.6, 0x6a6058, P.metal); B.put('hemi', Math.cos(a) * 6, h * .75, Math.sin(a) * 6, 3.6, 1.8, 3.6, 0x6a6058, P.metal); }
  B.box(0, h * .6, 4, 1, 1, 8, 0x5a5048, P.metal, 0);
  B.put('cyl8', 0, h * .3, -4.4, 1.4, 1, 1.4, 0xff9a4a, P.fire, [Math.PI / 2, 0, 0]);
  B.frame();
  c.occupy(x, z, 14, 14);
  c.fx.smoke(x, y + h, z, { col: 0x9a948c, size: 6, h: 34, n: 50, op: .55, speed: .55 });
  c.fx.smoke(x, y + h * .3, z - 5, { col: 0xffa860, glow: 1, size: .25, h: 6, n: 30, op: .9, speed: 1.6 });
  c.light(x, y + 3, z - 6, 0xff8a40, 6, 20);
}
export function headframe(c, x, z, ry, o = {}) {
  const y = c.ground(x, z, 8, 8, ry), B = c.B, h = o.h ?? 14, col = o.col ?? 0x3a3634, mat = o.wood ? P.wood : P.iron;
  B.frame(x, y, z, ry);
  for (const s of [-1, 1]) { B.box(s * 2, 0, 0, .45, h, .45, col, mat, 0); B.box(s * 1.6, 0, -4, .4, h * 1.05, .4, col, mat); }
  for (let k = 2; k < h; k += 2.5) { B.box(0, k, 0, 4, .25, .25, col, mat); }
  B.put('cyl16', 0, h, 0, 3.2, .4, 3.2, col, P.iron, [0, 0, Math.PI / 2]);
  B.put('cyl16', 0, h - 1.5, 0, 3, .3, 3, col, P.iron, [0, 0, Math.PI / 2]);
  B.box(0, 0, 5.5, 7, 4.5, 6, o.house ?? 0x6a5040, P.brick, 0);
  B.put('gable', 0, 4.5, 5.5, 7.4, 2.4, 6.4, 0x3a3634, P.slate, [0, Math.PI / 2, 0]);
  B.frame();
  c.occupy(x, z, 9, 14, ry);
}
export function heap(c, x, z, r0, h, col) { // 煤堆 / 矿渣堆：锥形料堆 + 散落块
  const y = c.h(x, z) - .6;
  c.B.frame(x, y, z, c.r() * 6);
  c.B.put('cone16', 0, 0, 0, r0 * 2, h, r0 * 2 * .8, col, P.rock);
  c.B.put('cone12', r0 * .5, 0, r0 * .3, r0 * 1.2, h * .7, r0 * 1.1, col, P.rock);
  c.B.frame();
  for (let k = 0; k < 10; k++) { const a = c.r() * 6.28, d = r0 * (.9 + c.r() * .4); c.I.small('rock', x + Math.cos(a) * d, c.h(x, z), z + Math.sin(a) * d, rand(c, .4, .9), lin(col).multiplyScalar(rand(c, .8, 1.2)), c.r() * 6); }
  c.occupy(x, z, r0 * 2.2, r0 * 2.2, 0, 0);
}
export function derrick(c, x, z, o = {}) {
  const y = c.ground(x, z, 5, 5), B = c.B, h = o.h ?? 16, col = o.col ?? 0x3e3a36;
  B.frame(x, y, z, c.r() * 6);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.put('box', a * 2.2, 0, b * 2.2, .3, h, .3, col, P.iron, [-b * .13, 0, a * .13]);
  for (let k = 2; k < h; k += 2.4) { const s = 4.4 * (1 - k / h * .8); B.box(0, k, s / 2, s, .18, .18, col, P.iron); B.box(0, k, -s / 2, s, .18, .18, col, P.iron); B.box(s / 2, k, 0, .18, .18, s, col, P.iron); B.box(-s / 2, k, 0, .18, .18, s, col, P.iron); }
  B.box(0, 0, 3.5, 3, 2.6, 3, 0x5a4a3c, P.wood);
  B.frame();
  c.occupy(x, z, 6, 6);
  if (o.flare) { const fx = x + 6, fz = z + 3, fy = c.h(fx, fz); B.frame(fx, fy, fz); B.put('cyl8', 0, 0, 0, .4, 6, .4, 0x3a3634, P.iron); B.put('cone8', 0, 6, 0, .9, 2.2, .9, 0xffa040, P.fire); B.frame(); c.fx.smoke(fx, fy + 7, fz, { col: 0xffb060, glow: 1, size: .35, h: 7, n: 26, op: .9, speed: 1.8 }); c.fx.smoke(fx, fy + 8, fz, { col: 0x2a2725, size: 2.4, h: 24, n: 32, op: .5 }); c.light(fx, fy + 7, fz, 0xff8a3a, 5, 26); }
}
export function tanks(c, x, z, n, o = {}) { for (let i = 0; i < n; i++) { const tx = x + (i % 2) * 7, tz = z + Math.floor(i / 2) * 7, y = c.ground(tx, tz, 6, 6); c.B.frame(tx, y, tz); c.B.put('cyl16', 0, -.5, 0, 6, o.h ?? 5, 6, o.col ?? 0xc9c4b8, P.metal); c.B.put('hemi', 0, (o.h ?? 5) - .5, 0, 6, 1, 6, o.col ?? 0xc9c4b8, P.metal); c.occupy(tx, tz, 6.5, 6.5); } c.B.frame(); }

/* ---------------- 交通 ---------------- */
export function train(c, pts0, from, n, o = {}) { // 沿轨道放车厢
  const pts = spline(pts0, 5); let i = Math.floor(from * (pts.length - 2));
  for (let k = 0; k < n && i < pts.length - 4; k++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 3], ry = Math.atan2(bx - ax, bz - az), x = (ax + bx) / 2, z = (az + bz) / 2, y = c.h(x, z) + .5;
    c.B.frame(x, y, z, ry);
    if (k === 0 && o.loco !== false) {
      c.B.box(0, .3, 0, 2.2, .6, 8, 0x2a2624, P.iron);
      c.B.put('cyl12', 0, 1.9, 1.2, 2, 4.6, 2, o.loco ?? 0x2f3a33, P.hull, [Math.PI / 2, 0, 0]);
      c.B.box(0, .9, -2.6, 2.4, 2.6, 2.6, o.loco ?? 0x2f3a33, P.hull);
      c.B.put('cyl8', 0, 2.8, 2.8, .6, 1.4, .6, 0x1e1c1a, P.iron);
      c.fx.smoke(x + Math.sin(ry) * 2.8, y + 4.4, z + Math.cos(ry) * 2.8, { col: 0xd8d4cc, size: 1.8, h: 12, n: 26, op: .55, speed: .8 });
    } else {
      c.B.box(0, .3, 0, 2.3, .5, 7.2, 0x2a2624, P.iron);
      c.B.box(0, .8, 0, 2.5, o.open ? 1.4 : 2.6, 7, pick(c, o.cars ?? [0x6a3a2c, 0x5a4a3a, 0x3e4a42]), o.open ? P.iron : P.wood);
      if (o.open && o.cargo) c.B.box(0, 2, 0, 2.2, .5, 6.6, o.cargo, P.rock);
    }
    i += 4;
  }
  c.B.frame();
}
export function bridge(c, a, b, o = {}) {
  const B = c.B, [ax, az] = a, [bx, bz] = b, L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), w = o.w ?? 5;
  const y = o.y ?? Math.max(c.h(ax, az), c.h(bx, bz), c.wl + 3);
  B.frame((ax + bx) / 2, y, (az + bz) / 2, ry);
  B.box(0, -.6, 0, w, .8, L + 2, o.deck ?? 0x8a8070, o.kind === 'steel' ? P.iron : P.stone);
  if (o.kind === 'steel') {
    const n = Math.max(2, Math.round(L / 30));
    for (let s = 0; s < n; s++) {
      const z0 = -L / 2 + s * L / n, z1 = z0 + L / n, h = 6;
      for (const side of [-1, 1]) {
        B.box(side * w / 2, h, (z0 + z1) / 2, .4, .4, L / n, o.col ?? 0x5a5f63, P.iron);
        for (let k = 0; k <= 6; k++) { const zz = z0 + k * (z1 - z0) / 6; B.box(side * w / 2, 0, zz, .3, h, .3, o.col ?? 0x5a5f63, P.iron); if (k < 6) B.put('box', side * w / 2, 0, zz + (z1 - z0) / 12, .25, Math.hypot(h, (z1 - z0) / 6), .25, o.col ?? 0x5a5f63, P.iron, [k % 2 ? .7 : -.7, 0, 0]); }
      }
      B.put('cyl12', 0, -y + c.wl - 6, z1, 3, y - c.wl + 6, 3, 0x8a857a, P.stone);
    }
  } else {
    const n = Math.max(1, Math.round(L / (o.span ?? 12)));
    for (let s = 0; s < n; s++) {
      const zz = -L / 2 + (s + .5) * L / n;
      B.put('arch', 0, -y + c.wl - 4, zz, L / n * .98, (y - c.wl + 4) * 1.06, w, o.col ?? 0xa59c8a, P.stone, [0, Math.PI / 2, 0]);
    }
    for (const side of [-1, 1]) B.box(side * (w / 2 - .2), .2, 0, .4, .9, L + 2, o.col ?? 0xa59c8a, P.stone);
  }
  B.frame();
}
export function cart(c, x, z, ry, col = 0x7a5a3c) {
  const y = c.h(x, z), B = c.B; B.frame(x, y, z, ry);
  B.box(0, .7, 0, 1.6, .6, 2.6, col, P.wood); for (const s of [-1, 1]) B.put('cyl12', s * .9, .7, 0, .1, 1.3, 1.3, 0x3a2a20, P.wood, [0, 0, Math.PI / 2]);
  B.box(0, .9, 2, .1, .1, 1.8, col, P.wood); B.frame();
}
export function poles(c, pts0, o = {}) { // 电报线
  const pts = spline(pts0, 3), step = o.step ?? 14; let acc = 0, prev = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    while (acc < L) {
      const t = acc / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = c.h(x, z), h = o.h ?? 6;
      c.B.frame(x, y, z, Math.atan2(bx - ax, bz - az)); c.B.put('cyl8', 0, -.5, 0, .22, h + .5, .22, 0x4a3a2c, P.wood); c.B.box(0, h - .4, 0, 1.6, .15, .15, 0x4a3a2c, P.wood);
      if (prev) { const [px, py, pz] = prev, dx = x - px, dz = z - pz, dy = (y + h - .3) - py, LL = Math.hypot(dx, dz); c.B.frame((x + px) / 2, (y + h - .3 + py) / 2 - .35, (z + pz) / 2, Math.atan2(dx, dz)); for (const s of [-.6, .6]) c.B.put('box', s, 0, 0, .04, .04, LL, 0x2a2a2a, P.iron, [-Math.atan2(dy, LL), 0, 0]); }
      prev = [x, y + h - .3, z]; acc += step;
    }
    acc -= L;
  }
  c.B.frame();
}

/* ---------------- 小件与节庆 ---------------- */
export function stall(c, x, z, ry, col) {
  const y = c.ground(x, z, 3, 2.4, ry), B = c.B; B.frame(x, y, z, ry);
  B.box(0, 0, 0, 3, .9, 1.6, 0x7a5a3c, P.wood); for (const [a, b] of [[-1.4, -.9], [1.4, -.9], [-1.4, .9], [1.4, .9]]) B.box(a, 0, b, .12, 2.4, .12, 0x5a4232, P.wood);
  B.put('gable', 0, 2.3, 0, 2.4, .7, 3.4, col, P.cloth, [0, Math.PI / 2, 0]);
  for (let k = 0; k < 4; k++) B.box(-1 + k * .65, .9, 0, .5, .3, .6, pick(c, [0xd9a23a, 0xb84a32, 0x6a8a3a, 0xe8d8b0]), P.cloth);
  B.frame(); c.occupy(x, z, 3.4, 2.4, ry);
}
export function flag(c, x, y, z, h, col) { const B = c.B; B.frame(x, y, z, c.r() * 6); B.put('cyl8', 0, 0, 0, .14, h, .14, 0x5a5048, P.iron); B.box(.9, h - 1.4, 0, 1.8, 1.1, .05, col, P.cloth); B.frame(); }
export function banner(c, x, z, h, col, ry = 0) { const y = c.h(x, z), B = c.B; B.frame(x, y, z, ry); B.put('cyl8', 0, 0, 0, .2, h, .2, 0x3a3632, P.iron); B.box(0, h * .35, .15, 1.6, h * .58, .06, col, P.cloth); B.box(0, h, 0, 1.9, .14, .14, 0xb58a4a, P.gold); B.frame(); }
export function lamp(c, x, z, col = 0xffd59a, h = 3.6) { const y = c.h(x, z), B = c.B; B.frame(x, y, z); B.put('cyl8', 0, 0, 0, .14, h, .14, 0x2a2826, P.iron); B.put('sph', 0, h + .2, 0, .5, .5, .5, col, P.light); B.frame(); }
export function brazier(c, x, z, o = {}) {
  const y = c.h(x, z), B = c.B; B.frame(x, y, z);
  B.put('cyl8', 0, 0, 0, .3, 1.1, .3, 0x3a3230, P.iron); B.put('frus12', 0, 1.1, 0, 1.3, .5, 1.3, 0x2a2624, P.iron, [Math.PI, 0, 0]);
  B.put('cone8', 0, 1.2, 0, .9, 1.2, .9, 0xff9a40, P.fire); B.frame();
  c.fx.smoke(x, y + 1.6, z, { col: 0xffa850, glow: 1, size: .22, h: 5, n: 14, op: .9, speed: 1.6 });
  if (o.light !== false) c.light(x, y + 2.2, z, 0xff9a50, 3, 12);
}
export function lanternString(c, a, b, cols = [0xffc070, 0xff8a50], sag = 1.2) {
  const [ax, ay, az] = a, [bx, by, bz] = b, n = Math.max(3, Math.round(Math.hypot(bx - ax, bz - az) / 1.6));
  for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * sag; c.B.frame(x, y, z); c.B.put('sph', 0, -.2, 0, .45, .55, .45, pick(c, cols), P.light); }
  const L = Math.hypot(bx - ax, bz - az); c.B.frame((ax + bx) / 2, (ay + by) / 2 - sag * .6, (az + bz) / 2, Math.atan2(bx - ax, bz - az)); c.B.box(0, 0, 0, .04, .04, L, 0x2a2a2a, P.iron);
  c.B.frame();
}
export function bunting(c, a, b, cols, sag = 1) {
  const [ax, ay, az] = a, [bx, by, bz] = b, n = Math.max(3, Math.round(Math.hypot(bx - ax, bz - az) / .9)), ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
  for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * sag; c.B.frame(x, y, z, ry); c.B.put('cone8', 0, -.7, 0, .5, .7, .08, pick(c, cols), P.cloth, [Math.PI, 0, 0]); }
  c.B.frame();
}
export function fence(c, pts0, o = {}) {
  const pts = spline(pts0, 3), col = o.col ?? 0x7a6450;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), y0 = c.h(ax, az), y1 = c.h(bx, bz);
    c.B.frame(ax, y0, az, Math.atan2(bx - ax, bz - az)); c.B.box(0, 0, 0, .14, o.h ?? 1.1, .14, col, P.wood);
    c.B.frame((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
    for (const yy of o.stone ? [0] : [.45, .9]) c.B.put('box', 0, yy, 0, o.stone ? .7 : .07, o.stone ? .9 : .1, L, col, o.stone ? P.stone : P.wood, [-Math.atan2(y1 - y0, L), 0, 0]);
  }
  c.B.frame();
}
export function yurt(c, x, z, o = {}) {
  const r0 = o.r ?? 2.6, y = c.ground(x, z, r0 * 2, r0 * 2), B = c.B, col = o.col ?? 0xe8dfcc;
  B.frame(x, y, z, c.r() * 6);
  B.put('cyl16', 0, -.2, 0, r0 * 2, 1.9, r0 * 2, col, P.felt);
  B.put('cone16', 0, 1.7, 0, r0 * 2.15, 1.5, r0 * 2.15, o.roof ?? col, P.felt);
  B.put('cyl8', 0, 1.65, 0, r0 * 2.02, .25, r0 * 2.02, o.band ?? 0x9a3a2c, P.cloth);
  B.box(0, -.1, r0 - .1, 1, 1.5, .3, o.door ?? 0xb0503a, P.paint);
  B.frame(); c.occupy(x, z, r0 * 2.2, r0 * 2.2);
  if (o.smoke) c.fx.smoke(x, y + 3.2, z, { col: 0xc8c2b8, size: 1, h: 9, n: 14, op: .4 });
}
export function hay(c, x, z, col = 0xd8b25a) { const y = c.h(x, z); c.B.frame(x, y, z); c.B.put('cyl12', 0, 0, 0, 1.6, 1.4, 1.6, col, P.thatch); c.B.put('cone12', 0, 1.4, 0, 1.8, 1, 1.8, col, P.thatch); c.B.frame(); }
export function statue(c, x, z, o = {}) { const y = c.ground(x, z, 3, 3), B = c.B; B.frame(x, y, z, o.ry ?? 0); B.box(0, 0, 0, 3, o.base ?? 3, 3, o.stone ?? 0xc8c0b0, P.stone); B.put('cyl8', 0, o.base ?? 3, 0, 1, (o.h ?? 4) * .65, 1, o.col ?? 0x6a7a6a, P.metal); B.put('sph', 0, (o.base ?? 3) + (o.h ?? 4) * .72, 0, .7, .8, .7, o.col ?? 0x6a7a6a, P.metal); B.box(.6, (o.base ?? 3) + (o.h ?? 4) * .4, 0, .3, (o.h ?? 4) * .5, .3, o.col ?? 0x6a7a6a, P.metal, 0); B.frame(); c.occupy(x, z, 3.4, 3.4); }
export function grave(c, x, z) { const y = c.h(x, z); c.B.frame(x, y, z, c.r() * .3); c.B.box(0, 0, 0, .7, rand(c, .7, 1.2), .25, pick(c, [0x8a857c, 0x9a958a, 0x6f6b64]), P.stone); c.B.frame(); }

/* ---------------- 植被排列 ---------------- */
export function rows(c, cx, cz, w, d, ry, o = {}) { // 葡萄、咖啡、茶等成行灌木
  const cr = Math.cos(ry), sr = Math.sin(ry), sp = o.row ?? 2.2, st = o.step ?? 1.4;
  for (let a = -w / 2; a <= w / 2; a += sp) for (let b = -d / 2; b <= d / 2; b += st) {
    const x = cx + a * cr + b * sr, z = cz - a * sr + b * cr;
    if (!c.inside(x, z, 2) || c.h(x, z) < c.wl + .4 || !c.free(x, z, 0)) continue;
    if (o.where && !o.where(x, z)) continue;
    c.I.tree(o.species ?? 'shrub', x + (c.r() - .5) * .3, c.h(x, z), z + (c.r() - .5) * .3, rand(c, o.s?.[0] ?? .5, o.s?.[1] ?? .7), lin(pick(c, o.cols ?? [0x4e6a2a, 0x5a7a30])).multiplyScalar(rand(c, .85, 1.15)), o.trunk ?? 0x5a4232, c.r() * 6);
  }
}
