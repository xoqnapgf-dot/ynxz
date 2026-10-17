/* 星球：地表（陆地 / 海洋 / 河湖）、云层、大气散射、星空。
   单位：行星半径 = 1。贴图由 tools/build_planet.py 烘焙，不含任何光照；
   日照、云影、海面高光、晨昏线和大气透视都在这里实时计算（单次散射，Rayleigh + Mie）。 */
import * as T from 'three';

export const ATM = {
  top: 1.045, hr: .0055, hm: .0016,
  betaR: new T.Vector3(8.5, 19.8, 48.5), betaM: 16, g: .76, sun: 5.2
};
export const DISP = .0115;     // 地形位移（相对半径，已夸张）
export const CLOUD_ALT = .0105;

/* -------- 方向 ↔ 经纬贴图坐标（与平面地图 x/W, y/H 一致） -------- */
export function uvToDir(u, v, out = new T.Vector3()) {
  const lon = (u - .5) * Math.PI * 2, lat = (.5 - v) * Math.PI;
  return out.set(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
}
export function dirToUv(d) {
  const n = d.clone().normalize();
  return [Math.atan2(n.x, n.z) / (Math.PI * 2) + .5, .5 - Math.asin(T.MathUtils.clamp(n.y, -1, 1)) / Math.PI];
}

/* -------- 透射率查找表：(r, μ) → 从该点沿该方向到大气顶的透射率；射线撞地为 0 -------- */
function transmittanceLUT() {
  const NW = 256, NH = 64, data = new Uint16Array(NW * NH * 4);
  const { top, hr, hm, betaR, betaM } = ATM;
  for (let j = 0; j < NH; j++) {
    const r = 1 + (top - 1) * (j / (NH - 1)) ** 2;           // 低空更密
    for (let i = 0; i < NW; i++) {
      const mu = i / (NW - 1) * 2 - 1;
      // 撞地？
      const disc = r * r * (mu * mu - 1) + 1;
      let tr = [1, 1, 1];
      if (mu < 0 && disc > 0) tr = [0, 0, 0];
      else {
        const b = r * mu, c = r * r - top * top, tEnd = -b + Math.sqrt(Math.max(0, b * b - c));
        const N = 48, ds = tEnd / N;
        let oR = 0, oM = 0;
        for (let k = 0; k < N; k++) {
          const t = (k + .5) * ds, h = Math.sqrt(r * r + t * t + 2 * r * mu * t) - 1;
          oR += Math.exp(-h / hr) * ds; oM += Math.exp(-h / hm) * ds;
        }
        tr = [Math.exp(-(betaR.x * oR + betaM * 1.1 * oM)), Math.exp(-(betaR.y * oR + betaM * 1.1 * oM)), Math.exp(-(betaR.z * oR + betaM * 1.1 * oM))];
      }
      const o = (j * NW + i) * 4;
      data[o] = T.DataUtils.toHalfFloat(tr[0]); data[o + 1] = T.DataUtils.toHalfFloat(tr[1]); data[o + 2] = T.DataUtils.toHalfFloat(tr[2]); data[o + 3] = T.DataUtils.toHalfFloat(1);
    }
  }
  const tex = new T.DataTexture(data, NW, NH, T.RGBAFormat, T.HalfFloatType);
  tex.magFilter = tex.minFilter = T.LinearFilter; tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.needsUpdate = true;
  return tex;
}

/* -------- 共用 GLSL -------- */
const COMMON = /* glsl */`
  #define PI 3.14159265
  uniform sampler2D tTrans;
  uniform vec3 uSun;
  uniform float uSunI;
  const float RA = ${ATM.top.toFixed(4)};
  const float HR = ${ATM.hr}, HM = ${ATM.hm};
  const vec3 BR = vec3(${ATM.betaR.x}, ${ATM.betaR.y}, ${ATM.betaR.z});
  const float BM = ${ATM.betaM.toFixed(2)};
  const float G = ${ATM.g};
  vec2 dirUv(vec3 n) { return vec2(atan(n.x, n.z) / (2.0 * PI) + .5, .5 - asin(clamp(n.y, -1., 1.)) / PI); }
  // 经线接缝处的导数：取两种 u 定义中较小者，避免接缝上一条低 mip 细线
  void seamGrad(vec2 uv, out vec2 gx, out vec2 gy) {
    gx = dFdx(uv); gy = dFdy(uv);
    float u2 = fract(uv.x + .5);
    float ax = dFdx(u2), ay = dFdy(u2);
    if (abs(ax) < abs(gx.x)) gx.x = ax;
    if (abs(ay) < abs(gy.x)) gy.x = ay;
  }
  vec3 trans(float r, float mu) {
    float y = sqrt(clamp((r - 1.) / (RA - 1.), 0., 1.));
    return texture(tTrans, vec2(mu * .5 + .5, y)).rgb;
  }
  vec2 sphereHit(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd), c = dot(ro, ro) - r * r, h = b * b - c;
    if (h < 0.) return vec2(1e9, -1e9);
    h = sqrt(h); return vec2(-b - h, -b + h);
  }
  float phaseR(float c) { return 3. / (16. * PI) * (1. + c * c); }
  float phaseM(float c) { float g2 = G * G; return 3. / (8. * PI) * ((1. - g2) * (1. + c * c)) / ((2. + g2) * pow(1. + g2 - 2. * G * c, 1.5)); }
  // 单次散射：沿 ro + rd·t（t ∈ [t0, t1]）累积；返回入射光与视线透射率
  void scatter(vec3 ro, vec3 rd, float t0, float t1, const int N, out vec3 inS, out vec3 tv) {
    float ds = (t1 - t0) / float(N);
    vec3 sR = vec3(0.), sM = vec3(0.);
    float oR = 0., oM = 0.;
    for (int i = 0; i < 16; i++) {
      if (i >= N) break;
      vec3 p = ro + rd * (t0 + (float(i) + .5) * ds);
      float r = length(p), h = max(r - 1., 0.);
      float dR = exp(-h / HR) * ds, dM = exp(-h / HM) * ds;
      oR += dR * .5; oM += dM * .5;
      vec3 tView = exp(-(BR * oR + BM * 1.1 * oM));
      vec3 tSun = trans(r, dot(p / r, uSun));
      sR += dR * tView * tSun; sM += dM * tView * tSun;
      oR += dR * .5; oM += dM * .5;
    }
    float c = dot(rd, uSun);
    inS = uSunI * (BR * sR * phaseR(c) + BM * sM * phaseM(c));
    tv = exp(-(BR * oR + BM * 1.1 * oM));
  }
  // 摄像机到表面点的大气透视
  void aerial(vec3 p, out vec3 inS, out vec3 tv) {
    vec3 rd = normalize(p - cameraPosition);
    vec2 a = sphereHit(cameraPosition, rd, RA);
    float t0 = max(a.x, 0.), t1 = length(p - cameraPosition);
    if (t1 <= t0) { inS = vec3(0.); tv = vec3(1.); return; }
    scatter(cameraPosition, rd, t0, t1, 7, inS, tv);
  }
`;

// 3D simplex（Ashima Arts / Ian McEwan, MIT）
const NOISE = /* glsl */`
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
    return 105.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

const GROUND_VS = /* glsl */`
  uniform sampler2D tData, tWater;
  varying vec3 vPos;
  ${'const float PI = 3.14159265;'}
  vec2 dirUv(vec3 n) { return vec2(atan(n.x, n.z) / (2.0 * PI) + .5, .5 - asin(clamp(n.y, -1., 1.)) / PI); }
  void main() {
    vec3 n = normalize(position);
    vec2 uv = dirUv(n);
    float h = textureLod(tData, uv, 0.).r;
    float w = textureLod(tWater, uv, 0.).r;
    float d = h * ${DISP} * (1. - smoothstep(.55, .95, w));
    vPos = n * (1. + d);
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.);
  }
`;

const GROUND_FS = /* glsl */`
  ${COMMON}
  ${NOISE}
  uniform sampler2D tAlbedo, tNormal, tData, tWater, tClouds;
  uniform float uTime, uCloudShift, uCloudOn, uLights, uDetail;
  uniform vec3 uSel; uniform float uSelR;
  varying vec3 vPos;
  float D_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.) + 1.; return a2 / (PI * d * d); }
  void main() {
    vec3 N0 = normalize(vPos);
    vec2 uv = dirUv(N0), gx, gy;
    seamGrad(uv, gx, gy);
    vec3 east = normalize(cross(vec3(0., 1., 0.), N0) + vec3(1e-5, 0., 0.));
    vec3 north = cross(N0, east);
    vec3 alb = textureGrad(tAlbedo, uv, gx, gy).rgb;
    vec3 dat = textureGrad(tData, uv, gx, gy).rgb;
    float water = textureGrad(tWater, uv, gx, gy).r;
    vec3 tn = textureGrad(tNormal, uv, gx, gy).xyz * 2. - 1.;
    float foot = length(fwidth(vPos));                // 像素在地面上的尺寸
    // 近看时补充程序化细节，远看淡出
    float near = uDetail * (1. - smoothstep(.0004, .0025, foot));
    if (near > .001) {
      vec3 q = N0 * 2600.;
      tn.xy += vec2(snoise(q), snoise(q + 31.7)) * .16 * near * (1. - water);
      alb *= 1. + snoise(N0 * 5200.) * .07 * near * (1. - water);
    }
    vec3 Nl = normalize(east * tn.x + north * tn.y + N0 * max(tn.z, .05));
    vec3 L = uSun, V = normalize(cameraPosition - vPos);
    float mu = dot(N0, L);
    vec3 sunT = trans(length(vPos), mu) * uSunI;
    // 云影：太阳方向上云层的投影
    vec3 cp = normalize(vPos + L * (${CLOUD_ALT} / max(mu, .12)));
    vec2 cuv = dirUv(cp) + vec2(uCloudShift, 0.);
    vec2 cs2 = textureGrad(tClouds, cuv, gx, gy).rg;
    float shadow = smoothstep(.05, .7, cs2.r * .9 + cs2.g * .3) * uCloudOn;
    float day = smoothstep(-.06, .10, mu);
    // 天光（漫射）：随太阳高度变化，晨昏偏暖
    vec3 sky = mix(vec3(.02, .035, .07), vec3(.30, .42, .62), smoothstep(-.05, .5, mu)) * smoothstep(-.18, .12, mu);
    sky += vec3(.30, .14, .05) * exp(-abs(mu) * 9.) * smoothstep(-.2, .05, mu) * .5;
    float cav = .45 + dat.b * .7;
    // 陆地：稍软的 Lambert（植被/土壤不完全朗伯）
    float NdL = max(dot(Nl, L), 0.);
    float soft = mix(NdL, pow(NdL, .8), .4) * smoothstep(-.02, .12, mu);
    vec3 land = alb * (sunT * soft * (1. - shadow * .78) * mix(1., cav, .6) + sky * cav * .9);
    // 雪 / 冰的微弱镜面
    float snowy = smoothstep(.7, .85, min(alb.r, alb.b));
    vec3 H = normalize(L + V);
    land += snowy * sunT * pow(max(dot(Nl, H), 0.), 28.) * .08 * (1. - shadow);
    // ---- 水体
    float depth = dat.g;
    float isSea = smoothstep(.2, .02, dat.r);                       // 陆地高程 ≈ 0 → 海，否则河湖
    vec3 deep = vec3(.0025, .012, .036), mid = vec3(.006, .035, .075), shallow = vec3(.02, .10, .11);
    vec3 body = mix(shallow, mid, smoothstep(.0, .25, depth));
    body = mix(body, deep, smoothstep(.25, .85, depth));
    body = mix(body, alb * .22, (1. - smoothstep(.0, .12, depth)) * isSea * .7); // 浅滩透出海床
    body = mix(vec3(.012, .04, .045), body, isSea);                 // 河湖：略带绿
    // 波浪法线：两层随时间移动的噪声；像素越大越粗糙（远处闪光带更宽）
    vec3 wp = N0 * 900.;
    vec2 wv = vec2(snoise(wp + vec3(uTime * .03, 0., uTime * .02)), snoise(wp * 1.9 + 13.1 - vec3(0., uTime * .04, 0.)));
    vec3 Nw = normalize(N0 + (east * wv.x + north * wv.y) * .05 * (1. - smoothstep(.0008, .004, foot)));
    float rough = clamp(.07 + foot * 60., .07, .32);
    float NoH = max(dot(Nw, H), 0.), NoV = max(dot(Nw, V), .02), NoL = max(dot(Nw, L), 0.);
    float F = .02 + .98 * pow(1. - NoV, 5.);
    float spec = D_GGX(NoH, rough * rough) * F / (4. * NoV) * NoL;     // 简化的可见性项
    vec3 R = reflect(-V, Nw);
    float up = dot(R, N0);
    vec3 skyRef = mix(vec3(.16, .25, .38), vec3(.05, .11, .26), clamp(up * 3., 0., 1.)) * day;
    vec3 wcol = body * (sunT * max(mu, 0.) * .9 * (1. - shadow * .7) + sky) * (1. - F) + skyRef * F * (1. - shadow * .5) + min(spec * .45, 12.) * sunT * (1. - shadow);
    vec3 col = mix(land, wcol, water);
    // 夜面灯火（陆地）
    float night = smoothstep(.04, -.16, mu);
    col += vec3(1., .62, .3) * pow(dat.g, 1.3) * (1. - water) * night * uLights * 1.4 * (1. - shadow * .8);
    // 选中地点：柔和光晕
    if (uSelR > 0.) { float dd = distance(N0, uSel); col += vec3(1., .78, .36) * .06 * smoothstep(uSelR, uSelR * .2, dd) * (.35 + .65 * day); }
    vec3 inS, tv; aerial(vPos, inS, tv);
    gl_FragColor = vec4(col * tv + inS * .72, 1.);
  }
`;

const CLOUD_VS = /* glsl */`
  varying vec3 vPos;
  void main() { vPos = normalize(position) * (1. + ${CLOUD_ALT}); gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.); }
`;
const CLOUD_FS = /* glsl */`
  ${COMMON}
  uniform sampler2D tClouds;
  uniform float uCloudShift, uOpacity;
  varying vec3 vPos;
  void main() {
    vec3 N = normalize(vPos);
    vec2 uv = dirUv(N), gx, gy; seamGrad(uv, gx, gy);
    uv.x += uCloudShift;
    vec2 c = textureGrad(tClouds, uv, gx, gy).rg;
    float dens = clamp((max(c.r, c.g * .45) - .1) / .9, 0., 1.);
    if (dens < .02) discard;
    vec3 L = uSun, V = normalize(cameraPosition - vPos);
    vec3 east = normalize(cross(vec3(0., 1., 0.), N) + vec3(1e-5, 0., 0.)), north = cross(N, east);
    // 云顶起伏：密度梯度当作法线
    float e = .0007;
    float dx = textureGrad(tClouds, uv + vec2(e, 0.), gx, gy).r - c.r;
    float dy = textureGrad(tClouds, uv - vec2(0., e), gx, gy).r - c.r;
    vec3 Nc = normalize(N - (east * dx + north * dy) * 1.2);
    float mu = dot(N, L);
    vec3 sunT = trans(length(vPos), mu) * uSunI;
    // 朝阳一侧的自遮挡
    vec2 toward = vec2(dot(L, east), -dot(L, north)) * .0022;
    float up = textureGrad(tClouds, uv + toward, gx, gy).r;
    float self = exp(-max(up - c.r * .6, 0.) * 2.2);
    float NdL = mix(.5, 1., max(dot(Nc, L), 0.)) * smoothstep(-.08, .12, mu);
    float fwd = pow(max(dot(-V, L), 0.), 6.) * (1. - dens) * .6;   // 薄云边缘的前向散射
    vec3 sky = mix(vec3(.02, .03, .06), vec3(.28, .36, .48), smoothstep(-.05, .5, mu)) * smoothstep(-.2, .1, mu);
    vec3 col = vec3(.68) * (sunT * (NdL * mix(1., self, .7) + fwd) + sky * .9);
    vec3 inS, tv; aerial(vPos, inS, tv);
    col = col * tv + inS * .72;
    float a = smoothstep(.02, 1., dens) * .88 * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`;

const AIR_FS = /* glsl */`
  ${COMMON}
  varying vec3 vPos;
  void main() {
    vec3 rd = normalize(vPos - cameraPosition);
    vec2 a = sphereHit(cameraPosition, rd, RA);
    vec2 g = sphereHit(cameraPosition, rd, 1.);
    float t0 = max(a.x, 0.), t1 = a.y;
    if (g.x > 0. && g.x < t1) t1 = g.x;
    if (t1 <= t0) discard;
    vec3 inS, tv; scatter(cameraPosition, rd, t0, t1, 12, inS, tv);
    gl_FragColor = vec4(inS, 1.);
  }
`;
const AIR_VS = /* glsl */`varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`;

/* 星空：程序化星点（三层网格）、银河带与日面 */
const SKY_FS = /* glsl */`
  ${'#define PI 3.14159265'}
  uniform vec3 uSun; uniform float uStars;
  varying vec3 vDir;
  ${NOISE}
  float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  vec3 hash33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
  vec3 starLayer(vec3 d, float scale, float density) {
    vec3 p = d * scale, c = floor(p), f = p - c;
    vec3 col = vec3(0.);
    float h = hash13(c);
    if (h < density) {
      vec3 sp = hash33(c) * .7 + .15;
      float dist = length(f - sp);
      float px = max(fwidth(p.x), fwidth(p.y));
      float b = pow(hash13(c + 7.1), 9.) * 3. + .05;
      float s = smoothstep(px * .9, 0., dist) * b;
      float t = hash13(c + 3.3);
      vec3 tint = mix(vec3(.7, .8, 1.), vec3(1., .85, .65), t);
      col = tint * s;
    }
    return col;
  }
  void main() {
    vec3 d = normalize(vDir);
    vec3 col = vec3(0.);
    col += starLayer(d, 160., .05) + starLayer(d, 380., .035) * .6 + starLayer(d, 800., .02) * .4;
    // 银河：沿一条倾斜大圆的雾带与暗尘
    vec3 gp = normalize(vec3(.32, .86, -.39));
    float band = exp(-pow(dot(d, gp) * 4.2, 2.));
    float n = snoise(d * 6.) * .5 + snoise(d * 14.) * .3 + snoise(d * 33.) * .2;
    float dust = smoothstep(.15, .7, snoise(d * 9. + 4.) * .5 + .5) * band;
    col += vec3(.55, .58, .72) * band * (.008 + .007 * n) * (1. - dust * .7);
    col += starLayer(d, 1300., .08) * band * .5;
    col *= uStars;
    // 日面与日冕
    float c = dot(d, uSun);
    col += vec3(1., .96, .9) * smoothstep(.99996, .99999, c) * 60.;
    col += vec3(1., .85, .65) * pow(max(c, 0.), 900.) * .8 + vec3(1., .8, .6) * pow(max(c, 0.), 60.) * .015;
    gl_FragColor = vec4(col, 1.);
  }
`;

export function createPlanet(tex, { segments = 640 } = {}) {
  const trans = transmittanceLUT();
  const shared = {
    tTrans: { value: trans }, uSun: { value: new T.Vector3(.6, .3, .7).normalize() }, uSunI: { value: ATM.sun },
    uCloudShift: { value: 0 }
  };
  const group = new T.Group();
  const ground = new T.Mesh(new T.SphereGeometry(1, segments, segments / 2), new T.ShaderMaterial({
    uniforms: {
      ...shared, tAlbedo: { value: tex.albedo }, tNormal: { value: tex.normal }, tData: { value: tex.data }, tWater: { value: tex.water }, tClouds: { value: tex.clouds },
      uTime: { value: 0 }, uCloudOn: { value: 1 }, uLights: { value: 1 }, uDetail: { value: 1 }, uSel: { value: new T.Vector3() }, uSelR: { value: 0 }
    },
    vertexShader: GROUND_VS, fragmentShader: GROUND_FS
  }));
  ground.name = 'ground';
  group.add(ground);
  const clouds = new T.Mesh(new T.SphereGeometry(1, 256, 128), new T.ShaderMaterial({
    uniforms: { ...shared, tClouds: { value: tex.clouds }, uOpacity: { value: 1 } },
    vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false,
    blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor
  }));
  clouds.renderOrder = 2;
  group.add(clouds);
  const air = new T.Mesh(new T.SphereGeometry(ATM.top, 160, 80), new T.ShaderMaterial({
    uniforms: shared, vertexShader: AIR_VS, fragmentShader: AIR_FS, side: T.BackSide, transparent: true, depthWrite: false,
    blending: T.AdditiveBlending
  }));
  air.renderOrder = 3;
  group.add(air);
  const sky = new T.Mesh(new T.SphereGeometry(80, 64, 32), new T.ShaderMaterial({
    uniforms: { uSun: shared.uSun, uStars: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.); gl_Position = p.xyww; }',
    fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false
  }));
  sky.renderOrder = -1; sky.frustumCulled = false;
  group.add(sky);
  const gm = ground.material.uniforms;
  return {
    group, ground, clouds, air, sky, uniforms: shared,
    setSun(dir) { shared.uSun.value.copy(dir).normalize(); },
    setClouds(on) { clouds.visible = on; gm.uCloudOn.value = on ? 1 : 0; },
    setSelection(dir, r) { if (dir) gm.uSel.value.copy(dir); gm.uSelR.value = dir ? r : 0; },
    update(t) { gm.uTime.value = t; shared.uCloudShift.value = (t * .00012) % 1; }
  };
}

/* 地图上的线（国界）贴在球面：从平面地图的折线生成细长的面带 */
export function ribbon(polylines, width, color, opacity, lift = .0016, heightAt = null) {
  const pos = [], idx = [];
  const p = new T.Vector3(), q = new T.Vector3(), side = new T.Vector3();
  let base = 0;
  for (const line of polylines) {
    const pts = line.map(([u, v]) => uvToDir(u, v, new T.Vector3()).multiplyScalar(1 + lift + (heightAt ? heightAt(u, v) : 0)));
    for (let i = 0; i < pts.length; i++) {
      p.copy(pts[Math.max(0, i - 1)]); q.copy(pts[Math.min(pts.length - 1, i + 1)]);
      side.copy(q).sub(p).cross(pts[i]).normalize().multiplyScalar(width / 2);
      pos.push(pts[i].x + side.x, pts[i].y + side.y, pts[i].z + side.z, pts[i].x - side.x, pts[i].y - side.y, pts[i].z - side.z);
      if (i) idx.push(base + 2 * i - 2, base + 2 * i - 1, base + 2 * i, base + 2 * i - 1, base + 2 * i + 1, base + 2 * i);
    }
    base += pts.length * 2;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new T.Mesh(g, m);
  mesh.renderOrder = 1;
  return mesh;
}
