/* 地形配方用的小工具：都是 (x,z) → 高度 的纯函数组合。 */
import { smooth, clamp, lerp, segDist } from './noise.js';

export const bump = (x, z, cx, cz, r, h, p = 2) => h * Math.exp(-Math.pow(Math.hypot(x - cx, z - cz) / r, p));
export const ridgeLine = (x, z, pts, w, h, p = 1.6) => { const [d] = segDist(x, z, pts); return h * Math.exp(-Math.pow(d / w, p)); };
/* 梯田：把高度量化成台阶，sharp 越大台阶越陡 */
export function terrace(h, step, sharp = .8) { const f = h / step, i = Math.floor(f), t = f - i; return (i + smooth(.5 - sharp / 2, .5 + sharp / 2, t)) * step; }
/* 沿一条（近似）直线的海岸：side>0 一侧为陆。返回到海岸线的有符号距离 */
export function coastDist(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); return ((x - ax) * dz - (z - az) * dx) / L; }
/* 岛：中心距离 + 噪声边缘，返回 0..1 陆地程度 */
export function island(x, z, cx, cz, r, N, wob = .25, f = .035) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return clamp(1 - d + N.fbm(x * f + 3, z * f - 7, 3) * wob, -1, 1);
}
export { smooth, clamp, lerp, segDist };
