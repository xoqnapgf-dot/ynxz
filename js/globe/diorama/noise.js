/* 可复现的随机数与 2D 单形噪声（沙盘地形、散布、颜色抖动）。 */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.range = (a0, b0) => a0 + (b0 - a0) * r();
  r.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * r());
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  r.chance = p => r() < p;
  return r;
}
export function strSeed(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GR = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function makeNoise(seed = 1) {
  const r = rng(seed), p = new Uint8Array(512), perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  function n2(x, y) {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - i + t, y0 = y - j + t, i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt;
    tt = .5 - x0 * x0 - y0 * y0; if (tt > 0) { const g = GR[p[ii + p[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = .5 - x1 * x1 - y1 * y1; if (tt > 0) { const g = GR[p[ii + i1 + p[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = .5 - x2 * x2 - y2 * y2; if (tt > 0) { const g = GR[p[ii + 1 + p[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
  function fbm(x, y, oct = 4, gain = .5, lac = 2) { let s = 0, a = 1, f = 1, nrm = 0; for (let o = 0; o < oct; o++) { s += a * n2(x * f + o * 13.7, y * f - o * 7.3); nrm += a; a *= gain; f *= lac; } return s / nrm; }
  function ridge(x, y, oct = 4) { let s = 0, a = 1, f = 1, w = 1, nrm = 0; for (let o = 0; o < oct; o++) { let n = 1 - Math.abs(n2(x * f + o * 5.1, y * f + o * 9.7)); n *= n * w; w = Math.min(1, n * 1.8); s += n * a; nrm += a; a *= .5; f *= 2.1; } return s / nrm; }
  return { n2, fbm, ridge };
}
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
/* 点到折线的距离与沿线参数 */
export function segDist(px, pz, pts) {
  let best = 1e9, along = 0, acc = 0, bestAlong = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    let t = ((px - ax) * dx + (pz - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(px - qx, pz - qz), L = Math.sqrt(L2);
    if (d < best) { best = d; bestAlong = acc + t * L; }
    acc += L;
  }
  along = bestAlong;
  return [best, along, acc];
}
/* Catmull-Rom 平滑折线 */
export function spline(pts, per = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => .5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
