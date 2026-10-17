/* 小地点：完整底座的沙盘。
   坐标：+x 东，+z 南（相机方位角 az=0 时从南向北看）。 */
import * as K from './props.js?v=23';
import { P, lin, wall, tower, boat } from './kit.js?v=23';
import { bump, terrace, ridgeLine, island, smooth, clamp, lerp, segDist } from './terrain.js?v=23';

export const SITES = {};
const coarse = (c, n) => c.coarse ? Math.round(n * .35) : n;
const hashCell = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
/* 拼布田：旋转网格中每格一个颜色，田埂压暗 */
function fields(col, x, z, ang, sx, sz, cols, k = .85, furrow = .1) {
  const ca = Math.cos(ang), sa = Math.sin(ang), u = x * ca + z * sa, v = -x * sa + z * ca;
  const iu = Math.floor(u / sx), iv = Math.floor(v / sz), h = hashCell(iu, iv);
  const edge = Math.min(u / sx - iu, 1 - (u / sx - iu)) * sx < .6 || Math.min(v / sz - iv, 1 - (v / sz - iv)) * sz < .6;
  const fc = lin(cols[Math.floor(h * cols.length)]).multiplyScalar(1 - furrow + furrow * Math.sin(v * 2.6));
  col.lerp(edge ? fc.multiplyScalar(.72) : fc, k);
  return { h, edge };
}
/* 极坐标 → 平面 */
const pol = (cx, cz, r, a) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];

/* ================= 安那其学院：海峡小岛上的自由学园 ================= */
SITES['安那其学院'] = {
  mode: 'closed', R: 58, seed: 'anarchy-isle', time: 'afternoon',
  label: '海峡小岛 · 自由学园', note: '学院占着岛的东半边：讲堂是旧仓库改的，旁边是工坊和菜地，码头每天有渡船往返两岸。',
  shape: { kind: 'circle', wobble: .07 },
  water: { level: 0, shallow: 0x3fa39a, deep: 0x0d4560, clarity: .38, wave: .35, foam: 1.1 },
  strata: [0x4b3a2a, 0xb59a74, 0x9c8264, 0xc9b28c, 0x7d6a55], plinth: 0x30241c,
  palette: { grass: [0x6f9446, 0x5e8a40], dry: 0xa59c62, dryK: .35, sand: 0xdccaa0, rock: 0x8a8173, bed: 0x9a9070 },
  height(x, z, c) {
    const L = island(x, z, -2, 2, 40, c.N, .3, .04) + bump(x, z, 30, -16, 12, .35);
    const land = L > 0 ? 1.2 + L * 9 + c.N.fbm(x * .05, z * .05, 4) * 3 * L + bump(x, z, 30, -16, 9, 7) : L * 18;
    return Math.max(land, -8);
  },
  pads: [{ x: -6, z: 2, r: 11, soft: 6 }, { x: 4, z: 24, r: 6, soft: 4 }],
  roads: [{ pts: [[4, 30], [2, 18], [-4, 8], [-8, -6], [-14, -18]], w: 3 }, { pts: [[-4, 6], [10, 0], [22, -10], [28, -15]], w: 2.4 }],
  weather: { birds: { n: 10, col: 0xeeeeee, y: 14 } },
  wind: .6,
  views: [{ label: '全岛', az: 28, el: 36, d: 1 }, { label: '学院广场', az: 55, el: 30, d: .42, t: [-6, null, 2] }, { label: '码头', az: 10, el: 22, d: .38, t: [4, null, 26] }, { label: '灯塔岬', az: 110, el: 26, d: .34, t: [30, null, -16] }],
  build(c) {
    const B = c.B;
    // 讲堂：旧仓库改建（长砖房 + 锯齿天窗）
    K.factory(c, -14, -4, .35, { w: 12, len: 20, h: 6, wall: 0x9a5a44, roof: 0x5d6168 });
    // 宿舍、食堂、图书室：彼此不太统一
    K.bld(c, 'academy', 4, -8, { ry: .3, fl: 2, w: 10, d: 6 });
    K.bld(c, 'academy', -2, -18, { ry: .4, fl: 2 });
    K.bld(c, 'academy', 10, 8, { ry: -.25, fl: 1, w: 8 });
    K.bld(c, 'academy', -20, 10, { ry: .9, fl: 2 });
    K.bld(c, 'academy', -24, -12, { ry: .5, fl: 1, w: 7 });
    K.bld(c, 'harbour', 14, 18, { ry: -.6, fl: 2 });
    K.bld(c, 'harbour', -6, 22, { ry: .2, fl: 1 });
    // 玻璃温室
    B.frame(-12, c.ground(-12, 20, 8, 5, .3), 20, .3); B.box(0, 0, 0, 8, 2.6, 5, 0xbfd8d8, P.glass); B.put('gable', 0, 2.6, 0, 5, 1.6, 8, 0xcfe4e4, P.glass, [0, Math.PI / 2, 0]); B.frame(); c.occupy(-12, 20, 9, 6, .3);
    // 工坊烟囱与风力水泵
    K.chimney(c, -5, -24, 9, { r: .7, size: 1.4, sh: 14, n: 22, smokeCol: 0xbab4ac });
    const wy = c.ground(18, -4); B.frame(18, wy, -4); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.put('box', a * .9, 0, b * .9, .16, 8, .16, 0x6a5a4c, P.wood, [-b * .08, 0, a * .08]);
    for (let k = 0; k < 8; k++) B.put('box', 0, 8.2, 0, .5, 3, .08, 0xd8d0c0, P.metal, [0, 0, k * Math.PI / 4]); B.frame(); c.occupy(18, -4, 3, 3);
    // 菜地与果树
    for (const [x, z, ry] of [[-28, 0, .4], [-20, 26, .2], [-32, 14, .5]]) K.rows(c, x, z, 9, 7, ry, { species: 'shrub', row: 1.5, step: 1, cols: [0x5a8a36, 0x7a9a3a, 0x8aa040], s: [.35, .5] });
    K.rows(c, 22, 2, 10, 10, .3, { species: 'round', row: 4, step: 4, cols: [0x5f8a3a, 0x6e9440], s: [.45, .6] });
    // 码头、船
    K.pier(c, 4, 28, 12, 0, { w: 2.6 });
    K.pier(c, 16, 24, 8, .6, { w: 2 });
    K.boatAt(c, 8, 36, .1, { len: 7, kind: 'sail', hull: 0x2f4f6a, sail: 0xf2ece0 });
    K.boatAt(c, 0, 37, -.2, { len: 5, hull: 0xa04a32 });
    K.boatAt(c, 22, 31, .7, { len: 9, kind: 'steam', hull: 0x3a3a3a, stripe: 0xb04030, cabin: 0xe9e2d4 });
    K.boatAt(c, -30, 30, 2.2, { len: 4.5, hull: 0x6a8a5a });
    // 灯塔岬
    K.lighthouse(c, 31, -17, { h: 12, stripe: 0xb04030 });
    // 广场：长桌、布告栏、人
    for (let k = 0; k < 3; k++) { B.frame(-8 + k * 3, c.h(-8 + k * 3, 4), 4, .35); B.box(0, 0, 0, 1, .8, 5, 0x7a5a3c, P.wood); B.frame(); }
    K.lanternString(c, [-16, c.h(-16, 6) + 4, 6], [2, c.h(2, -2) + 4, -2], [0xffd08a, 0xf2a060, 0xe8e0c0], 1);
    c.people(55, { at: [-6, 2, 13] });
    c.people(18, { at: [0, 0, c.R * .7] });
    c.trees(140, { species: ['round', 'round', 'pine', 'birch'], cols: [0x4f7a34, 0x5d8a3a, 0x3f6a30, 0x6a8f3e], minH: 2.5 });
    c.rocks(40, { above: -1, maxH: 3, cols: [0x8a8173, 0x9a9282] });
    c.grass(coarse(c, 5000), { cols: [0x6f9446, 0x7fa04c, 0x5e8a40], flowers: [0xf2e0a0, 0xe8a0b0, 0xffffff], minH: 2 });
  }
};

/* ================= 万知城：环城墙里的书城 ================= */
SITES['万知城'] = {
  mode: 'closed', R: 66, seed: 'wanzhi-city', time: 'morning',
  light: { el: 24, az: 120, haze: 0xdfe4ea, hd: .0016 },
  label: '中立城邦 · 书城与讲坛', note: '环城墙里，四条大街从广场伸向四座城门。圆顶下是图书馆，旁边几座高塔存着档案；半圆的讲坛从早到晚都有人上台。',
  shape: { kind: 'circle', wobble: .04 },
  water: { level: 0, shallow: 0x4f9a90, deep: 0x1d5560, clarity: .45, wave: .25, foam: .7 },
  strata: [0x5a4a3a, 0xc8b490, 0xae9a78, 0xd6c6a2, 0x8a7a62], plinth: 0x3a2e24,
  palette: {
    grass: [0x7a9a4c, 0x6a8c44], dry: 0xb4a870, dryK: .35, dirt: 0x9a8668, sand: 0xd8c8a0, rock: 0x9a9080, bed: 0x8a8468,
    paint(x, z, h, s, col, c) {
      const d = Math.hypot(x, z);
      if (d < 38) col.lerp(lin(0xb9ab8e), .55); // 城内：铺石与夯土
      else if (d > 46 && h > 1.4 && s < .25 && !c.nearRoad(x, z, 2) && !c.nearRiver(x, z, 4)) fields(col, x, z, .5, 9, 6, [0xc7b25a, 0x8aa04a, 0x6f8c3e, 0xb69a54, 0x9aae5a], .8);
    }
  },
  height(x, z, c) {
    return 2.6 + bump(x, z, 0, 0, 48, 6, 2.2) + c.N.fbm(x * .03, z * .03, 3) * 1.4 + bump(x, z, -52, -40, 20, 9) + bump(x, z, 50, -44, 18, 6);
  },
  rivers: [{ pts: [[-80, 40], [-44, 50], [-10, 53], [24, 50], [80, 38]], w: 10, depth: 2.2, bank: 3 }],
  pads: [{ x: 0, z: 0, r: 10, soft: 5 }],
  roads: [
    { pts: [[0, -9], [0, -40], [-2, -66]], w: 4 }, { pts: [[9, 0], [40, 0], [66, -6]], w: 4 },
    { pts: [[-9, 0], [-40, 0], [-66, 4]], w: 4 }, { pts: [[0, 9], [0, 40]], w: 4 }, { pts: [[1, 61], [3, 70]], w: 4 }
  ],
  weather: { birds: { n: 26, col: 0xf4f2ee, y: 26 }, motes: { kind: 'dust', n: 160, cols: [0xfff2d8], size: .2, op: .3, h: 14, rad: 40 } },
  wind: .4,
  views: [{ label: '全城', az: 18, el: 42, d: 1 }, { label: '图书馆', az: 30, el: 26, d: .4, t: [-17, null, -17] }, { label: '讲坛', az: 300, el: 30, d: .36, t: [17, null, -17] }, { label: '南门与桥', az: 350, el: 20, d: .42, t: [2, null, 46] }],
  build(c) {
    const B = c.B, RW = 40;
    // 城墙：四门处断开，门两侧各一座方塔
    const n = 20, ring = []; for (let i = 0; i <= n; i++) ring.push(pol(0, 0, RW, i / n * Math.PI * 2 + Math.PI / n));
    const gate = i => (i + 1) % (n / 4) === 0; // 第 i 段的中点正对一座城门
    for (let i = 0; i < n; i++) if (!gate(i)) wall(B, [ring[i], ring[i + 1]], 5.5, 1.8, 0xc9b994, P.stone, true, (x, z) => c.h(x, z));
    for (let i = 0; i < n; i++) {
      const [x, z] = ring[i], atGate = gate(i) || gate((i + n - 1) % n);
      tower(B, x, c.h(x, z) - .5, z, atGate ? { r: 2.6, h: 10, wall: 0xd2c29c, roof: 'flat', sq: true } : { r: 1.9, h: 8, wall: 0xc2b28c, rcol: 0x5a7f86, roof: 'cone' });
    }
    c.occupyLine(ring, 5);
    // 中央广场：喷泉 + 柱廊
    const fy = c.h(0, 0); B.frame(0, fy, 0); B.put('cyl16', 0, 0, 0, 7, .7, 7, 0xd8ccb4, P.stone); B.put('cyl16', 0, .3, 0, 6, .45, 6, 0x4f8a8c, P.glass); B.put('cyl12', 0, 0, 0, 1, 3.2, 1, 0xd8ccb4, P.stone); B.put('cyl12', 0, 3, 0, 2.4, .4, 2.4, 0xd8ccb4, P.stone);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + Math.PI / 16; B.put('cyl8', Math.cos(a) * 9.4, 0, Math.sin(a) * 9.4, .6, 4.2, .6, 0xeee4d0, P.stone); }
    B.frame(); c.occupy(0, 0, 8, 8);
    // 图书馆：鼓座 + 铜绿圆顶 + 采光亭
    { const x = -17, z = -17, y = c.ground(x, z, 18, 18); B.frame(x, y, z, Math.PI / 4, [2.6, 4, 8, 8]);
      B.box(0, -2, 0, 20, 2.6, 20, 0xb8aa8e, P.stone);
      B.box(0, .6, 0, 18, 7, 18, 0xe6d6b4, P.stone, 0, true);
      B.put('cyl16', 0, 7.6, 0, 13, 3.4, 13, 0xe9dcc0, P.stone);
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; B.put('cyl8', Math.cos(a) * 6.9, 7.6, Math.sin(a) * 6.9, .5, 3.4, .5, 0xf4ecd8, P.stone); }
      B.put('hemi', 0, 11, 0, 13.4, 8, 13.4, 0x6aa596, P.metal);
      B.put('cyl12', 0, 18.6, 0, 2.2, 2, 2.2, 0xf0e6d0, P.stone); B.put('cone12', 0, 20.6, 0, 2.6, 1.6, 2.6, 0x6aa596, P.metal); B.put('sph', 0, 22.2, 0, .6, .6, .6, 0xc9a24a, P.gold);
      for (const s of [-1, 1]) B.put('cyl8', s * 3, .6, 9.6, 1, 6.4, 1, 0xf4ecd8, P.stone); B.put('gable', 0, 7, 9.6, 9, 2.4, 2.6, 0xe6d6b4, P.stone);
      B.frame(); c.occupy(x, z, 21, 21, Math.PI / 4); }
    // 讲坛：半圆阶梯座位朝向广场
    { const x = 18, z = -18, ry = Math.atan2(-x, -z) + Math.PI, y = c.ground(x, z, 20, 20); B.frame(x, y, z, ry);
      B.box(0, -2, 0, 22, 2.3, 22, 0xb8aa8e, P.stone);
      for (let k = 0; k < 7; k++) { const rk = 4 + k * 1.3, m = 16; for (let j = 0; j < m; j++) { const a = -Math.PI / 2 + (j + .5) / m * Math.PI; B.put('box', Math.sin(a) * rk, .3, -Math.cos(a) * rk, rk * Math.PI / m + .15, .45 + k * .55, 1.35, k % 2 ? 0xd6c8aa : 0xcbbc9c, P.stone, [0, -a, 0]); } }
      B.box(0, .3, 1.5, 7, .7, 3.4, 0xe8dcc2, P.stone); B.box(0, .3, 3.4, 9, 3.6, .6, 0xe0d2b4, P.stone);
      B.frame(); c.occupy(x, z, 20, 18, ry);
      c.people(28, { at: [x, z, 9], free: false, cols: [0x7a3a2c, 0x2f4a6a, 0xd8ccb0, 0x4a5a3a, 0x8a6a3a, 0x3a3432] }); }
    // 档案塔：东南角三座
    for (const [x, z, h] of [[17, 16, 20], [24, 9, 16], [10, 25, 14]]) { tower(B, x, c.h(x, z) - .4, z, { r: 2.8, h, wall: 0xdcc8a0, rcol: 0x4f6f72, sq: true, win: 2.4 }); c.occupy(x, z, 7, 7); }
    // 西南：书市
    for (let k = 0; k < 8; k++) { const a = Math.PI * .62 + k * .12, [x, z] = pol(0, 0, 16 + (k % 2) * 4, a); K.stall(c, x, z, a + Math.PI / 2, K.pick(c, [0x8a3a2c, 0x3a5a7a, 0xd8c8a0, 0x4a6a3a])); }
    // 街道与街区
    K.street(c, [[0, -11], [0, -36]], 'scholar', { roadW: 4, setback: .4, gap: .5, fill: 1 });
    K.street(c, [[11, 0], [36, 0]], 'scholar', { roadW: 4, setback: .4, gap: .5, fill: 1 });
    K.street(c, [[-11, 0], [-36, 0]], 'scholar', { roadW: 4, setback: .4, gap: .5, fill: 1 });
    K.street(c, [[0, 11], [0, 36]], 'scholar', { roadW: 4, setback: .4, gap: .5, fill: 1 });
    for (const [x, z] of [[-24, -26], [26, -26], [26, 24], [-24, 24], [-30, -10], [30, -10], [-10, 30], [12, -32]]) K.cluster(c, 'scholar', x, z, 10, 7, { angle: Math.atan2(z, x), r: 3.2, where: { maxSlope: .6 } });
    // 城外：桥、磨坊、果园、渡船
    K.bridge(c, [1, 43], [2, 62], { w: 5, span: 7, col: 0xc0b08c });
    K.waterwheel(c, -30, 46, .1); K.bld(c, 'vine', -30, 41, { fl: 2, w: 7, d: 6, ry: .1 });
    for (const [x, z, ry] of [[-50, -8, .4], [50, 14, -.3], [-44, 26, .2]]) K.rows(c, x, z, 12, 10, ry, { species: 'round', row: 3.4, step: 3.4, cols: [0x6a8a46, 0x7a9a4e], s: [.45, .6] });
    for (const [x, z] of [[-48, -30], [46, -32], [52, 24]]) K.bld(c, 'vine', x, z, { fl: 1, ry: c.r() * 3 });
    for (let k = 0; k < 4; k++) K.boatAt(c, -40 + k * 22, 51 + (c.r() - .5) * 3, Math.PI / 2 + (c.r() - .5) * .3, { len: 5 + c.r() * 2, kind: k % 2 ? 'sail' : 'row', hull: 0x5a4636, sail: 0xf0e6d0 });
    K.flag(c, 0, c.h(0, -40) + 10, -40, 4, 0xe8e0c8);
    c.people(120, { at: [0, 0, 36], cols: [0x7a3a2c, 0x2f4a6a, 0xd8ccb0, 0x4a5a3a, 0x8a6a3a, 0x3a3432, 0xe0d8c8] });
    c.people(20, { at: [0, 50, 20] });
    c.animals('sheep', 18, { at: [-46, -40, 14], cols: [0xe8e2d4, 0xd8d0c0] });
    c.trees(coarse(c, 220), { species: ['column', 'column', 'round', 'broad'], cols: [0x4f6e34, 0x5d7a3a, 0x3f5e30], minH: 1.5, area: (x, z) => Math.hypot(x, z) > 44 ? .9 : .15 });
    c.trees(30, { species: ['willow'], cols: [0x7a9a4a], at: [0, 48, 60], maxH: 3.5, above: .4 });
    c.grass(coarse(c, 3000), { cols: [0x7a9a4c, 0x8aa252], flowers: [0xf2e8c0, 0xe8b0b8], rmax: 66, area: (x, z) => Math.hypot(x, z) > 44 ? 1 : 0 });
  }
};

/* ================= 常灵群岛：雾里的岛礁与裂缝 ================= */
const CL_ISLES = [[-8, -6, 34, .32, 9], [30, 24, 11, .35, 15], [40, -20, 8, .3, 18], [-38, 32, 10, .3, 12], [12, 42, 6, .35, 14], [-42, -36, 8, .3, 16]];
SITES['常灵群岛'] = {
  mode: 'closed', R: 64, seed: 'changling-isles', time: 'dusk',
  light: { el: 14, az: 290, sun: 0xa8bcff, si: 1.3, top: 0x16203f, hor: 0x46567e, haze: 0x3e4e74, gnd: 0x242a34, hemi: .85, env: .55, hd: .0036, exp: 1.36, bloom: .8, night: .6 },
  label: '海峡群岛 · 雾、密林与裂缝', note: '主岛的林子密得透不进光，东面海上那道裂缝时明时暗。渔村在南岸，观测站的桅杆立在西北的岬角上。',
  shape: { kind: 'circle', wobble: .1 },
  water: { level: 0, shallow: 0x2b6a72, deep: 0x0a2236, clarity: .5, wave: .3, foam: .8 },
  strata: [0x23262a, 0x4d5248, 0x3a3e38, 0x5c6256, 0x2c302c], plinth: 0x15171a,
  palette: { grass: [0x2f5238, 0x284a34], dry: 0x4f5a3c, dryK: .2, dirt: 0x3a3428, sand: 0x8a8670, rock: 0x585c58, bed: 0x3a4a48, rockSlope: .55 },
  lit: .8,
  height(x, z, c) {
    let h = -8;
    for (const [cx, cz, r, wob, k] of CL_ISLES) {
      const L = island(x, z, cx, cz, r, c.N, wob, .05);
      h = Math.max(h, L > 0 ? .9 + L * k + c.N.fbm(x * .06, z * .06, 4) * 2.6 * L : L * 16);
    }
    h += bump(x, z, -14, -12, 16, 12) * smooth(-1, 2, h);
    return Math.max(h, -8);
  },
  pads: [{ x: 12, z: 14, r: 7, soft: 4 }, { x: -26, z: -20, r: 5, soft: 4 }],
  roads: [{ pts: [[12, 14], [0, 4], [-12, -6], [-26, -20]], w: 2 }],
  weather: {
    mist: [{ y: 2.2, layers: 2, gap: 1.8, op: .16, col: 0x9fb2d2, scale: .035, drift: .5 }],
    motes: { kind: 'firefly', n: 520, cols: [0x8ff0e0, 0xb8a0ff, 0xd8fff2], size: .32, h: 16, speed: .14, y: 3, rad: 52 },
    rift: { pts: [[22, 15, -36], [36, 19, -14], [48, 16, 4], [54, 21, 24]], h: 13, a: 0x9ad8ff, b: 0x7a3cff, i: .8 }
  },
  glow: { p: [42, 16, -4], c: 0x9a7aff, i: 1.6 },
  fog: { y: 1, h: 5, d: .006, col: 0x2c3a58 },
  wind: .3,
  views: [{ label: '群岛', az: 20, el: 34, d: 1 }, { label: '渔村', az: 10, el: 22, d: .36, t: [12, null, 16] }, { label: '观测站', az: 285, el: 26, d: .34, t: [-26, null, -20] }, { label: '裂缝', az: 75, el: 14, d: .55, t: [36, 12, -4] }],
  build(c) {
    const B = c.B;
    // 渔村：高脚屋沿南岸
    K.cluster(c, 'stilt', 12, 15, 9, 9, { angle: .3, r: 2.6, where: { maxSlope: .7, above: .3 } });
    for (const [x, z, ry] of [[18, 20, .5], [6, 22, -.2], [22, 12, 1.2]]) K.pier(c, x, z, 7, ry, { w: 1.6 });
    for (let k = 0; k < 7; k++) K.boatAt(c, 6 + c.r() * 26, 24 + c.r() * 10, c.r() * 6, { len: 3.5 + c.r() * 2, hull: K.pick(c, [0x3a3028, 0x4a3a2c, 0x2a3a3a]) });
    for (const [x, z] of [[10, 18], [16, 22], [4, 20]]) { const y = c.h(x, z); B.frame(x, y, z); B.put('cyl8', 0, 0, 0, .12, 3, .12, 0x3a2a20, P.wood); B.put('sph', 0, 3, 0, .5, .6, .5, 0xffc27a, P.light); B.frame(); }
    c.light(12, c.h(12, 16) + 3, 16, 0xffb870, 3, 16);
    // 观测站：桁架桅杆 + 小屋 + 天线盘
    { const x = -26, z = -20, y = c.ground(x, z, 5, 5); B.frame(x, y, z, .4);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.put('box', a * 1.1, 0, b * 1.1, .16, 22, .16, 0x9a9a96, P.metal, [-b * .045, 0, a * .045]);
      for (let k = 1.5; k < 22; k += 2.2) { const s = 2.2 * (1 - k / 22 * .85); B.box(0, k, s / 2, s, .1, .1, 0x9a9a96, P.metal); B.box(0, k, -s / 2, s, .1, .1, 0x9a9a96, P.metal); B.box(s / 2, k, 0, .1, .1, s, 0x9a9a96, P.metal); B.box(-s / 2, k, 0, .1, .1, s, 0x9a9a96, P.metal); }
      B.put('sph', 0, 22.2, 0, .5, .5, .5, 0xff5a40, P.light);
      B.box(5, 0, 0, 5, 3, 4, 0xd6d6d0, P.concrete, 0); B.box(5, 3, 0, 5.4, .3, 4.4, 0x6a6a66, P.concrete);
      B.put('hemi', 5.6, 3.6, .6, 2.2, .8, 2.2, 0xe8e8e2, P.metal, [-.9, 0, 0]);
      B.frame(); c.occupy(x, z, 12, 7, .4);
      c.light(x, y + 22, z, 0xff6a50, 2, 20); c.light(x + 4, y + 2, z + 2, 0xffe2b0, 2, 10); }
    // 岛上神龛：林中石堆与小祠
    K.bld(c, 'fisher', -6, -14, { fl: 1, ry: .6, w: 4, d: 3.5 }); K.stoneLantern(c, -3, -10, true);
    c.trees(coarse(c, 1100), { species: ['cone', 'pine', 'cone', 'round', 'column'], cols: [0x2a5040, 0x325a46, 0x24483a, 0x3a6048], k: 1.3, minH: 1.8, maxSlope: 1.2 });
    c.trees(coarse(c, 160), { species: ['shrub', 'bamboo'], cols: [0x2f5a3a, 0x3a6040], minH: .9, maxH: 3 });
    c.rocks(110, { above: -2, cols: [0x4a4e4c, 0x5a5e58, 0x3e4240], s: [.8, 2.6], big: true, maxH: 3 });
    c.people(14, { at: [12, 16, 10], cols: [0x3a3a46, 0x5a4a3a, 0x2a3a4a, 0x7a6a50] });
    c.grass(coarse(c, 2600), { cols: [0x2f5238, 0x3a5e3e], flowers: [0x9ff0e0, 0xc0a8ff], flowerK: .12, minH: 1.4 });
  }
};

/* ================= 天神峰：孤峰、冰川与朝圣路 ================= */
const TS_PATH = [[8, 54], [-10, 50], [12, 44], [-6, 38], [8, 33]];
const TS_UP = [[8, 33], [-6, 28], [6, 23], [-3, 18], [4, 13], [-1, 9]];
SITES['天神峰'] = {
  mode: 'closed', R: 62, seed: 'tianshen-peak', time: 'dawn',
  light: { el: 8, az: 95, sun: 0xff9a7a, si: 2.8, top: 0x5a72b0, hor: 0xf2b4a4, haze: 0xe6bab4, hd: .0024, exp: 1.06, bloom: .45 },
  water: false,
  label: '高原孤峰 · 通天之柱', note: '朝圣的路从南坡云海里升上来，在半山的石屋歇一夜，再沿之字形的路往上。雪线以上只有冰川和风。',
  shape: { kind: 'circle', wobble: .12 },
  strata: [0x4a4a52, 0x8a8a90, 0x6e6e76, 0xa6a2a2, 0x5a5a62], plinth: 0x23232a,
  snowLine: 24,
  palette: {
    grass: [0x6a7a4a, 0x5a6e44], dry: 0x9a9468, dryK: .55, dirt: 0x6a5e4c, rock: 0x6e6c70, rockSlope: .5,
    paint(x, z, h, s, col, c, out) {
      const g = c.N.ridge(x * .05 + 3, z * .05, 3);
      if (h > 15 && g > .55) { col.lerp(lin(0xcfe2ee), smooth(15, 22, h) * .85); out.roughF = .32; } // 冰川舌
      if (h > 10) col.lerp(lin(0x7a7678), smooth(10, 20, h) * .5);
    }
  },
  height(x, z, c) {
    const d = Math.hypot(x - 2, z + 4);
    let h = 4 + 58 * Math.exp(-Math.pow(d / 23, 1.35));
    h += c.N.ridge(x * .035, z * .035, 4) * 9 * smooth(8, 26, d) * (1 - smooth(40, 60, d));
    h += ridgeLine(x, z, [[2, -4], [-30, -40]], 6, 10) + ridgeLine(x, z, [[2, -4], [40, -30]], 5, 8) + ridgeLine(x, z, [[2, -4], [-36, 18]], 5, 6);
    h += bump(x, z, 6, 33, 9, 4) + c.N.fbm(x * .05, z * .05, 3) * 1.6;
    return h;
  },
  pads: [{ x: 6, z: 34, r: 5.5, soft: 4 }, { x: 8, z: 54, r: 4, soft: 3 }],
  roads: [{ pts: TS_PATH, w: 2.2, soft: 2.4 }],
  weather: {
    mist: [{ y: 7, layers: 4, gap: 1.8, op: .72, col: 0xf6e4dc, scale: .025, drift: .35 }],
    motes: [{ kind: 'firefly', n: 140, cols: [0xfff2d0, 0xd8eaff], size: .42, y: 50, h: 18, speed: .1, rad: 9 }, { kind: 'dust', n: 260, cols: [0xffffff], size: .18, op: .5, y: 30, h: 30, speed: .6, rad: 30 }],
    birds: { n: 3, col: 0x2a2626, y: 44 }
  },
  wind: .9,
  views: [{ label: '孤峰', az: 10, el: 22, d: 1 }, { label: '峰顶', az: 340, el: 18, d: .42, t: [2, 52, -4] }, { label: '石屋', az: 25, el: 24, d: .3, t: [6, null, 34] }, { label: '朝圣路', az: 0, el: 34, d: .45, t: [2, null, 40] }],
  build(c) {
    const B = c.B;
    // 半山石屋：厚石墙、低矮、一缕炊烟
    K.bld(c, 'frost', 6, 34, { ry: .2, fl: 1, w: 7, d: 5, wall: 0x7a7066, roof: 'gable', rcol: 0x4a4440 });
    c.fx.smoke(8, c.h(8, 34) + 5, 33, { col: 0xd8d4d0, size: 1.2, h: 10, n: 16, op: .45 });
    c.light(6, c.h(6, 34) + 2, 37, 0xffb070, 3, 12);
    // 往上的之字路：碎石带 + 石堆路标
    c.ribbon(TS_UP, 1.6, 0x8a8278, P.dirt, .1, 1);
    for (const [x, z] of [...TS_PATH, ...TS_UP].filter((_, i) => i % 2)) { const y = c.h(x, z); B.frame(x + 1.4, y, z); for (let k = 0; k < 4; k++) B.put('lump', (c.r() - .5) * .3, k * .45, (c.r() - .5) * .3, 1 - k * .2, .5, 1 - k * .2, 0x8a8680, P.rock); B.frame(); }
    // 经幡
    K.bunting(c, [3, c.h(3, 33) + 5, 32], [12, c.h(12, 38) + 4, 38], [0xb03a2c, 0xf2e6c8, 0x2f5a8a, 0xd8a83a, 0x3a7a4a], 1.2);
    K.bunting(c, [-2, c.h(-2, 9) + 3, 9], [6, c.h(6, 13) + 2.6, 13], [0xb03a2c, 0xf2e6c8, 0x2f5a8a, 0xd8a83a, 0x3a7a4a], .8);
    // 山脚驿亭
    K.bld(c, 'frost', 11, 55, { ry: -.3, fl: 1, w: 5, d: 4 });
    c.people(5, { at: [4, 44, 12], cols: [0x8a3a2c, 0xd8c8a0, 0x4a4a5a] });
    c.people(3, { at: [2, 20, 8], maxSlope: 1.2, cols: [0x8a3a2c, 0xd8c8a0] });
    c.animals('horse', 3, { at: [6, 52, 6], cols: [0x4a3a30, 0x6a5040] });
    c.trees(coarse(c, 220), { species: ['pine', 'pine', 'cone'], cols: [0x2c4430, 0x34503a, 0x24382a], maxH: 13, minH: 4, k: 1 });
    c.rocks(160, { cols: [0x6a686c, 0x7a787a, 0x5a585c], big: true, s: [.8, 3], maxH: 30 });
    c.grass(coarse(c, 1800), { cols: [0x7a8450, 0x8a8a5a], maxH: 14, flowers: [0xf0e0f0, 0xd8d0f2], flowerK: .05 });
  }
};

/* ================= 法洛塔：夜里的山坡港口 ================= */
SITES['法洛塔'] = {
  mode: 'closed', R: 62, seed: 'falota-port', time: 'night',
  light: { haze: 0x1c2436, hor: 0x1e2944, hd: .0035, si: .9, hemi: .8, env: .5, exp: 1.55 },
  label: '艾迪州沿海港口 · 夜市', note: '白天的渔市散了，货栈门口又亮起灯。房子一层压一层叠上山坡，山后矿洞口的火盆整夜不灭。',
  shape: { kind: 'rect', ax: 1, az: .9, wobble: .06 },
  water: { level: 0, shallow: 0x1e4a52, deep: 0x07141e, clarity: .6, wave: .25, foam: .6 },
  strata: [0x2a2420, 0x5a4a3a, 0x463a30, 0x6a5a48, 0x342c26], plinth: 0x14100e,
  palette: { grass: [0x3e5232, 0x34482e], dry: 0x5a5a3a, dryK: .3, dirt: 0x4a3e32, sand: 0x6a6252, rock: 0x585450, bed: 0x2a3a38 },
  lit: .95,
  glow: { p: [0, 8, 12], c: 0xffa860, i: 1.3 },
  fog: { y: 1, h: 7, d: .012, col: 0x2a3448 },
  height(x, z, c) {
    const coast = 14 + 6 * Math.sin(x * .05) + c.N.fbm(x * .03, z * .03, 3) * 5 - z;
    if (coast < 0) return Math.max(coast * .5, -9);
    const base = 1.6 + Math.max(0, coast - 7) * .55;
    let h = lerp(base, terrace(base, 3.2, .7), smooth(8, 14, coast)) + c.N.fbm(x * .04, z * .04, 3) * 1.2 * smooth(10, 20, coast);
    h += bump(x, z, 34, -42, 16, 10) + bump(x, z, -34, -46, 20, 8);
    return h;
  },
  pads: [{ x: 0, z: 7, w: 84, d: 8, ry: 0, y: 1.6, soft: 3 }, { x: 34, z: -32, r: 5, soft: 4 }],
  roads: [{ pts: [[-50, 7], [0, 6], [50, 7]], w: 5 }, { pts: [[34, -32], [26, -18], [18, -6], [14, 4]], w: 2.6 }],
  weather: { mist: [{ y: 1.4, layers: 2, gap: 1.2, op: .45, col: 0x5a6680, scale: .03, drift: .4 }] },
  wind: .3,
  views: [{ label: '港口', az: 10, el: 26, d: 1 }, { label: '码头夜市', az: 350, el: 20, d: .36, t: [20, null, 8] }, { label: '山坡', az: 20, el: 34, d: .45, t: [-8, null, -18] }, { label: '矿洞口', az: 15, el: 24, d: .32, t: [32, null, -32] }],
  build(c) {
    const B = c.B;
    // 码头货栈
    for (let k = 0; k < 4; k++) K.bld(c, 'harbour', -36 + k * 15, 0, { w: 12, d: 7, fl: 2, ry: 0, roof: 'gable', wall: K.pick(c, [0x6a5a48, 0x7a6450, 0x5a4c40]), rcol: 0x3a3634, rpat: P.metal });
    // 夜市摊子
    for (let k = 0; k < 9; k++) K.stall(c, 6 + k * 3.8, 9.5 + (k % 2) * .6, 0, K.pick(c, [0x8a3a2c, 0x2f4a5a, 0x6a5a3a, 0x9a6a2a]));
    K.lanternString(c, [4, 6, 8], [40, 6.2, 9], [0xffb860, 0xff8a50, 0xffd890], 1.2);
    K.lanternString(c, [-40, 6, 4.5], [0, 6.4, 4.5], [0xffc070, 0xff9a60], 1);
    for (let x = -44; x <= 44; x += 11) K.lamp(c, x, 11, 0xffc890, 3.4);
    // 官署小楼与旗
    K.bld(c, 'civic', 28, -2, { w: 10, d: 7, fl: 2, ry: 0, wall: 0x8a8278, roof: 'hip', rcol: 0x3a3e44 });
    K.flag(c, 28, c.h(28, -2) + 9.5, -2, 4, 0x9a2a22);
    // 山坡：层层叠叠的木屋 + 石阶
    K.stairs(c, [-14, 2], [-14, -22], 2.4, 0x6a6258); K.stairs(c, [4, 2], [2, -26], 2.4, 0x6a6258);
    for (const [x, z, n] of [[-22, -12, 14], [-6, -16, 12], [10, -14, 10], [-30, -28, 9], [-12, -32, 10], [6, -30, 7]]) K.cluster(c, 'lantern', x, z, 9, n, { angle: 0, jit: .2, r: 2.4, where: { maxSlope: 1 } });
    // 码头与船
    for (const [x, ry] of [[-30, 0], [-6, .05], [20, -.05]]) K.pier(c, x, 12, 14, ry, { w: 2.4 });
    K.boatAt(c, -24, 22, .1, { len: 12, kind: 'steam', hull: 0x2a2a2a, stripe: 0x8a2a22, cabin: 0xd8d0c0 });
    for (let k = 0; k < 9; k++) { const x = -44 + c.r() * 88, z = 20 + c.r() * 16; K.boatAt(c, x, z, c.r() * 6, { len: 4 + c.r() * 3, kind: c.r() < .3 ? 'sail' : 'row', hull: K.pick(c, [0x3a3028, 0x2a3a3a, 0x5a3a2a]), sail: 0x8a7a64 }); if (k < 4) { B.frame(x, c.wl + .9, z); B.put('sph', 0, 0, 0, .4, .5, .4, 0xffb060, P.light); B.frame(); } }
    // 矿洞口、轨道、冶炼棚
    K.cave(c, 34, -38, 0, { s: .8 });
    c.rail([[34, -32], [26, -18], [18, -6]]);
    K.cart(c, 30, -26, -.5, 0x5a4a3a);
    K.bld(c, 'lantern', 22, -22, { w: 7, d: 5, fl: 1, ry: -.5 });
    K.chimney(c, 18, -26, 8, { r: .6, smokeCol: 0x3a3634, size: 2.4, sh: 16, n: 20, op: .4 });
    c.light(12, 6, 9, 0xffa860, 4, 22); c.light(-20, 6, 5, 0xffb070, 3, 18);
    c.people(60, { at: [10, 8, 30], cols: [0x3a3a46, 0x5a4a3a, 0x2a2a2a, 0x7a5a3a, 0x8a3a2c] });
    c.people(10, { at: [-10, -16, 18] });
    for (let k = 0; k < 24; k++) c.I.small(k % 3 ? 'crate' : 'barrel', -40 + c.r() * 80, 1.6, 4 + c.r() * 2.5, .9 + c.r() * .4, K.pick(c, [0x7a5a3c, 0x6a4a30, 0x5a4a3a]), c.r() * 6);
    c.trees(coarse(c, 240), { species: ['round', 'pine', 'cone'], cols: [0x24382a, 0x2c4030, 0x1e3024], minH: 8 });
    c.rocks(50, { above: -2, maxH: 3, cols: [0x4a4642, 0x3e3a36], big: true });
  }
};

/* ================= 汐见町：退潮的滩涂与窄商店街 ================= */
SITES['汐见町'] = {
  mode: 'closed', R: 56, seed: 'shiomi-town', time: 'dusk',
  light: { el: 5, top: 0x354260, hor: 0xc89a88, haze: 0x8a8890, sun: 0xffa880, si: 1.2, wet: .9, night: .45, exp: 1.32, hd: .004 },
  label: '示安港町 · 退潮时分', note: '潮水退到渡船码头的尽头，滩涂上有人弯腰挖贝。商店街的灯一盏盏亮起来，细雨没停过。',
  shape: { kind: 'rect', ax: 1, az: .92, wobble: .05 },
  water: { level: 0, shallow: 0x4a7a78, deep: 0x1a3440, clarity: .55, wave: .18, foam: .6 },
  strata: [0x3a3028, 0x7a6a56, 0x5e5244, 0x8a7a64, 0x4a3e34], plinth: 0x1e1814,
  palette: {
    grass: [0x4f6a3a, 0x46623a], dry: 0x6a6a44, dryK: .2, dirt: 0x5a4a3a, sand: 0x7a6a56, rock: 0x6a6660, bed: 0x4a4436, beach: .9,
    paint(x, z, h, s, col, c, out) {
      if (h < 1.1 && h > -.2) { // 滩涂：湿泥、水洼、潮沟边
        const p = c.N.n2(x * .25, z * .25);
        col.copy(lin(0x5a5040)).lerp(lin(0x7a6e5a), smooth(.2, 1, h)).lerp(lin(0x8a9aa0), smooth(.35, .6, p) * .55);
        out.roughF = p > .4 ? .08 : .3;
      }
    }
  },
  lit: .8,
  height(x, z, c) {
    const town = 3.2 + Math.max(0, 2 - z) * .05 + bump(x, z, -30, -30, 11, 7) + bump(x, z, 30, -40, 16, 5) + c.N.fbm(x * .04, z * .04, 3) * .6;
    const flat = .7 - Math.max(0, z - 3) * .032 + c.N.fbm(x * .07, z * .07, 3) * .22;
    return Math.max(lerp(town, flat, smooth(1.2, 2.8, z)), -4);
  },
  rivers: [{ pts: [[10, 4], [6, 16], [12, 28], [8, 44], [12, 60]], w: 3.4, depth: .8, bank: 1.5 }, { pts: [[-30, 6], [-26, 20], [-32, 34], [-28, 60]], w: 2.4, depth: .6, bank: 1.2 }],
  pads: [{ x: -30, z: -30, r: 4, soft: 3 }],
  roads: [{ pts: [[-56, -10], [-20, -11], [0, -9], [22, -11], [56, -10]], w: 3 }, { pts: [[18, -10], [18, 1]], w: 2.4 }],
  weather: { rain: .22, mist: [{ y: 1.6, layers: 2, gap: 1.4, op: .2, col: 0x9a929a, scale: .03, drift: .6 }], birds: { n: 6, col: 0xe8e8e8, y: 10 } },
  wind: .4,
  views: [{ label: '港町', az: 350, el: 30, d: 1 }, { label: '商店街', az: 5, el: 22, d: .36, t: [0, null, -10] }, { label: '渡船码头', az: 60, el: 20, d: .4, t: [18, null, 16] }, { label: '小神社', az: 340, el: 24, d: .3, t: [-30, null, -28] }],
  build(c) {
    const B = c.B;
    // 护岸石墙
    B.frame(0, .4, 2.2); B.box(0, -1, 0, 112, 3, 1.4, 0x7a746a, P.stone); B.frame(); c.occupy(0, 2.2, 112, 2, 0, 0);
    // 窄商店街：门脸贴着路
    K.street(c, [[-54, -10], [-20, -11], [0, -9], [22, -11], [54, -10]], 'tide', { roadW: 3, setback: .2, gap: .3, jitter: .6, fill: 1, skip: (x, z) => x > 14 && x < 22 });
    K.cluster(c, 'tide', -6, -28, 14, 12, { angle: .02, r: 2.6, where: { maxSlope: .7 } });
    K.cluster(c, 'tide', 32, -30, 12, 8, { angle: -.05, r: 2.6 });
    for (let x = -48; x <= 48; x += 12) K.lamp(c, x, -7.8, 0xffcf8a, 3.2);
    K.lanternString(c, [-20, c.h(-20, -11) + 4.2, -13.5], [6, c.h(6, -9) + 4.2, -6.5], [0xff9a5a, 0xffd08a, 0xf2f0e0], .6);
    c.light(-8, c.h(-8, -10) + 3.5, -10, 0xffb070, 3, 16); c.light(28, c.h(28, -10) + 3.5, -10, 0xffb070, 3, 16);
    // 小神社：石阶、社门、石灯笼、大树
    K.stairs(c, [-30, -18], [-30, -26], 2, 0x7a746a);
    K.shrineGate(c, -30, -17, 0, { w: 3, h: 3.4 });
    K.bld(c, 'shrine', -30, -31, { ry: 0, w: 5, d: 4, fl: 1, wall: 0x5a4232 });
    K.stoneLantern(c, -32.4, -24); K.stoneLantern(c, -27.6, -24);
    c.I.tree('broad', -34.5, c.h(-34.5, -30), -30, 1.6, lin(0x2e4a2e), 0x4a3828, 1);
    c.light(-30, c.h(-30, -24) + 2, -23, 0xffc080, 2, 10);
    // 渡船码头：栈桥伸过滩涂
    K.pier(c, 18, 2, 30, 0, { w: 2.4, up: 1.2 });
    K.boatAt(c, 21, 34, 0, { len: 11, kind: 'steam', hull: 0x2f3a40, stripe: 0xd8d0c0, cabin: 0xe8e0d0 });
    B.frame(18, c.wl + 1.2, 31); B.box(0, 0, 0, 3.2, 2.4, 2.4, 0x6a5444, P.wood); B.put('gable', 0, 2.4, 0, 3.2, 1, 2.6, 0x3e454a, P.tile); B.frame();
    // 搁浅的小渔船、晾网架
    for (let k = 0; k < 7; k++) { const x = -48 + c.r() * 60, z = 8 + c.r() * 12; if (Math.abs(x - 18) < 4) continue; boat(B, x, c.h(x, z) + .25, z, c.r() * 6, { len: 4 + c.r() * 2.5, hull: K.pick(c, [0x4a3a2c, 0x3a4a4a, 0x6a5a48]) }); }
    for (const x of [-44, -38, 34, 40]) { const y = c.h(x, 5); B.frame(x, y, 5); for (const s of [-1, 1]) B.box(s * 2, 0, 0, .14, 2.2, .14, 0x4a3a2c, P.wood); B.box(0, 1, 0, 4, 1.2, .05, 0x5a5a4a, P.cloth); B.frame(); }
    // 挖贝的人、码头上的人
    c.people(22, { rect: [-50, 6, 100, 22], above: .05, cols: [0x3a3a46, 0x5a4a3a, 0x7a6a50, 0x2a3a4a] });
    c.people(30, { at: [0, -10, 34], cols: [0x3a3a46, 0x5a4a3a, 0x2a2a2a, 0xd8d0c0, 0x8a3a2c] });
    c.trees(coarse(c, 150), { species: ['round', 'cone', 'column'], cols: [0x2e4a2e, 0x35532f, 0x2a422a], minH: 4 });
    c.grass(coarse(c, 1200), { cols: [0x5a6a3a, 0x4f6a3a], minH: 2.5 });
  }
};

/* ================= 南岸乡社：花节里的海边村子 ================= */
SITES['南岸乡社'] = {
  mode: 'closed', R: 58, seed: 'nanan-commune', time: 'morning',
  light: { el: 40, si: 3.4, haze: 0xd6e2ea, hd: .0016 },
  label: '布图里亚南岸 · 花节', note: '花节这天，广场中央立起花柱，摊子沿路摆到海边。花冠要等傍晚才戴上，现在先忙着搭台、挂彩旗。',
  shape: { kind: 'circle', wobble: .08 },
  water: { level: 0, shallow: 0x46b0a8, deep: 0x125a78, clarity: .35, wave: .4, foam: 1.3 },
  strata: [0x4a3a2c, 0xc8b08a, 0xa8906c, 0xdcc8a0, 0x806c56], plinth: 0x30261c,
  palette: {
    grass: [0x7aa44c, 0x6a9a46], dry: 0xb8b06a, dryK: .3, dirt: 0x8a7458, sand: 0xe8d8ac, rock: 0x9a9080, bed: 0xb0a47a, beach: 2.2,
    paint(x, z, h, s, col, c) {
      if (x > 16 && z < -6 && s < .25 && !c.nearRoad(x, z, 2)) fields(col, x, z, .3, 8, 6, [0x8aa84a, 0xc8b45a, 0x6a9440, 0xa8b850], .8);
      else if (x < -8 && h > 1.6) { const f = c.N.n2(x * .12, z * .12); col.lerp(lin(f > .2 ? 0xd890a8 : f < -.2 ? 0xe8d070 : 0xf0eee6), smooth(.05, .5, Math.abs(f)) * .5); }
    }
  },
  height(x, z, c) {
    const coast = 26 + 5 * Math.sin(x * .06) + c.N.fbm(x * .03, z * .03, 3) * 4 - z;
    if (coast < 0) return Math.max(coast * .4, -7);
    return .5 + coast * .1 + bump(x, z, 30, -34, 18, 7) + c.N.fbm(x * .04, z * .04, 3) * 1.2 * smooth(4, 14, coast);
  },
  rivers: [{ pts: [[-30, -60], [-22, -36], [-16, -16], [-14, 4], [-10, 30]], w: 3.2, depth: 1, bank: 1 }],
  pads: [{ x: 2, z: -2, r: 9, soft: 4 }],
  roads: [{ pts: [[11, -2], [30, -6], [56, -10]], w: 3.2 }, { pts: [[2, -11], [4, -30], [0, -58]], w: 3 }, { pts: [[2, 7], [4, 16], [6, 24]], w: 3 }],
  weather: { petals: { cols: [0xf2a8c0, 0xffffff, 0xf2d870, 0xe87a8a], n: 700, rad: 40 }, birds: { n: 10, col: 0xf4f4f4, y: 16 } },
  wind: .6,
  views: [{ label: '乡社', az: 10, el: 36, d: 1 }, { label: '花柱广场', az: 20, el: 26, d: .34, t: [2, null, -2] }, { label: '海滩', az: 330, el: 20, d: .4, t: [0, null, 24] }, { label: '花田', az: 290, el: 26, d: .42, t: [-30, null, -10] }],
  build(c) {
    const B = c.B, y0 = c.h(2, -2);
    // 花柱：彩带 + 花冠
    B.frame(2, y0, -2); B.put('cyl8', 0, 0, 0, .35, 11, .35, 0xf2ece0, P.paint); B.put('cyl16', 0, 9.4, 0, 2.6, .5, 2.6, 0xe87a8a, P.leaf); B.put('cyl16', 0, 9.9, 0, 2, .4, 2, 0xf2d870, P.leaf); B.put('sph', 0, 11, 0, .7, .7, .7, 0xf2a8c0, P.cloth); B.frame();
    const ribbons = [0xe87a8a, 0xf2d870, 0x5a9ad8, 0xffffff, 0x8ac06a, 0xd8a0d8];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, [x, z] = pol(2, -2, 8, a); K.bunting(c, [2, y0 + 10.5, -2], [x, c.h(x, z) + 2.4, z], [ribbons[k], 0xffffff], .6); B.frame(x, c.h(x, z), z); B.put('cyl8', 0, 0, 0, .12, 2.6, .12, 0x7a5a3c, P.wood); B.frame(); }
    c.occupy(2, -2, 2, 2);
    // 摊子沿两条路
    for (let k = 0; k < 7; k++) K.stall(c, 14 + k * 4.4, -9.5 + k * -.35, -.2, K.pick(c, [0xe87a8a, 0xf2d870, 0x5a9ad8, 0xf6f0e6, 0x8ac06a]));
    for (let k = 0; k < 4; k++) K.stall(c, 7.5, 8 + k * 4, Math.PI / 2, K.pick(c, [0xe87a8a, 0xf2d870, 0x5a9ad8]));
    // 小台子
    { const x = -6, z = -10, y = c.ground(x, z, 7, 5); B.frame(x, y, z, .4); B.box(0, 0, 0, 7, 1, 5, 0x8a6a48, P.wood); for (const [a, b] of [[-3.3, -2.3], [3.3, -2.3]]) B.box(a, 1, b, .2, 3.6, .2, 0x6a5038, P.wood); B.box(0, 4.4, -2.3, 7, .8, .1, 0xf2ece0, P.cloth); B.frame(); c.occupy(x, z, 8, 6, .4); }
    // 村舍
    K.street(c, [[11, -2], [30, -6], [52, -9]], 'festival', { roadW: 3.2, start: 16, fill: .8 });
    K.street(c, [[2, -12], [4, -30], [0, -52]], 'festival', { roadW: 3 });
    K.cluster(c, 'festival', 18, 10, 10, 8, { angle: .2 });
    K.cluster(c, 'festival', -4, -24, 9, 5, { angle: -.1 });
    K.windmill(c, 32, -34, { ry: 2.4 });
    // 沿岸：拉上岸的渔船、小码头
    for (let k = 0; k < 6; k++) { const x = -30 + k * 9 + c.r() * 3, z = 22 + c.r() * 3; boat(B, x, c.h(x, z) + .3, z, Math.PI / 2 + (c.r() - .5) * .6, { len: 4.5 + c.r() * 2, hull: K.pick(c, [0x2f6a9a, 0xd84a3a, 0xf2ece0, 0x3a8a5a]) }); }
    K.pier(c, 24, 26, 12, .2, { w: 2.2 });
    for (let k = 0; k < 4; k++) K.boatAt(c, 18 + c.r() * 24, 38 + c.r() * 8, c.r() * 6, { len: 5, kind: k % 2 ? 'sail' : 'row', hull: 0x2f6a9a, sail: 0xf6f0e6 });
    // 水渠上的小桥
    K.bridge(c, [-19, -12], [-11, -12], { w: 2.4, span: 8, y: c.h(-19, -12) + .3, col: 0xb8ac94 });
    c.people(90, { at: [6, -2, 16], cols: [0xe87a8a, 0xf6f0e6, 0x5a9ad8, 0xf2d870, 0x3a4a6a, 0x8a5a3a] });
    c.people(16, { at: [0, 22, 20], above: .3 });
    c.animals('cow', 6, { at: [36, -18, 8], cols: [0x8a5a3a, 0xe8e0d0] });
    c.trees(coarse(c, 160), { species: ['round', 'broad', 'palm'], cols: [0x5a8a3a, 0x6a9a44, 0x4a7a34], minH: 2 });
    c.grass(coarse(c, 4200), { cols: [0x7aa44c, 0x8ab456], flowers: [0xf2a8c0, 0xffffff, 0xf2d870, 0xe87a8a, 0xb88ad8], flowerK: .45, rect: [-58, -58, 52, 90], minH: 1.6 });
    c.grass(coarse(c, 1600), { cols: [0x7aa44c, 0x8ab456], flowers: [0xffffff, 0xf2d870], flowerK: .1, minH: 1.6 });
  }
};

/* ================= 黑岩路矿区：煤谷与铁路 ================= */
const S2 = Math.SQRT1_2, UV = (u, v) => [(u + v) * S2, (v - u) * S2];
SITES['黑岩路矿区'] = {
  mode: 'closed', R: 62, seed: 'heiyan-coal', time: 'overcast',
  light: { top: 0x7a7e84, hor: 0xa8a29a, haze: 0x8c8780, gnd: 0x4a4642, hd: .0062, exp: 1.04 },
  label: '坎普内陆 · 煤谷与铁路', note: '井架、机厂、车站挤在一条山谷里。运煤车一天三趟开往河港，山坡上一排排工房的屋檐都落着一层黑灰。',
  shape: { kind: 'rect', ax: 1, az: 1, rot: 45, wobble: .06 },
  water: { level: 0, shallow: 0x4a4a3c, deep: 0x1e1e18, clarity: .75, wave: .15, foam: .4 },
  strata: [0x1e1a18, 0x4a4038, 0x2c2622, 0x5e544a, 0x2a2420], plinth: 0x141210,
  palette: {
    grass: [0x5a6a42, 0x4e5e3c], dry: 0x7a7450, dryK: .35, dirt: 0x3a3430, rock: 0x5a5650, sand: 0x5a5448, bed: 0x2e2a26,
    paint(x, z, h, s, col) { const v = Math.abs((x + z) * S2); col.lerp(lin(0x2e2a28), smooth(16, 6, v) * .7); }
  },
  wet: .3,
  height(x, z, c) {
    const u = (x - z) * S2, v = (x + z) * S2, av = Math.abs(v);
    return Math.min(36, 2.6 + Math.pow(Math.max(0, av - 6) / 10, 1.6) * 4.2) + c.N.ridge(x * .03, z * .03, 4) * 7 * smooth(12, 30, av) + c.N.fbm(x * .05, z * .05, 3) * 1.2 + u * .02;
  },
  rivers: [{ pts: [UV(-90, -4), UV(-40, -3), UV(0, -5), UV(40, -3), UV(90, -4)], w: 3.6, depth: 1.6, bank: 1.2 }],
  pads: [{ x: UV(-24, 13)[0], z: UV(-24, 13)[1], r: 7, soft: 4 }, { x: UV(30, 13)[0], z: UV(30, 13)[1], r: 7, soft: 4 }, { x: UV(6, 3)[0], z: UV(6, 3)[1], w: 26, d: 6, ry: -Math.PI / 4, soft: 3 }, { x: UV(-4, -15)[0], z: UV(-4, -15)[1], w: 30, d: 14, ry: -Math.PI / 4, soft: 4 }],
  roads: [
    { pts: [UV(-90, 4), UV(-40, 4), UV(0, 3.5), UV(40, 4), UV(90, 4)], w: 4 },
    { pts: [UV(-70, 22), UV(-30, 21), UV(10, 22), UV(60, 23)], w: 3 }, { pts: [UV(-60, -22), UV(-20, -24), UV(30, -23)], w: 3 }
  ],
  weather: { motes: { kind: 'dust', n: 380, cols: [0x3a3634, 0x5a5652], size: .22, op: .45, h: 16, rad: 50 }, birds: { n: 6, col: 0x1a1a1a, y: 30 } },
  fog: { y: 2, h: 8, d: .012, col: 0x8a857e },
  wind: .4,
  views: [{ label: '山谷', az: 28, el: 40, d: 1 }, { label: '井架', az: 15, el: 26, d: .36, t: [UV(-24, 13)[0], null, UV(-24, 13)[1]] }, { label: '车站', az: 55, el: 26, d: .34, t: [UV(6, 3)[0], null, UV(6, 3)[1]] }, { label: '工房坡', az: 235, el: 30, d: .4, t: [UV(-10, 22)[0], null, UV(-10, 22)[1]] }],
  build(c) {
    const B = c.B, RY = Math.PI / 4;
    // 铁路与运煤车
    const railPts = [UV(-90, 4), UV(-40, 4), UV(0, 3.5), UV(40, 4), UV(90, 4)];
    c.rail(railPts);
    K.train(c, railPts, .18, 8, { open: true, cargo: 0x1e1c1a, cars: [0x3a2e26, 0x4a3a30], loco: 0x2a2e2a });
    // 车站：月台 + 站房
    { const [x, z] = UV(6, 7.4), y = c.ground(x, z, 22, 3, RY); B.frame(x, y, z, RY); B.box(0, -1, 0, 22, 1.8, 3, 0x7a7068, P.concrete); for (let k = -9; k <= 9; k += 4.5) B.box(k, .8, 0, .2, 3, .2, 0x3a3634, P.iron); B.put('shed', 0, 3.8, 0, 3.4, .5, 22, 0x4a4440, P.metal, [0, Math.PI / 2, 0]); B.frame(); c.occupy(x, z, 22, 3, RY); }
    { const [x, z] = UV(6, 11.5); K.bld(c, 'coal', x, z, { ry: RY + Math.PI, w: 12, d: 5.5, fl: 2, wall: 0x8a6a52 }); }
    // 两座井架、机房、煤堆
    for (const [u, v] of [[-24, 13], [30, 13]]) { const [x, z] = UV(u, v); K.headframe(c, x, z, RY + Math.PI, { h: 16 }); const [hx, hz] = UV(u + 9, v + 3); K.heap(c, hx, hz, 5, 6, 0x1e1c1a); const [cx, cz] = UV(u - 6, v + 5); K.chimney(c, cx, cz, 13, { r: .9, smokeCol: 0x3a3634, size: 4, sh: 26, n: 34, op: .55 }); }
    { const [x, z] = UV(48, -14); K.heap(c, x, z, 8, 9, 0x2a2624); }
    // 机厂
    { const [x, z] = UV(-4, -15); K.factory(c, x, z, RY + Math.PI / 2, { w: 12, len: 26, h: 6, wall: 0x7a5442, roof: 0x3a3634, chimneys: [[3, -10, 14]], chim: { smokeCol: 0x3a3634, size: 4, sh: 24, op: .5 } }); }
    // 工房：两坡各一排
    K.street(c, [UV(-60, 22), UV(-30, 21), UV(10, 22), UV(56, 23)], 'coal', { roadW: 3, setback: .5, gap: 1.5, maxSlope: 1.2, fill: .85, skip: (x, z) => Math.abs((x - z) * S2 + 24) < 9 || Math.abs((x - z) * S2 - 30) < 9 });
    K.street(c, [UV(-56, -22), UV(-20, -24), UV(28, -23)], 'coal', { roadW: 3, setback: .5, gap: 1.5, maxSlope: 1.2, fill: .8, skip: (x, z) => Math.abs((x - z) * S2 + 4) < 18 });
    // 夜校与合作社：同一栋两层砖房，门口挂红布
    { const [x, z] = UV(-40, -10); K.bld(c, 'coal', x, z, { ry: RY, w: 13, d: 6, fl: 2, wall: 0x9a6a50 }); const [bx, bz] = UV(-40, -6.4); K.banner(c, bx, bz, 3.4, 0x9a2a22, RY); }
    // 小桥
    { const a = UV(14, -8), b = UV(14, 1); K.bridge(c, a, b, { w: 3, span: 9, col: 0x6a645c }); }
    K.poles(c, [UV(-80, 8), UV(-20, 8.5), UV(40, 8.5), UV(80, 8)], { step: 16 });
    c.people(46, { rect: [-50, -50, 100, 100], cols: [0x2a2826, 0x3a3634, 0x4a4038, 0x5a5048], maxSlope: .4 });
    c.trees(coarse(c, 260), { species: ['round', 'birch', 'bare', 'pine'], cols: [0x3e4a32, 0x4a5638, 0x56603e], area: (x, z) => smooth(18, 30, Math.abs((x + z) * S2)), maxSlope: 1.3 });
    c.rocks(60, { cols: [0x2e2a28, 0x4a4642], s: [.5, 1.6] });
    c.grass(coarse(c, 1400), { cols: [0x5a6a42, 0x4e5e3c, 0x6a6a48], area: (x, z) => smooth(14, 26, Math.abs((x + z) * S2)) });
  }
};

/* ================= 河港救济所：货栈改成的病房 ================= */
SITES['河港救济所'] = {
  mode: 'closed', R: 46, seed: 'hegang-refuge', time: 'dusk',
  light: { el: 6, top: 0x34405e, hor: 0xe0a070, haze: 0xb0907a, sun: 0xffa060, si: 1.6, hd: .005, exp: 1.14, bloom: .5, night: .5 },
  label: '罗歇阿普河港 · 救济所', note: '旧货栈只剩一层，屋顶塌了半边，正好让人看见里面三排床。门口的木板上贴着收支账，码头上的人卸完货会顺手搬几袋米进来。',
  shape: { kind: 'rect', ax: 1, az: .85, wobble: .05 },
  water: { level: 0, shallow: 0x5a6a48, deep: 0x22301e, clarity: .7, wave: .2, foam: .5 },
  strata: [0x3a2c20, 0x8a6a4a, 0x6a523a, 0x9a7a58, 0x4a3828], plinth: 0x22180e,
  palette: { grass: [0x4a7a34, 0x3e6a30], dry: 0x7a7a42, dryK: .25, dirt: 0x6a5038, sand: 0x8a7458, rock: 0x6a6052, bed: 0x4a4430, mud: 0x3a3226 },
  wet: .45, lit: .9,
  glow: { p: [0, 4, 10], c: 0xffa860, i: .9 },
  height(x, z, c) {
    const bank = 12 + 3 * Math.sin(x * .07) + c.N.fbm(x * .04, z * .04, 2) * 2 - z;
    if (bank < 0) return Math.max(bank * .5, -5);
    return 1.4 + bank * .045 + c.N.fbm(x * .05, z * .05, 3) * .5 + bump(x, z, -30, -30, 14, 3);
  },
  pads: [{ x: 0, z: -4, w: 30, d: 15, ry: 0, soft: 3 }, { x: 0, z: 9, w: 70, d: 5, ry: 0, y: 1.6, soft: 2 }],
  roads: [{ pts: [[-46, 7], [0, 7], [46, 7]], w: 3.4 }, { pts: [[0, 3], [0, -30], [-6, -46]], w: 2.6 }],
  weather: { motes: { kind: 'firefly', n: 320, cols: [0xd8ff8a, 0xfff2a0], size: .26, h: 6, speed: .2, y: 1.5, rad: 40 }, mist: [{ y: .8, layers: 2, gap: .8, op: .5, col: 0xd8b8a0, scale: .04, drift: .3 }] },
  fog: { y: 1, h: 4, d: .012, col: 0xa08a7a },
  wind: .2,
  views: [{ label: '河港', az: 10, el: 34, d: 1 }, { label: '病房', az: 20, el: 48, d: .3, t: [-3, null, -4] }, { label: '码头', az: 330, el: 18, d: .36, t: [0, null, 12] }, { label: '公示板', az: 20, el: 18, d: .2, t: [12, null, 4] }],
  build(c) {
    const B = c.B, y = c.ground(0, -4, 28, 13), W = 28, D = 13, H = 4.2;
    // 货栈外壳：后墙和两端满高，前墙只剩齐腰，东段留着屋顶
    B.frame(0, y, -4, 0, [2.6, H, W / 2, D / 2]);
    B.box(0, -2, 0, W + .6, 2.3, D + .6, 0x7a6e60, P.stone);
    B.box(0, .3, -D / 2 + .25, W, H, .5, 0x8a5a44, P.brick, 0, true);
    for (const s of [-1, 1]) B.box(s * (W / 2 - .25), .3, 0, .5, H, D, 0x8a5a44, P.brick, 0, true);
    B.box(-5, .3, D / 2 - .25, W - 10, 1.4, .5, 0x8a5a44, P.brick); B.box(W / 2 - 3, .3, D / 2 - .25, 5, H, .5, 0x8a5a44, P.brick, 0, true);
    B.box(4, .3, D / 2 - .25, 3, H, .5, 0x8a5a44, P.brick); B.box(0, .3, 0, W - .4, .12, D - .4, 0x8a7458, P.wood);
    B.put('gable', W / 2 - 4.5, H + .3, 0, D + 1, 3, 9, 0x8a5a3a, P.metal, [0, Math.PI / 2, 0]);
    for (let k = -W / 2 + 2; k < W / 2 - 9; k += 3) { B.box(k, H + .3, 0, .25, .25, D, 0x5a4232, P.wood); B.put('box', k, H + 1.8, -D / 4, .2, .2, Math.hypot(D / 2, 3), 0x5a4232, P.wood, [-.43, 0, 0]); B.put('box', k, H + 1.8, D / 4, .2, .2, Math.hypot(D / 2, 3), 0x5a4232, P.wood, [.43, 0, 0]); }
    // 三排床，共三十张
    const blankets = [0x9a4a3a, 0x4a6a8a, 0xd8ccb0, 0x6a7a4a, 0x8a6a3a];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 10; k++) {
      const bx = -W / 2 + 2 + k * 2.3, bz = -D / 2 + 2.2 + row * 4.2;
      B.box(bx, .42, bz, .95, .42, 2, 0x5a4232, P.wood); B.box(bx, .84, bz + .1, .9, .16, 1.8, K.pick(c, blankets), P.cloth); B.box(bx, .84, bz - .75, .7, .2, .35, 0xf2ece0, P.cloth);
    }
    B.box(W / 2 - 4, .42, -3, 2.4, .9, 1.2, 0x6a5038, P.wood); B.put('cyl8', W / 2 - 2, .42, 2, .9, 1.2, .9, 0x2a2624, P.iron);
    B.put('cyl8', W / 2 - 2, 1.6, 2, .3, 5, .3, 0x2a2624, P.iron);
    for (const lx of [-9, -1, 7]) B.put('sph', lx, H - .3, 0, .4, .5, .4, 0xffc070, P.light);
    B.frame(); c.occupy(0, -4, W + 1, D + 1);
    c.fx.smoke(W / 2 - 2, y + 7, -2, { col: 0xc8bcb0, size: 1, h: 8, n: 14, op: .4 });
    c.light(-5, y + H, -4, 0xffb468, 3, 16); c.light(6, y + H, -4, 0xffb468, 2.4, 12);
    for (let k = 0; k < 7; k++) { const px = -W / 2 + 3 + c.r() * (W - 6), pz = -4 + (c.r() - .5) * 8; c.I.small('person', px, y + .42, pz, 1, K.pick(c, [0xf2ece0, 0x3a4a6a, 0x7a5a3a]), c.r() * 6); }
    // 公示板
    B.frame(12, c.h(12, 4), 4, 0); for (const s of [-1, 1]) B.box(s * 1.2, 0, 0, .15, 2.4, .15, 0x4a3828, P.wood); B.box(0, 1, 0, 2.8, 1.4, .1, 0x7a6450, P.wood); for (let k = 0; k < 5; k++) B.box(-1 + k * .5, 1.2 + (k % 2) * .4, .07, .4, .5, .02, 0xf2ead8, P.paint); B.frame();
    K.lamp(c, 10, 5, 0xffc890, 3);
    // 码头：木栈台、货堆、船
    B.frame(0, c.wl + .9, 13); B.box(0, 0, 0, 60, .3, 4, 0x6a5444, P.wood); for (let k = -28; k <= 28; k += 4) for (const s of [-1.8, 1.8]) B.put('cyl8', k, -5, s, .3, 5.2, .3, 0x3a2c20, P.wood); B.frame();
    for (let k = 0; k < 26; k++) c.I.small(k % 3 ? 'crate' : 'barrel', -24 + c.r() * 48, c.wl + 1.2, 11.6 + c.r() * 2.6, .8 + c.r() * .4, K.pick(c, [0x7a5a3c, 0x6a4a30, 0xd8c8a0]), c.r() * 6);
    K.boatAt(c, -14, 20, Math.PI / 2, { len: 14, kind: 'steam', hull: 0x2a2a2a, stripe: 0xb04030, cabin: 0xe8dcc8 });
    for (let k = 0; k < 5; k++) K.boatAt(c, 8 + c.r() * 30, 18 + c.r() * 14, c.r() * 6, { len: 4 + c.r() * 2, hull: K.pick(c, [0x4a3a2c, 0x3a3a2a]) });
    K.lanternString(c, [-28, c.wl + 4.4, 11], [28, c.wl + 4.4, 11], [0xffb060, 0xffd890], 1);
    // 周围的河港房子与林子
    for (const [x, z, ry] of [[-26, -6, .1], [24, -16, -.2], [-22, -24, .3], [28, -2, 0], [12, -30, .2]]) K.bld(c, 'colonial', x, z, { ry, fl: K.pick(c, [1, 2]) });
    K.bld(c, 'lantern', -12, -20, { ry: .1, fl: 2 }); K.bld(c, 'lantern', 14, -18, { ry: -.1, fl: 2 });
    c.people(30, { at: [0, 8, 26], cols: [0x3a3028, 0x5a4a3a, 0xd8ccb0, 0x2a2a2a, 0x7a5a3a] });
    c.people(10, { at: [0, -14, 10] });
    c.trees(coarse(c, 220), { species: ['palm', 'broad', 'broad', 'round'], cols: [0x2e5a2a, 0x3a6a30, 0x2a4a26], k: 1.15, minH: 1.8 });
    c.trees(coarse(c, 80), { species: ['reed'], cols: [0x6a8a3a, 0x8a9a4a], maxH: 1.9, above: -.2 });
    c.grass(coarse(c, 1600), { cols: [0x4a7a34, 0x5a8a3a], minH: 1.6 });
  }
};

/* ================= 河湾乡社：秋收的河湾 ================= */
const HW_RIVER = [[-70, -24], [-46, -36], [-20, -38], [4, -26], [10, -6], [-4, 12], [-10, 32], [6, 52], [36, 60], [70, 52]];
SITES['河湾乡社'] = {
  mode: 'closed', R: 62, seed: 'hewan-bend', time: 'golden',
  light: { el: 13, haze: 0xf0cc98, hd: .0026 },
  label: '霁川东部 · 秋收的河湾', note: '河湾里的稻子割了一半，晒场上在打谷。水车还在转，村塾门口的孩子放了学，就往田里跑。',
  shape: { kind: 'circle', wobble: .07 },
  water: { level: 0, shallow: 0x5a8a7a, deep: 0x1e4450, clarity: .5, wave: .2, foam: .6 },
  strata: [0x4a3a28, 0xb89a6a, 0x9a7e56, 0xccb084, 0x7a6448], plinth: 0x2a2014,
  palette: {
    grass: [0x7a9444, 0x6a8a40], dry: 0xb8a460, dryK: .4, dirt: 0x8a7050, sand: 0xc8b088, rock: 0x8a8070, bed: 0x6a6448,
    paint(x, z, h, s, col, c, out) {
      if (s < .14 && h < 4.2 && h > 1.3 && !c.nearRoad(x, z, 1.5) && !c.nearRiver(x, z, 3) && Math.hypot(x - 26, z - 8) > 9 && Math.hypot(x - 32, z + 22) > 13) {
        const f = fields(col, x, z, .2, 7, 5, [0xd8b04a, 0xe0bc54, 0xc8a040, 0xb89a5a, 0x9a8a5a], .9, .14);
        if (f.h > .82 && !f.edge) { col.lerp(lin(0x6a7a6a), .55); out.roughF = .12; } // 还没放干的水田
      }
      if (Math.hypot(x - 26, z - 8) < 8) col.lerp(lin(0xc8ac80), smooth(8, 6, Math.hypot(x - 26, z - 8))); // 晒场
    }
  },
  height(x, z, c) {
    let h = 2.6 + c.N.fbm(x * .03, z * .03, 3) * .5;
    const hill = bump(x, z, 44, -34, 22, 14) + bump(x, z, -44, 30, 18, 9);
    h += hill > 1 ? terrace(hill, 2.2, .75) : hill;
    return h;
  },
  rivers: [{ pts: HW_RIVER, w: 9, depth: 2.2, bank: 4 }],
  pads: [{ x: 26, z: 8, r: 7, soft: 3 }, { x: 32, z: -22, r: 10, soft: 5 }],
  roads: [{ pts: [[60, 10], [36, 8], [26, 8], [22, -10], [32, -22], [44, -50]], w: 3 }, { pts: [[26, 8], [16, 24], [20, 50]], w: 2.4 }],
  weather: { motes: { kind: 'dust', n: 320, cols: [0xffe2a0, 0xf0d080], size: .2, op: .45, h: 8, rad: 20, y: 1 }, birds: { n: 14, col: 0xf6f4ee, y: 10 } },
  wind: .5,
  views: [{ label: '河湾', az: 20, el: 38, d: 1 }, { label: '晒场', az: 50, el: 26, d: .32, t: [26, null, 8] }, { label: '水车', az: 270, el: 20, d: .3, t: [14, null, -6] }, { label: '村塾', az: 20, el: 24, d: .34, t: [32, null, -22] }],
  build(c) {
    const B = c.B;
    // 晒场：谷堆、草垛、打谷的人
    for (let k = 0; k < 7; k++) { const [x, z] = pol(26, 8, 5 + c.r() * 1.5, k / 7 * Math.PI * 2); K.hay(c, x, z, K.pick(c, [0xd8b25a, 0xc8a24a, 0xe0c068])); }
    for (let k = 0; k < 4; k++) { const [x, z] = pol(26, 8, 1.8, k * 1.6); B.frame(x, c.h(x, z), z); B.put('cone12', 0, 0, 0, 1.6, .7, 1.6, 0xe8c66a, P.thatch); B.frame(); }
    c.people(16, { at: [26, 8, 6], free: false, cols: [0x3a4a6a, 0x6a5a3a, 0xd8ccb0, 0x8a3a2c] });
    K.cart(c, 32, 12, .6, 0x7a5a3c); c.animals('cow', 2, { at: [33, 14, 3], cols: [0x6a5040] });
    // 水车
    K.waterwheel(c, 12.5, -6, 0); K.bld(c, 'paddy', 18, -6, { w: 5, d: 4, fl: 1, ry: Math.PI / 2 });
    // 村子
    K.cluster(c, 'paddy', 40, 22, 12, 12, { angle: .15 });
    K.cluster(c, 'paddy', 20, 36, 9, 6, { angle: .3 });
    K.cluster(c, 'paddy', -30, -14, 8, 5, { angle: -.3 });
    // 村塾：一字长屋 + 旗杆 + 院子
    K.bld(c, 'paddy', 32, -24, { w: 12, d: 6, fl: 1, ry: .1, wall: 0xd6c3a0, roof: 'hip', rcol: 0x5a5f63 });
    K.flag(c, 32, c.h(32, -17), -17, 6, 0x2f5a8a);
    K.fence(c, [[24, -16], [40, -16], [40, -30], [24, -30], [24, -16]], { col: 0x8a6a48 });
    c.people(12, { at: [32, -18, 5], free: false, cols: [0x3a4a6a, 0xd8ccb0, 0xb03a2c] });
    // 小集
    for (let k = 0; k < 5; k++) K.stall(c, 38 + k * 3.6, 6 + (k % 2), 0, K.pick(c, [0xc8a050, 0x8a3a2c, 0x3a5a6a]));
    // 河边：渡船、柳树、芦苇
    K.pier(c, -2, 4, 6, -1.2, { w: 1.8 });
    for (let k = 0; k < 3; k++) K.boatAt(c, [-10, 2, 22][k], [0, -30, 56][k], c.r() * 6, { len: 4.5, hull: 0x5a4636 });
    c.trees(coarse(c, 70), { species: ['willow'], cols: [0x8aa04a, 0x9aae58], k: 1.1, area: (x, z) => c.nearRiver(x, z, 9) ? 1 : 0, river: true, riverPad: 1 });
    c.trees(coarse(c, 90), { species: ['reed'], cols: [0xb8a860, 0xa89850], maxH: 2, above: 0, area: (x, z) => c.nearRiver(x, z, 4) ? 1 : 0, river: false });
    c.trees(coarse(c, 160), { species: ['round', 'broad', 'bamboo'], cols: [0x5a7a34, 0x6a8a3a, 0x8a8a3a, 0xa88a3a], minH: 4 });
    c.people(26, { rect: [-50, -50, 100, 100], cols: [0x3a4a6a, 0x6a5a3a, 0xd8ccb0], maxSlope: .2 });
    c.grass(coarse(c, 2000), { cols: [0xc8a84a, 0xb89a44, 0x9aa04a], k: .9 });
  }
};

/* ================= 南境工矿区：雪夜里的井架与营房 ================= */
SITES['南境工矿区'] = {
  mode: 'closed', R: 62, seed: 'nanjing-mines', time: 'dusk',
  light: { el: 3, sun: 0xff9a68, si: 1.4, top: 0x28324e, hor: 0xb89088, haze: 0x8a8696, gnd: 0x34343c, hd: .0045, exp: 1.2, night: .7 },
  water: false,
  label: '卡法里扬南缘 · 工矿区', note: '傍晚换班，雪又下起来了。井架的灯先亮，营房一排排的窗子跟着亮，探照灯从岗楼上来回扫过围栏。',
  shape: { kind: 'hex', rot: 15, wobble: .06 },
  strata: [0x2a2a2e, 0x5a5650, 0x46423e, 0x6e6a62, 0x34322e], plinth: 0x16161a,
  snow: .75, lit: .95,
  palette: { grass: [0x5a5e4a, 0x4e5446], dry: 0x6a6650, dryK: .3, dirt: 0x4a4038, rock: 0x5a5852 },
  height(x, z, c) {
    return 5 + bump(x, z, -6, -46, 34, 16) + c.N.ridge(x * .03, z * .03, 4) * 6 * smooth(20, 44, Math.hypot(x, z + 30)) + c.N.fbm(x * .04, z * .04, 3) * 1.4;
  },
  pads: [{ x: -20, z: -12, r: 7, soft: 4 }, { x: 16, z: -20, r: 7, soft: 4 }, { x: 0, z: 30, w: 56, d: 26, ry: 0, soft: 4 }, { x: -2, z: 8, w: 90, d: 4, ry: 0, soft: 3 }],
  roads: [{ pts: [[0, 17], [0, 10], [-4, -2], [-20, -12]], w: 3 }, { pts: [[-4, -2], [16, -20]], w: 3 }],
  weather: { snow: .55, birds: false },
  wind: .8,
  views: [{ label: '矿区', az: 10, el: 34, d: 1 }, { label: '井架', az: 330, el: 22, d: .36, t: [-2, null, -16] }, { label: '营房', az: 20, el: 30, d: .38, t: [0, null, 30] }, { label: '选矿场', az: 300, el: 22, d: .34, t: [-6, null, -36] }],
  build(c) {
    const B = c.B;
    // 井架两座
    K.headframe(c, -20, -12, .2, { h: 16, col: 0x2a2826, house: 0x5a4a40 });
    K.headframe(c, 16, -20, -.3, { h: 14, col: 0x2a2826, house: 0x5a4a40 });
    for (const [x, z] of [[-20, -12], [16, -20]]) { const y = c.h(x, z); B.frame(x, y + 16.4, z); B.put('sph', 0, 0, 0, .5, .5, .5, 0xffd8a0, P.light); B.frame(); }
    // 选矿场：三级台阶式厂房顺坡而下
    for (let k = 0; k < 3; k++) { const x = -6 + k * 1, z = -40 + k * 8, y = c.ground(x, z, 18, 8); B.frame(x, y, z, 0, [2.4, 3.2, 9, 4]); B.box(0, -3, 0, 18, 3 + 6 - k, 8, 0x6a5a4a, P.wood, 0, true); B.put('shed', 0, 6 - k, 0, 8.4, 2.4, 18.4, 0x3a3d42, P.metal, [0, Math.PI / 2, 0]); B.frame(); c.occupy(x, z, 18, 8); }
    K.conveyor(c, [-20, c.h(-20, -12) + 10, -14], [-8, c.h(-6, -40) + 9, -38], { col: 0x4a4440 });
    K.heap(c, 8, -38, 6, 7, 0x6a4a3a);
    K.chimney(c, -14, -34, 14, { r: 1, col: 0x5a4034, smokeCol: 0x4a4646, size: 4, sh: 26, n: 32, op: .5 });
    // 运矿窄轨与矿车
    const rail = [[-62, 8], [-30, 8], [0, 8], [30, 8], [62, 8]];
    c.rail(rail, { bed: 0x4a4440 });
    K.train(c, rail, .35, 7, { open: true, cargo: 0x8a5a44, cars: [0x3a3634], loco: 0x2a2e30 });
    // 营房：四排长屋，围栏，岗楼与探照灯
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) K.bld(c, 'barrack', -17 + j * 33, 22 + i * 6.4, { ry: 0, w: 22, d: 5, fl: 1 });
    K.bld(c, 'barrack', 0, 40, { ry: 0, w: 10, d: 6, fl: 2, wall: 0x6a5a48 });
    K.fence(c, [[-32, 18], [32, 18], [32, 46], [-32, 46], [-32, 18]], { col: 0x3a3634, h: 2.2 });
    for (const [x, z] of [[-32, 18], [32, 18], [32, 46], [-32, 46]]) { const top = K.watchtower(c, x, z, { h: 8 }); c.fx.searchlight(x, top, z, { col: 0xfff4e0, i: .4, len: 50, tilt: 1.05, spin: x * z > 0 ? .3 : -.25 }); }
    c.light(-32, c.h(-32, 18) + 9, 18, 0xfff0d8, 3, 22); c.light(32, c.h(32, 46) + 9, 46, 0xfff0d8, 3, 22);
    c.light(0, c.h(0, 8) + 3, 8, 0xffb070, 2.4, 14);
    // 办事处与哨卡
    K.bld(c, 'frost', 38, 4, { ry: -.2, fl: 2, w: 9, d: 6, wall: 0x6a5a4a });
    K.flag(c, 38, c.h(38, 4) + 8, 4, 4, 0x2a2a2a);
    c.people(40, { rect: [-40, -20, 80, 66], cols: [0x2a2826, 0x3a3634, 0x4a4038, 0x2a2e3a] });
    c.trees(coarse(c, 200), { species: ['pine', 'pine', 'birch', 'bare'], cols: [0x2a3a2e, 0x32402e, 0x3a4436], area: (x, z) => Math.hypot(x, z) > 44 ? 1 : 0, maxSlope: 1.2 });
    c.rocks(70, { cols: [0x5a5852, 0x4a4844], big: true, s: [.6, 2] });
  }
};
