/* 万道归墟 · 页面渲染与交互 */
(function () {
  "use strict";
  var D = window.WDGX;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 工具：外部脚本、可见时触发 ── */
  var loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function onVisible(el, enter, leave, margin) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { enter(); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) enter(); else if (leave) leave(); });
    }, { rootMargin: margin || "200px 0px" }).observe(el);
  }
  window.WDGX_util = { loadScript: loadScript, onVisible: onVisible, reduced: reduced };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function spoil(s) {
    return esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="spoiler" tabindex="0" role="button" aria-label="剧透，点击显示">$1</span>');
  }
  var BU = "";
  /* ── 书名 ── */
  $$("[data-book-title]").forEach(function (el) { el.textContent = D.book.title; });
  document.title = D.book.title;

  /* ── 首屏 ── */
  $("#genre").textContent = D.book.genre.join(" · ");
  $("#blurb").innerHTML = D.book.blurb.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
  $("#twist").innerHTML = esc(D.book.twist).replace("何阳自己？", "<em>何阳自己？</em>");
  var sysLines = $("#sysLines");
  sysLines.innerHTML = D.panel.map(function (row, i) {
    var cls = "sys-line" + (reduced ? "" : " type") + (row[0] ? "" : " warn");
    var style = reduced ? "" : ' style="animation-delay:' + (0.5 + i * 0.42).toFixed(2) + 's"';
    var inner = row[0]
      ? '<span class="br">【</span><span class="k">' + esc(row[0]) + "：</span>" + esc(row[1]) + '<span class="br">】</span>'
      : '<span class="br">【</span>' + esc(row[1]) + '<span class="br">】</span>';
    return '<span class="' + cls + '"' + style + ">" + inner + "</span>";
  }).join("");
  if (!reduced) {
    setTimeout(function () { $("#sysPanel").classList.add("glitch"); }, 3300);
  }

  /* ── 作品档案 ── */
  var PF = D.profile;
  $("#logline").textContent = PF.logline;
  $("#facts").innerHTML = PF.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + spoil(f[1]) + "</dd></div>"; }).join("");
  $("#tnQuote").textContent = PF.titleNote.quote;
  $("#tnSrc").textContent = PF.titleNote.src;
  $("#tnText").innerHTML = esc(PF.titleNote.text) + BU;
  $("#cheats").innerHTML = PF.cheats.map(function (c, i) {
    return '<article class="cheat"><span class="cheat-no">' + "壹贰叁"[i] + "</span><h4>" + esc(c.h) + "</h4><p>" + spoil(c.t) + "</p></article>";
  }).join("");

  /* ── 星源天体系 ── */
  $("#loreBlocks").innerHTML = D.lore.map(function (g) {
    var dia = g.key === "cult" ? '<div class="diagram" id="cultDiagram"></div>' : g.key === "camp" ? '<div class="diagram tower" id="towerDiagram"></div>' : "";
    return '<div class="arc"><div class="arc-name"><small>' + esc(g.sub) + "</small><h3>" + esc(g.h) + "</h3></div>" +
      '<div>' + dia + '<div class="lore-items">' + g.items.map(function (it) {
        return '<article class="lore-item"><h4>' + esc(it.h) + "</h4><p>" + esc(it.t) + "</p>" +
          (it.secret ? '<details class="secret"><summary>真相</summary><p>' + esc(it.secret) + "</p></details>" : "") + "</article>";
      }).join("") + "</div></div></div>";
  }).join("");

  /* ── 势力 ── */
  if ($("#factionGrid")) $("#factionGrid").innerHTML = D.factions.map(function (f) {
    return '<article class="faction' + (f.foe ? " foe" : "") + '"><small>' + esc(f.where) + "</small><h4>" + esc(f.name) + "</h4><p>" + esc(f.t) + "</p></article>";
  }).join("");

  /* ── 伏笔 ── */
  $("#threadList").innerHTML = D.threads.map(function (t) {
    return '<li class="thread' + (t.open ? " open" : "") + '">' +
      '<div class="plant"><small>埋 · ' + esc(t.where) + "</small><p>" + esc(t.plant) + "</p></div>" +
      '<div class="arrow" aria-hidden="true"></div>' +
      '<div class="pay"><small>收 · ' + esc(t.when) + (t.bu ? BU : "") + "</small><p>" +
      (t.open ? esc(t.pay) : '<span class="spoiler" tabindex="0" role="button" aria-label="剧透，点击显示">' + esc(t.pay) + "</span>") + "</p></div></li>";
  }).join("");

  /* ── 人物 ── */
  $("#groups").innerHTML = D.people.map(function (g) {
    return '<div class="group"><div class="group-h"><h3>' + esc(g.group) + "</h3><span></span></div>" +
      '<div class="people">' + g.list.map(function (p) {
        var lead = (p.name === "何阳" || p.name === "哀怜") ? " lead-role" : "";
        return '<article class="person' + lead + '">' +
          '<div class="p-top"><div class="avatar" aria-hidden="true">' + esc(p.glyph) + '</div><div class="p-name"><h4>' + esc(p.name) + "</h4><small>" + esc(p.role) + "</small></div></div>" +
          '<span class="chip">境界 · ' + esc(p.realm) + "</span>" +
          '<p class="desc">' + esc(p.desc) + "</p>" +
          '<div style="display:grid;gap:10px"><p class="quote">' + esc(p.quote) + "</p>" +
          (p.secret ? '<details class="secret"><summary>真实身份</summary><p>' + esc(p.secret) + "</p></details>" : "") +
          "</div></article>";
      }).join("") + "</div></div>";
  }).join("");

  /* ── 破妄镜 ── */
  var mText = $("#mirrorText");
  var sysIndex = $("#sysIndex");
  sysIndex.innerHTML = D.systems.map(function (s, i) {
    return '<button class="sys-row" type="button" data-i="' + i + '"><div><b>' + esc(s.name) + (s.bu ? BU : "") + "</b><small>" + esc(s.host) + "</small></div><span>" + esc(s.text) + "</span></button>";
  }).join("");
  var warnLeft = 3;
  function showMirror(html, warn) {
    mText.classList.add("fade");
    setTimeout(function () {
      mText.innerHTML = html;
      mText.classList.toggle("warn", !!warn);
      mText.classList.remove("fade");
    }, reduced ? 0 : 320);
  }
  function mirrorAt(i) {
    var s = D.systems[i];
    $$(".sys-row", sysIndex).forEach(function (b) { b.classList.toggle("on", +b.dataset.i === i); });
    showMirror("<small>" + esc(s.host) + "</small><b>" + esc(s.name) + "</b><span>" + esc(s.text) + "</span>");
  }
  var lastI = -1;
  $("#mirrorRand").addEventListener("click", function () {
    var i; do { i = Math.floor(Math.random() * D.systems.length); } while (i === lastI && D.systems.length > 1);
    lastI = i; mirrorAt(i);
  });
  $("#mirrorSelf").addEventListener("click", function () {
    warnLeft = Math.max(0, warnLeft - 1);
    $$(".sys-row", sysIndex).forEach(function (b) { b.classList.remove("on"); });
    if (warnLeft > 0) {
      showMirror("<small>宿主 · 何阳</small><b>无法探查</b><span>【宿主请注意，不要窥探本系统！（本周剩余警告次数" + warnLeft + "/3）】</span>", true);
    } else {
      showMirror("<small>宿主 · 何阳</small><b>账号已封禁</b><span>【您的账号正处于封禁期，51小时后解封】</span>", true);
      setTimeout(function () { warnLeft = 3; }, 4000);
    }
  });
  sysIndex.addEventListener("click", function (e) {
    var b = e.target.closest(".sys-row"); if (b) { mirrorAt(+b.dataset.i); if (window.innerWidth < 860) $(".mirror").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); }
  });
  mirrorAt(1);
  $("#hisLines").innerHTML = D.hisSystem.lines.map(function (l) { return "<p>“" + esc(l) + "”</p>"; }).join("");
  $("#hisFacts").innerHTML = D.hisSystem.facts.map(function (l) { return "<li>" + esc(l) + "】</li>"; }).join("");
  $("#hisSecret").textContent = D.hisSystem.secret;

  /* ── 储物空间 ── */
  $("#items-grid").innerHTML = D.items.map(function (it) {
    return '<article class="item"><span class="item-kind">' + esc(it.kind) + "</span><h4>" + esc(it.name) + "</h4><p>" + esc(it.text) + "</p>" +
      (it.hint ? '<details class="secret"><summary>来历</summary><p>' + esc(it.hint) + "</p></details>" : "") + "</article>";
  }).join("");
  $("#laterList").innerHTML = D.itemsLater.map(function (it) { return "<li><b>" + esc(it.name) + "</b><span>" + esc(it.text) + "</span></li>"; }).join("");

  /* ── 境界 ── */
  var total = 0; D.realms.forEach(function (t) { if (t.tier !== "超脱") total += t.list.length; });
  var idx = 0;
  $("#ladder").innerHTML = D.realms.map(function (t) {
    var beyond = t.tier === "超脱";
    var rows = t.list.map(function (r) {
      var w = beyond ? 100 : (4 + (idx / (total - 1)) * 96);
      idx++;
      var here = r[2] === "he";
      var alias = (!beyond && r[3]) ? "<small>" + esc(r[3]) + "</small>" : "";
      var holders = (beyond && r[3]) ? "<em>" + esc(r[3]) + "</em>" : "";
      return '<li class="rung' + (here ? " here" : "") + '" data-tier="' + esc(t.tier) + '" data-name="' + esc(r[0]) + '" data-scale="' + esc(r[1] || "") + '" data-who="' + esc(r[3] || "") + '"><div class="rung-name">' + esc(r[0]) + alias + "</div>" +
        '<div class="rung-scale"><span>' + (r[1] ? esc(r[1]) : "不可言说") + " " + holders + '</span><div class="bar"><i style="--w:' + w.toFixed(1) + '%"></i></div></div>' +
        (here ? '<span class="here-tag">何阳 · 卷一</span>' : "") + "</li>";
    }).join("");
    return '<div class="tier' + (beyond ? " beyond" : "") + '"><div class="tier-h"><h3>' + esc(t.tier) + "</h3><small>" + esc(t.note) + '</small></div><ol class="rungs">' + rows + "</ol></div>";
  }).join("");

  /* ── 终焉纪 ── */
  $("#tCaps").innerHTML = D.legend.map(function (l, i) {
    return '<li class="t-cap" data-i="' + i + '"><span class="t-no">' + "壹贰叁肆伍陆柒"[i] + "</span><h4>" + esc(l.h) + "</h4><p>" + esc(l.t) + "</p>" +
      (l.secret ? '<p class="t-secret"><span class="spoiler" tabindex="0" role="button" aria-label="剧透，点击显示">' + esc(l.secret) + "</span></p>" : "") + "</li>";
  }).join("");
  $("#foes").innerHTML = D.enemies.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("");
  (function drawEight() {
    var E = {}; D.eight.forEach(function (p) { E[p.id] = p; });
    var pos = {
      zhongyan: [150, 90], qiyuan: [450, 90],
      ailian: [55, 290], lunhui: [150, 290], mingyun: [245, 290],
      yanmie: [355, 290], huanmeng: [450, 290], taichu: [545, 290],
      heyang: [150, 480]
    };
    var g = "#C9A45B", gh = "#EBD7A2", moon = "#D7E2E5", dim = "#8D9AA2", seal = "#A5342B";
    var s = '<svg class="eight-svg" viewBox="0 0 600 560" role="img" aria-label="天庭师徒八人关系图"><defs>' +
      '<radialGradient id="nodeG" cx="40%" cy="35%"><stop offset="0" stop-color="#2a2416"/><stop offset="1" stop-color="#07070a"/></radialGradient>' +
      '<radialGradient id="nodeS" cx="40%" cy="35%"><stop offset="0" stop-color="#c0463b"/><stop offset="1" stop-color="#5e1c17"/></radialGradient></defs>';
    function line(a, b, dash, col) {
      return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + (col || g) + '" stroke-width="1.2"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + ' opacity=".75"/>';
    }
    // 道侣 · 决裂：断开的线
    s += '<line x1="190" y1="90" x2="285" y2="90" stroke="' + gh + '" stroke-width="1.6"/><line x1="315" y1="90" x2="410" y2="90" stroke="' + gh + '" stroke-width="1.6"/>';
    s += '<path d="M292 80 L300 90 L294 99 L306 100" fill="none" stroke="' + seal + '" stroke-width="2"/>';
    s += '<text x="300" y="68" text-anchor="middle" font-size="16" fill="' + gh + '" letter-spacing="4">道侣 · 决裂</text>';
    ["ailian", "lunhui", "mingyun"].forEach(function (k) { s += line([150, 130], [pos[k][0], pos[k][1] - 34]); });
    ["yanmie", "huanmeng", "taichu"].forEach(function (k) { s += line([450, 130], [pos[k][0], pos[k][1] - 34]); });
    s += '<text x="92" y="196" font-size="14" fill="' + dim + '" letter-spacing="3">三徒</text><text x="486" y="196" font-size="14" fill="' + dim + '" letter-spacing="3" text-anchor="end">三徒</text>';
    // 何阳：终焉的轮回身，哀怜轮回命运以残魂铸造
    s += '<path d="M150 130 C 20 230, 20 380, 120 452" fill="none" stroke="' + seal + '" stroke-width="1.3" stroke-dasharray="5 5"/>';
    s += '<text x="18" y="400" font-size="14" fill="#E8B3AA" letter-spacing="2">残魂 · 轮回身</text>';
    ["ailian", "lunhui", "mingyun"].forEach(function (k) { s += line([pos[k][0], pos[k][1] + 56], [150, 446], "2 5", "#E8B3AA"); });
    s += '<text x="270" y="420" font-size="14" fill="#E8B3AA" letter-spacing="2">铸人 · 造系统</text>';
    function node(k, p, r, fillId, title, tier, sym, nameCol) {
      var x = pos[k][0], y = pos[k][1];
      return '<g><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#' + fillId + ')" stroke="' + gh + '" stroke-width="1"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 5) + '" fill="none" stroke="' + g + '" stroke-width=".6" opacity=".45"/>' +
        '<text x="' + x + '" y="' + (y + r * 0.36) + '" text-anchor="middle" font-size="' + Math.round(r * 1.05) + '" fill="' + gh + '" font-family="Zhi Mang Xing, KaiTi, serif">' + sym + "</text>" +
        '<text x="' + x + '" y="' + (y + r + 26) + '" text-anchor="middle" font-size="19" font-weight="900" fill="' + (nameCol || moon) + '" letter-spacing="2">' + title + "</text>" +
        (tier ? '<text x="' + x + '" y="' + (y + r + 46) + '" text-anchor="middle" font-size="12.5" fill="' + dim + '" letter-spacing="1">' + tier + "</text>" : "") + "</g>";
    }
    D.eight.forEach(function (p) {
      var big = p.id === "zhongyan" || p.id === "qiyuan";
      s += node(p.id, p, big ? 36 : 26, "nodeG", esc(p.name), esc(p.tier), esc(p.sym));
    });
    s += node("heyang", null, 30, "nodeS", "何阳", "卷一 · 化神", "阳", "#F2C9C1");
    s += "</svg>";
    $("#eightSvg").innerHTML = s;
  })();

  /* ── 大纲 ── */
  $("#vols").innerHTML = D.outline.map(function (v) {
    return '<div class="vol"><div class="vol-h"><h3>' + esc(v.name.split(" · ")[1] || v.name) + (v.bu ? BU : "") + "</h3><small>" + esc(v.name.split(" · ")[0]) + " · " + esc(v.realm) + "</small>" + (v.done ? '<span class="done-tag">' + esc(v.done) + "</span>" : "") + "</div>" +
      '<div><ol class="beats">' + v.beats.slice(0, 3).map(function (b) { return "<li>" + spoil(b) + "</li>"; }).join("") + "</ol>" +
      (v.beats.length > 3 ? '<details class="more"><summary>展开其余 ' + (v.beats.length - 3) + ' 个情节点</summary><ol class="beats">' + v.beats.slice(3).map(function (b) { return "<li>" + spoil(b) + "</li>"; }).join("") + "</ol></details>" : "") + "</div></div>";
  }).join("");
  document.addEventListener("click", function (e) {
    var sp = e.target.closest(".spoiler"); if (sp) sp.classList.toggle("shown");
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("spoiler")) { e.preventDefault(); e.target.classList.toggle("shown"); }
  });
  $("#spoilAll").addEventListener("change", function () { $("#outline").classList.toggle("show-all", this.checked); });

  /* ── 顶栏高亮 ── */
  var navLinks = $$(".nav a");
  if ("IntersectionObserver" in window) {
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        navLinks.forEach(function (a) {
          var on = a.getAttribute("href") === "#" + id;
          a.classList.toggle("on", on);
          if (on && a.scrollIntoView && window.innerWidth < 900) a.parentNode.scrollTo({ left: a.offsetLeft - 40, behavior: reduced ? "auto" : "smooth" });
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["profile", "lore", "people", "mirror", "items", "world", "realms", "legend", "factions", "threads", "outline"].forEach(function (id) { var el = document.getElementById(id); if (el) secIO.observe(el); });
  }

  /* ── 下坠：墨点落下，渐渐变成星 ── */
  (function descent() {
    var box = $("#descent"), cv = $("canvas", box); if (!cv) return;
    var ctx = cv.getContext("2d"), W, H, dpr, ps = [], run = false, raf;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = box.clientWidth; H = box.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, init) {
      p.x = Math.random() * W; p.y = init ? Math.random() * H : -10 - Math.random() * 60;
      p.v = 0.25 + Math.random() * 0.9; p.r = 0.6 + Math.random() * 2.2; p.ph = Math.random() * 6.28;
      return p;
    }
    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.y += p.v * (1 + p.y / H * 1.4); p.x += Math.sin(t / 1400 + p.ph) * 0.15;
        if (p.y > H + 10) spawn(p);
        var k = Math.max(0, Math.min(1, (p.y / H - 0.25) / 0.5));
        var a = 0.55 + 0.45 * Math.sin(t / 500 + p.ph);
        if (k < 1) {
          ctx.fillStyle = "rgba(21,23,26," + ((1 - k) * 0.55).toFixed(3) + ")";
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.8, p.r * 1.5, 0, 0, 6.283); ctx.fill();
        }
        if (k > 0) {
          ctx.fillStyle = "rgba(235,215,162," + (k * a).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0, 6.283); ctx.fill();
          if (p.r > 2) { ctx.fillStyle = "rgba(235,215,162," + (k * a * 0.12).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill(); }
        }
      }
      if (run) raf = requestAnimationFrame(frame);
    }
    size();
    for (var i = 0; i < Math.round(Math.min(140, W / 7)); i++) ps.push(spawn({}, true));
    window.addEventListener("resize", size);
    if (reduced) { frame(0); return; }
    onVisible(box, function () { if (!run) { run = true; raf = requestAnimationFrame(frame); } }, function () { run = false; cancelAnimationFrame(raf); }, "0px");
    frame(0);
  })();

  /* ── 归墟：万道之字卷入深渊（字形预渲染成贴图） ── */
  (function vortex() {
    var box = $("#vortex"), cv = $("canvas", box); if (!cv) return;
    var ctx = cv.getContext("2d"), W, H, dpr, cx, cy, R, ps = [], run = false, raf;
    var small = window.innerWidth < 760;
    var glyphs = "剑火雷阵符龙凰风水土金木鼎镜轮命梦灭初源焉道法空时因果生死星天地仙魔佛妖鬼神气血魂魄琴弓匕塔图笔墨尘元虚无".split("");
    var sprites = [];
    function bake() {
      sprites = glyphs.map(function (g) {
        var c = document.createElement("canvas"); c.width = c.height = 72;
        var x = c.getContext("2d"); x.font = '56px "Zhi Mang Xing", "KaiTi", serif';
        x.textAlign = "center"; x.textBaseline = "middle"; x.shadowColor = "rgba(235,215,162,.8)"; x.shadowBlur = 10;
        x.fillStyle = "#F1DFAE"; x.fillText(g, 36, 38); return c;
      });
    }
    var dot = (function () { var c = document.createElement("canvas"); c.width = c.height = 16; var x = c.getContext("2d"); var g = x.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, "rgba(255,240,205,1)"); g.addColorStop(1, "rgba(201,164,91,0)"); x.fillStyle = g; x.fillRect(0, 0, 16, 16); return c; })();
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.75);
      W = box.clientWidth; H = box.clientHeight; cx = W / 2; cy = H * 0.48; R = Math.hypot(W, H) * 0.55;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, init) {
      p.a = Math.random() * 6.283; p.r = init ? 40 + Math.random() * R : R * (0.8 + Math.random() * 0.3);
      p.g = (Math.random() * glyphs.length) | 0; p.s = 14 + Math.random() * 18; p.k = Math.random() < 0.16; return p;
    }
    function frame() {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(3,3,4,0.3)"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.a += 0.9 / Math.pow(Math.max(p.r, 30), 0.72); p.r -= 0.35 + 70 / (p.r + 20);
        if (p.r < 26) spawn(p);
        var x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * 0.6;
        var near = 1 - Math.min(1, p.r / R), alpha = Math.min(1, near * 1.6) * (p.r < 60 ? p.r / 60 : 1);
        if (p.k && sprites.length) {
          var sz = p.s * (0.35 + 0.65 * Math.min(1, p.r / (R * 0.5)));
          ctx.globalAlpha = alpha * 0.9; ctx.drawImage(sprites[p.g], x - sz / 2, y - sz / 2, sz, sz);
        } else { ctx.globalAlpha = alpha * 0.8; ctx.drawImage(dot, x - 2, y - 2, 4, 4); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.6);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
      g.addColorStop(0, "#000"); g.addColorStop(0.55, "rgba(0,0,0,.96)"); g.addColorStop(0.72, "rgba(235,215,162,.28)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 100, 0, 6.283); ctx.fill(); ctx.restore();
      if (run) raf = requestAnimationFrame(frame);
    }
    size(); bake();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(bake);
    for (var i = 0; i < (small ? 260 : 520); i++) ps.push(spawn({}, true));
    window.addEventListener("resize", size);
    ctx.fillStyle = "#030304"; ctx.fillRect(0, 0, W, H);
    if (reduced) { for (var k = 0; k < 40; k++) frame(); return; }
    onVisible(box, function () { if (!run) { run = true; raf = requestAnimationFrame(frame); } }, function () { run = false; cancelAnimationFrame(raf); }, "0px");
    for (var j = 0; j < 30; j++) frame();
  })();

  /* ── 显现：标题笔锋扫出，卡片浮起 ── */
  (function reveal() {
    if (reduced || !("IntersectionObserver" in window)) return;
    var sel = ".brush-title, .sec-sub, .lead, .person, .item, .lore-item, .faction, .thread, .cheat, .facts > div, .title-note, .beats li, .sys-row, .later-list li, .rung";
    var els = $$(sel);
    document.documentElement.classList.add("rv");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, sib = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
        el.style.setProperty("--d", Math.min(sib, 8) * 0.06 + "s");
        el.classList.add("in"); io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () { els.forEach(function (el) { el.classList.add("in"); }); }, 20000);
  })();

  /* ── 首屏视差 ── */
  (function parallax() {
    if (reduced) return;
    var art = $("#heroArt"), title = $(".title-block"), side = $(".hero-side"), hero = $("#top"), ticking = false;
    function upd() {
      ticking = false;
      var y = Math.min(window.scrollY, hero.offsetHeight);
      art.style.transform = "translate3d(0," + (y * 0.35).toFixed(1) + "px,0) scale(" + (1 + y / 4000).toFixed(4) + ")";
      title.style.transform = "translate3d(0," + (y * 0.18).toFixed(1) + "px,0)";
      side.style.transform = "translate3d(0," + (y * -0.06).toFixed(1) + "px,0)";
      side.style.opacity = String(Math.max(0, 1 - y / (hero.offsetHeight * 0.9)));
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  })();
})();
