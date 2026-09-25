/* 终焉纪 · 三维时间树（three.js + 泛光）
   滚动驱动运镜，七段碑文随镜头出现。 */
const U = window.WDGX_util;
const scroller = document.getElementById("treeScroll");
const stage = document.getElementById("treeStage");
const caps = Array.from(document.querySelectorAll("#tCaps .t-cap"));
const labelEl = document.getElementById("treeLabel");
let started = false, running = false, raf = 0, loopFn = null;

if (scroller && stage && U) {
  U.onVisible(scroller, () => {
    if (!started) { started = true; boot().catch(() => stage.classList.add("no3d")); }
    else if (!running && loopFn) { running = true; loopFn(); }
  }, () => { running = false; cancelAnimationFrame(raf); }, "600px 0px");
}

async function boot() {
  const THREE = await import("three");
  const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
  const { OutputPass } = await import("three/addons/postprocessing/OutputPass.js");
  const { mergeGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");

  const mobile = window.innerWidth < 760;
  let W = stage.clientWidth, H = stage.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setSize(W, H);
  renderer.setClearColor(0x020203, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.insertBefore(renderer.domElement, stage.firstChild);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020203, 0.012);
  const camera = new THREE.PerspectiveCamera(mobile ? 60 : 45, W / H, 0.05, 600);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.9, 0.5, 0.35);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function glowTex(inner, mid) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.18, mid); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function cloudTex() {
    const c = document.createElement("canvas"), n = 256; c.width = c.height = n;
    const g = c.getContext("2d");
    for (let i = 0; i < 90; i++) {
      const x = n / 2 + (rnd() - 0.5) * n * 0.55, y = n / 2 + (rnd() - 0.5) * n * 0.55, r = 18 + rnd() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,.08)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const texGold = glowTex("rgba(255,248,228,1)", "rgba(235,200,130,.55)");
  const texWhite = glowTex("rgba(255,255,255,1)", "rgba(200,225,240,.55)");
  const texRed = glowTex("rgba(255,236,228,1)", "rgba(230,120,100,.6)");
  const texCloud = cloudTex();

  /* ── 树 ── */
  const segs = [];
  const tips = [];
  const tubes = [];
  function grow(p, dir, len, depth, order) {
    const q = p.clone().add(dir.clone().multiplyScalar(len));
    segs.push([p, q, depth, order]);
    if (depth <= 2) tubes.push([p, q, 0.06 / depth, order]);
    if (depth >= 6 || len < 0.22) { tips.push([q, order + 1]); return; }
    const n = depth < 3 ? 2 : (rnd() < 0.72 ? 2 : 3);
    for (let k = 0; k < n; k++) {
      const axis = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      const nd = dir.clone().applyAxisAngle(axis, 0.42 + rnd() * 0.55); nd.y += 0.14; nd.normalize();
      grow(q, nd, len * (0.62 + rnd() * 0.16), depth + 1, order + 1);
    }
  }
  const trunkPts = [];
  let p = V(-9, -3.2, 0), dir = V(1, 0.3, 0).normalize();
  trunkPts.push(p.clone());
  for (let s = 0; s < 44; s++) {
    const np = p.clone().add(dir.clone().multiplyScalar(1.1));
    segs.push([p.clone(), np.clone(), 0, s]); trunkPts.push(np.clone());
    if (s % 2 === 1 && s < 30) grow(np, V(rnd() - 0.5, 0.75 + rnd() * 0.4, (rnd() - 0.5) * 1.7).normalize(), 2.7 - s * 0.045, 1, s + 1);
    dir.add(V((rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.16)).normalize();
    p = np;
  }
  segs.sort((a, b) => a[3] - b[3]);
  const maxOrder = segs[segs.length - 1][3];

  const pos = new Float32Array(segs.length * 6), col = new Float32Array(segs.length * 6), ord = new Float32Array(segs.length * 2);
  const cA = new THREE.Color(0xfff0c8), cB = new THREE.Color(0xb08a40), tmp = new THREE.Color();
  segs.forEach((sg, i) => {
    pos.set([sg[0].x, sg[0].y, sg[0].z, sg[1].x, sg[1].y, sg[1].z], i * 6);
    tmp.copy(cA).lerp(cB, Math.min(1, sg[2] / 6)).multiplyScalar(sg[2] === 0 ? 2.2 : 1.4 - sg[2] * 0.12);
    col.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], i * 6);
    ord[i * 2] = sg[3] / maxOrder; ord[i * 2 + 1] = (sg[3] + 1) / maxOrder;
  });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  lg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  lg.setAttribute("ord", new THREE.BufferAttribute(ord, 1));
  const growU = { value: 0 };
  const lineMat = new THREE.ShaderMaterial({
    uniforms: { uGrow: growU },
    vertexShader: "attribute float ord; attribute vec3 color; varying vec3 vC; varying float vO; void main(){ vC=color; vO=ord; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "uniform float uGrow; varying vec3 vC; varying float vO; void main(){ if(vO>uGrow) discard; float edge=smoothstep(uGrow, uGrow-0.04, vO); gl_FragColor=vec4(vC*(1.0+ (1.0-edge)*3.0),1.0); }",
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const lines = new THREE.LineSegments(lg, lineMat);
  scene.add(lines);

  // 主干与一二级枝：实体发光管
  const tubeGeos = [];
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
  const tg0 = new THREE.TubeGeometry(trunkCurve, 400, 0.11, 8, false);
  tg0.setAttribute("ord", new THREE.BufferAttribute(new Float32Array(tg0.attributes.position.count).map((_, i) => (Math.floor(i / 9) / 400) * (44 / maxOrder)), 1));
  tubeGeos.push(tg0);
  tubes.forEach(t => {
    const g = new THREE.TubeGeometry(new THREE.LineCurve3(t[0], t[1]), 2, t[2], 5, false);
    g.setAttribute("ord", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(t[3] / maxOrder), 1));
    tubeGeos.push(g);
  });
  const merged = mergeGeometries(tubeGeos);
  const tubeMat = new THREE.ShaderMaterial({
    uniforms: { uGrow: growU, uTime: { value: 0 } },
    vertexShader: "attribute float ord; varying float vO; varying vec3 vN; varying vec3 vP; void main(){ vO=ord; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vP=mv.xyz; gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform float uGrow; uniform float uTime; varying float vO; varying vec3 vN; varying vec3 vP; void main(){ if(vO>uGrow) discard; float rim=1.0-abs(dot(normalize(-vP),vN)); float pulse=0.6+0.4*sin(vO*80.0-uTime*2.5); vec3 c=mix(vec3(1.0,0.83,0.5),vec3(1.0,0.97,0.88),rim)*(0.35+rim*0.9)*(0.8+pulse*0.4); c*=clamp(length(vP)/9.0,0.18,1.0); gl_FragColor=vec4(c,1.0); }",
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  });
  scene.add(new THREE.Mesh(merged, tubeMat));

  // 枝梢：世界
  const tp = new Float32Array(tips.length * 3), tphase = new Float32Array(tips.length), tord = new Float32Array(tips.length);
  tips.forEach((t, i) => { tp.set([t[0].x, t[0].y, t[0].z], i * 3); tphase[i] = rnd() * 6.28; tord[i] = t[1] / maxOrder; });
  const tipG = new THREE.BufferGeometry();
  tipG.setAttribute("position", new THREE.BufferAttribute(tp, 3));
  tipG.setAttribute("phase", new THREE.BufferAttribute(tphase, 1));
  tipG.setAttribute("ord", new THREE.BufferAttribute(tord, 1));
  const uTime = { value: 0 };
  const tipMat = new THREE.ShaderMaterial({
    uniforms: { uTime, uGrow: growU, uTex: { value: texGold }, uScale: { value: H * 0.5 } },
    vertexShader: "attribute float phase; attribute float ord; uniform float uTime; uniform float uGrow; uniform float uScale; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); float on=step(ord,uGrow); vA=on*(0.55+0.45*sin(uTime*2.0+phase)); gl_PointSize=on*(0.22+0.1*sin(uTime*1.3+phase))*uScale/-mv.z; gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform sampler2D uTex; varying float vA; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(t.rgb*1.6,t.a*vA); }",
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  scene.add(new THREE.Points(tipG, tipMat));

  // 起源之种
  const seedSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: texWhite, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  seedSpr.position.copy(trunkPts[0]); scene.add(seedSpr);
  const seedHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGold, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.35 }));
  seedHalo.position.copy(trunkPts[0]); seedHalo.scale.setScalar(5); scene.add(seedHalo);

  // 何阳所在的枝梢
  const markTip = tips.slice().sort((a, b) => a[0].distanceTo(V(4, 6, 0)) - b[0].distanceTo(V(4, 6, 0)))[0][0];
  const markSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: texRed, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  markSpr.position.copy(markTip); scene.add(markSpr);

  // 终焉与起源：两颗星，缠绕后决裂
  const starA = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGold, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  const starB = new THREE.Sprite(new THREE.SpriteMaterial({ map: texWhite, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  scene.add(starA, starB);
  const TRAIL = 26;
  function trail(color) {
    const g = new THREE.BufferGeometry(), pa = new Float32Array(TRAIL * 3), ca = new Float32Array(TRAIL * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < TRAIL; i++) { const k = 1 - i / TRAIL; ca.set([c.r * k * 1.5, c.g * k * 1.5, c.b * k * 1.5], i * 3); }
    g.setAttribute("position", new THREE.BufferAttribute(pa, 3)); g.setAttribute("color", new THREE.BufferAttribute(ca, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(l); return { line: l, pts: [] };
  }
  const trA = trail(0xffd28a), trB = trail(0xdfefff);
  function pushTrail(tr, v) {
    tr.pts.unshift(v.clone()); if (tr.pts.length > TRAIL) tr.pts.pop();
    const a = tr.line.geometry.attributes.position;
    for (let i = 0; i < TRAIL; i++) { const q = tr.pts[Math.min(i, tr.pts.length - 1)]; a.setXYZ(i, q.x, q.y, q.z); }
    a.needsUpdate = true;
  }

  // 混沌海
  const N = mobile ? 3500 : 9000;
  const sp = new Float32Array(N * 3), sc = new Float32Array(N * 3), ss = new Float32Array(N);
  const palette = [new THREE.Color(0xd7e2e5), new THREE.Color(0xc9a45b), new THREE.Color(0x6f8fb0), new THREE.Color(0x8a6fb0)];
  for (let i = 0; i < N; i++) {
    const r = 30 + Math.pow(rnd(), 0.55) * 180, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    sp.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.5, r * Math.sin(ph) * Math.sin(th)], i * 3);
    const c = palette[(rnd() * palette.length) | 0]; sc.set([c.r, c.g, c.b], i * 3); ss[i] = 0.4 + rnd() * 1.6;
  }
  const seaG = new THREE.BufferGeometry();
  seaG.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  seaG.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  seaG.setAttribute("sz", new THREE.BufferAttribute(ss, 1));
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: texWhite }, uScale: { value: H * 0.5 }, uTime },
    vertexShader: "attribute vec3 color; attribute float sz; uniform float uScale; uniform float uTime; varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=sz*uScale/-mv.z*(0.8+0.2*sin(uTime+position.x)); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform sampler2D uTex; varying vec3 vC; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC*t.rgb,t.a*0.8); }",
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sea = new THREE.Points(seaG, seaMat); scene.add(sea);

  // 星云
  const nebColors = [0x8a6d33, 0x2d5b74, 0x5a3f7a, 0xa5342b, 0x2d5b74, 0x8a6d33];
  const nebs = nebColors.map((c, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texCloud, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    const a = i / nebColors.length * Math.PI * 2;
    s.position.set(Math.cos(a) * 60, (rnd() - 0.4) * 30, Math.sin(a) * 60 - 20); s.scale.setScalar(70 + rnd() * 50);
    s.material.rotation = rnd() * 6; scene.add(s); return s;
  });

  /* ── 运镜 ── */
  const K = [
    [0.00, V(-7.4, -2.6, 2.6), V(-9, -3.2, 0)],
    [0.13, V(-3, 1.5, 13), V(-5, -1, 0)],
    [0.27, V(4, 17, 27), V(5, 3, 0)],
    [0.41, V(20, 12, 13), V(9, 9, 0)],
    [0.55, V(8, 6, 62), V(8, 4, 0)],
    [0.69, V(-16, 7, 20), V(7, 5, 0)],
    [0.84, V(24, 11, 7), V(44, 14, -4)],
    [1.00, markTip.clone().add(V(2.6, 1.3, 4.6)), markTip.clone()]
  ];
  const camCurve = new THREE.CatmullRomCurve3(K.map(k => k[1]), false, "centripetal");
  const tgtCurve = new THREE.CatmullRomCurve3(K.map(k => k[2]), false, "centripetal");
  function keyU(pp) {
    for (let i = 0; i < K.length - 1; i++) {
      if (pp <= K[i + 1][0]) { const t = (pp - K[i][0]) / (K[i + 1][0] - K[i][0]); const e = t * t * (3 - 2 * t); return (i + e) / (K.length - 1); }
    }
    return 1;
  }
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  let mx = 0, my = 0, prog = 0, shownCap = -2;
  window.addEventListener("pointermove", e => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });

  function progress() {
    const r = scroller.getBoundingClientRect(), span = scroller.offsetHeight - window.innerHeight;
    return Math.max(0, Math.min(1, -r.top / Math.max(1, span)));
  }
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H); composer.setSize(W, H); bloom.resolution.set(W / 2, H / 2);
    camera.aspect = W / H; camera.fov = W < 760 ? 60 : 45; camera.updateProjectionMatrix();
    tipMat.uniforms.uScale.value = H * 0.5; seaMat.uniforms.uScale.value = H * 0.5;
  }
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  function loop() {
    if (!running) return;
    const t = clock.getElapsedTime();
    uTime.value = t; tubeMat.uniforms.uTime.value = t;
    const dtc = Math.min(0.1, Math.max(0.001, t - (loop.lt || t - 0.016))); loop.lt = t; prog += (progress() - prog) * (U.reduced ? 1 : 1 - Math.exp(-dtc * 5));
    const u = keyU(prog);
    const cp = camCurve.getPoint(u), tg = tgtCurve.getPoint(u);
    camera.position.copy(cp).add(V(mx * 1.6, -my * 1.0, 0));
    look.copy(tg);
    camera.lookAt(look);

    growU.value = 0.03 + 0.97 * smooth((prog - 0.02) / 0.3);
    seedSpr.scale.setScalar((0.9 + 1.5 * smooth(prog / 0.1)) + Math.sin(t * 1.6) * 0.2);
    seedHalo.material.opacity = 0.25 + 0.15 * Math.sin(t * 0.9);
    markSpr.scale.setScalar(prog > 0.9 ? 1.1 + Math.sin(t * 4) * 0.35 : 0.001);

    // 决裂：0.30 缠绕，0.40 之后分离
    const cen = V(8, 12, 0), sep = smooth((prog - 0.38) / 0.14);
    const ang = t * (0.9 - sep * 0.6), rad = 1.6 + sep * 26;
    const vis = smooth((prog - 0.26) / 0.05) * (1 - smooth((prog - 0.6) / 0.06));
    starA.position.set(cen.x + Math.cos(ang) * rad, cen.y + Math.sin(ang * 0.7) * 1.5 + sep * 6, cen.z + Math.sin(ang) * rad * 0.6);
    starB.position.set(cen.x - Math.cos(ang) * rad, cen.y - Math.sin(ang * 0.7) * 1.5 - sep * 4, cen.z - Math.sin(ang) * rad * 0.6);
    starA.scale.setScalar(2.2 * vis + 0.001); starB.scale.setScalar(2.2 * vis + 0.001);
    pushTrail(trA, starA.position); pushTrail(trB, starB.position);
    trA.line.visible = trB.line.visible = vis > 0.02;
    bloom.strength = 0.85 + sep * (1 - smooth((prog - 0.5) / 0.08)) * 0.9;

    sea.rotation.y = t / 160;
    nebs.forEach((n, i) => { n.material.rotation += 0.0006 * (i % 2 ? 1 : -1); });

    // 字幕
    let ci = -1;
    const segsCap = [[0.02, 0.12], [0.14, 0.25], [0.28, 0.38], [0.41, 0.53], [0.56, 0.66], [0.69, 0.8], [0.84, 0.95]];
    segsCap.forEach((r, i) => { if (prog >= r[0] && prog < r[1]) ci = i; });
    if (ci !== shownCap) { shownCap = ci; caps.forEach((c, i) => c.classList.toggle("on", i === ci)); }

    composer.render();

    if (labelEl) {
      const v = markTip.clone().project(camera);
      const ok = prog > 0.93 && v.z < 1;
      labelEl.style.opacity = ok ? "1" : "0";
      labelEl.style.left = ((v.x + 1) / 2 * W) + "px";
      labelEl.style.top = ((1 - v.y) / 2 * H) + "px";
    }
    raf = requestAnimationFrame(loop);
  }
  loopFn = loop;
  running = true; loop();
}
