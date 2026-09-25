/* 世界层界 · 滚动运镜
   画布固定在视口里，往下滚动时镜头一路后退：
   星源天 → 无疆界 → 诸天万界 → 时间树 → 混沌海。
   每一层画在上一层的某个位置，尺寸是上一层的六分之一。 */
(function () {
  "use strict";
  var D = window.WDGX, U = window.WDGX_util;
  var sec = document.getElementById("world");
  if (!sec || !D) return;
  var stage = sec.querySelector(".stick");
  var cv = stage.querySelector("canvas"), ctx = cv.getContext("2d");
  var elName = document.getElementById("wName"), elEn = document.getElementById("wEn"), elScale = document.getElementById("wScale"), elDesc = document.getElementById("wDesc"), elIdx = document.getElementById("wIdx");
  var ticks = Array.prototype.slice.call(sec.querySelectorAll(".w-tick"));
  var mobile = window.matchMedia("(max-width: 760px)").matches;

  var RATIO = 6, TAU = Math.PI * 2;
  var W, H, dpr, R0, FX, FY, z = 0, zTarget = 0, run = false, raf, t0 = performance.now(), lastLabel = -1;

  var seed = 20240917;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  /* ── 贴图：光斑、气泡、雾 ── */
  function sprite(size, stops) {
    var c = document.createElement("canvas"); c.width = c.height = size;
    var g = c.getContext("2d"), gr = g.createRadialGradient(size * 0.42, size * 0.4, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }
  var SP_GLOW = sprite(64, [[0, "rgba(255,246,220,1)"], [0.25, "rgba(235,215,162,.5)"], [1, "rgba(235,215,162,0)"]]);
  var SP_BUB = sprite(96, [[0, "rgba(215,226,229,.32)"], [0.72, "rgba(45,91,116,.14)"], [0.93, "rgba(215,226,229,.42)"], [1, "rgba(215,226,229,0)"]]);
  var SP_DROP = sprite(96, [[0, "rgba(235,242,245,.55)"], [0.6, "rgba(90,130,150,.16)"], [0.9, "rgba(235,215,162,.35)"], [1, "rgba(235,215,162,0)"]]);
  var SP_BLUE = sprite(128, [[0, "rgba(127,185,203,.5)"], [1, "rgba(127,185,203,0)"]]);
  var NEB = (function () {
    var c = document.createElement("canvas"), n = 256; c.width = c.height = n;
    var g = c.getContext("2d");
    for (var i = 0; i < 70; i++) {
      var x = n / 2 + (rnd() - 0.5) * n * 0.6, y = n / 2 + (rnd() - 0.5) * n * 0.6, r = 20 + rnd() * 70;
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,.07)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }
    return c;
  })();

  var ANCHOR = [[0.78, 0.3], [-0.5, 0.44], null, [0.05, 0.03]];

  /* ── 预生成 ── */
  var stars = [[], [], []];
  for (var i = 0; i < 420; i++) stars[i % 3].push([rnd(), rnd(), rnd() * 1.1 + 0.3, rnd() * 6.28]);
  var gates = []; for (i = 0; i < 8; i++) gates.push([rnd() * 6.28, 1.2 + rnd() * 0.55, 0.045 + rnd() * 0.05, (rnd() - 0.5) * 0.3]);
  var peaks = []; for (i = 0; i < 16; i++) peaks.push([-0.75 + rnd() * 1.5, rnd(), 0.05 + rnd() * 0.09]);
  var rocks = []; for (i = 0; i <= 30; i++) rocks.push(rnd());
  var palaces = []; for (i = 0; i < 70; i++) { var a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.86; palaces.push([Math.cos(a) * r, Math.sin(a) * r * 0.4, rnd()]); }
  var clouds = []; for (i = 0; i < 26; i++) { a = rnd() * 6.28; r = 0.25 + rnd() * 0.75; clouds.push([Math.cos(a) * r, Math.sin(a) * r * 0.4, 0.2 + rnd() * 0.35, rnd()]); }

  function branchPt(u) { return [-1.2 + 2.4 * u, 0.55 - 1.0 * u + Math.sin(u * 3.2) * 0.18]; }
  var bubbles = [];
  for (i = 0; i < 90; i++) { var u = rnd(), bp = branchPt(u), off = (rnd() - 0.5) * 0.55; bubbles.push([bp[0] + off * 0.4, bp[1] + off, 0.018 + Math.pow(rnd(), 2.4) * 0.14, rnd()]); }

  var twigs = [];
  function grow(x, y, ang, len, w, depth) {
    var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    var mx = (x + x2) / 2 + Math.cos(ang + 1.57) * len * 0.12 * (rnd() - 0.5), my = (y + y2) / 2 + Math.sin(ang + 1.57) * len * 0.12 * (rnd() - 0.5);
    twigs.push({ x: x, y: y, mx: mx, my: my, x2: x2, y2: y2, w: w, d: depth });
    if (depth >= 5) return;
    var n = depth < 2 ? 2 : (rnd() < 0.7 ? 2 : 1);
    for (var k = 0; k < n; k++) grow(x2, y2, ang + (k === 0 ? -1 : 1) * (0.35 + rnd() * 0.45), len * (0.55 + rnd() * 0.2), w * 0.62, depth + 1);
  }
  var trunk = [];
  (function () {
    var x = -1.05, y = 0.9, ang = -0.62;
    for (var s = 0; s < 15; s++) {
      var nx = x + Math.cos(ang) * 0.23, ny = y + Math.sin(ang) * 0.23;
      trunk.push([x, y, nx, ny]);
      if (s % 2 === 1 && s < 12) grow(nx, ny, ang + (s % 4 === 1 ? -0.9 : 0.85), 0.34, 0.012, 1);
      x = nx; y = ny; ang += (rnd() - 0.5) * 0.2;
    }
  })();
  var chosen = twigs.filter(function (t) { return t.d === 2 && t.x2 > -0.2 && t.x2 < 0.5 && t.y2 > -0.5 && t.y2 < 0.5; })[0] || twigs[3];
  ANCHOR[2] = [chosen.mx, chosen.my];

  var drops = [];
  for (i = 0; i < (mobile ? 150 : 240); i++) drops.push([(rnd() - 0.5) * 3.4, (rnd() - 0.5) * 2.4, 0.004 + Math.pow(rnd(), 3) * 0.055, rnd()]);

  var size = [], cen = [];
  cen[4] = [0, 0]; size[4] = 1;
  for (var k = 3; k >= 0; k--) { size[k] = size[k + 1] / RATIO; cen[k] = [cen[k + 1][0] + ANCHOR[k][0] * size[k + 1], cen[k + 1][1] + ANCHOR[k][1] * size[k + 1]]; }
  function camera(zz) {
    var k = Math.min(3, Math.floor(zz)), t = zz - k;
    var f = 1 - t * Math.pow(RATIO, t) / RATIO;
    return { C: [cen[k + 1][0] + (cen[k][0] - cen[k + 1][0]) * f, cen[k + 1][1] + (cen[k][1] - cen[k + 1][1]) * f], Z: R0 * Math.pow(RATIO, 4 - zz) };
  }

  /* ── 各层 ── */
  function L0(x, y, R, a, t) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + Math.sin(t / 1800) * R * 0.025);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a * 0.45; ctx.drawImage(SP_BLUE, -R * 1.6, -R * 1.1, R * 3.2, R * 2.2); ctx.globalAlpha = a;
    ctx.globalCompositeOperation = "source-over";
    gates.forEach(function (g, j) {
      var ang = g[0] + t / 9000 * (0.5 + g[3]), gx = Math.cos(ang) * R * g[1], gy = Math.sin(ang) * R * g[1] * 0.42;
      var rr = R * g[2];
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(SP_BLUE, gx - rr * 2, gy - rr * 2, rr * 4, rr * 4);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(235,215,162,.85)"; ctx.lineWidth = Math.max(0.7, R * 0.006);
      ctx.beginPath(); ctx.ellipse(gx, gy, rr, rr * 1.35, 0.3, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "rgba(235,215,162,.3)"; ctx.beginPath(); ctx.ellipse(gx, gy, rr * 1.3, rr * 1.7, 0.3 + t / 3000 + j, 0.4, 2.6); ctx.stroke();
    });
    // 岛底岩层
    ctx.beginPath(); ctx.moveTo(-0.92 * R, 0);
    for (var i = 0; i <= 30; i++) { var u = i / 30; ctx.lineTo((-0.92 + 1.84 * u) * R, Math.pow(Math.sin(Math.PI * u), 1.35) * (0.55 + rocks[i] * 0.3) * R); }
    ctx.closePath();
    var gb = ctx.createLinearGradient(0, 0, 0, R * 0.9); gb.addColorStop(0, "#4A5058"); gb.addColorStop(0.35, "#23272C"); gb.addColorStop(1, "#08090B");
    ctx.fillStyle = gb; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = Math.max(0.5, R * 0.004);
    for (i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo((-0.8 + i * 0.18) * R, R * 0.04); ctx.lineTo((-0.8 + i * 0.18 + (rocks[i] - 0.5) * 0.1) * R, R * (0.25 + rocks[i + 9] * 0.45)); ctx.stroke(); }
    // 瀑布
    [-0.64, -0.12, 0.46].forEach(function (fx, j) {
      var gw = ctx.createLinearGradient(0, R * 0.05, 0, R * 1.2);
      gw.addColorStop(0, "rgba(215,226,229,.6)"); gw.addColorStop(1, "rgba(215,226,229,0)");
      ctx.strokeStyle = gw; ctx.lineWidth = Math.max(0.8, R * 0.012);
      ctx.beginPath(); ctx.moveTo(fx * R, R * 0.04);
      ctx.quadraticCurveTo(fx * R + Math.sin(t / 900 + j) * R * 0.02, R * 0.6, fx * R + R * 0.02, R * (1.05 + j * 0.1)); ctx.stroke();
    });
    // 岛面
    var gt = ctx.createRadialGradient(-R * 0.25, -R * 0.08, 0, 0, 0, R);
    gt.addColorStop(0, "#B7C8BC"); gt.addColorStop(0.55, "#6C8577"); gt.addColorStop(1, "#2A3832");
    ctx.fillStyle = gt; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.92, R * 0.23, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(235,215,162,.35)"; ctx.lineWidth = Math.max(0.5, R * 0.004); ctx.stroke();
    // 山峦：水墨三角 + 留白
    peaks.slice().sort(function (p, q) { return p[1] - q[1]; }).forEach(function (pk) {
      var px = pk[0] * R, base = (pk[1] - 0.5) * R * 0.2, h = pk[2] * R * 2.4, w = pk[2] * R;
      var gp = ctx.createLinearGradient(0, base - h, 0, base);
      gp.addColorStop(0, "rgba(14,16,18,.95)"); gp.addColorStop(1, "rgba(60,72,66,.25)");
      ctx.fillStyle = gp; ctx.beginPath(); ctx.moveTo(px - w, base); ctx.quadraticCurveTo(px - w * 0.2, base - h * 0.7, px, base - h); ctx.quadraticCurveTo(px + w * 0.3, base - h * 0.6, px + w, base); ctx.fill();
    });
    ctx.restore();
  }
  function L1(x, y, R, a, t) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    ctx.save(); ctx.scale(1, 0.42);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, "rgba(255,244,214,.5)"); g.addColorStop(0.35, "rgba(235,215,162,.22)"); g.addColorStop(0.75, "rgba(120,140,160,.12)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    clouds.forEach(function (c) {
      var s = c[2] * R, ang = t / 60000 * (0.5 + c[3]);
      var cx = c[0] * Math.cos(ang) * R - c[1] * Math.sin(ang) * R * 0.2, cy = c[1] * R;
      ctx.globalAlpha = a * 0.22; ctx.drawImage(NEB, cx - s, cy - s * 0.4, s * 2, s * 0.8);
    });
    ctx.globalAlpha = a;
    for (var i = 0; i < 7; i++) {
      ctx.strokeStyle = "rgba(235,215,162," + (0.06 + i * 0.025) + ")"; ctx.lineWidth = Math.max(0.5, R * 0.003);
      ctx.beginPath(); ctx.ellipse(0, 0, R * (0.25 + i * 0.11), R * (0.25 + i * 0.11) * 0.42, 0, t / (20000 + i * 4000), t / (20000 + i * 4000) + 4.6); ctx.stroke();
    }
    palaces.forEach(function (p) {
      var tw = 0.5 + 0.5 * Math.sin(t / 700 + p[2] * 20), s = Math.max(2, R * 0.02) * (0.6 + tw * 0.6);
      ctx.drawImage(SP_GLOW, p[0] * R - s, p[1] * R - s, s * 2, s * 2);
    });
    ctx.restore();
  }
  function L2(x, y, R, a, t) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * 0.35;
    ctx.drawImage(NEB, -R * 1.4, -R * 1.0, R * 2.8, R * 2.0); ctx.globalAlpha = a;
    [[Math.max(6, R * 0.12), "rgba(201,164,91,.08)"], [Math.max(3, R * 0.05), "rgba(201,164,91,.18)"], [Math.max(1, R * 0.012), "rgba(255,240,205,.95)"]].forEach(function (pass) {
      ctx.strokeStyle = pass[1]; ctx.lineWidth = pass[0]; ctx.beginPath();
      for (var i = 0; i <= 48; i++) { var b = branchPt(i / 48); if (i) ctx.lineTo(b[0] * R, b[1] * R); else ctx.moveTo(b[0] * R, b[1] * R); }
      ctx.stroke();
    });
    bubbles.forEach(function (b) {
      var r = b[2] * R * (0.92 + 0.08 * Math.sin(t / 1100 + b[3] * 30));
      ctx.drawImage(SP_BUB, b[0] * R - r, b[1] * R - r, r * 2, r * 2);
    });
    ctx.restore();
  }
  function L3(x, y, R, a, t) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    var s = R * 0.5; ctx.drawImage(SP_GLOW, -1.05 * R - s, 0.9 * R - s, s * 2, s * 2);
    trunk.forEach(function (sg, i) {
      ctx.strokeStyle = "rgba(201,164,91,.12)"; ctx.lineWidth = Math.max(4, R * 0.07);
      ctx.beginPath(); ctx.moveTo(sg[0] * R, sg[1] * R); ctx.lineTo(sg[2] * R, sg[3] * R); ctx.stroke();
      ctx.strokeStyle = "rgba(255,238,200," + (0.95 - i * 0.045) + ")"; ctx.lineWidth = Math.max(1, R * (0.026 - i * 0.0013));
      ctx.beginPath(); ctx.moveTo(sg[0] * R, sg[1] * R); ctx.lineTo(sg[2] * R, sg[3] * R); ctx.stroke();
    });
    twigs.forEach(function (w) {
      var hl = w === chosen;
      ctx.strokeStyle = hl ? "rgba(255,200,180,1)" : "rgba(201,164,91," + (0.85 - w.d * 0.12) + ")";
      ctx.lineWidth = Math.max(0.5, R * w.w * (hl ? 1.8 : 1));
      ctx.beginPath(); ctx.moveTo(w.x * R, w.y * R); ctx.quadraticCurveTo(w.mx * R, w.my * R, w.x2 * R, w.y2 * R); ctx.stroke();
      if (w.d >= 4) { var q = Math.max(1.5, R * 0.012); ctx.drawImage(SP_GLOW, w.x2 * R - q, w.y2 * R - q, q * 2, q * 2); }
    });
    ctx.restore();
  }
  function L4(x, y, R, a, t) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    for (var i = 0; i < 18; i++) {
      var yy = (-1 + i * 0.12) * R;
      ctx.strokeStyle = "rgba(141,154,162," + (0.04 + (i / 18) * 0.1) + ")"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var k = 0; k <= 50; k++) { var xx = (-1.8 + 3.6 * k / 50) * R, w = Math.sin(k * 0.35 + t / 1400 + i) * R * 0.012 * (1 + i * 0.12); if (k) ctx.lineTo(xx, yy + w); else ctx.moveTo(xx, yy + w); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    drops.forEach(function (d) {
      var r = Math.max(1.2, d[2] * R) * (0.9 + 0.1 * Math.sin(t / 1100 + d[3] * 40));
      ctx.drawImage(SP_DROP, d[0] * R - r, d[1] * R - r, r * 2, r * 2);
    });
    ctx.restore();
  }
  var DRAW = [L0, L1, L2, L3, L4];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = stage.clientWidth; H = stage.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mobile = W < 760;
    R0 = Math.min(W, H) * (mobile ? 0.34 : 0.3);
    FX = mobile ? W * 0.5 : W * 0.62; FY = mobile ? H * 0.38 : H * 0.5;
  }

  function progress() {
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - window.innerHeight;
    return Math.max(0, Math.min(1, -r.top / Math.max(1, span)));
  }
  function zFromP(p) {
    var x = p * 4.4 - 0.2; // 首尾各留一段停顿
    x = Math.max(0, Math.min(4, x));
    var k = Math.min(3, Math.floor(x)), t = x - k;
    return Math.min(4, k + smooth((t - 0.3) / 0.55));
  }

  function frame(now) {
    var t = now - t0;
    zTarget = zFromP(progress());
    z += (zTarget - z) * (U.reduced ? 1 : 0.14);
    if (Math.abs(zTarget - z) < 0.0004) z = zTarget;
    ctx.fillStyle = "#040508"; ctx.fillRect(0, 0, W, H);
    // 三层星空视差
    for (var l = 0; l < 3; l++) {
      var drift = z * (0.01 + l * 0.02);
      stars[l].forEach(function (s) {
        var tw = 0.35 + 0.65 * Math.abs(Math.sin(t / (1400 + l * 500) + s[3]));
        ctx.fillStyle = "rgba(215,226,229," + (tw * (0.25 + l * 0.2)) + ")";
        ctx.fillRect(((s[0] + drift) % 1) * W, ((s[1] + drift * 0.3) % 1) * H, s[2] + l * 0.3, s[2] + l * 0.3);
      });
    }
    var cam = camera(z);
    for (var k = 4; k >= 0; k--) {
      var R = size[k] * cam.Z;
      if (R < 2 || R > R0 * 60) continue;
      var s = R / R0, a = s >= 1 ? Math.max(0.1, 1 - (s - 1.2) / 4) : Math.min(1, (R - 2) / 30);
      if (a <= 0) continue;
      DRAW[k](FX + (cen[k][0] - cam.C[0]) * cam.Z, FY + (cen[k][1] - cam.C[1]) * cam.Z, R, Math.min(1, a), t);
    }
    var near = Math.round(z);
    if (near !== lastLabel) { lastLabel = near; label(near); }
    if (run) raf = requestAnimationFrame(frame);
  }

  function label(k) {
    var w = D.world[k];
    var box = elName.parentNode;
    box.classList.remove("in"); void box.offsetWidth;
    elName.textContent = w.name; elEn.textContent = w.en; elScale.textContent = w.scale; elDesc.textContent = w.text;
    elIdx.textContent = ["壹", "贰", "叁", "肆", "伍"][k];
    box.classList.add("in");
    ticks.forEach(function (b, i) { b.classList.toggle("on", i === k); });
  }
  ticks.forEach(function (b, i) {
    b.addEventListener("click", function () {
      var span = sec.offsetHeight - window.innerHeight;
      var p = (i + 0.2 + 0.55) / 4.4; if (i === 0) p = 0;
      window.scrollTo({ top: sec.offsetTop + p * span, behavior: U.reduced ? "auto" : "smooth" });
    });
  });

  resize(); label(0);
  window.addEventListener("resize", function () { resize(); if (!run) frame(performance.now()); });
  frame(performance.now());
  U.onVisible(sec, function () { if (!run) { run = true; raf = requestAnimationFrame(frame); } }, function () { run = false; cancelAnimationFrame(raf); }, "0px");
})();
