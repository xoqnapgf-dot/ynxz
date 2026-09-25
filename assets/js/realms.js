/* 境界天梯 · 量级圈
   每一个境界是一圈。滚到哪一境，镜头就退到哪一圈；
   过了禁忌级，圈层开始扭曲、错位，最后化成一片白光。 */
(function () {
  "use strict";
  var U = window.WDGX_util;
  var hud = document.getElementById("realmHud");
  if (!hud || !U) return;
  var cv = hud.querySelector("canvas"), ctx = cv.getContext("2d");
  var elTier = document.getElementById("hTier"), elName = document.getElementById("hName"), elScale = document.getElementById("hScale"), elWho = document.getElementById("hWho");
  var rungs = Array.prototype.slice.call(document.querySelectorAll("#ladder .rung"));
  if (!rungs.length) return;
  var N = rungs.length, beyondFrom = rungs.findIndex(function (r) { return r.closest(".tier").classList.contains("beyond"); });
  if (beyondFrom < 0) beyondFrom = N;
  var W, H, dpr, cur = 0, target = 0, run = false, raf, t0 = performance.now(), shown = -1;
  var TAU = Math.PI * 2, K = 1.85;

  // 预渲染每一圈的标签
  var labels = rungs.map(function (r) {
    var txt = r.dataset.scale || "", c = document.createElement("canvas"), fs = 26;
    var g = c.getContext("2d"); g.font = "500 " + fs + 'px "Noto Sans SC", sans-serif';
    var w = Math.ceil(g.measureText(txt).width) + 12; c.width = Math.max(4, w); c.height = fs + 12;
    g.font = "500 " + fs + 'px "Noto Sans SC", sans-serif'; g.fillStyle = "#EBD7A2"; g.textBaseline = "middle"; g.fillText(txt, 6, c.height / 2);
    return c;
  });
  var glow = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,248,230,1)"); gr.addColorStop(0.2, "rgba(235,215,162,.55)"); gr.addColorStop(1, "rgba(235,215,162,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
  })();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hud.clientWidth; H = hud.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setActive(i) {
    target = i;
    if (i === shown) return; shown = i;
    var r = rungs[i];
    rungs.forEach(function (x, j) { x.classList.toggle("act", j === i); });
    var box = elName.parentNode; box.classList.remove("in"); void box.offsetWidth; box.classList.add("in");
    elTier.textContent = r.dataset.tier; elName.textContent = r.dataset.name; elScale.textContent = r.dataset.scale || "不可言说"; elWho.textContent = r.dataset.who || "";
    hud.classList.toggle("beyond", i >= beyondFrom);
    hud.style.setProperty("--glitch", i >= beyondFrom ? ((i - beyondFrom + 1) / (N - beyondFrom)).toFixed(2) : "0");
  }

  function frame(now) {
    var t = (now - t0) / 1000;
    cur += (target - cur) * (U.reduced ? 1 : 0.09);
    var cx = W / 2, cy = H / 2, base = Math.min(W, H) * 0.34;
    var chaos = Math.max(0, cur - beyondFrom + 1) / Math.max(1, N - beyondFrom);
    ctx.fillStyle = "#050608"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    var gs = base * (0.35 + chaos * 2.5); ctx.globalAlpha = 0.6 + chaos * 0.4;
    ctx.drawImage(glow, cx - gs, cy - gs, gs * 2, gs * 2); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    for (var i = 0; i < N; i++) {
      var r = base * Math.pow(K, i - cur);
      if (r < 1.5 || r > Math.hypot(W, H)) continue;
      var d = i - cur, act = Math.abs(d) < 0.5;
      var beyond = i >= beyondFrom;
      var wob = beyond ? chaos * 6 : 0;
      ctx.lineWidth = act ? 2 : 1;
      var alpha = act ? 0.95 : (d < 0 ? 0.25 + 0.3 * (1 + d / 6) : Math.max(0.08, 0.4 - d * 0.1));
      if (beyond) {
        [["rgba(224,138,122,", -wob], ["rgba(127,185,203,", wob]].forEach(function (c) {
          ctx.strokeStyle = c[0] + (alpha * 0.6) + ")"; ctx.beginPath();
          for (var s = 0; s <= 72; s++) {
            var a = s / 72 * TAU, n = Math.sin(a * 7 + t * 3 + i) * wob + Math.sin(a * 13 - t * 5) * wob * 0.5;
            var x = cx + c[1] + Math.cos(a) * (r + n), y = cy + Math.sin(a) * (r + n);
            if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        });
      } else {
        ctx.strokeStyle = "rgba(235,215,162," + alpha + ")";
        if (!act && d > 0) ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      if (r > 22 && r < Math.max(W, H)) {
        var lb = labels[i], lw = lb.width * 0.5, lh = lb.height * 0.5;
        ctx.globalAlpha = act ? 1 : Math.max(0, alpha * 0.9);
        ctx.drawImage(lb, cx - lw / 2, cy - r - lh - 4, lw, lh);
        ctx.globalAlpha = 1;
      }
      if (act) {
        ctx.globalCompositeOperation = "lighter";
        for (var p = 0; p < 18; p++) {
          var a2 = t * (0.35 + p * 0.01) + p * 0.349, q = 6 + (p % 3) * 3;
          ctx.drawImage(glow, cx + Math.cos(a2) * r - q, cy + Math.sin(a2) * r - q, q * 2, q * 2);
        }
        ctx.globalCompositeOperation = "source-over";
      }
    }
    // 超脱之后：错位切片与白化
    if (chaos > 0 && !U.reduced) {
      var n = Math.floor(chaos * 6);
      for (var k = 0; k < n; k++) {
        if (Math.random() < 0.5) continue;
        var sy = Math.random() * H, sh = 4 + Math.random() * 30;
        ctx.drawImage(cv, 0, sy * dpr, W * dpr, sh * dpr, (Math.random() - 0.5) * 40 * chaos, sy, W, sh);
      }
      if (cur > N - 1.6) { ctx.fillStyle = "rgba(255,250,236," + Math.min(0.85, (cur - (N - 1.6)) * 0.9) + ")"; ctx.fillRect(0, 0, W, H); }
    }
    if (run) raf = requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setActive(rungs.indexOf(e.target)); });
    }, { rootMargin: window.innerWidth < 860 ? "-62% 0px -30% 0px" : "-48% 0px -48% 0px" });
    rungs.forEach(function (r) { io.observe(r); });
  }
  resize(); setActive(0); cur = 0;
  window.addEventListener("resize", resize);
  frame(performance.now());
  U.onVisible(hud, function () { if (!run) { run = true; raf = requestAnimationFrame(frame); } }, function () { run = false; cancelAnimationFrame(raf); }, "0px");
})();
