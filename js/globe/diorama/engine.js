/* 2.5D 沙盘引擎：地形（封闭底座 / 半开放渐隐）、水体、光照与天气、后期（微缩移轴）与相机。
   入口 createDiorama(renderer, name, opts) 返回 app.js 约定的接口。 */
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { G, NOISE_GLSL, ATMOS_GLSL, Builder, kitMaterial, Instances, lin, house, P } from './kit.js?v=27';
import { makeNoise, rng, strSeed, smooth, clamp, lerp, segDist, spline } from './noise.js?v=27';
import { createFx } from './fx.js?v=27';
import { RECIPES, STYLES } from './recipes.js?v=27';
import { warmUp, warmOffscreen } from '../warm.js?v=27';

// 环境图生成器跨沙盘复用：它的模糊着色器不必每次进沙盘都重新编译
const PMREM = new WeakMap();

const D2R = Math.PI / 180;

/* ---------------- 时段预设（颜色为 sRGB） ---------------- */
export const TIMES = {
  dawn: { el: 7, az: 100, sun: 0xffb27e, si: 2.4, top: 0x6e86b6, hor: 0xf0b896, gnd: 0x5c5048, hemi: .5, env: .45, haze: 0xe6bca4, hd: .0032, exp: 1.05, bloom: .35 },
  morning: { el: 30, az: 125, sun: 0xfff0d8, si: 3.2, top: 0x5b8fd8, hor: 0xd3e2ee, gnd: 0x6a6252, hemi: .55, env: .55, haze: 0xd2dde8, hd: .002, exp: 1, bloom: .2 },
  noon: { el: 60, az: 165, sun: 0xfff8ee, si: 3.5, top: 0x4a86d6, hor: 0xc6dcef, gnd: 0x6f6a5c, hemi: .55, env: .6, haze: 0xcad9e8, hd: .0018, exp: .98, bloom: .18 },
  harsh: { el: 72, az: 190, sun: 0xfff1da, si: 4.6, top: 0x5a8ccc, hor: 0xece2cc, gnd: 0x7a6e5a, hemi: .45, env: .5, haze: 0xe8dcc4, hd: .0028, exp: .92, bloom: .16 },
  afternoon: { el: 36, az: 230, sun: 0xffe6c4, si: 3.3, top: 0x5689d0, hor: 0xd9e0e2, gnd: 0x6a6252, hemi: .55, env: .55, haze: 0xd8dcdc, hd: .002, exp: 1, bloom: .2 },
  golden: { el: 11, az: 255, sun: 0xffbe76, si: 3.2, top: 0x6588c2, hor: 0xf4cf9c, gnd: 0x5e5244, hemi: .45, env: .45, haze: 0xeecaa0, hd: .0028, exp: 1.04, bloom: .3 },
  dusk: { el: 2.5, az: 262, sun: 0xff8a58, si: 1.7, top: 0x2b3963, hor: 0xe48b66, gnd: 0x3a3036, hemi: .45, env: .35, haze: 0x9c7480, hd: .0036, exp: 1.18, bloom: .55, night: .55 },
  night: { el: 38, az: 210, sun: 0x9db6ff, si: .5, top: 0x060a17, hor: 0x18223d, gnd: 0x0b0d12, hemi: .32, env: .25, haze: 0x141c30, hd: .0035, exp: 1.4, bloom: .75, night: 1, stars: 1 },
  overcast: { el: 50, az: 160, sun: 0xe9edf0, si: 1.15, top: 0x8f9aa4, hor: 0xc3c8cb, gnd: 0x5d5a55, hemi: 1, env: .8, haze: 0xb7bec3, hd: .0045, exp: 1.05, bloom: .15, soft: 1 },
  rain: { el: 40, az: 150, sun: 0xc6d0da, si: .75, top: 0x5b6670, hor: 0x8c969e, gnd: 0x3e3d3b, hemi: .9, env: .65, haze: 0x7d878f, hd: .0065, wet: 1, exp: 1.12, bloom: .2, soft: 1 },
  storm: { el: 16, az: 245, sun: 0xffb27a, si: 1.15, top: 0x2f3640, hor: 0x6e6a66, gnd: 0x2a2725, hemi: .55, env: .42, haze: 0x4c525a, hd: .006, wet: .8, exp: 1.18, bloom: .45 },
  mist: { el: 14, az: 110, sun: 0xffe0bc, si: 2, top: 0x8ea3bb, hor: 0xdfe0dc, gnd: 0x5c5a52, hemi: .7, env: .6, haze: 0xd8dbd8, hd: .0055, exp: 1.04, bloom: .25 }
};

/* ---------------- 天空（背景与环境光照共用） ---------------- */
const SKY_FS = /* glsl */`
${NOISE_GLSL}
uniform vec3 uTop, uHor, uGnd, uSunDir, uSunCol; uniform float uStars, uCloud, uTime, uEnv, uFlash, uResY, uOpen;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir); float y = d.y;
  if (uEnv < .5) { // 背景：按屏幕高度的渐变（相机俯视时不至于只看到“地平线以下”的灰色）
    float sy = gl_FragCoord.y / uResY;
    y = mix(-.02, .7, smoothstep(uOpen > .5 ? .35 : .05, 1.05, sy));
    d = normalize(vec3(d.x, y * 1.4, d.z));
  }
  vec3 c = mix(uHor, uTop, pow(smoothstep(-.02, .65, y), .75));
  c = mix(c, mix(uHor, uGnd, .55), smoothstep(.0, -.3, y));
  float s = max(dot(d, uSunDir), 0.);
  if (uEnv > .5) c += uSunCol * (pow(s, 6.) * .18 + pow(s, 64.) * .35) * .4;
  else c += uSunCol * pow(s, 3.) * .06;
  if (uCloud > 0. && y > -.02) {
    vec2 p = d.xz / (max(y, 0.) + .12) * .9 + vec2(uTime * .006, uTime * .002);
    float n = fbm(p * 1.4) * .65 + fbm(p * 4.1 + 3.) * .35;
    float cl = smoothstep(.5 - uCloud * .25, .78, n) * smoothstep(-.02, .2, y) * min(uCloud * 1.4, 1.);
    vec3 cc = mix(uHor * .95, mix(uTop, vec3(dot(uTop, vec3(.33))), .6) * 1.2, .5) + uSunCol * pow(s, 4.) * .25;
    c = mix(c, cc, cl * .85);
  }
  if (uStars > 0. && y > 0.) {
    vec2 g = d.xz / (y + .3) * 140.; vec2 i = floor(g), f = fract(g) - .5;
    float h = h12(i); float st = step(.985, h) * smoothstep(.07, 0., length(f - (vec2(h12(i + 3.), h12(i + 7.)) - .5) * .6));
    c += vec3(.9, .92, 1.) * st * uStars * (.2 + .55 * h12(i + 1.)) * smoothstep(.0, .3, y);
  }
  c *= 1. + uFlash * 1.5;
  gl_FragColor = vec4(c, 1.);
}`;
function skyMaterial(env) {
  return new T.ShaderMaterial({
    uniforms: { uTop: { value: new T.Color() }, uHor: { value: new T.Color() }, uGnd: { value: new T.Color() }, uSunDir: { value: new T.Vector3() }, uSunCol: { value: new T.Color() }, uStars: { value: 0 }, uCloud: { value: 0 }, uTime: G.uTime, uEnv: { value: env ? 1 : 0 }, uFlash: G.uFlash, uResY: { value: 800 }, uOpen: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.); gl_Position = p.xyww; }',
    fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, depthTest: false
  });
}

/* ---------------- 地形材质 ---------------- */
function terrainMaterial(region) {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 });
  m.onBeforeCompile = sh => {
    for (const k of ['uTime', 'uSnow', 'uWet', 'uSnowLine', 'uWL', 'uCoreR', 'uGhost', 'uFade', 'uBg', 'uHaze', 'uHazeD', 'uFogC', 'uFogY', 'uFogH', 'uFogD', 'uFlash', 'uFocus']) sh.uniforms[k] = G[k];
    sh.uniforms.tRegion = { value: region?.lin || null }; sh.uniforms.tRegionN = { value: region?.near || null };
    sh.uniforms.uRB = { value: region ? region.bounds : new T.Vector4(0, 0, 1, 1) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n attribute vec2 aG; varying vec2 vG; varying vec3 vWP, vNW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal); vG = aG;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        ${NOISE_GLSL}${ATMOS_GLSL}
        uniform float uTime, uSnow, uWet, uSnowLine, uWL, uCoreR, uGhost; uniform sampler2D tRegion, tRegionN; uniform vec4 uRB;
        varying vec2 vG; varying vec3 vWP, vNW;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 c = diffuseColor.rgb;
        float micro = fbm(vWP.xz * .9), fine = vn(vWP.xz * 6.5);
        c *= .84 + .3 * micro; c *= .93 + .14 * fine;
        float steep = 1. - smoothstep(.5, .8, vNW.y);
        c = mix(c, c * (.75 + .4 * vn(vec2(vWP.y * 2.4, (vWP.x + vWP.z) * .12))), steep * vG.y);
        float sn = max(uSnow * smoothstep(.35, .75, vNW.y + (micro - .5) * .4), smoothstep(uSnowLine - 2., uSnowLine + 2., vWP.y + (fbm(vWP.xz * .08) - .5) * 14.) * smoothstep(.3, .7, vNW.y));
        c = mix(c, vec3(.84, .87, .92) * (.95 + .08 * fine), sn);
        float under = clamp((uWL - vWP.y) * .5, 0., 1.);
        float caus = pow(abs(sin(vn(vWP.xz * .9 + uTime * .3) * 9.)), 6.);
        c = mix(c, c * vec3(.42, .62, .66) * (.8 + .5 * caus * exp(-max(uWL - vWP.y, 0.) * .4)), under);
        c *= 1. - uWet * .28 * (1. - sn);
        if (uGhost > 0.5) {
          vec2 ruv = (vWP.xz - uRB.xy) / uRB.zw;
          float k = smoothstep(uCoreR * .9, uCoreR * 1.35, length(vWP.xz));
          vec3 blk = texture2D(tRegionN, ruv).rgb, blur = texture2D(tRegion, ruv).rgb;
          c = mix(c, mix(blur, blk, .6) * (.96 + .08 * vn(floor(vWP.xz / 6.))), k);
        }
        diffuseColor.rgb = c;
        float wetGround = sn;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(vG.x, .55, wetGround);
        roughnessFactor = mix(roughnessFactor, .3, uWet * smoothstep(.85, .98, vNW.y) * smoothstep(.45, .7, vn(vWP.xz * .35)));`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = atmos(gl_FragColor.rgb, vWP);');
  };
  m.customProgramCacheKey = () => 'terrain' + (region ? 'r' : '');
  return m;
}

/* 沙盘侧壁：土层 + 岩层条带 */
function skirtMaterial(strata, base) {
  const m = new T.MeshStandardMaterial({ roughness: .95, metalness: 0 });
  const S = strata.map(lin);
  m.onBeforeCompile = sh => {
    sh.uniforms.uS = { value: S }; sh.uniforms.uBase = { value: base };
    for (const k of ['uFade', 'uBg', 'uHaze', 'uHazeD', 'uFogC', 'uFogY', 'uFogH', 'uFogD', 'uFlash', 'uFocus']) sh.uniforms[k] = G[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n attribute float aTop; varying float vTop; varying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vTop = aTop;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        ${NOISE_GLSL}${ATMOS_GLSL}
        uniform vec3 uS[5]; uniform float uBase; varying float vTop; varying vec3 vWP;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float ang = atan(vWP.z, vWP.x) * length(vWP.xz);
        float below = vTop - vWP.y + (vn(vec2(ang * .3, 1.)) - .5) * .6;
        float yy = vWP.y + (fbm(vec2(ang * .05, vWP.y * .05)) - .5) * 4.;
        float band = floor(yy / 1.6), t = h12(vec2(band, 2.));
        vec3 c = t < .3 ? uS[1] : t < .6 ? uS[2] : t < .85 ? uS[3] : uS[4];
        c *= .82 + .3 * vn(vec2(ang * .9, vWP.y * 5.)) + .12 * vn(vec2(ang * 3., vWP.y * 18.));
        c = mix(uS[0] * (.8 + .35 * vn(vec2(ang * 2., vWP.y * 6.))), c, smoothstep(.6, 1.4, below));
        c = mix(c * .9 + .03, c, smoothstep(.0, .25, below));
        c *= mix(.45, 1., smoothstep(uBase, uBase + 7., vWP.y));
        diffuseColor.rgb = c;`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = atmos(gl_FragColor.rgb, vWP);');
  };
  m.customProgramCacheKey = () => 'skirt';
  return m;
}

/* ---------------- 水 ---------------- */
const WATER_VS = /* glsl */`varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = /* glsl */`
${NOISE_GLSL}${ATMOS_GLSL}
uniform float uTime, uLevel, uClarity, uWaveA, uWaveS, uFoam, uRain, uNight, uWind;
uniform vec3 uShallow, uDeep, uSkyTop, uSkyHor, uSunDir, uSunCol, uAmb, uGlowP, uGlowC;
uniform sampler2D tHeight; uniform vec4 uHB;
varying vec3 vWP;
float wave(vec2 p) {
  float t = uTime * uWaveS;
  return vn(p * .26 + vec2(t * .21, t * .13)) * .62 + vn(p * .7 - vec2(t * .17, -t * .26)) * .3 + vn(p * 1.6 + vec2(t * .4, t * .1)) * .08;
}
vec2 ripple(vec2 p) {
  vec2 acc = vec2(0.);
  for (int k = 0; k < 2; k++) {
    vec2 cell = floor(p * .9 + float(k) * .5), f = fract(p * .9 + float(k) * .5) - .5;
    float h = h12(cell + float(k) * 7.), ph = fract(uTime * .9 + h);
    vec2 o = (vec2(h, h12(cell + 3.)) - .5) * .5;
    float d = length(f - o), r = ph * .45;
    float ring = sin((d - r) * 60.) * smoothstep(.07, 0., abs(d - r)) * (1. - ph);
    acc += normalize(f - o + 1e-4) * ring;
  }
  return acc;
}
void main() {
  vec2 huv = (vWP.xz - uHB.xy) / uHB.zw;
  float th = texture2D(tHeight, huv).r;
  float depth = max(uLevel - th, 0.);
  vec2 p = vWP.xz; float e = .12;
  float amp = uWaveA * (.35 + .65 * uWind) * smoothstep(0., .8, depth);
  vec3 n = normalize(vec3(-(wave(p + vec2(e, 0.)) - wave(p - vec2(e, 0.))) / (2. * e) * amp, 1., -(wave(p + vec2(0., e)) - wave(p - vec2(0., e))) / (2. * e) * amp));
  if (uRain > 0.) { vec2 r = ripple(p * 1.3) * uRain * .35; n = normalize(n + vec3(r.x, 0., r.y)); }
  vec3 V = normalize(cameraPosition - vWP);
  float F = .02 + .98 * pow(1. - max(dot(n, V), 0.), 5.);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uSkyHor, uSkyTop, smoothstep(.0, .55, R.y)) * .75;
  float sp = pow(max(dot(R, uSunDir), 0.), 600.) * 5. + pow(max(dot(R, uSunDir), 0.), 40.) * .08;
  vec3 glow = uGlowC * pow(max(dot(R, normalize(uGlowP - vWP)), 0.), 18.);
  float absorb = 1. - exp(-depth * uClarity);
  vec3 body = mix(uShallow, uDeep, absorb) * (uSunCol * max(uSunDir.y, 0.) * .35 + uAmb);
  float foamN = vn(p * 1.8 + uTime * .25) * .6 + vn(p * 5. - uTime * .3) * .4;
  float shore = 1. - smoothstep(0., uFoam, depth);
  float foam = shore * shore * smoothstep(.5, .78, foamN) * step(.001, uFoam);
  vec3 col = body * (1. - F) + sky * F + uSunCol * sp * (1. - foam) + glow;
  col = mix(col, (uSunCol * max(uSunDir.y, .1) * .45 + uAmb * 1.4) * .95, foam);
  float alpha = clamp(max(absorb * .94, F * .8) + foam * .8, 0., 1.);
  alpha = max(alpha, smoothstep(0., .25, depth) * .35);
  gl_FragColor = vec4(atmos(col, vWP), alpha);
}`;

/* 开放式外圈：雾化色块用的低分辨率区域图 */
function regionTextures(E, colorAt) {
  const N = 72, data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -E + (i + .5) / N * 2 * E, z = -E + (j + .5) / N * 2 * E, c = colorAt(x, z).clone().convertLinearToSRGB();
    const k = (j * N + i) * 4; data[k] = c.r * 255; data[k + 1] = c.g * 255; data[k + 2] = c.b * 255; data[k + 3] = 255;
  }
  const mk = filt => { const t = new T.DataTexture(data, N, N, T.RGBAFormat); t.colorSpace = T.SRGBColorSpace; t.magFilter = t.minFilter = filt; t.needsUpdate = true; return t; };
  return { lin: mk(T.LinearFilter), near: mk(T.NearestFilter), bounds: new T.Vector4(-E, -E, 2 * E, 2 * E) };
}

/* ---------------- 后期：移轴与调色 ---------------- */
const TILT = {
  uniforms: { tDiffuse: { value: null }, uRes: { value: new T.Vector2(1, 1) }, uFocus: { value: .5 }, uBand: { value: .16 }, uAmt: { value: 5 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBand, uAmt; varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      float r = uAmt * smoothstep(uBand, uBand + .32, d);
      vec4 acc = texture2D(tDiffuse, vUv);
      if (r < .35) { gl_FragColor = acc; return; }
      float tot = 1.;
      for (int i = 0; i < TAPS; i++) {
        float a = float(i) * 2.39996, rr = sqrt((float(i) + .5) / float(TAPS)) * r;
        acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr / uRes); tot += 1.;
      }
      gl_FragColor = acc / tot;
    }`
};
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.06 }, uTint: { value: new T.Vector3(1, 1, 1) }, uVig: { value: .28 }, uTime: G.uTime },
  vertexShader: TILT.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uSat, uVig, uTime; uniform vec3 uTint; varying vec2 vUv;
    float hh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(.2126, .7152, .0722));
      c.rgb = max(mix(vec3(l), c.rgb, uSat), 0.) * uTint;
      vec2 q = vUv - .5; c.rgb *= 1. - uVig * smoothstep(.25, .85, dot(q, q) * 2.2);
      c.rgb *= 1. + (hh(vUv * 1024. + fract(uTime) * 91.) - .5) * .025;
      gl_FragColor = c;
    }`
};
class AOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse(o => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.userData.noAO) o.visible = false; });
  }
}

/* ---------------- 足迹形状（星形：给定角度的半径） ---------------- */
function footprint(shape, R, N) {
  const kind = shape?.kind || 'circle', wob = shape?.wobble ?? .06, rot = (shape?.rot ?? 0) * D2R;
  return a => {
    let r;
    if (kind === 'square' || kind === 'rect') {
      const ax = shape.ax ?? 1, az = shape.az ?? 1, rr = .14;
      const c = Math.cos(a - rot), s = Math.sin(a - rot);
      const p = 8; r = 1 / Math.pow(Math.pow(Math.abs(c) / ax, p) + Math.pow(Math.abs(s) / az, p), 1 / p);
      r *= 1 - rr * .2;
    } else if (kind === 'hex') {
      const k = Math.PI / 3, t = ((a - rot) % k + k) % k - k / 2; r = Math.cos(Math.PI / 6) / Math.cos(t); r = lerp(r, 1, .25);
    } else r = 1;
    r *= 1 + wob * (N.n2(Math.cos(a) * 1.3 + 9, Math.sin(a) * 1.3) * .7 + N.n2(Math.cos(a) * 3.4, Math.sin(a) * 3.4 + 4) * .3);
    return r * R;
  };
}

/* ---------------- 主入口 ---------------- */
export async function createDiorama(renderer, name, opts = {}) {
  const rec = RECIPES[name], dbg = window.__dioDebug || {};
  if (!rec) throw Error('这个地点还没有沙盘');
  const tick = () => new Promise(r => setTimeout(r, 0));
  const coarse = !!opts.coarse, reduced = !!opts.reduced;
  /* 画质档：high 桌面全开；mid 手机默认（不做 AO、阴影隔帧更新、移轴少采样）；low 再关掉泛光与移轴、阴影只画一次。
     app.js 按实测帧间隔调用 degrade() 逐档下降 */
  let quality = opts.quality || (coarse ? 'mid' : 'high');
  const R = rec.R ?? 90, open = rec.mode === 'open';
  const seed = strSeed(rec.seed || name), N = makeNoise(seed), r = rng(seed ^ 0x51ed);
  const wl = rec.water === false ? -1e4 : (rec.water?.level ?? 0);
  const time = Object.assign({}, TIMES[rec.time || 'morning'], rec.light || {});

  /* ---- 全局 uniform 复位 */
  G.uTime.value = 0; G.uSnow.value = rec.snow ?? 0; G.uWet.value = time.wet ?? rec.wet ?? 0; G.uNight.value = time.night ?? 0; G.uLit.value = rec.lit ?? .55;
  G.uCoreR.value = R; G.uGhost.value = open ? 1 : 0; G.uWind.value = rec.wind ?? .5; G.uSnowLine.value = rec.snowLine ?? 1e5; G.uWL.value = wl; G.uFlash.value = 0;
  G.uClay.value.copy(lin(rec.clay ?? 0xb9b2a6));
  const E = open ? R * 3.3 : R * 1.12;
  G.uFade.value.set(open ? R * 1.55 : 1e5, open ? R * 3.1 : 2e5);
  G.uBg.value.copy(lin(time.hor));
  G.uHaze.value.copy(lin(time.haze)); G.uHazeD.value = (time.hd ?? .002) * .3 * (rec.hazeK ?? 1) * 100 / R;
  const fog = rec.fog || {};
  G.uFogC.value.copy(lin(fog.col ?? time.haze)); G.uFogY.value = fog.y ?? 0; G.uFogH.value = fog.h ?? 6; G.uFogD.value = (fog.d ?? 0) * 100 / R;

  /* ---- 高度场：配方高度 + 平台 / 道路 / 河道 */
  const ctx = { R, N, r, rng, seed, wl, open, E, name, coarse, smooth, clamp, lerp, segDist, spline, lin, P, STYLES, time };
  const raw = (x, z) => rec.height(x, z, ctx);
  const pads = (rec.pads || []).map(p => ({ ...p, y: p.y ?? raw(p.x, p.z) }));
  const roads = (rec.roads || []).map(rd => {
    const pts = spline(rd.pts, 6), hs = pts.map(([x, z]) => raw(x, z));
    const sm = hs.map((_, i) => { let s = 0, n = 0; for (let k = -4; k <= 4; k++) { const j = clamp(i + k, 0, hs.length - 1); s += hs[j]; n++; } return Math.max(s / n, wl + (rd.bridge ? -1e3 : .4)); });
    const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { ...rd, pts, sm, acc, w: rd.w ?? 4 };
  });
  const rivers = (rec.rivers || []).map(rv => ({ ...rv, pts: spline(rv.pts, 6), w: rv.w ?? 8, depth: rv.depth ?? 1.6 }));
  const alongH = (rd, along) => { const a = rd.acc; let i = 1; while (i < a.length - 1 && a[i] < along) i++; const t = clamp((along - a[i - 1]) / (a[i] - a[i - 1] || 1), 0, 1); return lerp(rd.sm[i - 1], rd.sm[i], t); };
  function hExact(x, z) {
    let h = raw(x, z);
    for (const rv of rivers) {
      const [d] = segDist(x, z, rv.pts), bank = rv.bank ?? rv.w * .9;
      if (d < rv.w / 2 + bank) { const k = smooth(rv.w * .3, rv.w / 2 + bank, d); h = Math.min(h, lerp(wl - rv.depth, h, k * k)); }
    }
    for (const p of pads) {
      let d;
      if (p.w) { const c = Math.cos(-(p.ry || 0)), s = Math.sin(-(p.ry || 0)), lx = (x - p.x) * c - (z - p.z) * s, lz = (x - p.x) * s + (z - p.z) * c; d = Math.max(Math.abs(lx) - p.w / 2, Math.abs(lz) - p.d / 2, 0); }
      else d = Math.max(0, Math.hypot(x - p.x, z - p.z) - p.r);
      const soft = p.soft ?? 4;
      if (d < soft) h = lerp(p.y, h, smooth(0, soft, d));
    }
    for (const rd of roads) {
      if (rd.flat === false) continue;
      const [d, along] = segDist(x, z, rd.pts), soft = rd.soft ?? 3;
      if (d < rd.w / 2 + soft) { const target = alongH(rd, along); h = lerp(target, h, smooth(rd.w * .45, rd.w / 2 + soft, d)); }
    }
    return h;
  }
  // 外圈：低频化（像未加载的粗模）
  let hFinal = hExact;
  if (open) {
    const C = 40, cg = new Float32Array(C * C);
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) cg[j * C + i] = hExact(-E + i / (C - 1) * 2 * E, -E + j / (C - 1) * 2 * E);
    const coarseH = (x, z) => { const fx = clamp((x + E) / (2 * E) * (C - 1), 0, C - 1.001), fz = clamp((z + E) / (2 * E) * (C - 1), 0, C - 1.001), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j; return lerp(lerp(cg[j * C + i], cg[j * C + i + 1], tx), lerp(cg[(j + 1) * C + i], cg[(j + 1) * C + i + 1], tx), tz); };
    hFinal = (x, z) => { const d = Math.hypot(x, z) / R; if (d < .95) return hExact(x, z); const k = smooth(.95, 1.5, d); const h0 = k < 1 ? hExact(x, z) : 0; const hc = coarseH(x, z); return lerp(h0, hc, k) * (1 - .35 * smooth(1.8, 3.2, d)); };
  }
  ctx.h = (x, z) => hFinal(x, z);
  ctx.slope = (x, z) => { const e = .6; return Math.hypot(hFinal(x + e, z) - hFinal(x - e, z), hFinal(x, z + e) - hFinal(x, z - e)) / (2 * e); };
  const rad = footprint(rec.shape, R, N);
  ctx.inside = (x, z, m = 0) => open ? Math.hypot(x, z) < R - m : Math.hypot(x, z) < rad(Math.atan2(z, x)) - m;
  ctx.rad = rad;
  ctx.roads = roads; ctx.rivers = rivers; ctx.pads = pads;
  ctx.nearRoad = (x, z, m = 0) => roads.some(rd => segDist(x, z, rd.pts)[0] < rd.w / 2 + m);
  ctx.nearRiver = (x, z, m = 0) => rivers.some(rv => segDist(x, z, rv.pts)[0] < rv.w / 2 + m);
  await tick();

  /* ---- 地表颜色 */
  const groundFn = rec.ground || defaultGround(rec.palette || {});
  const colorAt = (x, z, h = hFinal(x, z), s = ctx.slope(x, z)) => {
    const out = groundFn(x, z, h, s, ctx);
    return out.c || out;
  };

  /* ---- 场景 */
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(coarse && opts.width < 700 ? 34 : 28, opts.width / opts.height, .5, R * 40);
  const group = new T.Group(); scene.add(group);
  const disposables = [];
  const track = o => { disposables.push(o); return o; };

  /* ---- 地形网格 */
  const n = open ? (coarse ? 190 : 290) : (coarse ? 170 : 250);
  const coord = i => { const s = -1 + 2 * i / (n - 1); return open ? Math.sign(s) * E * (.36 * Math.abs(s) + .64 * Math.pow(Math.abs(s), 4)) : s * E; };
  const xs = Array.from({ length: n }, (_, i) => coord(i));
  const V = n * n, pos = new Float32Array(V * 3), keep = new Uint8Array(V), outside = new Uint8Array(V);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; let x = xs[i], z = xs[j];
    if (!open) { const a = Math.atan2(z, x), rr = rad(a), d = Math.hypot(x, z); if (d > rr) { outside[k] = 1; } }
    pos[k * 3] = x; pos[k * 3 + 2] = z;
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    for (const [p, q, s] of [[a, c, b], [b, c, d]]) {
      if (!open && outside[p] && outside[q] && outside[s]) continue;
      idx.push(p, q, s); keep[p] = keep[q] = keep[s] = 1;
    }
  }
  if (!open) for (let k = 0; k < V; k++) if (keep[k] && outside[k]) { // 外侧顶点吸附到轮廓
    const x = pos[k * 3], z = pos[k * 3 + 2], a = Math.atan2(z, x), rr = rad(a);
    pos[k * 3] = Math.cos(a) * rr; pos[k * 3 + 2] = Math.sin(a) * rr;
  }
  const col = new Float32Array(V * 3), aG = new Float32Array(V * 2);
  const hv = new Float32Array(V);
  for (let k = 0; k < V; k++) if (keep[k] || open) hv[k] = pos[k * 3 + 1] = hFinal(pos[k * 3], pos[k * 3 + 2]);
  await tick();
  const regionCol = (x, z) => { const h = hFinal(x, z); return colorAt(x, z, h, ctx.slope(x, z)); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; if (!keep[k] && !open) continue;
    const x = pos[k * 3], z = pos[k * 3 + 2];
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
    const dx = (hv[j * n + i1] - hv[j * n + i0]) / ((xs[i1] - xs[i0]) || 1), dz = (hv[j1 * n + i] - hv[j0 * n + i]) / ((xs[j1] - xs[j0]) || 1);
    const s = Math.hypot(dx, dz);
    const out = groundFn(x, z, hv[k], s, ctx), c = out.c || out;
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    aG[k * 2] = out.rough ?? .95; aG[k * 2 + 1] = out.rock ?? smooth(.5, 1.1, s);
  }
  const tg = new T.BufferGeometry();
  tg.setAttribute('position', new T.BufferAttribute(pos, 3));
  tg.setAttribute('color', new T.BufferAttribute(col, 3));
  tg.setAttribute('aG', new T.BufferAttribute(aG, 2));
  tg.setIndex(idx); tg.computeVertexNormals();
  const region = open ? regionTextures(E, regionCol) : null;
  const terrain = new T.Mesh(tg, terrainMaterial(region)); terrain.receiveShadow = true; terrain.castShadow = true;
  group.add(terrain);
  await tick();

  /* ---- 高度纹理（水深、雾片与地面相交柔化） */
  const HT = coarse ? 256 : 384, hdata = new Uint16Array(HT * HT);
  for (let j = 0; j < HT; j++) for (let i = 0; i < HT; i++) hdata[j * HT + i] = T.DataUtils.toHalfFloat(hFinal(-E + (i + .5) / HT * 2 * E, -E + (j + .5) / HT * 2 * E));
  const htex = new T.DataTexture(hdata, HT, HT, T.RedFormat, T.HalfFloatType); htex.magFilter = htex.minFilter = T.LinearFilter; htex.needsUpdate = true;
  const HB = new T.Vector4(-E, -E, 2 * E, 2 * E);
  ctx.heightTex = htex; ctx.HB = HB;

  /* ---- 底座（封闭式） */
  let base = 0;
  if (!open) {
    let minH = Infinity; for (let k = 0; k < V; k++) if (keep[k]) minH = Math.min(minH, hv[k]);
    base = (wl > -1e3 ? Math.min(minH, wl) : minH) - (rec.depth ?? R * .09);
    // 边界边 → 侧壁
    const cnt = new Map();
    for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = idx[t + e], b = idx[t + (e + 1) % 3]; const key = a < b ? a * V + b : b * V + a; cnt.set(key, (cnt.get(key) || 0) + 1); }
    const sp = [], sn = [], st = [], wp = [], wn = [];
    for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = idx[t + e], b = idx[t + (e + 1) % 3], key = a < b ? a * V + b : b * V + a;
      if (cnt.get(key) !== 1) continue;
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2], bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
      let nx = bz - az, nz = -(bx - ax); const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
      const flip = nx * (ax + bx) + nz * (az + bz) < 0;
      const P0 = [ax, ay, az], P1 = [bx, by, bz];
      const quad = (top0, top1, bot0, bot1, arrP, arrN, arrT) => {
        const v = flip ? [[P1[0], top1, P1[2]], [P0[0], top0, P0[2]], [P0[0], bot0, P0[2]], [P1[0], bot1, P1[2]]] : [[P0[0], top0, P0[2]], [P1[0], top1, P1[2]], [P1[0], bot1, P1[2]], [P0[0], bot0, P0[2]]];
        const tops = flip ? [P1[1], P0[1], P0[1], P1[1]] : [P0[1], P1[1], P1[1], P0[1]];
        const nn = flip ? [-nx, 0, -nz] : [nx, 0, nz];
        for (const q of [0, 2, 1, 0, 3, 2]) { arrP.push(...v[q]); arrN.push(...nn); if (arrT) arrT.push(tops[q]); }
      };
      quad(ay, by, base, base, sp, sn, st);
      if (wl > Math.min(ay, by) && wl > -1e3) quad(wl, wl, Math.min(ay, wl), Math.min(by, wl), wp, wn, null);
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); sg.setAttribute('normal', new T.Float32BufferAttribute(sn, 3)); sg.setAttribute('aTop', new T.Float32BufferAttribute(st, 1));
    const skirt = new T.Mesh(sg, skirtMaterial(rec.strata || [0x4a3a2c, 0x8a7a64, 0x6f6252, 0x9a8b74, 0x5c5246], base));
    skirt.castShadow = skirt.receiveShadow = true; group.add(skirt);
    if (wp.length) {
      const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setAttribute('normal', new T.Float32BufferAttribute(wn, 3));
      const wc = lin(rec.water?.deep ?? 0x1d4f63);
      const band = new T.Mesh(wg, new T.MeshPhysicalMaterial({ color: wc, roughness: .08, metalness: 0, transparent: true, opacity: .72, clearcoat: 1, clearcoatRoughness: .05 }));
      band.userData.noAO = true; group.add(band);
    }
    // 木座 / 石座
    const pts = []; for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2, rr = rad(a) + 1.4; pts.push(new T.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
    const pg = new T.ExtrudeGeometry(new T.Shape(pts), { depth: 3.2, bevelEnabled: true, bevelThickness: .45, bevelSize: .45, bevelSegments: 2, curveSegments: 1 });
    pg.rotateX(Math.PI / 2); pg.translate(0, base - .45, 0);
    const plinth = new T.Mesh(pg, new T.MeshStandardMaterial({ color: lin(rec.plinth ?? 0x3b2a20), roughness: .55, metalness: .05 }));
    plinth.castShadow = plinth.receiveShadow = true; group.add(plinth);
    // 铭牌
    const az0 = (rec.views?.[0]?.az ?? 35) * D2R, ang = Math.atan2(Math.cos(az0), Math.sin(az0));
    const pr = rad(ang) + 1.4 + .47;
    const plate = nameplate(name, rec.label || '');
    plate.position.set(Math.cos(ang) * pr, base - 2.05, Math.sin(ang) * pr);
    plate.lookAt(plate.position.x * 2, base - 2.05, plate.position.z * 2);
    group.add(plate); track(plate.material.map);
    // 投影软影
    const sh = new T.Mesh(new T.CircleGeometry(R * 2.2, 48).rotateX(-Math.PI / 2), new T.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uC: { value: lin(time.gnd).multiplyScalar(.35) } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform vec3 uC; varying vec2 vP; void main(){ float d = length(vP) / ${(R * 1.25).toFixed(1)}; gl_FragColor = vec4(uC, .55 * smoothstep(1.55, .7, d)); }`
    }));
    sh.position.y = base - 3.75; sh.userData.noAO = true; group.add(sh);
  }

  /* ---- 水面 */
  let waterMat = null;
  if (wl > -1e3) {
    const wi = [];
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (Math.min(hv[a], hv[b], hv[c]) < wl + .25) wi.push(a, b, c); }
    const wpos = new Float32Array(pos); for (let k = 0; k < V; k++) wpos[k * 3 + 1] = wl;
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.BufferAttribute(wpos, 3)); wg.setIndex(wi);
    const W = rec.water || {};
    waterMat = new T.ShaderMaterial({
      uniforms: {
        uTime: G.uTime, uLevel: { value: wl }, uClarity: { value: W.clarity ?? .45 }, uWaveA: { value: W.wave ?? .35 }, uWaveS: { value: W.speed ?? 1 }, uFoam: { value: W.foam ?? .9 }, uRain: { value: 0 }, uNight: G.uNight, uWind: G.uWind,
        uShallow: { value: lin(W.shallow ?? 0x3f8f8a) }, uDeep: { value: lin(W.deep ?? 0x0f3a52) }, uSkyTop: { value: lin(time.top) }, uSkyHor: { value: lin(time.hor) },
        uSunDir: { value: new T.Vector3() }, uSunCol: { value: new T.Color() }, uAmb: { value: new T.Color() }, uGlowP: { value: new T.Vector3(0, 1e4, 0) }, uGlowC: { value: new T.Color(0, 0, 0) },
        tHeight: { value: htex }, uHB: { value: HB },
        uFade: G.uFade, uBg: G.uBg, uHaze: G.uHaze, uHazeD: G.uHazeD, uFogC: G.uFogC, uFogY: G.uFogY, uFogH: G.uFogH, uFogD: G.uFogD, uFlash: G.uFlash, uFocus: G.uFocus
      },
      vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false
    });
    const water = new T.Mesh(wg, waterMat); water.renderOrder = 1; water.userData.noAO = true;
    group.add(water);
    ctx.waterMat = waterMat;
  }

  /* ---- 光照 */
  const sunDir = new T.Vector3().setFromSphericalCoords(1, (90 - time.el) * D2R, time.az * D2R);
  const sun = new T.DirectionalLight(lin(time.sun), time.si);
  sun.position.copy(sunDir).multiplyScalar(R * 3); sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const SM = quality === 'high' ? 3072 : quality === 'mid' ? 1536 : 1024; sun.shadow.mapSize.set(SM, SM);
  const sc = sun.shadow.camera, ext = open ? R * 1.2 : R * 1.25;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = R * .5; sc.far = R * 6;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .035 * R / 60; sun.shadow.radius = time.soft ? 7 : 2.5;
  scene.add(sun, sun.target);
  const hemi = new T.HemisphereLight(lin(time.top).lerp(lin(time.hor), .5), lin(time.gnd), time.hemi);
  scene.add(hemi);
  // 天空背景与环境贴图
  const skyM = skyMaterial(false), sky = new T.Mesh(new T.SphereGeometry(10, 48, 24), skyM);
  sky.renderOrder = -10; sky.frustumCulled = false; sky.userData.noAO = true; scene.add(sky);
  const setSkyU = (m, env) => {
    const u = m.uniforms; u.uTop.value.copy(lin(time.top)); u.uHor.value.copy(lin(time.hor)); u.uGnd.value.copy(lin(time.gnd));
    u.uSunDir.value.copy(sunDir); u.uSunCol.value.copy(lin(time.sun)).multiplyScalar(env ? .6 : 1); u.uStars.value = time.stars ?? 0; u.uCloud.value = rec.skyCloud ?? (time.soft ? .9 : .25);
  };
  setSkyU(skyM, false); skyM.uniforms.uOpen.value = open ? 1 : 0;
  const envScene = new T.Scene(), envM = skyMaterial(true); setSkyU(envM, true);
  envScene.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), envM));
  await warmOffscreen(renderer, envScene);
  if (!PMREM.has(renderer)) PMREM.set(renderer, new T.PMREMGenerator(renderer));
  const envRT = PMREM.get(renderer).fromScene(envScene, 0, .1, 100);
  scene.environment = envRT.texture; scene.environmentIntensity = time.env;
  envM.dispose();
  if (waterMat) {
    waterMat.uniforms.uSunDir.value.copy(sunDir);
    waterMat.uniforms.uSunCol.value.copy(lin(time.sun)).multiplyScalar(time.si * .5);
    waterMat.uniforms.uAmb.value.copy(lin(time.top)).lerp(lin(time.hor), .5).multiplyScalar(time.hemi * .45 + time.env * .25);
  }

  /* ---- 构件 */
  const B = new Builder(), I = new Instances();
  const lights = [];
  const OC = 2.4 * R, OCN = Math.ceil(OC), occ = new Uint8Array(OCN * OCN);
  const occIdx = (x, z) => { const i = Math.floor(x + OC / 2), j = Math.floor(z + OC / 2); return i < 0 || j < 0 || i >= OCN || j >= OCN ? -1 : j * OCN + i; };
  Object.assign(ctx, {
    B, I, sunDir,
    occupy(x, z, w, d, ry = 0, pad = .6) {
      const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2 + pad, hd = d / 2 + pad, rr = Math.hypot(hw, hd);
      for (let zz = Math.floor(z - rr); zz <= z + rr; zz++) for (let xx = Math.floor(x - rr); xx <= x + rr; xx++) {
        const lx = (xx + .5 - x) * c - (zz + .5 - z) * s, lz = (xx + .5 - x) * s + (zz + .5 - z) * c;
        if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) { const k = occIdx(xx + .5, zz + .5); if (k >= 0) occ[k] = 1; }
      }
    },
    occupyLine(pts, w) { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L); for (let k = 0; k <= n; k++) { const t = k / n; ctx.occupy(ax + (bx - ax) * t, az + (bz - az) * t, w, w, 0, 0); } } },
    free(x, z, rr = 1) { for (let zz = Math.floor(z - rr); zz <= z + rr; zz++) for (let xx = Math.floor(x - rr); xx <= x + rr; xx++) { const k = occIdx(xx + .5, zz + .5); if (k < 0 || occ[k]) return false; } return true; },
    ground(x, z, w = 0, d = 0, ry = 0) { // 建筑基底高度：取四角与中心的最低值
      if (!w) return hFinal(x, z);
      const c = Math.cos(ry), s = Math.sin(ry); let m = hFinal(x, z);
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const lx = a * w / 2, lz = b * d / 2; m = Math.min(m, hFinal(x + lx * c + lz * s, z - lx * s + lz * c)); }
      return m;
    },
    house(x, z, o) {
      const ry = o.ry ?? 0, y = o.y ?? ctx.ground(x, z, o.w ?? 6, o.d ?? 5, ry) + (o.lift ?? 0);
      ctx.occupy(x, z, o.w ?? 6, o.d ?? 5, ry, o.pad ?? .8);
      return house(B, x, y, z, o);
    },
    light(x, y, z, c, i = 4, dist = 18) { if (lights.length >= (coarse ? 3 : 6)) return null; const l = new T.PointLight(lin(c), i, dist * R / 90, 1.6); l.position.set(x, y, z); scene.add(l); lights.push(l); return l; },
    usable(x, z, o = {}) {
      if (!ctx.inside(x, z, o.margin ?? 3)) return false;
      const h = hFinal(x, z); if (h < wl + (o.above ?? .5)) return false;
      if (o.maxH != null && h > o.maxH) return false; if (o.minH != null && h < o.minH) return false;
      if ((o.maxSlope ?? .45) < ctx.slope(x, z)) return false;
      if (o.road !== false && ctx.nearRoad(x, z, o.roadPad ?? 1.5)) return false;
      if (o.river !== false && ctx.nearRiver(x, z, o.riverPad ?? 2)) return false;
      return o.free === false ? true : ctx.free(x, z, o.r ?? 1);
    },
    scatter(n, o, fn) { // 拒绝采样撒点
      let placed = 0; const tries = n * (o.tries ?? 12), area = o.area || null;
      for (let t = 0; t < tries && placed < n; t++) {
        let x, z;
        if (o.at) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * o.at[2]; x = o.at[0] + Math.cos(a) * d; z = o.at[1] + Math.sin(a) * d; }
        else if (o.rect) { x = o.rect[0] + r() * o.rect[2]; z = o.rect[1] + r() * o.rect[3]; }
        else { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (o.rmax ?? R); x = Math.cos(a) * d; z = Math.sin(a) * d; }
        if (area && !(area(x, z) > r())) continue;
        if (!ctx.usable(x, z, o)) continue;
        if (fn(x, z, hFinal(x, z)) !== false) { placed++; if (o.occupy) ctx.occupy(x, z, o.occupy, o.occupy, 0, 0); }
      }
      return placed;
    },
    trees(n, o) {
      const cols = o.cols || [0x4f6b34, 0x5d7a3a, 0x445f2e], sp = o.species || ['round'], s0 = o.scale || [.8, 1.25];
      return ctx.scatter(n, { maxSlope: .9, r: .6, ...o }, (x, z, h) => {
        const kind = typeof sp === 'function' ? sp(x, z, h) : r.pick(sp);
        I.tree(kind, x, h - .1, z, lerp(s0[0], s0[1], r()) * (o.k ?? 1), lin(r.pick(cols)).multiplyScalar(.85 + r() * .3), o.trunk ?? 0x55402e, r() * 6.28);
        ctx.occupy(x, z, 1.2, 1.2, 0, 0);
      });
    },
    people(n, o) { const cols = o.cols || [0x6b4f3a, 0x384a63, 0x8a3b32, 0xcdbf9f, 0x4d5a3a, 0x2f2b28]; return ctx.scatter(n, { maxSlope: .5, r: .3, free: o.free ?? false, road: o.road ?? false, ...o }, (x, z, h) => { I.small('person', x, h, z, lerp(.9, 1.08, r()), r.pick(cols), r() * 6.28); }); },
    animals(kind, n, o) { return ctx.scatter(n, { maxSlope: .4, r: .8, free: true, ...o }, (x, z, h) => { I.small(kind, x, h, z, lerp(.85, 1.15, r()), r.pick(o.cols || [0x6a4a35, 0xd8cfc0, 0x2c2622]), r() * 6.28); }); },
    rocks(n, o) { return ctx.scatter(n, { maxSlope: 2, r: .5, free: o.free ?? true, ...o }, (x, z, h) => { const s = lerp(o.s?.[0] ?? .6, o.s?.[1] ?? 2.2, Math.pow(r(), 1.8)); I.small(o.big ? 'boulder' : 'rock', x, h - s * .15, z, s, lin(r.pick(o.cols || [0x7d776d, 0x8d877c, 0x6a655d])).multiplyScalar(.85 + r() * .3), r() * 6.28, .7 + r() * .6, (r() - .5) * .4); }); },
    grass(n, o) {
      const cols = o.cols || [0x6f8a3c, 0x7d9442, 0x5f7a34]; const fl = o.flowers || null;
      return ctx.scatter(n, { maxSlope: .8, r: 0, free: true, tries: 3, ...o }, (x, z, h) => {
        if (fl && r() < (o.flowerK ?? .08)) I.small('flower', x, h, z, lerp(.7, 1.3, r()), r.pick(fl), r() * 6.28);
        else I.small('blade', x, h - .02, z, lerp(.7, 1.5, r()) * (o.k ?? 1), lin(r.pick(cols)).multiplyScalar(.85 + r() * .3), r() * 6.28, lerp(.7, 1.4, r()), (r() - .5) * .5);
      });
    },
    ribbon(pts0, w, c, pat = P.dirt, lift = .08, step = 1.2) { // 贴地带状网格（道路、铁轨道床）
      const pts = []; for (let i = 0; i < pts0.length - 1; i++) { const [ax, az] = pts0[i], [bx, bz] = pts0[i + 1], L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.ceil(L / step)); for (let k = 0; k < m; k++) pts.push([ax + (bx - ax) * k / m, az + (bz - az) * k / m]); }
      pts.push(pts0[pts0.length - 1]);
      const cc = lin(c);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const ya = hFinal(ax, az), yb = hFinal(bx, bz), y = Math.max((ya + yb) / 2, hFinal(mx, mz));
        if (y < wl - .3) continue;
        B.frame(mx, y + lift, mz, ry);
        B.put('box', 0, -.5, 0, L + .25, .5, w, cc, pat, [0, 0, Math.atan2(yb - ya, L)]);
      }
      B.frame();
      ctx.occupyLine(pts0, w);
    },
    rail(pts0, o = {}) {
      const pts = spline(pts0, 5); ctx.ribbon(pts, 3.2, o.bed ?? 0x6b6258, P.dirt, .12);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax), n = Math.max(1, Math.round(L / .9));
        for (let k = 0; k < n; k++) { const t = (k + .5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; B.frame(x, hFinal(x, z) + .12, z, ry); B.box(0, 0, 0, .28, .14, 2.3, 0x4a3a2c, P.wood); }
        const ya = hFinal(ax, az) + .26, yb = hFinal(bx, bz) + .26;
        B.frame((ax + bx) / 2, (ya + yb) / 2, (az + bz) / 2, ry);
        for (const s of [-.72, .72]) B.put('box', 0, 0, s, L + .05, .12, .1, 0x5d5a57, P.iron, [0, 0, Math.atan2(yb - ya, L)]);
      }
      B.frame();
    }
  });

  /* ---- 天气与特效、配方搭建 */
  const fxEnv = { R, E, open, coarse, reduced, time, sunDir, sun, hemi, base, px: 900 };
  const fx = createFx(scene, ctx, rec.weather || {}, fxEnv);
  ctx.fx = fx;
  rec.build(ctx);
  await tick();
  const kit = B.mesh(kitMaterial()); group.add(kit);
  const instGroup = new T.Group(); group.add(instGroup);
  const ninst = I.build(instGroup, { coarse });
  fx.finalize();
  if (waterMat && rec.glow) { waterMat.uniforms.uGlowP.value.fromArray(rec.glow.p); waterMat.uniforms.uGlowC.value.copy(lin(rec.glow.c)).multiplyScalar(rec.glow.i ?? 1); }

  /* ---- 渲染器状态 */
  const prev = { exp: renderer.toneMappingExposure, shadow: renderer.shadowMap.enabled, type: renderer.shadowMap.type, tm: renderer.toneMapping, auto: renderer.shadowMap.autoUpdate };
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = quality === 'high' ? T.PCFSoftShadowMap : T.PCFShadowMap; renderer.shadowMap.needsUpdate = true;
  // 手机上阴影图不必每帧重画：mid 每 4 帧更新一次（云影仍会动），low 只画一次
  renderer.shadowMap.autoUpdate = quality === 'high';
  let shadowEvery = quality === 'high' ? 1 : quality === 'mid' ? 4 : 0, shadowN = 0;
  renderer.toneMappingExposure = (time.exp ?? 1) * .92;

  /* ---- 后期 */
  let W0 = opts.width, H0 = opts.height, pr = Math.min(opts.pixelRatio || 1, quality === 'high' ? 2 : quality === 'mid' ? 1.25 : 1);
  const rt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr); composer.setSize(W0, H0);
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (quality === 'high' && rec.ao !== false && dbg.ao !== false) {
    ao = new AOPass(scene, camera, W0, H0);
    ao.blendIntensity = .85;
    ao.updateGtaoMaterial({ radius: R * .045, distanceExponent: 1.4, thickness: R * .02, scale: 1.1, samples: 12, distanceFallOff: 1 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new T.Vector2(W0, H0), time.bloom ?? .2, .55, 1.15);
  composer.addPass(bloom);
  const tilt = new ShaderPass({ ...TILT, defines: { TAPS: quality === 'high' ? 18 : 8 } }); composer.addPass(tilt);
  const grade = new ShaderPass(GRADE); composer.addPass(grade);
  grade.uniforms.uSat.value = rec.grade?.sat ?? 1.06;
  if (rec.grade?.tint) grade.uniforms.uTint.value.set(...rec.grade.tint);
  grade.uniforms.uVig.value = open ? .32 : .26;
  composer.addPass(new OutputPass());
  const applyQuality = () => {
    if (ao) ao.enabled = quality === 'high';
    // 夜景靠泛光托灯光，low 档也保留一点
    bloom.enabled = quality !== 'low' || (time.night ?? 0) > .4;
    tilt.enabled = quality !== 'low';
    if (quality === 'low') { shadowEvery = 0; renderer.shadowMap.type = T.PCFShadowMap; }
  };
  applyQuality();
  const setRes = () => { fxEnv.px = H0 * pr; skyM.uniforms.uResY.value = H0 * pr; tilt.uniforms.uRes.value.set(W0 * pr, H0 * pr); tilt.uniforms.uAmt.value = (rec.tilt ?? 1) * 5.5 * pr * Math.min(1.4, W0 / 1100); };
  setRes();

  /* ---- 相机与视角 */
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: .08, rotateSpeed: .55, zoomSpeed: .8, panSpeed: .7, screenSpacePanning: false, autoRotateSpeed: .32 });
  const Rb = open ? R * 1.05 : R * 1.22;
  const fitDist = () => { const vf = camera.fov * D2R, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect); return Rb / Math.sin(Math.min(vf, hf) / 2) * .92; };
  const views = (rec.views && rec.views.length ? rec.views : [{ label: '全景', az: 35, el: 38, d: 1 }]).map(v => ({ ...v }));
  const aimOf = v => { const t = v.t || [0, null, 0]; return new T.Vector3(t[0], t[1] ?? Math.max(hFinal(t[0], t[2]), wl) + (v.ty ?? 1.5), t[2]); };
  const camOf = v => { const tg2 = aimOf(v); const d = fitDist() * (v.d ?? 1); return tg2.clone().add(new T.Vector3().setFromSphericalCoords(d, (90 - (v.el ?? 38)) * D2R, (v.az ?? 35) * D2R)); };
  const applyLimits = () => {
    const f = fitDist();
    controls.minDistance = R * .14; controls.maxDistance = f * (open ? 1.15 : 1.6);
    controls.minPolarAngle = 8 * D2R; controls.maxPolarAngle = (open ? 74 : 84) * D2R;
  };
  applyLimits();
  let tween = null;
  function go(i, instant = false) {
    const v = views[i] || views[0], p = camOf(v), t = aimOf(v);
    if (instant || reduced) { camera.position.copy(p); controls.target.copy(t); controls.update(); tween = null; }
    else tween = { t0: performance.now(), dur: 1300, p0: camera.position.clone(), t0v: controls.target.clone(), p1: p, t1: t };
    tilt.uniforms.uBand.value = v.band ?? (open ? .12 : .16);
  }
  camera.aspect = W0 / H0; camera.updateProjectionMatrix();
  go(0, true);
  const startCam = camOf({ ...views[0], d: (views[0].d ?? 1) * 1.6, el: (views[0].el ?? 38) + 14 });
  if (!reduced) { camera.position.copy(startCam); tween = { t0: performance.now(), dur: 1800, p0: startCam.clone(), t0v: controls.target.clone(), p1: camOf(views[0]), t1: aimOf(views[0]) }; }
  controls.addEventListener('start', () => { tween = null; });
  const clampTarget = () => {
    const t = controls.target, lim = R * (open ? .8 : .7), d = Math.hypot(t.x, t.z);
    if (d > lim) { const k = lim / d; const dx = t.x * (k - 1), dz = t.z * (k - 1); t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
    const gy = Math.max(hFinal(t.x, t.z), wl);
    t.y = clamp(t.y, gy - 2, gy + R * .5);
    if (camera.position.y < Math.max(hFinal(camera.position.x, camera.position.z), wl) + 2) camera.position.y = Math.max(hFinal(camera.position.x, camera.position.z), wl) + 2;
  };

  /* ---- 帧循环 */
  let weatherOn = true, lastT = 0;
  const focusV = new T.Vector3();
  function frame(t) {
    G.uTime.value = reduced ? 0 : t;
    if (tween) {
      let k = Math.min(1, (performance.now() - tween.t0) / tween.dur); k = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.t0v, tween.t1, k);
      if (k >= 1) tween = null;
    }
    controls.update();
    clampTarget();
    G.uFocus.value.copy(controls.target);
    fx.update(reduced ? 0 : t, Math.min(.1, t - lastT || .016), camera, weatherOn);
    lastT = t;
    // 移轴焦点：跟随目标点在屏幕上的位置
    focusV.copy(controls.target).project(camera);
    tilt.uniforms.uFocus.value = clamp(focusV.y * .5 + .5, .2, .8);
    const dist = camera.position.distanceTo(controls.target);
    tilt.uniforms.uAmt.value = (rec.tilt ?? 1) * 5.5 * pr * Math.min(1.4, W0 / 1100) * clamp(fitDist() / dist, .5, 1.25);
    if (waterMat) waterMat.uniforms.uRain.value = weatherOn ? (rec.weather?.rain ?? 0) : 0;
    if (shadowEvery > 1 && ++shadowN % shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
    composer.render();
  }

  // 首帧前让着色器在后台编译，进沙盘时页面不再整段卡住
  disposables.push(await warmUp(renderer, scene, camera, composer));
  await tick();
  if (dbg.expose) window.__dioScene = { scene, camera, composer };
  const info = renderer.info;
  return {
    info: { name, label: rec.label || '', note: rec.note || '' },
    views: views.map(v => ({ label: v.label })),
    frame,
    animating: () => !reduced,
    quality: () => quality,
    // 逐档降画质：high → mid → low → 再降分辨率；返回是否还有可降的
    degrade() {
      if (quality === 'high') { quality = 'mid'; shadowEvery = 4; renderer.shadowMap.autoUpdate = false; }
      else if (quality === 'mid') quality = 'low';
      else if (pr > .75) { pr = Math.max(.75, pr - .25); }
      else return false;
      applyQuality(); composer.setPixelRatio(pr); composer.setSize(W0, H0); bloom.setSize(W0, H0); setRes(); renderer.shadowMap.needsUpdate = true;
      return true;
    },
    resize(w, h) { W0 = w; H0 = h; camera.aspect = w / h; camera.fov = coarse && w < 700 ? 34 : 28; camera.updateProjectionMatrix(); composer.setSize(w, h); bloom.setSize(w, h); setRes(); applyLimits(); },
    zoom(f) { tween = null; const off = camera.position.clone().sub(controls.target); off.setLength(clamp(off.length() * f, controls.minDistance, controls.maxDistance)); camera.position.copy(controls.target).add(off); controls.update(); },
    home() { go(0); },
    view(i) { go(i); },
    setWeather(on) { weatherOn = !!on; fx.setOn(weatherOn); },
    setOrbit(on) { controls.autoRotate = !!on && !reduced; },
    stats() { return { name, quality, pr, mode: open ? 'open' : 'closed', tris: info.render.triangles, calls: info.render.calls, kitVerts: B.count, instances: ninst, lights: lights.length, ao: !!ao }; },
    dispose() {
      controls.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); });
      });
      for (const d of disposables) d.dispose?.();
      htex.dispose(); envRT.dispose(); region?.lin.dispose(); region?.near.dispose();
      sun.shadow.map?.dispose();
      composer.dispose?.(); rt.dispose(); bloom.dispose(); ao?.dispose?.();
      renderer.toneMappingExposure = prev.exp; renderer.shadowMap.enabled = prev.shadow; renderer.shadowMap.type = prev.type; renderer.toneMapping = prev.tm; renderer.shadowMap.autoUpdate = prev.auto;
    }
  };
}

/* ---------------- 默认地表配色（配方可只给调色板） ---------------- */
export function defaultGround(pal) {
  const grass = (pal.grass || [0x6f8a43, 0x5f7c3a]).map(lin), dry = lin(pal.dry ?? 0x9c955f), dirt = lin(pal.dirt ?? 0x7b6a52);
  const rock = lin(pal.rock ?? 0x7f786d), sand = lin(pal.sand ?? 0xcdbb8e), bed = lin(pal.bed ?? 0x8f8a6a), mud = lin(pal.mud ?? 0x5d5444);
  const beach = pal.beach ?? 1.4, rockSlope = pal.rockSlope ?? .62;
  const out = { c: new T.Color(), rough: .95, rock: 0 };
  return (x, z, h, s, ctx) => {
    const N = ctx.N, wl = ctx.wl;
    const n1 = N.fbm(x * .018, z * .018, 3) * .5 + .5, n2 = N.n2(x * .09, z * .09) * .5 + .5;
    const c = out.c.copy(grass[0]).lerp(grass[1] || grass[0], n1);
    c.lerp(dry, clamp((N.fbm(x * .011 + 7, z * .011, 3) - .1) * 1.6, 0, 1) * (pal.dryK ?? .6));
    c.lerp(dirt, clamp((n2 - .72) * 3, 0, 1) * .5);
    let rough = .95, rk = 0;
    if (h < wl + beach) { const k = smooth(wl + beach, wl + beach * .3, h); c.lerp(sand, k); rough = .9; }
    if (h < wl) { c.copy(sand).lerp(bed, smooth(0, 3, wl - h)).lerp(mud, smooth(2, 8, wl - h) * .6); rough = .7; }
    const rs = smooth(rockSlope, rockSlope + .35, s + (n2 - .5) * .2);
    if (rs > 0) { c.lerp(rock, rs); rk = rs; rough = lerp(rough, .85, rs); }
    out.roughF = null;
    if (pal.paint) pal.paint(x, z, h, s, c, ctx, out);
    out.rough = out.roughF ?? rough; out.rock = rk;
    return out;
  };
}

/* 底座铭牌：黄铜底、阴刻字 */
function nameplate(name, label) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#d9b871'); gr.addColorStop(.5, '#b38a45'); gr.addColorStop(1, '#8a6630');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(60,40,15,.7)'; g.lineWidth = 6; g.strokeRect(14, 14, 996, 228);
  g.fillStyle = 'rgba(48,30,10,.88)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif';
  g.font = `700 92px ${font}`; g.fillText(name, 512, label ? 108 : 128, 940);
  if (label) { g.font = `400 40px ${font}`; g.fillStyle = 'rgba(48,30,10,.7)'; g.fillText(label, 512, 196, 940); }
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const m = new T.MeshStandardMaterial({ map: tex, roughness: .35, metalness: .75 });
  const len = Math.min(14, 4 + name.length * 1.6);
  const mesh = new T.Mesh(new T.PlaneGeometry(len, len / 4), m);
  return mesh;
}
