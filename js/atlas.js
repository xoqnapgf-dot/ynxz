/* Pierteia 平面地图（v22 起）：不再使用底图图片，全部由 atlas-data.js 的数据在浏览器里绘制。
   层次：WebGL 地形着色（高程 / 群系 / 温度栅格 + 程序化细节）→ Canvas 矢量（海岸、政区、河流、国界、符号）
   → 动效层（时空裂缝、常灵群岛的光点）→ DOM 地名（可点击）。对外接口 window.__flatMap 与 map-view.js 对接。 */
(() => {
  'use strict';
  const A = window.ATLAS_DATA, NAT = window.MAP_NATIONS || [], LOC = window.LOCATION_DATA || {}, ALIAS = window.LOCATION_ALIAS || {};
  if (!A) return;
  const W = A.W, H = A.H, KM = A.kmPerUnit, GW = A.gw, GH = A.gh, STEP = A.step;
  const $ = id => document.getElementById(id);
  const stage = $('mapStage'), cv = $('atlasCanvas'), fx = $('atlasFx'), labelHost = $('atlasLabels');
  const ctx = cv.getContext('2d'), fctx = fx.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------------- 数据解码 ---------------- */
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const HGT = bytes(A.height), BIO = bytes(A.biome), STA = bytes(A.state), TMP = bytes(A.temp);
  const gridAt = (arr, x, y) => { const i = clamp(Math.floor(y / STEP), 0, GH - 1), j = ((Math.floor(x / STEP) % GW) + GW) % GW; return arr[i * GW + j]; };
  function heightAt(x, y) { // 双线性，0–100
    const gx = x / STEP - .5, gy = clamp(y / STEP - .5, 0, GH - 1.001), i = Math.floor(gy), j = Math.floor(gx), fx_ = gx - j, fy = gy - i;
    const at = (ii, jj) => HGT[clamp(ii, 0, GH - 1) * GW + ((jj % GW) + GW) % GW];
    return ((at(i, j) * (1 - fx_) + at(i, j + 1) * fx_) * (1 - fy) + (at(i + 1, j) * (1 - fx_) + at(i + 1, j + 1) * fx_) * fy) / 2.55;
  }

  /* 确定性哈希：同一条边在海岸环与政区环里得到同样的扰动，保证边线重合 */
  function hash(a, b) { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return (h >>> 0) / 4294967296; }
  function unflat(f) { const p = []; for (let i = 0; i < f.length; i += 2) p.push([f[i] / 10, f[i + 1] / 10]); return p; }
  function roughen(pts, closed, k, levels) {
    for (let l = 0; l < levels; l++) {
      const out = [], n = pts.length, m = closed ? n : n - 1;
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        out.push(a);
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
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
      }
      if (!closed) out.push(pts[n - 1]);
      pts = out;
    }
    return pts;
  }
  const shape = (f, closed) => chaikin(roughen(unflat(f), closed, .2, 2), closed, 2);
  function addRing(path, pts) { path.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); path.closePath(); }
  function addLine(path, pts) { path.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); }
  function ringArea(pts) { let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); }

  const coastRings = A.coast.map(r => shape(r, true));
  const isletRings = A.islets.map(r => chaikin(unflat(r), true, 3));
  const lakeRings = A.lakes.map(r => shape(r, true));
  const landPath = new Path2D(), coastPath = new Path2D(), lakePath = new Path2D();
  [...coastRings, ...isletRings].forEach(r => { addRing(landPath, r); addRing(coastPath, r); });
  lakeRings.forEach(r => { addRing(landPath, r); addRing(lakePath, r); });
  const waterPath = new Path2D(); waterPath.rect(-2, -2, W + 4, H + 4); waterPath.addPath(landPath);

  /* ---------------- 地点、国家与政区 ---------------- */
  const canon = n => has(LOC, n);
  const natById = new Map(NAT.map(n => [n.id, n]));
  const natByName = new Map(NAT.map(n => [n.name, n]));
  const regions = new Map();
  for (const id in A.regions) {
    const rings = A.regions[id].map(r => shape(r, true)), p = new Path2D();
    rings.forEach(r => addRing(p, r));
    regions.set(+id, { path: p, area: rings.reduce((s, r) => s + ringArea(r), 0) });
  }
  const PASTEL = ['#e7a99a', '#9fbedf', '#e3c77f', '#a9cf98', '#c8a9de', '#efb59d', '#8fcbc2', '#e3aac6', '#c5cf86', '#b2aee6', '#ebc28f', '#a6cbd9'];
  const stateColor = new Map();
  (() => { // 只给已设定的国家着色；相邻国家颜色不同
    const ids = NAT.filter(n => canon(n.name) && regions.has(n.id)).map(n => n.id).sort((a, b) => regions.get(b).area - regions.get(a).area);
    const count = new Map();
    for (const id of ids) {
      const used = new Set((A.neighbors[id] || []).map(n => stateColor.get(n)).filter(Boolean));
      const pick = PASTEL.filter(c => !used.has(c)).sort((a, b) => (count.get(a) || 0) - (count.get(b) || 0))[0] || PASTEL[id % PASTEL.length];
      stateColor.set(id, pick); count.set(pick, (count.get(pick) || 0) + 1);
    }
  })();
  const borderCanon = new Path2D(), borderGhost = new Path2D(), borderAll = new Path2D();
  for (const b of A.borders) {
    const pts = chaikin(roughen(unflat(b.slice(2)), false, .2, 2), false, 2);
    const ca = canon(natById.get(b[0])?.name), cb = canon(natById.get(b[1])?.name);
    addLine(ca || cb ? borderCanon : borderGhost, pts); addLine(borderAll, pts);
  }
  const riverBuckets = [0, 1, 2, 3].map(() => new Path2D()), riverMin = [0, 0, 0, 0];
  for (const r of A.rivers) {
    const pts = chaikin(roughen(unflat(r.slice(3)), false, .16, 2), false, 2), q = r[2];
    const b = q > 900 ? 3 : q > 350 ? 2 : q > 120 ? 1 : 0;
    addLine(riverBuckets[b], pts);
  }
  const routePaths = {};
  for (const g in A.routes) { const p = new Path2D(); A.routes[g].forEach(r => addLine(p, chaikin(unflat(r), false, 2))); routePaths[g] = p; }

  /* 时空裂缝：沿用原地图的主裂隙与分枝走向 */
  const RIFT = new Path2D('M1470 405 C1466 420 1460 428 1465 438 L1473 446 C1481 456 1467 465 1462 476 L1457 487 C1452 499 1468 506 1466 518 C1464 529 1457 532 1461 542 L1471 552 C1478 562 1463 570 1465 579 C1466 588 1477 591 1481 600 C1487 612 1467 617 1468 628 L1475 638 C1481 649 1460 656 1463 667 L1472 679 C1479 689 1466 697 1468 706 L1475 718 C1479 727 1465 734 1464 742');
  const RIFT_BR = new Path2D('M1461 554 C1454 549 1449 542 1440 541 L1432 533 M1477 594 C1486 599 1492 607 1496 617 L1507 625 M1468 610 C1459 615 1453 623 1444 630');
  const RIFT_TH = new Path2D('M1464 554 L1470 562 M1469 582 L1475 590 M1469 610 L1473 617');

  /* ---------------- 地图条目（国家、特殊地点） ---------------- */
  const SPECIAL_ART = { '天神峰': 'peak', '万知城': 'city', '安那其学院': 'academy', '常灵群岛': 'isles' };
  const items = NAT.map(n => {
    const art = SPECIAL_ART[n.name] || null, isCanon = canon(n.name);
    const area = regions.get(n.id)?.area || 0;
    return { n, name: n.name, x: n.x * W, y: n.y * H, art, canon: isCanon, ghost: !isCanon && !art, state: regions.has(n.id) && !art ? n.id : (n.name === '万知城' ? n.id : null), area,
      size: art ? 13 : clamp(10.5 + Math.sqrt(area) / 16, 11.5, 17.5) };
  });
  const itemByName = new Map(items.map(i => [i.name, i]));
  const itemByState = new Map(items.filter(i => i.state != null).map(i => [i.state, i]));

  /* ---------------- 视图 ---------------- */
  let vw = 0, vh = 0, dpr = 1, s = 1, cx = W / 2, cy = H / 2, minS = .3, maxS = 10;
  const layers = { politics: true, borders: true, rivers: true, routes: true, relief: true, grid: true, ghosts: false, labels: true };
  try { Object.assign(layers, JSON.parse(localStorage.getItem('pierteia-atlas-layers') || '{}')); } catch (e) { /* 无存储时用默认 */ }
  let selected = null, hoverState = null, dirty = true, flight = null;
  const zf = () => clamp(Math.pow(s / .9, .42), .62, 2.1);

  function resize() {
    perf.resizes++;
    const r = stage.getBoundingClientRect();
    vw = Math.max(1, Math.round(r.width)); vh = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [cv, fx]) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); c.style.width = vw + 'px'; c.style.height = vh + 'px'; }
    minS = Math.max(vw / W, vh / H * .42);
    s = clamp(s, minS, maxS); clampView(); dirty = true;
  }
  function clampView() {
    cx = ((cx % W) + W) % W;
    const half = vh / 2 / s;
    cy = H * s >= vh ? clamp(cy, half, H - half) : H / 2;
  }
  const toScreen = (x, y) => [(x - cx) * s + vw / 2, (y - cy) * s + vh / 2];
  const toMap = (px, py) => [((((px - vw / 2) / s + cx) % W) + W) % W, (py - vh / 2) / s + cy];
  function copies() { // 视口里需要画的世界副本（东西向环绕）
    const left = cx - vw / 2 / s, right = cx + vw / 2 / s, out = [];
    for (let k = Math.floor(left / W); k <= Math.floor(right / W); k++) out.push(k);
    return out;
  }
  const setMap = (c, k) => c.setTransform(s * dpr, 0, 0, s * dpr, ((k * W - cx) * s + vw / 2) * dpr, (-cy * s + vh / 2) * dpr);
  const setScreen = c => c.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* ---------------- 海岸距离场 ----------------
     把矢量海岸栅格化（1 单位 / 像素），做精确欧氏距离变换，得到「到海岸线的有符号距离」（陆正海负）。
     着色器用它一次画出海陆分界、海岸水纹与岸边晕染，不必每帧裁剪复杂路径。 */
  function buildSDF() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#000'; x.fill(landPath, 'evenodd');
    const px = x.getImageData(0, 0, W, H).data, N = W * H, INF = 1e12;
    const fin = new Float64Array(N), fout = new Float64Array(N), cov = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = px[i * 4 + 3] / 255; cov[i] = a; const land = a >= .5; fout[i] = land ? 0 : INF; fin[i] = land ? INF : 0; }
    const n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    function edt1(len) {
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (sx <= z[k]) { k--; sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = sx; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
    }
    function edt(g) {
      for (let xx = 0; xx < W; xx++) { for (let y = 0; y < H; y++) f[y] = g[y * W + xx]; edt1(H); for (let y = 0; y < H; y++) g[y * W + xx] = d[y]; }
      for (let y = 0; y < H; y++) { const o = y * W; for (let xx = 0; xx < W; xx++) f[xx] = g[o + xx]; edt1(W); for (let xx = 0; xx < W; xx++) g[o + xx] = d[xx]; }
    }
    edt(fin); edt(fout);
    const out = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const a = cov[i];
      let sd = a > 0 && a < 1 ? a - .5 : a >= .5 ? Math.sqrt(fin[i]) - .5 : .5 - Math.sqrt(fout[i]);
      const e = Math.min(Math.sqrt(Math.abs(sd)) * 16, 127);
      out[i] = 128 + (sd < 0 ? -Math.round(e) : Math.round(e));
    }
    return out;
  }

  /* ---------------- WebGL 地形 ---------------- */
  const BIOME_RGB = [[0, 0, 0], [236, 220, 168], [218, 213, 178], [228, 219, 162], [214, 221, 166], [196, 214, 158], [188, 209, 158], [172, 203, 150], [172, 201, 160], [181, 199, 168], [214, 215, 196], [244, 245, 241], [186, 208, 180]];
  const gl = (() => {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl', { antialias: false, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!g) return null;
    g.getExtension('OES_standard_derivatives');
    const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const fs = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D uH,uB,uT,uP,uS;uniform vec2 uG,uW,uRes;uniform vec3 uV;uniform float uDpr,uOct,uRing;
vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy)*2.-1.;}
float gn(vec2 p,float per){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
 vec2 i1=mod(i,per),i2=mod(i+1.,per);
 return mix(mix(dot(h22(i1),f),dot(h22(vec2(i2.x,i1.y)),f-vec2(1,0)),u.x),mix(dot(h22(vec2(i1.x,i2.y)),f-vec2(0,1)),dot(h22(i2),f-vec2(1,1)),u.x),u.y);}
float fbmN(vec2 p,float f0,float n){float s=0.,a=.5,f=f0;for(int i=0;i<7;i++){if(float(i)>=n)break;s+=a*gn(p*f,uW.x*f);f*=2.;a*=.5;}return s;}
float fbm(vec2 p,float f0){return fbmN(p,f0,uOct);}
float ridge(vec2 p,float f0){float s=0.,a=.5,f=f0,w=1.;for(int i=0;i<7;i++){if(float(i)>=uOct)break;float n=1.-abs(gn(p*f,uW.x*f));n*=n;s+=a*n*w;w=clamp(n*1.6,0.,1.);f*=2.;a*=.5;}return s;}
vec4 cub(float v){vec4 n=vec4(1.,2.,3.,4.)-v;vec4 s=n*n*n;float x=s.x,y=s.y-4.*s.x,z=s.z-4.*s.y+6.*s.x;return vec4(x,y,z,6.-x-y-z)/6.;}
float bic(sampler2D t,vec2 uv){uv=uv*uG-.5;vec2 f=fract(uv);uv-=f;vec4 xc=cub(f.x),yc=cub(f.y);vec4 c=uv.xxyy+vec2(-.5,1.5).xyxy;vec4 s=vec4(xc.xz+xc.yw,yc.xz+yc.yw);vec4 o=(c+vec4(xc.yw,yc.yw)/s)/uG.xxyy;
 o.xy=fract(o.xy);o.zw=clamp(o.zw,.5/uG.y,1.-.5/uG.y);
 float a=texture2D(t,o.xz).r,b=texture2D(t,o.yz).r,cc=texture2D(t,o.xw).r,d=texture2D(t,o.yw).r;float sx=s.x/(s.x+s.y),sy=s.z/(s.z+s.w);return mix(mix(d,cc,sx),mix(b,a,sx),sy);}
float baseH(vec2 p){return bic(uH,vec2(p.x/uW.x,clamp(p.y/uW.y,0.,1.)))*100.;}
float detH(vec2 p,float b){float m=smoothstep(30.,64.,b),l=smoothstep(19.5,24.,b);return b+l*(m*15.*ridge(p,.05)+(1.-m)*2.4*fbm(p,.11));}
float sdf(vec2 p){float v=texture2D(uS,vec2(p.x/uW.x,clamp(p.y/uW.y,0.,1.))).r*255.-128.;return sign(v)*(v/16.)*(v/16.);}
vec3 pal(float i){return texture2D(uP,vec2((i+.5)/16.,.5)).rgb;}
float bio(vec2 g){g.x=mod(g.x,uG.x);g.y=clamp(g.y,0.,uG.y-1.);return texture2D(uB,(g+.5)/uG).r*255.;}
void main(){
 vec2 css=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 vec2 p=(css-uRes*.5)/uV.z+uV.xy;p.x=mod(p.x,uW.x);
 float sd=sdf(p),b=baseH(p),px=1./(uV.z*uDpr);
 float h0=b;if(sd>-1.5)h0=detH(p,b);
 vec3 n=normalize(vec3(-dFdx(h0)/px*.22,dFdy(h0)/px*.22,1.));
 float dep=clamp((20.5-b)/18.,0.,1.),cl=dep*5.,cw=fwidth(cl);
 float tc=texture2D(uT,vec2(p.x/uW.x,clamp(p.y/uW.y,0.,1.))).r*255.-40.;
 float grain=gn(css*.9+floor(uV.xy*uV.z*.9),4096.)*.5+gn(p*.9,uW.x*.9)*.5;
 float stain=smoothstep(.15,.7,fbmN(p,.006,2.));
 float aa=.75/uV.z,lk=smoothstep(-aa,aa,sd);
 vec3 c=vec3(0.),cL=vec3(0.),cW=vec3(0.);
 if(lk>0.){
  vec3 L=normalize(vec3(-.62,-.78,.95));float sh=dot(n,L)-L.z;
  vec2 q=p+vec2(fbmN(p,.02,2.),fbmN(p+31.,.02,2.))*9.;vec2 g=q/${STEP.toFixed(1)}-.5,i0=floor(g),f=smoothstep(0.,1.,fract(g));
  cL=mix(mix(pal(bio(i0)),pal(bio(i0+vec2(1,0))),f.x),mix(pal(bio(i0+vec2(0,1))),pal(bio(i0+vec2(1,1))),f.x),f.y);
  float hd=h0;
  cL=mix(cL,vec3(.93,.87,.70),(1.-smoothstep(.3,2.6,sd))*.5);
  cL=mix(cL,vec3(.86,.79,.63),smoothstep(36.,56.,hd)*.7);
  cL=mix(cL,vec3(.80,.76,.71),smoothstep(56.,72.,hd)*.75);
  float snow=max(smoothstep(73.,82.,hd+5.*gn(p,uW.x*.3)),smoothstep(-5.,-12.,tc)*smoothstep(.5,3.,sd));
  cL=mix(cL,vec3(.975,.972,.962),snow);
  cL*=1.+sh*(.95-.25*snow);
  cL=mix(cL,cL*vec3(.80,.83,.97),clamp(-sh*1.5,0.,1.)*.55);
  cL=mix(cL,cL*vec3(1.04,1.0,.92),clamp(sh*2.,0.,1.)*.4);
  float ed=1.-smoothstep(0.,4.5,sd*uV.z);
  cL=mix(cL,cL*vec3(.80,.72,.60),ed*.42);
 }
 if(lk<1.){
  cW=mix(vec3(.83,.90,.87),vec3(.60,.74,.80),smoothstep(0.,1.,pow(dep,.75)));
  float dd=abs(fract(cl+.5)-.5);
  cW=mix(cW,cW*vec3(.9,.94,.97),(1.-smoothstep(.5*cw,1.6*cw,dd))*.55*step(.06,dep));
  cW=mix(cW,vec3(.93,.95,.96),smoothstep(-6.,-14.,tc)*.8);
  cW*=1.+gn(p*vec2(.35,1.4),uW.x*.35)*.018;
  float dp=-sd*uV.z;vec3 ink=vec3(.2,.38,.46);
  cW=mix(cW,ink,(1.-smoothstep(.3,1.05,abs(dp-5.*uRing)))*.34);
  cW=mix(cW,ink,(1.-smoothstep(.3,1.05,abs(dp-9.5*uRing)))*.24);
  cW=mix(cW,ink,(1.-smoothstep(.3,1.05,abs(dp-15.*uRing)))*.16);
  cW=mix(cW,cW*vec3(.9,.95,.98),(1.-smoothstep(0.,9.*uRing,dp))*.35);
 }
 c=mix(cW,cL,lk);
 c*=(.965+.05*grain)*(1.-.05*stain);
 float edge=clamp(min(p.y,uW.y-p.y)/px+.5,0.,1.);
 gl_FragColor=vec4(c,edge);
}`;
    const sh = (t, src) => { const o = g.createShader(t); g.shaderSource(o, src); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) { console.warn(g.getShaderInfoLog(o)); return null; } return o; };
    const pr = g.createProgram(), v = sh(g.VERTEX_SHADER, vs), f = sh(g.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    g.attachShader(pr, v); g.attachShader(pr, f); g.linkProgram(pr);
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) return null;
    g.useProgram(pr);
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(pr, 'a'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
    const tex = (unit, w, h, data, fmt, linear) => {
      const t = g.createTexture(); g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(g.TEXTURE_2D, 0, fmt, w, h, 0, fmt, g.UNSIGNED_BYTE, data);
      const fl = linear ? g.LINEAR : g.NEAREST;
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, fl); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, fl);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    };
    const palData = new Uint8Array(16 * 3); BIOME_RGB.forEach((c, i) => palData.set(c, i * 3));
    tex(0, GW, GH, HGT, g.LUMINANCE, true); tex(1, GW, GH, BIO, g.LUMINANCE, false); tex(2, GW, GH, TMP, g.LUMINANCE, true); tex(3, 16, 1, palData, g.RGB, false);
    tex(4, W, H, buildSDF(), g.LUMINANCE, true);
    const U = n => g.getUniformLocation(pr, n);
    g.uniform1i(U('uH'), 0); g.uniform1i(U('uB'), 1); g.uniform1i(U('uT'), 2); g.uniform1i(U('uP'), 3); g.uniform1i(U('uS'), 4);
    g.uniform2f(U('uG'), GW, GH); g.uniform2f(U('uW'), W, H);
    const u = { V: U('uV'), Res: U('uRes'), Dpr: U('uDpr'), Oct: U('uOct'), Ring: U('uRing') };
    let tw = 0, th = 0, tdpr = 1;
    return {
      canvas: c,
      finish() { g.finish(); },
      render(q) {
        tdpr = q;
        const w = Math.max(1, Math.round(vw * tdpr)), h = Math.max(1, Math.round(vh * tdpr));
        if (w !== tw || h !== th) { c.width = w; c.height = h; tw = w; th = h; }
        g.uniform3f(u.V, cx, cy, s); g.uniform2f(u.Res, vw, vh); g.uniform1f(u.Dpr, tdpr);
        g.uniform1f(u.Oct, clamp(Math.floor(Math.log2(s * q / (1.6 * .05))) + 1, 2, 5));
        g.uniform1f(u.Ring, clamp(zf(), .8, 1.3));
        g.viewport(0, 0, w, h); g.drawArrays(g.TRIANGLES, 0, 3);
        return { w, h };
      }
    };
  })();
  /* 没有 WebGL 时的退路：按群系与水深铺一张小栅格 */
  const fallback = gl ? null : (() => {
    const mk = water => { const c = document.createElement('canvas'); c.width = GW; c.height = GH; const x = c.getContext('2d'), im = x.createImageData(GW, GH);
      for (let i = 0; i < GW * GH; i++) { const h = HGT[i] / 2.55; let col;
        if (water) { const d = clamp((20.5 - h) / 18, 0, 1); col = [211 - 58 * d, 229 - 40 * d, 222 - 18 * d]; }
        else { col = BIOME_RGB[BIO[i]] || BIOME_RGB[4]; if (h > 56) col = [204, 194, 181]; else if (h > 40) col = [219, 202, 161]; }
        im.data.set([col[0], col[1], col[2], 255], i * 4); }
      x.putImageData(im, 0, 0); return c; };
    return { land: mk(false), water: mk(true) };
  })();

  /* ---------------- 地形符号（按高程 / 群系确定性撒点，预渲染成小图） ---------------- */
  const INK = '#4e3d2b';
  function rnd(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  const glyphs = (() => {
    const r = rnd(59812824), out = [], SP = 7;
    const avoid = [[1824, 395, 34], [1471, 575, 46], [2232, 269, 22], [1419, 355, 14]];
    for (let row = 0, y = SP / 2; y < H; row++, y += SP * .866) {
      for (let x = SP / 2 + (row % 2 ? SP / 2 : 0); x < W; x += SP) {
        const jx = x + (r() - .5) * 4.8, jy = y + (r() - .5) * 4.8, rr = r(), rk = r(), v = Math.floor(r() * 6);
        if (gridAt(STA, jx, jy) === 255) continue;
        const h = heightAt(jx, jy); if (h < 22) continue;
        if (avoid.some(a => Math.hypot(jx - a[0], jy - a[1]) < a[2])) continue;
        const b = gridAt(BIO, jx, jy); let t = null, size = 0;
        if (h >= 63) { t = 'm'; size = clamp((h - 60) / 26, 0, 1); }
        else if (h >= 53) t = rr < .5 ? 'h' : null;
        else if (h >= 44) t = rr < .38 ? 'h' : null;
        else if ((b >= 5 && b <= 8) && rr < .58) t = 'f';
        else if (b === 9 && rr < .66) t = 'p';
        else if (b === 12 && rr < .5) t = 'w';
        else if ((b === 1 || b === 2) && rr < .25) t = 'd';
        if (!t) continue;
        const rank = t === 'm' ? rk * .75 + (1 - size) * .25 : t === 'h' ? rk * .9 + .08 : rk;
        out.push({ t, x: jx, y: jy, size, rank, v });
      }
    }
    out.sort((a, b) => a.y - b.y);
    return out;
  })();
  const sprites = {};
  function buildSprites() {
    const R = dpr * 2;
    const make = (key, w, h, draw) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * R); c.height = Math.ceil(h * R); const x = c.getContext('2d'); x.scale(R, R); x.lineJoin = 'round'; x.lineCap = 'round'; draw(x, rnd(key.length * 997 + key.charCodeAt(key.length - 1))); sprites[key] = { c, w, h }; };
    for (let v = 0; v < 6; v++) {
      make('m' + v, 26, 20, (x, r) => { // 山：受光面 + 背光面排线 + 雪顶
        const px = 13 + (r() - .5) * 4, py = 2.5 + r() * 3, L = 1.5 + r() * 2, Rr = 24.5 - r() * 2, base = 19;
        const sx = px - 4 - r() * 3, sy = py + 5 + r() * 3;
        x.beginPath(); x.moveTo(L, base); x.lineTo(sx, sy); x.lineTo(px, py); x.lineTo(Rr, base); x.closePath(); x.fillStyle = '#f4ead5'; x.fill();
        x.beginPath(); x.moveTo(px, py); x.lineTo(Rr, base); x.lineTo(px + 2 + r() * 2, base); x.closePath(); x.fillStyle = 'rgba(146,124,96,.38)'; x.fill();
        x.save(); x.clip(); x.strokeStyle = 'rgba(78,61,43,.45)'; x.lineWidth = .55; for (let i = -6; i < 26; i += 1.9) { x.beginPath(); x.moveTo(px + i * .4, py + i); x.lineTo(px + i * .4 + 6, py + i - 3.5); x.stroke(); } x.restore();
        if (v % 2 === 0) { x.beginPath(); x.moveTo(px, py); x.lineTo(px - 3.2, py + 4.2); x.lineTo(px - 1.2, py + 3.4); x.lineTo(px + .3, py + 5); x.lineTo(px + 2.4, py + 3.3); x.closePath(); x.fillStyle = '#fdfcf8'; x.fill(); }
        x.beginPath(); x.moveTo(L, base); x.lineTo(sx, sy); x.lineTo(px, py); x.lineTo(Rr, base); x.strokeStyle = INK; x.lineWidth = 1.05; x.stroke();
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 1.5, (py + base) / 2, px + 2 + r() * 2, base - 2); x.lineWidth = .7; x.stroke();
      });
    }
    for (let v = 0; v < 3; v++) make('h' + v, 22, 12, (x, r) => {
      const top = 3 + r() * 2.5, cxh = 11 + (r() - .5) * 3;
      x.beginPath(); x.moveTo(2, 11); x.quadraticCurveTo(cxh, top - 3, 20, 11); x.fillStyle = 'rgba(244,234,213,.9)'; x.fill();
      x.save(); x.clip(); x.strokeStyle = 'rgba(78,61,43,.38)'; x.lineWidth = .55; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(cxh + 2 + i * 1.9, 11); x.lineTo(cxh + 4 + i * 1.9, 6); x.stroke(); } x.restore();
      x.beginPath(); x.moveTo(2, 11); x.quadraticCurveTo(cxh, top - 3, 20, 11); x.strokeStyle = INK; x.lineWidth = .95; x.stroke();
    });
    for (let v = 0; v < 3; v++) make('f' + v, 14, 13, (x, r) => { // 阔叶林：两三棵树的小丛
      const fills = ['#a9c58e', '#9fbf88', '#b3cb92'];
      const tree = (tx, ty, rr) => {
        x.strokeStyle = '#6a5a3c'; x.lineWidth = .8; x.beginPath(); x.moveTo(tx, ty + rr * .6); x.lineTo(tx, ty + rr * 1.55); x.stroke();
        x.beginPath(); x.ellipse(tx, ty, rr, rr * .92, 0, 0, 7); x.fillStyle = fills[v]; x.fill();
        x.save(); x.clip(); x.fillStyle = 'rgba(70,96,52,.3)'; x.beginPath(); x.ellipse(tx + rr * .55, ty + rr * .5, rr, rr, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,240,.35)'; x.beginPath(); x.ellipse(tx - rr * .35, ty - rr * .4, rr * .35, rr * .28, 0, 0, 7); x.fill(); x.restore();
        x.beginPath(); x.ellipse(tx, ty, rr, rr * .92, 0, 0, 7); x.strokeStyle = 'rgba(70,84,48,.9)'; x.lineWidth = .7; x.stroke();
      };
      if (v !== 1) tree(4.2 + r(), 5.4, 3.1);
      tree(9.6 + r() * .6, 4.6 + r() * .6, 3.4);
      tree(6.6, 7.4, 3.5);
    });
    for (let v = 0; v < 3; v++) make('p' + v, 10, 15, (x, r) => { // 针叶树
      x.strokeStyle = '#4f5a3f'; x.lineWidth = .8; x.beginPath(); x.moveTo(5, 11); x.lineTo(5, 14.5); x.stroke();
      x.beginPath(); x.moveTo(5, 1 + r()); x.lineTo(8.6, 7); x.lineTo(7, 7); x.lineTo(9.4, 12); x.lineTo(.6, 12); x.lineTo(3, 7); x.lineTo(1.4, 7); x.closePath();
      x.fillStyle = ['#9db89a', '#93b292', '#a6bf9c'][v]; x.fill(); x.save(); x.clip(); x.fillStyle = 'rgba(52,74,52,.25)'; x.fillRect(5, 0, 6, 15); x.restore(); x.strokeStyle = '#4b5d47'; x.stroke();
    });
    for (let v = 0; v < 2; v++) make('w' + v, 14, 8, (x, r) => { // 沼泽
      x.strokeStyle = 'rgba(70,104,104,.75)'; x.lineWidth = .8;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(1 + i * 1.5 + r(), 3 + i * 2); x.lineTo(8 + i * 1.5 + r() * 3, 3 + i * 2); x.stroke(); }
      x.beginPath(); x.moveTo(5, 3); x.lineTo(4.4, .5); x.moveTo(6, 3); x.lineTo(6.6, .3); x.moveTo(10, 5); x.lineTo(10.4, 2.6); x.stroke();
    });
    for (let v = 0; v < 2; v++) make('d' + v, 16, 8, (x, r) => { // 沙丘
      x.strokeStyle = 'rgba(140,108,64,.7)'; x.lineWidth = .8;
      x.beginPath(); x.moveTo(1, 6); x.quadraticCurveTo(5, 1.5 + r(), 9, 6); x.stroke();
      x.beginPath(); x.moveTo(7, 7.4); x.quadraticCurveTo(11, 3.5 + r(), 15, 7.4); x.stroke();
    });
  }

  /* ---------------- 绘制 ---------------- */
  /* 政区浅彩只在首次需要时画一次（地图坐标 1 单位 / 像素），之后每帧只贴图 */
  let polCanvas = null;
  function politicsLayer() {
    if (polCanvas) return polCanvas;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.lineJoin = 'round'; x.lineCap = 'round';
    for (const [id, col] of stateColor) {
      const rg = regions.get(id); x.save(); x.clip(rg.path); x.fillStyle = col + '3a'; x.fill(rg.path);
      x.strokeStyle = col + 'b0'; x.lineWidth = 8; x.stroke(borderAll); x.restore();
    }
    return (polCanvas = c);
  }
  const perf = { gl: 0, frame: 0, frames: 0, resizes: 0, hi: 0 };
  /* 地形分两档：视图在动时低分辨率实时算，停下 0.2 秒后补一帧高清；视图没变（如悬停高亮）时直接复用上一帧地形 */
  let glKey = '', glSrc = null, viewKey = '', lastMotion = 0, hiTimer = 0;
  function terrain(now) {
    const vk = cx.toFixed(3) + ',' + cy.toFixed(3) + ',' + s.toFixed(5) + ',' + vw + ',' + vh;
    if (vk !== viewKey) { viewKey = vk; lastMotion = now; }
    const moving = flight || now - lastMotion < 180;
    const q = moving ? Math.min(.5, dpr) : Math.min(dpr, 1), key = vk + ',' + q;
    if (key !== glKey) { glSrc = gl.render(q); glKey = key; if (!moving) perf.hi++; }
    if (moving) { clearTimeout(hiTimer); hiTimer = setTimeout(() => { dirty = true; invalidate(); }, 200); }
    return glSrc;
  }
  function frame() {
    if (!vw) return;
    const C = ctx, ks = copies(), z = zf();
    setScreen(C); C.clearRect(0, 0, vw, vh);
    // 地形：WebGL 一次画出海陆（距离场决定海岸），无 WebGL 时退回裁切小栅格
    const t0 = performance.now(), src = gl ? terrain(t0) : null;
    perf.gl = performance.now() - t0;
    if (gl) { C.imageSmoothingQuality = 'high'; C.drawImage(gl.canvas, 0, 0, src.w, src.h, 0, 0, vw, vh); }
    else for (const pass of ['land', 'water']) for (const k of ks) {
      C.save(); setMap(C, k); C.clip(pass === 'land' ? landPath : waterPath, 'evenodd'); C.imageSmoothingEnabled = true; C.drawImage(fallback[pass], 0, 0, W, H); C.restore();
    }
    const pol = layers.politics ? politicsLayer() : null;
    for (const k of ks) {
      setMap(C, k);
      // 政区：预渲染的浅彩平涂 + 沿国界的内侧色带，放大后逐渐变淡
      if (pol) { C.globalAlpha = clamp(1.25 - s / 7, .45, 1); C.drawImage(pol, 0, 0, W, H); C.globalAlpha = 1; }
      if (hoverState != null && regions.has(hoverState) && hoverState !== selected?.state) {
        const rg = regions.get(hoverState); C.save(); C.clip(rg.path); C.fillStyle = 'rgba(255,248,230,.22)'; C.fill(rg.path); C.strokeStyle = 'rgba(120,86,40,.35)'; C.lineWidth = 6 / s; C.stroke(rg.path); C.restore();
      }
      if (layers.routes) {
        C.save(); C.setLineDash([1.2 / s, 4.5 / s]); C.lineCap = 'round'; C.strokeStyle = 'rgba(64,96,116,.42)'; C.lineWidth = 1 / s; C.stroke(routePaths.searoutes);
        if (s > 1.1) { C.setLineDash([4 / s, 2.6 / s]); C.strokeStyle = 'rgba(120,88,52,.5)'; C.lineWidth = 1 / s; C.stroke(routePaths.roads); }
        if (s > 2.4) { C.setLineDash([1 / s, 2.4 / s]); C.strokeStyle = 'rgba(120,88,52,.42)'; C.lineWidth = .8 / s; C.stroke(routePaths.trails); }
        C.restore(); C.setLineDash([]);
      }
      if (layers.rivers) {
        C.save(); C.lineCap = 'round'; C.lineJoin = 'round';
        const wsc = Math.min(1.6, .7 + .3 * z);
        [[0, 2.2, .55], [1, 1.1, .85], [2, .5, 1.25], [3, 0, 1.9]].forEach(([b, minZ, w]) => {
          if (s < minZ) return;
          C.strokeStyle = 'rgba(244,240,226,.55)'; C.lineWidth = (w * wsc + 1.4) / s; C.stroke(riverBuckets[b]);
          C.strokeStyle = '#6f9bb2'; C.lineWidth = w * wsc / s; C.stroke(riverBuckets[b]);
        });
        C.restore();
      }
    }
    if (layers.relief) drawGlyphs(C, ks, z);
    for (const k of ks) {
      setMap(C, k);
      if (layers.borders) {
        C.lineCap = 'round'; C.lineJoin = 'round';
        C.strokeStyle = 'rgba(250,244,228,.6)'; C.lineWidth = 3.2 / s; C.stroke(borderCanon);
        C.setLineDash([5.5 / s, 2.4 / s, 1.2 / s, 2.4 / s]); C.strokeStyle = 'rgba(96,58,44,.82)'; C.lineWidth = 1.25 / s; C.stroke(borderCanon);
        C.setLineDash([2.6 / s, 2.6 / s]); C.strokeStyle = 'rgba(96,72,52,.42)'; C.lineWidth = .9 / s; C.stroke(borderGhost); C.setLineDash([]);
      }
      // 海岸墨线
      C.strokeStyle = INK; C.lineWidth = 1.3 / s; C.lineJoin = 'round'; C.stroke(coastPath);
      C.strokeStyle = 'rgba(78,61,43,.75)'; C.lineWidth = .9 / s; C.stroke(lakePath);
      if (selected && selected.state != null && regions.has(selected.state)) {
        const rg = regions.get(selected.state);
        C.save(); C.clip(rg.path); C.strokeStyle = 'rgba(176,122,40,.3)'; C.lineWidth = 12 / s; C.stroke(rg.path); C.restore();
        C.strokeStyle = '#a8742a'; C.lineWidth = 2.1 / s; C.stroke(rg.path);
      }
      if (layers.grid) drawGrid(C, k);
      drawSpecials(C, k, z);
    }
    drawFrameDecor(C, ks);
    placeLabels();
    updateScale();
    perf.frame = performance.now() - t0; perf.frames++;
    dirty = false;
  }

  const GAP = { m: 31, h: 21, f: 11.5, p: 10.5, w: 14, d: 15 };
  function drawGlyphs(C, ks, z) {
    const gs = clamp(.55 + .34 * Math.log2(1 + s), .55, 1.7), dens = {};
    for (const t in GAP) dens[t] = clamp(Math.pow(7 * s / (GAP[t] * gs), 2), .03, 1);
    const L = cx - vw / 2 / s - 20, R = cx + vw / 2 / s + 20, T = cy - vh / 2 / s - 20, B = cy + vh / 2 / s + 20;
    setScreen(C);
    for (const g of glyphs) {
      if (g.rank > dens[g.t] || g.y < T || g.y > B) continue;
      for (const k of ks) {
        const x = g.x + k * W; if (x < L || x > R) continue;
        const sp = sprites[g.t + (g.t === 'm' ? g.v : g.t === 'w' || g.t === 'd' ? g.v % 2 : g.v % 3)]; if (!sp) continue;
        const sc = gs * (g.t === 'm' ? .72 + g.size * .45 : 1), w = sp.w * sc, h = sp.h * sc;
        const [px, py] = toScreen(x, g.y);
        C.drawImage(sp.c, px - w / 2, py - h * .85, w, h);
      }
    }
  }

  function drawGrid(C, k) {
    C.save(); C.strokeStyle = 'rgba(110,88,58,.16)'; C.lineWidth = .7 / s;
    C.beginPath();
    for (let lon = -180; lon <= 180; lon += 30) { const x = (lon + 180) / 360 * W; C.moveTo(x, 0); C.lineTo(x, H); }
    for (let lat = -75; lat <= 75; lat += 15) { const y = (90 - lat) / 180 * H; C.moveTo(0, y); C.lineTo(W, y); }
    C.stroke();
    C.setLineDash([6 / s, 4 / s]); C.strokeStyle = 'rgba(150,86,58,.24)'; C.lineWidth = .9 / s; C.beginPath(); C.moveTo(0, H / 2); C.lineTo(W, H / 2); C.stroke();
    C.restore();
  }

  function drawFrameDecor(C, ks) {
    setScreen(C);
    const [, top] = toScreen(0, 0), [, bot] = toScreen(0, H);
    C.save();
    // 上下图廓：黑白相间的经度刻度带
    for (const k of ks) {
      for (const [y0, dir] of [[top, -1], [bot, 1]]) {
        if (y0 < -14 || y0 > vh + 14) continue;
        const band = 5;
        for (let lon = 0; lon < 360; lon += 5) {
          const [x1] = toScreen(lon / 360 * W + k * W, 0), [x2] = toScreen((lon + 5) / 360 * W + k * W, 0);
          if (x2 < 0 || x1 > vw) continue;
          C.fillStyle = (lon / 5) % 2 ? '#f4ead6' : '#3e3122';
          C.fillRect(x1, dir < 0 ? y0 - band - 2 : y0 + 2, x2 - x1, band);
        }
        const [xa] = toScreen(k * W, 0), [xb] = toScreen((k + 1) * W, 0);
        C.strokeStyle = '#3e3122'; C.lineWidth = 1.2;
        C.beginPath(); C.moveTo(Math.max(xa, -2), y0); C.lineTo(Math.min(xb, vw + 2), y0); C.stroke();
        C.lineWidth = .8; const o = dir * (band + 4);
        C.beginPath(); C.moveTo(Math.max(xa, -2), y0 + o); C.lineTo(Math.min(xb, vw + 2), y0 + o); C.stroke();
        // 经度注记
        if (Math.abs(dir < 0 ? top : vh - bot) > 30) {
          C.fillStyle = 'rgba(62,49,34,.72)'; C.font = '10px "Noto Serif SC", serif'; C.textAlign = 'center'; C.textBaseline = dir < 0 ? 'bottom' : 'top';
          for (let lon = -150; lon <= 180; lon += 30) { const [x] = toScreen((lon + 180) / 360 * W + k * W, 0); if (x > 10 && x < vw - 10) C.fillText(Math.abs(lon) + '°' + (lon > 0 ? 'E' : lon < 0 ? 'W' : ''), x, y0 + o + dir * 4); }
        }
      }
      // 图名：留白足够时写在上方图廓外
      if (top > 168 || (vw >= 700 && top > 96)) {
        const [x] = toScreen(W / 2 + k * W, 0);
        if (x > -200 && x < vw + 200) {
          C.fillStyle = '#3e3122'; C.textAlign = 'center'; C.textBaseline = 'alphabetic';
          C.font = '600 26px "Noto Serif SC", "Source Han Serif SC", serif';
          C.fillText('P I E R T E I A', x, top - 60);
          C.font = '12px "Noto Serif SC", serif'; C.fillStyle = 'rgba(62,49,34,.7)';
          C.fillText('主 世 界 全 图  ·  新 历 测 绘', x, top - 40);
        }
      }
    }
    if (vh - bot > 92) drawLegend(C, vw / 2, bot + 34);
    C.restore();
  }
  function drawLegend(C, x0, y0) {
    const items = [['border', '国界'], ['ghost', '未设定区界'], ['river', '河流'], ['road', '道路'], ['sea', '航线'], ['m0', '山地'], ['h0', '丘陵'], ['f0', '阔叶林'], ['p0', '针叶林'], ['rift', '时空裂缝']];
    C.font = '12px "Noto Serif SC", serif'; C.textBaseline = 'middle'; C.textAlign = 'left';
    const widths = items.map(([, t]) => 30 + C.measureText(t).width + 18), total = widths.reduce((a, b) => a + b, 0) + 70;
    if (total > vw - 40) return;
    let x = x0 - total / 2; const y = y0 + 14;
    C.fillStyle = 'rgba(250,245,232,.55)'; C.strokeStyle = 'rgba(62,49,34,.55)'; C.lineWidth = 1;
    C.beginPath(); C.rect(x, y0 - 6, total, 40); C.fill(); C.stroke(); C.strokeRect(x + 3, y0 - 3, total - 6, 34);
    C.fillStyle = '#3e3122'; C.font = '600 12px "Noto Serif SC", serif'; C.fillText('图 例', x + 14, y); C.font = '12px "Noto Serif SC", serif';
    x += 62;
    items.forEach(([k, t], i) => {
      C.save(); C.lineCap = 'round';
      if (k === 'border') { C.setLineDash([5.5, 2.4, 1.2, 2.4]); C.strokeStyle = 'rgba(96,58,44,.85)'; C.lineWidth = 1.25; C.beginPath(); C.moveTo(x, y); C.lineTo(x + 24, y); C.stroke(); }
      else if (k === 'ghost') { C.setLineDash([2.6, 2.6]); C.strokeStyle = 'rgba(96,72,52,.6)'; C.lineWidth = .9; C.beginPath(); C.moveTo(x, y); C.lineTo(x + 24, y); C.stroke(); }
      else if (k === 'river') { C.strokeStyle = '#6f9bb2'; C.lineWidth = 1.6; C.beginPath(); C.moveTo(x, y + 3); C.bezierCurveTo(x + 8, y - 5, x + 14, y + 6, x + 24, y - 2); C.stroke(); }
      else if (k === 'road') { C.setLineDash([4, 2.6]); C.strokeStyle = 'rgba(120,88,52,.7)'; C.lineWidth = 1; C.beginPath(); C.moveTo(x, y); C.lineTo(x + 24, y); C.stroke(); }
      else if (k === 'sea') { C.setLineDash([1.2, 4]); C.strokeStyle = 'rgba(64,96,116,.8)'; C.lineWidth = 1.2; C.beginPath(); C.moveTo(x, y); C.lineTo(x + 24, y); C.stroke(); }
      else if (k === 'rift') { C.strokeStyle = 'rgba(140,90,250,.4)'; C.lineWidth = 6; C.beginPath(); C.moveTo(x, y + 4); C.lineTo(x + 8, y - 3); C.lineTo(x + 15, y + 3); C.lineTo(x + 24, y - 4); C.stroke(); C.strokeStyle = '#c9a8ff'; C.lineWidth = 2.6; C.stroke(); C.strokeStyle = '#140d26'; C.lineWidth = 1.4; C.stroke(); }
      else { const sp = sprites[k]; if (sp) { const h = 18, w = sp.w / sp.h * h; C.drawImage(sp.c, x + 12 - w / 2, y - h / 2 - 1, w, h); } }
      C.restore();
      C.fillStyle = '#3e3122'; C.fillText(t, x + 30, y);
      x += widths[i];
    });
  }

  /* ---------------- 特殊地点图形 ---------------- */
  const ART = { peak: 1.5, city: 1, academy: .85 }, ART_DROP = { peak: .34, city: .6, academy: .36 };
  const artSize = () => 30 * clamp(Math.pow(s / .7, .5), .8, 2.6);
  function drawSpecials(C, k, z) {
    const S = artSize();
    for (const it of items) {
      if (!it.art) continue;
      const [x, y] = toScreen(it.x + k * W, it.y);
      if (x < -S * 3 || x > vw + S * 3 || y < -S * 3 || y > vh + S * 3) continue;
      setScreen(C);
      C.save();
      if (it.art === 'peak') drawPeak(C, x, y, S * ART.peak);
      else if (it.art === 'city') drawCity(C, x, y, S * ART.city);
      else if (it.art === 'academy') drawAcademy(C, x, y, S * ART.academy);
      else if (it.art === 'isles') drawIsles(C, k);
      if (selected && selected.name === it.name) { C.strokeStyle = 'rgba(168,116,42,.9)'; C.lineWidth = 1.6; C.setLineDash([3, 3]); C.beginPath(); C.arc(x, y, S * (it.art === 'isles' ? 1.6 : .95), 0, Math.PI * 2); C.stroke(); }
      C.restore();
      setMap(C, k);
    }
  }
  function drawPeak(C, x, y, S) {
    // 通天之柱：峰顶向上的淡金光柱与光晕
    const sx = x, sy = y - S * .78;
    let g = C.createLinearGradient(0, sy - S * 2.4, 0, sy);
    g.addColorStop(0, 'rgba(255,236,186,0)'); g.addColorStop(.7, 'rgba(255,232,170,.38)'); g.addColorStop(1, 'rgba(255,240,200,.75)');
    C.fillStyle = g; C.beginPath(); C.moveTo(sx - S * .05, sy); C.lineTo(sx - S * .16, sy - S * 2.4); C.lineTo(sx + S * .16, sy - S * 2.4); C.lineTo(sx + S * .05, sy); C.fill();
    g = C.createRadialGradient(sx, sy, 0, sx, sy, S * 1.1); g.addColorStop(0, 'rgba(255,244,214,.7)'); g.addColorStop(1, 'rgba(255,244,214,0)');
    C.fillStyle = g; C.beginPath(); C.arc(sx, sy, S * 1.1, 0, 7); C.fill();
    const peak = (bx, by, w, h, snow, lit, shade) => {
      const tx = bx + w * .04, ty = by - h;
      C.beginPath(); C.moveTo(bx - w / 2, by); C.lineTo(bx - w * .3, by - h * .42); C.lineTo(bx - w * .17, by - h * .55); C.lineTo(tx, ty); C.lineTo(bx + w * .22, by - h * .5); C.lineTo(bx + w / 2, by); C.closePath();
      C.fillStyle = lit; C.fill();
      C.save(); C.clip();
      C.beginPath(); C.moveTo(tx, ty); C.lineTo(bx + w * .22, by - h * .5); C.lineTo(bx + w / 2, by); C.lineTo(bx + w * .08, by); C.lineTo(bx + w * .02, by - h * .45); C.closePath(); C.fillStyle = shade; C.fill();
      C.strokeStyle = 'rgba(70,60,84,.35)'; C.lineWidth = .7; for (let i = 0; i < h; i += 2.6) { C.beginPath(); C.moveTo(tx + i * .22, ty + i); C.lineTo(tx + i * .22 + w * .3, ty + i - h * .12); C.stroke(); }
      if (snow) { C.beginPath(); C.moveTo(tx, ty); C.lineTo(tx - w * .19, ty + h * .3); C.lineTo(tx - w * .09, ty + h * .25); C.lineTo(tx - w * .02, ty + h * .36); C.lineTo(tx + w * .07, ty + h * .27); C.lineTo(tx + w * .16, ty + h * .34); C.lineTo(tx + w * .19, ty + h * .28); C.closePath(); C.fillStyle = 'rgba(255,255,255,.95)'; C.fill(); }
      C.restore();
      C.beginPath(); C.moveTo(bx - w / 2, by); C.lineTo(bx - w * .3, by - h * .42); C.lineTo(bx - w * .17, by - h * .55); C.lineTo(tx, ty); C.lineTo(bx + w * .22, by - h * .5); C.lineTo(bx + w / 2, by);
      C.strokeStyle = '#3a2f24'; C.lineWidth = 1.35; C.lineJoin = 'round'; C.stroke();
      C.beginPath(); C.moveTo(tx, ty); C.quadraticCurveTo(bx + w * .06, by - h * .45, bx + w * .08, by - 1); C.lineWidth = .9; C.stroke();
    };
    peak(x - S * .62, y + S * .22, S * .8, S * .62, true, '#efe8dc', 'rgba(150,140,170,.55)');
    peak(x + S * .66, y + S * .26, S * .78, S * .55, true, '#efe8dc', 'rgba(150,140,170,.55)');
    peak(x, y + S * .3, S * 1.12, S * 1.12, true, '#f8f4ec', 'rgba(140,132,168,.6)');
    // 峰顶星芒
    C.fillStyle = '#d9a63b'; C.beginPath(); const r1 = S * .12, r2 = S * .03;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? r2 : r1; C.lineTo(sx + S * .045 + Math.cos(a) * r, sy - S * .02 + Math.sin(a) * r); }
    C.closePath(); C.fill();
  }
  function drawCity(C, x, y, S) {
    const R = S * .55;
    C.fillStyle = 'rgba(60,40,20,.14)'; C.beginPath(); C.ellipse(x + 2, y + 3, R * 1.08, R * .9, 0, 0, 7); C.fill();
    C.strokeStyle = 'rgba(96,140,170,.75)'; C.lineWidth = 2.2; C.beginPath(); C.arc(x, y, R * 1.05, 0, 7); C.stroke();
    // 星形棱堡城墙
    C.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? R * .74 : R * .96; C.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } C.closePath();
    C.fillStyle = '#efe2c2'; C.fill(); C.strokeStyle = '#3c2f22'; C.lineWidth = 1.3; C.stroke();
    C.beginPath(); C.arc(x, y, R * .6, 0, 7); C.fillStyle = '#f8f0dc'; C.fill(); C.lineWidth = .9; C.stroke();
    C.strokeStyle = 'rgba(60,47,34,.45)'; C.lineWidth = .7; C.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; C.moveTo(x + Math.cos(a) * R * .2, y + Math.sin(a) * R * .2); C.lineTo(x + Math.cos(a) * R * .6, y + Math.sin(a) * R * .6); } C.stroke();
    C.fillStyle = '#c99e78'; const rr = rnd(9);
    for (let i = 0; i < 26; i++) { const a = rr() * Math.PI * 2, d = R * (.26 + rr() * .3), bs = S * (.035 + rr() * .03); C.fillRect(x + Math.cos(a) * d - bs / 2, y + Math.sin(a) * d - bs / 2, bs, bs); }
    // 中央穹顶（图书馆）与钟楼
    C.beginPath(); C.arc(x, y + R * .05, R * .2, Math.PI, 0); C.lineTo(x + R * .24, y + R * .16); C.lineTo(x - R * .24, y + R * .16); C.closePath();
    C.fillStyle = '#e7c46f'; C.fill(); C.strokeStyle = '#3c2f22'; C.lineWidth = 1; C.stroke();
    C.beginPath(); C.arc(x - R * .06, y - R * .03, R * .07, 0, 7); C.fillStyle = 'rgba(255,255,255,.7)'; C.fill();
    C.fillStyle = '#3c2f22'; C.fillRect(x - .6, y - R * .28, 1.2, R * .14);
    C.fillStyle = '#4c6fa0'; C.beginPath(); C.moveTo(x + .6, y - R * .28); C.lineTo(x + R * .16, y - R * .24); C.lineTo(x + .6, y - R * .2); C.fill();
  }
  function drawAcademy(C, x, y, S) {
    let g = C.createRadialGradient(x, y, 0, x, y, S * 1.05); g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    C.fillStyle = g; C.beginPath(); C.arc(x, y, S * 1.05, 0, 7); C.fill();
    const ink = '#3c2f22', wall = '#f4ead4', roof = '#b8654c';
    const house = (bx, by, w, h, rh) => {
      C.fillStyle = wall; C.fillRect(bx - w / 2, by - h, w, h); C.strokeStyle = ink; C.lineWidth = 1; C.strokeRect(bx - w / 2, by - h, w, h);
      C.beginPath(); C.moveTo(bx - w / 2 - 1.5, by - h); C.lineTo(bx, by - h - rh); C.lineTo(bx + w / 2 + 1.5, by - h); C.closePath(); C.fillStyle = roof; C.fill(); C.stroke();
      C.fillStyle = '#ffd77a'; for (let i = -1; i <= 1; i += 2) C.fillRect(bx + i * w * .22 - 1, by - h * .62, 2, 2.4);
    };
    C.fillStyle = 'rgba(60,40,20,.15)'; C.beginPath(); C.ellipse(x + 1, y + S * .32, S * .62, S * .14, 0, 0, 7); C.fill();
    house(x - S * .36, y + S * .3, S * .32, S * .26, S * .16);
    house(x + S * .02, y + S * .3, S * .42, S * .36, S * .22);
    // 圆塔与灯
    const tx = x + S * .38, ty = y + S * .3;
    C.fillStyle = wall; C.fillRect(tx - S * .08, ty - S * .6, S * .16, S * .6); C.strokeStyle = ink; C.strokeRect(tx - S * .08, ty - S * .6, S * .16, S * .6);
    C.beginPath(); C.moveTo(tx - S * .11, ty - S * .6); C.lineTo(tx, ty - S * .84); C.lineTo(tx + S * .11, ty - S * .6); C.closePath(); C.fillStyle = '#5a6f8f'; C.fill(); C.stroke();
    g = C.createRadialGradient(tx, ty - S * .5, 0, tx, ty - S * .5, S * .22); g.addColorStop(0, 'rgba(255,226,140,.95)'); g.addColorStop(1, 'rgba(255,226,140,0)');
    C.fillStyle = g; C.beginPath(); C.arc(tx, ty - S * .5, S * .22, 0, 7); C.fill();
    C.fillStyle = '#ffe08a'; C.fillRect(tx - 1.2, ty - S * .53, 2.4, 3);
    C.strokeStyle = ink; C.beginPath(); C.moveTo(tx, ty - S * .84); C.lineTo(tx, ty - S * .98); C.stroke();
    C.fillStyle = '#c0553f'; C.beginPath(); C.moveTo(tx, ty - S * .98); C.lineTo(tx + S * .16, ty - S * .94); C.lineTo(tx, ty - S * .9); C.fill();
  }
  function drawIsles(C, k) {
    // 常灵群岛：雾霭与岛上灯火（裂缝与流光在动效层）
    const [x, y] = toScreen(1471 + k * W, 575), R = 52 * s;
    const g = C.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, 'rgba(240,234,255,.55)'); g.addColorStop(.6, 'rgba(226,216,250,.22)'); g.addColorStop(1, 'rgba(226,216,250,0)');
    C.fillStyle = g; C.beginPath(); C.arc(x, y, R, 0, 7); C.fill();
    setMap(C, k);
    C.fillStyle = '#a9c88f'; C.fill(isletPath);
    C.save(); C.clip(isletPath); C.strokeStyle = 'rgba(236,224,182,.9)'; C.lineWidth = 2.2 / s; C.stroke(isletPath);
    C.fillStyle = 'rgba(60,96,58,.22)'; C.translate(.8, .9); C.fill(isletPath); C.restore();
    C.strokeStyle = INK; C.lineWidth = 1.1 / s; C.stroke(isletPath);
    setScreen(C);
    const sp = sprites.f0;
    if (sp && s > 1.2) for (const c of isletCenters) {
      if (c.r < 2.2) continue;
      const [px, py] = toScreen(c.x + k * W, c.y), h = Math.min(18, c.r * s * .7), w = sp.w / sp.h * h;
      C.drawImage(sp.c, px - w / 2, py - h * .6, w, h);
    }
  }
  const isletPath = new Path2D(); isletRings.forEach(r => addRing(isletPath, r));
  const isletCenters = isletRings.map(r => { let x = 0, y = 0; r.forEach(p => { x += p[0]; y += p[1]; }); x /= r.length; y /= r.length; return { x, y, r: Math.sqrt(ringArea(r) / Math.PI) }; });

  /* 动效层：裂缝的流光、群岛萤火、选中脉冲 */
  const wisps = Array.from({ length: 26 }, (_, i) => { const r = rnd(i * 31 + 7); return { a: r() * 6.28, d: 8 + r() * 40, sp: (.15 + r() * .35) * (r() < .5 ? -1 : 1), y: (r() - .5) * 20, ph: r() * 6.28 }; });
  let fxRunning = false, fxT = 0;
  function drawFx(t) {
    fxT = t / 1000;
    setScreen(fctx); fctx.clearRect(0, 0, vw, vh);
    const z = zf(), ks = copies();
    for (const k of ks) {
      const [rx, ry] = toScreen(1471 + k * W, 575);
      if (rx < -400 * s || rx > vw + 400 * s) continue;
      setMap(fctx, k); fctx.lineCap = 'round'; fctx.lineJoin = 'round';
      const pulse = reduced ? .5 : .5 + .5 * Math.sin(fxT * 1.7);
      const w = Math.min(1.8, .75 + .35 * z);
      fctx.strokeStyle = `rgba(128,78,240,${.1 + .05 * pulse})`; fctx.lineWidth = 26 * w / s; fctx.stroke(RIFT);
      fctx.strokeStyle = `rgba(140,90,250,${.26 + .1 * pulse})`; fctx.lineWidth = 11 * w / s; fctx.stroke(RIFT); fctx.lineWidth = 6 * w / s; fctx.stroke(RIFT_BR);
      fctx.strokeStyle = '#c9a8ff'; fctx.lineWidth = 4.6 * w / s; fctx.stroke(RIFT); fctx.lineWidth = 2.4 * w / s; fctx.stroke(RIFT_BR);
      fctx.strokeStyle = '#140d26'; fctx.lineWidth = 2.6 * w / s; fctx.stroke(RIFT); fctx.lineWidth = 1.2 * w / s; fctx.stroke(RIFT_BR);
      fctx.setLineDash([3 / s, 9 / s]); fctx.lineDashOffset = reduced ? 0 : -fxT * 6 / s;
      fctx.strokeStyle = `rgba(244,234,255,${.55 + .35 * pulse})`; fctx.lineWidth = .8 * w / s; fctx.stroke(RIFT); fctx.setLineDash([]); fctx.stroke(RIFT_TH);
      // 萤火
      setScreen(fctx);
      for (const p of wisps) {
        const a = p.a + (reduced ? 0 : fxT * p.sp * .4), mx = 1471 + Math.cos(a) * p.d * 1.2, my = 575 + Math.sin(a) * p.d * .8 + p.y * .3;
        const [px, py] = toScreen(mx + k * W, my), al = .35 + .35 * Math.sin(fxT * 2 + p.ph);
        const r = 2.2 * Math.min(2, .8 + .3 * z);
        const g = fctx.createRadialGradient(px, py, 0, px, py, r * 3); g.addColorStop(0, `rgba(250,246,255,${al})`); g.addColorStop(1, 'rgba(210,190,255,0)');
        fctx.fillStyle = g; fctx.beginPath(); fctx.arc(px, py, r * 3, 0, 7); fctx.fill();
      }
    }
    if (selected && selected.item && !reduced) {
      const it = selected.item;
      for (const k of ks) {
        const [px, py] = toScreen(it.x + k * W, it.y); if (px < -60 || px > vw + 60) continue;
        const ph = (fxT % 2.2) / 2.2;
        setScreen(fctx); fctx.strokeStyle = `rgba(168,116,42,${.55 * (1 - ph)})`; fctx.lineWidth = 2; fctx.beginPath(); fctx.arc(px, py, 8 + ph * 34, 0, 7); fctx.stroke();
      }
    }
  }
  function fxLoop(t) { if (document.hidden) { fxRunning = false; return; } drawFx(t); if (!reduced) requestAnimationFrame(fxLoop); else fxRunning = false; }
  function startFx() { if (fxRunning) return; fxRunning = true; requestAnimationFrame(fxLoop); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { startFx(); invalidate(); } });

  /* ---------------- 地名（DOM，可点击） ---------------- */
  const labelEls = [];
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'atl-label ' + (it.art ? 'special art-' + it.art : it.canon ? 'nation' : 'ghost');
    b.innerHTML = '<span class="t"></span>' + (it.art ? '<span class="k"></span>' : '');
    b.querySelector('.t').textContent = it.name;
    if (it.art) b.querySelector('.k').textContent = (LOC[it.name]?.kind || '特殊地点').replace('特殊地点', '特殊地点');
    if (!it.art) b.style.fontSize = it.size + 'px';
    b.setAttribute('aria-label', it.name + (it.ghost ? '（未设定地区）' : ''));
    b.addEventListener('click', e => { e.stopPropagation(); selectItem(it, true, true); });
    b.addEventListener('pointerenter', () => { if (it.state != null && hoverState !== it.state) { hoverState = it.state; invalidate(); } });
    b.addEventListener('pointerleave', () => { if (hoverState === it.state) { hoverState = null; invalidate(); } });
    labelHost.appendChild(b);
    labelEls.push({ it, el: b, w: 0, h: 0 });
  }
  function measureLabels() { for (const l of labelEls) { const hid = l.el.hidden; l.el.hidden = false; const r = l.el.getBoundingClientRect(); l.w = r.width; l.h = r.height; l.el.hidden = hid; } }
  function placeLabels() {
    const placed = [];
    const order = labelEls.slice().sort((a, b) => pri(b) - pri(a));
    const S = artSize(), lk = clamp(.62 + .32 * Math.log2(1 + s), .72, 1.15);
    for (const l of order) {
      const it = l.it;
      const show = layers.labels && (!it.ghost || layers.ghosts);
      if (!show) { l.el.hidden = true; continue; }
      // 选离视口中心最近的副本
      let x = it.x; const dx = x - cx; x -= Math.round(dx / W) * W;
      let [px, py] = toScreen(x, it.y);
      if (it.art) py += it.art === 'isles' ? 34 * s + 6 : S * ART[it.art] * ART_DROP[it.art] + 3;
      const k = it.art ? 1 : it.ghost ? Math.max(lk, .95) : lk, w = l.w * k, h = l.h * k;
      const box = { x: px - w / 2, y: it.art ? py : py - h / 2, w, h };
      const off = box.x > vw || box.x + box.w < 0 || box.y > vh || box.y + box.h < 0;
      const hit = !off && placed.some(p => box.x < p.x + p.w + 4 && box.x + box.w + 4 > p.x && box.y < p.y + p.h && box.y + box.h > p.y);
      const vis = !off && (!hit || it === selected?.item);
      l.el.hidden = !vis;
      if (vis) { placed.push(box); l.el.style.transform = `translate(${Math.round(box.x)}px,${Math.round(box.y)}px) scale(${k.toFixed(3)})`; l.el.classList.toggle('active', it === selected?.item); }
    }
  }
  const pri = l => (l.it === selected?.item ? 100 : 0) + (l.it.art ? 50 : l.it.canon ? 20 + l.it.area / 4000 : l.it.area / 8000);

  /* ---------------- 卡片 ---------------- */
  const card = $('atlasCard');
  let peopleIndex = null, peopleLoading = null;
  function loadPeople() {
    if (peopleIndex) return Promise.resolve(peopleIndex);
    if (peopleLoading) return peopleLoading;
    peopleLoading = new Promise(res => {
      const done = () => {
        const idx = {}, G = window.GALLERY_DATA || [];
        for (const ideo of G) for (const c of (ideo.characters || [])) {
          const home = (c.info || []).find(i => i.k === '属地'); if (!home) continue;
          String(home.v).split('·').map(t => t.trim()).forEach(t => { const key = has(LOC, t) ? t : ALIAS[t]; if (key) (idx[key] = idx[key] || []).push({ c, ideo }); });
        }
        peopleIndex = idx; res(idx);
      };
      if (window.GALLERY_DATA) return done();
      const sc = document.createElement('script'); sc.src = card.dataset.galleryData; sc.onload = done; sc.onerror = () => { peopleIndex = {}; res(peopleIndex); }; document.head.appendChild(sc);
    });
    return peopleLoading;
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function coordText(x, y) { const lon = x / W * 360 - 180, lat = 90 - y / H * 180; return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`; }
  function anchorOf(name) { const seen = new Set(); let n = name; while (n && !seen.has(n)) { seen.add(n); if (itemByName.has(n)) return itemByName.get(n); n = LOC[n]?.parent; } return null; }
  function chainOf(name) { const out = [], seen = new Set(); let n = LOC[name]?.parent; while (n && !seen.has(n)) { seen.add(n); out.unshift(n); n = LOC[n]?.parent; } return out; }
  function openCard(name, it) {
    const d = LOC[name], exact = it && it.name === name;
    const color = it && it.state != null ? stateColor.get(it.state) : null;
    card.style.setProperty('--place', color || (it?.art === 'isles' ? '#b39ae6' : it?.art === 'peak' ? '#e0b860' : it?.art === 'city' ? '#9fbedf' : it?.art === 'academy' ? '#e7a99a' : '#cdb991'));
    $('acKind').textContent = d ? d.kind : '未设定地区';
    $('acCoord').textContent = exact ? coordText(it.x, it.y) : it ? '坐标未定 · 沿「' + it.name + '」定位' : '';
    $('acName').textContent = name;
    const chain = chainOf(name);
    $('acTrail').innerHTML = chain.length ? chain.map(n => `<button type="button" data-go="${esc(n)}">${esc(n)}</button>`).join('<i>›</i>') + `<i>›</i><span>${esc(name)}</span>` : '';
    $('acTrail').hidden = !chain.length;
    const media = $('acMedia');
    media.hidden = !(d && d.image);
    if (d && d.image) media.innerHTML = `<img src="${esc(d.image)}" alt="${esc(name)}" loading="lazy">`;
    const desc = d ? d.desc : '地图生成器划出的区域，还没有设定，也没有角色归属于此。';
    $('acDesc').innerHTML = String(desc).split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('');
    $('acDesc').classList.toggle('muted', !d);
    const kids = Object.keys(LOC).filter(n => LOC[n].parent === name);
    $('acChildren').hidden = !kids.length;
    $('acChildren').innerHTML = kids.length ? `<h3>下辖地点</h3><div class="atl-chips">${kids.map(n => `<button type="button" data-go="${esc(n)}"><b>${esc(n)}</b><small>${esc(LOC[n].kind)}</small></button>`).join('')}</div>` : '';
    const scene = $('acScene');
    scene.hidden = !(d && d.scene);
    if (d && d.scene) scene.innerHTML = `<h3>场景</h3><a class="atl-scene" href="${esc(d.scene)}">进入地点场景 →</a>`;
    $('acGlobe').hidden = !d;
    const ppl = $('acPeople'); ppl.hidden = !d; ppl.innerHTML = d ? '<h3>相关角色</h3><p class="atl-wait">正在查找…</p>' : '';
    if (d) loadPeople().then(idx => {
      if ($('acName').textContent !== name) return;
      const groups = [[name, idx[name] || []]];
      kids.forEach(k => { if (idx[k]?.length) groups.push([k, idx[k]]); });
      const total = groups.reduce((a, g) => a + g[1].length, 0);
      if (!total) { ppl.innerHTML = '<h3>相关角色</h3><p class="atl-wait">暂时没有角色以此地为属地。</p>'; return; }
      ppl.innerHTML = `<h3>相关角色 <small>${total}</small></h3>` + groups.filter(g => g[1].length).map(([g, list]) => (g !== name ? `<p class="atl-sub">${esc(g)}</p>` : '') + '<div class="atl-people">' + list.map(({ c, ideo }) => {
        const im = c.images && c.images[0], th = im ? (typeof im === 'string' ? im : im.thumb) : '';
        const role = ((c.info || []).find(i => i.k === '身份') || {}).v || ideo.name;
        return `<a href="gallery.html?cat=character&open=${encodeURIComponent(c.id)}" style="--ca:${esc(ideo.theme?.accent || '#b08a4a')}"><span class="av">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : esc(c.name.slice(0, 1))}</span><span class="nm"><b>${esc(c.name)}</b><small>${esc(ideo.name)} · ${esc(String(role).replace(/^[^·]*·\s*/, ''))}</small></span></a>`;
      }).join('') + '</div>').join('');
    });
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add('open'));
    stage.classList.add('card-open');
    card.scrollTop = 0;
  }
  function closeCard() { card.classList.remove('open'); stage.classList.remove('card-open'); setTimeout(() => { if (!card.classList.contains('open')) card.hidden = true; }, 260); }
  card.addEventListener('click', e => { const go = e.target.closest('[data-go]'); if (go) select(go.dataset.go, true, true); });
  $('acClose').onclick = () => clear(true);
  $('acGlobe').onclick = () => window.__mapView?.setMode('globe');
  $('acCopy').onclick = () => { const u = location.href; (navigator.clipboard?.writeText(u) || Promise.reject()).then(() => toast('已复制链接'), () => toast(u)); };
  $('acGrip').onclick = () => card.classList.toggle('full');
  function toast(t) { const el = $('atlasToast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 1800); }

  /* ---------------- 选择与飞行 ---------------- */
  function selectItem(it, emit, fly) { select(it.name, emit, fly, it); }
  function select(name, emit = false, fly = true, forced) {
    const it = forced || anchorOf(name);
    if (!it && !has(LOC, name)) return false;
    selected = { name, item: it, state: it ? it.state : null };
    openCard(name, it);
    if (it && fly) flyTo(it.x, it.y, Math.max(s, it.art ? 2.4 : clamp(1300 / Math.sqrt(it.area || 1e4), 1.3, 3.2)));
    invalidate();
    if (emit && has(LOC, name)) window.dispatchEvent(new CustomEvent('atlas:select', { detail: { name } }));
    if (emit && !has(LOC, name)) window.dispatchEvent(new CustomEvent('atlas:clear'));
    $('mapAnnouncement').textContent = '已选择：' + name;
    return true;
  }
  function clear(emit) { if (!selected && card.hidden) return; selected = null; closeCard(); invalidate(); if (emit) window.dispatchEvent(new CustomEvent('atlas:clear')); }
  function flyTo(x, y, ns) {
    const narrow = vw < 700, offX = card.hidden || narrow ? 0 : -Math.min(200, vw * .16), offY = narrow ? Math.min(vh * .22, 180) : 0;
    let tx = x; tx -= Math.round((tx - cx) / W) * W;
    ns = clamp(ns, minS, maxS);
    const to = { cx: tx - offX / ns, cy: y + offY / ns, s: ns };
    if (reduced) { cx = to.cx; cy = to.cy; s = to.s; clampView(); invalidate(); return; }
    flight = { from: { cx, cy, s }, to, t0: performance.now(), dur: 700 };
    invalidate();
  }

  /* ---------------- 交互 ---------------- */
  let raf = 0;
  function invalidate() { dirty = true; if (!raf) raf = requestAnimationFrame(tick); }
  function tick(t) {
    raf = 0;
    if (flight) {
      let k = Math.min(1, (t - flight.t0) / flight.dur); k = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const f = flight.from, to = flight.to;
      const ls = Math.log(f.s) + (Math.log(to.s) - Math.log(f.s)) * k;
      s = Math.exp(ls); cx = f.cx + (to.cx - f.cx) * k; cy = f.cy + (to.cy - f.cy) * k; clampView();
      if (k >= 1) flight = null; dirty = true;
    }
    if (dirty) { frame(); if (reduced || !fxRunning) drawFx(performance.now()); }
    if (flight) raf = requestAnimationFrame(tick);
  }
  function zoomAt(f, px, py) {
    flight = null;
    const [mx, my] = [(px - vw / 2) / s + cx, (py - vh / 2) / s + cy];
    const ns = clamp(s * f, minS, maxS);
    cx = mx - (px - vw / 2) / ns; cy = my - (py - vh / 2) / ns; s = ns; clampView(); invalidate();
  }
  stage.addEventListener('wheel', e => {
    if (e.target.closest('.atl-ui, .atl-card')) return;
    e.preventDefault(); const r = stage.getBoundingClientRect();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(-d * .0016), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const pts = new Map(); let drag = null, pinch = null, down = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.atl-ui, .atl-card, .atl-label')) return;
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); flight = null;
    if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY, cx, cy }; down = { x: e.clientX, y: e.clientY, t: performance.now() }; stage.classList.add('grabbing'); }
    else if (pts.size === 2) { drag = null; down = null; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s }; }
  });
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') hover(e.clientX - r.left, e.clientY - r.top); return; }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const ns = pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; zoomAt(ns / s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
    else if (drag) { cx = drag.cx - (e.clientX - drag.x) / s; cy = drag.cy - (e.clientY - drag.y) / s; clampView(); invalidate(); }
  });
  const endPtr = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (!pts.size) {
      stage.classList.remove('grabbing'); drag = null;
      if (down && e.type === 'pointerup' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) { const r = stage.getBoundingClientRect(); clickAt(e.clientX - r.left, e.clientY - r.top); }
      down = null;
    }
  };
  stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
  function itemAt(px, py) {
    const [mx, my] = toMap(px, py);
    for (const it of items) if (it.art) { const dx = ((mx - it.x + W * 1.5) % W) - W / 2; if (Math.hypot(dx, my - it.y) * s < (it.art === 'isles' ? 34 : 22)) return it; }
    const st = gridAt(STA, mx, my);
    const it = itemByState.get(st);
    if (it && (it.canon || layers.ghosts)) return it;
    return null;
  }
  function hover(px, py) {
    const [mx, my] = toMap(px, py);
    $('atlasCoord').textContent = my >= 0 && my <= H ? coordText(mx, my) : '';
    const it = itemAt(px, py), st = it ? it.state : null;
    stage.classList.toggle('pointing', !!it);
    if (st !== hoverState) { hoverState = st; invalidate(); }
  }
  stage.addEventListener('pointerleave', () => { if (hoverState != null) { hoverState = null; invalidate(); } });
  function clickAt(px, py) { const it = itemAt(px, py); if (it) selectItem(it, true, false); else clear(true); }
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select,[contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) { if (e.key === 'Escape' && e.target.id === 'atlasSearch') { e.target.blur(); hideSuggest(); } return; }
    const step = 80 / s;
    if (e.key === '+' || e.key === '=') zoomAt(1.4, vw / 2, vh / 2);
    else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.4, vw / 2, vh / 2);
    else if (e.key === 'ArrowLeft') { cx -= step; clampView(); invalidate(); }
    else if (e.key === 'ArrowRight') { cx += step; clampView(); invalidate(); }
    else if (e.key === 'ArrowUp') { cy -= step; clampView(); invalidate(); }
    else if (e.key === 'ArrowDown') { cy += step; clampView(); invalidate(); }
    else if (e.key === 'Escape') clear(true);
    else if (e.key === '/') { e.preventDefault(); $('atlasSearch').focus(); }
    else return;
    e.preventDefault();
  });
  $('zin').onclick = () => zoomAt(1.5, vw / 2, vh / 2);
  $('zout').onclick = () => zoomAt(1 / 1.5, vw / 2, vh / 2);
  $('zfit').onclick = () => { flight = null; home(); };
  function home() { s = clamp(vw < 700 ? vh / H * .72 : Math.min(vw / 2700, vh / H), minS, maxS); cx = 1466; cy = H / 2; clampView(); invalidate(); }

  /* ---------------- 搜索 ---------------- */
  const search = $('atlasSearch'), sug = $('atlasSuggest');
  const entries = [
    ...Object.keys(LOC).map(n => ({ name: n, label: n, kind: LOC[n].kind, canon: true })),
    ...Object.keys(ALIAS).filter(a => !has(LOC, a)).map(a => ({ name: ALIAS[a], label: a, kind: '即「' + ALIAS[a] + '」', canon: true })),
    ...items.filter(i => i.ghost).map(i => ({ name: i.name, label: i.name, kind: '未设定地区', canon: false }))
  ];
  let sugIdx = -1, sugList = [];
  function showSuggest() {
    const q = search.value.trim();
    sugList = (q ? entries.filter(e => e.label.includes(q) || (e.kind || '').includes(q)) : entries.filter(e => e.canon && !LOC[e.name]?.parent && e.label === e.name)).slice(0, 9);
    sugIdx = -1;
    sug.innerHTML = sugList.map((e, i) => `<li role="option" id="sg${i}" data-i="${i}"><b>${esc(e.label)}</b><small>${esc(e.kind || '')}</small></li>`).join('') || '<li class="none">没有找到这个地名</li>';
    sug.hidden = false; search.setAttribute('aria-expanded', 'true');
  }
  function hideSuggest() { sug.hidden = true; search.setAttribute('aria-expanded', 'false'); }
  function pick(e) { if (!e) return; hideSuggest(); search.value = ''; search.blur(); const it = itemByName.get(e.name); if (!e.canon && it) { if (!layers.ghosts) setLayer('ghosts', true); selectItem(it, true, true); } else select(e.name, true, true); }
  search.addEventListener('focus', showSuggest);
  search.addEventListener('input', showSuggest);
  search.addEventListener('blur', () => setTimeout(hideSuggest, 150));
  search.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sugIdx = clamp(sugIdx + (e.key === 'ArrowDown' ? 1 : -1), 0, sugList.length - 1); [...sug.children].forEach((li, i) => li.classList.toggle('on', i === sugIdx)); search.setAttribute('aria-activedescendant', 'sg' + sugIdx); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sugList[Math.max(0, sugIdx)]); }
  });
  sug.addEventListener('pointerdown', e => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(sugList[+li.dataset.i]); } });

  /* ---------------- 图层 ---------------- */
  const layerBtn = $('atlasLayersBtn'), layerPop = $('atlasLayers');
  layerBtn.onclick = e => { e.stopPropagation(); const open = layerPop.hidden; layerPop.hidden = !open; layerBtn.setAttribute('aria-expanded', String(open)); };
  document.addEventListener('pointerdown', e => { if (!layerPop.hidden && !e.target.closest('#atlasLayers, #atlasLayersBtn')) { layerPop.hidden = true; layerBtn.setAttribute('aria-expanded', 'false'); } });
  function setLayer(k, v) { layers[k] = v; const inp = layerPop.querySelector(`[data-layer="${k}"]`); if (inp) inp.checked = v; try { localStorage.setItem('pierteia-atlas-layers', JSON.stringify(layers)); } catch (e) { /* 忽略 */ } invalidate(); }
  layerPop.querySelectorAll('[data-layer]').forEach(inp => { inp.checked = !!layers[inp.dataset.layer]; inp.onchange = () => setLayer(inp.dataset.layer, inp.checked); });

  /* ---------------- 比例尺 ---------------- */
  function niceNum(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  function updateScale() {
    const kmPerPx = KM / s, km = niceNum(110 * kmPerPx), px = km / kmPerPx;
    $('scaleBar').style.width = Math.round(px) + 'px';
    $('scaleLabel').textContent = km.toLocaleString('zh-CN') + ' 公里';
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    resize(); buildSprites(); measureLabels(); home();
    stage.classList.add('ready');
    if (!reduced) startFx();
  }
  new ResizeObserver(() => { const pd = dpr; resize(); if (dpr !== pd) buildSprites(); invalidate(); }).observe(stage);
  window.__flatMap = {
    select(name, center = true) { if (!has(LOC, name)) return false; return select(name, false, center); },
    clear() { clear(false); },
    resize() { resize(); invalidate(); },
    bench(opts = {}) { // 调试：强制同步测一帧（含 GPU），可临时关掉某些图层比较
      const keep = { ...layers }; Object.assign(layers, opts.layers || {});
      glKey = ''; const t = performance.now(); frame(); ctx.getImageData(0, 0, 1, 1); const ms = performance.now() - t;
      Object.assign(layers, keep); return Math.round(ms);
    },
    stats: () => ({ perf: { ...perf }, scale: s, x: cx, y: cy, selected: selected?.name, layers: { ...layers }, webgl: !!gl, glyphs: glyphs.length, labels: labelEls.filter(l => !l.el.hidden).length })
  };
  (document.fonts?.ready || Promise.resolve()).then(() => { measureLabels(); invalidate(); });
  init();
})();
