/* 小地点：完整底座的沙盘。 */
import * as K from './props.js';
import { P, lin } from './kit.js';
import { bump, terrace, island, smooth, clamp, lerp, segDist } from './terrain.js';

export const SITES = {};

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
function coarse(c, n) { return c.coarse ? Math.round(n * .35) : n; }
