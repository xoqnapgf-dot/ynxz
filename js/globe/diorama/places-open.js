/* 国家与大地区：半开放沙盘。中心一块代表性区域，往外降级为色块并淡入背景。 */
import * as K from './props.js';
import { P, lin } from './kit.js';
import { bump, terrace, ridgeLine, coastDist, island, smooth, clamp, lerp, segDist } from './terrain.js';

export const COUNTRIES = {};
const many = (c, n) => c.coarse ? Math.round(n * .4) : n;

/* ================= 铁枢人民共和国：大河平原上的钢铁城 ================= */
COUNTRIES['铁枢人民共和国'] = {
  mode: 'open', R: 110, seed: 'tieshu-steel', time: 'overcast', hazeK: 1.2,
  label: '大河平原 · 钢铁与铁路', note: '高炉日夜不熄，铁路桥把轧钢厂和对岸的编组站接在一起；单位宿舍楼一排排朝着厂门。',
  water: { level: 0, shallow: 0x5b6a5a, deep: 0x2a3a3a, clarity: .9, wave: .25, foam: .4 },
  palette: { grass: [0x7a7f52, 0x6a744a], dry: 0x8f8660, dryK: .7, dirt: 0x5e5446, rock: 0x7a746a, sand: 0x9a8c70, bed: 0x5a5444, mud: 0x3e3a32,
    paint(x, z, h, s, col, c) {
      // 集体农场的大块条田
      const u = x * .94 + z * .34, v = -x * .34 + z * .94;
      if (Math.hypot(x, z) > 62 && h > .8) {
        const cell = Math.floor(u / 34) * 7 + Math.floor(v / 22), k = (Math.sin(cell * 12.9898) * 43758.5) % 1;
        const fc = [0x8a7a52, 0x6f7a44, 0x9a8a5a, 0x5e5a40, 0x7f8a4a][Math.floor(Math.abs(k) * 5)];
        const furrow = .9 + .1 * Math.sin(v * 2.4);
        col.lerp(lin(fc).multiplyScalar(furrow), .8);
      }
      // 厂区地面：煤灰
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
    K.heap(c, -50, -48, 8, 5, 0x3a3532); K.heap(c, -38, -54, 7, 4, 0x6a4a3a);
    K.tanks(c, 10, -46, 4, { col: 0xa8a49a });
    // 单位宿舍
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const x = -70 + i * 26 + j * 4, z = 30 + j * 20 - i * 4;
      if (c.usable(x, z, { r: 4, road: false })) K.bld(c, 'workers', x, z, { ry: .35 + Math.PI / 2 });
    }
    K.statue(c, -36, 22, { col: 0x5a6058, h: 5 });
    for (let k = 0; k < 6; k++) K.flag(c, -44 + k * 3, c.h(-44 + k * 3, 14), 14 - k * 1.1, 6, 0xb03028);
    K.poles(c, [[-120, 46], [-60, 34], [-30, 16], [-12, -2]]);
    // 编组站与仓库（对岸）
    for (let k = 0; k < 3; k++) K.bld(c, 'workers', 40 + k * 18, 70 - k * 8, { ry: -.4, fl: 1, roof: 'gable', rcol: 0x4a4744, w: 16, d: 9 });
    K.train(c, rail, .62, 7, { cars: [0x6a3a2c, 0x5a4a3a] });
    // 河上驳船
    K.boatAt(c, -40, -48 + 6, .55, { len: 14, kind: 'barge', hull: 0x3a3a36, cargo: 0x2a2826 });
    K.boatAt(c, 60, 38, .45, { len: 12, kind: 'barge', hull: 0x4a3a30, cargo: 0x8a6a4a });
    c.people(70, { at: [-30, 0, 50], cols: [0x3a4a5a, 0x4a4a42, 0x5a5048, 0x2a3440] });
    c.trees(many(c, 260), { species: ['round', 'birch', 'column'], cols: [0x56663a, 0x4a5a34, 0x6a7040], area: (x, z) => Math.hypot(x + 20, z + 20) > 50 ? .7 : 0, rmax: 200 });
    c.grass(many(c, 3000), { cols: [0x7a7f52, 0x6a744a], rmax: 110, area: (x, z) => Math.hypot(x + 20, z + 18) > 45 ? 1 : 0 });
  }
};
