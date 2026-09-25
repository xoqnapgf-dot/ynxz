/* 世界层界：星源天 → 无疆界 → 诸天万界 → 时间树 → 混沌海
   每一层都画在上一层的某个位置上，尺寸是上一层的六分之一，镜头连续后退。 */
(function () {
  "use strict";
  var D = window.WDGX, U = window.WDGX_util;
  var stage = document.getElementById("worldStage");
  if (!stage || !D) return;
  var cv = stage.querySelector("canvas"), ctx = cv.getContext("2d");
  var list = document.getElementById("lvlList"), desc = document.getElementById("lvlDesc"), range = document.getElementById("zoomRange");
  var hudName = document.getElementById("hudName"), hudEn = document.getElementById("hudEn"), hudScale = document.getElementById("hudScale");

  var RATIO = 6;
  var W, H, dpr, R0, z = 0, target = 0, run = false, raf, t0 = performance.now();

  // 可复现的随机
  var seed = 20240917;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // 子层在父层中的位置（单位：父层半径）
  var ANCHOR = [
    [0.8, 0.26],   // 星源天 在 无疆界
    [-0.52, 0.46], // 无疆界 在 诸天万界
    null,          // 诸天万界 在 时间树（由树枝生成后确定）
    [0.04, 0.02]   // 时间树 在 混沌海
  ];

  /* ── 预生成 ── */
  var bgStars = [];
  for (var i = 0; i < 260; i++) bgStars.push([rnd(), rnd(), rnd() * 1.2 + 0.2, rnd() * 6.28]);

  var gates = [];
  for (i = 0; i < 7; i++) gates.push([rnd() * 6.28, 1.15 + rnd() * 0.5, 0.05 + rnd() * 0.05, (rnd() - 0.5) * 0.25]);
  var peaks = [];
  for (i = 0; i < 12; i++) peaks.push([-0.7 + rnd() * 1.4, 0.08 + rnd() * 0.22, 0.06 + rnd() * 0.08]);
  var rocks = [];
  for (i = 0; i <= 24; i++) rocks.push(rnd());

  var palaces = [];
  for (i = 0; i < 40; i++) { var a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.85; palaces.push([Math.cos(a) * r, Math.sin(a) * r * 0.4, rnd()]); }

  // 诸天万界：一段树杈上的宇宙泡
  var bubbles = [];
  function branchPt(u) { return [-1.15 + 2.3 * u, 0.52 - 0.95 * u + Math.sin(u * 3.2) * 0.18]; }
  for (i = 0; i < 70; i++) {
    var u = rnd(), bp = branchPt(u), off = (rnd() - 0.5) * 0.5;
    bubbles.push([bp[0] + off * 0.4, bp[1] + off, 0.02 + Math.pow(rnd(), 2.2) * 0.13, rnd()]);
  }

  // 时间树：主枝 + 递归分枝
  var twigs = [];
  function grow(x, y, ang, len, w, depth) {
    var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    var mx = (x + x2) / 2 + Math.cos(ang + 1.57) * len * 0.12 * (rnd() - 0.5), my = (y + y2) / 2 + Math.sin(ang + 1.57) * len * 0.12 * (rnd() - 0.5);
    twigs.push({ x: x, y: y, mx: mx, my: my, x2: x2, y2: y2, w: w, d: depth });
    if (depth >= 5) return;
    var n = depth < 2 ? 2 : (rnd() < 0.7 ? 2 : 1);
    for (var k = 0; k < n; k++) {
      var da = (k === 0 ? -1 : 1) * (0.35 + rnd() * 0.45);
      grow(x2, y2, ang + da, len * (0.55 + rnd() * 0.2), w * 0.62, depth + 1);
    }
  }
  // 主枝一路向右上延伸，出画即是“无终点”
  var trunk = [];
  (function () {
    var x = -1.05, y = 0.9, ang = -0.62;
    for (var s = 0; s < 14; s++) {
      var len = 0.23;
      var nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
      trunk.push([x, y, nx, ny]);
      if (s % 2 === 1 && s < 11) grow(nx, ny, ang + (s % 4 === 1 ? -0.9 : 0.85), 0.34, 0.012, 1);
      x = nx; y = ny; ang += (rnd() - 0.5) * 0.2;
    }
  })();
  // 选一根二级枝作为“诸天万界”
  var chosen = twigs.filter(function (t) { return t.d === 2 && t.x2 > -0.2 && t.x2 < 0.5 && t.y2 > -0.5 && t.y2 < 0.5; })[0] || twigs[3];
  ANCHOR[2] = [chosen.mx, chosen.my];

  var drops = [];
  for (i = 0; i < 180; i++) drops.push([(rnd() - 0.5) * 3.2, (rnd() - 0.5) * 2.2, 0.004 + Math.pow(rnd(), 3) * 0.05, rnd()]);

  /* ── 相机 ── */
  var size = [], cen = [];
  (function () {
    cen[4] = [0, 0]; size[4] = 1;
    for (var k = 3; k >= 0; k--) {
      size[k] = size[k + 1] / RATIO;
      cen[k] = [cen[k + 1][0] + ANCHOR[k][0] * size[k + 1], cen[k + 1][1] + ANCHOR[k][1] * size[k + 1]];
    }
  })();
  function camera(zz) {
    var k = Math.min(3, Math.floor(zz)), t = zz - k;
    var f = 1 - t * Math.pow(RATIO, t) / RATIO;
    var C = [cen[k + 1][0] + (cen[k][0] - cen[k + 1][0]) * f, cen[k + 1][1] + (cen[k][1] - cen[k + 1][1]) * f];
    var Z = R0 * Math.pow(RATIO, 4 - zz);
    return { C: C, Z: Z };
  }

  /* ── 各层绘制（局部坐标，半径 R） ── */
  var TAU = Math.PI * 2;
  function L0(x, y, R, a, t) { // 星源天
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + Math.sin(t / 1600) * R * 0.02);
    // 星门
    gates.forEach(function (g) {
      var ang = g[0] + t / 9000 * (0.5 + g[3]);
      var gx = Math.cos(ang) * R * g[1], gy = Math.sin(ang) * R * g[1] * 0.45;
      ctx.strokeStyle = "rgba(235,215,162,.75)"; ctx.lineWidth = Math.max(0.6, R * 0.008);
      ctx.beginPath(); ctx.ellipse(gx, gy, R * g[2], R * g[2] * 1.3, 0.3, 0, TAU); ctx.stroke();
      var gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * g[2] * 1.3);
      gg.addColorStop(0, "rgba(127,185,203,.35)"); gg.addColorStop(1, "rgba(127,185,203,0)");
      ctx.fillStyle = gg; ctx.fill();
    });
    // 岛底
    ctx.beginPath();
    for (var i = 0; i <= 24; i++) {
      var u = i / 24, px = -0.9 + 1.8 * u;
      var depth = Math.pow(Math.sin(Math.PI * u), 1.4) * (0.55 + rocks[i] * 0.25);
      if (i === 0) ctx.moveTo(px * R, 0); ctx.lineTo(px * R, depth * R);
    }
    ctx.closePath();
    var gb = ctx.createLinearGradient(0, 0, 0, R * 0.8);
    gb.addColorStop(0, "#3A3F45"); gb.addColorStop(1, "#0B0D10");
    ctx.fillStyle = gb; ctx.fill();
    // 瀑布
    ctx.strokeStyle = "rgba(215,226,229,.35)"; ctx.lineWidth = Math.max(0.5, R * 0.006);
    [-0.62, -0.1, 0.48].forEach(function (fx, j) {
      ctx.beginPath(); ctx.moveTo(fx * R, R * 0.05);
      ctx.lineTo(fx * R + Math.sin(t / 700 + j) * R * 0.01, R * (0.9 + j * 0.12)); ctx.stroke();
    });
    // 岛面
    var gt = ctx.createRadialGradient(-R * 0.2, -R * 0.06, 0, 0, 0, R);
    gt.addColorStop(0, "#9FB3A8"); gt.addColorStop(0.6, "#5E7468"); gt.addColorStop(1, "#2C3A34");
    ctx.fillStyle = gt;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.9, R * 0.24, 0, 0, TAU); ctx.fill();
    // 山
    peaks.forEach(function (pk) {
      ctx.fillStyle = "rgba(21,23,26,.75)";
      ctx.beginPath(); ctx.moveTo((pk[0] - pk[2]) * R, pk[1] * R * 0.3); ctx.lineTo(pk[0] * R, (pk[1] * 0.3 - pk[2] * 2.2) * R); ctx.lineTo((pk[0] + pk[2]) * R, pk[1] * R * 0.3); ctx.fill();
    });
    ctx.restore();
  }
  function L1(x, y, R, a, t) { // 无疆界
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, "rgba(235,215,162,.55)"); g.addColorStop(0.5, "rgba(201,164,91,.22)"); g.addColorStop(0.85, "rgba(120,140,160,.1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.scale(1, 0.42); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.restore();
    // 云环
    for (var i = 0; i < 6; i++) {
      ctx.strokeStyle = "rgba(215,226,229," + (0.08 + i * 0.03) + ")"; ctx.lineWidth = Math.max(0.5, R * 0.004);
      ctx.beginPath(); ctx.ellipse(0, 0, R * (0.3 + i * 0.12), R * (0.3 + i * 0.12) * 0.42, t / (20000 + i * 4000), 0.2, TAU - 0.6); ctx.stroke();
    }
    // 仙宫
    palaces.forEach(function (p) {
      var tw = 0.5 + 0.5 * Math.sin(t / 700 + p[2] * 20);
      ctx.fillStyle = "rgba(255,244,214," + (0.4 + tw * 0.5) + ")";
      ctx.fillRect(p[0] * R, p[1] * R, Math.max(1, R * 0.006), Math.max(1, R * 0.006));
    });
    ctx.restore();
  }
  function L2(x, y, R, a, t) { // 诸天万界
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    ctx.lineCap = "round";
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? "rgba(235,215,162,.9)" : "rgba(201,164,91,.18)";
      ctx.lineWidth = pass ? Math.max(1, R * 0.012) : Math.max(4, R * 0.08);
      ctx.beginPath();
      for (var i = 0; i <= 40; i++) { var b = branchPt(i / 40); if (i) ctx.lineTo(b[0] * R, b[1] * R); else ctx.moveTo(b[0] * R, b[1] * R); }
      ctx.stroke();
    }
    bubbles.forEach(function (b) {
      var r = b[2] * R, tw = 0.6 + 0.4 * Math.sin(t / 900 + b[3] * 30);
      var g = ctx.createRadialGradient(b[0] * R - r * 0.3, b[1] * R - r * 0.3, 0, b[0] * R, b[1] * R, r);
      g.addColorStop(0, "rgba(215,226,229," + (0.25 * tw) + ")"); g.addColorStop(0.8, "rgba(45,91,116,.12)"); g.addColorStop(1, "rgba(215,226,229," + (0.35 * tw) + ")");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b[0] * R, b[1] * R, r, 0, TAU); ctx.fill();
    });
    ctx.restore();
  }
  function L3(x, y, R, a, t) { // 时间树
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.lineCap = "round";
    // 起源之种
    var sg = ctx.createRadialGradient(-1.05 * R, 0.9 * R, 0, -1.05 * R, 0.9 * R, R * 0.14);
    sg.addColorStop(0, "rgba(255,248,230,.95)"); sg.addColorStop(1, "rgba(255,248,230,0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(-1.05 * R, 0.9 * R, R * 0.14, 0, TAU); ctx.fill();
    trunk.forEach(function (s, i) {
      ctx.strokeStyle = "rgba(235,215,162," + (0.95 - i * 0.05) + ")"; ctx.lineWidth = Math.max(1, R * (0.03 - i * 0.0016));
      ctx.beginPath(); ctx.moveTo(s[0] * R, s[1] * R); ctx.lineTo(s[2] * R, s[3] * R); ctx.stroke();
    });
    twigs.forEach(function (w) {
      var hl = w === chosen;
      ctx.strokeStyle = hl ? "rgba(255,240,200,1)" : "rgba(201,164,91," + (0.8 - w.d * 0.1) + ")";
      ctx.lineWidth = Math.max(0.5, R * w.w * (hl ? 1.6 : 1));
      ctx.beginPath(); ctx.moveTo(w.x * R, w.y * R); ctx.quadraticCurveTo(w.mx * R, w.my * R, w.x2 * R, w.y2 * R); ctx.stroke();
      if (w.d >= 4) { ctx.fillStyle = "rgba(235,215,162,.7)"; ctx.fillRect(w.x2 * R - 1, w.y2 * R - 1, 2, 2); }
    });
    ctx.restore();
  }
  function L4(x, y, R, a, t) { // 混沌海
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    for (var i = 0; i < 16; i++) {
      var yy = (-0.9 + i * 0.12) * R;
      ctx.strokeStyle = "rgba(141,154,162," + (0.05 + (i / 16) * 0.12) + ")"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var k = 0; k <= 60; k++) {
        var xx = (-1.6 + 3.2 * k / 60) * R;
        var w = Math.sin(k * 0.35 + t / 1400 + i) * R * 0.012 * (1 + i * 0.12);
        if (k) ctx.lineTo(xx, yy + w); else ctx.moveTo(xx, yy + w);
      }
      ctx.stroke();
    }
    drops.forEach(function (d) {
      var r = d[2] * R, tw = 0.5 + 0.5 * Math.sin(t / 1100 + d[3] * 40);
      var dx = d[0] * R, dy = d[1] * R, rr = Math.max(0.6, r);
      if (rr > 2) {
        var dg = ctx.createRadialGradient(dx - rr * 0.35, dy - rr * 0.35, 0, dx, dy, rr);
        dg.addColorStop(0, "rgba(215,226,229," + (0.35 + tw * 0.3) + ")"); dg.addColorStop(0.7, "rgba(45,91,116,.18)"); dg.addColorStop(1, "rgba(215,226,229," + (0.3 * tw) + ")");
        ctx.fillStyle = dg;
      } else ctx.fillStyle = "rgba(215,226,229," + (0.2 + tw * 0.4) + ")";
      ctx.beginPath(); ctx.arc(dx, dy, rr, 0, TAU); ctx.fill();
      if (r > 3) { ctx.strokeStyle = "rgba(235,215,162,.35)"; ctx.beginPath(); ctx.arc(d[0] * R, d[1] * R, r * 1.6, 0, TAU); ctx.stroke(); }
    });
    ctx.restore();
  }
  var DRAW = [L0, L1, L2, L3, L4];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R0 = Math.min(W, H) * 0.36;
  }

  function frame(now) {
    var t = now - t0;
    z += (target - z) * (U.reduced ? 1 : 0.06);
    if (Math.abs(target - z) < 0.0005) z = target;
    ctx.fillStyle = "#05070A"; ctx.fillRect(0, 0, W, H);
    // 背景星
    bgStars.forEach(function (s) {
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(t / 1500 + s[3]));
      ctx.fillStyle = "rgba(215,226,229," + (tw * 0.5) + ")";
      ctx.fillRect(((s[0] + z * 0.02) % 1) * W, s[1] * H, s[2], s[2]);
    });
    var cam = camera(z);
    for (var k = 4; k >= 0; k--) {
      var R = size[k] * cam.Z;
      if (R < 2.5 || R > R0 * 60) continue;
      var s = R / R0, a;
      if (s >= 1) a = Math.max(0.1, 1 - (s - 1.2) / 4);
      else a = Math.min(1, (R - 2.5) / 30);
      if (a <= 0) continue;
      var x = W / 2 + (cen[k][0] - cam.C[0]) * cam.Z, y = H / 2 + (cen[k][1] - cam.C[1]) * cam.Z;
      DRAW[k](x, y, R, Math.min(1, a), t);
    }
    // 标签
    var near = Math.round(z);
    if (near !== frame.lastNear) { frame.lastNear = near; label(near); }
    if (run) raf = requestAnimationFrame(frame);
  }

  function label(k) {
    var w = D.world[k];
    hudName.textContent = w.name; hudEn.textContent = w.en; hudScale.textContent = w.scale;
    desc.innerHTML = '<span class="en">' + w.en + "</span>" + w.text;
    Array.prototype.forEach.call(list.children, function (li, i) { li.firstChild.classList.toggle("on", i === k); });
    if (document.activeElement !== range) range.value = z.toFixed(3);
  }

  list.innerHTML = D.world.map(function (w, i) {
    return '<li><button class="lvl" type="button" data-k="' + i + '"><i>' + ["一", "二", "三", "四", "五"][i] + "</i><b>" + w.name + "</b><small>" + w.scale + "</small></button></li>";
  }).join("");
  list.addEventListener("click", function (e) {
    var b = e.target.closest(".lvl"); if (!b) return;
    target = +b.dataset.k; range.value = target; kick();
  });
  range.addEventListener("input", function () { target = +range.value; kick(); });

  function kick() { if (!run) { run = true; raf = requestAnimationFrame(frame); } }

  resize();
  label(0);
  window.addEventListener("resize", function () { resize(); if (!run) frame(performance.now()); });
  frame(performance.now());
  U.onVisible(stage, kick, function () { run = false; cancelAnimationFrame(raf); }, "0px");
})();
