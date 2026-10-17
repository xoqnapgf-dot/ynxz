/* 国家与大地区：半开放沙盘。中心一块代表性区域，往外降级为色块并淡入背景。
   坐标：+x 东，+z 南（相机方位角 az=0 时从南向北看）。 */
import * as K from './props.js?v=23';
import { P, lin, tower } from './kit.js?v=23';
import { bump, terrace, ridgeLine, coastDist, island, smooth, clamp, lerp, segDist } from './terrain.js?v=23';

export const COUNTRIES = {};
const many = (c, n) => c.coarse ? Math.round(n * .4) : n;
const hashCell = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
/* 拼布田：旋转网格中每格一个颜色，带犁沟 */
function fields(col, x, z, ang, sx, sz, cols, k = .85, furrow = .1) {
  const ca = Math.cos(ang), sa = Math.sin(ang), u = x * ca + z * sa, v = -x * sa + z * ca;
  const iu = Math.floor(u / sx), iv = Math.floor(v / sz), h = hashCell(iu, iv);
  const edge = Math.min(u / sx - iu, 1 - (u / sx - iu)) * sx < .7 || Math.min(v / sz - iv, 1 - (v / sz - iv)) * sz < .7;
  const fc = lin(cols[Math.floor(h * cols.length)]).multiplyScalar(1 - furrow + furrow * Math.sin(v * 2.6));
  col.lerp(edge ? fc.multiplyScalar(.75) : fc, k);
  return h;
}

/* ================= 布图里亚：海峡西岸的港口与船坞 ================= */
COUNTRIES['布图里亚'] = {
  mode: 'open', R: 100, seed: 'butouria-harbour', time: 'morning',
  label: '临海王国 · 港口与船坞', note: '海湾里泊着渔船和过路商船，南岸船台上有一艘船刚立起肋骨；山坡高处的宅邸挂着王旗。',
  water: { level: 0, shallow: 0x3c9c98, deep: 0x0f4462, clarity: .4, wave: .4, foam: 1.2 },
  palette: { grass: [0x6e9a46, 0x5c8a3e], dry: 0xa8a066, dryK: .4, sand: 0xe0cfa2, rock: 0x8f887c, bed: 0x9a9272 },
  height(x, z, c) {
    const coast = -(x - 26 - 12 * Math.sin(z * .021) - c.N.fbm(x * .02, z * .02, 3) * 14);
    let h = coast > 0 ? 1 + coast * .07 + bump(x, z, -80, -40, 60, 22) + c.N.ridge(x * .012, z * .012, 4) * 10 * smooth(10, 60, coast) : coast * .22;
    h -= bump(x, z, 30, 6, 30, 9, 2.4);
    h += bump(x, z, 44, -44, 16, 12);
    return Math.max(h, -10);
  },
  pads: [{ x: -38, z: -24, r: 10, soft: 6 }, { x: 4, z: 6, r: 12, soft: 6 }],
  roads: [{ pts: [[4, 6], [-10, 0], [-24, -12], [-38, -24]], w: 3.6 }, { pts: [[12, 40], [6, 20], [4, 6], [10, -16], [30, -38]], w: 4 }, { pts: [[4, 6], [-20, 26], [-60, 40]], w: 3.6 }],
  weather: { clouds: { n: 5, y: 46, size: 7, inner: .5, spread: .9 }, birds: { n: 16, col: 0xf2f2f2, y: 18 } },
  wind: .7,
  views: [{ label: '海湾', az: 105, el: 33, d: 1 }, { label: '港口', az: 120, el: 24, d: .4, t: [10, null, 4] }, { label: '船坞', az: 150, el: 25, d: .4, t: [24, null, 44] }, { label: '灯塔', az: 70, el: 24, d: .35, t: [42, null, -44] }],
  build(c) {
    K.street(c, [[12, 40], [6, 20], [4, 6], [10, -16], [30, -38]], 'harbour', { roadW: 4 });
    K.street(c, [[4, 6], [-10, 0], [-24, -12], [-36, -22]], 'harbour', { roadW: 3.6 });
    K.street(c, [[4, 6], [-20, 26], [-60, 40]], 'harbour', { roadW: 3.6 });
    K.cluster(c, 'harbour', -12, 16, 16, 18, { angle: .4 });
    K.cluster(c, 'harbour', -2, -26, 14, 12, { angle: -.3 });
    // 码头仓库与防波堤
    for (let k = 0; k < 4; k++) K.bld(c, 'harbour', 16 + k * 1.2, 24 - k * 9, { w: 12, d: 7, fl: 2, ry: Math.PI / 2 + .2, roof: 'gable', wall: 0xc9b496, rcol: 0x8a4a36 });
    K.breakwater(c, [[50, -40], [60, -14], [56, 6]]);
    K.pier(c, 22, 8, 16, Math.PI / 2 + .1); K.pier(c, 22, -6, 12, Math.PI / 2 + .3);
    K.slipway(c, 30, 48, Math.PI / 2 + .4, { len: 26 });
    K.crane(c, 22, 58, .4, { h: 14, reach: 12 });
    K.lighthouse(c, 46, -46, { h: 14, stripe: 0xb03a2c });
    // 宅邸与王旗
    K.bld(c, 'civic', -38, -24, { ry: .7, fl: 2, w: 16, d: 10, roof: 'hip', rcol: 0x4b5560, rpat: P.slate, wall: 0xf2ece0 });
    K.flag(c, -38, c.h(-38, -24) + 9.5, -24, 5, 0x2a4a8a);
    K.fence(c, [[-50, -36], [-28, -38], [-24, -14], [-48, -10], [-50, -36]], { stone: true, col: 0xb9b0a0, h: 1 });
    // 船
    K.boatAt(c, 38, 10, 1.9, { len: 22, kind: 'steam', hull: 0x2b2f33, stripe: 0x9a2a22, cabin: 0xefe8da });
    K.boatAt(c, 40, -6, 2.4, { len: 16, kind: 'sail', hull: 0x3a4a5a, sail: 0xf0e8d6 });
    for (let k = 0; k < 8; k++) K.boatAt(c, 30 + c.r() * 22, -24 + c.r() * 50, c.r() * 6, { len: 4 + c.r() * 3, kind: c.r() < .4 ? 'sail' : 'row', hull: K.pick(c, [0x2f4f6a, 0xa04a32, 0x3a6a4a, 0xd9cfbf]) });
    c.people(70, { at: [10, 6, 30] });
    c.trees(many(c, 320), { species: ['round', 'round', 'pine', 'column'], cols: [0x4f7a34, 0x5d8a3a, 0x3f6a30], minH: 2, area: (x, z) => x < -10 ? .9 : .3 });
    c.rocks(60, { cols: [0x8f887c, 0x9a9384], above: -2, maxH: 3 });
    c.grass(many(c, 4000), { cols: [0x6e9a46, 0x7fa64c], minH: 2, flowers: [0xf2e8a0, 0xffffff] });
  }
};

/* ================= 铁枢人民共和国：大河平原上的钢铁城 ================= */
COUNTRIES['铁枢人民共和国'] = {
  mode: 'open', R: 110, seed: 'tieshu-steel', time: 'overcast', hazeK: 1.2,
  label: '大河平原 · 钢铁与铁路', note: '高炉日夜不熄，铁路桥把轧钢厂和对岸的编组站接在一起；单位宿舍楼一排排朝着厂门。',
  water: { level: 0, shallow: 0x5b6a5a, deep: 0x2a3a3a, clarity: .9, wave: .25, foam: .4 },
  palette: { grass: [0x7a7f52, 0x6a744a], dry: 0x8f8660, dryK: .7, dirt: 0x5e5446, rock: 0x7a746a, sand: 0x9a8c70, bed: 0x5a5444, mud: 0x3e3a32,
    paint(x, z, h, s, col) {
      if (Math.hypot(x, z) > 62 && h > .8) fields(col, x, z, .35, 34, 22, [0x8a7a52, 0x6f7a44, 0x9a8a5a, 0x5e5a40, 0x7f8a4a], .8);
      const d = Math.hypot(x + 20, z + 18);
      if (d < 42) col.lerp(lin(0x4a4640), smooth(42, 20, d) * .8);
    } },
  height(x, z, c) { return 1.6 + c.N.fbm(x * .008, z * .008, 4) * 3 + bump(x, z, 70, -80, 50, 6) + c.N.fbm(x * .04, z * .04, 3) * .5; },
  rivers: [{ pts: [[-360, -220], [-150, -80], [-60, -40], [10, 20], [80, 50], [200, 90], [360, 140]], w: 18, depth: 3, bank: 8 }],
  roads: [{ pts: [[-120, 40], [-60, 28], [-30, 10], [-10, -6]], w: 5 }, { pts: [[-40, 60], [-40, 30], [-36, 0]], w: 5 }],
  pads: [{ x: -22, z: -22, w: 70, d: 46, ry: .35, soft: 10 }, { x: 46, z: 64, w: 50, d: 20, ry: -.4, soft: 8 }],
  weather: { mist: { y: 3, layers: 2, op: .2, col: 0xb9bbb8, scale: .02 }, birds: { n: 6, col: 0x2a2a2a, y: 22 } },
  fog: { y: 0, h: 8, d: .006, col: 0xa9aaa5 },
  wind: .35,
  views: [{ label: '全景', az: 200, el: 34, d: 1 }, { label: '高炉', az: 230, el: 26, d: .4, t: [-26, null, -26] }, { label: '铁路桥', az: 140, el: 22, d: .42, t: [16, null, 26] }, { label: '宿舍区', az: 300, el: 30, d: .4, t: [-48, null, 42] }],
  build(c) {
    const rail = [[-300, -40], [-110, -60], [-60, -52], [-20, -50], [20, 20], [60, 70], [120, 100], [320, 160]];
    c.rail(rail.filter(([x, z]) => Math.hypot(x, z) < 200));
    K.train(c, rail, .28, 9, { open: true, cargo: 0x2a2826, loco: 0x2a3430 });
    K.bridge(c, [6, -2], [34, 40], { kind: 'steel', w: 5 });
    K.blastFurnace(c, -30, -30, { h: 24 });
    K.blastFurnace(c, -8, -38, { h: 20 });
    K.factory(c, -46, -10, .35, { w: 18, len: 40, h: 8, chimneys: [[-6, 24, 26], [6, 24, 22]] });
    K.factory(c, -12, -6, .35, { w: 14, len: 26, h: 7, wall: 0x8a6a58 });
    K.chimney(c, -2, -24, 30); K.chimney(c, -56, -36, 24);
    K.heap(c, -50, -48, 7, 6, 0x2e2b29); K.heap(c, -38, -56, 6, 5, 0x7a4a36);
    K.tanks(c, 10, -46, 4, { col: 0xa8a49a });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const x = -70 + i * 26 + j * 4, z = 30 + j * 20 - i * 4;
      if (c.usable(x, z, { r: 4, road: false })) K.bld(c, 'workers', x, z, { ry: .35 + Math.PI / 2 });
    }
    K.statue(c, -36, 22, { col: 0x5a6058, h: 5 });
    for (let k = 0; k < 6; k++) K.flag(c, -44 + k * 3, c.h(-44 + k * 3, 14), 14 - k * 1.1, 6, 0xb03028);
    K.poles(c, [[-120, 46], [-60, 34], [-30, 16], [-12, -2]]);
    for (let k = 0; k < 3; k++) K.bld(c, 'workers', 40 + k * 18, 70 - k * 8, { ry: -.4, fl: 1, roof: 'gable', rcol: 0x4a4744, w: 16, d: 9 });
    K.train(c, rail, .62, 7, { cars: [0x6a3a2c, 0x5a4a3a] });
    K.boatAt(c, -40, -42, .55, { len: 14, kind: 'barge', hull: 0x3a3a36, cargo: 0x2a2826 });
    K.boatAt(c, 60, 38, .45, { len: 12, kind: 'barge', hull: 0x4a3a30, cargo: 0x8a6a4a });
    c.people(70, { at: [-30, 0, 50], cols: [0x3a4a5a, 0x4a4a42, 0x5a5048, 0x2a3440] });
    c.trees(many(c, 260), { species: ['round', 'birch', 'column'], cols: [0x56663a, 0x4a5a34, 0x6a7040], area: (x, z) => Math.hypot(x + 20, z + 20) > 50 ? .7 : 0 });
    c.grass(many(c, 3000), { cols: [0x7a7f52, 0x6a744a], area: (x, z) => Math.hypot(x + 20, z + 18) > 45 ? 1 : 0 });
  }
};

/* ================= 坎普共和国：咖啡梯田、牧场与河港，雷雨将至 ================= */
COUNTRIES['坎普共和国'] = {
  mode: 'open', R: 100, seed: 'kampu-coffee', time: 'afternoon',
  light: { top: 0x55779e, hor: 0xd8c39c, haze: 0xd2c19e, sun: 0xffdcae, si: 3.4 },
  label: '河港与庄园 · 咖啡梯田', note: '西坡梯田种满咖啡，东岸是放牛的草场；河港码头在装麻袋，远处的雷雨云正往这边压。',
  water: { level: 0, shallow: 0x7a7046, deep: 0x4a4430, clarity: 1.2, wave: .3, foam: .5 },
  palette: { grass: [0x6f8a38, 0x5f7c30], dry: 0xa8964e, dryK: .55, dirt: 0x9a4e30, sand: 0xc09060, rock: 0x8a6a56, bed: 0x6a5838, mud: 0x5a4632,
    paint(x, z, h, s, col, c) {
      if (x < -6 && h > 3) { const f = (h / 2.4) % 1; col.lerp(lin(f < .55 ? 0x7a4a2e : 0x4f6a2a), .55); }
      if (x > 30 && h > 1) col.lerp(lin(0x86a048), .35);
    } },
  height(x, z, c) {
    const west = smooth(10, -60, x) * (18 + c.N.fbm(x * .015, z * .015, 3) * 10);
    const hills = terrace(west, 2.4, .8);
    return 1.2 + hills + c.N.fbm(x * .02 + 9, z * .02, 3) * 1.6 + bump(x, z, 70, -50, 40, 5);
  },
  rivers: [{ pts: [[20, -300], [16, -80], [26, -20], [14, 30], [24, 90], [10, 300]], w: 22, depth: 3, bank: 7 }],
  roads: [{ pts: [[-30, -10], [-8, 6], [6, 26]], w: 3.6 }, { pts: [[42, 30], [70, 10], [120, -20]], w: 3.4 }],
  pads: [{ x: -30, z: -10, w: 22, d: 16, ry: .3, soft: 6 }, { x: 0, z: 30, w: 18, d: 22, soft: 5 }],
  weather: { clouds: [{ n: 4, kind: 'storm', col: 0x5c6068, y: 34, size: 24, inner: 2, spread: .5, speed: .8 }, { n: 4, y: 44, size: 7, inner: .4, spread: .8 }], lightning: { every: 9 }, birds: { n: 8, col: 0x1a1a1a, y: 20 } },
  wind: .65,
  views: [{ label: '河谷', az: 165, el: 33, d: 1 }, { label: '咖啡梯田', az: 120, el: 30, d: .42, t: [-36, null, 10] }, { label: '河港', az: 200, el: 22, d: .38, t: [6, null, 30] }, { label: '牧场', az: 250, el: 26, d: .42, t: [60, null, -14] }],
  build(c) {
    K.veranda(c, -30, -10, .3, { w: 18, d: 11, wall: 0xf3e6cc, roof: 0x9a4a32 });
    for (let k = 0; k < 3; k++) K.bld(c, 'ranch', -44 + k * 9, 4 + k * 3, { ry: .3, fl: 1, w: 7 });
    // 晒豆场
    c.B.frame(-14, c.h(-14, -24) + .05, -24, .3); c.B.box(0, -.3, 0, 16, .4, 10, 0x8a5a3a, P.cloth); c.B.frame(); c.occupy(-14, -24, 16, 10, .3);
    K.street(c, [[-2, 18], [6, 26], [4, 46], [-6, 60]], 'ranch', { roadW: 3.6 });
    K.cluster(c, 'ranch', -6, 40, 14, 14, { angle: .1 });
    for (let k = 0; k < 3; k++) K.bld(c, 'colonial', 10, 18 + k * 10, { ry: Math.PI / 2, fl: 1, w: 10, d: 7, rpat: P.metal });
    K.pier(c, 12, 28, 10, Math.PI / 2); K.pier(c, 12, 44, 8, Math.PI / 2);
    K.boatAt(c, 27, 34, 0, { len: 18, kind: 'steam', hull: 0xe8e0d0, stripe: 0x8a2a22, cabin: 0xf2ece0, funnel: 0x2a2624 });
    K.boatAt(c, 22, 54, .2, { len: 12, kind: 'barge', hull: 0x5a4a3a, cargo: 0xb08a5a });
    K.chimney(c, 4, 4, 14, { r: .9, smokeCol: 0x8a857e, size: 4 });
    K.factory(c, 2, 0, .1, { w: 10, len: 14, h: 6, wall: 0xb06a4a });
    // 牧场
    K.fence(c, [[40, -40], [90, -46], [96, 10], [44, 14], [40, -40]], { col: 0x6a5038 });
    c.animals('cow', 40, { at: [66, -16, 24], cols: [0x6a4a35, 0xd8cfc0, 0x2c2622, 0x9a6a4a] });
    c.animals('horse', 6, { at: [56, 20, 10], cols: [0x5a3a26, 0x2a2420] });
    K.bld(c, 'ranch', 64, 26, { ry: -.2, fl: 1 });
    // 咖啡：西坡梯田上的成行灌木
    K.rows(c, -50, 10, 46, 60, .25, { species: 'shrub', row: 2.4, step: 1.3, cols: [0x2f5a24, 0x3a6a2a, 0x2a4f20], s: [.55, .75], where: (x, z) => x < -8 && c.slope(x, z) < .35 && c.h(x, z) > 3 });
    c.trees(many(c, 160), { species: ['broad', 'palm', 'round'], cols: [0x3f6a2c, 0x4f7a34, 0x5a8a3a], area: (x) => x < -60 || x > 90 ? 1 : .25 });
    c.trees(40, { species: ['palm'], cols: [0x5a8a3a, 0x6a9a40], at: [10, 30, 30] });
    c.people(60, { at: [0, 30, 26] }); c.people(30, { at: [-40, 0, 30] });
    c.grass(many(c, 5000), { cols: [0x7a9640, 0x8aa048, 0x6a8a38], area: (x) => x > 30 ? 1 : .1 });
  }
};

/* ================= 卡法里扬帝国：冻土油田与要塞，极夜极光 ================= */
COUNTRIES['卡法里扬帝国'] = {
  mode: 'open', R: 110, seed: 'kafaliyan-oil', time: 'night', snow: 1, lit: .7,
  light: { si: .55, exp: 1.5, top: 0x050a1a, hor: 0x1a2a44 },
  label: '冻土海岸 · 油田与要塞', note: '极夜里油井的火炬烧个不停，要塞的探灯照着结冰的海湾；营房外的雪很少有人扫。',
  water: { level: 0, shallow: 0x2a4048, deep: 0x0a1a24, clarity: .8, wave: .15, foam: .3 },
  palette: { grass: [0x8a8f8a, 0x7a807c], dry: 0x8a8678, rock: 0x4a4744, sand: 0x8a8478, bed: 0x3a3a38 },
  strata: [0x3a332c, 0x5a5650, 0x4a4844, 0x6a6660, 0x3e3c3a],
  height(x, z, c) {
    const coast = (z + 50) - 20 * Math.sin(x * .018) + c.N.fbm(x * .02, z * .02, 3) * 16;
    let h = coast > 0 ? 1 + coast * .04 + c.N.fbm(x * .015, z * .015, 4) * 4 + ridgeLine(x, z, [[-200, 120], [-60, 80], [60, 140]], 40, 22) : coast * .2;
    return Math.max(h, -8);
  },
  pads: [{ x: 20, z: 10, r: 16, soft: 8 }],
  roads: [{ pts: [[-120, 40], [-40, 20], [20, 10], [60, -20]], w: 4 }],
  weather: { snow: .4, aurora: [{ pts: [[-220, 70, -170], [-60, 90, -200], [80, 80, -190], [220, 70, -150]], h: 80 }, { pts: [[-160, 100, -230], [40, 110, -240], [200, 95, -210]], h: 60, a: 0x50ffc0, b: 0x6a40ff, i: 1 }] },
  wind: .5,
  views: [{ label: '冰湾', az: 160, el: 30, d: 1 }, { label: '油井', az: 200, el: 24, d: .4, t: [-40, null, 30] }, { label: '要塞', az: 130, el: 26, d: .38, t: [20, null, 10] }, { label: '矿井', az: 250, el: 26, d: .4, t: [52, null, 40] }],
  build(c) {
    for (const [x, z, fl] of [[-46, 24, 1], [-30, 40, 0], [-60, 46, 1], [-20, 22, 0], [-52, 6, 0]]) K.derrick(c, x, z, { flare: !!fl });
    K.tanks(c, -12, 46, 4, { col: 0x8a8a84 });
    K.castle(c, 20, 10, { r: 14, col: 0x7a756c, roof: 0x2f3a40, keepRoof: true, kh: 14, flag: 0x6a1a1a });
    for (let k = 0; k < 5; k++) K.bld(c, 'frost', 44 + (k % 2) * 16, -10 + Math.floor(k / 2) * 12, { ry: .1, w: 14, d: 6, fl: 1 });
    K.headframe(c, 54, 40, .4, { h: 14 }); K.heap(c, 70, 52, 7, 6, 0x2c2a28);
    c.rail([[-200, 60], [-80, 50], [0, 34], [60, 30], [200, 20]]);
    K.train(c, [[-200, 60], [-80, 50], [0, 34], [60, 30], [200, 20]], .35, 7, { cars: [0x2a2624, 0x3a3430], open: true, cargo: 0x1e1c1a });
    // 冰湾浮冰
    for (let k = 0; k < 60; k++) { const x = -110 + c.r() * 220, z = -60 - c.r() * 50; if (c.h(x, z) < -1) c.I.small('boulder', x, -.2, z, 1.5 + c.r() * 3, 0xe8eef4, c.r() * 6, .12); }
    K.pier(c, -6, -30, 14, Math.PI, { w: 3 });
    K.boatAt(c, -2, -50, .2, { len: 20, kind: 'war', cabin: 0x5a6068 });
    for (const [x, z] of [[10, -4], [30, 24]]) { const y = c.h(x, z) + 10; c.fx.searchlight(x, y, z, { col: 0xfff2d8, i: .35, len: 70, tilt: 1 }); }
    c.people(25, { at: [20, 10, 30], cols: [0x2a2a2a, 0x3a3430, 0x4a3a30] });
    c.trees(many(c, 140), { species: ['cone', 'cone', 'bare'], cols: [0x2a3a30, 0x30402e], k: .9, area: (x, z) => z > 30 ? .8 : .2 });
  }
};

/* ================= 科鲁鲁王国：河湾古都与葡萄园 ================= */
COUNTRIES['科鲁鲁王国'] = {
  mode: 'open', R: 100, seed: 'koruru-vine', time: 'golden',
  label: '内陆河网 · 古都与葡萄园', note: '古都占着河湾内侧，教堂穹顶和王宫比老城的瓦顶都高；对岸向阳的坡上全是葡萄架。',
  water: { level: 0, shallow: 0x5a7a6a, deep: 0x23404a, clarity: .7, wave: .2, foam: .4 },
  palette: { grass: [0x7a8f48, 0x6a843e], dry: 0xb0a060, dryK: .5, dirt: 0x9a7a52, rock: 0xb09a78, sand: 0xc8b088,
    paint(x, z, h, s, col) { if (z < -30 && h > 3) col.lerp(lin(0x8a7a48), .45); } },
  height(x, z, c) { return 2 + smooth(-20, -90, z) * 16 + c.N.fbm(x * .012, z * .012, 4) * 5 + bump(x, z, 70, 60, 50, 8); },
  rivers: [{ pts: [[-300, 20], [-80, 10], [-40, 40], [10, 52], [50, 30], [60, -6], [100, -20], [300, -30]], w: 20, depth: 3, bank: 6 }],
  pads: [{ x: 4, z: 12, r: 36, soft: 10 }, { x: -18, z: -6, r: 10, soft: 4 }],
  roads: [{ pts: [[-30, 30], [-10, 16], [10, 10], [30, 4], [48, -4]], w: 4 }, { pts: [[4, 12], [6, 40], [10, 52], [14, 70]], w: 4 }],
  weather: { birds: { n: 12, col: 0x2a2a2a, y: 24 }, motes: { kind: 'dust', n: 300, cols: [0xffe2b0], size: .25, op: .35, h: 20, rad: 80 } },
  wind: .3,
  views: [{ label: '古都', az: 200, el: 32, d: 1 }, { label: '教堂广场', az: 220, el: 26, d: .38, t: [6, null, 14] }, { label: '王宫', az: 150, el: 26, d: .36, t: [-18, null, -6] }, { label: '葡萄园', az: 180, el: 28, d: .45, t: [0, null, -54] }],
  build(c) {
    K.church(c, 8, 16, .2, { w: 12, len: 30, h: 13, transept: true, apse: true, dome: true, wall: 0xe8d4ae, roof: 0xb06a3c, domePat: P.tile, rpat: P.tile, th: 24, tower: 8 });
    K.bld(c, 'civic', -18, -6, { w: 30, d: 16, fl: 3, ry: .2, roof: 'hip', wall: 0xf0e2c4, rcol: 0x4b5560, rpat: P.slate });
    K.fence(c, [[-34, -22], [-2, -26], [0, -16]], { stone: true, col: 0xd8c8a6 });
    K.street(c, [[-30, 30], [-10, 16], [10, 10], [30, 4], [48, -4]], 'vine', { roadW: 4, fill: .95 });
    K.street(c, [[4, 12], [6, 40], [10, 52]], 'vine', { roadW: 4 });
    K.cluster(c, 'vine', 22, 24, 18, 36, { angle: .2, r: 3 });
    K.cluster(c, 'vine', -14, 28, 14, 20, { angle: .5, r: 3 });
    for (const [x, z] of [[-36, 18], [36, -14], [44, 26]]) K.bld(c, 'vine', x, z, { fl: 3 });
    K.bridge(c, [-18, 30], [-36, 52], { w: 5, span: 8 });
    K.bridge(c, [42, 0], [70, -6], { w: 5, span: 9 });
    K.boatAt(c, -2, 48, 1.4, { len: 12, kind: 'barge', hull: 0x5a4636, cargo: 0x6a3a4a });
    K.boatAt(c, 30, 46, 1.9, { len: 8, kind: 'sail', hull: 0x4a3a2c, sail: 0xe8dcc0 });
    K.rows(c, 0, -56, 120, 46, 0, { species: 'shrub', row: 2.6, step: 1.2, cols: [0x4e6a2a, 0x5a7a30, 0x6a7a2a], s: [.45, .6], where: (x, z) => c.h(x, z) > 4 });
    for (let k = 0; k < 14; k++) c.I.tree('column', -60 + k * 9, c.h(-60 + k * 9, -30), -30, 1.1, 0x2f4a26);
    c.trees(many(c, 180), { species: ['pine', 'round', 'column'], cols: [0x3f5a2a, 0x4f6a30, 0x5a7034], area: (x, z) => z > 50 || x > 60 ? .9 : .15 });
    c.people(80, { at: [6, 12, 34] });
    c.grass(many(c, 2500), { cols: [0x8a9a4c, 0x9aa050], area: (x, z) => z > 40 ? 1 : 0 });
  }
};

/* ================= 伊鲁尼利亚共和国：海军港与联邦议会 ================= */
COUNTRIES['伊鲁尼利亚共和国'] = {
  mode: 'open', R: 110, seed: 'iluni-fleet', time: 'noon',
  label: '两洋之间 · 舰队与议会', note: '军港里停着三艘灰色巡洋舰，干船坞旁吊车林立；穹顶议会厅前的林荫大道通往商港。',
  water: { level: 0, shallow: 0x2f8aa0, deep: 0x0b3a66, clarity: .32, wave: .45, foam: 1.1 },
  palette: { grass: [0x6a9a44, 0x5a8a3c], dry: 0xb0a65e, dryK: .35, sand: 0xe6d6a8, rock: 0x8a8a80,
    paint(x, z, h, s, col) { if (Math.hypot(x + 10, z + 40) > 70 && h > 2) fields(col, x, z, .1, 28, 18, [0x8aa040, 0xc0aa52, 0x6a9a3a, 0xa0b048, 0xd0b860], .75); } },
  height(x, z, c) {
    const coast = -(z - 30 - 14 * Math.sin(x * .016)) + c.N.fbm(x * .02, z * .02, 3) * 10;
    let h = coast > 0 ? 1.2 + coast * .05 + c.N.fbm(x * .01, z * .01, 4) * 3 : coast * .18;
    h -= bump(x, z, 30, 34, 26, 8);
    return Math.max(h, -11);
  },
  pads: [{ x: -16, z: -16, r: 14, soft: 6 }, { x: 20, z: 12, w: 46, d: 14, soft: 4 }],
  roads: [{ pts: [[-16, -16], [-16, 10], [-16, 30]], w: 7 }, { pts: [[-80, -2], [-16, -2], [60, -2]], w: 6 }, { pts: [[-16, -16], [-16, -60], [-20, -120]], w: 5 }],
  weather: { clouds: { n: 8, y: 52, size: 9, inner: .2, spread: 1.1, speed: 2 }, birds: { n: 14, col: 0xf2f2f2, y: 20 } },
  wind: .6,
  views: [{ label: '军港', az: 175, el: 32, d: 1 }, { label: '舰队', az: 200, el: 22, d: .4, t: [30, null, 34] }, { label: '议会', az: 160, el: 26, d: .36, t: [-16, null, -16] }, { label: '干船坞', az: 120, el: 24, d: .38, t: [52, null, 18] }],
  build(c) {
    K.church(c, -16, -18, 0, { w: 16, len: 26, h: 12, dome: true, tower: 14, th: 14, wall: 0xf4f0e6, roof: 0x5a8a8a, domePat: P.metal, rpat: P.metal, transept: true });
    for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) { const x = -16 + s * 14, z = -2 + i * 14; if (c.usable(x, z, { r: 5, road: false })) K.bld(c, 'civic', x, z, { ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, w: 12, d: 10 }); }
    for (let k = 0; k < 10; k++) { c.I.tree('round', -22, c.h(-22, -50 + k * 9), -50 + k * 9, .9, 0x4f7a34); c.I.tree('round', -10, c.h(-10, -50 + k * 9), -50 + k * 9, .9, 0x4f7a34); }
    K.cluster(c, 'harbour', -50, 6, 22, 30, { angle: 0 });
    K.cluster(c, 'civic', 28, -20, 18, 10, { angle: 0, r: 6 });
    // 军港
    K.breakwater(c, [[70, 60], [40, 74], [0, 70]], { w: 4 });
    for (let k = 0; k < 4; k++) K.pier(c, 6 + k * 16, 20, 16, 0, { w: 4, stone: 0x8a857a });
    K.boatAt(c, 14, 40, 0, { len: 30, kind: 'war' }); K.boatAt(c, 30, 42, .05, { len: 28, kind: 'war' }); K.boatAt(c, 46, 44, -.05, { len: 24, kind: 'war' });
    for (let k = 0; k < 4; k++) K.crane(c, 58 + k * 6, 10 + k * 4, -.6, { h: 16, col: 0x8a6a3a });
    K.slipway(c, 66, 30, -.3, { len: 30 });
    for (let k = 0; k < 4; k++) K.bld(c, 'workers', -2 + k * 16, 10, { fl: 1, w: 14, d: 8, roof: 'gable', rcol: 0x5a5a58, rpat: P.metal, wall: 0xc4b4a0 });
    K.lighthouse(c, 2, 70, { h: 12 });
    for (let k = 0; k < 5; k++) K.flag(c, -24 + k * 4, c.h(-24 + k * 4, -32) , -32, 7, k % 2 ? 0x2a5a9a : 0xf2f2f2);
    c.people(90, { at: [-16, -2, 30] }); c.people(30, { at: [30, 16, 16], cols: [0x2a3a5a, 0xf2f2f2] });
    c.trees(many(c, 240), { species: ['round', 'pine', 'column'], cols: [0x4f7a34, 0x5d8a3a], area: (x, z) => z < -30 ? .7 : .2 });
    c.grass(many(c, 3000), { cols: [0x6a9a44, 0x7aa64c] });
  }
};

/* ================= 示安神权政治：梅雨里的社祠与圣林 ================= */
COUNTRIES['示安神权政治'] = {
  mode: 'open', R: 95, seed: 'shian-grove', time: 'rain',
  light: { top: 0x6a7680, hor: 0x9aa4a6, haze: 0x8e999c, sun: 0xd0d8dc },
  label: '长海岸 · 社祠与圣林', note: '梅雨下了半个月，山路的石阶一直湿着。社祠在圣林最深处，渔村和墓地都在它脚下。',
  water: { level: 0, shallow: 0x3a6a66, deep: 0x16323e, clarity: .55, wave: .3, foam: .8 },
  palette: { grass: [0x4f7238, 0x45683a], dry: 0x7a8048, dryK: .2, dirt: 0x5a4a3a, rock: 0x6f6e66, sand: 0xa89a80, bed: 0x5a5a48 },
  height(x, z, c) {
    const coast = x + 60 + 14 * Math.sin(z * .03) + c.N.fbm(x * .03, z * .03, 3) * 18;
    let h = coast > 0 ? 1 + coast * .1 + c.N.ridge(x * .016, z * .016, 4) * 16 * smooth(0, 40, coast) + bump(x, z, 20, -20, 30, 16) : coast * .25;
    return Math.max(h, -9);
  },
  pads: [{ x: 22, z: -22, r: 12, soft: 6 }, { x: -46, z: 24, r: 14, soft: 6 }],
  roads: [{ pts: [[-46, 24], [-20, 10], [0, -6], [14, -14], [22, -22]], w: 2.6 }],
  weather: { rain: .45, mist: [{ y: 9, layers: 3, gap: 3, op: .5, col: 0xd8dcdc, scale: .03 }] },
  fog: { y: 2, h: 10, d: .02, col: 0xb8c0c2 },
  wind: .35,
  views: [{ label: '海岸', az: 250, el: 32, d: 1 }, { label: '社祠', az: 220, el: 28, d: .36, t: [22, null, -22] }, { label: '渔村', az: 260, el: 24, d: .36, t: [-46, null, 24] }, { label: '圣林', az: 180, el: 34, d: .45, t: [30, null, 10] }],
  build(c) {
    // 社祠：主殿 + 拜殿 + 社门一列
    K.bld(c, 'shrine', 24, -26, { ry: -.8, w: 10, d: 8, fl: 1, wall: 0x5a4232, roof: 'curve', rcol: 0x3f474e });
    K.bld(c, 'shrine', 16, -16, { ry: -.8, w: 7, d: 5, fl: 1, wall: 0xd9cfbf, roof: 'curve' });
    K.bld(c, 'shrine', 32, -14, { ry: -2.4, w: 5, d: 4, fl: 1 });
    for (let k = 0; k < 5; k++) { const t = k / 5, x = lerp(-20, 12, t), z = lerp(10, -12, t); K.shrineGate(c, x, z, Math.atan2(32, -22), { w: 3.6, h: 4 }); }
    for (let k = 0; k < 8; k++) { const t = k / 8; K.stoneLantern(c, lerp(-14, 10, t) + 2.4, lerp(8, -10, t) + 2.4, true); }
    // 墓地
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) K.grave(c, -6 + i * 1.6, 24 + j * 1.6);
    // 渔村与渡口
    K.cluster(c, 'tide', -46, 24, 14, 16, { angle: .2, r: 3 });
    K.pier(c, -62, 22, 14, -Math.PI / 2); K.pier(c, -60, 36, 10, -Math.PI / 2 - .3);
    for (let k = 0; k < 6; k++) K.boatAt(c, -78 + c.r() * 10, 10 + c.r() * 30, c.r() * 6, { len: 5 + c.r() * 2, kind: c.r() < .3 ? 'junk' : 'row', hull: 0x4a3a2c, sail: 0x8a6a4a });
    // 圣林：高大的针叶与竹
    c.trees(many(c, 360), { species: ['cone', 'cone', 'column'], cols: [0x24402a, 0x2c4a30, 0x203828], k: 1.5, at: [24, -10, 40], r: .9 });
    c.trees(many(c, 160), { species: ['bamboo'], cols: [0x5a8040, 0x6a9048], k: 1.1, at: [-20, 40, 26] });
    c.trees(many(c, 200), { species: ['round', 'cone'], cols: [0x35553a, 0x3f6040], minH: 2 });
    c.people(20, { at: [-40, 24, 16], cols: [0x3a3a46, 0x5a4a3a, 0x2a3a4a] }); c.people(8, { at: [18, -18, 8], cols: [0xf2f0ea, 0xb03a2c] });
    c.rocks(60, { cols: [0x5f5e58, 0x6f6e66], above: -1, s: [.6, 2] });
  }
};

/* ================= 帕尔哈南神权政治：谷雾中的教廷修院 ================= */
COUNTRIES['帕尔哈南神权政治'] = {
  mode: 'open', R: 105, seed: 'parhanan-cloister', time: 'dawn',
  label: '教廷北境 · 修院与谷雾', note: '主教座堂与抄经院建在河谷上方的台地，清晨谷底的雾还没散；远处山坡上立着一圈旧石柱。',
  water: { level: 0, shallow: 0x4a6a6a, deep: 0x1e3640, clarity: .6, wave: .15, foam: .3 },
  palette: { grass: [0x5f7a44, 0x546f3e], dry: 0x8a8a5a, dryK: .3, rock: 0x8a8678, sand: 0xa89a7a },
  height(x, z, c) {
    const valley = Math.abs(z - 30 - 14 * Math.sin(x * .02));
    const sides = smooth(10, 70, valley) * 26 + c.N.fbm(x * .014, z * .014, 4) * 8;
    return 1 + sides + bump(x, z, -10, -20, 30, 6, 4) + c.N.fbm(x * .05, z * .05, 3) * .8;
  },
  rivers: [{ pts: [[-300, 10], [-80, 40], [0, 30], [80, 18], [300, 40]], w: 12, depth: 2, bank: 5 }],
  pads: [{ x: -10, z: -24, r: 30, soft: 8 }],
  roads: [{ pts: [[20, 34], [10, 14], [-4, 0], [-10, -12]], w: 3.4 }, { pts: [[-120, 40], [20, 34], [140, 26]], w: 3.4 }],
  weather: { mist: [{ y: 7, layers: 4, gap: 2.4, op: .6, col: 0xf2e6dc, scale: .02, drift: .6 }], birds: { n: 8, col: 0x2a2a2a, y: 40 } },
  fog: { y: 1, h: 6, d: .06, col: 0xf0d8c8 },
  wind: .2,
  views: [{ label: '台地', az: 200, el: 30, d: 1 }, { label: '座堂', az: 225, el: 22, d: .36, t: [-14, null, -26] }, { label: '回廊', az: 160, el: 40, d: .32, t: [12, null, -34] }, { label: '谷底村落', az: 190, el: 26, d: .4, t: [20, null, 36] }],
  build(c) {
    K.church(c, -16, -26, .25, { w: 14, len: 40, h: 16, transept: true, apse: true, twin: true, tower: 7, th: 26, spire: 16, wall: 0xe6e0d2, roof: 0x4b5664 });
    K.cloister(c, 14, -36, .25, { size: 26, wall: 0xe0d8c6, roof: 0x4b5664 });
    K.bld(c, 'cloister', -40, -8, { ry: .25, w: 18, d: 9, fl: 3 }); K.bld(c, 'cloister', 22, -6, { ry: .25, w: 14, d: 8, fl: 2 });
    tower(c.B, -36, c.h(-36, -40), -40, { r: 2.4, h: 22, wall: 0xe6e0d2, rcol: 0x4b5664 });
    K.fence(c, [[-50, -60], [36, -64], [42, -2], [-48, 4], [-50, -60]], { stone: true, col: 0xc8c0b0, h: 1.4 });
    K.cluster(c, 'cottage', 24, 40, 16, 16, { angle: .4, house: { rcol: 0x4b5664, rpat: P.slate } });
    K.bridge(c, [12, 22], [14, 46], { w: 4, span: 8 });
    K.stoneCircle(c, 70, -40, 6, 12);
    c.people(16, { at: [-6, -16, 20], cols: [0x2a2a2a, 0x4a3a2c, 0xe8e2d4] });
    c.trees(many(c, 420), { species: ['cone', 'cone', 'birch'], cols: [0x2f4a32, 0x3a5638, 0x5a7a3e], area: (x, z) => Math.hypot(x + 10, z + 24) > 40 ? 1 : 0 });
    c.grass(many(c, 2000), { cols: [0x6a8248, 0x5f7a44], area: (x, z) => Math.hypot(x + 10, z + 24) < 40 ? 1 : .2 });
  }
};

/* ================= 翁吉亚共和国：高原河谷的节庆广场 ================= */
COUNTRIES['翁吉亚共和国'] = {
  mode: 'open', R: 100, seed: 'ongia-festival', time: 'dusk', lit: .75,
  label: '高原河谷 · 节庆与冥府洞口', note: '春分前夜，广场的火盆都点上了，议事厅的台阶上坐满了人；北面崖下的洞口也有人举着火把进出。',
  water: { level: 0, shallow: 0x4a6a74, deep: 0x1e3a4a, clarity: .6, wave: .2, foam: .5 },
  palette: { grass: [0x7a8a4a, 0x6a7a44], dry: 0xa8925a, dryK: .6, dirt: 0x8a6a4a, rock: 0x8f7a64, sand: 0xb89a74 },
  strata: [0x5a4434, 0xa07a5a, 0x8a6a50, 0xb89070, 0x6a5040],
  height(x, z, c) {
    const cliff = smooth(-20, -50, z) * 34 * (1 + c.N.fbm(x * .02, 3, 2) * .3);
    return 6 + cliff + c.N.fbm(x * .015, z * .015, 4) * 4 - bump(x, z, 0, 54, 40, 6) + bump(x, z, 30, -300, 90, 220, 1.6);
  },
  rivers: [{ pts: [[-300, 70], [-80, 60], [0, 62], [90, 50], [300, 66]], w: 14, depth: 2, bank: 6 }],
  pads: [{ x: 0, z: 6, r: 22, soft: 6 }],
  roads: [{ pts: [[0, 6], [-4, 30], [-8, 56], [-12, 80]], w: 4 }, { pts: [[0, 6], [10, -14], [14, -30]], w: 3.4 }],
  weather: { motes: [{ kind: 'ember', n: 260, cols: [0xffb060, 0xff8040], size: .3, h: 16, speed: .3, rad: 30, y: 8 }], birds: { n: 6, col: 0x1a1a1a, y: 40 } },
  wind: .35,
  views: [{ label: '河谷', az: 180, el: 32, d: 1 }, { label: '广场', az: 200, el: 26, d: .34, t: [0, null, 6] }, { label: '冥府洞口', az: 170, el: 18, d: .3, t: [14, null, -26] }, { label: '旧神山', az: 180, el: 12, d: .6, t: [0, 40, -40] }],
  build(c) {
    K.temple(c, 0, -10, 0, { w: 16, len: 20, h: 7, roof: 0x9a5a3a, paint: 0x2f5a7a, col: 0xeee2cc });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; K.brazier(c, Math.cos(a) * 17, 6 + Math.sin(a) * 15, { light: k % 3 === 0 }); }
    for (let k = 0; k < 6; k++) K.bunting(c, [Math.cos(k) * 18, c.h(0, 6) + 6, 6 + Math.sin(k) * 16], [Math.cos(k + 2.5) * 18, c.h(0, 6) + 6, 6 + Math.sin(k + 2.5) * 16], [0xd04a3a, 0xe8b440, 0x3a6a9a, 0xf2ece0, 0x4a8a4a]);
    for (let k = 0; k < 8; k++) K.stall(c, -26 + k * 7, 26, 0, K.pick(c, [0xc0503a, 0xe0a040, 0x3a6a8a, 0x6a8a4a]));
    K.statue(c, -12, 10, { col: 0xb08a4a, h: 4.5 }); K.statue(c, 12, 10, { col: 0xb08a4a, h: 4.5 });
    K.cluster(c, 'highland', -36, 10, 20, 26, { angle: .1, r: 3 });
    K.cluster(c, 'highland', 36, 14, 20, 24, { angle: -.1, r: 3 });
    K.street(c, [[0, 6], [-4, 30], [-8, 56]], 'highland', { roadW: 4 });
    K.cave(c, 14, -27, 0, { s: 1.3 });
    K.stairs(c, [10, -6], [14, -20], 3);
    K.bridge(c, [-4, 48], [-10, 76], { w: 5, span: 9 });
    c.people(160, { at: [0, 10, 18], cols: [0xc0503a, 0xe0b050, 0x3a5a8a, 0xf2ece0, 0x5a7a3a, 0x8a3a5a] });
    c.people(20, { at: [14, -22, 8] });
    c.trees(many(c, 140), { species: ['column', 'round', 'pine'], cols: [0x4a6234, 0x56703a], area: (x, z) => Math.hypot(x, z - 6) > 34 ? .8 : 0 });
    c.rocks(80, { cols: [0x8f7a64, 0x9a8670], free: true, s: [.8, 2.8], maxSlope: 3, above: 2, area: (x, z) => z < -20 ? 1 : .1 });
  }
};

/* ================= 璇玑联邦：湖畔研究城 ================= */
COUNTRIES['璇玑联邦'] = {
  mode: 'open', R: 100, seed: 'xuanji-lake', time: 'morning', lit: .3,
  light: { top: 0x6a9ad8, hor: 0xe0ecf0, haze: 0xdce6ea, sun: 0xfff6ea },
  grade: { sat: 1.0, tint: [.97, 1, 1.03] },
  label: '湖群之间 · 研究院与精密工坊', note: '湖面的晨雾刚开始退，玻璃楼和白色穹顶的研究院沿岸排开，轻轨从水面上的高架穿过。',
  water: { level: 0, shallow: 0x5aa8b0, deep: 0x1a4a6a, clarity: .3, wave: .15, foam: .3 },
  palette: { grass: [0x6a9a4a, 0x5f8f46], dry: 0x9aa060, dryK: .2, sand: 0xd8d0b8, rock: 0x9a9a92, bed: 0x7a8a7a },
  height(x, z, c) {
    const lake = Math.hypot((x - 10) * .9, z - 20) - 52 + c.N.fbm(x * .02, z * .02, 3) * 16;
    return lake > 0 ? 1 + lake * .08 + bump(x, z, -90, -60, 50, 20) + bump(x, z, 80, -80, 40, 16) : lake * .12;
  },
  pads: [{ x: -36, z: -24, r: 26, soft: 8 }, { x: 52, z: -10, r: 16, soft: 6 }],
  weather: { mist: [{ y: 1.2, layers: 2, gap: 1.2, op: .3, col: 0xe8ecee, scale: .025, drift: .8 }], birds: { n: 10, col: 0xf2f2f2, y: 18 } },
  wind: .3,
  views: [{ label: '湖岸', az: 200, el: 30, d: 1 }, { label: '研究院', az: 210, el: 24, d: .38, t: [-36, null, -24] }, { label: '穹顶', az: 150, el: 26, d: .32, t: [52, null, -10] }, { label: '高架轻轨', az: 250, el: 18, d: .42, t: [0, 6, 10] }],
  build(c) {
    const B = c.B;
    for (const [x, z, h, r0] of [[-40, -30, 34, 5], [-26, -40, 26, 4.5], [-50, -12, 22, 4], [-20, -18, 18, 5.5]]) { const y = c.ground(x, z, r0 * 2, r0 * 2); B.frame(x, y, z); B.put('cyl16', 0, -1, 0, r0 * 2, h + 1, r0 * 2, 0xd8e4e8, P.glass); B.put('cyl16', 0, h, 0, r0 * 2.2, .8, r0 * 2.2, 0xf2f4f4, P.plain); B.put('hemi', 0, h + .8, 0, r0 * 1.4, 1.4, r0 * 1.4, 0x7a9a6a, P.leaf); B.frame(); c.occupy(x, z, r0 * 2.2, r0 * 2.2); }
    for (let k = 0; k < 8; k++) K.cluster(c, 'future', -40 + (k % 4) * 14, -60 + Math.floor(k / 4) * 50, 10, 2, { angle: 0, r: 6 });
    const y = c.ground(52, -10, 30, 30); B.frame(52, y, -10); B.put('hemi', 0, 0, 0, 28, 14, 28, 0xe8f0f2, P.glass); B.put('cyl16', 0, -1, 0, 30, 1.6, 30, 0xf2f2f0, P.plain); B.frame(); c.occupy(52, -10, 30, 30);
    K.viaduct(c, [[-140, 40], [-60, 20], [0, 12], [60, 30], [140, 40]], 7, { w: 3.2 });
    for (let k = 0; k < 3; k++) { const x = -40 + k * 5.6, z = 18 + k * .1; B.frame(x, Math.max(c.h(x, z), 0) + 7.7, z, Math.PI / 2 + .25); B.box(0, 0, 0, 2.6, 2.6, 5.4, 0xf6f6f4, P.plain); B.box(0, 1, 0, 2.7, .8, 5.5, 0x2a3a4a, P.glass); B.frame(); }
    K.solar(c, 60, -60, 30, 22, .2);
    for (const [x, z] of [[-90, -66], [-74, -80], [80, -84], [96, -70], [-104, -40]]) K.turbine(c, x, z, { h: 28, ry: .8 });
    K.pier(c, -6, 0, 10, Math.PI * .8, { w: 3 });
    for (let k = 0; k < 5; k++) { const x = -10 + c.r() * 50, z = 16 + c.r() * 40; if (c.h(x, z) < -1) K.boatAt(c, x, z, c.r() * 6, { len: 6, kind: 'steam', hull: 0xf2f2f0, stripe: 0x3a8aa0, cabin: 0x2a3a4a, funnel: 0xf2f2f0 }); }
    c.people(70, { at: [-30, -20, 30], cols: [0xe8e8e8, 0x3a4a5a, 0x5a8aa0, 0x2a2a2a] });
    c.trees(many(c, 220), { species: ['round', 'birch', 'column'], cols: [0x4f8a3e, 0x5a9a44, 0x6aa04a], area: (x, z) => .6 });
    c.grass(many(c, 3000), { cols: [0x6a9a4a, 0x7aa852] });
  }
};

/* ================= 霁川公国：雨后的稻田与粮市 ================= */
COUNTRIES['霁川公国'] = {
  mode: 'open', R: 100, seed: 'jichuan-paddy', time: 'morning', wet: .7,
  light: { top: 0x6a90c8, hor: 0xe4e8e0, haze: 0xd8e0dc, si: 3 },
  label: '河湖平原 · 稻田与粮市', note: '一夜雨后，水田里倒映着天，坡上的梯田一层层亮着；粮船在河埠头排队，田庄的围墙在河对岸。',
  water: { level: 0, shallow: 0x5a8a7a, deep: 0x23484e, clarity: .6, wave: .12, foam: .3 },
  palette: { grass: [0x6a9a3e, 0x5f8f3a], dry: 0x9aa05a, dryK: .2, dirt: 0x6a5a40, sand: 0xa8a080, rock: 0x7a7a6a,
    paint(x, z, h, s, col, c, out) {
      const terr = x < -30 && h > 2.5;
      if ((h > .4 && h < 2.2 && Math.hypot(x - 20, z + 10) > 34) || terr) {
        const k = fields(col, x, z, .5, terr ? 9 : 16, terr ? 6 : 12, [0x6aa04a, 0x5a9a50, 0x7ab060, 0x4a8a5a], .7);
        if (k < .6) { col.lerp(lin(0x8ab0b8), .45); out.roughF = .18; }
      }
    } },
  height(x, z, c) { const hill = smooth(-20, -80, x) * 22 + c.N.fbm(x * .02, z * .02, 3) * 4 * smooth(-20, -80, x); return 1.2 + terrace(hill, 1.6, .9) + c.N.fbm(x * .03, z * .03, 2) * .3; },
  ground: null,
  rivers: [{ pts: [[200, -300], [60, -60], [40, 0], [20, 40], [40, 120], [100, 300]], w: 18, depth: 2.4, bank: 4 }, { pts: [[-20, -120], [-6, -40], [30, -6]], w: 5, depth: 1.6, bank: 2 }, { pts: [[40, 20], [-10, 30], [-60, 60]], w: 5, depth: 1.6, bank: 2 }],
  pads: [{ x: 22, z: -12, r: 20, soft: 6 }, { x: 64, z: 20, w: 30, d: 24, ry: .2, soft: 5 }],
  weather: { rainbow: { op: .32 }, clouds: { n: 6, y: 44, size: 8, inner: .6, spread: 1 }, birds: { n: 12, col: 0xf2f2f2, y: 14 } },
  wind: .3,
  views: [{ label: '雨后', az: 200, el: 30, d: 1 }, { label: '河埠粮市', az: 230, el: 24, d: .36, t: [22, null, -12] }, { label: '梯田', az: 120, el: 28, d: .42, t: [-50, null, 0] }, { label: '田庄', az: 200, el: 26, d: .36, t: [64, null, 20] }],
  build(c) {
    K.street(c, [[2, -30], [14, -14], [24, 2], [30, 14]], 'paddy', { roadW: 3.4 });
    K.cluster(c, 'paddy', 18, -16, 14, 20, { angle: .7, r: 3 });
    for (let k = 0; k < 6; k++) K.stall(c, 30 + k * 3, -24 + k * 2.4, .7, K.pick(c, [0xd9cfb8, 0x7a5a3a, 0xa0503a]));
    for (let k = 0; k < 6; k++) K.boatAt(c, 46 + k * 2, -40 + k * 10, 1.9 + c.r() * .3, { len: 8, kind: c.r() < .5 ? 'junk' : 'barge', hull: 0x5a4636, cargo: 0xd8b25a, sail: 0xc0a070 });
    // 田庄：围墙 + 大宅 + 粮仓
    K.fence(c, [[48, 6], [80, 12], [76, 36], [46, 30], [48, 6]], { stone: true, col: 0xd8d0c0, h: 1.8 });
    K.bld(c, 'paddy', 64, 20, { w: 14, d: 9, fl: 2, ry: .2, roof: 'curve', rcol: 0x4a5258 });
    for (let k = 0; k < 3; k++) K.bld(c, 'paddy', 54 + k * 8, 30, { w: 6, d: 5, fl: 1, ry: .2, roof: 'hip', rcol: 0x8a7a58, rpat: P.thatch });
    K.waterwheel(c, 2, 30, .4);
    for (let k = 0; k < 8; k++) K.hay(c, -10 + k * 3.4, 46 + (k % 2) * 3);
    c.people(40, { at: [-10, 10, 50], cols: [0x3a4a5a, 0x6a5a3a, 0xd8d0bc] }); c.people(50, { at: [22, -12, 16] });
    c.animals('cow', 6, { at: [-20, 50, 20], cols: [0x4a4038, 0x2a2622] });
    c.trees(many(c, 120), { species: ['willow'], cols: [0x6a9a48, 0x7aa850], at: [30, 0, 70], k: 1.1, area: (x, z) => c.nearRiver(x, z, 10) ? 1 : 0, riverPad: 1 });
    c.trees(many(c, 160), { species: ['round', 'bamboo'], cols: [0x4f7a34, 0x5d8a3a], area: (x) => x < -60 ? .6 : .15 });
  }
};

/* ================= 契莱西亚保护国：雨林山地与外派要塞 ================= */
COUNTRIES['契莱西亚保护国'] = {
  mode: 'open', R: 100, seed: 'chileisia-jungle', time: 'rain',
  light: { top: 0x5a6a6a, hor: 0x8a9690, haze: 0x7a8a84, sun: 0xd8e0d0, si: .9 },
  label: '雨林山地 · 海关与要塞', note: '河口的海关和炮台挂着别国的旗，窄轨铁路钻进山里通到矿上；上游的王宫是高脚木楼，比要塞矮得多。',
  water: { level: 0, shallow: 0x5a6a48, deep: 0x23383a, clarity: 1, wave: .3, foam: .6 },
  palette: { grass: [0x3f6a2c, 0x355e28], dry: 0x6a7a3a, dryK: .15, dirt: 0x7a4a30, rock: 0x5a5a4e, sand: 0xa89a7a, bed: 0x4a4a38 },
  height(x, z, c) {
    const coast = -(z - 50) + c.N.fbm(x * .02, z * .02, 3) * 12;
    const mtn = c.N.ridge(x * .014 + 3, z * .014, 5) * 46 * smooth(30, -60, z);
    return coast > 0 ? 1 + coast * .05 + mtn + c.N.fbm(x * .03, z * .03, 3) * 3 : coast * .2;
  },
  rivers: [{ pts: [[-20, -300], [-30, -80], [-10, -20], [10, 30], [16, 80]], w: 14, depth: 2.4, bank: 5 }],
  pads: [{ x: 30, z: 36, r: 14, soft: 6 }, { x: -30, z: -16, r: 12, soft: 5 }],
  roads: [{ pts: [[30, 36], [20, 20], [-2, 6], [-20, -24]], w: 3 }],
  weather: { rain: .8, mist: [{ y: 22, layers: 3, gap: 6, op: .5, col: 0xc8d0cc, scale: .02 }] },
  fog: { y: 4, h: 14, d: .02, col: 0x9aa49e },
  wind: .5,
  views: [{ label: '河口', az: 170, el: 30, d: 1 }, { label: '要塞', az: 200, el: 22, d: .34, t: [30, null, 36] }, { label: '王宫', az: 150, el: 26, d: .34, t: [-30, null, -16] }, { label: '矿区铁路', az: 230, el: 30, d: .45, t: [-20, null, -50] }],
  build(c) {
    K.castle(c, 34, 38, { r: 10, sides: 5, col: 0xb8b0a0, flat: true, kh: 8, flag: 0x8a1a2a });
    K.bld(c, 'colonial', 14, 44, { w: 14, d: 9, fl: 2, ry: .1 }); K.bld(c, 'colonial', 2, 38, { w: 10, d: 7, fl: 1 });
    K.pier(c, 20, 54, 12, 0, { w: 3 });
    K.boatAt(c, 26, 70, .3, { len: 20, kind: 'steam', hull: 0x2a2a2a, stripe: 0x8a1a2a, cabin: 0xe8e2d4 });
    K.boatAt(c, 4, 64, 2.3, { len: 6, hull: 0x5a3a26 });
    // 王宫：大号高脚楼 + 多层屋顶
    K.bld(c, 'stilt', -30, -16, { w: 16, d: 10, lift: 2.4, extra: { pitch: 1.1 }, rcol: 0x8a6a3a });
    K.bld(c, 'stilt', -30, -16, { w: 9, d: 6, lift: 8, extra: { pitch: 1.2 }, rcol: 0x9a7a40 });
    K.cluster(c, 'stilt', -10, -40, 16, 14, { angle: .5 });
    K.cluster(c, 'stilt', 0, 20, 12, 8, { angle: .2 });
    const rail = [[-2, 36], [-12, 10], [-30, -30], [-20, -70], [-40, -100]];
    c.rail(rail); K.train(c, rail, .2, 4, { open: true, cargo: 0x6a5a4a, loco: 0x3a2a26 });
    K.headframe(c, -36, -84, .5, { h: 10, wood: true, col: 0x5a4636 });
    K.poles(c, [[30, 36], [10, 20], [-14, 0], [-30, -30]]);
    c.trees(many(c, 700), { species: ['broad', 'broad', 'palm', 'round'], cols: [0x2a5a28, 0x356a2c, 0x2f4f24, 0x407030], k: 1.1, maxSlope: 1.4 });
    c.people(30, { at: [20, 40, 20], cols: [0xe8e2d4, 0x6a4a35, 0x8a2a2a] }); c.people(20, { at: [-24, -20, 18] });
  }
};

/* ================= 罗歇阿普公国：三角洲种植园，雷雨黄昏 ================= */
COUNTRIES['罗歇阿普公国'] = {
  mode: 'open', R: 95, seed: 'rochaap-delta', time: 'storm', lit: .5,
  label: '湿热河港 · 种植园', note: '甘蔗田一直铺到河边，庄园主的白宅在高处，工棚挤在田埂旁；暴雨前的风把烟囱的烟压得很低。',
  water: { level: 0, shallow: 0x7a6a44, deep: 0x4a3e28, clarity: 1.3, wave: .45, foam: .4 },
  palette: { grass: [0x5f7a34, 0x6a8a38], dry: 0x8a8a44, dryK: .3, dirt: 0x6a4a30, sand: 0x9a8a68, rock: 0x6a6050, bed: 0x4a3e2c, mud: 0x3e3424,
    paint(x, z, h, s, col) { if (h > 1 && h < 4 && x > -20) fields(col, x, z, -.3, 26, 14, [0x7a9a38, 0x8aaa40, 0x6a8a30, 0x9a8a48], .6); } },
  height(x, z, c) { return 1.3 + c.N.fbm(x * .01, z * .01, 3) * 1.6 + bump(x, z, -60, -40, 40, 8) + bump(x, z, -90, 30, 30, 5); },
  rivers: [{ pts: [[-300, 60], [-60, 50], [0, 34], [60, 50], [300, 30]], w: 30, depth: 2.6, bank: 6 }, { pts: [[40, -200], [30, -60], [20, 0], [10, 34]], w: 9, depth: 1.8, bank: 4 }],
  pads: [{ x: -56, z: -36, r: 16, soft: 6 }, { x: -6, z: 16, w: 30, d: 12, soft: 4 }],
  roads: [{ pts: [[-56, -36], [-30, -10], [-6, 14]], w: 3.6 }],
  weather: { rain: .55, lightning: { every: 5 }, clouds: { n: 5, kind: 'storm', col: 0x4a4e56, y: 46, size: 11, inner: 1, spread: .9, speed: 2.4 } },
  wind: 1,
  views: [{ label: '三角洲', az: 160, el: 30, d: 1 }, { label: '庄园', az: 200, el: 24, d: .34, t: [-56, null, -36] }, { label: '河港', az: 150, el: 22, d: .36, t: [-6, null, 18] }, { label: '甘蔗田', az: 120, el: 30, d: .42, t: [40, null, -20] }],
  build(c) {
    K.veranda(c, -56, -36, .4, { w: 22, d: 13, wall: 0xf6f2e8, roof: 0x5a6068, h: 4.2 });
    for (let k = 0; k < 10; k++) c.I.tree('palm', -76 + k * 4, c.h(-76 + k * 4, -16), -16 - k * 1.6, 1.2, 0x5a8a3a);
    for (let k = 0; k < 8; k++) K.bld(c, 'stilt', -20 + k * 6.5, -16 + (k % 2) * 6, { ry: .2, w: 5, d: 4, lift: .8, rpat: P.metal, rcol: 0x6a5a4a });
    K.factory(c, 10, -6, .2, { w: 12, len: 16, h: 6, wall: 0x9a6a50, chimneys: [[0, 10, 16]], chim: { smokeCol: 0x4a4440, size: 5 } });
    for (let k = 0; k < 4; k++) K.bld(c, 'colonial', -12 + k * 10, 14, { ry: Math.PI, w: 9, d: 6, fl: 1 });
    K.pier(c, -6, 22, 14, 0, { w: 3 }); K.pier(c, 16, 22, 10, 0);
    K.boatAt(c, 0, 44, 1.6, { len: 22, kind: 'steam', hull: 0xe8e0d0, stripe: 0x2a2a2a, cabin: 0xf2ece0 });
    K.boatAt(c, 30, 46, 1.4, { len: 10, kind: 'barge', hull: 0x4a3a2c, cargo: 0xa08a50 });
    c.grass(many(c, 9000), { cols: [0x7a9a38, 0x8aaa40, 0x6a8a30], k: 3.2, area: (x, z) => x > -20 && z < 10 ? 1 : 0, roadPad: 2 });
    c.trees(many(c, 200), { species: ['palm', 'broad', 'round'], cols: [0x3f6a2c, 0x4a7a30], area: (x, z) => x < -20 || z > 60 ? .8 : .05 });
    c.trees(many(c, 120), { species: ['shrub'], cols: [0x2f5a2a, 0x3a6a2e], k: 2, area: (x, z) => c.nearRiver(x, z, 6) ? 1 : 0, riverPad: 0, above: -.2 });
    c.people(50, { at: [10, -24, 30], cols: [0xe8e2d4, 0x6a4a35, 0x4a3a2a] });
  }
};

/* ================= 奥嫩堡王国：秋日城堡与修道院 ================= */
COUNTRIES['奥嫩堡王国'] = {
  mode: 'open', R: 100, seed: 'onenburg-castle', time: 'afternoon',
  light: { sun: 0xffd9a8, si: 3.2, hor: 0xe8d8c0, haze: 0xe0d0b8, el: 24 },
  label: '北部领地 · 城堡、修道院与林地', note: '城堡占着村子上方的岩丘，修道院隔着小溪；树林已经黄了大半，条田刚收完。',
  water: { level: 0, shallow: 0x4a6a6a, deep: 0x1e3640, clarity: .6, wave: .15, foam: .3 },
  palette: { grass: [0x7a8a44, 0x6a7a3c], dry: 0xa8925a, dryK: .55, dirt: 0x7a6248, rock: 0x7f7a70,
    paint(x, z, h, s, col) { if (Math.hypot(x - 30, z - 20) < 50 && h < 9 && h > 1) fields(col, x, z, .6, 6, 40, [0xb8a060, 0x8a7a48, 0x6a7a3a, 0xc8b070, 0x7a5a3a], .7); } },
  height(x, z, c) { return 2 + c.N.fbm(x * .012, z * .012, 4) * 8 + bump(x, z, -20, -20, 18, 18, 1.6) + c.N.ridge(x * .05, z * .05, 3) * 3 * smooth(30, 0, Math.hypot(x + 20, z + 20)); },
  rivers: [{ pts: [[-300, 90], [-60, 40], [10, 20], [40, -30], [100, -120], [300, -200]], w: 9, depth: 1.6, bank: 4 }],
  pads: [{ x: -20, z: -20, r: 15, soft: 4 }, { x: 52, z: -36, r: 16, soft: 6 }, { x: 10, z: 20, r: 18, soft: 6 }],
  roads: [{ pts: [[-20, -20], [-8, 2], [10, 20], [30, 50]], w: 3.4 }],
  weather: { leaves: { n: 700, cols: [0xd0802a, 0xb84a22, 0xe0b040, 0x8a5a2a] }, birds: { n: 10, col: 0x1a1a1a, y: 40 } },
  wind: .55,
  views: [{ label: '领地', az: 200, el: 32, d: 1 }, { label: '城堡', az: 220, el: 24, d: .36, t: [-20, null, -20] }, { label: '村庄', az: 170, el: 26, d: .34, t: [10, null, 20] }, { label: '修道院', az: 140, el: 28, d: .34, t: [52, null, -36] }],
  build(c) {
    K.castle(c, -20, -20, { r: 13, sides: 7, col: 0xa8a090, roof: 0x3e4a56, keepRoof: true, kh: 16, flag: 0x6a2a7a });
    K.cluster(c, 'feudal', 10, 22, 18, 26, { angle: .3, r: 3 });
    K.street(c, [[-8, 2], [10, 20], [30, 50]], 'feudal', { roadW: 3.4 });
    K.church(c, 18, 10, .3, { w: 7, len: 14, h: 7, wall: 0xd8d0be, roof: 0x5a4a40, rpat: P.tile, th: 14 });
    K.cloister(c, 52, -36, -.2, { size: 22, wall: 0xd8d0be, roof: 0x5a4a40 });
    K.church(c, 52, -56, -.2, { w: 8, len: 18, h: 9, wall: 0xd8d0be, roof: 0x5a4a40, rpat: P.tile });
    K.rows(c, 70, -20, 18, 16, -.2, { species: 'round', row: 4, step: 4, cols: [0xa0782a, 0xc08a30], s: [.5, .6] });
    K.windmill(c, 40, 46, { col: 0xe6dcc8 });
    for (let k = 0; k < 6; k++) K.hay(c, 30 + k * 4, 30 + (k % 3) * 3, 0xd8b25a);
    c.animals('sheep', 30, { at: [-50, 30, 20], cols: [0xe8e2d4, 0xd8d0c0, 0x3a3430] });
    c.people(40, { at: [10, 20, 20], cols: [0x6a4a35, 0x3a5a3a, 0x8a3a2a, 0xd8cfb8] });
    c.trees(many(c, 520), { species: ['round', 'round', 'birch', 'cone'], cols: [0xc8742a, 0xb04a22, 0xd8a83a, 0x8a6a2a, 0x5a6a2e, 0x3a5030], area: (x, z) => Math.hypot(x - 30, z - 20) > 48 ? 1 : .05 });
    c.grass(many(c, 2500), { cols: [0x8a8a48, 0x9a8a4c] });
  }
};

/* ================= 卡斯奎尼亚王国：草原、毡帐与石堡 ================= */
COUNTRIES['卡斯奎尼亚王国'] = {
  mode: 'open', R: 110, seed: 'kaskuinia-steppe', time: 'afternoon',
  light: { top: 0x4f86d0, hor: 0xd8e4ea, sun: 0xfff0d6, si: 3.5, el: 32 },
  label: '中北草原 · 毡帐、石堡与秋季大集', note: '风从西边一直吹过来，草浪一阵一阵地伏下去；部族的毡帐和骑士的石堡隔着一片集场，旗帜都插在同一块地上。',
  water: { level: 0, shallow: 0x4a7a8a, deep: 0x1e4a5a, clarity: .5, wave: .3, foam: .4 },
  palette: { grass: [0x8a9a4a, 0x7a8f44], dry: 0xc0a860, dryK: .75, dirt: 0x8a7050, rock: 0x8a8476,
    paint(x, z, h, s, col) { if (Math.hypot(x + 40, z + 40) < 34) fields(col, x, z, .2, 14, 30, [0xc8a85a, 0xa89048, 0x8a8a40], .7); } },
  height(x, z, c) { return Math.max(1.2, 4.5 + c.N.fbm(x * .006, z * .006, 4) * 9 + bump(x, z, -40, -40, 22, 8) + c.N.fbm(x * .03, z * .03, 2) * .6); }, // 干草原：除河道外不积水
  rivers: [{ pts: [[-300, 120], [-40, 70], [40, 76], [300, 40]], w: 8, depth: 1.4, bank: 3 }],
  pads: [{ x: 20, z: 6, r: 24, soft: 8 }],
  weather: { clouds: { n: 9, y: 54, size: 9, inner: .1, spread: 1.2, speed: 4 }, motes: { kind: 'dust', n: 500, cols: [0xe8dcb8], size: .22, op: .4, h: 8, rad: 100 }, birds: { n: 6, col: 0x1a1a1a, y: 50 } },
  windDir: [1, .2], wind: 1,
  views: [{ label: '草原', az: 200, el: 30, d: 1 }, { label: '大集', az: 210, el: 22, d: .38, t: [20, null, 6] }, { label: '石堡', az: 160, el: 26, d: .34, t: [-40, null, -40] }, { label: '毡帐', az: 240, el: 24, d: .36, t: [50, null, -40] }],
  build(c) {
    K.castle(c, -40, -40, { r: 9, sides: 4, rot: .4, col: 0x9a9284, roof: 0x4a4a4a, kh: 13, flag: 0x8a2a2a });
    K.cluster(c, 'cottage', -30, -14, 12, 8, { angle: .4, house: { rpat: P.thatch, rcol: 0x9a8a5a } });
    for (let k = 0; k < 16; k++) { const a = c.r() * 6.28, d = 6 + c.r() * 20; K.yurt(c, 50 + Math.cos(a) * d, -40 + Math.sin(a) * d, { r: 2.4 + c.r(), smoke: k % 4 === 0, band: K.pick(c, [0x9a3a2c, 0x2a5a8a, 0xc8a040]) }); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; K.pavilion(c, 20 + Math.cos(a) * 18, 6 + Math.sin(a) * 18, K.pick(c, [0xe8dcc0, 0xc04a3a, 0x3a5a8a, 0xe0b050])); }
    for (let k = 0; k < 8; k++) K.banner(c, 20 + Math.cos(k * .8) * 8, 6 + Math.sin(k * .8) * 8, 9, k % 2 ? 0x8a2a2a : 0x2a4a8a, k * .8);
    K.fence(c, [[2, 30], [36, 30], [36, 44], [2, 44], [2, 30]], { col: 0x6a5038 });
    c.animals('horse', 40, { at: [10, 60, 30], cols: [0x5a3a26, 0x2a2420, 0x8a6a4a, 0xd8cfc0] });
    c.animals('horse', 16, { at: [19, 37, 7], cols: [0x5a3a26, 0x2a2420] });
    c.animals('sheep', 60, { at: [-50, 40, 30], cols: [0xe8e2d4, 0xd8d0c0] });
    c.people(110, { at: [20, 6, 22], cols: [0x8a2a2a, 0x2a4a8a, 0xd8cfb8, 0x6a4a35, 0x3a5a3a] });
    c.trees(many(c, 60), { species: ['birch', 'round'], cols: [0x8a9a44, 0x6a8a3a], area: () => .3 });
    c.grass(many(c, 16000), { cols: [0x9aa84e, 0xb0a85a, 0x8a9a48, 0xc0b060], k: 1.6, maxSlope: 1 });
  }
};

/* ================= 塞雷格帝国：正午的阅兵大道 ================= */
COUNTRIES['塞雷格帝国'] = {
  mode: 'open', R: 105, seed: 'sereg-parade', time: 'harsh',
  grade: { sat: .96, tint: [1.03, 1, .95] },
  label: '复兴之都 · 阅兵大道', note: '正午，凯旋门到枢密院的大道上队列整齐，两侧同样高度的石楼挂着同样的旗；城外的土路上只有骡车。',
  water: false,
  palette: { grass: [0x9a9a58, 0x8a8a50], dry: 0xc8b07a, dryK: .85, dirt: 0xa08a64, rock: 0xa09888, sand: 0xc8b48a,
    paint(x, z, h, s, col) { if (Math.abs(x) > 50 || Math.abs(z) > 80) fields(col, x, z, 0, 30, 20, [0xc0a868, 0xa89a5a, 0x8a8a50, 0xd0b878], .55); } },
  height(x, z, c) { return 2 + c.N.fbm(x * .008, z * .008, 3) * 2.4 * smooth(30, 80, Math.abs(x)); },
  pads: [{ x: 0, z: 0, w: 70, d: 200, soft: 10 }],
  roads: [{ pts: [[0, 110], [0, -90]], w: 16 }, { pts: [[-100, 20], [100, 20]], w: 8 }],
  weather: { motes: { kind: 'dust', n: 250, cols: [0xe8d8b0], size: .2, op: .3, h: 6, rad: 100 }, birds: { n: 8, col: 0x1a1a1a, y: 40 } },
  wind: .2,
  views: [{ label: '大道', az: 180, el: 34, d: 1 }, { label: '枢密院', az: 180, el: 22, d: .36, t: [0, null, -68] }, { label: '凯旋门', az: 160, el: 20, d: .34, t: [0, null, 70] }, { label: '队列', az: 230, el: 26, d: .3, t: [0, null, 10] }],
  build(c) {
    // 枢密院：大柱廊立面
    K.temple(c, 0, -78, 0, { w: 46, len: 26, h: 14, cols: 14, col: 0xcfc6b4, roof: 0x8a7a68, cella: 0xbdb4a2 });
    K.triumphalArch(c, 0, 76, 0, { w: 28, h: 22, banner: 0xa02a22 });
    for (let k = -3; k <= 3; k++) for (const s of [-1, 1]) K.bld(c, 'imperial', s * 22, k * 24, { ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, w: 20, d: 12, fl: 4 });
    for (let k = -8; k <= 8; k++) for (const s of [-1, 1]) K.banner(c, s * 9, k * 9, 10, 0xa02a22, 0);
    K.obelisk(c, 0, 20, 24);
    for (const s of [-1, 1]) K.statue(c, s * 12, 44, { col: 0x5a6058, h: 6, base: 4 });
    // 方阵
    for (let b = 0; b < 4; b++) for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) c.I.small('person', -6 + i * 2.4 + (b % 2) * .01, c.h(0, 0) , -30 + b * 22 + j * 1.6, 1, b % 2 ? 0x3a3e34 : 0x4a2a24, Math.PI);
    c.rail([[-160, -40], [-60, -36], [60, -36], [160, -30]]);
    K.train(c, [[-160, -40], [-60, -36], [60, -36], [160, -30]], .55, 6, { loco: 0x2a2a2a });
    for (let k = 0; k < 5; k++) K.cart(c, 70 + k * 6, 22 + (k % 2), Math.PI / 2, 0x7a5a3c);
    c.animals('horse', 6, { at: [76, 24, 10], cols: [0x6a5a48] });
    c.people(80, { at: [0, 20, 60], cols: [0x2a2a2a, 0x5a5048, 0x8a7a68, 0x3a3a46] });
    c.trees(many(c, 120), { species: ['column', 'round'], cols: [0x4a5a30, 0x5a6a38], area: (x) => Math.abs(x) > 40 ? .6 : 0 });
  }
};

/* ================= 艾迪州：雾里的矿山与海岸 ================= */
COUNTRIES['艾迪州'] = {
  mode: 'open', R: 95, seed: 'aidi-mines', time: 'mist',
  label: '临海山地 · 矿冶与港运', note: '山腰的露天矿一层层削下去，矿石顺着皮带送到海边的矿砂码头；谷地里是集体农庄，晨雾贴着海岸不肯散。',
  water: { level: 0, shallow: 0x3a6a70, deep: 0x123040, clarity: .5, wave: .35, foam: 1 },
  palette: { grass: [0x5f7a44, 0x546f3e], dry: 0x8a8a5a, dryK: .3, dirt: 0x8a6a50, rock: 0x7a6a5a, sand: 0xb0a080,
    paint(x, z, h, s, col) { const d = Math.hypot(x + 30, z + 34); if (d < 30 && h > 10) col.lerp(lin(0x9a7a5a), smooth(30, 18, d)); if (Math.hypot(x - 40, z + 10) < 30 && h < 8 && h > 1) fields(col, x, z, .3, 18, 14, [0x7a8a44, 0x9a9050, 0x6a7a3a], .6); } },
  height(x, z, c) {
    const coast = -(z - 40) + c.N.fbm(x * .02, z * .02, 3) * 14;
    let h = coast > 0 ? 1 + coast * .12 + c.N.ridge(x * .012, z * .012, 5) * 34 * smooth(10, 70, coast) : coast * .25;
    const pit = Math.hypot(x + 30, z + 34);
    if (pit < 28) h = lerp(terrace(h - (28 - pit) * .6, 2.6, .9), h, smooth(20, 28, pit));
    h = lerp(h, 3 + c.N.fbm(x * .02, z * .02, 2), smooth(32, 12, Math.hypot(x - 40, z + 10)));
    return Math.max(h, -10);
  },
  pads: [{ x: 6, z: 44, r: 10, soft: 6 }],
  roads: [{ pts: [[6, 44], [20, 30], [30, 10], [40, -10], [10, -24], [-10, -30]], w: 3.4 }],
  weather: { mist: [{ y: 3, layers: 2, gap: 2.5, op: .32, col: 0xe8ecea, scale: .022, drift: 1.2 }], birds: { n: 10, col: 0xeeeeee, y: 16 } },
  fog: { y: 0, h: 7, d: .018, col: 0xd8dcda },
  wind: .4,
  views: [{ label: '矿山海岸', az: 12, el: 30, d: 1 }, { label: '露天矿', az: 20, el: 40, d: .4, t: [-30, null, -34] }, { label: '矿砂码头', az: 340, el: 24, d: .34, t: [6, null, 48] }, { label: '农庄', az: 35, el: 30, d: .38, t: [40, null, -10] }],
  build(c) {
    K.headframe(c, -10, -46, .8, { h: 13 });
    K.conveyor(c, [-14, c.h(-14, -20) + 8, -20], [4, c.wl + 9, 52], {});
    K.pier(c, 4, 46, 14, 0, { w: 5, stone: 0x6a665e });
    K.boatAt(c, 10, 64, -.1, { len: 22, kind: 'steam', hull: 0x3a3430, stripe: 0x9a2a22, cabin: 0xd8d0c0 });
    for (let k = 0; k < 4; k++) K.bld(c, 'barrack', 30 + (k % 2) * 18, -14 + Math.floor(k / 2) * 12, { ry: .3, w: 16, d: 6, rcol: 0x5a5048, rpat: P.wood, wall: 0xb8a890, wpat: P.plaster });
    K.bld(c, 'workers', 18, 24, { w: 14, d: 8, fl: 2, ry: .4, roof: 'gable', rcol: 0x5a5048 });
    K.cluster(c, 'fisher', -10, 52, 10, 8, { angle: .1 });
    K.heap(c, 0, 36, 5, 4, 0x8a5a3a);
    K.poles(c, [[6, 44], [24, 28], [36, 6], [44, -12]]);
    for (let k = 0; k < 3; k++) K.cart(c, 22 + k * 3, 24 - k * 4, .8);
    c.animals('cow', 12, { at: [44, -4, 16], cols: [0x6a4a35, 0x2c2622] });
    c.people(30, { at: [30, 0, 30], cols: [0x3a4a5a, 0x4a4a42, 0x5a5048] });
    c.trees(many(c, 380), { species: ['cone', 'pine', 'round'], cols: [0x2f4a32, 0x3a5638, 0x4a6034], area: (x, z) => Math.hypot(x + 30, z + 34) > 32 ? 1 : 0, maxSlope: 1.2 });
  }
};
