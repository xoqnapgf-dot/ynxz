/* 人物关系（样稿）：按地点把角色排成一圈，关系连红线；点人看关系与出处，点外地的人跳到那个地点。
   数据：GALLERY_DATA（角色、属地）· LOCATION_DATA / LOCATION_ALIAS（地点层级）· RELATION_DATA（关系） */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var G = window.GALLERY_DATA || [], L = window.LOCATION_DATA || {}, A = window.LOCATION_ALIAS || {}, R = window.RELATION_DATA || [];
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var canon = function (s) { s = String(s).trim(); return L[s] ? s : (A[s] || s); };
  var NS = 'http://www.w3.org/2000/svg';

  /* ---- 角色与所属地点 ---- */
  var chars = {}, byPlace = {};
  G.forEach(function (ideo) {
    (ideo.characters || []).forEach(function (c) {
      var info = c.info || [], get = function (k) { var x = info.find(function (i) { return i.k === k; }); return x ? x.v : ''; };
      var loc = get('属地');
      if (!loc) return;
      var parts = loc.split(/\s*[·・]\s*/).map(canon), root = parts[0], seen = {};
      while (L[root] && L[root].parent && !seen[root]) { seen[root] = 1; root = canon(L[root].parent); }
      var sub = parts.filter(function (p) { return p !== root; }).join(' · ');
      var id = get('身份').split(/\s*[·・]\s*/).pop();
      chars[c.id] = { id: c.id, name: c.name, ideo: ideo.name, place: root, sub: sub, role: id, born: get('出生日期'), thumb: (c.images && c.images[0] && c.images[0].thumb) || '', bio: c.bio || '' };
      (byPlace[root] = byPlace[root] || []).push(c.id);
    });
  });
  var rels = R.filter(function (r) { return chars[r.a] && chars[r.b]; });
  var relCount = {};
  rels.forEach(function (r) { [chars[r.a].place, chars[r.b].place].forEach(function (p) { relCount[p] = (relCount[p] || 0) + 1; }); });
  var places = Object.keys(byPlace).sort(function (a, b) { return (relCount[b] || 0) - (relCount[a] || 0) || byPlace[b].length - byPlace[a].length; });

  var qs = new URLSearchParams(location.search);
  var cur = places.indexOf(canon(qs.get('place') || '')) >= 0 ? canon(qs.get('place')) : places[0];
  var sel = qs.get('c') && chars[qs.get('c')] ? qs.get('c') : null;

  /* ---- 地点切换条 ---- */
  $('relPlaces').innerHTML = places.map(function (p) {
    return '<button type="button" role="tab" data-place="' + esc(p) + '"' + (relCount[p] ? ' class="has-rel"' : '') + '>' + esc(p) + '<small>' + byPlace[p].length + '</small></button>';
  }).join('');
  $('relPlaces').addEventListener('click', function (e) { var b = e.target.closest('[data-place]'); if (b) go(b.dataset.place, null); });

  function go(place, id) {
    cur = place; sel = id;
    var u = new URL(location.href);
    u.searchParams.set('place', place);
    if (id) u.searchParams.set('c', id); else u.searchParams.delete('c');
    history.replaceState(null, '', u);
    render();
  }

  /* ---- 排布：有关系的人尽量挨着坐（交换求最短的总间隔） ---- */
  function order(ids) {
    var n = ids.length, ix = {}, edges = [];
    ids.forEach(function (id, i) { ix[id] = i; });
    rels.forEach(function (r) { if (r.a in ix && r.b in ix) edges.push([r.a, r.b]); });
    var seq = ids.slice().sort(function (a, b) {
      var da = edges.filter(function (e) { return e[0] === a || e[1] === a; }).length, db = edges.filter(function (e) { return e[0] === b || e[1] === b; }).length;
      return db - da;
    });
    if (!edges.length || n < 4) return seq;
    var cost = function () {
      var at = {}; seq.forEach(function (id, i) { at[id] = i; });
      return edges.reduce(function (s, e) { var d = Math.abs(at[e[0]] - at[e[1]]); return s + Math.min(d, n - d); }, 0);
    };
    var best = cost(), better = true;
    while (better) {
      better = false;
      for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
        var t = seq[i]; seq[i] = seq[j]; seq[j] = t;
        var c = cost();
        if (c < best) { best = c; better = true; } else { t = seq[i]; seq[i] = seq[j]; seq[j] = t; }
      }
    }
    // 让关系最多的人坐到正上方
    var hub = seq.reduce(function (m, id) { var k = edges.filter(function (e) { return e[0] === id || e[1] === id; }).length; return k > m[1] ? [id, k] : m; }, [seq[0], -1])[0];
    var h = seq.indexOf(hub);
    return seq.slice(h).concat(seq.slice(0, h));
  }

  // 椭圆上按「卡片尺寸归一后的弧长」等距取点：卡片竖长，两侧要比上下排得疏一些
  function ringPoints(n, rx, ry, w, h) {
    var N = 720, pts = [], len = [0];
    for (var i = 0; i <= N; i++) { var t = -Math.PI / 2 + i / N * Math.PI * 2; pts.push([Math.cos(t) * rx, Math.sin(t) * ry]); if (i) len.push(len[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) / w, (pts[i][1] - pts[i - 1][1]) / h)); }
    var total = len[N], out = [], k = 0;
    for (var j = 0; j < n; j++) { var want = j / n * total; while (k < N && len[k + 1] < want) k++; out.push(pts[k]); }
    return { pts: out, room: total / Math.max(1, n) };
  }

  var pos = {}, geo = {};
  function render() {
    [].forEach.call($('relPlaces').children, function (b) { b.setAttribute('aria-selected', String(b.dataset.place === cur)); });
    var board = $('relBoard'), ids = order(byPlace[cur] || []), n = ids.length, W = board.clientWidth, narrow = W < 600;
    // 手机上人多时把纸板拉长，免得照片叠在一起
    var wantH = narrow ? Math.round(W * (n > 10 ? 1.75 : 1.45)) + 'px' : '';
    if (board.style.height !== wantH) board.style.height = wantH;
    var H = board.clientHeight, cx = W / 2, cy = H / 2;
    // 卡片从大往小试，直到一圈能放下（归一弧长每张至少 1.08 张卡）
    var w = narrow ? 76 : 96, h, rx, ry, ring;
    for (;;) {
      h = w * 1.6; rx = cx - w * .58 - 4; ry = cy - h * .52 - 6;
      ring = ringPoints(n, rx, ry, w, h);
      if (ring.room >= 1.08 || w <= 50) break;
      w -= 2;
    }
    // 中间的地点照片：不压到环上的卡片
    var placeW = Math.max(96, Math.min(narrow ? 150 : 220, (rx - w * .55) * 2 - 24, ((ry - h * .52) * 2 - 24 - (narrow ? 44 : 72)) / .667));
    var placeH = placeW * .667 + (narrow ? 44 : 72);
    geo = { cx: cx, cy: cy, hw: placeW / 2 + 10, hh: placeH / 2 + 10 };
    pos = {};
    ids.forEach(function (id, i) { pos[id] = { x: cx + ring.pts[i][0], y: cy + ring.pts[i][1], r: ((i * 37) % 9 - 4) * .9 }; });
    // 外地关联：本地点的人与别处的人有关系时，把对方小一号贴在相连的人外侧
    var far = [];
    rels.forEach(function (r) {
      var A1 = chars[r.a], B1 = chars[r.b];
      if (A1.place === cur && B1.place !== cur && far.indexOf(r.b) < 0) far.push(r.b);
      if (B1.place === cur && A1.place !== cur && far.indexOf(r.a) < 0) far.push(r.a);
    });
    far.forEach(function (id, i) {
      var mate = rels.filter(function (r) { return r.a === id || r.b === id; }).map(function (r) { return r.a === id ? r.b : r.a; }).find(function (m) { return pos[m] && !pos[m].far; });
      var p = pos[mate] || { x: cx, y: cy }, dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      pos[id] = { x: Math.min(W - w * .4, Math.max(w * .4, p.x + dx / d * w * .9 + (i % 2 ? 18 : -18))), y: Math.min(H - h * .35, Math.max(h * .35, p.y + dy / d * h * .45)), r: 4, far: true };
    });

    // 节点
    var loc = L[cur] || {}, html = '';
    html += '<div class="rel-place" style="left:' + cx + 'px;top:' + cy + 'px;width:' + placeW.toFixed(0) + 'px">' +
      (loc.image ? '<img src="' + esc(loc.image) + '" alt="" loading="lazy">' : '') +
      '<b>' + esc(cur) + '</b><small>' + esc(loc.kind || '') + ' · ' + n + ' 人</small>' +
      (narrow ? '' : '<a href="map.html?place=' + encodeURIComponent(cur) + '">在地图上看</a>') + '</div>';
    ids.concat(far).forEach(function (id) {
      var c = chars[id], p = pos[id], isFar = !!p.far;
      html += '<button type="button" class="rel-node' + (isFar ? ' far' : '') + '" data-id="' + esc(id) + '" style="left:' + p.x.toFixed(1) + 'px;top:' + p.y.toFixed(1) + 'px;--w:' + (isFar ? Math.round(w * .68) : Math.round(w)) + 'px;--r:' + p.r.toFixed(1) + 'deg" aria-label="' + esc(c.name) + '">' +
        (c.thumb ? '<img src="' + esc(c.thumb) + '" alt="" loading="lazy">' : '') +
        '<b>' + esc(c.name.split(/[·・]/)[0]) + '</b><small>' + esc(isFar ? '↗ ' + c.place : (c.sub || c.role || c.ideo)) + '</small></button>';
    });
    // 线与标签
    var svg = $('relLines'); svg.innerHTML = ''; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var tags = '';
    rels.forEach(function (r, i) {
      var a = pos[r.a], b = pos[r.b];
      if (!a || !b) return;
      // 略向圆心弯，像拉过去的线；弯过去会压到中间照片的，改成从照片外侧绕
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, qx = mx + (cx - mx) * .28, qy = my + (cy - my) * .28;
      if (hitsPlace(a, b, qx, qy)) {
        var ux = mx - cx, uy = my - cy, ul = Math.hypot(ux, uy);
        if (ul < 1) { ux = -(b.y - a.y); uy = b.x - a.x; ul = Math.hypot(ux, uy) || 1; }
        ux /= ul; uy /= ul;
        // 沿 u 方向走到照片边框外，再让曲线顶点落在那里（二次曲线顶点 = (中点 + 控制点) / 2）
        var reach = Math.min(Math.abs(ux) > 1e-3 ? geo.hw / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-3 ? geo.hh / Math.abs(uy) : 1e9) + 14;
        var px = cx + ux * reach, py = cy + uy * reach;
        qx = 2 * px - mx; qy = 2 * py - my;
      }
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M' + a.x + ' ' + a.y + ' Q' + qx + ' ' + qy + ' ' + b.x + ' ' + b.y);
      path.setAttribute('class', (r.sure ? '' : 'maybe') + (a.far || b.far ? ' far' : ''));
      path.dataset.a = r.a; path.dataset.b = r.b;
      svg.appendChild(path);
      // 纸签放在曲线顶点，再往圆心挪一点，少压照片的名字
      var tx = .25 * a.x + .5 * qx + .25 * b.x, ty = .25 * a.y + .5 * qy + .25 * b.y;
      if (!hitsPlace(a, b, qx, qy)) { tx += (cx - tx) * .14; ty += (cy - ty) * .14; }
      tags += '<span class="rel-tag' + (r.sure ? '' : ' maybe') + '" data-a="' + esc(r.a) + '" data-b="' + esc(r.b) + '" style="left:' + tx.toFixed(1) + 'px;top:' + ty.toFixed(1) + 'px">' + esc(r.label) + '</span>';
    });
    $('relNodes').innerHTML = html + tags;
    if (sel && !pos[sel]) sel = null;
    focus();
  }

  function hitsPlace(a, b, qx, qy) {
    for (var i = 1; i < 20; i++) {
      var t = i / 20, u = 1 - t, x = u * u * a.x + 2 * u * t * qx + t * t * b.x, y = u * u * a.y + 2 * u * t * qy + t * t * b.y;
      if (Math.abs(x - geo.cx) < geo.hw && Math.abs(y - geo.cy) < geo.hh) return true;
    }
    return false;
  }

  /* ---- 选中：高亮相关的线与人，侧栏列关系与出处 ---- */
  function focus() {
    var board = $('relBoard');
    board.classList.toggle('focus', !!sel);
    var on = {}; if (sel) on[sel] = 1;
    rels.forEach(function (r) { if (r.a === sel) on[r.b] = 1; if (r.b === sel) on[r.a] = 1; });
    [].forEach.call(board.querySelectorAll('.rel-node'), function (el) { el.classList.toggle('on', !!on[el.dataset.id]); el.classList.toggle('sel', el.dataset.id === sel); });
    [].forEach.call(board.querySelectorAll('path, .rel-tag'), function (el) { el.classList.toggle('on', el.dataset.a === sel || el.dataset.b === sel); });
    side();
  }
  function side() {
    var s = $('relSide');
    if (!sel) {
      var ids = byPlace[cur] || [], mine = rels.filter(function (r) { return chars[r.a].place === cur || chars[r.b].place === cur; });
      s.innerHTML = '<h3>' + esc(cur) + '</h3><p class="sub">' + ids.length + ' 位角色 · ' + mine.length + ' 条关系</p>' +
        '<p>' + (mine.length ? '点一张照片，看这个人和谁有关、出处在哪段人设里。和外地的人有关系时，对方会以小照片出现在外圈，再点一次就跳过去。' : '这里的人物关系还没有录入，目前只摆出住在这里的人。') + '</p>' +
        '<div class="acts"><a href="map.html?place=' + encodeURIComponent(cur) + '">在地图上看</a></div>';
      return;
    }
    var c = chars[sel], mine2 = rels.filter(function (r) { return r.a === sel || r.b === sel; });
    s.innerHTML = '<h3>' + esc(c.name) + '</h3><p class="sub">' + esc(c.ideo) + (c.role ? ' · ' + esc(c.role) : '') + (c.born ? ' · ' + esc(c.born) : '') + '<br>' + esc(c.place + (c.sub ? ' · ' + c.sub : '')) + '</p>' +
      '<h4>关系</h4>' + (mine2.length ? '<ul>' + mine2.map(function (r) {
        var o = chars[r.a === sel ? r.b : r.a];
        return '<li><button type="button" data-go="' + esc(o.id) + '">' + esc(o.name) + '</button>' + (o.place !== cur ? ' <small>（' + esc(o.place) + '）</small>' : '') +
          '<span class="lab' + (r.sure ? '' : ' maybe') + '">' + esc(r.label) + '</span><q>' + esc(r.src) + '</q></li>';
      }).join('') + '</ul>' : '<p>还没有录入这个人的关系。</p>') +
      '<div class="acts"><a href="gallery.html?cat=character&amp;open=' + encodeURIComponent(c.id) + '">看人设</a>' +
      (c.place !== cur ? '<a href="#" data-place-go="' + esc(c.place) + '">去' + esc(c.place) + '</a>' : '') + '</div>';
  }

  $('relNodes').addEventListener('click', function (e) {
    var n = e.target.closest('.rel-node');
    if (!n) return;
    var id = n.dataset.id;
    if (n.classList.contains('far') && sel === id) { go(chars[id].place, id); return; }   // 再点一次外地的人：跳过去
    sel = sel === id ? null : id;
    go(cur, sel);
  });
  $('relBoard').addEventListener('click', function (e) { if (!e.target.closest('.rel-node, .rel-place') && sel) go(cur, null); });
  $('relSide').addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]'); if (b) { var o = chars[b.dataset.go]; go(o.place === cur || pos[o.id] ? cur : o.place, o.id); return; }
    var p = e.target.closest('[data-place-go]'); if (p) { e.preventDefault(); go(p.dataset.placeGo, sel); }
  });
  var t = 0;
  new ResizeObserver(function () { clearTimeout(t); t = setTimeout(render, 60); }).observe($('relBoard'));
  render();
})();
