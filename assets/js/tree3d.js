/* 终焉纪 · 三维时间树（three.js）
   起源之种在根部发光，主枝向远方延伸直到雾里，枝梢是一个个世界；四周是混沌海。 */
(function () {
  "use strict";
  var U = window.WDGX_util;
  var stage = document.getElementById("treeStage");
  if (!stage || !U) return;
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js";
  var started = false, running = false, raf;
  var labelEl = document.getElementById("treeLabel");

  U.onVisible(stage, function () {
    if (!started) {
      started = true;
      U.loadScript(THREE_URL).then(init).catch(function () { stage.classList.add("no3d"); });
    } else if (!running && window.__treeLoop) { running = true; window.__treeLoop(); }
  }, function () { running = false; cancelAnimationFrame(raf); }, "400px 0px");

  function init() {
    var T = window.THREE; if (!T) return;
    var W = stage.clientWidth, H = stage.clientHeight;
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H);
    renderer.setClearColor(0x030304, 1);
    stage.insertBefore(renderer.domElement, stage.firstChild);

    var scene = new T.Scene();
    scene.fog = new T.FogExp2(0x030304, 0.028);
    var camera = new T.PerspectiveCamera(46, W / H, 0.1, 400);
    var root = new T.Group(); scene.add(root);

    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    // 光点贴图
    function glowTex(inner, outer) {
      var c = document.createElement("canvas"); c.width = c.height = 64;
      var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, inner); gr.addColorStop(0.25, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      var tx = new T.CanvasTexture(c); return tx;
    }
    var texGold = glowTex("rgba(255,246,220,1)", "rgba(201,164,91,.45)");
    var texMoon = glowTex("rgba(230,240,245,1)", "rgba(120,150,170,.3)");

    /* ── 生成树 ── */
    var segs = [];   // [x1,y1,z1,x2,y2,z2,depth,order]
    var tips = [];
    function v3(x, y, z) { return new T.Vector3(x, y, z); }
    function grow(p, dir, len, depth, order) {
      var q = p.clone().add(dir.clone().multiplyScalar(len));
      segs.push([p, q, depth, order]);
      if (depth >= 6 || len < 0.25) { tips.push([q, order + 1]); return; }
      var n = depth < 3 ? 2 : (rnd() < 0.75 ? 2 : 3);
      for (var k = 0; k < n; k++) {
        var axis = v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        var nd = dir.clone().applyAxisAngle(axis, 0.45 + rnd() * 0.55);
        nd.y += 0.12; nd.normalize();
        grow(q, nd, len * (0.62 + rnd() * 0.16), depth + 1, order + 1);
      }
    }
    // 主枝
    var trunkPts = [];
    var p = v3(-9, -3.2, 0), dir = v3(1, 0.32, 0).normalize();
    trunkPts.push(p.clone());
    for (var s = 0; s < 34; s++) {
      var np = p.clone().add(dir.clone().multiplyScalar(1.1));
      segs.push([p.clone(), np.clone(), 0, s]);
      trunkPts.push(np.clone());
      if (s % 2 === 1 && s < 26) {
        var side = v3(rnd() - 0.5, 0.7 + rnd() * 0.4, (rnd() - 0.5) * 1.6).normalize();
        grow(np, side, 2.6 - s * 0.05, 1, s + 1);
      }
      dir.add(v3((rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.18)).normalize();
      p = np;
    }
    var maxOrder = 0; segs.forEach(function (sg) { maxOrder = Math.max(maxOrder, sg[3]); });

    // 枝条：线段，按生长顺序排列
    segs.sort(function (a, b) { return a[3] - b[3]; });
    var pos = new Float32Array(segs.length * 6), col = new Float32Array(segs.length * 6);
    var cA = new T.Color(0xEBD7A2), cB = new T.Color(0x8A6D33), tmp = new T.Color();
    segs.forEach(function (sg, i) {
      pos.set([sg[0].x, sg[0].y, sg[0].z, sg[1].x, sg[1].y, sg[1].z], i * 6);
      tmp.copy(cA).lerp(cB, Math.min(1, sg[2] / 6));
      col.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], i * 6);
    });
    var lg = new T.BufferGeometry();
    lg.setAttribute("position", new T.BufferAttribute(pos, 3));
    lg.setAttribute("color", new T.BufferAttribute(col, 3));
    var lines = new T.LineSegments(lg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    root.add(lines);

    // 主干：发光的管
    var curve = new T.CatmullRomCurve3(trunkPts);
    var tube = new T.Mesh(new T.TubeGeometry(curve, 240, 0.09, 8, false),
      new T.MeshBasicMaterial({ color: 0xC9A45B, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    var halo = new T.Mesh(new T.TubeGeometry(curve, 240, 0.32, 8, false),
      new T.MeshBasicMaterial({ color: 0x8A6D33, transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false }));
    root.add(tube, halo);

    // 枝梢：世界
    var tp = new Float32Array(tips.length * 3);
    tips.forEach(function (t, i) { tp.set([t[0].x, t[0].y, t[0].z], i * 3); });
    var tg = new T.BufferGeometry(); tg.setAttribute("position", new T.BufferAttribute(tp, 3));
    var tipMat = new T.PointsMaterial({ size: 0.42, map: texGold, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 });
    var tipPts = new T.Points(tg, tipMat); root.add(tipPts);

    // 起源之种
    var seedSpr = new T.Sprite(new T.SpriteMaterial({ map: texGold, color: 0xffffff, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    seedSpr.position.copy(trunkPts[0]); seedSpr.scale.set(3.2, 3.2, 1); root.add(seedSpr);

    // 何阳所在的枝梢
    var mark = tips[Math.floor(tips.length * 0.38)][0];
    var markSpr = new T.Sprite(new T.SpriteMaterial({ map: texGold, color: 0xff8a70, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    markSpr.position.copy(mark); markSpr.scale.set(1.2, 1.2, 1); root.add(markSpr);

    // 混沌海
    var N = window.innerWidth < 700 ? 2600 : 5200;
    var sp = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var r = 14 + Math.pow(rnd(), 0.6) * 70, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      sp.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.55, r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    var sg2 = new T.BufferGeometry(); sg2.setAttribute("position", new T.BufferAttribute(sp, 3));
    var sea = new T.Points(sg2, new T.PointsMaterial({ size: 0.28, map: texMoon, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(sea);

    /* ── 交互：拖动旋转 ── */
    var yaw = -0.35, pitch = 0.12, vy = 0, drag = false, lx = 0, ly = 0, idle = 0;
    var el = renderer.domElement;
    el.addEventListener("pointerdown", function (e) { drag = true; lx = e.clientX; ly = e.clientY; idle = 0; });
    window.addEventListener("pointerup", function () { drag = false; });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      if (e.pointerType === "touch" && Math.abs(dy) > Math.abs(dx) * 1.2) { drag = false; return; }
      vy = dx * 0.005; yaw += vy; pitch = Math.max(-0.5, Math.min(0.7, pitch + dy * 0.003));
    });

    function resize() {
      W = stage.clientWidth; H = stage.clientHeight;
      renderer.setSize(W, H); camera.aspect = W / H;
      camera.fov = W < 700 ? 58 : 46; camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize); resize();

    var t0 = performance.now(), growDur = U.reduced ? 1 : 6500;
    var total = segs.length;
    function loop() {
      if (!running) return;
      var t = performance.now() - t0;
      var g = Math.min(1, t / growDur), ge = 1 - Math.pow(1 - g, 3);
      lg.setDrawRange(0, Math.max(2, Math.floor(total * ge) * 2));
      tipMat.opacity = Math.max(0, (g - 0.7) / 0.3) * (0.75 + 0.25 * Math.sin(t / 600));
      tube.material.opacity = 0.2 + 0.35 * ge;
      seedSpr.scale.setScalar(3 + Math.sin(t / 900) * 0.4);
      markSpr.scale.setScalar(g < 1 ? 0.01 : 1.1 + Math.sin(t / 380) * 0.35);

      if (!drag) { idle += 1; vy *= 0.95; yaw += vy + (U.reduced ? 0 : 0.0009); }
      root.rotation.y = yaw; root.rotation.x = pitch * 0.4;
      sea.rotation.y = t / 90000;

      var dist = W < 700 ? 30 : 24;
      camera.position.set(Math.sin(t / 14000) * 1.5, 3 + pitch * 10, dist);
      camera.lookAt(0, W < 700 ? 4.2 : 1.2, 0);
      renderer.render(scene, camera);

      // 标签投影
      if (labelEl) {
        var v = mark.clone(); root.localToWorld(v); v.project(camera);
        var vis = g >= 1 && v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95;
        labelEl.style.opacity = vis ? "1" : "0";
        labelEl.style.left = ((v.x + 1) / 2 * W) + "px";
        labelEl.style.top = ((1 - v.y) / 2 * H - 10) + "px";
      }
      raf = requestAnimationFrame(loop);
    }
    window.__treeLoop = loop;
    running = true; loop();
  }
})();
