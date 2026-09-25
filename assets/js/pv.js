/* 万道归墟 · 开篇 PV
   九个分镜，全部实时绘制；声音由 WebAudio 合成（点开 PV 时才启动）。 */
(function () {
  "use strict";
  var U = window.WDGX_util, D = window.WDGX;
  var box = document.getElementById("pv");
  if (!box || !U) return;
  var cv = document.getElementById("pvCanvas"), ctx = cv.getContext("2d");
  var capEl = document.getElementById("pvCap"), prog = document.getElementById("pvProg");
  var btnPlay = document.getElementById("pvPlay"), btnSound = document.getElementById("pvSound");
  var W, H, dpr, playing = false, time = 0, last = 0, raf, lastFocus = null;
  var TAU = Math.PI * 2;
  var BRUSH_FONT = '"Zhi Mang Xing", "STXingkai", "KaiTi", serif';
  var SERIF = '"Noto Serif SC", "Songti SC", serif';
  var SANS = '"Noto Sans SC", "PingFang SC", sans-serif';

  function rng(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ── 预生成 ── */
  var R = rng(99);
  var stars = []; for (var i = 0; i < 420; i++) stars.push([R(), R(), R() * 1.4 + 0.2, R() * 6.28]);
  var mist = []; for (i = 0; i < 260; i++) mist.push([R() * 2 - 1, R() * 2 - 1, R() * 6.28, R()]);
  var scaleWords = ["恒星系", "星团", "星系", "星系群", "星系团", "宇宙结构", "单体宇宙", "多元宇宙", "超多元宇宙", "无限多元宇宙", "无限盒子", "无限次方盒子", "无限阶指数塔", "无限阶无穷", "超越逻辑与数学"];
  var flyers = []; for (i = 0; i < 90; i++) flyers.push({ w: scaleWords[i % scaleWords.length], a: R() * 6.28, d: R(), z: R() });
  var glyphs = "剑火雷阵符龙凰风水土金木鼎镜轮命梦灭初源焉道法空时因果生死星天地仙魔".split("");
  var vort = []; for (i = 0; i < 380; i++) vort.push({ a: R() * 6.28, r: R(), g: glyphs[(R() * glyphs.length) | 0], k: R() < 0.22 });
  var branches = [];
  (function () {
    var r2 = rng(5);
    function g(x, y, ang, len, d, t0) {
      var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      branches.push([x, y, x2, y2, d, t0]);
      if (d > 7) return;
      g(x2, y2, ang - 0.3 - r2() * 0.35, len * (0.7 + r2() * 0.12), d + 1, t0 + 0.08);
      g(x2, y2, ang + 0.3 + r2() * 0.35, len * (0.7 + r2() * 0.12), d + 1, t0 + 0.08);
    }
    g(0, 0.52, -Math.PI / 2, 0.22, 0, 0);
  })();

  /* ── 分镜 ── */
  var scenes = [
    { d: 5.5, caps: [[0, "序章", "假期回家的路上，一辆泥头车刹车失灵。"]], draw: sHeadlights },
    { d: 6, caps: [[0.2, "星源天 · 第九天", "眼睛一睁一闭，何阳到了另一个世界。带着一个会封号的系统。"]], draw: sPanel },
    { d: 6, caps: [[0.1, "星源天", "漂浮在星海中的大陆。穿越者多得像批发，每人都带着自己的系统。"]], draw: sIsland },
    { d: 5.5, caps: [[0.15, "龙岩洞", "黑雾散尽，那张脸，和他一模一样。"]], draw: sMirror },
    { d: 7, caps: [[0.1, "天穹裂开", "“她们找的是我。”"], [0.55, "天穹裂开", "“每一份契约，只能与一个存在签订。”"]], draw: sRift },
    { d: 6.5, caps: [[0.08, "诸天万界", "多元宇宙、无限次方盒、无限阶指数塔……"], [0.6, "诸天万界", "一切计量单位与境界，都失去了意义。"]], draw: sScale },
    { d: 6.5, caps: [[0.15, "终焉纪", "无限延伸的时间树上，天帝终焉，古今第一人。"]], draw: sTree },
    { d: 7, caps: [[0.1, "归墟", "而造成这一切的幕后真凶，居然是……"], [0.62, "归墟", "何阳自己？"]], draw: sVortex },
    { d: 7, caps: [[0.45, "设定集", "一卷星源天，一棵时间树，一片混沌海"]], draw: sTitle }
  ];
  var TOTAL = scenes.reduce(function (s, x) { return s + x.d; }, 0);

  function sHeadlights(p, t) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    // 路面雨线
    ctx.strokeStyle = "rgba(141,154,162,.18)"; ctx.lineWidth = 1;
    for (var i = 0; i < 40; i++) {
      var x = (i * 97 % W), y = ((t * 900 + i * 131) % (H + 100)) - 50;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 30); ctx.stroke();
    }
    var k = Math.pow(p, 2.6), sep = W * (0.04 + k * 0.28), r = Math.max(W, H) * (0.02 + k * 0.6);
    [-1, 1].forEach(function (s) {
      var x = W / 2 + s * sep, y = H * 0.58;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,252,240,1)"); g.addColorStop(0.15, "rgba(255,240,200,.85)"); g.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    });
    if (p > 0.86) { ctx.fillStyle = "rgba(255,255,255," + ((p - 0.86) / 0.14) + ")"; ctx.fillRect(0, 0, W, H); }
  }
  function sPanel(p, t) {
    var a = clamp(1 - p * 4, 0, 1);
    ctx.fillStyle = "#05080B"; ctx.fillRect(0, 0, W, H);
    if (a > 0) { ctx.fillStyle = "rgba(255,255,255," + a + ")"; ctx.fillRect(0, 0, W, H); }
    var lines = D.panel.map(function (r) { return r[0] ? "【" + r[0] + "：" + r[1] + "】" : "【" + r[1] + "】"; });
    var fs = clamp(Math.min(W / 30, H / 30), 13, 24), lh = fs * 1.85, bx = W / 2 - fs * 11, by = H * 0.18;
    ctx.font = "500 " + fs + "px " + SANS; ctx.textBaseline = "top";
    ctx.strokeStyle = "rgba(127,185,203,.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(bx - fs, by - fs, fs * 24, lh * lines.length + fs * 1.4);
    lines.forEach(function (l, i) {
      var start = 0.12 + i * 0.1, q = clamp((p - start) / 0.12, 0, 1);
      var n = Math.floor(l.length * q); if (!n) return;
      var warn = i === lines.length - 1;
      var jitter = warn && p > 0.8 ? (Math.random() - 0.5) * 8 : 0;
      ctx.fillStyle = warn ? "#E08A7A" : "#C5DCE3";
      ctx.fillText(l.slice(0, n), bx + jitter, by + i * lh);
    });
    // 扫描线与故障切片
    ctx.fillStyle = "rgba(255,255,255,.025)";
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    if (p > 0.8 && Math.random() < 0.5) {
      var sy = Math.random() * H, sh = 10 + Math.random() * 40;
      ctx.drawImage(cv, 0, sy * dpr, W * dpr, sh * dpr, (Math.random() - 0.5) * 40, sy, W, sh);
    }
  }
  function drawStars(t, alpha, drift) {
    stars.forEach(function (s) {
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + s[3]));
      ctx.fillStyle = "rgba(215,226,229," + (tw * alpha) + ")";
      ctx.fillRect(((s[0] + drift) % 1) * W, s[1] * H, s[2], s[2]);
    });
  }
  function sIsland(p, t) {
    ctx.fillStyle = "#04060A"; ctx.fillRect(0, 0, W, H);
    drawStars(t, 0.9, p * 0.03);
    var s = Math.min(W, H) * (0.36 + p * 0.06), x = W / 2, y = H * 0.44 + Math.sin(t) * 6;
    // 星门
    for (var i = 0; i < 6; i++) {
      var an = i * 1.05 + t * 0.12, gx = x + Math.cos(an) * s * 1.35, gy = y + Math.sin(an) * s * 0.5;
      ctx.strokeStyle = "rgba(235,215,162,.7)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(gx, gy, s * 0.06, s * 0.08, 0.3, 0, TAU); ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(-s * 0.9, 0);
    for (i = 0; i <= 20; i++) { var u = i / 20; ctx.lineTo((-0.9 + 1.8 * u) * s, Math.pow(Math.sin(Math.PI * u), 1.4) * s * (0.6 + 0.12 * Math.sin(i * 2.7))); }
    ctx.closePath(); var gb = ctx.createLinearGradient(0, 0, 0, s * 0.8); gb.addColorStop(0, "#3A3F45"); gb.addColorStop(1, "#050608"); ctx.fillStyle = gb; ctx.fill();
    var gt = ctx.createRadialGradient(-s * 0.2, -s * 0.05, 0, 0, 0, s);
    gt.addColorStop(0, "#A9BBB0"); gt.addColorStop(0.7, "#566B60"); gt.addColorStop(1, "#24302B");
    ctx.fillStyle = gt; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.9, s * 0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(15,17,19,.8)";
    for (i = 0; i < 9; i++) { var px = (-0.7 + i * 0.17) * s, ph = s * (0.08 + (i * 37 % 10) / 60); ctx.beginPath(); ctx.moveTo(px - ph * 0.6, 0); ctx.lineTo(px, -ph); ctx.lineTo(px + ph * 0.6, 0); ctx.fill(); }
    ctx.restore();
    // 降临的穿越者：流星
    for (i = 0; i < 14; i++) {
      var q = ((t * 0.35 + i * 0.137) % 1), sx = W * ((i * 0.173) % 1), sy = q * H * 0.8;
      ctx.strokeStyle = "rgba(235,215,162," + (0.6 * (1 - q)) + ")"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 16, sy - 40); ctx.stroke();
    }
  }
  function sMirror(p, t) {
    ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, W, H);
    var fs = Math.min(W * 0.2, H * 0.34), gap = fs * (0.3 + ease(clamp(p * 1.5, 0, 1)) * 0.5);
    ctx.font = fs + "px " + BRUSH_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(230,227,218,.92)";
    ctx.fillText("何阳", W / 2 - gap - fs * 0.5, H * 0.45);
    ctx.save(); ctx.translate(W / 2 + gap + fs * 0.5, H * 0.45); ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(230,227,218," + (0.3 + p * 0.62) + ")"; ctx.fillText("何阳", 0, 0); ctx.restore();
    // 裂缝
    ctx.strokeStyle = "rgba(235,215,162,.8)"; ctx.lineWidth = 1.2; ctx.beginPath();
    var r2 = rng(3); ctx.moveTo(W / 2, 0);
    for (var y = 0; y <= H; y += H / 18) ctx.lineTo(W / 2 + (r2() - 0.5) * 24, y);
    ctx.stroke();
    // 黑雾消散
    mist.forEach(function (m) {
      var k = clamp(1 - p * 1.3, 0, 1);
      var x = W / 2 + gap + fs * 0.5 + m[0] * fs * (1.2 + p * 2), yy = H * 0.45 + m[1] * fs * (0.8 + p);
      ctx.fillStyle = "rgba(0,0,0," + (0.55 * k) + ")";
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 2 + m[2]) * 6, yy, fs * (0.05 + m[3] * 0.1), 0, TAU); ctx.fill();
    });
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
  function sRift(p, t) {
    ctx.fillStyle = "#06070B"; ctx.fillRect(0, 0, W, H);
    drawStars(t, 0.5, 0);
    var open = ease(clamp(p * 1.6, 0, 1)), cx = W / 2, cy = H * 0.42, rw = Math.min(W, H) * 0.42 * open, rh = rw * 0.62;
    // 洞口
    ctx.save(); ctx.beginPath();
    var r2 = rng(11);
    for (var i = 0; i <= 28; i++) { var a = i / 28 * TAU, rr = 1 + (r2() - 0.5) * 0.35; ctx.lineTo(cx + Math.cos(a) * rw * rr, cy + Math.sin(a) * rh * rr); }
    ctx.closePath(); ctx.fillStyle = "#000"; ctx.fill(); ctx.strokeStyle = "rgba(235,215,162,.8)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.clip();
    // 紫色星云
    for (i = 0; i < 160; i++) {
      var a2 = i * 2.4 + t * 0.4, d = (i / 160) * rw * 0.7;
      ctx.fillStyle = "rgba(150,90,200," + (0.25 + 0.2 * Math.sin(i + t * 3)) + ")";
      ctx.beginPath(); ctx.arc(cx + rw * 0.28 + Math.cos(a2) * d, cy + Math.sin(a2) * d * 0.6, 2 + (i % 5), 0, TAU); ctx.fill();
    }
    // 白色独眼三角体
    var tx = cx - rw * 0.3, ts = rh * 0.7;
    ctx.fillStyle = "rgba(240,238,230,.92)"; ctx.beginPath();
    ctx.moveTo(tx, cy - ts); ctx.lineTo(tx + ts * 0.9, cy + ts * 0.6); ctx.lineTo(tx - ts * 0.9, cy + ts * 0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(6,7,11,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx - ts * 0.35, cy + ts * 0.25); ctx.lineTo(tx - ts * 0.1, cy + ts * 0.6); ctx.moveTo(tx + ts * 0.3, cy - ts * 0.3); ctx.lineTo(tx + ts * 0.45, cy - ts * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(tx, cy + ts * 0.05, ts * 0.22, ts * 0.12, 0, 0, TAU); ctx.fillStyle = "#15171A"; ctx.fill();
    ctx.beginPath(); ctx.arc(tx + Math.sin(t * 2) * ts * 0.06, cy + ts * 0.05, ts * 0.07, 0, TAU); ctx.fillStyle = "#EBD7A2"; ctx.fill();
    // 碰撞
    if (Math.sin(t * 5) > 0.7) { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(cx - 4, cy - rh, 8, rh * 2); }
    ctx.restore();
    // 所有系统升空
    for (i = 0; i < 60; i++) {
      var q = clamp(p * 1.6 - (i % 20) * 0.02, 0, 1), sx = (i * 0.61 % 1) * W, sy = H - q * (H - cy - rh);
      ctx.fillStyle = "rgba(127,185,203," + (0.8 * (1 - q * 0.6)) + ")"; ctx.fillRect(sx, sy, 2, 2);
    }
  }
  function sScale(p, t) {
    ctx.fillStyle = "#020203"; ctx.fillRect(0, 0, W, H);
    var speed = 0.2 + Math.pow(p, 2.4) * 3.5;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    flyers.forEach(function (f) {
      f.z -= speed * 0.012; if (f.z <= 0.02) { f.z = 1; f.a = Math.random() * 6.28; }
      var k = 1 / f.z, x = W / 2 + Math.cos(f.a) * f.d * W * 0.12 * k, y = H / 2 + Math.sin(f.a) * f.d * H * 0.12 * k;
      var fs = clamp(8 * k, 6, 90), al = clamp((1 - f.z) * 1.3, 0, 1);
      ctx.font = "600 " + fs + "px " + SERIF; ctx.fillStyle = "rgba(235,215,162," + al + ")";
      ctx.fillText(f.w, x, y);
    });
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    if (p > 0.82) { ctx.fillStyle = "rgba(255,250,235," + ((p - 0.82) / 0.18) + ")"; ctx.fillRect(0, 0, W, H); }
  }
  function sTree(p, t) {
    ctx.fillStyle = "#030304"; ctx.fillRect(0, 0, W, H);
    var a0 = clamp(1 - p * 5, 0, 1); if (a0) { ctx.fillStyle = "rgba(255,250,235," + a0 + ")"; ctx.fillRect(0, 0, W, H); }
    var s = Math.min(W, H) * 1.05, ox = W / 2, oy = H * 0.5;
    ctx.lineCap = "round";
    branches.forEach(function (b) {
      var q = clamp((p * 1.4 - b[5]) / 0.1, 0, 1); if (!q) return;
      ctx.strokeStyle = "rgba(235,215,162," + (0.9 - b[4] * 0.08) + ")"; ctx.lineWidth = Math.max(0.6, 5 - b[4] * 0.6);
      ctx.beginPath(); ctx.moveTo(ox + b[0] * s, oy + b[1] * s); ctx.lineTo(ox + (b[0] + (b[2] - b[0]) * q) * s, oy + (b[1] + (b[3] - b[1]) * q) * s); ctx.stroke();
      if (b[4] === 8 && q === 1) { ctx.fillStyle = "rgba(255,246,220," + (0.5 + 0.5 * Math.sin(t * 3 + b[0] * 50)) + ")"; ctx.fillRect(ox + b[2] * s - 1, oy + b[3] * s - 1, 2.4, 2.4); }
    });
    var g = ctx.createRadialGradient(ox, oy + 0.52 * s, 0, ox, oy + 0.52 * s, s * 0.12);
    g.addColorStop(0, "rgba(255,248,230,.95)"); g.addColorStop(1, "rgba(255,248,230,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy + 0.52 * s, s * 0.12, 0, TAU); ctx.fill();
  }
  function sVortex(p, t) {
    ctx.fillStyle = "rgba(3,3,4,.3)"; ctx.fillRect(0, 0, W, H);
    var cx = W / 2, cy = H * 0.45, Rm = Math.hypot(W, H) * 0.55;
    ctx.globalCompositeOperation = "lighter"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    vort.forEach(function (v) {
      var r = v.r * Rm;
      v.a += 0.9 / Math.pow(Math.max(r, 30), 0.7) * (1 + p);
      v.r -= (0.002 + 0.02 / (v.r * 40 + 1)) * (1 + p * 2);
      if (v.r < 0.03) { v.r = 0.9 + Math.random() * 0.2; }
      var x = cx + Math.cos(v.a) * r, y = cy + Math.sin(v.a) * r * 0.6, al = clamp((1 - v.r) * 1.5, 0, 1);
      if (v.k) { ctx.font = (10 + v.r * 22) + "px " + BRUSH_FONT; ctx.fillStyle = "rgba(235,215,162," + al * 0.9 + ")"; ctx.fillText(v.g, x, y); }
      else { ctx.fillStyle = "rgba(201,164,91," + al * 0.8 + ")"; ctx.fillRect(x, y, 1.4, 1.4); }
    });
    ctx.globalCompositeOperation = "source-over"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.6);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 100); g.addColorStop(0, "#000"); g.addColorStop(0.6, "rgba(0,0,0,.95)"); g.addColorStop(0.75, "rgba(235,215,162,.25)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 100, 0, TAU); ctx.fill(); ctx.restore();
    if (p > 0.62) { var k = (p - 0.62) / 0.38; ctx.fillStyle = "rgba(165,52,43," + (0.18 * Math.sin(k * Math.PI)) + ")"; ctx.fillRect(0, 0, W, H); }
  }
  function sTitle(p, t) {
    ctx.fillStyle = "#030304"; ctx.fillRect(0, 0, W, H);
    drawStars(t, 0.35 * p, 0);
    var fs = Math.min(W * 0.2, H * 0.3), q = ease(clamp(p * 1.4, 0, 1));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.save();
    ctx.shadowColor = "rgba(201,164,91,.55)"; ctx.shadowBlur = 40 * q;
    ctx.font = fs + "px " + BRUSH_FONT;
    var chars = D.book.title.split("");
    chars.forEach(function (c, i) {
      var qi = clamp(p * 2.2 - i * 0.18, 0, 1);
      ctx.globalAlpha = qi; ctx.fillStyle = "#EBD7A2";
      ctx.filter = "blur(" + ((1 - qi) * 12).toFixed(1) + "px)";
      ctx.fillText(c, W / 2 + (i - (chars.length - 1) / 2) * fs * 0.95, H * 0.42 + (1 - qi) * -20);
    });
    ctx.restore(); ctx.filter = "none"; ctx.globalAlpha = 1;
    // 印
    if (p > 0.5) {
      var k = ease(clamp((p - 0.5) / 0.2, 0, 1)), ss = fs * 0.34, sx = W / 2 + fs * 2.1, sy = H * 0.42 + fs * 0.5;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.07); ctx.scale(1.6 - k * 0.6, 1.6 - k * 0.6); ctx.globalAlpha = k;
      ctx.fillStyle = "#A5342B"; ctx.fillRect(-ss / 2, -ss / 2, ss, ss);
      ctx.strokeStyle = "#F3E3DC"; ctx.lineWidth = 2; ctx.strokeRect(-ss / 2 + 4, -ss / 2 + 4, ss - 8, ss - 8);
      ctx.fillStyle = "#F3E3DC"; ctx.font = "900 " + (ss * 0.34) + "px " + SERIF;
      ctx.fillText("何阳", 0, 0); ctx.restore();
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  /* ── 声音 ── */
  var AC = null, master = null, soundOn = true, drone = [];
  function audioInit() {
    if (AC) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination);
      var lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.connect(master);
      [55, 82.41, 110.3].forEach(function (f, i) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.type = i === 2 ? "sine" : "triangle"; o.frequency.value = f; o.detune.value = (i - 1) * 6;
        g.gain.value = i === 2 ? 0.05 : 0.14; o.connect(g); g.connect(lp); o.start(); drone.push(o);
      });
    } catch (e) { AC = null; }
  }
  function fadeMaster(v) { if (AC && master) master.gain.setTargetAtTime(soundOn ? v : 0, AC.currentTime, 0.4); }
  function bell(freq, dur, vol) {
    if (!AC || !soundOn) return;
    var t = AC.currentTime;
    [1, 2.76, 5.4].forEach(function (m, i) {
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = "sine"; o.frequency.value = freq * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol / (i + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (i + 1));
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur);
    });
  }
  function whoosh(dur) {
    if (!AC || !soundOn) return;
    var t = AC.currentTime, n = AC.sampleRate * dur, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(i / n, 2);
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(4000, t + dur);
    g.gain.value = 0.25; src.connect(f); f.connect(g); g.connect(AC.destination); src.start(t);
  }
  var cues = { 0: function () { whoosh(5.2); }, 1: function () { bell(660, 3, 0.18); }, 2: function () { bell(440, 4, 0.12); }, 3: function () { bell(311, 3, 0.14); },
    4: function () { bell(220, 5, 0.16); }, 5: function () { whoosh(6); }, 6: function () { bell(523, 5, 0.14); }, 7: function () { bell(196, 6, 0.16); }, 8: function () { bell(392, 6, 0.2); bell(587, 6, 0.1); } };

  /* ── 播放控制 ── */
  var curScene = -1, capKey = "";
  function sceneAt(tt) {
    var acc = 0;
    for (var i = 0; i < scenes.length; i++) { if (tt < acc + scenes[i].d) return [i, (tt - acc) / scenes[i].d]; acc += scenes[i].d; }
    return [scenes.length - 1, 1];
  }
  function render(tt) {
    var sp = sceneAt(tt), sc = scenes[sp[0]];
    if (sp[0] !== curScene) { curScene = sp[0]; if (playing && cues[curScene]) cues[curScene](); }
    sc.draw(sp[1], tt);
    var cap = null;
    sc.caps.forEach(function (c) { if (sp[1] >= c[0]) cap = c; });
    var key = cap ? sp[0] + ":" + cap[2] : "";
    if (key !== capKey) {
      capKey = key;
      capEl.innerHTML = cap ? '<small class="in">' + cap[1] + '</small><p class="in">' + cap[2] + "</p>" : "";
    }
    prog.style.width = (tt / TOTAL * 100).toFixed(2) + "%";
  }
  function loop(now) {
    if (!playing) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    time += dt;
    if (time >= TOTAL) { time = TOTAL - 0.001; render(time); pause(); btnPlay.textContent = "重播"; return; }
    render(time);
    raf = requestAnimationFrame(loop);
  }
  function play() {
    if (time >= TOTAL - 0.01) { time = 0; curScene = -1; }
    playing = true; btnPlay.textContent = "暂停"; last = performance.now();
    audioInit(); if (AC && AC.state === "suspended") AC.resume(); fadeMaster(0.5);
    raf = requestAnimationFrame(loop);
  }
  function pause() { playing = false; cancelAnimationFrame(raf); btnPlay.textContent = "继续"; fadeMaster(0); }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function open() {
    lastFocus = document.activeElement;
    box.hidden = false; document.documentElement.style.overflow = "hidden";
    resize(); time = 0; curScene = -1; capKey = "";
    var go = function () { play(); document.getElementById("pvClose").focus(); };
    if (document.fonts && document.fonts.load) {
      Promise.race([Promise.all([document.fonts.load("40px 'Zhi Mang Xing'", "万道归墟何阳剑火"), document.fonts.load("600 20px 'Noto Serif SC'", "恒星系")]), new Promise(function (r) { setTimeout(r, 1200); })]).then(go, go);
    } else go();
  }
  function close() {
    pause(); box.hidden = true; document.documentElement.style.overflow = "";
    if (AC) { try { AC.close(); } catch (e) {} AC = null; drone = []; }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) { if (e.target.closest("[data-pv]")) { e.preventDefault(); open(); } });
  document.getElementById("pvClose").addEventListener("click", close);
  btnPlay.addEventListener("click", function () { playing ? pause() : play(); });
  document.getElementById("pvReplay").addEventListener("click", function () { time = 0; curScene = -1; capKey = ""; if (!playing) play(); });
  btnSound.addEventListener("click", function () {
    soundOn = !soundOn; btnSound.textContent = soundOn ? "声音 开" : "声音 关";
    if (soundOn) { audioInit(); if (AC && AC.state === "suspended") AC.resume(); }
    fadeMaster(playing ? 0.5 : 0);
  });
  document.querySelector(".pv-prog").addEventListener("click", function (e) {
    var r = this.getBoundingClientRect(); time = clamp((e.clientX - r.left) / r.width, 0, 1) * TOTAL; curScene = sceneAt(time)[0]; render(time);
  });
  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === " " && e.target === document.body) { e.preventDefault(); playing ? pause() : play(); }
  });
  window.addEventListener("resize", function () { if (!box.hidden) { resize(); render(time); } });
})();
