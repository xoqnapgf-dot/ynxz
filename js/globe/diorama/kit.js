/* 沙盘构件：共享着色片段、带程序纹理的合并几何体（建筑/道具）、实例化植被与人物。
   约定：1 单位 ≈ 1 米；颜色一律写 sRGB 十六进制，内部转线性。 */
import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, makeNoise, clamp } from './noise.js?v=26';

/* ---------------- 全局 uniform（每次进入沙盘由 engine 重置） ---------------- */
export const G = {
  uTime: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 }, uNight: { value: 0 }, uLit: { value: .55 },
  uCoreR: { value: 100 }, uGhost: { value: 0 }, uWind: { value: .5 }, uSnowLine: { value: 1e5 }, uWL: { value: -1e5 },
  uFade: { value: new T.Vector2(1e5, 2e5) }, uBg: { value: new T.Color() },
  uHaze: { value: new T.Color() }, uHazeD: { value: 0 }, uFogC: { value: new T.Color() }, uFogY: { value: 0 }, uFogH: { value: 8 }, uFogD: { value: 0 },
  uFlash: { value: 0 }, uClay: { value: new T.Color(.62, .6, .57) }, uFocus: { value: new T.Vector3() }
};

export const NOISE_GLSL = /* glsl */`
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h12(i), h12(i + vec2(1., 0.)), f.x), mix(h12(i + vec2(0., 1.)), h12(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= .5; } return s / .9375; }
`;
/* 大气：远景霾、高度雾（解析积分）与开放式沙盘外圈的淡出 */
export const ATMOS_GLSL = /* glsl */`
uniform vec2 uFade; uniform vec3 uBg, uHaze, uFogC, uFocus; uniform float uHazeD, uFogY, uFogH, uFogD, uFlash;
vec3 atmos(vec3 col, vec3 wp) {
  vec3 rd = wp - cameraPosition; float dist = length(rd); rd /= max(dist, 1e-4);
  // 远景霾从视点中心往外增长：中心保持清晰
  col = mix(col, uHaze, 1. - exp(-max(dist - distance(uFocus, cameraPosition) * .8, 0.) * uHazeD));
  float b = 1. / uFogH, oy = cameraPosition.y - uFogY;
  float ry = abs(rd.y) < 1e-3 ? 1e-3 : rd.y;
  float fog = uFogD / b * exp(-oy * b) * (1. - exp(-dist * ry * b)) / ry;
  col = mix(col, uFogC * (1. + uFlash * 2.), 1. - exp(-max(fog, 0.)));
  return mix(col, uBg, smoothstep(uFade.x, uFade.y, length(wp.xz)));
}
`;
export const BUMP_GLSL = /* glsl */`
vec3 bumpN(vec3 sp, vec3 sn, float hgt, float k) {
  vec3 sx = dFdx(sp), sy = dFdy(sp), r1 = cross(sy, sn), r2 = cross(sn, sx);
  float det = dot(sx, r1); vec2 dh = vec2(dFdx(hgt), dFdy(hgt)) * k;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * sn - grad);
}
`;
function bind(sh, names) { for (const n of names) sh.uniforms[n] = G[n]; }
const ATM_U = ['uFade', 'uBg', 'uHaze', 'uHazeD', 'uFogC', 'uFogY', 'uFogH', 'uFogD', 'uFlash', 'uFocus'];

const _c = new T.Color();
export function lin(hex) { if (Array.isArray(hex)) return _c.setRGB(hex[0], hex[1], hex[2], T.SRGBColorSpace).clone(); return new T.Color(hex); }
export function mixHex(a, b, t) { return lin(a).lerp(lin(b), t); }

/* ---------------- 合并几何体用的程序纹理 ---------------- */
export const P = { plain: 0, plaster: 1, brick: 2, stone: 3, wood: 4, timber: 5, tile: 6, slate: 7, thatch: 8, metal: 9, glass: 10, cobble: 11, paint: 12, light: 14, cloth: 15, rock: 17, hull: 18, gold: 19, road: 20, dirt: 21, iron: 22, concrete: 23, felt: 24, leaf: 25, fire: 26 };

const PATTERN_GLSL = /* glsl */`
varying float vPat; varying vec4 vLoc, vWin; varying vec3 vWP, vNW;
uniform float uTime, uSnow, uWet, uNight, uLit, uCoreR, uGhost; uniform vec3 uClay;
float pH = 0., pK = 0., pR = -1., pM = -1.; vec3 pE = vec3(0.);
float aaK(vec2 q, float s) { vec2 w = fwidth(q); return 1. - smoothstep(.25, .7, max(w.x, w.y) / s); }
vec3 patternColor(vec3 c) {
  int pat = int(vPat + .5);
  float cr = cos(vLoc.w), sr = sin(vLoc.w);
  vec3 ln = vec3(cr * vNW.x - sr * vNW.z, vNW.y, sr * vNW.x + cr * vNW.z);
  float wall = 1. - smoothstep(.35, .65, abs(ln.y));
  vec2 tH = normalize(vec2(-ln.z, ln.x) + 1e-5);
  float along = dot(vLoc.xz, tH), yy = vLoc.y;
  vec2 q = wall > .5 ? vec2(along, yy) : vLoc.xz;
  float slopeK = sqrt(max(1. - ln.y * ln.y, .04));
  float g = fbm(vWP.xz * .9 + vWP.y * .7);
  float ghost = uGhost * smoothstep(uCoreR * .95, uCoreR * 1.22, length(vWP.xz));
  if (pat == 1 || pat == 12) {                       // 灰泥 / 彩绘墙
    float st = vn(q * vec2(1.3, 2.2)) * .6 + vn(q * 6.) * .4;
    c *= .9 + .18 * st;
    c *= mix(.72, 1., smoothstep(0., 1.6, yy)) * (pat == 12 ? .9 + .2 * vn(q * .7 + 3.) : 1.);
    c = mix(c, c * vec3(.86, .83, .78), smoothstep(.55, .8, fbm(q * .6 + 9.)) * .6);
    pH = st * .15; pK = .4;
  } else if (pat == 2) {                             // 砖
    float row = floor(q.y / .24), off = mod(row, 2.) * .26;
    vec2 f = vec2(fract((q.x + off) / .52), fract(q.y / .24));
    float m = smoothstep(.0, .06, min(min(f.x, 1. - f.x) * 2.1, min(f.y, 1. - f.y))) ;
    float id = h12(vec2(floor((q.x + off) / .52), row));
    float aa = aaK(q, .5);
    c = mix(c, c * (.78 + .4 * id), aa);
    c = mix(c, mix(c * .55, vec3(.55, .52, .48), .5), (1. - m) * aa * .8);
    pH = m * aa; pK = .6;
  } else if (pat == 3) {                             // 方石
    float rh = .5, row = floor(q.y / rh), off = h12(vec2(row, 3.)) * 1.7;
    float bw = .7 + .6 * h12(vec2(row, 7.)), cx = floor((q.x + off) / bw);
    vec2 f = vec2(fract((q.x + off) / bw), fract(q.y / rh));
    float m = smoothstep(0., .07, min(min(f.x, 1. - f.x) * bw / rh, min(f.y, 1. - f.y)));
    float aa = aaK(q, .8), id = h12(vec2(cx, row));
    c = mix(c, c * (.82 + .3 * id + .12 * vn(q * 4.)), aa);
    c = mix(c, c * .6, (1. - m) * aa * .7);
    pH = m * aa + vn(q * 9.) * .2; pK = .5;
  } else if (pat == 4) {                             // 木板
    float r = q.y / .26, row = floor(r), f = fract(r);
    float aa = aaK(q, .4), id = h12(vec2(row, floor(q.x / 3.1 + h12(vec2(row)) )));
    c *= mix(1., .82 + .3 * id, aa) * (.92 + .16 * vn(vec2(q.x * 1.5, r * 3.)));
    c = mix(c, c * .55, smoothstep(.85, 1., f) * aa);
    pH = (1. - f) * aa; pK = .5; pR = .8;
  } else if (pat == 5) {                             // 木骨架白墙
    float fh = vWin.y > 0. ? vWin.y : 2.8;
    float bx = abs(fract(q.x / 1.3) - .5) * 1.3, by = abs(fract(q.y / fh) - .5) * fh;
    float beam = step(.5 * 1.3 - .1, bx) + step(.5 * fh - .12, by);
    float diag = step(abs(fract(q.x / 1.3) - fract(q.y / fh)), .045) * step(.5, h12(vec2(floor(q.x / 1.3), floor(q.y / fh))));
    float aa = aaK(q, .6);
    c *= .93 + .12 * vn(q * 3.);
    c = mix(c, vec3(.12, .085, .06), clamp(beam + diag, 0., 1.) * aa);
    pH = clamp(beam + diag, 0., 1.) * aa; pK = .5;
  } else if (pat == 6 || pat == 7) {                 // 瓦 / 石板瓦
    float rl = pat == 6 ? .3 : .24, cw = pat == 6 ? .26 : .36;
    float r = yy / (rl * slopeK), row = floor(r), f = fract(r);
    float cx = floor(along / cw + mod(row, 2.) * .5);
    float fx = fract(along / cw + mod(row, 2.) * .5);
    float aa = aaK(vec2(along, r * rl), rl);
    float id = h12(vec2(cx, row));
    c *= mix(1., .8 + .35 * id, aa);
    float rib = pat == 6 ? pow(sin(fx * 3.14159), .6) : 1.;
    c *= mix(1., .62 + .38 * f, aa) * mix(1., .85 + .15 * rib, aa);
    c = mix(c, c * vec3(.75, .8, .7), smoothstep(.6, .85, g) * .5);
    pH = (f * .7 + rib * .3) * aa; pK = 1.;
  } else if (pat == 8) {                             // 茅草
    float s = vn(vec2(along * 9., yy * 1.2)) * .6 + vn(vec2(along * 23., yy * 3.)) * .4;
    c *= .7 + .5 * s; pH = s; pK = .8; pR = .95;
  } else if (pat == 9) {                             // 瓦楞铁皮
    float w = sin(q.x * 52.);
    float aa = aaK(q * 8., 1.);
    c *= 1. + .08 * w * aa; c = mix(c, c * vec3(.75, .5, .35), smoothstep(.55, .9, g) * .7);
    pH = w * aa; pK = .08; pR = .45; pM = .55;
  } else if (pat == 10) {                            // 玻璃幕墙
    vec2 f = vec2(fract(q.x / 1.6), fract(q.y / 3.2));
    float mul = step(.06, f.x) * step(.05, f.y);
    float id = h12(floor(q / vec2(1.6, 3.2)) + vLoc.w);
    c = mix(vec3(.6, .63, .66), c * (.75 + .5 * id), mul);
    pR = mix(.4, .08, mul); pM = mix(.6, .3, mul);
    pE = mul * step(1. - uLit * .9, id) * uNight * vec3(1., .82, .6) * 2.2;
  } else if (pat == 11) {                            // 石板路 / 卵石
    vec2 cq = q / .55, ci = floor(cq), cf = fract(cq) - .5;
    vec2 jt = vec2(h12(ci), h12(ci + 5.)) * .3 - .15;
    float d = max(abs(cf.x - jt.x), abs(cf.y - jt.y));
    float aa = aaK(q, .5), m = smoothstep(.5, .36, d);
    c *= mix(1., (.75 + .4 * h12(ci + 2.)) * mix(.55, 1., m), aa);
    pH = m * aa; pK = .5;
  } else if (pat == 14) {                            // 灯
    float fl = .85 + .15 * sin(uTime * 7. + vWP.x * 3.1) * sin(uTime * 3.3 + vWP.z);
    pE = c * (1.2 + 3.5 * uNight) * fl;
  } else if (pat == 26) {                            // 火
    float fl = .7 + .3 * vn(vec2(uTime * 6., vWP.x * 4. + vWP.y * 2.));
    pE = c * (3. + 4. * uNight) * fl; c *= .2;
  } else if (pat == 15) {                            // 布（条纹）
    float st = step(.5, fract(q.x / .5));
    c *= mix(1., .72 + .28 * st, aaK(q, .5)) * (.9 + .15 * vn(q * 3.)); pR = .9;
  } else if (pat == 17) {                            // 岩石
    float s = fbm(q * 1.4 + vWP.y * .5) * .6 + vn(vec2(q.x * .4, vWP.y * 3.)) * .4;
    c *= .7 + .55 * s; pH = s; pK = .8;
  } else if (pat == 18) {                            // 船壳 / 涂漆钢
    c *= .92 + .1 * vn(q * vec2(.3, 4.));
    c = mix(c, c * vec3(.7, .5, .35), smoothstep(.62, .9, vn(q * vec2(2., .6))) * smoothstep(1.5, 0., yy) * .6);
    pR = .45; pM = .15;
  } else if (pat == 19) { pR = .28; pM = 1.; c *= .9 + .2 * vn(q * 4.); }
  else if (pat == 20 || pat == 21) {                 // 路面 / 土路
    float s = vn(q * 3.) * .5 + vn(q * 11.) * .5;
    c *= .82 + .3 * s; pH = s; pK = .3; pR = pat == 20 ? .8 : .97;
  } else if (pat == 22) { c *= .85 + .2 * vn(q * 5.); pR = .5; pM = .7; }
  else if (pat == 23) {                              // 混凝土板
    vec2 f = abs(fract(q / vec2(3., 2.8)) - .5);
    float j = smoothstep(.49, .5, max(f.x / 1., f.y));
    float aa = aaK(q, 1.5);
    c *= (.9 + .15 * vn(q * 2.)) * mix(1., .7, j * aa);
    c = mix(c, c * .8, smoothstep(.6, .85, fbm(q * .5)) * smoothstep(2.5, 0., fract(q.y / 2.8) * 2.8) * .5);
    pH = 1. - j; pK = .2;
  } else if (pat == 24) { c *= .85 + .2 * vn(q * vec2(1., 6.)); pR = 1.; }
  else if (pat == 25) { c *= .75 + .45 * vn(q * 5. + vWP.y); pR = .85; }
  else { c *= .93 + .1 * vn(q * 2.5); }
  // 窗：在墙面上按层高、开间生成；夜里部分点亮
  if (vWin.x > 0. && wall > .5) {
    float sp = vWin.x, fh = vWin.y;
    float ext = abs(tH.x) * vWin.z + abs(tH.y) * vWin.w;
    float cell = floor(along / sp + .5), fu = along - cell * sp;
    float fl = floor(yy / fh), fy = yy - fl * fh;
    float ww = min(.55, sp * .26), wh = fh * .3;
    float inW = step(abs(fu), ww) * step(abs(fy - fh * .55), wh) * step(abs(cell * sp) + ww + .35, ext) * step(.5, yy);
    float frame = step(abs(fu), ww + .09) * step(abs(fy - fh * .55), wh + .09) * step(abs(cell * sp) + ww + .35, ext) * step(.5, yy);
    float aa = aaK(vec2(along, yy), .8);
    float id = h12(vec2(cell + vLoc.w * 13., fl + floor(vWP.x * .1) * 7.));
    vec3 glass = vec3(.035, .045, .06) + vec3(.05, .06, .07) * vn(vec2(cell, fl) * 3.);
    c = mix(c, c * 1.15 + .05, (frame - inW) * aa * .8);
    c = mix(c, glass, inW * aa);
    if (inW * aa > .5) { pR = .12; pM = .0; pH = -1.; pK = .3; }
    pE += inW * aa * step(1. - uLit, id) * uNight * vec3(1., .72, .42) * (1.6 + 1.2 * h12(vec2(id, 3.)));
  }
  // 雪、湿、未载入区的素模
  float up = smoothstep(.55, .9, vNW.y);
  c = mix(c, vec3(.88, .9, .94), uSnow * up * (.8 + .2 * vn(vWP.xz * 2.)));
  c *= 1. - uWet * .3 * (1. - uSnow * up);
  c = mix(c, uClay * (.92 + .1 * vNW.y), ghost);
  pE *= 1. - ghost; pK *= 1. - ghost;
  return c;
}
`;

function patchKit(m, instanced) {
  m.onBeforeCompile = sh => {
    bind(sh, ['uTime', 'uSnow', 'uWet', 'uNight', 'uLit', 'uCoreR', 'uGhost', 'uClay', 'uWind', ...ATM_U]);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aPat; attribute vec4 aLoc, aWin;
        varying float vPat; varying vec4 vLoc, vWin; varying vec3 vWP, vNW; uniform float uTime, uWind;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vPat = aPat; vLoc = aLoc; vWin = aWin;
        vec4 wp4 = modelMatrix * vec4(transformed, 1.);
        vWP = wp4.xyz; vNW = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE_GLSL + BUMP_GLSL + ATMOS_GLSL + PATTERN_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = patternColor(diffuseColor.rgb);')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (pR >= 0.) roughnessFactor = pR;
        roughnessFactor = mix(roughnessFactor, roughnessFactor * .45, uWet * smoothstep(.5, .9, vNW.y));`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n if (pM >= 0.) metalnessFactor = pM;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n if (pK > 0.) normal = bumpN(-vViewPosition, normal, pH, pK * .012);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += pE;')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = atmos(gl_FragColor.rgb, vWP);');
  };
  m.customProgramCacheKey = () => 'kit' + (instanced ? 'i' : 'm');
  return m;
}

/* ---------------- 单位基元（非索引，便于直接写入合并数组） ---------------- */
const PRIM = {};
function finish(g) { g.deleteAttribute('uv'); const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
function prismGeo(pts2, depth) { // pts2：xy 轮廓（逆时针），沿 z 拉伸 depth，两端封口
  const sh = new T.Shape(pts2.map(p => new T.Vector2(p[0], p[1])));
  const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return finish(g);
}
function curvedRoof() { // 屋脊沿 z，檐口微翘的凹曲屋面，带厚度
  const prof = [];
  const N = 14;
  for (let i = 0; i <= N; i++) { const t = i / N * 2 - 1, a = Math.abs(t); prof.push([.5 * t, Math.pow(1 - a, 1.7) * .92 + (a > .82 ? (a - .82) * .5 : 0) + .02]); }
  const pts = prof.concat(prof.slice().reverse().map(([x, y]) => [x * .97, y - .07]));
  return prismGeo(pts, 1);
}
function hipGeo(k) { // k = 屋脊缩进比例（0=山墙式，.5=四坡，1=攒尖）
  const r = .5 - .5 * Math.min(k, .999), v = [];
  const A = [-.5, 0, -.5], B = [.5, 0, -.5], C = [.5, 0, .5], D = [-.5, 0, .5], E = [0, 1, -r], F = [0, 1, r];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  tri(A, D, F); tri(A, F, E); tri(B, E, F); tri(B, F, C); tri(A, E, B); tri(D, C, F); tri(A, B, C); tri(A, C, D);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
function hullGeo() { // 船壳：船首收尖，船底收窄，单位长 1（沿 z），宽 1，高 1
  const S = [], L = 10;
  for (let i = 0; i <= L; i++) {
    const z = i / L - .5, t = i / L;
    const bow = t > .7 ? Math.max(.04, Math.sqrt(Math.max(0, 1 - Math.pow((t - .7) / .3, 2)))) : 1;
    const stern = t < .08 ? .85 + t * 1.8 : 1;
    const w = .5 * bow * stern;
    S.push([[-w, 1, z], [-w * .85, .45, z], [-w * .35, 0, z], [w * .35, 0, z], [w * .85, .45, z], [w, 1, z]]);
  }
  const v = [];
  const q = (a, b, c, d) => v.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < L; i++) for (let j = 0; j < 5; j++) q(S[i][j], S[i + 1][j], S[i + 1][j + 1], S[i][j + 1]);
  // 甲板与船尾板
  for (let i = 0; i < L; i++) q(S[i][5], S[i + 1][5], S[i + 1][0], S[i][0]);
  for (let j = 0; j < 5; j++) v.push(...S[0][0], ...S[0][j + 1], ...S[0][j]);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
function prim(name) {
  if (PRIM[name]) return PRIM[name];
  let g;
  const m = /^(cyl|cone|frus)(\d+)$/.exec(name);
  if (name === 'box') g = finish(new T.BoxGeometry(1, 1, 1).translate(0, .5, 0));
  else if (m) {
    const n = +m[2], top = m[1] === 'cyl' ? .5 : m[1] === 'cone' ? 0 : .32;
    g = finish(new T.CylinderGeometry(top, .5, 1, n, 1).translate(0, .5, 0));
  } else if (name === 'sph') g = finish(new T.IcosahedronGeometry(.5, 2));
  else if (name === 'lump') g = finish(new T.IcosahedronGeometry(.5, 1));
  else if (name === 'hemi') g = finish(new T.SphereGeometry(.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  else if (name === 'gable') g = prismGeo([[-.5, 0], [.5, 0], [0, 1]], 1);
  else if (name === 'shed') g = prismGeo([[-.5, 0], [.5, 0], [-.5, 1]], 1);
  else if (name === 'hip') { g = hipGeo(.5); }
  else if (name === 'pyr') { g = hipGeo(1); }
  else if (name === 'curve') g = curvedRoof();
  else if (name === 'hull') g = hullGeo();
  else if (name === 'arch') { // 拱：半圆环的一段，单位跨度 1、厚 1
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; pts.push([-.5 * Math.cos(a), .5 * Math.sin(a)]); }
    const outer = [[-.5, 0], ...pts.slice(1, -1).map(([x, y]) => [x * 1.0, y * 1.0]).map(([x, y]) => [x, y]), [.5, 0], [.62, 0], [.62, .62], [-.62, .62], [-.62, 0]];
    void outer;
    const sh = new T.Shape(); sh.moveTo(-.62, 0); sh.lineTo(-.5, 0);
    for (let i = 0; i <= 12; i++) { const a = Math.PI - Math.PI * i / 12; sh.lineTo(.5 * Math.cos(a), .5 * Math.sin(a)); }
    sh.lineTo(.62, 0); sh.lineTo(.62, .66); sh.lineTo(-.62, .66); sh.closePath();
    g = finish(new T.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -.5));
  } else throw Error('未知基元 ' + name);
  if (!g.attributes.normal) g.computeVertexNormals();
  return (PRIM[name] = g);
}

/* ---------------- 合并几何体构建器 ---------------- */
export class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.pat = []; this.loc = []; this.win = []; this.f = { x: 0, y: 0, z: 0, ry: 0, win: [0, 0, 0, 0] }; this._m = new T.Matrix4(); this._n = new T.Matrix3(); this._q = new T.Quaternion(); this._e = new T.Euler(); this._v = new T.Vector3(); }
  frame(x = 0, y = 0, z = 0, ry = 0, win = null) { this.f = { x, y, z, ry, win: win || [0, 0, 0, 0] }; return this; }
  /* 在当前框架内放一个基元：位置为底面中心，s 为尺寸，r 为 [rx,ry,rz] */
  put(name, x, y, z, sx, sy, sz, color, pat = 0, r = null, useWin = false) {
    const g = prim(name), P0 = g.attributes.position.array, N0 = g.attributes.normal.array;
    const c = color instanceof T.Color ? color : lin(color);
    this._e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    this._q.setFromEuler(this._e);
    this._m.compose(this._v.set(x, y, z), this._q, new T.Vector3(sx, sy, sz));
    const m = this._m.elements;
    this._n.getNormalMatrix(this._m); const n = this._n.elements;
    const f = this.f, cr = Math.cos(f.ry), sr = Math.sin(f.ry), w = useWin ? f.win : [0, 0, 0, 0];
    for (let i = 0; i < P0.length; i += 3) {
      const px = P0[i], py = P0[i + 1], pz = P0[i + 2];
      const lx = m[0] * px + m[4] * py + m[8] * pz + m[12], ly = m[1] * px + m[5] * py + m[9] * pz + m[13], lz = m[2] * px + m[6] * py + m[10] * pz + m[14];
      let nx = n[0] * N0[i] + n[3] * N0[i + 1] + n[6] * N0[i + 2], ny = n[1] * N0[i] + n[4] * N0[i + 1] + n[7] * N0[i + 2], nz = n[2] * N0[i] + n[5] * N0[i + 1] + n[8] * N0[i + 2];
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      this.pos.push(f.x + cr * lx + sr * lz, f.y + ly, f.z - sr * lx + cr * lz);
      this.nor.push(cr * nx + sr * nz, ny, -sr * nx + cr * nz);
      this.col.push(c.r, c.g, c.b); this.pat.push(pat); this.loc.push(lx, ly, lz, f.ry); this.win.push(w[0], w[1], w[2], w[3]);
    }
    return this;
  }
  box(x, y, z, sx, sy, sz, color, pat, ry = 0, useWin = false) { return this.put('box', x, y, z, sx, sy, sz, color, pat, ry ? [0, ry, 0] : null, useWin); }
  get count() { return this.pos.length / 3; }
  mesh(material) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPat', new T.Float32BufferAttribute(this.pat, 1));
    g.setAttribute('aLoc', new T.Float32BufferAttribute(this.loc, 4));
    g.setAttribute('aWin', new T.Float32BufferAttribute(this.win, 4));
    g.computeBoundingSphere();
    const mesh = new T.Mesh(g, material);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
}
export function kitMaterial() { return patchKit(new T.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 }), false); }

/* ---------------- 建筑 ---------------- */
/* o: w,d,fl,fh,ry, wall,wpat, roof('gable'|'hip'|'pyr'|'flat'|'shed'|'curve'|'dome'|'none'), rcol,rpat,pitch,over, win(开间，0=无窗), base,trim, chim, door, awn */
export function house(b, x, y, z, o) {
  const w = o.w ?? 6, d = o.d ?? 5, fl = o.fl ?? 1, fh = o.fh ?? 2.9, H = fl * fh, ry = o.ry ?? 0, ov = o.over ?? .35;
  b.frame(x, y, z, ry, [o.win ?? 2.2, fh, w / 2, d / 2]);
  const base = o.base ?? 0x8b857b;
  b.box(0, -2.2, 0, w + .3, 2.2 + (o.plinth ?? .35), d + .3, base, P.stone);
  b.box(0, o.plinth ?? .35, 0, w, H - (o.plinth ?? .35), d, o.wall ?? 0xe8dfcf, o.wpat ?? P.plaster, 0, true);
  if (o.trim) b.box(0, H - .22, 0, w + .14, .26, d + .14, o.trim, P.plain);
  if (o.door !== false) b.box(0, (o.plinth ?? .35), d / 2, Math.min(1.1, w * .22), 2.05, .16, o.door ?? 0x4a3527, P.wood);
  if (o.awn) b.put('shed', 0, 2.3, d / 2 + .55, Math.min(w * .7, 4), .5, 1.1, o.awn, P.cloth, [0, -Math.PI / 2, 0]);
  const roof = o.roof ?? 'gable', rc = o.rcol ?? 0xa0503a, rp = o.rpat ?? P.tile;
  const along = w >= d, span = along ? d : w, len = along ? w : d, rot = along ? [0, Math.PI / 2, 0] : null;
  const pitch = o.pitch ?? .55, rh = span * pitch;
  if (roof === 'gable' || roof === 'curve') {
    b.put('gable', 0, H, 0, span, rh * (span / (span + 2 * ov)), len, o.wall ?? 0xe8dfcf, o.wpat ?? P.plaster, rot);
    b.put(roof === 'curve' ? 'curve' : 'gable', 0, H - (roof === 'curve' ? .25 : .08), 0, span + 2 * ov, rh, len + 2 * ov * (roof === 'curve' ? 1.6 : .8), rc, rp, rot);
    if (roof === 'curve') b.box(0, H + rh - .05, 0, along ? len + 2 * ov * 1.6 : .35, .3, along ? .35 : len + 2 * ov * 1.6, rc, P.plain);
  } else if (roof === 'hip' || roof === 'pyr') {
    b.put(roof, 0, H - .05, 0, span + 2 * ov, rh, len + 2 * ov, rc, rp, rot);
  } else if (roof === 'shed') {
    b.put('shed', 0, H, 0, span + ov, rh * .6, len + ov, rc, rp, rot);
  } else if (roof === 'flat' || roof === 'dome') {
    b.box(0, H, 0, w + .2, .35, d + .2, o.trim ?? o.wall ?? 0xd8d0c0, P.plaster);
    if (roof === 'dome') b.put('hemi', 0, H + .3, 0, Math.min(w, d) * .8, Math.min(w, d) * .55, Math.min(w, d) * .8, rc, rp);
    else if (o.tank) b.put('cyl12', w * .2, H + .35, -d * .15, 1.2, 1.4, 1.2, 0x6b625a, P.wood);
  }
  if (o.chim) b.box(along ? w * .25 : span * .2, H + rh * .3, along ? span * .15 : len * .25, .55, rh * .9 + .6, .55, o.chimCol ?? 0x7a5446, P.brick);
  b.frame();
  return H + (roof === 'flat' ? .35 : rh);
}
/* 塔楼：圆柱 + 锥顶（或平顶垛口） */
export function tower(b, x, y, z, o) {
  const r = o.r ?? 2.2, h = o.h ?? 12;
  b.frame(x, y, z, o.ry ?? 0, [o.win ?? 0, 3, r, r]);
  b.put(o.sq ? 'box' : 'cyl16', 0, -2, 0, r * 2, h + 2, r * 2, o.wall ?? 0xb8ad98, o.wpat ?? P.stone);
  if (o.roof === 'flat' || o.cren) {
    b.put(o.sq ? 'box' : 'cyl16', 0, h, 0, r * 2.2, .6, r * 2.2, o.wall ?? 0xb8ad98, o.wpat ?? P.stone);
    const n = Math.max(6, Math.round(r * 4));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; b.box(Math.cos(a) * r * 1.02, h + .6, Math.sin(a) * r * 1.02, .55, .6, .55, o.wall ?? 0xb8ad98, P.stone, -a); }
  } else b.put(o.sq ? 'pyr' : 'cone16', 0, h - .05, 0, r * 2.4, o.rh ?? r * 2.6, r * 2.4, o.rcol ?? 0x4b5560, o.rpat ?? P.slate);
  b.frame();
}
/* 沿折线的墙（可带垛口） */
export function wall(b, pts, h, t, col, pat = P.stone, cren = true, heightAt = null) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, y = heightAt ? Math.min(heightAt(ax, az), heightAt(bx, bz), heightAt(mx, mz)) : 0;
    b.frame(mx, y, mz, ry);
    b.box(0, -2, 0, L + t * .6, h + 2, t, col, pat);
    if (cren) { const n = Math.floor(L / 1.3); for (let k = 0; k < n; k++) b.box(-L / 2 + (k + .5) * L / n, h, 0, .6, .7, t + .05, col, pat); }
  }
  b.frame();
}
/* 船：小渔船 / 帆船 / 汽船 / 军舰 */
export function boat(b, x, y, z, ry, o = {}) {
  const L = o.len ?? 6, W = L * (o.beam ?? .32), kind = o.kind ?? 'row';
  b.frame(x, y, z, ry);
  b.put('hull', 0, -.35 * W, 0, W, W * .7, L, o.hull ?? 0x6a4e3a, kind === 'steam' || kind === 'war' ? P.hull : P.wood);
  if (o.stripe) b.put('hull', 0, -.35 * W + W * .62, 0, W * 1.01, W * .08, L * 1.003, o.stripe, P.plain);
  if (kind === 'sail' || kind === 'junk') {
    b.put('cyl8', 0, .2, L * .08, .14, L * .95, .14, 0x5a4636, P.wood);
    if (kind === 'sail') b.put('shed', .05, L * .15, -L * .06, .05, L * .75, L * .52, o.sail ?? 0xece3d0, P.cloth, [0, Math.PI / 2, 0]);
    else for (let i = 0; i < 2; i++) b.box(0, L * .2 + i * L * .32, L * .08, .06, L * .3, L * .45, o.sail ?? 0xb0563a, P.cloth);
  } else if (kind === 'steam') {
    b.box(0, .25 * W, -L * .05, W * .7, W * .55, L * .35, o.cabin ?? 0xece6da, P.plaster);
    b.put('cyl12', 0, .25 * W + W * .5, L * .02, W * .28, W * 1.1, W * .28, o.funnel ?? 0x2b2622, P.hull);
    b.put('cyl8', 0, .2, L * .3, .1, L * .45, .1, 0x3a3029, P.wood);
  } else if (kind === 'war') {
    b.box(0, .25 * W, -L * .02, W * .6, W * .5, L * .4, o.cabin ?? 0x8a9097, P.hull);
    b.box(0, .25 * W + W * .5, L * .02, W * .38, W * .55, L * .14, o.cabin ?? 0x8a9097, P.hull);
    b.put('cyl12', 0, .25 * W + W * .6, -L * .12, W * .24, W * .9, W * .24, 0x585d63, P.hull);
    b.put('cyl8', 0, .25 * W, L * .2, .14, L * .5, .14, 0x4a4f55, P.iron);
    for (const s of [1, -1]) { b.put('cyl12', 0, .25 * W, s * L * .3, W * .36, W * .25, W * .36, 0x6f757c, P.hull); b.box(0, .25 * W + W * .12, s * L * .3 + s * W * .35, .12, .12, W * .7, 0x4a4f55, P.iron); }
  } else if (kind === 'barge') {
    b.box(0, .2 * W, -L * .3, W * .6, W * .5, L * .2, 0x8a7a66, P.wood);
    b.box(0, .15 * W, L * .1, W * .8, W * .25, L * .5, o.cargo ?? 0x3a3530, P.plain);
  }
  b.frame();
}

/* ---------------- 实例化：植被、人物、动物、石块 ---------------- */
function lumpy(detail, seed, amp, sq = 1) {
  const g = mergeVertices(new T.IcosahedronGeometry(1, detail).deleteAttribute('uv').deleteAttribute('normal'));
  const N = makeNoise(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amp * (N.n2(x * 1.7 + z * .9, y * 1.7 - z * .6) + .5 * N.n2(x * 3.9, z * 3.9 + y));
    p.setXYZ(i, x * k, y * k * sq, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function shadeVerts(g, lo = .55, hi = 1.05, top = 1) { // 底部暗、顶部亮的伪 AO
  const p = g.attributes.position, c = [];
  g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  for (let i = 0; i < p.count; i++) { const t = (p.getY(i) - y0) / (y1 - y0 || 1), v = lo + (hi - lo) * Math.pow(t, top); c.push(v, v, v); }
  g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
  return g;
}
function merge(list) { // 简易合并（全部非索引）
  const gs = list.map(g => g.index ? g.toNonIndexed() : g);
  const keys = ['position', 'normal', 'color'];
  const out = new T.BufferGeometry();
  for (const k of keys) {
    const arrs = gs.map(g => g.attributes[k] ? g.attributes[k].array : new Float32Array(g.attributes.position.count * 3).fill(1));
    const n = arrs.reduce((s, a) => s + a.length, 0), a = new Float32Array(n); let o = 0;
    for (const x of arrs) { a.set(x, o); o += x.length; }
    out.setAttribute(k, new T.BufferAttribute(a, 3));
  }
  return out;
}
const tf = (g, m) => { g.applyMatrix4(m); return g; };
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
function trunkGeo(h, r, segs = 6) { const g = new T.CylinderGeometry(r * .7, r, h, segs, 1).translate(0, h / 2, 0); g.deleteAttribute('uv'); return shadeVerts(g, .6, 1); }

/* 每个树种：trunk 与 crown 两份几何（单位高约 6 米） */
const SPECIES = {
  round: () => ({ trunk: trunkGeo(2.6, .22), crown: shadeVerts(merge([tf(lumpy(1, 3, .18), M4(0, 3.6, 0, 1.9, 1.6, 1.9)), tf(lumpy(1, 4, .2), M4(.8, 3.1, .4, 1.2, 1.1, 1.2)), tf(lumpy(1, 5, .2), M4(-.7, 3.3, -.5, 1.25, 1.1, 1.2))]), .42, 1.08, .9) }),
  cone: () => ({ trunk: trunkGeo(1.4, .2), crown: shadeVerts(merge([0, 1, 2].map(i => { const g = new T.ConeGeometry(1.6 - i * .4, 2.6, 8, 1); g.deleteAttribute('uv'); return tf(g, M4(0, 2.3 + i * 1.45, 0, 1, 1, 1, 0, i * .5, 0)); })), .4, 1.05, 1.2) }),
  column: () => ({ trunk: trunkGeo(1, .18), crown: shadeVerts(tf(lumpy(1, 7, .12), M4(0, 3.6, 0, .85, 3.1, .85)), .45, 1.05) }),
  birch: () => ({ trunk: trunkGeo(4.2, .14), crown: shadeVerts(merge([tf(lumpy(1, 8, .25), M4(0, 4.4, 0, 1.2, 1.5, 1.2)), tf(lumpy(1, 9, .25), M4(.5, 3.4, .2, .8, .9, .8))]), .5, 1.1) }),
  pine: () => ({ trunk: trunkGeo(4.6, .2), crown: shadeVerts(merge([tf(lumpy(1, 11, .2, .45), M4(0, 5.1, 0, 2.4, 1.4, 2.4)), tf(lumpy(1, 12, .2, .5), M4(.9, 4.7, .3, 1.4, 1, 1.4))]), .45, 1.05) }),
  shrub: () => ({ trunk: trunkGeo(.3, .1, 4), crown: shadeVerts(tf(lumpy(1, 13, .25), M4(0, .7, 0, 1, .75, 1)), .5, 1.05) }),
  palm: () => {
    const segs = [], fr = [];
    let x = 0, y = 0;
    for (let i = 0; i < 6; i++) { const g = new T.CylinderGeometry(.14, .18, 1.05, 6, 1); g.deleteAttribute('uv'); segs.push(tf(g, M4(x, y + .5, 0, 1, 1, 1, 0, 0, -.06 * i))); x += .06 * i; y += 1; }
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, g = new T.PlaneGeometry(.55, 2.6, 1, 4); g.deleteAttribute('uv');
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 1.3) / 2.6; p.setZ(i, -t * t * 1.3); p.setX(i, p.getX(i) * (1 - t * .6)); }
      g.computeVertexNormals();
      fr.push(tf(g, M4(x + Math.cos(a) * 1.1, y + .1, Math.sin(a) * 1.1, 1, 1, 1, -Math.PI / 2 + .35, -a + Math.PI / 2, 0)));
    }
    return { trunk: shadeVerts(merge(segs), .6, 1), crown: shadeVerts(merge(fr), .6, 1.05) };
  },
  broad: () => ({ trunk: merge([trunkGeo(5.5, .32), tf(trunkGeo(1.2, .5), M4(0, 0, 0, 1.4, 1, 1.4))]), crown: shadeVerts(merge([tf(lumpy(1, 14, .2, .55), M4(0, 6.4, 0, 3.4, 1.6, 3.4)), tf(lumpy(1, 15, .2, .5), M4(1.6, 5.9, 1, 2, 1.2, 2)), tf(lumpy(1, 16, .2, .5), M4(-1.4, 6, -1.2, 2.2, 1.3, 2.2))]), .4, 1.05) }),
  willow: () => {
    const g = lumpy(2, 17, .14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < .2) p.setY(i, y * 2.2 - .2); }
    g.computeVertexNormals();
    return { trunk: trunkGeo(2.6, .26), crown: shadeVerts(tf(g, M4(0, 3.6, 0, 2, 1.6, 2)), .45, 1.05) };
  },
  bare: () => {
    const br = [trunkGeo(3.6, .2)];
    for (let k = 0; k < 5; k++) { const a = k * 2.4, g = trunkGeo(1.8, .07, 4); br.push(tf(g, M4(0, 1.8 + k * .35, 0, 1, 1, 1, Math.cos(a) * .7, 0, Math.sin(a) * .7))); }
    return { trunk: merge(br), crown: shadeVerts(tf(lumpy(1, 18, .35), M4(0, 3.6, 0, 1.4, 1.1, 1.4)), .5, 1) };
  },
  bamboo: () => {
    const st = [], lf = [];
    for (let k = 0; k < 7; k++) { const a = k * 2.1, r = .35 + (k % 3) * .25, h = 5 + (k % 4) * .8; const g = new T.CylinderGeometry(.05, .06, h, 5, 1); g.deleteAttribute('uv'); st.push(tf(g.translate(0, h / 2, 0), M4(Math.cos(a) * r, 0, Math.sin(a) * r, 1, 1, 1, Math.sin(a) * .08, 0, Math.cos(a) * .08))); lf.push(tf(lumpy(0, 20 + k, .3), M4(Math.cos(a) * r * 1.3, h - .6, Math.sin(a) * r * 1.3, .7, 1.1, .7))); }
    return { trunk: shadeVerts(merge(st), .7, 1), crown: shadeVerts(merge(lf), .5, 1.05) };
  },
  reed: () => {
    const st = [];
    for (let k = 0; k < 9; k++) { const a = k * 2.3, r = .1 + (k % 3) * .14, g = new T.ConeGeometry(.04, 1.4 + (k % 4) * .3, 3, 1); g.deleteAttribute('uv'); st.push(tf(g.translate(0, .7, 0), M4(Math.cos(a) * r, 0, Math.sin(a) * r, 1, 1, 1, Math.sin(a) * .2, 0, Math.cos(a) * .2))); }
    return { trunk: shadeVerts(new T.CylinderGeometry(.01, .01, .01, 3).deleteAttribute('uv'), 1, 1), crown: shadeVerts(merge(st), .55, 1.1) };
  }
};
export const SPECIES_NAMES = Object.keys(SPECIES);

/* 植被 / 人物共用的实例化材质：风摆 + 雪 + 素模 + 大气 */
export function vegMaterial(sway = 1) {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: 0, side: T.DoubleSide });
  m.onBeforeCompile = sh => {
    bind(sh, ['uTime', 'uWind', 'uSnow', 'uWet', 'uCoreR', 'uGhost', 'uClay', ...ATM_U]);
    sh.uniforms.uSway = { value: sway };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n uniform float uTime, uWind, uSway; varying vec3 vWP, vNW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        float ph = ip.x * .37 + ip.z * .23;
        float sw = uSway * uWind * (sin(uTime * 1.6 + ph) * .7 + sin(uTime * 3.7 + ph * 2.1) * .3) * .05;
        transformed.x += sw * max(transformed.y, 0.); transformed.z += sw * .6 * max(transformed.y, 0.);
        #endif`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wq = vec4(transformed, 1.);
        #ifdef USE_INSTANCING
        wq = instanceMatrix * wq;
        #endif
        vWP = (modelMatrix * wq).xyz;
        vNW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE_GLSL + ATMOS_GLSL + 'uniform float uSnow, uWet, uCoreR, uGhost; uniform vec3 uClay; varying vec3 vWP, vNW;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= .82 + .3 * vn(vWP.xz * 1.7 + vWP.y * 2.3);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.88, .9, .94), uSnow * smoothstep(.35, .85, vNW.y) * .9);
        diffuseColor.rgb *= 1. - uWet * .25;
        diffuseColor.rgb = mix(diffuseColor.rgb, uClay, uGhost * smoothstep(uCoreR * .95, uCoreR * 1.22, length(vWP.xz)));`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = atmos(gl_FragColor.rgb, vWP);');
  };
  m.customProgramCacheKey = () => 'veg' + sway;
  return m;
}

/* 人、牲畜、石块等小件的几何 */
const SMALL = {
  person: () => { const b = new T.CylinderGeometry(.17, .22, 1.15, 6, 1).translate(0, .58, 0); b.deleteAttribute('uv'); const h = new T.IcosahedronGeometry(.13, 1).translate(0, 1.32, 0); h.deleteAttribute('uv'); return shadeVerts(merge([b, h]), .7, 1.05); },
  cow: () => { const b = new T.BoxGeometry(.6, .6, 1.4).translate(0, .75, 0), h = new T.BoxGeometry(.35, .35, .45).translate(0, .95, .85), l = [[-.2, .5], [.2, .5], [-.2, -.5], [.2, -.5]].map(([x, z]) => new T.BoxGeometry(.13, .5, .13).translate(x, .25, z)); return shadeVerts(merge([b, h, ...l].map(g => { g.deleteAttribute('uv'); return g; })), .6, 1.05); },
  sheep: () => { const b = lumpy(1, 33, .15); b.scale(.42, .34, .55); b.translate(0, .5, 0); const h = new T.BoxGeometry(.2, .22, .28).translate(0, .62, .5); h.deleteAttribute('uv'); return shadeVerts(merge([b, h]), .65, 1.05); },
  horse: () => { const b = new T.BoxGeometry(.5, .6, 1.5).translate(0, 1.1, 0), n = new T.BoxGeometry(.3, .7, .35).translate(0, 1.55, .75), l = [[-.18, .55], [.18, .55], [-.18, -.55], [.18, -.55]].map(([x, z]) => new T.BoxGeometry(.12, .85, .12).translate(x, .42, z)); return shadeVerts(merge([b, n, ...l].map(g => { g.deleteAttribute('uv'); return g; })), .6, 1.05); },
  rock: () => shadeVerts(tf(lumpy(1, 41, .28), M4(0, .25, 0, 1, .65, 1)), .55, 1.05),
  boulder: () => shadeVerts(tf(lumpy(2, 42, .22), M4(0, .3, 0, 1, .8, 1)), .5, 1.05),
  flower: () => { const g = new T.IcosahedronGeometry(.12, 0).translate(0, .32, 0); g.deleteAttribute('uv'); const s = new T.CylinderGeometry(.015, .015, .32, 3).translate(0, .16, 0); s.deleteAttribute('uv'); return shadeVerts(merge([s, g]), .8, 1.1); },
  blade: () => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-.05, 0, 0, .05, 0, 0, 0, .55, .04, .05, 0, 0, -.05, 0, 0, 0, .55, .04], 3)); g.computeVertexNormals(); const c = [.45, .45, .45, .45, .45, .45, 1.1, 1.1, 1.1, .45, .45, .45, .45, .45, .45, 1.1, 1.1, 1.1]; g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); return g; },
  crate: () => shadeVerts(new T.BoxGeometry(.8, .8, .8).translate(0, .4, 0).deleteAttribute('uv'), .7, 1.05),
  barrel: () => shadeVerts(new T.CylinderGeometry(.32, .32, .9, 8, 1).translate(0, .45, 0).deleteAttribute('uv'), .7, 1.05)
};

/* 实例集合：按“种类”收集，最后一次性生成 InstancedMesh */
export class Instances {
  constructor() { this.sets = new Map(); }
  add(kind, part, x, y, z, s, color, ry = 0, sy = 1, tilt = 0) {
    const key = kind + ':' + part;
    if (!this.sets.has(key)) this.sets.set(key, { kind, part, list: [] });
    this.sets.get(key).list.push([x, y, z, s, color instanceof T.Color ? color : lin(color), ry, sy, tilt]);
  }
  tree(sp, x, y, z, s, crown, trunk = 0x5a4232, ry = 0) {
    this.add(sp, 'trunk', x, y, z, s, trunk, ry);
    this.add(sp, 'crown', x, y, z, s, crown, ry);
  }
  small(kind, x, y, z, s, color, ry = 0, sy = 1, tilt = 0) { this.add(kind, 'small', x, y, z, s, color, ry, sy, tilt); }
  build(group, opts = {}) {
    const mats = { sway: vegMaterial(1), still: vegMaterial(0), grass: vegMaterial(2.2) };
    const geos = {};
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
    let n = 0;
    for (const { kind, part, list } of this.sets.values()) {
      const gkey = kind + ':' + part;
      if (!geos[gkey]) geos[gkey] = part === 'small' ? SMALL[kind]() : SPECIES[kind]()[part];
      const mat = part === 'crown' ? (kind === 'reed' ? mats.grass : mats.sway) : kind === 'blade' ? mats.grass : kind === 'flower' ? mats.grass : mats.still;
      const im = new T.InstancedMesh(geos[gkey], mat, list.length);
      list.forEach(([x, y, z, s, c, ry, sy, tilt], i) => {
        e.set(tilt, ry, tilt * .6); q.setFromEuler(e);
        m4.compose(v.set(x, y, z), q, sc.set(s, s * sy, s));
        im.setMatrixAt(i, m4); im.setColorAt(i, c);
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      const tiny = kind === 'blade' || kind === 'flower';
      im.castShadow = !tiny && !(opts.coarse && kind === 'person');
      im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
      n += list.length;
    }
    return n;
  }
}

/* 色彩抖动：在若干色之间随机取并微调亮度 */
export function vary(r, cols, amt = .08) {
  const c = lin(r.pick(cols));
  const k = 1 + (r() - .5) * 2 * amt;
  return c.multiplyScalar(k);
}
export { rng, clamp };
