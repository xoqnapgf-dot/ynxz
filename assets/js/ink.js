/* 首屏水墨：p5.js 2 + p5.brush，一笔一笔画出来
   远山 → 中山 → 朱砂日 → 悬空的星源天 → 近山 → 松 → 雾 → 飞鸟 */
(function () {
  "use strict";
  var U = window.WDGX_util;
  var host = document.getElementById("heroArt");
  if (!host || !U) return;

  var P5 = "https://cdn.jsdelivr.net/npm/p5@2.2.3/lib/p5.min.js";
  var BRUSH = "https://cdn.jsdelivr.net/npm/p5.brush@2.2.3/dist/p5.brush.js";
  var inst = null, lastW = 0;

  function start() {
    var W = host.clientWidth, H = host.clientHeight;
    if (W < 10 || H < 10) return;
    lastW = W;
    if (inst) { inst.remove(); inst = null; }
    var portrait = W / H < 0.9;

    inst = new window.p5(function (p) {
      window.brush.instance(p);
      var steps = [], si = 0, lastT = 0;

      // 山脊：分形噪声折线
      function ridge(y0, amp, freq, x0, x1, seed, n) {
        var pts = [];
        n = n || 42;
        for (var i = 0; i <= n; i++) {
          var x = x0 + (x1 - x0) * i / n;
          var t = x / W;
          var v = p.noise(t * freq + seed, seed * 0.37) * 0.7 + p.noise(t * freq * 3.1 + seed * 2, 1.7) * 0.3;
          var edge = Math.sin(Math.PI * i / n);
          pts.push([x, y0 - amp * v * (0.35 + 0.65 * edge)]);
        }
        return pts;
      }
      function mountain(pts, bottom, col, washOp, fillOp, bleed, hatchCol) {
        var poly = pts.slice();
        poly.push([pts[pts.length - 1][0], bottom]);
        poly.push([pts[0][0], bottom]);
        brush.noStroke(); brush.noHatch();
        if (washOp) { brush.wash(col, washOp); brush.polygon(poly); brush.noWash(); }
        brush.fill(col, fillOp);
        brush.fillBleed(bleed, "out");
        brush.fillTexture(0.32, 0.3);
        if (hatchCol) { brush.hatchStyle("charcoal", hatchCol, 0.7); brush.hatch(Math.max(5, W / 160), 72, { rand: 0.35, gradient: 0.4 }); }
        brush.polygon(poly);
        brush.noFill(); brush.noHatch();
      }
      function ridgeLine(pts, name, col, w) {
        brush.set(name, col, w);
        var sp = pts.filter(function (_, i) { return i % 2 === 0; }).map(function (q, i, a) {
          var pr = 0.5 + Math.sin(Math.PI * i / (a.length - 1)) * 0.8;
          return [q[0], q[1] + 1, pr];
        });
        brush.spline(sp, 0.5);
      }
      function pine(x, y, h, col) {
        brush.set("charcoal", col, 1.1);
        brush.line(x, y, x + h * 0.04, y - h);
        for (var k = 0; k < 6; k++) {
          var yy = y - h * (0.35 + k * 0.11);
          var len = h * (0.34 - k * 0.045);
          brush.set("2B", col, 1.3);
          brush.line(x - len, yy + len * 0.18, x + len * 0.9, yy - len * 0.05);
        }
      }

      p.setup = function () {
        p.createCanvas(W, H, p.WEBGL);
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, W > 900 ? 1.5 : 2));
        p.angleMode(p.DEGREES);
        p.noiseSeed((Math.random() * 1e6) | 0);
        p.randomSeed((Math.random() * 1e6) | 0);
        p.background("#E6E3DA");
        brush.scaleBrushes(Math.max(W, H) / 260);

        var inkFar = "#8E98A0", inkMid = "#5D646B", inkNear = "#23262A", seal = "#A5342B";
        var base = portrait ? H * 0.64 : H;       // 竖屏只画上半部分
        var S = portrait ? W * 1.15 : W;           // 构图尺度

        // 1 远山
        steps.push(function () {
          var r = ridge(base * 0.62, base * 0.3, 2.2, -40, W + 40, 1.3, 50);
          mountain(r, base * 0.9, inkFar, 70, 90, 0.22);
        });
        // 2 朱砂日
        steps.push(function () {
          var sx = portrait ? W * 0.28 : W * 0.46, sy = portrait ? base * 0.2 : H * 0.17;
          brush.noStroke();
          brush.wash(seal, 150); brush.circle(sx, sy, S * 0.05, 0.2); brush.noWash();
          brush.fill(seal, 120); brush.fillBleed(0.12, "out"); brush.fillTexture(0.4, 0.5);
          brush.circle(sx, sy, S * 0.055, 0.25);
          brush.noFill();
        });
        // 3 中山
        steps.push(function () {
          var r = ridge(base * 0.8, base * 0.32, 3.1, -40, W + 40, 7.9, 46);
          mountain(r, base * 1.02, inkMid, 120, 120, 0.16);
          ridgeLine(r, "2H", inkMid, 1);
        });
        // 4 悬空的星源天：倒悬的岛与瀑布
        steps.push(function () {
          var ix = portrait ? W * 0.36 : W * 0.41, iy = portrait ? base * 0.36 : H * 0.4, iw = S * 0.1;
          var top = [], bot = [];
          for (var i = 0; i <= 16; i++) {
            var t = i / 16, x = ix - iw + 2 * iw * t;
            top.push([x, iy - Math.sin(Math.PI * t) * iw * 0.12 - p.noise(t * 6, 3) * iw * 0.18]);
            bot.unshift([x, iy + Math.pow(Math.sin(Math.PI * t), 1.6) * iw * 0.62 + p.noise(t * 9, 5) * iw * 0.1]);
          }
          brush.noStroke();
          brush.wash("#3A3F45", 170); brush.polygon(top.concat(bot)); brush.noWash();
          brush.fill("#1E2125", 150); brush.fillBleed(0.08, "out"); brush.fillTexture(0.4, 0.4);
          brush.hatchStyle("charcoal", "#15171A", 0.6); brush.hatch(Math.max(4, W / 200), 80, { rand: 0.4 });
          brush.polygon(top.concat(bot)); brush.noHatch();
          brush.noFill();
          brush.set("charcoal", "#1B1D20", 1);
          brush.spline(top.map(function (q) { return [q[0], q[1], 1]; }), 0.4);
          brush.set("HB", "#6B7680", 0.8);
          for (var k = 0; k < 3; k++) {
            var fx = ix - iw * 0.3 + k * iw * 0.28;
            brush.line(fx, iy + iw * 0.35, fx + p.random(-4, 4), iy + iw * (1.2 + p.random(0.4)));
          }
          pine(ix - iw * 0.45, top[3][1], iw * 0.42, "#1B1D20");
          pine(ix + iw * 0.2, top[10][1], iw * 0.3, "#1B1D20");
        });
        // 5 近山（左右两簇）
        steps.push(function () {
          var r1 = ridge(base * 1.02, base * 0.36, 2.6, -60, W * (portrait ? 0.7 : 0.46), 21.4, 34);
          mountain(r1, base * 1.1, inkNear, 215, 160, 0.1, "#3C4046");
          ridgeLine(r1, "charcoal", "#0E0F11", 1.4);
        });
        steps.push(function () {
          var r2 = ridge(base * 1.04, base * 0.26, 3.4, W * (portrait ? 0.5 : 0.62), W + 60, 33.2, 30);
          mountain(r2, base * 1.1, inkNear, 200, 150, 0.12, "#3C4046");
          ridgeLine(r2, "charcoal", "#0E0F11", 1.2);
        });
        // 6 松
        steps.push(function () {
          var n = portrait ? 3 : 5;
          for (var i = 0; i < n; i++) {
            var x = W * (0.06 + i * (portrait ? 0.2 : 0.08)) + p.random(-10, 10);
            pine(x, base * (0.86 + p.random(0.06)), S * (0.05 + p.random(0.03)), "#111214");
          }
        });
        // 7 雾
        steps.push(function () {
          brush.field("waves");
          brush.set("spray", "#E6E3DA", 2.2);
          for (var i = 0; i < 9; i++) {
            brush.flowLine(p.random(-80, W * 0.6), base * (0.66 + i * 0.03), W * p.random(0.3, 0.7), 0);
          }
          brush.set("2H", "#9AA3AA", 0.6);
          for (var j = 0; j < 7; j++) brush.flowLine(p.random(0, W), base * (0.55 + p.random(0.3)), W * p.random(0.12, 0.3), 0);
          brush.noField();
        });
        // 8 飞鸟
        steps.push(function () {
          brush.set("pen", "#1B1D20", 0.7);
          var bx = portrait ? W * 0.5 : W * 0.66, by = portrait ? base * 0.14 : H * 0.18;
          for (var i = 0; i < 5; i++) {
            var x = bx + i * S * 0.022 + p.random(-6, 6), y = by + i * S * 0.01 + p.random(-6, 6), s = S * (0.006 + p.random(0.004));
            brush.spline([[x - s, y - s * 0.4, 0.6], [x, y, 1], [x + s, y - s * 0.5, 0.6]], 0.6);
          }
        });
      };

      p.draw = function () {
        p.translate(-W / 2, -H / 2);
        var now = p.millis();
        if (U.reduced) {
          while (si < steps.length) steps[si++]();
          p.noLoop(); return;
        }
        if (si < steps.length && now - lastT > 260) {
          steps[si++]();
          lastT = p.millis();
        }
        if (si >= steps.length) p.noLoop();
      };
    }, host);
  }

  function boot() {
    U.loadScript(P5)
      .then(function () { return U.loadScript(BRUSH); })
      .then(function () { if (window.p5 && window.brush) { start(); var fb = host.querySelector(".fallback"); if (fb) fb.style.opacity = "0.4"; } })
      .catch(function () { /* 保留 CSS 兜底画面 */ });
  }
  boot();

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (!inst || !lastW) return;
      if (Math.abs(host.clientWidth - lastW) / lastW > 0.18) start();
    }, 400);
  });
})();
