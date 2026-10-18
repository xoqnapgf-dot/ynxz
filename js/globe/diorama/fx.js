/* 沙盘天气与特效：雨、雪、花瓣/落叶/萤火/孢子/尘、烟、积云、雾片、闪电、彩虹、裂隙、极光、探照灯、飞鸟。
   全部在 GPU 上按时间推算位置，CPU 只在闪电时更新一次几何。 */
import * as T from 'three';
import { G, NOISE_GLSL, ATMOS_GLSL, lin } from './kit.js?v=25';
import { rng, makeNoise, spline } from './noise.js?v=25';

const ATM = () => ({ uFade: G.uFade, uBg: G.uBg, uHaze: G.uHaze, uHazeD: G.uHazeD, uFogC: G.uFogC, uFogY: G.uFogY, uFogH: G.uFogH, uFogD: G.uFogD, uFlash: G.uFlash, uFocus: G.uFocus });

/* ---------------- 粒子（点精灵） ---------------- */
const PART_VS = /* glsl */`
attribute vec4 aSeed; attribute vec3 aCol; attribute vec3 aEmit;
uniform float uTime, uPx, uSize, uH, uRad, uSpeed, uWind; uniform vec3 uWindV, uC; uniform int uMode;
varying vec3 vCol; varying float vA, vRot; varying vec3 vWP;
float hs(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float ph = fract(aSeed.w + uTime * uSpeed / uH);
  vec3 p; float size = uSize, a = 1.;
  vec2 disc = aSeed.xy * uRad;
  if (uMode == 0) {                    // 下落：雪 / 花瓣 / 落叶
    p = vec3(disc.x, uC.y + uH * (1. - ph), disc.y);
    float sw = sin(uTime * (1.1 + aSeed.z) + aSeed.w * 30.) * (1.2 + aSeed.z * 1.6);
    p.x += sw + uWindV.x * uWind * ph * uH * .35; p.z += cos(uTime * .9 + aSeed.w * 21.) * 1.2 + uWindV.z * uWind * ph * uH * .35;
    a = smoothstep(0., .08, ph) * smoothstep(1., .9, ph);
  } else if (uMode == 1) {             // 悬浮：萤火 / 孢子 / 灯屑
    p = vec3(disc.x, uC.y + aSeed.z * uH, disc.y);
    p += vec3(sin(uTime * .37 + aSeed.w * 17.) * 2.2, sin(uTime * .51 + aSeed.w * 9.) * 1.2 + ph * uH * .25, cos(uTime * .29 + aSeed.w * 13.) * 2.2);
    a = (.35 + .65 * pow(abs(sin(uTime * (1.2 + aSeed.z) + aSeed.w * 40.)), 3.)) * smoothstep(0., .15, ph) * smoothstep(1., .8, ph);
  } else if (uMode == 2) {             // 烟 / 火星：从发射点上升、扩散
    float t = ph;
    p = aEmit + vec3((aSeed.x) * 1.2 * t, t * uH, (aSeed.y) * 1.2 * t) + uWindV * uWind * t * t * uH * .9;
    size = uSize * (.35 + t * 1.8);
    a = smoothstep(0., .1, t) * (1. - t) * (1. - t);
  } else {                             // 横风尘絮
    p = vec3(disc.x, uC.y + aSeed.z * uH, disc.y);
    p += uWindV * (ph - .5) * uRad * 2.2;
    a = smoothstep(0., .2, ph) * smoothstep(1., .8, ph);
  }
  vCol = aCol; vA = a; vRot = aSeed.w * 6.28 + uTime * (aSeed.z - .5) * 3.;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vWP = (modelMatrix * vec4(p, 1.)).xyz;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uPx / -mv.z, 1., 96.);
}`;
const PART_FS = /* glsl */`
${NOISE_GLSL}${ATMOS_GLSL}
uniform int uShape; uniform float uOpacity, uGlow;
varying vec3 vCol; varying float vA, vRot; varying vec3 vWP;
void main() {
  vec2 q = gl_PointCoord - .5;
  float c = cos(vRot), s = sin(vRot); q = mat2(c, -s, s, c) * q;
  float m;
  if (uShape == 1) m = smoothstep(.5, .32, length(q * vec2(1., 2.2)));            // 花瓣 / 叶
  else if (uShape == 2) { float r = length(q); m = smoothstep(.5, .0, r) * (.6 + .4 * vn(q * 6. + vRot)); } // 烟团
  else m = smoothstep(.5, .1, length(q));
  float a = m * vA * uOpacity;
  if (a < .01) discard;
  vec3 col = vCol * (1. + uGlow * 3.);
  gl_FragColor = vec4(uGlow > 0. ? col : atmos(col, vWP), a);
}`;

export function createFx(scene, ctx, cfg, env) {
  const { R, open, coarse, sunDir } = env;
  const r = rng((ctx.seed ^ 0xfeed) >>> 0), N = makeNoise(ctx.seed + 7);
  const grp = new T.Group(); grp.userData.noAO = true; scene.add(grp);
  const updaters = [], storms = [], wx = cfg.windDir ?? [1, .3];
  const windV = new T.Vector3(wx[0], 0, wx[1]).normalize();
  const k = coarse ? .5 : 1;
  const top = Math.max(ctx.h(0, 0), ctx.wl > -1e3 ? ctx.wl : 0);
  const pUniforms = [];
  let fxOn = true;

  function particles(n, o) {
    n = Math.max(8, Math.round(n * k));
    const seed = new Float32Array(n * 4), colA = new Float32Array(n * 3), emit = new Float32Array(n * 3), cols = (o.cols || [0xffffff]).map(lin);
    for (let i = 0; i < n; i++) {
      let x, y; do { x = r() * 2 - 1; y = r() * 2 - 1; } while (x * x + y * y > 1);
      seed.set([x, y, r(), r()], i * 4);
      const c = cols[i % cols.length].clone().multiplyScalar(.85 + r() * .3); colA.set([c.r, c.g, c.b], i * 3);
      if (o.emitters) { const e = o.emitters[i % o.emitters.length]; emit.set(e, i * 3); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new T.BufferAttribute(seed, 4)); g.setAttribute('aCol', new T.BufferAttribute(colA, 3)); g.setAttribute('aEmit', new T.BufferAttribute(emit, 3));
    const u = {
      uTime: G.uTime, uPx: { value: 800 }, uSize: { value: o.size ?? .4 }, uH: { value: o.h ?? R * .5 }, uRad: { value: o.rad ?? R * .9 }, uSpeed: { value: o.speed ?? 1 },
      uWind: G.uWind, uWindV: { value: windV }, uC: { value: new T.Vector3(0, o.y0 ?? top, 0) }, uMode: { value: o.mode ?? 0 },
      uShape: { value: o.shape ?? 0 }, uOpacity: { value: o.opacity ?? .9 }, uGlow: { value: o.glow ?? 0 }, ...ATM()
    };
    pUniforms.push(u);
    const m = new T.ShaderMaterial({ uniforms: u, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: o.glow ? T.AdditiveBlending : T.NormalBlending });
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.userData.weather = o.weather !== false;
    grp.add(pts);
    return pts;
  }

  /* ---- 雨：GPU 线段 */
  function rain(amount) {
    const n = Math.round(6000 * amount * k), seed = new Float32Array(n * 2 * 4), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { let x, y; do { x = r() * 2 - 1; y = r() * 2 - 1; } while (x * x + y * y > 1); const s = [x, y, r(), r()]; seed.set(s, i * 8); seed.set(s, i * 8 + 4); end[i * 2 + 1] = 1; }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 6), 3)); g.setAttribute('aSeed', new T.BufferAttribute(seed, 4)); g.setAttribute('aEnd', new T.BufferAttribute(end, 1));
    const H = R * .7;
    const m = new T.ShaderMaterial({
      uniforms: { uTime: G.uTime, uH: { value: H }, uRad: { value: R * (open ? 1.1 : .92) }, uY: { value: top - 4 }, uWindV: { value: windV }, uWind: G.uWind, uCol: { value: lin(cfg.rainCol ?? 0xc8d4e0) } },
      vertexShader: `attribute vec4 aSeed; attribute float aEnd; uniform float uTime, uH, uRad, uY, uWind; uniform vec3 uWindV; varying float vA;
        void main(){ float ph = fract(aSeed.w - uTime * 22. / uH * (.85 + aSeed.z * .3));
          vec3 dir = normalize(vec3(uWindV.x * uWind * .35, -1., uWindV.z * uWind * .35));
          vec3 p = vec3(aSeed.x * uRad, uY + ph * uH, aSeed.y * uRad) + dir * aEnd * (1.4 + aSeed.z);
          vA = (1. - aEnd) * .9 + .1; vA *= smoothstep(0., .1, ph) * smoothstep(1., .85, ph);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * .35); }',
      transparent: true, depthWrite: false
    });
    const ls = new T.LineSegments(g, m); ls.frustumCulled = false; ls.userData.weather = true; grp.add(ls);
  }

  /* ---- 烟：发射点由配方添加 */
  const smokeSets = [];
  function smoke(x, y, z, o = {}) { smokeSets.push({ p: [x, y, z], ...o }); }

  /* ---- 积云：成团的块状云，会投下移动的影子 */
  function cumulus(o) {
    const n = Math.round((o.n ?? 6) * (coarse ? .7 : 1)), col = lin(o.col ?? 0xffffff), storm = o.kind === 'storm';
    const mat0 = new T.MeshStandardMaterial({ color: col, roughness: 1, metalness: 0, emissive: col, emissiveIntensity: storm ? .22 : .12, flatShading: false, transparent: true });
    const geo = new T.IcosahedronGeometry(1, 2);
    const clouds = [];
    for (let i = 0; i < n; i++) {
      const mat = mat0.clone(); // 每朵云单独淡出
      const cg = new T.Group(), s = (o.size ?? R * .09) * (.7 + r() * .7);
      const lumps = storm ? 14 : 8;
      for (let j = 0; j < lumps; j++) {
        const m = new T.Mesh(geo, mat), a = r() * Math.PI * 2, d = r() * s * 1.4;
        const ls = s * (.45 + r() * .55) * (storm ? 1.2 : 1);
        m.position.set(Math.cos(a) * d * 1.3, (storm ? r() * s * 2.2 : r() * s * .5) + ls * .2, Math.sin(a) * d * .8);
        m.scale.set(ls, ls * (storm ? .9 : .72), ls);
        m.castShadow = true; cg.add(m);
      }
      const base = new T.Mesh(geo, mat); base.scale.set(s * 2.1, s * .32, s * 1.4); base.castShadow = true; cg.add(base);
      const a = r() * Math.PI * 2, d = R * (o.inner ?? .35) + r() * R * (o.spread ?? .8);
      cg.position.set(Math.cos(a) * d, top + (o.y ?? R * .42) + r() * R * .08, Math.sin(a) * d);
      cg.rotation.y = r() * 6.28;
      cg.userData.weather = o.weather ?? false;
      grp.add(cg); clouds.push({ g: cg, sp: .4 + r() * .6, mat, s, a: 1 }); if (storm) storms.push({ g: cg, s });
    }
    const lim = R * 1.25, core = open ? R * .9 : R, v = new T.Vector3();
    updaters.push((t, dt, cam) => {
      for (const c of clouds) {
        c.g.position.addScaledVector(windV, dt * (o.speed ?? 1.4) * c.sp);
        // 云挡在镜头和主体之间时淡出，只在画面边缘当陪衬
        let want = 1;
        if (cam) {
          // 从镜头穿过云心的视线落到地面，落点在主体范围内就说明云挡住了主体
          v.copy(c.g.position).sub(cam.position);
          const k = (top - cam.position.y) / v.y;
          if (v.y < 0 && k > 1) { const gx = cam.position.x + v.x * k, gz = cam.position.z + v.z * k, far = Math.hypot(gx, gz) - core - c.s * 2 * k; want = Math.min(1, Math.max(0, far / (R * .25))); }
          // 比主体离镜头近得多的云会贴在画面边上成一团暗影，也淡出
          const near = v.length() / Math.max(1, cam.position.length());
          want = Math.min(want, Math.max(0, Math.min(1, (near - .5) / .25)));
        }
        c.a += (want - c.a) * Math.min(1, dt * 3); c.mat.opacity = c.a; c.mat.depthWrite = c.a > .98; c.g.visible = c.a > .02; c.g.children.forEach(m => { m.castShadow = c.a > .5; });
        const d = Math.hypot(c.g.position.x, c.g.position.z);
        if (d > lim && c.g.position.x * windV.x + c.g.position.z * windV.z > 0) { c.g.position.x -= windV.x * lim * 1.9; c.g.position.z -= windV.z * lim * 1.9; }
      }
    });
  }

  /* ---- 雾片：水平薄层，与地面相交处按高度纹理柔化 */
  function mist(o) {
    const tm = env.time || {}, lum = (1 - (tm.night ?? 0) * .7) * Math.min(1, .45 + (tm.si ?? 3) * .18); // 暗场景里雾不能自己发亮
    const layers = o.layers ?? 3, col = lin(o.col ?? 0xe6e8ea).multiplyScalar(lum);
    for (let i = 0; i < layers; i++) {
      const y = (o.y ?? top + 2) + i * (o.gap ?? 1.6);
      const ext = open ? ctx.E : R * 1.05;
      const m = new T.ShaderMaterial({
        uniforms: { uTime: G.uTime, uY: { value: y }, uCol: { value: col }, uOp: { value: (o.op ?? .45) * (1 - i * .18) }, uScale: { value: o.scale ?? .025 }, tH: { value: ctx.heightTex }, uHB: { value: ctx.HB }, uR: { value: open ? R * 3 : R * .98 }, uSun: { value: sunDir }, uOff: { value: i * 17.3 }, uDrift: { value: o.drift ?? 1 }, ...ATM() },
        vertexShader: 'varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `${NOISE_GLSL}${ATMOS_GLSL}
          uniform float uTime, uY, uOp, uScale, uR, uOff, uDrift; uniform vec3 uCol, uSun; uniform sampler2D tH; uniform vec4 uHB; varying vec3 vWP;
          void main(){
            vec2 p = vWP.xz * uScale + vec2(uTime * .012, uTime * .007) * uDrift + uOff;
            float n = fbm(p) * .65 + fbm(p * 2.7 + 5.) * .35;
            float th = texture2D(tH, (vWP.xz - uHB.xy) / uHB.zw).r;
            float a = smoothstep(.35, .75, n) * uOp * smoothstep(0., 2.5, uY - th) * smoothstep(uR, uR * .82, length(vWP.xz));
            if (a < .005) discard;
            vec3 c = uCol * (.85 + .3 * n) * (.75 + .35 * max(uSun.y, 0.));
            gl_FragColor = vec4(atmos(c, vWP), a);
          }`,
        transparent: true, depthWrite: false, side: T.DoubleSide
      });
      const pl = new T.Mesh(new T.PlaneGeometry(ext * 2, ext * 2).rotateX(-Math.PI / 2), m);
      pl.position.y = y; pl.renderOrder = 3 + i; pl.userData.weather = o.weather ?? true; pl.userData.noAO = true;
      grp.add(pl);
    }
  }

  /* ---- 闪电 */
  function lightning(o) { // 有雷雨云时从云底劈下，否则落在场地四周
    const mat = new T.MeshBasicMaterial({ color: lin(0xdfe8ff).multiplyScalar(9), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    const bolt = new T.Mesh(new T.BufferGeometry(), mat); bolt.frustumCulled = false; bolt.userData.weather = true; grp.add(bolt);
    let next = 3 + r() * 4, until = -1, hemi0 = env.hemi.intensity;
    updaters.push((t, dt, cam) => {
      if (!fxOn) { G.uFlash.value = 0; mat.opacity = 0; env.hemi.intensity = hemi0; return; }
      if (t > next) {
        next = t + (o.every ?? 6) * (.5 + r());
        until = t + .32;
        const vis = storms.filter(q => q.g.visible), sc = vis.length ? vis[Math.floor(r() * vis.length)] : null, a = r() * Math.PI * 2, d = sc ? r() * sc.s : R * (.3 + r() * .7);
        const x0 = (sc ? sc.g.position.x : 0) + Math.cos(a) * d, z0 = (sc ? sc.g.position.z : 0) + Math.sin(a) * d, y0 = sc ? sc.g.position.y : top + R * .6;
        const pts = []; let x = x0, z = z0, y = y0; const yg = ctx.h(x0, z0);
        while (y > yg) { pts.push(new T.Vector3(x, y, z)); y -= R * (.03 + r() * .04); x += (r() - .5) * R * .05; z += (r() - .5) * R * .05; }
        pts.push(new T.Vector3(x, yg, z));
        const v = [], cd = new T.Vector3();
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i], p1 = pts[i + 1]; cd.copy(cam.position).sub(p0).normalize();
          const side = new T.Vector3().subVectors(p1, p0).cross(cd).normalize().multiplyScalar(R * .004 * (1.3 - i / pts.length));
          v.push(...p0.clone().sub(side).toArray(), ...p0.clone().add(side).toArray(), ...p1.clone().add(side).toArray(), ...p0.clone().sub(side).toArray(), ...p1.clone().add(side).toArray(), ...p1.clone().sub(side).toArray());
        }
        bolt.geometry.dispose(); bolt.geometry = new T.BufferGeometry(); bolt.geometry.setAttribute('position', new T.Float32BufferAttribute(v, 3));
      }
      const on = t < until ? (Math.sin((until - t) * 60) > -.2 ? 1 : .3) : 0;
      G.uFlash.value = on * .9; mat.opacity = on; env.hemi.intensity = hemi0 * (1 + on * 3);
    });
  }

  /* ---- 彩虹 */
  function rainbow(o) {
    const g = new T.RingGeometry(R * 1.05, R * 1.22, 96, 1, 0, Math.PI);
    const m = new T.ShaderMaterial({
      uniforms: { uOp: { value: o.op ?? .32 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uOp; varying vec2 vP;
        vec3 spec(float t){ return clamp(vec3(abs(t * 6. - 3.) - 1., 2. - abs(t * 6. - 2.), 2. - abs(t * 6. - 4.)), 0., 1.); }
        void main(){ float r = (length(vP) - ${(R * 1.05).toFixed(2)}) / ${(R * .17).toFixed(2)}; float ang = atan(vP.y, vP.x);
          float a = uOp * smoothstep(0., .15, r) * smoothstep(1., .85, r) * smoothstep(.05, .5, ang) * smoothstep(3.09, 2.64, ang);
          gl_FragColor = vec4(spec(1. - r) * a, a); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    const mesh = new T.Mesh(g, m);
    const az = Math.atan2(-sunDir.x, -sunDir.z);
    mesh.position.set(Math.sin(az) * R * 1.2, top - R * .1, Math.cos(az) * R * 1.2);
    mesh.rotation.y = az; mesh.userData.weather = true; grp.add(mesh);
  }

  /* ---- 裂隙 / 极光：沿曲线的竖直发光带 */
  function curtain(pts0, o) {
    const pts = spline(pts0.map(p => [p[0], p[2]]), 10), ys = spline(pts0.map(p => [p[1], 0]), 10).map(p => p[0]);
    const v = [], uv = [], H = o.height;
    let acc = 0; const L = [0]; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(acc); }
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], ya = ys[i], yb = ys[i + 1], ua = L[i] / acc, ub = L[i + 1] / acc;
      v.push(ax, ya - H / 2, az, bx, yb - H / 2, bz, bx, yb + H / 2, bz, ax, ya - H / 2, az, bx, yb + H / 2, bz, ax, ya + H / 2, az);
      uv.push(ua, 0, ub, 0, ub, 1, ua, 0, ub, 1, ua, 1);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    const m = new T.ShaderMaterial({
      uniforms: { uTime: G.uTime, uA: { value: lin(o.a) }, uB: { value: lin(o.b) }, uI: { value: o.i ?? 2 }, uLen: { value: acc } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime, uI, uLen; uniform vec3 uA, uB; varying vec2 vUv;
        void main(){
          float x = vUv.x * uLen;
          ${o.kind === 'rift' ? `
          float w = .5 + (vn(vec2(x * .08, uTime * .4)) - .5) * .5;
          float core = exp(-pow((vUv.y - w) * 9., 2.)) , halo = exp(-pow((vUv.y - w) * 3.2, 2.));
          float fl = .75 + .25 * vn(vec2(x * .5 - uTime * 2., uTime * 3.));
          vec3 c = (uA * core * 3. + uB * halo * .9) * fl;
          float a = (core + halo * .5) * smoothstep(0., .08, vUv.x) * smoothstep(1., .92, vUv.x);` : `
          float rays = vn(vec2(x * .35 + uTime * .3, uTime * .1)) * .6 + vn(vec2(x * 1.3 - uTime * .5, 2.)) * .4;
          float body = smoothstep(0., .25, vUv.y) * pow(1. - vUv.y, 1.6) * (.4 + rays);
          vec3 c = mix(uA, uB, smoothstep(.25, .9, vUv.y)) * body;
          float a = body * smoothstep(0., .1, vUv.x) * smoothstep(1., .9, vUv.x);`}
          gl_FragColor = vec4(c * uI * a, a);
        }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; mesh.userData.weather = o.weather ?? false; mesh.userData.noAO = true; grp.add(mesh);
    return mesh;
  }

  /* ---- 探照灯 */
  const beams = [];
  function searchlight(x, y, z, o = {}) { beams.push({ p: new T.Vector3(x, y, z), ...o }); }

  /* ---- 飞鸟 */
  function birds(o) {
    const n = Math.round((o.n ?? 14) * k), g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([0, 0, .3, -1, 0, -.2, 0, 0, -.1, 0, 0, .3, 0, 0, -.1, 1, 0, -.2], 3)); g.computeVertexNormals();
    const m = new T.MeshBasicMaterial({ color: lin(o.col ?? 0x2b2b2b), side: T.DoubleSide });
    m.onBeforeCompile = sh => { sh.uniforms.uTime = G.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\n float ph = instanceMatrix[3].x * .7 + instanceMatrix[3].z * .3; transformed.y += abs(transformed.x) * sin(uTime * 9. + ph) * .7;'); };
    const im = new T.InstancedMesh(g, m, n); im.frustumCulled = false; im.userData.noAO = true;
    const fl = []; for (let i = 0; i < n; i++) fl.push({ r: R * (.25 + r() * .5), y: top + (o.y ?? R * .25) + r() * R * .1, a: r() * 6.28, s: (.08 + r() * .05) * (r() < .5 ? 1 : -1), c: [(r() - .5) * R * .4, (r() - .5) * R * .4] });
    const M = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), P = new T.Vector3(), S = new T.Vector3(.55, .55, .55);
    updaters.push(t => {
      fl.forEach((b, i) => { const a = b.a + t * b.s; P.set(b.c[0] + Math.cos(a) * b.r, b.y + Math.sin(t * .4 + i) * 1.5, b.c[1] + Math.sin(a) * b.r); e.set(0, -a + (b.s > 0 ? Math.PI : 0), 0); q.setFromEuler(e); M.compose(P, q, S); im.setMatrixAt(i, M); });
      im.instanceMatrix.needsUpdate = true;
    });
    grp.add(im);
  }

  /* ---- 按配置生成 */
  if (cfg.rain) rain(cfg.rain);
  if (cfg.snow) particles(4200 * cfg.snow, { mode: 0, size: .32, h: R * .7, speed: 2.2, cols: [0xffffff, 0xf2f6ff], opacity: .95, y0: top - 4, rad: R * (open ? 1.1 : .92) });
  if (cfg.petals) particles(cfg.petals.n ?? 900, { mode: 0, shape: 1, size: .45, h: R * .35, speed: 1.4, cols: cfg.petals.cols, opacity: 1, y0: top, rad: cfg.petals.rad ?? R * .8 });
  if (cfg.leaves) particles(cfg.leaves.n ?? 600, { mode: 0, shape: 1, size: .6, h: R * .3, speed: 1.6, cols: cfg.leaves.cols, opacity: 1, y0: top, rad: R * .85 });
  if (cfg.motes) for (const mo of [].concat(cfg.motes)) particles(mo.n ?? 400, { mode: mo.kind === 'dust' ? 3 : 1, size: mo.size ?? .35, h: mo.h ?? R * .2, speed: mo.speed ?? .25, cols: mo.cols || [0xffd27a], glow: mo.kind === 'dust' ? 0 : (mo.glow ?? 1), opacity: mo.op ?? .9, y0: mo.y ?? top, rad: mo.rad ?? R * .8, weather: mo.weather ?? false });
  if (cfg.clouds) for (const c of [].concat(cfg.clouds)) cumulus(c);
  if (cfg.mist) for (const m of [].concat(cfg.mist)) mist(m);
  if (cfg.lightning) lightning(cfg.lightning === true ? {} : cfg.lightning);
  if (cfg.rainbow) rainbow(cfg.rainbow === true ? {} : cfg.rainbow);
  if (cfg.rift) curtain(cfg.rift.pts, { kind: 'rift', height: cfg.rift.h ?? R * .16, a: cfg.rift.a ?? 0xd8f4ff, b: cfg.rift.b ?? 0x8a4dff, i: cfg.rift.i ?? 1.6 });
  if (cfg.aurora) for (const au of [].concat(cfg.aurora)) curtain(au.pts, { kind: 'aurora', height: au.h ?? R * .5, a: au.a ?? 0x3dffa0, b: au.b ?? 0xa04dff, i: au.i ?? 1.4 });
  if (cfg.birds) birds(cfg.birds === true ? {} : cfg.birds);

  return {
    smoke, searchlight, curtain, particles, group: grp,
    finalize() {
      // 烟：每个发射点一组粒子；按颜色分批
      const byKind = new Map();
      for (const s of smokeSets) { const key = (s.col ?? 0x8a8580) + '|' + (s.glow ? 1 : 0) + '|' + (s.size ?? 1.6) + '|' + (s.h ?? 14); if (!byKind.has(key)) byKind.set(key, []); byKind.get(key).push(s); }
      for (const list of byKind.values()) {
        const s0 = list[0];
        particles(list.length * (s0.n ?? 36), { mode: 2, shape: s0.glow ? 0 : 2, size: s0.size ?? 1.6, h: s0.h ?? 14, speed: s0.speed ?? .9, cols: [s0.col ?? 0x8a8580], glow: s0.glow ? 1 : 0, opacity: s0.op ?? .55, emitters: list.map(x => x.p), weather: false });
      }
      // 探照灯
      for (const b of beams) {
        const len = b.len ?? R * .7, g = new T.CylinderGeometry(.25, len * .09, len, 24, 1, true).translate(0, len / 2, 0);
        const m = new T.ShaderMaterial({
          uniforms: { uCol: { value: lin(b.col ?? 0xfff2d0) }, uI: { value: b.i ?? .5 } },
          vertexShader: 'varying float vY; varying vec3 vN, vV; void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
          fragmentShader: `uniform vec3 uCol; uniform float uI; varying float vY; varying vec3 vN, vV; void main(){ float e = pow(abs(dot(vN, vV)), 1.6); float a = e * uI * exp(-vY / ${(len * .45).toFixed(1)}); gl_FragColor = vec4(uCol * a, a); }`,
          transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
        });
        const mesh = new T.Mesh(g, m); mesh.position.copy(b.p); mesh.userData.noAO = true; mesh.frustumCulled = false; grp.add(mesh);
        const ph = r() * 6.28, tilt = b.tilt ?? .7;
        updaters.push(t => { mesh.rotation.set(Math.sin(t * .23 + ph) * .25 + tilt, t * (b.spin ?? .18) + ph, 0, 'YXZ'); });
      }
    },
    update(t, dt, camera, on) {
      const h = camera.isPerspectiveCamera ? (env.px ?? 900) / (2 * Math.tan(camera.fov * Math.PI / 360)) : 900;
      for (const u of pUniforms) u.uPx.value = h;
      for (const f of updaters) f(t, dt, camera);
      void N;
    },
    setOn(on) {
      fxOn = on;
      grp.traverse(o => { if (o.userData.weather) o.visible = on; });
    }
  };
}
