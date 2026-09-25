/* 万道归墟 · 开篇 PV（three.js 实时渲染）
   九个分镜，每个分镜一套场景与运镜；统一泛光后期；
   文字全部预渲染为贴图；手机端自动降档。声音由 WebAudio 合成。 */
const U = window.WDGX_util, D = window.WDGX;
const box = document.getElementById("pv");
const host = document.getElementById("pvGl");
const capEl = document.getElementById("pvCap"), prog = document.getElementById("pvProg");
const btnPlay = document.getElementById("pvPlay"), btnSound = document.getElementById("pvSound");
const fadeEl = document.createElement("div");
fadeEl.style.cssText = "position:absolute;inset:0;z-index:1;pointer-events:none;background:#000;opacity:1";
if (box) box.insertBefore(fadeEl, box.querySelector(".pv-bar"));

let E = null;           // 引擎（首次打开时构建）
let playing = false, time = 0, last = 0, raf = 0, lastFocus = null, building = null;

if (box) {
  document.addEventListener("click", e => { if (e.target.closest("[data-pv]")) { e.preventDefault(); open(); } });
  document.getElementById("pvClose").addEventListener("click", close);
  btnPlay.addEventListener("click", () => playing ? pause() : play());
  document.getElementById("pvReplay").addEventListener("click", () => { time = 0; if (E) E.cur = -1; if (!playing) play(); });
  btnSound.addEventListener("click", () => { A.on = !A.on; btnSound.textContent = A.on ? "声音 开" : "声音 关"; A.master && A.master.gain.setTargetAtTime(A.on && playing ? 0.9 : 0, A.ctx.currentTime, 0.3); });
  document.querySelector(".pv-prog").addEventListener("click", function (e) {
    if (!E) return; const r = this.getBoundingClientRect(); time = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * E.total; E.cur = -1; renderAt(time, 0);
  });
  document.addEventListener("keydown", e => { if (box.hidden) return; if (e.key === "Escape") close(); if (e.key === " " && e.target === document.body) { e.preventDefault(); playing ? pause() : play(); } });
  window.addEventListener("resize", () => { if (!box.hidden && E) E.resize(); });
}

async function open() {
  lastFocus = document.activeElement;
  box.hidden = false; document.documentElement.style.overflow = "hidden";
  capEl.innerHTML = '<p class="in" style="font-size:14px;letter-spacing:.4em;color:#8D9AA2">载入中</p>';
  document.getElementById("pvClose").focus();
  try {
    if (!E) { building = building || build(); E = await building; }
    E.resize(); time = 0; E.cur = -1; play();
  } catch (err) {
    capEl.innerHTML = '<p class="in">这台设备暂时无法播放 3D 画面。</p>';
  }
}
function close() { pause(); box.hidden = true; document.documentElement.style.overflow = ""; A.stop(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
function play() {
  if (!E) return;
  if (time >= E.total - 0.01) { time = 0; E.cur = -1; }
  playing = true; btnPlay.textContent = "暂停"; last = performance.now();
  A.start(); raf = requestAnimationFrame(loop);
}
function pause() { playing = false; cancelAnimationFrame(raf); btnPlay.textContent = "继续"; A.hush(); }
function loop(now) {
  if (!playing) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  if (time >= E.total) { time = E.total - 0.001; renderAt(time, dt); pause(); btnPlay.textContent = "重播"; return; }
  renderAt(time, dt);
  raf = requestAnimationFrame(loop);
}
let capKey = "";
function renderAt(tt, dt) {
  const [i, p, lt] = E.at(tt), sc = E.scenes[i];
  if (i !== E.cur) { E.cur = i; if (playing) A.cue(i); }
  sc.update(p, lt, tt);
  // 转场：黑/白
  const fi = sc.fadeIn ?? 0.35, fo = sc.fadeOut ?? 0.35;
  let f = 0, col = "#000";
  if (lt < fi) f = 1 - lt / fi;
  if (sc.d - lt < fo) { f = Math.max(f, 1 - (sc.d - lt) / fo); col = sc.outColor || "#000"; }
  if (lt < fi && i > 0 && E.scenes[i - 1].outColor) col = E.scenes[i - 1].outColor;
  fadeEl.style.background = col; fadeEl.style.opacity = f.toFixed(3);
  if (sc.tint) { const t = sc.tint(p); if (t) { fadeEl.style.background = t[0]; fadeEl.style.opacity = Math.max(f, t[1]).toFixed(3); } }
  E.bloom.strength = (sc.bloom ? sc.bloom(p) : 1) * 0.62;
  E.composer.passes[0].scene = sc.scene; E.composer.passes[0].camera = sc.camera;
  E.composer.render();
  let cap = null; sc.caps.forEach(c => { if (p >= c[0]) cap = c; });
  const key = cap ? i + ":" + cap[2] : "";
  if (key !== capKey) { capKey = key; capEl.innerHTML = cap ? '<small class="in">' + cap[1] + '</small><p class="in">' + cap[2] + "</p>" : ""; }
  prog.style.width = (tt / E.total * 100).toFixed(2) + "%";
}

/* ───────── 声音 ───────── */
const A = {
  ctx: null, master: null, on: true, verb: null,
  init() {
    if (this.ctx) return;
    try {
      const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
      const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      const wet = c.createGain(); wet.gain.value = 0.45; this.verb.connect(wet); wet.connect(this.master);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.connect(this.master); lp.connect(this.verb);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      [[55, "sawtooth", 0.05], [55.4, "sawtooth", 0.05], [82.4, "triangle", 0.08], [110, "sine", 0.04]].forEach(([f, t, v]) => {
        const o = c.createOscillator(), g = c.createGain(); o.type = t; o.frequency.value = f; g.gain.value = v; o.connect(g); g.connect(lp); o.start();
      });
    } catch (e) { this.ctx = null; }
  },
  start() { this.init(); if (!this.ctx) return; if (this.ctx.state === "suspended") this.ctx.resume(); this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.4); },
  hush() { if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25); },
  stop() { if (this.ctx) { try { this.ctx.close(); } catch (e) {} } this.ctx = null; },
  out(node, dry = 1, wet = 0.6) { const g = this.ctx.createGain(); g.gain.value = dry; node.connect(g); g.connect(this.master); if (wet) { const w = this.ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(this.verb); } },
  tone(f, dur, vol, type = "sine", at = 0, slide = 0) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.out(g); o.start(t); o.stop(t + dur + 0.05);
  },
  bell(f, dur, vol, at = 0) { [1, 2.76, 5.4, 8.9].forEach((m, i) => this.tone(f * m, dur / (i + 1), vol / (i + 1.3), "sine", at)); },
  noise(dur, vol, type = "bandpass", f0 = 400, f1 = 4000, at = 0) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime + at, n = Math.floor(c.sampleRate * dur);
    const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; fl.type = type;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); this.out(g, 1, 0.3); s.start(t);
  },
  boom(at = 0, vol = 0.9) { this.tone(90, 2.2, vol, "sine", at, 28); this.noise(0.6, vol * 0.4, "lowpass", 800, 90, at); },
  cue(i) {
    if (!this.ctx) return;
    [
      () => { this.noise(5.6, 0.18, "highpass", 3000, 5000); this.tone(220, 1.0, 0.12, "square", 3.4); this.tone(277, 1.0, 0.1, "square", 3.4); this.noise(1.2, 0.5, "bandpass", 200, 6000, 4.4); this.boom(5.3, 1); },
      () => { for (let k = 0; k < 7; k++) this.tone(900 + k * 140, 0.07, 0.08, "square", 0.6 + k * 0.42); this.tone(160, 0.35, 0.2, "sawtooth", 5.0, 60); },
      () => { this.bell(392, 5, 0.12); this.tone(196, 6, 0.08, "triangle", 0.2); this.tone(293.7, 6, 0.06, "sine", 0.6); },
      () => { this.tone(311, 3, 0.1, "sine"); this.noise(1.4, 0.45, "highpass", 2000, 9000, 2.6); this.bell(622, 3, 0.1, 2.7); },
      () => { this.boom(0.2, 0.7); this.noise(6.5, 0.12, "lowpass", 200, 60); this.bell(220, 6, 0.14, 1.2); this.bell(233, 6, 0.1, 4.2); },
      () => { this.noise(6.6, 0.3, "bandpass", 200, 8000); this.tone(110, 6.5, 0.12, "sawtooth", 0, 880); },
      () => { [523, 659, 784, 988, 1175].forEach((f, k) => this.bell(f, 4, 0.08, 0.4 + k * 0.5)); },
      () => { this.boom(0.1, 0.9); this.tone(49, 7, 0.3, "sine"); this.boom(5.0, 1); this.bell(165, 5, 0.14, 5.0); },
      () => { this.boom(0.2, 0.6); this.bell(196, 7, 0.2, 0.3); this.bell(294, 7, 0.12, 0.3); this.boom(3.6, 0.8); this.bell(392, 6, 0.14, 3.6); }
    ][i]?.();
  }
};

/* ───────── 构建 ───────── */
async function build() {
  const THREE = await import("three");
  const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
  const { OutputPass } = await import("three/addons/postprocessing/OutputPass.js");
  if (document.fonts && document.fonts.load) {
    await Promise.race([Promise.all([
      document.fonts.load("80px 'Zhi Mang Xing'", "万道归墟何阳剑火雷阵符龙凰风水土金木鼎镜轮命梦灭初源焉道法"),
      document.fonts.load("500 40px 'Noto Sans SC'", "宿主何阳境界筑基当前所处地星源天龙岩洞储物空间点击展开任务列表不可见您的账号正处于封禁期小时后解封SYSTEM"),
      document.fonts.load("900 60px 'Noto Serif SC'", "恒星系星团星系群星系团宇宙结构单体多元超多元无限盒子次方阶指数塔无穷超越逻辑与数学")
    ]), new Promise(r => setTimeout(r, 3000))]);
  }

  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  const Q = mobile ? 0.4 : 1;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);
  const composer = new EffectComposer(renderer);
  const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  composer.addPass(rp);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.45, 0.62);
  composer.addPass(bloom); composer.addPass(new OutputPass());

  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

  /* 贴图工厂 */
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const glow = (inner, mid) => canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(0.2, mid); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const T_GOLD = glow("rgba(255,248,228,1)", "rgba(235,200,130,.5)");
  const T_WHITE = glow("rgba(255,255,255,1)", "rgba(200,225,245,.5)");
  const T_WARM = glow("rgba(255,250,235,1)", "rgba(255,210,150,.55)");
  const T_CYAN = glow("rgba(230,250,255,1)", "rgba(127,185,203,.55)");
  const T_RED = glow("rgba(255,230,220,1)", "rgba(220,90,70,.6)");
  const T_DOT = glow("rgba(255,255,255,1)", "rgba(255,255,255,.35)");
  const T_CLOUD = canvasTex(256, 256, (g, n) => { for (let i = 0; i < 90; i++) { const x = n / 2 + (rnd() - 0.5) * n * 0.55, y = n / 2 + (rnd() - 0.5) * n * 0.55, r = 18 + rnd() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.09)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, n); } });
  const T_STREAK = canvasTex(256, 32, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,250,235,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.globalAlpha = 1; g.fillRect(0, h / 2 - 1.5, w, 3); g.globalAlpha = 0.35; g.fillRect(0, h / 2 - 5, w, 10); });
  function textTex(text, font, color, opts = {}) {
    const m = document.createElement("canvas").getContext("2d"); m.font = font;
    const w = Math.ceil(m.measureText(text).width) + (opts.pad || 40) * 2, fs = parseInt(font.match(/(\d+)px/)[1], 10), h = Math.ceil(fs * 1.5) + (opts.pad || 40);
    const tex = canvasTex(w, h, (g) => {
      g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
      if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = opts.blur || 30; }
      g.fillStyle = color; g.fillText(text, w / 2, h / 2 + fs * 0.05);
      if (opts.glow) { g.shadowBlur = 0; g.fillText(text, w / 2, h / 2 + fs * 0.05); }
    });
    tex.userData = { aspect: w / h }; return tex;
  }
  const BRUSH = "'Zhi Mang Xing', 'KaiTi', serif", SANS = "'Noto Sans SC', sans-serif", SERIF = "'Noto Serif SC', serif";
  function stars(n, r, size = 1.2, color = 0xd7e2e5) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = rnd() * 6.283, ph = Math.acos(2 * rnd() - 1), rr = r * (0.7 + rnd() * 0.3); p.set([rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th)], i * 3); }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, map: T_DOT, color, ...ADD, sizeAttenuation: false, opacity: 0.85 }));
  }
  function sprite(tex, scale, color = 0xffffff, opacity = 1, blending = THREE.AdditiveBlending) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, blending, depthWrite: false, opacity }));
    if (Array.isArray(scale)) s.scale.set(scale[0], scale[1], 1); else s.scale.setScalar(scale); return s;
  }
  function textPlane(tex, height, mat) {
    const g = new THREE.PlaneGeometry(height * tex.userData.aspect, height);
    return new THREE.Mesh(g, mat || new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  }
  const NOISE = `
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
    float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*vn(p); p*=2.03; a*=0.5; } return v; }`;
  // JS 噪声（地形用）
  const perm = new Uint8Array(512); for (let i = 0; i < 256; i++) perm[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const hsh = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hsh(xi, yi), hsh(xi + 1, yi), u), lerp(hsh(xi, yi + 1), hsh(xi + 1, yi + 1), u), v); }
  function fbm2(x, y, o = 5) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vnoise(x, y); x *= 2.02; y *= 2.02; a *= 0.5; } return s; }

  const scenes = [];
  const mkCam = (fov = 45) => new THREE.PerspectiveCamera(fov, 1, 0.1, 2000);

  /* ═══ 1 雨夜 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x030406); scene.fog = new THREE.Fog(0x030406, 10, 140);
    const cam = mkCam(40);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 300), new THREE.MeshBasicMaterial({ color: 0x07090c }));
    road.rotation.x = -Math.PI / 2; road.position.z = -120; scene.add(road);
    const dashes = new THREE.Group();
    for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.4), new THREE.MeshBasicMaterial({ color: 0x8a8f94 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.01, -i * 8); dashes.add(m); }
    scene.add(dashes);
    const bok = new THREE.Group();
    for (let i = 0; i < 70 * Q + 20; i++) { const s = sprite(rnd() < 0.6 ? T_WARM : T_CYAN, 2 + rnd() * 5, rnd() < 0.6 ? 0xffb070 : 0x7fb9cb, 0.25 + rnd() * 0.3); s.position.set((rnd() - 0.5) * 120, 1 + rnd() * 20, -80 - rnd() * 60); bok.add(s); }
    scene.add(bok);
    // 雨
    const N = Math.floor(2600 * Q + 400), rg = new THREE.BufferGeometry(), rp = new Float32Array(N * 6), rs = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { const x = (rnd() - 0.5) * 30, y = rnd() * 22, z = -rnd() * 60 + 4, sp = 0.8 + rnd() * 0.4; rp.set([x, y, z, x - 0.05, y + 0.7, z], i * 6); rs.set([sp, sp], i * 2); }
    rg.setAttribute("position", new THREE.BufferAttribute(rp, 3)); rg.setAttribute("spd", new THREE.BufferAttribute(rs, 1));
    const lightU = { value: V(0, 1.2, -100) };
    const rainMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uL: lightU },
      vertexShader: "attribute float spd; uniform float uT; uniform vec3 uL; varying float vB; void main(){ vec3 p=position; p.y=mod(p.y-uT*24.0*spd,22.0)-2.0; float d=length(p-uL); vB=0.18+6.0/(1.0+d*d*0.06); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }",
      fragmentShader: "varying float vB; void main(){ gl_FragColor=vec4(vec3(0.75,0.85,0.95)*vB,vB*0.7); }", ...ADD
    });
    scene.add(new THREE.LineSegments(rg, rainMat));
    const lights = [-1.5, 1.5].map(x => { const s = sprite(T_WARM, 3, 0xfff0d8); scene.add(s); const r = sprite(T_WARM, [1.2, 12], 0xffd9a0, 0.5); scene.add(r); return [s, r, x]; });
    const streak = sprite(T_STREAK, [30, 1.4], 0xfff3dd, 0.8); scene.add(streak);
    scenes.push({
      d: 6, scene, camera: cam, outColor: "#fff", fadeIn: 0.6, fadeOut: 0.45,
      caps: [[0.05, "序章", "假期回家的路上，一辆泥头车刹车失灵。"]],
      bloom: p => 0.9 + p * 1.6,
      update(p, lt) {
        rainMat.uniforms.uT.value = lt;
        const k = Math.pow(p, 2.4), z = lerp(-110, 3.5, k);
        lightU.value.set(0, 1.2, z);
        lights.forEach(([s, r, x]) => { s.position.set(x * (0.6 + k * 0.4), 1.25, z); s.scale.setScalar(2.4 + k * 26); r.position.set(x * (0.6 + k * 0.4), 0.02, z + 5); r.scale.set(1 + k * 4, 8 + k * 30, 1); r.material.opacity = 0.25 + k * 0.5; });
        streak.position.set(0, 1.25, z + 0.1); streak.scale.set(10 + k * 90, 0.6 + k * 3, 1); streak.material.opacity = 0.3 + k * 0.7;
        const sh = k * 0.08; cam.position.set(0.9 + (Math.random() - 0.5) * sh, 1.05 + (Math.random() - 0.5) * sh, 7 - p * 1.2); cam.lookAt(0, 1.3, -40);
        bok.position.x = Math.sin(lt * 0.2) * 0.5;
      }
    });
  })();

  /* ═══ 2 系统面板 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020406); scene.fog = new THREE.FogExp2(0x020406, 0.05);
    const cam = mkCam(40);
    const lines = D.panel.map(r => r[0] ? "【" + r[0] + "：" + r[1] + "】" : "【" + r[1] + "】");
    const TW = 1400, TH = 820, top = 170, lh = 100;
    const tex = canvasTex(TW, TH, (g) => {
      g.fillStyle = "rgba(10,18,26,.82)"; g.fillRect(0, 0, TW, TH);
      g.strokeStyle = "rgba(127,185,203,.9)"; g.lineWidth = 3; g.strokeRect(12, 12, TW - 24, TH - 24);
      g.strokeStyle = "rgba(127,185,203,.35)"; g.lineWidth = 1; g.strokeRect(26, 26, TW - 52, TH - 52);
      g.font = "500 30px " + SANS; g.fillStyle = "rgba(127,185,203,.9)"; g.fillText("SYSTEM  ·  宿 主 面 板", 60, 90);
      g.fillStyle = "#E08A7A"; g.beginPath(); g.arc(TW - 70, 80, 10, 0, 6.28); g.fill();
      lines.forEach((l, i) => {
        const warn = i === lines.length - 1; g.font = "500 " + (warn ? 50 : 56) + "px " + SANS;
        let x = 70; const y = top + i * lh;
        for (const ch of l) { g.fillStyle = (ch === "【" || ch === "】") ? "#C9A45B" : (warn ? "#FF9A86" : "#D5ECF3"); g.fillText(ch, x, y); x += g.measureText(ch).width; }
      });
    });
    const rev = new Float32Array(6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uRev: { value: rev }, uT: { value: 0 }, uG: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: NOISE + `uniform sampler2D uTex; uniform float uRev[6]; uniform float uT; uniform float uG; varying vec2 vUv;
        void main(){ vec2 uv=vUv; float band=step(0.93-uG*0.4,h21(vec2(floor(uv.y*38.0),floor(uT*14.0)))); uv.x+=band*(h21(vec2(uT,uv.y))-0.5)*0.12*uG;
          float y=(1.0-uv.y)*${TH}.0; float li=floor((y-${top - 70}.0)/${lh}.0); float a=1.0;
          if(li>=0.0 && li<6.0){ float r=0.0; for(int i=0;i<6;i++){ if(float(i)==li) r=uRev[i]; } if(uv.x>0.05+r*0.92) a=0.12; }
          float ca=0.004+uG*0.012; vec4 c; c.r=texture2D(uTex,uv+vec2(ca,0)).r; c.g=texture2D(uTex,uv).g; c.b=texture2D(uTex,uv-vec2(ca,0)).b; c.a=texture2D(uTex,uv).a;
          float scan=0.82+0.18*sin(uv.y*900.0+uT*6.0); float fl=0.92+0.08*sin(uT*37.0);
          vec3 col=c.rgb*scan*fl*1.35; if(li>=0.0&&li<6.0&&a<1.0) col*=0.25;
          gl_FragColor=vec4(col,c.a*(0.35+0.65*a)); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7, 7 * TH / TW), mat); scene.add(panel);
    const frameGlow = sprite(T_CYAN, [11, 7], 0x7fb9cb, 0.18); frameGlow.position.z = -0.5; scene.add(frameGlow);
    const grid = new THREE.GridHelper(80, 80, 0x2d5b74, 0x10212b); grid.position.y = -3.2; grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);
    const N = Math.floor(900 * Q + 200), g = new THREE.BufferGeometry(), pp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pp.set([(rnd() - 0.5) * 30, (rnd() - 0.5) * 16, (rnd() - 0.5) * 20 - 4], i * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    const dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, map: T_CYAN, color: 0x9fd6e6, ...ADD })); scene.add(dust);
    scenes.push({
      d: 6.5, scene, camera: cam, fadeIn: 0.5,
      caps: [[0.25, "星源天 · 第九天", "眼睛一睁一闭，何阳到了另一个世界。带着一个会封号的系统。"]],
      bloom: p => 0.9 + (p > 0.82 ? (p - 0.82) * 5 : 0),
      update(p, lt) {
        mat.uniforms.uT.value = lt;
        for (let i = 0; i < 6; i++) rev[i] = sm((p - 0.1 - i * 0.1) / 0.1);
        mat.uniforms.uG.value = p > 0.8 ? 0.5 + (p - 0.8) * 2.5 : 0.08 + (Math.random() < 0.03 ? 0.4 : 0);
        dust.rotation.y = lt * 0.03; dust.position.y = Math.sin(lt * 0.4) * 0.2;
        const a = lerp(-0.5, 0.25, sm(p)); cam.position.set(Math.sin(a) * lerp(11, 6.6, sm(p)), lerp(1.8, 0.2, sm(p)), Math.cos(a) * lerp(11, 6.6, sm(p))); cam.lookAt(0, 0, 0);
        panel.rotation.y = Math.sin(lt * 0.5) * 0.04;
      }
    });
  })();

  /* ═══ 3 星源天 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x03050a); scene.fog = new THREE.FogExp2(0x03050a, 0.0045);
    const cam = mkCam(42);
    scene.add(new THREE.HemisphereLight(0xb6d4e2, 0x14110e, 1.5));
    const rim = new THREE.DirectionalLight(0x7fb9cb, 1.6); rim.position.set(10, 4, -12); scene.add(rim);
    const sun = new THREE.DirectionalLight(0xffe2b0, 3.6); sun.position.set(-8, 10, 6); scene.add(sun);
    scene.add(stars(Math.floor(2500 * Q + 500), 300, 1.6));
    [[0x2d5b74, V(-60, 20, -120)], [0x8a6d33, V(70, -10, -140)], [0x5a3f7a, V(0, 40, -160)]].forEach(([c, p]) => { const s = sprite(T_CLOUD, 180, c, 0.9); s.position.copy(p); scene.add(s); });
    // 岛：上表面山地 + 下方岩锥
    const RR = 40, SS = Math.floor(90 * (mobile ? 0.7 : 1)), R = 6;
    const pos = [], colr = [], idx = [];
    const cTop = new THREE.Color(), grass = new THREE.Color(0x5f7f63), rock = new THREE.Color(0x6d6a64), snow = new THREE.Color(0xe9eef0), under = new THREE.Color(0x2b2724), deep = new THREE.Color(0x08080a);
    const edgeN = t => 1 + (fbm2(Math.cos(t) * 2 + 5, Math.sin(t) * 2 + 5, 3) - 0.5) * 0.35;
    // top
    for (let i = 0; i <= RR; i++) for (let j = 0; j < SS; j++) {
      const t = j / SS * Math.PI * 2, rr = R * (i / RR) * edgeN(t), x = Math.cos(t) * rr, z = Math.sin(t) * rr;
      const fall = Math.pow(1 - i / RR, 0.6), m = Math.pow(fbm2(x * 0.35 + 10, z * 0.35 + 3), 2.2) * 4.2 * fall + (fbm2(x * 1.3, z * 1.3, 3) - 0.5) * 0.25 * fall;
      pos.push(x, m, z);
      const hgt = m / 2.4; cTop.copy(grass).lerp(rock, sm((hgt - 0.3) / 0.4)).lerp(snow, sm((hgt - 0.78) / 0.25)); colr.push(cTop.r, cTop.g, cTop.b);
    }
    const topCount = (RR + 1) * SS;
    for (let i = 0; i < RR; i++) for (let j = 0; j < SS; j++) { const a = i * SS + j, b = i * SS + (j + 1) % SS, c = (i + 1) * SS + j, d = (i + 1) * SS + (j + 1) % SS; idx.push(a, c, b, b, c, d); }
    // underside
    const UR = 26;
    for (let i = 0; i <= UR; i++) for (let j = 0; j < SS; j++) {
      const t = j / SS * Math.PI * 2, f = 1 - i / UR, rr = R * edgeN(t) * Math.pow(f, 0.9) * (1 + (fbm2(t * 3, i * 0.3, 3) - 0.5) * 0.35);
      const y = -Math.pow(i / UR, 1.1) * 9 * (0.8 + fbm2(t * 2 + 9, 1, 2) * 0.5);
      pos.push(Math.cos(t) * rr, y, Math.sin(t) * rr); cTop.copy(under).lerp(deep, i / UR); colr.push(cTop.r, cTop.g, cTop.b);
    }
    for (let i = 0; i < UR; i++) for (let j = 0; j < SS; j++) {
      const base = topCount + (i === 0 ? 0 : 0);
      const a = (i === 0 ? RR * SS + j : topCount + i * SS + j), b = (i === 0 ? RR * SS + (j + 1) % SS : topCount + i * SS + (j + 1) % SS), c = topCount + (i + 1) * SS + j, d = topCount + (i + 1) * SS + (j + 1) % SS;
      idx.push(a, b, c, b, d, c); void base;
    }
    const ig = new THREE.BufferGeometry();
    ig.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); ig.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3)); ig.setIndex(idx); ig.computeVertexNormals();
    const island = new THREE.Mesh(ig, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02, flatShading: true }));
    const isl = new THREE.Group(); isl.add(island); scene.add(isl);
    // 瀑布
    const WN = Math.floor(1800 * Q + 300), wg = new THREE.BufferGeometry(), wp = new Float32Array(WN * 3), wo = new Float32Array(WN);
    const falls = [0.4, 2.1, 3.9, 5.2].map(t => [Math.cos(t) * R * edgeN(t) * 0.98, Math.sin(t) * R * edgeN(t) * 0.98]);
    for (let i = 0; i < WN; i++) { const f = falls[i % falls.length]; wp.set([f[0] + (rnd() - 0.5) * 0.3, 0, f[1] + (rnd() - 0.5) * 0.3], i * 3); wo[i] = rnd(); }
    wg.setAttribute("position", new THREE.BufferAttribute(wp, 3)); wg.setAttribute("off", new THREE.BufferAttribute(wo, 1));
    const wMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uTex: { value: T_WHITE } },
      vertexShader: "attribute float off; uniform float uT; varying float vA; void main(){ float k=fract(off+uT*0.22); vec3 p=position; p.y=-k*14.0; p.xz*=1.0+k*0.25; vA=(1.0-k)*0.8; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(1.0+k*3.0)*70.0/-mv.z; gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D uTex; varying float vA; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vec3(0.8,0.9,1.0)*t.rgb,t.a*vA); }", ...ADD });
    isl.add(new THREE.Points(wg, wMat));
    // 云
    for (let i = 0; i < 9; i++) { const s = sprite(T_CLOUD, 5 + rnd() * 6, 0x8e9ba2, 0.16, THREE.NormalBlending); const a = rnd() * 6.28; s.position.set(Math.cos(a) * (7 + rnd() * 4), -1 + rnd() * 2.5, Math.sin(a) * (7 + rnd() * 4)); isl.add(s); }
    // 星门
    const portalMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: NOISE + "uniform float uT; varying vec2 vUv; void main(){ vec2 c=vUv-0.5; float r=length(c)*2.0; float a=atan(c.y,c.x); float sw=fbm(vec2(a*2.0+uT*0.8+r*4.0, r*3.0-uT)); vec3 col=mix(vec3(0.35,0.6,0.75),vec3(0.95,0.78,0.45),sw); float al=smoothstep(1.0,0.2,r)*(0.2+sw*0.55); gl_FragColor=vec4(col*0.85,al); }", ...ADD, side: THREE.DoubleSide });
    const gates = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })));
      g.add(new THREE.Mesh(new THREE.CircleGeometry(0.97, 48), portalMat));
      const a = i / 6 * 6.28 + 0.3, r = 12 + (i % 3) * 3; g.position.set(Math.cos(a) * r, -1 + (i % 2) * 4, Math.sin(a) * r); g.scale.setScalar(0.8 + (i % 3) * 0.35);
      g.lookAt(0, g.position.y, 0); g.userData.a = a; g.userData.r = r; scene.add(g); gates.push(g);
    }
    // 流星：降临的穿越者
    const mets = []; for (let i = 0; i < 14; i++) { const s = sprite(T_STREAK, [6, 0.35], 0xffe7b0, 0.9); scene.add(s); mets.push([s, rnd(), (rnd() - 0.5) * 40, (rnd() - 0.5) * 30 - 10]); }
    scenes.push({
      d: 7, scene, camera: cam, fadeIn: 0.7,
      caps: [[0.12, "星源天", "漂浮在星海中的大陆。穿越者多得像批发，每人都带着自己的系统。"]],
      bloom: () => 0.85,
      update(p, lt) {
        wMat.uniforms.uT.value = lt; portalMat.uniforms.uT.value = lt;
        isl.position.y = Math.sin(lt * 0.6) * 0.25; isl.rotation.y = lt * 0.03;
        gates.forEach((g, i) => { const a = g.userData.a + lt * 0.05; g.position.x = Math.cos(a) * g.userData.r; g.position.z = Math.sin(a) * g.userData.r; g.lookAt(cam.position); });
        mets.forEach(m => { const k = (m[1] + lt * 0.35) % 1; m[0].position.set(m[2] - k * 14, 26 - k * 36, m[3]); m[0].material.rotation = 0.95; m[0].material.opacity = Math.sin(k * Math.PI); });
        const e = sm(p), a = lerp(-0.9, 0.55, e), d = lerp(36, 19, e);
        cam.position.set(Math.sin(a) * d, lerp(12, 3.2, e), Math.cos(a) * d); cam.lookAt(0, lerp(-2, 0.6, e), 0);
      }
    });
  })();

  /* ═══ 4 同脸 · 镜碎 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x040404);
    const cam = mkCam(40);
    const tL = textTex("何阳", "220px " + BRUSH, "#D9D4C7", { glow: "rgba(255,255,255,.2)", blur: 14 });
    const left = textPlane(tL, 3.1); left.position.set(-3.4, 0, 0); scene.add(left);
    const right = textPlane(tL, 3.1, new THREE.MeshBasicMaterial({ map: tL, transparent: true, depthWrite: false, color: 0xb9b4a8 })); right.position.set(3.4, 0, 0); right.scale.x = -1; scene.add(right);
    const eyeA = sprite(T_RED, 0.5, 0xff5040, 0); eyeA.position.set(3.0, 0.5, 0.2); scene.add(eyeA);
    // 镜面碎片（顶点着色器炸裂）
    const cols = mobile ? 9 : 14, rows = mobile ? 12 : 18, w = 3.2, h = 5.6;
    const P = []; for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) { const jx = (c > 0 && c < cols) ? (rnd() - 0.5) * 0.7 : 0, jy = (r > 0 && r < rows) ? (rnd() - 0.5) * 0.7 : 0; P.push([(c + jx) / cols * w - w / 2, (r + jy) / rows * h - h / 2]); }
    const pa = [], ce = [], di = [], ba = [];
    const tri = (a, b, c) => { const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, dx = cx + (rnd() - 0.5) * 0.8, dy = cy + (rnd() - 0.5) * 0.8, dz = 2 + rnd() * 4, rr = rnd();
      [[a, [1, 0, 0]], [b, [0, 1, 0]], [c, [0, 0, 1]]].forEach(([q, bc]) => { pa.push(q[0], q[1], 0); ce.push(cx, cy, 0); di.push(dx * 0.9, dy * 0.9, dz, rr); ba.push(...bc); }); };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * (cols + 1) + c; const A0 = P[i], B = P[i + 1], C = P[i + cols + 1], Dd = P[i + cols + 2]; if (rnd() < 0.5) { tri(A0, B, Dd); tri(A0, Dd, C); } else { tri(A0, B, C); tri(B, Dd, C); } }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(pa, 3)); sg.setAttribute("aC", new THREE.Float32BufferAttribute(ce, 3)); sg.setAttribute("aD", new THREE.Float32BufferAttribute(di, 4)); sg.setAttribute("aB", new THREE.Float32BufferAttribute(ba, 3));
    const shard = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uT: { value: 0 } },
      vertexShader: `attribute vec3 aC; attribute vec4 aD; attribute vec3 aB; uniform float uK; varying vec3 vB; varying float vF; varying vec2 vP;
        mat3 rot(vec3 ax,float a){ ax=normalize(ax); float s=sin(a),c=cos(a),o=1.0-c; return mat3(o*ax.x*ax.x+c,o*ax.x*ax.y+ax.z*s,o*ax.z*ax.x-ax.y*s, o*ax.x*ax.y-ax.z*s,o*ax.y*ax.y+c,o*ax.y*ax.z+ax.x*s, o*ax.z*ax.x+ax.y*s,o*ax.y*ax.z-ax.x*s,o*ax.z*ax.z+c); }
        void main(){ vB=aB; vP=position.xy; float k=max(0.0,uK-aD.w*0.25); vec3 p=position-aC; p=rot(vec3(aD.w,1.0-aD.w,0.5),k*(3.0+aD.w*6.0))*p; vec3 c=aC+vec3(aD.xy*k*2.2,aD.z*k*1.6); c.y-=k*k*1.4; vF=k; gl_Position=projectionMatrix*modelViewMatrix*vec4(c+p,1.0); }`,
      fragmentShader: `uniform float uT; varying vec3 vB; varying float vF; varying vec2 vP; void main(){ float e=min(min(vB.x,vB.y),vB.z); float edge=smoothstep(0.035,0.0,e); float sheen=0.5+0.5*sin(vP.x*1.6+vP.y*0.8-uT*1.4); vec3 glass=vec3(0.05,0.06,0.07)+vec3(0.35,0.4,0.45)*pow(sheen,6.0)*0.6; vec3 col=glass+vec3(1.0,0.85,0.55)*edge*(0.25+vF*2.5); gl_FragColor=vec4(col,0.55+edge*0.45); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mirror = new THREE.Mesh(sg, shard); scene.add(mirror);
    const mist = [];
    for (let i = 0; i < Math.floor(40 * Q + 16); i++) { const s = sprite(T_CLOUD, 2 + rnd() * 3, 0x000000, 0.9, THREE.NormalBlending); s.position.set(3.4 + (rnd() - 0.5) * 3, (rnd() - 0.5) * 3, 0.3 + rnd()); s.userData.v = V((rnd() - 0.2) * 2, (rnd() - 0.5) * 1.4, rnd()); scene.add(s); mist.push(s); }
    const flash = sprite(T_WHITE, 1, 0xfff4dd, 0); flash.position.z = 0.4; scene.add(flash);
    scenes.push({
      d: 6.5, scene, camera: cam,
      caps: [[0.52, "龙岩洞", "黑雾散尽，那张脸，和他一模一样。"]],
      bloom: p => 0.8 + Math.max(0, 1 - Math.abs(p - 0.42) * 8) * 2,
      update(p, lt) {
        shard.uniforms.uT.value = lt; shard.uniforms.uK.value = Math.max(0, (p - 0.4) / 0.6) * 2.2;
        flash.material.opacity = Math.max(0, 1 - Math.abs(p - 0.42) * 10); flash.scale.setScalar(4 + (p - 0.4) * 30);
        const mk = sm((p - 0.45) / 0.4); mist.forEach(s => { s.position.addScaledVector(s.userData.v, 0.012 * mk); s.material.opacity = 0.9 * (1 - mk); s.scale.multiplyScalar(1 + 0.004 * mk); });
        eyeA.material.opacity = sm((p - 0.7) / 0.1) * (0.6 + 0.4 * Math.sin(lt * 8));
        const e = sm(p); cam.position.set(Math.sin(lt * 0.2) * 0.6, lerp(0.4, -0.2, e), lerp(13, 8.6, e)); cam.lookAt(0, 0, 0);
      }
    });
  })();

  /* ═══ 5 天穹裂开 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x030409);
    const cam = mkCam(50);
    const inner = new THREE.Group(); inner.position.set(0, 16, -90); scene.add(inner);
    inner.add(stars(Math.floor(800 * Q + 200), 60, 1.4));
    const tet = new THREE.Mesh(new THREE.TetrahedronGeometry(7), new THREE.MeshBasicMaterial({ color: 0xf1ede2 }));
    tet.position.set(-10, 0, 0); inner.add(tet);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(tet.geometry), new THREE.LineBasicMaterial({ color: 0xffe2a0 })); tet.add(edges);
    const eyeTex = canvasTex(256, 160, (g) => { g.fillStyle = "#16181b"; g.beginPath(); g.ellipse(128, 80, 118, 64, 0, 0, 6.28); g.fill(); const gr = g.createRadialGradient(128, 80, 0, 128, 80, 52); gr.addColorStop(0, "#fff6d8"); gr.addColorStop(0.5, "#e9c46a"); gr.addColorStop(1, "#7a5a20"); g.fillStyle = gr; g.beginPath(); g.arc(128, 80, 48, 0, 6.28); g.fill(); g.fillStyle = "#000"; g.beginPath(); g.ellipse(128, 80, 10, 34, 0, 0, 6.28); g.fill(); });
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.9), new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true })); eye.position.set(-10, 0.5, 5); inner.add(eye);
    const NN = Math.floor(5000 * Q + 800), ng = new THREE.BufferGeometry(), np = new Float32Array(NN * 3), nr = new Float32Array(NN * 3);
    for (let i = 0; i < NN; i++) { const r = Math.pow(rnd(), 0.7) * 9, a = rnd() * 6.28, h = (rnd() - 0.5) * 4 * (1 - r / 10); np.set([0, 0, 0], i * 3); nr.set([r, a, h], i * 3); }
    ng.setAttribute("position", new THREE.BufferAttribute(np, 3)); ng.setAttribute("aR", new THREE.BufferAttribute(nr, 3));
    const nebMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uTex: { value: T_DOT } },
      vertexShader: "attribute vec3 aR; uniform float uT; varying float vR; void main(){ float a=aR.y+uT*(1.2/(0.6+aR.x*0.35)); vec3 p=vec3(cos(a)*aR.x*1.3, aR.z+sin(a*2.0+uT)*0.4, sin(a)*aR.x); vR=aR.x; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(2.0+ (9.0-aR.x)*0.6)*40.0/-mv.z; gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D uTex; varying float vR; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); vec3 c=mix(vec3(1.0,0.8,1.0),vec3(0.55,0.25,0.85),vR/9.0); gl_FragColor=vec4(c*t.rgb,t.a*0.7); }", ...ADD });
    const neb = new THREE.Points(ng, nebMat); neb.position.set(11, 0, 0); inner.add(neb);
    const clash = sprite(T_WHITE, 6, 0xffffff, 0); clash.position.set(0, 0, 2); inner.add(clash);
    // 天空与裂隙
    const skyMat = new THREE.ShaderMaterial({ uniforms: { uO: { value: 0 }, uT: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: NOISE + `uniform float uO; uniform float uT; varying vec2 vUv;
        void main(){ vec2 p=(vUv-vec2(0.5,0.62))*vec2(2.2,1.3); float n=fbm(p*3.0+vec2(uT*0.05,0.0)); float r=length(p*vec2(1.0,1.6))+ (n-0.5)*0.55; float o=uO*0.62;
          float inside=smoothstep(o,o-0.02,r); float edge=smoothstep(0.08,0.0,abs(r-o))*step(0.01,uO);
          vec3 sky=mix(vec3(0.02,0.025,0.05),vec3(0.06,0.05,0.09),vUv.y); float st=step(0.9975,h21(floor(vUv*vec2(900.0,600.0)))); sky+=st*0.8;
          vec3 col=sky+vec3(1.0,0.8,0.5)*edge*1.1+vec3(1.0,0.95,0.85)*pow(edge,4.0)*0.9;
          gl_FragColor=vec4(col,1.0-inside); }`, transparent: true, depthWrite: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(220, 150), skyMat); sky.position.set(0, 20, -60); scene.add(sky);
    // 大地与升空的系统光点
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x050608 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -2; scene.add(ground);
    const RN = Math.floor(2400 * Q + 400), rg = new THREE.BufferGeometry(), rp = new Float32Array(RN * 3), rd = new Float32Array(RN);
    for (let i = 0; i < RN; i++) { rp.set([(rnd() - 0.5) * 140, -1.8, -rnd() * 70 + 5], i * 3); rd[i] = rnd(); }
    rg.setAttribute("position", new THREE.BufferAttribute(rp, 3)); rg.setAttribute("dl", new THREE.BufferAttribute(rd, 1));
    const riseMat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uTex: { value: T_CYAN } },
      vertexShader: "attribute float dl; uniform float uK; varying float vA; void main(){ float k=clamp(uK*1.5-dl*0.6,0.0,1.0); k=k*k*(3.0-2.0*k); vec3 tgt=vec3(position.x*0.08, 22.0, -58.0); vec3 p=mix(position,tgt,k); vA=step(0.001,k)*(1.0-k*0.4); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=min(60.0/-mv.z*(1.0+k),9.0); gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D uTex; varying float vA; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(t.rgb*vec3(0.7,0.95,1.0),t.a*vA*0.55); }", ...ADD });
    scene.add(new THREE.Points(rg, riseMat));
    scenes.push({
      d: 7.5, scene, camera: cam,
      caps: [[0.22, "天穹裂开", "“她们找的是我。”"], [0.58, "天穹裂开", "“每一份契约，只能与一个存在签订。”"]],
      bloom: p => 1.0 + Math.max(0, Math.sin(p * 40)) * 0.6 * sm((p - 0.3) / 0.2),
      update(p, lt) {
        skyMat.uniforms.uT.value = lt; nebMat.uniforms.uT.value = lt;
        skyMat.uniforms.uO.value = sm(p / 0.35) * 1.0 + Math.sin(lt * 3) * 0.01;
        tet.rotation.y = lt * 0.25; tet.rotation.x = Math.sin(lt * 0.4) * 0.2; eye.lookAt(cam.position.clone().sub(inner.position));
        clash.material.opacity = 0.55 * Math.max(0, Math.sin(lt * 5)) * sm((p - 0.25) / 0.1); clash.scale.setScalar(4 + Math.max(0, Math.sin(lt * 5)) * 8);
        riseMat.uniforms.uK.value = sm((p - 0.4) / 0.6);
        const e = sm(p); cam.position.set(Math.sin(lt * 0.15) * 2, lerp(0, 4, e), lerp(14, 4, e)); cam.lookAt(0, lerp(6, 16, e), -60);
      }
    });
  })();

  /* ═══ 6 尺度 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x010102);
    const cam = mkCam(50);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } },
      vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: NOISE + "uniform float uT; varying vec3 vN; varying vec3 vP; void main(){ float n=fbm(vP.xy*2.5+vP.z*1.7+uT*0.02); vec3 sea=vec3(0.05,0.15,0.3), land=vec3(0.25,0.35,0.22); vec3 c=mix(sea,land,smoothstep(0.5,0.56,n)); float l=max(0.0,dot(vN,normalize(vec3(-0.6,0.4,0.7)))); float rim=pow(1.0-max(0.0,vN.z),3.0); gl_FragColor=vec4(c*(0.15+l*1.1)+vec3(0.3,0.6,1.0)*rim*0.9,1.0); }" }));
    scene.add(planet);
    const sunPos = V(-60, 0, -20);
    const sunS = sprite(T_WARM, 30, 0xffe8c0); sunS.position.copy(sunPos); scene.add(sunS);
    const orbitG = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 257 }, (_, i) => { const a = i / 256 * 6.283, r = sunPos.length(); return V(sunPos.x + Math.cos(a) * r, 0, sunPos.z + Math.sin(a) * r); }));
    [1, 1.6, 2.3, 3.4].forEach((k, j) => { const l = new THREE.Line(orbitG, new THREE.LineBasicMaterial({ color: 0xc9a45b, transparent: true, opacity: 0.35 - j * 0.06 })); l.position.copy(sunPos).multiplyScalar(1 - k); l.scale.setScalar(k); scene.add(l); });
    // 银河
    const GN = Math.floor(22000 * Q + 3000), gg = new THREE.BufferGeometry(), gp = new Float32Array(GN * 3), gc = new Float32Array(GN * 3);
    const gC = V(9000, -1500, -6000), GR = 16000;
    for (let i = 0; i < GN; i++) { const arm = i % 4, r = Math.pow(rnd(), 0.6) * GR, a = arm / 4 * 6.283 + r / GR * 5.0 + (rnd() - 0.5) * 0.5, h = (rnd() - 0.5) * 600 * (1 - r / GR); gp.set([gC.x + Math.cos(a) * r, gC.y + h, gC.z + Math.sin(a) * r], i * 3); const w = 1 - r / GR; gc.set([0.7 + w * 0.3, 0.6 + w * 0.3, 0.55 + (1 - w) * 0.4], i * 3); }
    gg.setAttribute("position", new THREE.BufferAttribute(gp, 3)); gg.setAttribute("color", new THREE.BufferAttribute(gc, 3));
    const gal = new THREE.Points(gg, new THREE.PointsMaterial({ size: 2.2, map: T_DOT, vertexColors: true, ...ADD, sizeAttenuation: false, opacity: 0.8 })); scene.add(gal);
    const core = sprite(T_WARM, 9000, 0xffe8c0, 0.4); core.position.copy(gC); scene.add(core);
    // 星系团
    const galTex = canvasTex(128, 128, (g) => { for (let i = 0; i < 500; i++) { const r = Math.pow(Math.random(), 0.6) * 58, a = (i % 2) * 3.14 + r / 58 * 5 + (Math.random() - 0.5) * 0.4; g.fillStyle = "rgba(255,240,210," + (0.6 - r / 120) + ")"; g.fillRect(64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.55, 1.5, 1.5); } const gr = g.createRadialGradient(64, 64, 0, 64, 64, 16); gr.addColorStop(0, "rgba(255,245,220,1)"); gr.addColorStop(1, "rgba(255,245,220,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    for (let i = 0; i < 160 * Q + 60; i++) { const s = sprite(galTex, 20000 + rnd() * 30000, 0xffffff, 0.45); s.material.rotation = rnd() * 6; const r = 60000 + rnd() * 900000; const a = rnd() * 6.28, b = Math.acos(2 * rnd() - 1); s.position.set(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r * 0.6, Math.sin(b) * Math.sin(a) * r); scene.add(s); }
    // 宇宙泡
    const bubMat = new THREE.ShaderMaterial({ vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
      fragmentShader: "varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(vN,vV)),3.0); gl_FragColor=vec4(vec3(0.75,0.85,1.0)*f*1.2+vec3(0.9,0.75,0.4)*f*f,f*0.9); }", ...ADD, side: THREE.DoubleSide });
    const bubG = new THREE.SphereGeometry(1, 32, 24);
    for (let i = 0; i < 70 * Q + 30; i++) { const m = new THREE.Mesh(bubG, bubMat); const r = i === 0 ? 0 : 3e6 + rnd() * 4e7; const a = rnd() * 6.28, b = Math.acos(2 * rnd() - 1); m.position.set(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r); m.scale.setScalar(i === 0 ? 2.4e6 : 1e6 + rnd() * 5e6); scene.add(m); }
    // 量级字
    const words = ["恒星系", "星团", "星系", "星系群", "星系团", "宇宙结构", "单体宇宙", "多元宇宙", "无限多元宇宙", "无限盒子", "无限次方盒子", "无限阶指数塔", "无限阶无穷", "超越逻辑与数学"];
    const wordSpr = words.map((w, i) => { const t = textTex(w, "900 64px " + SERIF, "#F1DFAE", { glow: "rgba(235,215,162,.7)", blur: 18 }); const s = sprite(t, 1, 0xffffff, 0, THREE.NormalBlending); s.userData = { i, a: t.userData.aspect, ang: rnd() * 6.28 }; scene.add(s); return s; });
    const upd = (p, lt) => {
      planet.material.uniforms.uT.value = lt; planet.rotation.y = lt * 0.2;
      const L = lerp(0.6, 9.3, Math.pow(p, 1.25)), d = Math.pow(10, L);
      const dir = V(0.35, 0.55, 1).normalize();
      cam.position.copy(dir.clone().multiplyScalar(d)); cam.near = d * 0.002; cam.far = d * 60; cam.updateProjectionMatrix();
      cam.lookAt(0, 0, 0); cam.rotateZ(lt * 0.03);
      wordSpr.forEach(s => {
        const i = s.userData.i, wl = lerp(1.5, 9.0, i / (words.length - 1)), k = (L - wl) / 0.55;
        const vis = Math.max(0, 1 - Math.abs(k)); s.material.opacity = vis;
        const r = d * 0.18, a = s.userData.ang; s.position.copy(cam.position).addScaledVector(dir, -d * 0.62).add(V(Math.cos(a) * r, Math.sin(a) * r * 0.6, 0));
        const hgt = d * 0.05 * (1 + (1 - vis) * 0.6); s.scale.set(hgt * s.userData.a, hgt, 1);
      });
    };
    scenes.push({
      d: 7.5, scene, camera: cam, outColor: "#fff8ea", fadeOut: 0.6,
      caps: [[0.06, "诸天万界", "多元宇宙、无限次方盒、无限阶指数塔……"], [0.58, "诸天万界", "一切计量单位与境界，都失去了意义。"]],
      bloom: p => 0.9 + p * 0.8, update: upd
    });
  })();

  /* ═══ 7 时间树 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020203); scene.fog = new THREE.FogExp2(0x020203, 0.014);
    const cam = mkCam(48);
    const segs = [];
    function grow(p, dir, len, depth, order) {
      const q = p.clone().add(dir.clone().multiplyScalar(len)); segs.push([p, q, depth, order]);
      if (depth >= 6 || len < 0.25) return;
      for (let k = 0; k < (depth < 3 ? 2 : 2 + (rnd() < 0.3 ? 1 : 0)); k++) { const ax = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); const nd = dir.clone().applyAxisAngle(ax, 0.42 + rnd() * 0.55); nd.y += 0.15; nd.normalize(); grow(q, nd, len * (0.62 + rnd() * 0.16), depth + 1, order + 1); }
    }
    let p = V(-8, -4, 0), dir = V(1, 0.34, 0).normalize();
    for (let s = 0; s < 36; s++) { const np = p.clone().add(dir.clone().multiplyScalar(1.05)); segs.push([p.clone(), np.clone(), 0, s]); if (s % 2 === 1 && s < 26) grow(np, V(rnd() - 0.5, 0.8, (rnd() - 0.5) * 1.6).normalize(), 2.6 - s * 0.05, 1, s + 1); dir.add(V((rnd() - 0.5) * 0.1, 0, (rnd() - 0.5) * 0.15)).normalize(); p = np; }
    const mo = Math.max(...segs.map(s => s[3]));
    const pos = new Float32Array(segs.length * 6), ord = new Float32Array(segs.length * 2), col = new Float32Array(segs.length * 6);
    segs.forEach((s, i) => { pos.set([s[0].x, s[0].y, s[0].z, s[1].x, s[1].y, s[1].z], i * 6); ord[i * 2] = s[3] / mo; ord[i * 2 + 1] = (s[3] + 1) / mo; const b = s[2] === 0 ? 2.4 : 1.5 - s[2] * 0.15; col.set([b, b * 0.82, b * 0.52, b, b * 0.82, b * 0.52], i * 6); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("ord", new THREE.BufferAttribute(ord, 1)); g.setAttribute("cl", new THREE.BufferAttribute(col, 3));
    const uG = { value: 0 };
    scene.add(new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: { uG },
      vertexShader: "attribute float ord; attribute vec3 cl; varying float vO; varying vec3 vC; void main(){ vO=ord; vC=cl; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "uniform float uG; varying float vO; varying vec3 vC; void main(){ if(vO>uG) discard; float e=smoothstep(uG-0.05,uG,vO); gl_FragColor=vec4(vC*(1.0+e*4.0),1.0); }", ...ADD })));
    const tips = segs.filter(s => s[2] >= 6).map(s => s[1]);
    const tg = new THREE.BufferGeometry().setFromPoints(tips); const to = new Float32Array(tips.length); segs.filter(s => s[2] >= 6).forEach((s, i) => to[i] = (s[3] + 1) / mo); tg.setAttribute("ord", new THREE.BufferAttribute(to, 1));
    scene.add(new THREE.Points(tg, new THREE.ShaderMaterial({ uniforms: { uG, uTex: { value: T_GOLD } },
      vertexShader: "attribute float ord; uniform float uG; varying float vA; void main(){ vA=step(ord,uG); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=vA*26.0/-mv.z*6.0; gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D uTex; varying float vA; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(t.rgb*1.1,t.a*vA); }", ...ADD })));
    const seedS = sprite(T_WHITE, 3, 0xffffff); seedS.position.set(-8, -4, 0); scene.add(seedS);
    scene.add(stars(Math.floor(3000 * Q + 600), 120, 1.5, 0xc9a45b));
    [[0x8a6d33, V(-40, 10, -60)], [0x2d5b74, V(50, 20, -70)]].forEach(([c, p]) => { const s = sprite(T_CLOUD, 90, c, 0.8); s.position.copy(p); scene.add(s); });
    scenes.push({
      d: 7, scene, camera: cam, fadeIn: 0.8,
      caps: [[0.15, "终焉纪", "无限延伸的时间树上，天帝终焉，古今第一人。"]],
      bloom: () => 1.25,
      update(p, lt) {
        uG.value = 0.02 + sm(p / 0.8) * 0.98; seedS.scale.setScalar(2.6 + Math.sin(lt * 2) * 0.4);
        const e = sm(p); cam.position.set(lerp(-14, 10, e), lerp(-2, 13, e), lerp(12, 30, e)); cam.lookAt(lerp(-6, 8, e), lerp(-3, 6, e), 0);
      }
    });
  })();

  /* ═══ 8 归墟 · 黑洞 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
    const cam = mkCam(42);
    scene.add(stars(Math.floor(2500 * Q + 500), 200, 1.3));
    const hole = new THREE.Mesh(new THREE.SphereGeometry(1.6, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 })); scene.add(hole);
    const N = Math.floor(40000 * Q + 6000), g = new THREE.BufferGeometry(), pp = new Float32Array(N * 3), pr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const r = 2.1 + Math.pow(rnd(), 1.8) * 9; pp.set([0, 0, 0], i * 3); pr.set([r, rnd() * 6.283, (rnd() - 0.5) * 0.12 * r], i * 3); }
    g.setAttribute("position", new THREE.BufferAttribute(pp, 3)); g.setAttribute("aR", new THREE.BufferAttribute(pr, 3));
    const uT = { value: 0 };
    const diskMat = new THREE.ShaderMaterial({ uniforms: { uT, uTex: { value: T_DOT } },
      vertexShader: "attribute vec3 aR; uniform float uT; varying vec3 vC; void main(){ float r=aR.x-mod(uT*0.08*(12.0/aR.x),0.0001); float a=aR.y+uT*2.2/pow(r,1.5); vec3 p=vec3(cos(a)*r,aR.z,sin(a)*r); float h=1.0-clamp((r-2.1)/9.0,0.0,1.0); vC=mix(vec3(0.9,0.25,0.08),vec3(1.0,0.85,0.55),h)+vec3(1.0)*pow(h,6.0); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(0.6+h*1.4)*40.0/-mv.z; gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D uTex; varying vec3 vC; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC*t.rgb,t.a*0.16); }", ...ADD });
    const disk = new THREE.Points(g, diskMat); disk.rotation.x = 0.08; scene.add(disk);
    // 透镜弧：一圈竖着的光环（始终面向镜头）
    const ringTex = canvasTex(512, 512, (x) => { const gr = x.createRadialGradient(256, 256, 120, 256, 256, 250); gr.addColorStop(0, "rgba(255,200,120,0)"); gr.addColorStop(0.12, "rgba(255,236,200,1)"); gr.addColorStop(0.3, "rgba(255,170,90,.55)"); gr.addColorStop(1, "rgba(120,40,10,0)"); x.fillStyle = gr; x.fillRect(0, 0, 512, 512); });
    const lens = sprite(ringTex, 7.4, 0xffffff, 0.45); scene.add(lens);
    const photon = sprite(ringTex, 3.9, 0xffffff, 0.7); scene.add(photon);
    // 被卷入的字
    const gly = "剑火雷阵符龙凰风水土金木鼎镜轮命梦灭初源焉道法".split("");
    const glyS = gly.map((c, i) => { const t = textTex(c, "96px " + BRUSH, "#F1DFAE", { glow: "rgba(235,215,162,.8)", blur: 16, pad: 16 }); const s = sprite(t, 1, 0xffffff, 0); s.userData = { r0: 10 + rnd() * 10, a0: rnd() * 6.28, sp: 0.6 + rnd() * 0.6, off: rnd(), asp: t.userData.aspect }; scene.add(s); return s; });
    scenes.push({
      d: 8, scene, camera: cam,
      caps: [[0.08, "归墟", "而造成这一切的幕后真凶，居然是……"], [0.62, "归墟", "何阳自己？"]],
      bloom: p => 1.2 + (p > 0.62 ? 0.8 * Math.max(0, 1 - (p - 0.62) * 4) : 0),
      tint: p => p > 0.62 ? ["#5a0c06", 0.35 * Math.max(0, 1 - (p - 0.62) * 3.5)] : null,
      update(p, lt) {
        uT.value = lt;
        glyS.forEach(s => { const u = s.userData, k = (u.off + lt * 0.07 * u.sp) % 1, r = lerp(u.r0, 1.7, Math.pow(k, 1.4)), a = u.a0 + lt * 1.4 / Math.pow(r, 0.8); s.position.set(Math.cos(a) * r, (1 - k) * 1.5 * Math.sin(u.a0 * 3), Math.sin(a) * r); const sz = 0.5 + (1 - k) * 0.7; s.scale.set(sz * u.asp, sz, 1); s.material.opacity = Math.sin(k * Math.PI) * 0.95; });
        const e = sm(p), a = lerp(0.6, -0.3, e), d = lerp(24, 11, e), h = lerp(9, 1.1, e);
        cam.position.set(Math.sin(a) * d, h, Math.cos(a) * d); cam.lookAt(0, 0, 0);
        cam.rotateZ(lerp(0.05, -0.12, e));
      }
    });
  })();

  /* ═══ 9 书名 ═══ */
  (() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x030304);
    const cam = mkCam(40);
    const tt = textTex(D.book.title, "300px " + BRUSH, "#E9CF8E", { glow: "rgba(201,164,91,.5)", blur: 26, pad: 60 });
    const tMat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: tt }, uK: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: NOISE + "uniform sampler2D uTex; uniform float uK; varying vec2 vUv; void main(){ vec4 t=texture2D(uTex,vUv); float n=fbm(vUv*vec2(9.0,3.0))*0.7+vUv.x*0.35; float th=uK*1.3-0.15; float a=smoothstep(th,th-0.06,n); float edge=smoothstep(0.07,0.0,abs(n-th))*step(0.02,uK)*(1.0-step(1.0,uK)); vec3 c=t.rgb*a+vec3(1.0,0.75,0.35)*edge*t.a*3.0; gl_FragColor=vec4(c,t.a*max(a,edge)); }",
      transparent: true, depthWrite: false });
    const title = textPlane(tt, 3.2, tMat); scene.add(title);
    const sealTex = canvasTex(256, 256, (g) => { g.fillStyle = "#A5342B"; g.fillRect(10, 10, 236, 236); g.strokeStyle = "#F3E3DC"; g.lineWidth = 8; g.strokeRect(28, 28, 200, 200); g.fillStyle = "#F3E3DC"; g.font = "900 84px " + SERIF; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("何", 90, 86); g.fillText("阳", 166, 86); g.fillText("之", 90, 172); g.fillText("印", 166, 172); });
    const seal = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshBasicMaterial({ map: sealTex, transparent: true, opacity: 0 }));
    seal.position.set(title.geometry.parameters.width / 2 - 0.3, -1.0, 0.05); seal.scale.setScalar(0.8); seal.rotation.z = -0.07; scene.add(seal);
    const EN = Math.floor(1400 * Q + 300), eg = new THREE.BufferGeometry(), ep = new Float32Array(EN * 3), eo = new Float32Array(EN);
    for (let i = 0; i < EN; i++) { ep.set([(rnd() - 0.5) * 20, -6, (rnd() - 0.5) * 8], i * 3); eo[i] = rnd(); }
    eg.setAttribute("position", new THREE.BufferAttribute(ep, 3)); eg.setAttribute("off", new THREE.BufferAttribute(eo, 1));
    const uT = { value: 0 };
    scene.add(new THREE.Points(eg, new THREE.ShaderMaterial({ uniforms: { uT, uTex: { value: T_GOLD } },
      vertexShader: "attribute float off; uniform float uT; varying float vA; void main(){ float k=fract(off+uT*0.06); vec3 p=position; p.y+=k*14.0; p.x+=sin(k*8.0+off*20.0)*0.6; vA=sin(k*3.1416)*0.8; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(0.6+off)*40.0/-mv.z; gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D uTex; varying float vA; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(t.rgb,t.a*vA); }", ...ADD })));
    for (let i = 0; i < 8; i++) { const s = sprite(T_CLOUD, 10 + rnd() * 8, 0x2a2a30, 0.8, THREE.NormalBlending); s.position.set((rnd() - 0.5) * 16, (rnd() - 0.5) * 6, -4 - rnd() * 4); scene.add(s); }
    scenes.push({
      d: 7.5, scene, camera: cam, fadeOut: 0.01,
      caps: [[0.55, "设定集", "一卷星源天，一棵时间树，一片混沌海"]],
      bloom: () => 1.0,
      update(p, lt) {
        uT.value = lt; tMat.uniforms.uK.value = sm(p / 0.5) * 1.05;
        const sk = sm((p - 0.52) / 0.12); seal.material.opacity = sk; seal.scale.setScalar(lerp(1.8, 0.8, sk));
        const shake = sk > 0 && sk < 1 ? (1 - sk) * 0.05 : 0;
        cam.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, lerp(9, 7.2, sm(p))); cam.lookAt(0, 0, 0);
      }
    });
  })();

  const total = scenes.reduce((s, x) => s + x.d, 0);
  const engine = {
    scenes, total, composer, bloom, cur: -1,
    at(tt) { let acc = 0; for (let i = 0; i < scenes.length; i++) { if (tt < acc + scenes[i].d) return [i, (tt - acc) / scenes[i].d, tt - acc]; acc += scenes[i].d; } const l = scenes.length - 1; return [l, 1, scenes[l].d]; },
    resize() {
      const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
      scenes.forEach(s => { s.camera.aspect = w / h; if (w < h) s.camera.fov = Math.min(70, s.camera.fov * 1.0 + 0); s.camera.updateProjectionMatrix(); });
    }
  };
  // 竖屏加大视角，让主体完整入画
  if (window.innerWidth < window.innerHeight) scenes.forEach(s => { s.camera.fov = Math.min(72, s.camera.fov * 1.45); });
  return engine;
}
