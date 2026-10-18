/* Pierteia 3D 地球（v23）：星球渲染、地名、地点卡与 2.5D 沙盘入口。
   与平面地图共用 map-data / locations-data / atlas-data / place-ui；URL 由 map-view.js 维护。 */
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createPlanet, uvToDir, ribbon, DISP } from './planet.js?v=25';

const $ = id => document.getElementById(id);
const A = window.ATLAS_DATA, NAT = window.MAP_NATIONS || [], LOC = window.LOCATION_DATA || {};
const { has, clamp, esc } = window.PlaceUI;
const W = A.W, H = A.H;
const stage = $('globeStage'), canvas = $('globeCanvas'), labelHost = $('globeLabels'), card = $('atlasCard');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const TEX = '素材/globe/';
const params = new URLSearchParams(location.search);

/* ---------------- 平面地图同款轮廓处理（国界） ---------------- */
function hash(a, b) { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return (h >>> 0) / 4294967296; }
function unflat(f) { const p = []; for (let i = 0; i < f.length; i += 2) p.push([f[i] / 10, f[i + 1] / 10]); return p; }
function roughen(pts, closed, k, levels) {
  for (let l = 0; l < levels; l++) {
    const out = [], n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n]; out.push(a);
      let lo = a, hi = b; if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) { lo = b; hi = a; }
      const dx = hi[0] - lo[0], dy = hi[1] - lo[1], len = Math.hypot(dx, dy);
      if (len < .6) continue;
      const mx = (lo[0] + hi[0]) / 2, my = (lo[1] + hi[1]) / 2, r = (hash(Math.round(mx * 100), Math.round(my * 100)) - .5) * 2 * k;
      out.push([mx - dy / len * r * len, my + dx / len * r * len]);
    }
    if (!closed) out.push(pts[n - 1]);
    pts = out;
  }
  return pts;
}
function chaikin(pts, closed, it) {
  for (let t = 0; t < it; t++) {
    const out = [], n = pts.length, m = closed ? n : n - 1;
    if (!closed) out.push(pts[0]);
    for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % n]; out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
    if (!closed) out.push(pts[n - 1]);
    pts = out;
  }
  return pts;
}
/* 平面地图按真实宽高比铺在球面上：经度 360°，纬度 ±180·H/W（约 ±56°），两极为海与冰盖 */
const KV = 2 * H / W;
const m2t = v => .5 + KV * (v - .5), t2m = v => (v - .5) / KV + .5;
const mapDir = (u, v) => uvToDir(u, m2t(v));
const toUv = pts => pts.map(([x, y]) => [x / W, m2t(y / H)]);
const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const HGT = bytes(A.height), STA = bytes(A.state);
const gridAt = (arr, u, v) => { if (v < 0 || v > 1) return 0; const i = clamp(Math.floor(v * A.gh), 0, A.gh - 1), j = ((Math.floor(u * A.gw) % A.gw) + A.gw) % A.gw; return arr[i * A.gw + j]; };
const liftAt = (u, v) => Math.max(0, (gridAt(HGT, u, v) / 2.55 - 20) / 80) * .62 * DISP;
const liftTex = (u, v) => liftAt(u, t2m(v));

/* ---------------- 地点条目 ---------------- */
const SPECIAL = { '天神峰': 'peak', '万知城': 'city', '安那其学院': 'academy', '常灵群岛': 'isles' };
const items = NAT.map(n => {
  const art = SPECIAL[n.name] || null, canon = has(LOC, n.name);
  return { name: n.name, id: n.id, u: n.x, v: n.y, art, canon, ghost: !canon && !art, dir: mapDir(n.x, n.y) };
});
const itemByName = new Map(items.map(i => [i.name, i]));
const itemById = new Map(items.map(i => [i.id, i]));
function anchorOf(name) { const seen = new Set(); let n = name; while (n && !seen.has(n)) { seen.add(n); if (itemByName.has(n)) return itemByName.get(n); n = LOC[n]?.parent; } return null; }

/* ---------------- 渲染器 ---------------- */
let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!renderer.capabilities.isWebGL2) throw Error('需要 WebGL 2');
} catch (e) { fail('当前浏览器无法启动 3D 地球', '需要支持 WebGL 2 的浏览器。平面地图可以正常使用。'); throw e; }
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
const maxTex = renderer.capabilities.maxTextureSize;
const hiTex = maxTex >= 8192 && !coarse;
let pixelRatio = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75);
renderer.setPixelRatio(pixelRatio);

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(30, 1, .01, 200);
camera.position.copy(mapDir(.49, .45)).multiplyScalar(innerWidth < 700 ? 4.9 : 3.7);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enablePan: false, enableDamping: true, dampingFactor: .07, minDistance: 1.24, maxDistance: 7, zoomSpeed: .7, rotateSpeed: .5, autoRotateSpeed: .35 });
controls.addEventListener('start', () => { flight = null; poke(); });
controls.addEventListener('change', poke);

const rt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: coarse ? 2 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .22, .5, 1.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let planet = null, borders = null, grid = null, selRibbon = null;
const layers = Object.assign({ clouds: true, borders: false, labels: true, ghosts: false, grid: false, realSun: false, spin: false }, (() => { try { return JSON.parse(localStorage.getItem('pierteia-globe-layers') || '{}'); } catch (e) { return {}; } })());

function fail(title, text) {
  const n = $('globeLoading'); n.hidden = false; n.dataset.state = 'error';
  $('glbLoadTitle').textContent = title; $('glbLoadText').textContent = text;
}

/* ---------------- 加载贴图 ---------------- */
async function loadTextures() {
  const list = [
    ['albedo', `albedo-${hiTex ? '8k' : '4k'}.jpg`, true],
    ['normal', 'normal-4k.jpg'], ['data', 'data-4k.jpg'],
    ['water', `water-${hiTex ? '8k' : '4k'}.png`], ['clouds', 'clouds-4k.jpg']
  ];
  const loader = new T.TextureLoader();
  let done = 0;
  const out = {};
  await Promise.all(list.map(async ([key, file, srgb]) => {
    const t = await loader.loadAsync(TEX + file + '?v=2');
    t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping;
    t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
    out[key] = t;
    done++;
    $('glbLoadBar').style.width = (done / list.length * 100) + '%';
    $('glbLoadText').textContent = ['正在铺开海岸线', '正在抬起山脉', '正在灌注海洋', '正在聚拢云层', '即将完成'][Math.min(4, done)];
  }));
  return out;
}

/* ---------------- 国界与经纬网 ---------------- */
function buildBorders() {
  const lines = A.borders.map(b => toUv(chaikin(roughen(unflat(b.slice(2)), false, .2, 2), false, 2)));
  borders = ribbon(lines, .0016, '#f3dfb0', .5, .0012, liftTex);
  borders.visible = layers.borders;
  scene.add(borders);
  const g = [];
  for (let lat = -60; lat <= 60; lat += 30) { const l = []; for (let lon = -180; lon <= 180; lon += 2) l.push([(lon + 180) / 360, (90 - lat) / 180]); g.push(l); }
  for (let lon = -180; lon < 180; lon += 30) { const l = []; for (let lat = -84; lat <= 84; lat += 2) l.push([(lon + 180) / 360, (90 - lat) / 180]); g.push(l); }
  grid = ribbon(g, .0011, '#cfe2f2', .16, .004);
  grid.visible = layers.grid;
  scene.add(grid);
}
function highlight(it) {
  if (selRibbon) { scene.remove(selRibbon); selRibbon.geometry.dispose(); selRibbon = null; }
  planet.setSelection(it ? it.dir : null, it?.art ? .045 : .07);
  const rings = it && A.regions[String(it.id)];
  if (rings && !it.art) {
    selRibbon = ribbon(rings.map(r => { const p = toUv(chaikin(roughen(unflat(r), true, .2, 2), true, 2)); p.push(p[0]); return p; }), .0032, '#ffd27a', .9, .0016, liftTex);
    selRibbon.material.blending = T.AdditiveBlending;
    scene.add(selRibbon);
  }
}

/* ---------------- 地名 ---------------- */
const labels = items.map(it => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'atl-label glb ' + (it.art ? 'special art-' + it.art : it.canon ? 'nation' : 'ghost');
  el.innerHTML = `<span class="t">${esc(it.name)}</span>` + (it.art ? `<span class="k">${{ peak: '高原孤峰', city: '中立城邦', academy: '海峡小岛', isles: '群岛 · 裂隙' }[it.art]}</span>` : '');
  el.hidden = true;
  el.addEventListener('click', e => { e.stopPropagation(); select(it.name, { emit: true, fly: true, forced: it }); });
  labelHost.appendChild(el);
  return { it, el, w: 0, h: 0 };
});
function measureLabels() { for (const l of labels) { const hid = l.el.hidden; l.el.hidden = false; const r = l.el.getBoundingClientRect(); l.w = r.width; l.h = r.height; l.el.hidden = hid; } }
const tmpV = new T.Vector3(), camDir = new T.Vector3();
function placeLabels() {
  const show = layers.labels && !dio;
  const vw = stage.clientWidth, vh = stage.clientHeight;
  camDir.copy(camera.position).normalize();
  const dist = camera.position.length();
  const placed = [];
  const order = [...labels].sort((a, b) => pri(b) - pri(a));
  for (const l of order) {
    const it = l.it;
    if (!show || (it.ghost && !layers.ghosts && it !== selected?.item)) { l.el.hidden = true; continue; }
    const facing = it.dir.dot(camDir);
    tmpV.copy(it.dir).multiplyScalar(1.004).project(camera);
    const x = (tmpV.x * .5 + .5) * vw, y = (-tmpV.y * .5 + .5) * vh;
    const limb = 1 / dist + .06;                      // 越靠近边缘越先隐藏
    if (facing < limb) { l.el.hidden = true; continue; }
    const box = { x: x - l.w / 2, y: y - l.h / 2, w: l.w, h: l.h };
    const hit = placed.some(p => box.x < p.x + p.w + 4 && box.x + box.w + 4 > p.x && box.y < p.y + p.h && box.y + box.h > p.y);
    if ((hit && it !== selected?.item) || x < 0 || x > vw || y < 0 || y > vh) { l.el.hidden = true; continue; }
    placed.push(box);
    l.el.hidden = false;
    l.el.style.transform = `translate(${Math.round(box.x)}px,${Math.round(box.y)}px)`;
    l.el.style.opacity = clamp((facing - limb) * 6, 0, 1).toFixed(2);
    l.el.classList.toggle('active', it === selected?.item);
  }
}
const pri = l => (l.it === selected?.item ? 100 : 0) + (l.it.art ? 50 : l.it.canon ? 20 : 0);

/* ---------------- 选择、卡片、飞行 ---------------- */
let selected = null, flight = null;
function select(name, { emit = false, fly = true, forced = null } = {}) {
  const it = forced || anchorOf(name);
  if (!it && !has(LOC, name)) return false;
  selected = { name, item: it };
  const exact = it && it.name === name;
  window.PlaceUI.fillCard(name, {
    color: it?.art ? { peak: '#e0b860', city: '#9fbedf', academy: '#e7a99a', isles: '#b39ae6' }[it.art] : '#cdb991',
    coord: exact ? window.PlaceUI.coordText(it.u, it.v) : it ? '坐标未定 · 沿「' + it.name + '」定位' : ''
  });
  $('acDio').hidden = !has(LOC, name);
  card.hidden = false;
  requestAnimationFrame(() => card.classList.add('open'));
  stage.classList.add('card-open');
  highlight(it);
  if (it && fly) flyTo(it.dir, it.art ? 2.2 : 2.7);
  if (emit) window.dispatchEvent(new CustomEvent(has(LOC, name) ? 'globe:select' : 'globe:clear', { detail: { name } }));
  $('mapAnnouncement').textContent = '已选择：' + name;
  poke();
  return true;
}
function clear(emit) {
  if (!selected && card.hidden) return;
  selected = null; highlight(null);
  card.classList.remove('open'); stage.classList.remove('card-open');
  setTimeout(() => { if (!card.classList.contains('open')) card.hidden = true; }, 260);
  if (emit) window.dispatchEvent(new CustomEvent('globe:clear'));
  poke();
}
function flyTo(dir, dist, dur = 1300) {
  // 卡片在右侧时把目标略向左让开
  const narrow = stage.clientWidth < 700;
  const to = dir.clone().normalize();
  if (!card.hidden && !narrow) { const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), to).normalize(); to.addScaledVector(right, .16 * (dist - 1)).normalize(); }
  if (narrow && !card.hidden) to.add(new T.Vector3(0, -.12, 0)).normalize();
  const target = to.multiplyScalar(dist);
  if (reduced) { camera.position.copy(target); controls.update(); return; }
  flight = { from: camera.position.clone(), to: target, t0: performance.now(), dur };
  poke();
}
card.addEventListener('click', e => { const go = e.target.closest('[data-go]'); if (go) select(go.dataset.go, { emit: true }); });
$('acClose').onclick = () => clear(true);
$('acGrip').onclick = () => card.classList.toggle('full');
$('acCopy').onclick = window.PlaceUI.copyLink;
$('acFlat').onclick = () => window.__mapView?.setMode('flat');
$('acDio').onclick = () => selected && enterDiorama(selected.name);

/* ---------------- 搜索 / 图层 / 缩放 ---------------- */
window.PlaceUI.search($('atlasSearch'), $('atlasSuggest'), [
  ...window.PlaceUI.baseEntries(),
  ...items.filter(i => i.ghost).map(i => ({ name: i.name, label: i.name, kind: '未设定地区', canon: false }))
], e => { const it = itemByName.get(e.name); if (dio) exitDiorama(); if (!e.canon && it) { if (!layers.ghosts) setLayer('ghosts', true); select(it.name, { emit: true, forced: it }); } else select(e.name, { emit: true }); });
const layerBtn = $('atlasLayersBtn'), layerPop = $('atlasLayers');
layerBtn.onclick = e => { e.stopPropagation(); const open = layerPop.hidden; layerPop.hidden = !open; layerBtn.setAttribute('aria-expanded', String(open)); };
document.addEventListener('pointerdown', e => { if (!layerPop.hidden && !e.target.closest('#atlasLayers, #atlasLayersBtn')) { layerPop.hidden = true; layerBtn.setAttribute('aria-expanded', 'false'); } });
function setLayer(k, v) {
  layers[k] = v;
  const inp = layerPop.querySelector(`[data-layer="${k}"]`); if (inp) inp.checked = v;
  try { localStorage.setItem('pierteia-globe-layers', JSON.stringify(layers)); } catch (e) { /* 忽略 */ }
  applyLayers(); poke();
}
function applyLayers() {
  if (!planet) return;
  planet.setClouds(layers.clouds);
  borders.visible = layers.borders; grid.visible = layers.grid;
  controls.autoRotate = layers.spin && !reduced && !dio;
  controls.enabled = !dio;
}
layerPop.querySelectorAll('[data-layer]').forEach(inp => { inp.checked = !!layers[inp.dataset.layer]; inp.onchange = () => setLayer(inp.dataset.layer, inp.checked); });
function zoomBy(f) { flight = null; const d = clamp(camera.position.length() * f, controls.minDistance, controls.maxDistance); camera.position.setLength(d); controls.update(); poke(); }
$('zin').onclick = () => dio ? dio.zoom(.8) : zoomBy(.8);
$('zout').onclick = () => dio ? dio.zoom(1.25) : zoomBy(1.25);
$('zfit').onclick = () => { if (dio) dio.home(); else flyTo(mapDir(.49, .45), innerWidth < 700 ? 4.9 : 3.7); };

/* ---------------- 指针：点选国家 ---------------- */
const ray = new T.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || dio) { down = null; return; }
  down = null;
  const uv = pickUv(e);
  if (!uv) { clear(true); return; }
  const st = gridAt(STA, uv[0], uv[1]);
  const it = itemById.get(st);
  if (it && (it.canon || layers.ghosts)) select(it.name, { emit: true, fly: false, forced: it }); else clear(true);
});
canvas.addEventListener('pointermove', e => {
  if (dio || e.pointerType !== 'mouse') return;
  const uv = pickUv(e);
  $('atlasCoord').textContent = uv ? window.PlaceUI.coordText(uv[0], uv[1]) : '';
});
function pickUv(e) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
  const o = ray.ray.origin, d = ray.ray.direction, b = o.dot(d), c = o.lengthSq() - 1, h = b * b - c;
  if (h < 0) return null;
  const p = o.clone().addScaledVector(d, -b - Math.sqrt(h)).normalize();
  return [Math.atan2(p.x, p.z) / (Math.PI * 2) + .5, t2m(.5 - Math.asin(p.y) / Math.PI)];
}
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select,[contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { if (dio) exitDiorama(); else clear(true); }
  else if (e.key === '/') { e.preventDefault(); $('atlasSearch').focus(); }
  else if (e.key === '+' || e.key === '=') $('zin').click();
  else if (e.key === '-' || e.key === '_') $('zout').click();
  else return;
  e.preventDefault();
});

/* ---------------- 太阳 ---------------- */
const UP = new T.Vector3(0, 1, 0), sunDir = new T.Vector3();
function updateSun(t) {
  if (layers.realSun) {
    // 固定在世界中缓慢移动（一个“日”约 6 分钟），可以转到夜面看灯火
    const a = t * Math.PI * 2 / 360;
    sunDir.set(Math.sin(a), .22, Math.cos(a)).normalize();
  } else {
    // 展示光照：从观察方向的左上方照来，留出一道晨昏线
    const c = camDir.copy(camera.position).normalize();
    const right = new T.Vector3().crossVectors(UP, c).normalize();
    const up = new T.Vector3().crossVectors(c, right);
    sunDir.copy(c).multiplyScalar(.70).addScaledVector(right, -.58).addScaledVector(up, .42).normalize();
  }
  planet.setSun(sunDir);
}

/* ---------------- 主循环（空闲时降频） ---------------- */
let lastInput = performance.now(), raf = 0, lastFrame = 0, prevDrawn = false;
// 帧率保护：手机多半卡在 GPU 上，JS 耗时看不出来，所以按相邻两次实际绘制的间隔算
let ivSum = 0, ivN = 0, cool = 0;
function poke() { lastInput = performance.now(); if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }
function loop(now) {
  raf = 0;
  if (!planet) return;
  const idle = now - lastInput > 2500 && !flight && !controls.autoRotate;
  // 沙盘里有雨雪水波，空闲时仍保持约 30 帧；星球空闲时降到约 11 帧
  const gap = dio ? (reduced ? 1e9 : dio.animating() ? 33 : 90) : (reduced ? 1e9 : 90);
  if (idle && now - lastFrame < gap) { raf = requestAnimationFrame(loop); prevDrawn = false; return; }
  const iv = now - lastFrame;
  const dt = Math.min(.1, iv / 1000 || .016);
  lastFrame = now;
  if (dio) { dio.frame(now / 1000, dt); }
  else frame(now);
  // 只统计连续绘制的帧；切后台回来的长间隔不算
  if (prevDrawn && !idle && iv < 250 && --cool < 0) {
    ivSum += iv; ivN++;
    if (ivN >= 45) {
      if (ivSum / ivN > 31) degrade();
      ivSum = ivN = 0;
    }
  }
  prevDrawn = true;
  if (!document.hidden) raf = requestAnimationFrame(loop);
}
function degrade() {
  // 沙盘先逐档降效果，星球直接降分辨率；降完留一段时间让帧率稳下来再判断
  if (dio && dio.degrade()) { cool = 60; return; }
  if (pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - .25); renderer.setPixelRatio(pixelRatio); resize(); cool = 60; }
}
function frame(now) {
  if (flight) {
    let k = Math.min(1, (now - flight.t0) / flight.dur); k = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const a = flight.from, b = flight.to, la = a.length(), lb = b.length();
    camera.position.copy(a).normalize().lerp(b.clone().normalize(), k).normalize().multiplyScalar(la + (lb - la) * k);
    if (k >= 1) flight = null;
  }
  const d = camera.position.length();
  controls.rotateSpeed = .18 + .4 * clamp((d - 1.2) / 3, 0, 1);
  controls.update();
  updateSun(now / 1000);
  planet.update(reduced ? 0 : now / 1000);
  placeLabels();
  composer.render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) poke(); });

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  composer.setPixelRatio(pixelRatio); composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < 700 ? 38 : 30;
  camera.updateProjectionMatrix();
  dio?.resize(w, h);
  measureLabels();
  poke();
}
new ResizeObserver(resize).observe(stage);

/* ---------------- 2.5D 沙盘 ---------------- */
let dio = null, dioLoading = false;
async function enterDiorama(name) {
  if (dioLoading || !has(LOC, name)) return;
  dioLoading = true;
  const it = anchorOf(name);
  stage.classList.add('dio-enter');
  if (it && !reduced) { flyTo(it.dir, 1.32, 900); await new Promise(r => setTimeout(r, 820)); }
  { const img = LOC[name]?.image, veil = $('dioVeil');
    veil.classList.toggle('has-img', !!img); veil.style.setProperty('--veil-img', img ? 'url("' + new URL(img, location.href).href + '")' : 'none'); }
  $('dioVeil').classList.add('on');
  $('dioVeilText').textContent = '正在搭建「' + name + '」沙盘';
  try {
    const mod = await import('./diorama/engine.js?v=25');
    await new Promise(r => setTimeout(r, 30));
    const next = await mod.createDiorama(renderer, name, { width: stage.clientWidth, height: stage.clientHeight, pixelRatio, reduced, coarse, anchor: it ? { u: it.u, v: it.v } : null });
    dio = next; ivSum = ivN = 0; cool = 90;
    document.body.classList.add('in-dio');
    stage.classList.add('dio');
    $('dioHud').hidden = false;
    $('dioTitle').textContent = name;
    $('dioSub').textContent = dio.info.label;
    $('dioNote').textContent = dio.info.note;
    $('dioWeather').checked = true;
    $('dioViews').innerHTML = dio.views.map((v, i) => `<button type="button" data-view="${i}" aria-pressed="${i === 0}">${esc(v.label)}</button>`).join('');
    if (stage.clientWidth < 700) { card.classList.remove('open', 'full'); stage.classList.remove('card-open'); card.hidden = true; }
    applyLayers();
    window.dispatchEvent(new CustomEvent('globe:scene', { detail: { name, on: true } }));
  } catch (err) {
    console.error(err);
    window.PlaceUI.toast('沙盘没能载入：' + (err.message || err));
  } finally {
    dioLoading = false;
    stage.classList.remove('dio-enter');
    setTimeout(() => $('dioVeil').classList.remove('on'), 60);
    poke();
  }
}
function exitDiorama() {
  if (!dio) return;
  const name = dio.info.name;
  dio.dispose(); dio = null; ivSum = ivN = 0; cool = 90;
  document.body.classList.remove('in-dio');
  stage.classList.remove('dio');
  $('dioHud').hidden = true;
  applyLayers();
  const it = anchorOf(name);
  if (it) { camera.position.copy(it.dir).multiplyScalar(1.4); flyTo(it.dir, 2.6, 900); }
  window.dispatchEvent(new CustomEvent('globe:scene', { detail: { name, on: false } }));
  if (selected && card.hidden) select(selected.name, { fly: false });
  poke();
}
$('dioBack').onclick = exitDiorama;
$('dioInfo').onclick = () => { if (card.hidden && selected) select(selected.name, { fly: false }); else if (!card.hidden) { card.classList.remove('open'); stage.classList.remove('card-open'); setTimeout(() => { card.hidden = true; }, 240); } };
$('dioViews').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (!b || !dio) return; dio.view(+b.dataset.view); $('dioViews').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); poke(); });
$('dioWeather').onchange = e => { dio?.setWeather(e.target.checked); poke(); };
$('dioOrbit').onchange = e => { dio?.setOrbit(e.target.checked); poke(); };
canvas.addEventListener('pointerdown', () => { if (dio) poke(); });
canvas.addEventListener('wheel', () => poke(), { passive: true });

/* ---------------- 启动 ---------------- */
async function boot() {
  resize();
  const tex = await loadTextures();
  planet = createPlanet(tex, { segments: coarse ? 512 : 768 });
  scene.add(planet.group);
  buildBorders();
  applyLayers();
  measureLabels();
  (document.fonts?.ready || Promise.resolve()).then(() => { measureLabels(); poke(); });
  const start = params.get('place');
  const name = start && (has(LOC, start) ? start : items.find(i => String(i.id) === start)?.name);
  if (name) {
    const it = anchorOf(name);
    if (it) camera.position.copy(it.dir).multiplyScalar(2.9);
    select(name, { fly: true });
    if (params.get('scene') === '1' && has(LOC, name)) enterDiorama(name);
  }
  frame(performance.now());
  $('globeLoading').classList.add('gone');
  setTimeout(() => { $('globeLoading').hidden = true; }, 600);
  poke();
}
window.__globe = {
  select: (name, fly = true) => { if (dio) exitDiorama(); return select(name, { fly }); },
  clear: () => { if (dio) exitDiorama(); clear(false); },
  enter: name => enterDiorama(name),
  exit: exitDiorama,
  stats: () => ({ ready: !!planet, hiTex, pixelRatio, selected: selected?.name || null, diorama: dio ? dio.stats() : null, labels: labels.filter(l => !l.el.hidden).length, camera: camera.position.toArray().map(v => +v.toFixed(3)) }),
  view: (u, v, d) => { camera.position.copy(mapDir(u, v)).multiplyScalar(d); controls.update(); poke(); },
  sun: on => setLayer('realSun', !!on),
  degrade,
  renderer
};
boot().catch(err => { console.error(err); fail('3D 地球没能载入', '贴图或图形环境出现问题（' + (err.message || err) + '）。可以刷新重试，或先使用平面地图。'); });
