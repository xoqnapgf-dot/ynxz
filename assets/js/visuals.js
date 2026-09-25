/* 可视化：境界攀升长卷、伏线弧图、诸势星图、五境图、天罡阁剖面、法宝图标 */
(function () {
  "use strict";
  var D = window.WDGX, U = window.WDGX_util;
  if (!D) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var NS = "http://www.w3.org/2000/svg";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var GOLD = "#C9A45B", GH = "#EBD7A2", MOON = "#D7E2E5", DIM = "#8D9AA2", SEAL = "#A5342B", INK = "#15171A";

  function drawOnView(svg) {
    if (!("IntersectionObserver" in window) || (U && U.reduced)) { svg.classList.add("drawn"); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { svg.classList.add("drawn"); io.disconnect(); } }); }, { threshold: 0.25 });
    io.observe(svg);
  }

  /* ── 1 境界攀升长卷 ── */
  (function ascent() {
    var host = $("#ascent"); if (!host) return;
    var vols = ["星源天", "无疆界", "蓝星", "诸天", "时间树", "归墟"];
    var W = 1200, H = 540, L = 70, R = 40, T = 60, B = 90;
    var bw = (W - L - R) / vols.length;
    function y(r) { return H - B - (r / 19) * (H - T - B); }
    function x(v, f) { return L + bw * (v + f); }
    var pts = [
      [0, 0.1, 1, "筑基"], [0, 0.5, 2, "金丹"], [0, 0.88, 3, "化神"],
      [1, 0.2, 4, "合体"], [1, 0.6, 7, "天仙"], [1, 0.9, 8, "天尊"],
      [2, 0.35, 8, ""], [2, 0.55, 0.4, "凡人一生", "fall"], [2, 0.9, 8, ""],
      [3, 0.08, 9.5, "真仙"], [3, 0.28, 11, "仙君"], [3, 0.46, 12, "仙王"], [3, 0.64, 13, "仙尊"], [3, 0.8, 13.6, "准仙帝"], [3, 0.95, 14, "仙帝"],
      [4, 0.45, 15, "帝主"], [4, 0.66, 0.4, "法则不存", "fall"], [4, 0.9, 15.4, ""],
      [5, 0.55, 17, ""], [5, 0.8, 19.2, "至高", "top"]
    ];
    var d = "", pp = pts.map(function (p) { return [x(p[0], p[1]), y(p[2])]; });
    pp.forEach(function (p, i) {
      if (!i) { d += "M" + p[0] + " " + p[1]; return; }
      var q = pp[i - 1], mx = (q[0] + p[0]) / 2;
      d += " C" + mx + " " + q[1] + " " + mx + " " + p[1] + " " + p[0] + " " + p[1];
    });
    var s = '<svg class="ascent-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="何阳的境界攀升曲线"><defs>' +
      '<linearGradient id="ascG" x1="0" x2="1"><stop offset="0" stop-color="#8A6D33"/><stop offset=".7" stop-color="' + GH + '"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
      '<filter id="ascGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>' +
      '<linearGradient id="ascFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + GOLD + '" stop-opacity=".22"/><stop offset="1" stop-color="' + GOLD + '" stop-opacity="0"/></linearGradient></defs>';
    vols.forEach(function (v, i) {
      s += '<rect x="' + x(i, 0) + '" y="' + (T - 30) + '" width="' + bw + '" height="' + (H - T - B + 30) + '" fill="' + (i % 2 ? "rgba(201,164,91,.035)" : "transparent") + '"/>';
      s += '<text class="asc-vol" x="' + x(i, 0.5) + '" y="' + (H - 34) + '" text-anchor="middle">' + v + "</text>";
      s += '<text class="asc-volno" x="' + x(i, 0.5) + '" y="' + (H - 12) + '" text-anchor="middle">' + ["卷一", "卷二", "卷三", "卷四", "卷五", "终卷"][i] + "</text>";
    });
    [[1, "星源天"], [5, "无疆界"], [9.5, "诸天万界"], [16, "超脱"]].forEach(function (g) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g[0]) + '" y2="' + y(g[0]) + '" stroke="rgba(201,164,91,.16)" stroke-dasharray="3 7"/>';
      s += '<text class="asc-tier" x="' + (L - 12) + '" y="' + (y(g[0]) + 4) + '" text-anchor="end">' + g[1] + "</text>";
    });
    s += '<path d="' + d + " L" + pp[pp.length - 1][0] + " " + (H - B) + " L" + pp[0][0] + " " + (H - B) + ' Z" fill="url(#ascFill)" class="asc-area"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + GOLD + '" stroke-width="10" opacity=".35" filter="url(#ascGlow)" class="asc-line" pathLength="1"/>';
    s += '<path d="' + d + '" fill="none" stroke="url(#ascG)" stroke-width="2.6" class="asc-line" pathLength="1"/>';
    pts.forEach(function (p, i) {
      if (!p[3]) return;
      var px = pp[i][0], py = pp[i][1], fall = p[4] === "fall", top = p[4] === "top";
      var col = fall ? SEAL : GH;
      s += '<g class="asc-pt" style="--i:' + i + '"><circle cx="' + px + '" cy="' + py + '" r="' + (top ? 9 : 5) + '" fill="' + (fall ? SEAL : "#050608") + '" stroke="' + col + '" stroke-width="1.6"/>' +
        (top ? '<circle cx="' + px + '" cy="' + py + '" r="22" fill="none" stroke="' + GH + '" stroke-width=".8" class="asc-pulse"/>' : "") +
        '<text x="' + px + '" y="' + (fall ? py + 26 : py - 14) + '" text-anchor="middle" class="asc-lbl' + (fall ? " fall" : "") + (top ? " top" : "") + '">' + p[3] + "</text></g>";
    });
    s += '<text x="' + x(0, 0.88) + '" y="' + (y(3) + 30) + '" text-anchor="middle" class="asc-now">卷一至此</text>';
    s += "</svg>";
    host.innerHTML = s;
    drawOnView(host.querySelector("svg"));
  })();

  /* ── 2 伏线弧图 ── */
  (function threads() {
    var host = $("#threadArc"), detail = $("#threadDetail"); if (!host || !D.threads) return;
    var W = 1200, H = 440, base = 360, L = 40, R = 40;
    var v1w = (W - L - R) * 0.42, ow = ((W - L - R) - v1w) / 6;
    var volX = { "卷一末": L + v1w - 8, "卷二": L + v1w + ow * 0.5, "卷三": L + v1w + ow * 1.5, "卷四": L + v1w + ow * 2.5, "卷五": L + v1w + ow * 3.5, "终卷": L + v1w + ow * 4.5, "未揭晓": L + v1w + ow * 5.5 };
    function chX(ch) { return L + (ch - 1) / 26 * (v1w - 30) + 6; }
    function plantX(t) { var m = /第(\d+)/.exec(t.where); return m ? chX(+m[1]) : chX(27); }
    function payX(t) { var k = Object.keys(volX).filter(function (k) { return t.when.indexOf(k) === 0; })[0] || (t.when.indexOf("卷二") >= 0 ? "卷二" : "终卷"); return volX[k]; }
    var s = '<svg class="arc-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="伏笔与回收连线图">';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + base + '" y2="' + base + '" stroke="rgba(201,164,91,.4)"/>';
    for (var c = 1; c <= 27; c++) s += '<line x1="' + chX(c) + '" x2="' + chX(c) + '" y1="' + base + '" y2="' + (base + (c % 5 === 0 || c === 1 ? 10 : 5)) + '" stroke="rgba(201,164,91,.45)"/>' + (c % 5 === 0 || c === 1 ? '<text class="arc-tick" x="' + chX(c) + '" y="' + (base + 24) + '" text-anchor="middle">' + c + "</text>" : "");
    s += '<text class="arc-vol" x="' + (L + v1w / 2) + '" y="' + (base + 56) + '" text-anchor="middle">卷一 · 星源天（章）</text>';
    ["卷二", "卷三", "卷四", "卷五", "终卷", "未揭晓"].forEach(function (k) { s += '<text class="arc-vol" x="' + volX[k] + '" y="' + (base + 40) + '" text-anchor="middle">' + k + '</text><circle cx="' + volX[k] + '" cy="' + base + '" r="3" fill="' + GOLD + '"/>'; });
    D.threads.forEach(function (t, i) {
      var x1 = plantX(t), x2 = payX(t), h = Math.min(base - 30, 60 + Math.abs(x2 - x1) * 0.42 + (i % 3) * 14);
      var dd = "M" + x1 + " " + base + " C" + x1 + " " + (base - h) + " " + x2 + " " + (base - h) + " " + x2 + " " + base;
      s += '<g class="arc-g' + (t.open ? " open" : "") + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(t.plant) + '"><path d="' + dd + '" class="arc-hit"/><path d="' + dd + '" class="arc-p" pathLength="1" style="--i:' + i + '"/>' +
        '<circle cx="' + x1 + '" cy="' + base + '" r="4" class="arc-dot"/></g>';
    });
    s += "</svg>";
    host.innerHTML = s;
    var svg = host.querySelector("svg"); drawOnView(svg);
    function show(i) {
      var t = D.threads[i];
      Array.prototype.forEach.call(svg.querySelectorAll(".arc-g"), function (g) { g.classList.toggle("on", +g.dataset.i === i); });
      detail.innerHTML = '<div class="td-col"><small>埋 · ' + esc(t.where) + "</small><p>" + esc(t.plant) + '</p></div><div class="td-arrow" aria-hidden="true"></div><div class="td-col"><small>收 · ' + esc(t.when) + "</small><p>" + esc(t.pay) + "</p></div>";
    }
    svg.addEventListener("click", function (e) { var g = e.target.closest(".arc-g"); if (g) show(+g.dataset.i); });
    svg.addEventListener("mouseover", function (e) { var g = e.target.closest(".arc-g"); if (g) show(+g.dataset.i); });
    svg.addEventListener("keydown", function (e) { var g = e.target.closest(".arc-g"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); show(+g.dataset.i); } });
    show(0);
  })();

  /* ── 3 诸势星图 ── */
  (function factions() {
    var host = $("#factionMap"), detail = $("#factionDetail"); if (!host) return;
    var W = 900, H = 900, cx = 450, cy = 450;
    var rings = [[120, "星源天"], [215, "无疆界"], [320, "诸天万界"], [420, "时间树之外"]];
    var place = { "星云峰": [0, -60], "太始门": [0, 60], "天罡阁": [0, 180], "无疆界仙门": [1, -110], "天庭": [2, -70], "起源神国": [2, -20], "魔尊势力": [2, 30], "火凰祖国": [2, 80], "雪狐国度": [2, 140], "始祖龙神国": [2, 200], "侵略者": [3, -150], "混沌海神灵": [3, 150] };
    var s = '<svg class="fmap-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="势力星图"><defs><radialGradient id="fmG"><stop offset="0" stop-color="' + GOLD + '" stop-opacity=".25"/><stop offset="1" stop-color="' + GOLD + '" stop-opacity="0"/></radialGradient></defs>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="440" fill="url(#fmG)"/>';
    rings.forEach(function (r, i) {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r[0] + '" fill="none" stroke="rgba(201,164,91,' + (0.35 - i * 0.06) + ')" stroke-dasharray="' + (i === 3 ? "2 8" : "none") + '" class="fm-ring" style="--i:' + i + '"/>';
      s += '<text class="fm-ringlbl" x="' + cx + '" y="' + (cy - r[0] + 22) + '" text-anchor="middle">' + r[1] + "</text>";
    });
    s += '<g class="fm-core"><circle cx="' + cx + '" cy="' + cy + '" r="34" fill="' + SEAL + '"/><circle cx="' + cx + '" cy="' + cy + '" r="29" fill="none" stroke="#F3E3DC" stroke-width="1.5"/><text x="' + cx + '" y="' + (cy + 9) + '" text-anchor="middle" class="fm-he">何阳</text></g>';
    D.factions.forEach(function (f, i) {
      var pl = place[f.name] || [2, i * 30], r = rings[pl[0]][0], a = (pl[1] - 90) * Math.PI / 180;
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" class="fm-ray' + (f.foe ? " foe" : "") + '"/>';
      s += '<g class="fm-node' + (f.foe ? " foe" : "") + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(f.name) + '"><circle cx="' + x + '" cy="' + y + '" r="' + (f.foe ? 12 : 9) + '"/><circle cx="' + x + '" cy="' + y + '" r="20" class="fm-halo"/>' +
        '<text x="' + x + '" y="' + (y + (y > cy ? 38 : -22)) + '" text-anchor="middle">' + esc(f.name) + "</text></g>";
    });
    s += "</svg>";
    host.innerHTML = s;
    var svg = host.querySelector("svg"); drawOnView(svg);
    function show(i) {
      var f = D.factions[i];
      Array.prototype.forEach.call(svg.querySelectorAll(".fm-node"), function (g) { g.classList.toggle("on", +g.dataset.i === i); });
      detail.innerHTML = '<small>' + esc(f.where) + '</small><h4 class="' + (f.foe ? "foe" : "") + '">' + esc(f.name) + "</h4><p>" + esc(f.t) + "</p>";
    }
    svg.addEventListener("click", function (e) { var g = e.target.closest(".fm-node"); if (g) show(+g.dataset.i); });
    svg.addEventListener("mouseover", function (e) { var g = e.target.closest(".fm-node"); if (g) show(+g.dataset.i); });
    svg.addEventListener("keydown", function (e) { var g = e.target.closest(".fm-node"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); show(+g.dataset.i); } });
    show(0);
  })();

  /* ── 4 五境图 & 天罡阁剖面 ── */
  (function cult() {
    var host = $("#cultDiagram"); if (!host) return;
    var st = [
      ["筑基", "打基础", '<rect x="-22" y="4" width="44" height="14" rx="1"/><rect x="-16" y="-8" width="32" height="12" rx="1" opacity=".6"/><rect x="-10" y="-18" width="20" height="10" rx="1" opacity=".35"/>'],
      ["金丹", "能量之容器", '<circle r="16" class="fill-gold"/><circle r="22" fill="none" opacity=".4"/><circle cx="-5" cy="-3" r="3" fill="#A5342B" stroke="none"/><circle cx="5" cy="4" r="2.4" fill="#A5342B" stroke="none"/>'],
      ["化神", "演化神韵", '<path d="M0 20 C-18 6 -14 -8 0 -22 C14 -8 18 6 0 20Z" class="fill-gold" opacity=".85"/><path d="M-26 0 C-14 -6 -8 -2 0 6 C8 -2 14 -6 26 0" fill="none"/>'],
      ["合体", "神形归一", '<circle cx="-8" r="14" fill="none"/><circle cx="8" r="14" fill="none"/><circle r="6" class="fill-gold"/>'],
      ["大乘", "渡劫飞升", '<circle r="10" class="fill-gold"/><g opacity=".8"><line y1="-16" y2="-26"/><line y1="16" y2="26"/><line x1="-16" x2="-26"/><line x1="16" x2="26"/><line x1="-12" y1="-12" x2="-19" y2="-19"/><line x1="12" y1="12" x2="19" y2="19"/><line x1="12" y1="-12" x2="19" y2="-19"/><line x1="-12" y1="12" x2="-19" y2="19"/></g>']
    ];
    var W = 1000, H = 220, s = '<svg class="cult-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="星源天五境">';
    s += '<path d="M80 96 L848 96" class="cult-path" pathLength="1"/>';
    st.forEach(function (x, i) {
      var cx = 80 + i * 192;
      s += '<g class="cult-node" style="--i:' + i + '" transform="translate(' + cx + ',96)"><circle r="44" class="cult-bg"/><g class="cult-ic">' + x[2] + "</g></g>";
      s += '<text class="cult-name" x="' + cx + '" y="178" text-anchor="middle">' + x[0] + '</text><text class="cult-sub" x="' + cx + '" y="204" text-anchor="middle">' + x[1] + "</text>";
    });
    s += '<path d="M900 96 L960 96" class="cult-path" stroke-dasharray="4 5"/><text class="cult-arrow" x="930" y="84" text-anchor="middle">飞升 ›</text><text class="cult-sub" x="930" y="124" text-anchor="middle">无疆界</text></svg>';
    host.innerHTML = s; drawOnView(host.querySelector("svg"));
  })();
  (function tower() {
    var host = $("#towerDiagram"); if (!host) return;
    var fl = [[99, "无量战场", "擂台守擂，以战印证"], [66, "躺平派", "吃喝玩乐，混着原住民"], [35, "利用派", "钻系统的空子"], [2, "怀疑派", "阴谋论最多"], [1, "合作派", "与系统和谐相处"]];
    var W = 520, H = 620, s = '<svg class="tower-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="天罡阁剖面">';
    s += '<path d="M150 590 L180 60 L340 60 L370 590 Z" class="tw-body"/>';
    for (var i = 0; i < 24; i++) { var y = 80 + i * 21.5, k = (y - 60) / 530, xl = 180 - 30 * k, xr = 340 + 30 * k; s += '<line x1="' + xl + '" x2="' + xr + '" y1="' + y + '" y2="' + y + '" class="tw-floor"/>'; }
    s += '<path d="M170 60 L260 14 L350 60" class="tw-roof"/><circle cx="260" cy="30" r="4" class="tw-gem"/>';
    fl.forEach(function (f, i) {
      var y = { 99: 74, 66: 232, 35: 392, 2: 506, 1: 566 }[f[0]], k = (y - 60) / 530, xr = 340 + 30 * k;
      s += '<g class="tw-mark" style="--i:' + i + '"><circle cx="' + (xr - 6) + '" cy="' + y + '" r="4"/><line x1="' + xr + '" x2="' + (xr + 34) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text x="' + (xr + 42) + '" y="' + (y - 4) + '" class="tw-f">' + f[0] + "层 · " + f[1] + '</text><text x="' + (xr + 42) + '" y="' + (y + 16) + '" class="tw-d">' + f[2] + "</text></g>";
    });
    s += '<text x="260" y="614" text-anchor="middle" class="tw-cap">应龙 · 天罡阁</text></svg>';
    host.innerHTML = s; drawOnView(host.querySelector("svg"));
  })();

  /* ── 5 法宝图标 ── */
  (function icons() {
    var IC = {
      "《登仙引》": '<rect x="18" y="14" width="28" height="36" rx="2"/><rect x="12" y="10" width="8" height="44" rx="4" class="f"/><rect x="44" y="10" width="8" height="44" rx="4" class="f"/><line x1="24" y1="22" x2="40" y2="22"/><line x1="24" y1="29" x2="40" y2="29"/><line x1="24" y1="36" x2="36" y2="36"/>',
      "破妄镜": '<circle cx="32" cy="26" r="16"/><circle cx="32" cy="26" r="11" opacity=".5"/><path d="M28 42 L28 56 M36 42 L36 56 M26 56 L38 56"/><path d="M26 20 L31 17" class="hl"/>',
      "预警罗盘": '<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="15" opacity=".4"/><path d="M32 16 L36 32 L32 48 L28 32 Z" class="f"/><path d="M32 16 L36 32 L28 32 Z" class="red"/><line x1="32" y1="8" x2="32" y2="12"/><line x1="32" y1="52" x2="32" y2="56"/><line x1="8" y1="32" x2="12" y2="32"/><line x1="52" y1="32" x2="56" y2="32"/>',
      "风吟匕": '<path d="M44 12 L30 38 L26 34 Z" class="f"/><line x1="22" y1="34" x2="34" y2="42"/><line x1="28" y1="38" x2="18" y2="52"/><path d="M40 44 C46 44 50 48 54 44 M36 50 C44 50 48 54 54 50" opacity=".6"/>',
      "蚀心弓": '<path d="M20 8 C44 20 44 44 20 56"/><line x1="20" y1="8" x2="20" y2="56" opacity=".7"/><line x1="12" y1="32" x2="54" y2="32" class="red"/><path d="M48 28 L54 32 L48 36" class="red"/>',
      "龙凤精血": '<path d="M24 14 C16 28 14 34 14 40 A10 10 0 0 0 34 40 C34 34 32 28 24 14Z" class="f"/><path d="M42 20 C36 32 34 38 34 43 A8 8 0 0 0 50 43 C50 38 48 32 42 20Z" class="redf"/>',
      "四灵图": '<circle cx="32" cy="32" r="20"/><line x1="32" y1="12" x2="32" y2="52" opacity=".5"/><line x1="12" y1="32" x2="52" y2="32" opacity=".5"/><circle cx="32" cy="20" r="3" class="f"/><circle cx="44" cy="32" r="3" class="f"/><circle cx="32" cy="44" r="3" class="redf"/><circle cx="20" cy="32" r="3" class="f"/>',
      "《绝尘剑法》": '<line x1="14" y1="50" x2="48" y2="16"/><path d="M48 16 L52 12 L50 18 Z" class="f"/><line x1="18" y1="40" x2="26" y2="48"/><line x1="12" y1="52" x2="18" y2="46" stroke-width="3"/>',
      "《归元呼吸法》": '<path d="M32 32 m0 0 a3 3 0 0 1 3 3 a6 6 0 0 1 -6 6 a9 9 0 0 1 -9 -9 a12 12 0 0 1 12 -12 a15 15 0 0 1 15 15 a18 18 0 0 1 -18 18"/>',
      "紫霄木": '<line x1="32" y1="56" x2="32" y2="26"/><path d="M32 40 L22 30 M32 34 L42 24 M32 28 L26 18 M32 28 L38 16"/><circle cx="32" cy="30" r="5" class="purple"/>'
    };
    Array.prototype.forEach.call(document.querySelectorAll("#items-grid .item"), function (el) {
      var name = el.querySelector("h4").textContent, ic = IC[name];
      if (!ic) return;
      var w = document.createElement("div"); w.className = "item-ic"; w.setAttribute("aria-hidden", "true");
      w.innerHTML = '<svg viewBox="0 0 64 64">' + ic + "</svg>";
      el.insertBefore(w, el.firstChild);
    });
  })();
})();
