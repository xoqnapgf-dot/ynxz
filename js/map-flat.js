  (function () {
    var W = 3000, H = 935, KM_PER_UNIT = 21.3;
    var stage = document.getElementById('mapStage');
    var canvas = document.getElementById('mapCanvas');
    var baseT = document.getElementById('baseTerrain');
    var baseN = document.getElementById('baseNations');
    var hotLayer = document.getElementById('hotLayer');
    var NAT = window.MAP_NATIONS || [];
    var s = 1, tx = 0, ty = 0, cw0 = 0, ch0 = 0;
    var MAXS = 6;

    function layout() {
      var sw = stage.clientWidth, sh = stage.clientHeight;
      if (!sw || !sh) return;
      var fit = Math.min(sw / W, sh / H);
      cw0 = W * fit; ch0 = H * fit;
    }
    function clampT() {
      var sw = stage.clientWidth, sh = stage.clientHeight, mw = cw0 * s, mh = ch0 * s;
      tx = (mw <= sw) ? (sw - mw) / 2 : Math.max(sw - mw, Math.min(0, tx));
      ty = (mh <= sh) ? (sh - mh) / 2 : Math.max(sh - mh, Math.min(0, ty));
    }
    function apply() {
      var w = cw0 * s, h = ch0 * s;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.style.left = tx + 'px';
      canvas.style.top = ty + 'px';
      for (var i = 0; i < hots.length; i++) {
        var n = NAT[i];
        hots[i].style.left = (tx + n.x * w) + 'px';
        hots[i].style.top = (ty + n.y * h) + 'px';
      }
      document.getElementById('zoomLvl').textContent = Math.round(s * 100) + '%';
      updateScale(w);
    }
    function centerFit() { s = 1; tx = (stage.clientWidth - cw0) / 2; ty = (stage.clientHeight - ch0) / 2; apply(); }
    function zoomAt(factor, cx, cy) {
      var ns = Math.max(1, Math.min(MAXS, s * factor));
      factor = ns / s;
      tx = cx - (cx - tx) * factor;
      ty = cy - (cy - ty) * factor;
      s = ns; clampT(); apply();
    }
    function niceNum(x) { var p = Math.pow(10, Math.floor(Math.log10(x))); var f = x / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
    function updateScale(w) {
      var kmPerPx = KM_PER_UNIT / (w / W);
      var km = niceNum(130 * kmPerPx);
      document.getElementById('scaleBar').style.width = Math.round(km / kmPerPx) + 'px';
      document.getElementById('scaleLabel').textContent = km >= 1 ? km + ' km' : Math.round(km * 1000) + ' m';
    }

    stage.addEventListener('wheel', function (e) { if (e.target.closest('.nation-card, .map-ui')) return; e.preventDefault(); var r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    var pts = {}, drag = null, pinch = null;
    function pdist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.map-ui') || e.target.closest('.hot') || e.target.closest('.nation-card')) return;
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 1) { drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty }; stage.classList.add('grabbing'); }
      else if (ids.length === 2) { drag = null; var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: pdist(a, b), s: s }; }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2 && pinch) {
        var a = pts[ids[0]], b = pts[ids[1]], r = stage.getBoundingClientRect();
        var ns = Math.max(1, Math.min(MAXS, pinch.s * (pdist(a, b) / pinch.d)));
        zoomAt(ns / s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (drag) {
        tx = drag.tx + (e.clientX - drag.x); ty = drag.ty + (e.clientY - drag.y); clampT(); apply();
      }
    });
    function endPtr(e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (!Object.keys(pts).length) { drag = null; stage.classList.remove('grabbing'); } }
    stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);

    document.getElementById('zin').onclick = function () { var r = stage.getBoundingClientRect(); zoomAt(1.3, r.width / 2, r.height / 2); };
    document.getElementById('zout').onclick = function () { var r = stage.getBoundingClientRect(); zoomAt(1 / 1.3, r.width / 2, r.height / 2); };
    document.getElementById('zfit').onclick = centerFit;

    var mode = 'terrain';
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        document.querySelectorAll('[data-mode]').forEach(function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
        baseT.classList.toggle('hide', mode !== 'terrain');
        baseN.classList.toggle('hide', mode !== 'nations');
        closeCard();
        apply();
      });
    });

    var card = document.getElementById('nationCard'), curNation = null, hots = [];
    NAT.forEach(function (n) {
      var b = document.createElement('button');
      n._ghost = n.type !== 'special' && !((window.LOCATION_DATA || {})[n.name]);
      b.className = 'hot' + (n.type === 'special' ? ' special' : '') + (n._ghost ? ' ghost' : ''); b.title = n.name; b.setAttribute('aria-label', n.name);
      b.innerHTML = '<i class="hot-dot"></i><span class="hot-name"></span>';
      if (n.color) b.querySelector('.hot-dot').style.background = n.color;
      b.querySelector('.hot-name').textContent = n.name;
      b.addEventListener('click', function (e) { e.stopPropagation(); openNation(n, b); });
      hotLayer.appendChild(b); hots.push(b);
    });
    function openNation(n, btn, emit = true) {
      curNation = n;
      document.getElementById("ncGlobe").hidden = !window.LOCATION_DATA[n.name];
      document.getElementById('ncName').textContent = n.name;
      var special = n.type === 'special';
      var loc = (window.LOCATION_DATA || {})[n.name] || {};
      var FORM_ZH = { Monarchy: '君主制', Republic: '共和制', Theocracy: '神权制', Union: '联合体' };
      var formText = special ? (n.form || loc.kind || '特殊地点') : (loc.kind || FORM_ZH[n.form] || n.form || '');
      var f = document.getElementById('ncForm'); f.textContent = formText; f.style.display = formText ? '' : 'none';
      document.getElementById('ncEnter').style.display = (special || n._ghost) ? 'none' : '';
      document.getElementById('ncDesc').textContent = n.desc || loc.desc || '该地区由地图生成器自动划定，暂无设定。';
      var gn = card.querySelector('.ghost-note');
      if (!gn) { gn = document.createElement('p'); gn.className = 'ghost-note'; document.getElementById('ncDesc').insertAdjacentElement('afterend', gn); }
      gn.textContent = n._ghost ? '尚未登场：目前没有角色归属于此地。' : '';
      gn.style.display = n._ghost ? '' : 'none';
      hots.forEach(function (h) { h.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      card.classList.add('show');
      if (emit && window.LOCATION_DATA[n.name]) window.dispatchEvent(new CustomEvent('atlas:select', {detail:{name:n.name}}));
    }
    var ghostBtn = document.getElementById('ghostToggle');
    ghostBtn.addEventListener('click', function () {
      var on = ghostBtn.getAttribute('aria-pressed') !== 'true';
      ghostBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      stage.classList.toggle('show-ghosts', on);
      if (!on) closeCard();
      apply();
    });
    function closeCard() { card.classList.remove('show'); hots.forEach(function (h) { h.classList.remove('active'); }); }
    document.getElementById('ncClose').onclick = closeCard;
    document.getElementById('ncEnter').onclick = function () { location.href = 'gallery.html?cat=ideology'; };

    /* 读坐标工具：轻点地图空白处（非拖拽、非标记）→ 显示归一化 x/y，供放置新标记用 */
    var downXY = null;
    stage.addEventListener('pointerdown', function (e) { downXY = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener('click', function (e) {
      if (e.target.closest('.map-ui') || e.target.closest('.hot') || e.target.closest('.nation-card')) return;
      if (downXY && (Math.abs(e.clientX - downXY.x) > 6 || Math.abs(e.clientY - downXY.y) > 6)) return; /* 拖拽不算 */
      var r = stage.getBoundingClientRect(), w = cw0 * s, h = ch0 * s;
      var nx = ((e.clientX - r.left) - tx) / w, ny = ((e.clientY - r.top) - ty) / h;
      var el = document.getElementById('coordReadout');
      el.textContent = 'x=' + nx.toFixed(3) + '  y=' + ny.toFixed(3);
      el.hidden = false;
    });

    var hdr = document.querySelector('.site-header');
    function setHH() { document.documentElement.style.setProperty('--hh', (hdr ? hdr.offsetHeight : 64) + 'px'); }
    window.addEventListener('resize', function () { setHH(); if (!stage.hidden) { layout(); clampT(); apply(); } });
    // Retain pan, zoom and layer when hidden; never lay out a zero-sized stage.
    if (window.ResizeObserver && hdr) new ResizeObserver(setHH).observe(hdr);
    window.__flatMap = {
      clear() { curNation = null; closeCard(); },
      resize() { setHH(); if (!stage.hidden) { layout(); clampT(); apply(); } },
      select(name, center = true) {
        if (!Object.hasOwn(window.LOCATION_DATA,name)) return false;
        const loc = window.LOCATION_DATA[name];
        let anchorName = name, anchor, seen = new Set();
        while (anchorName && !seen.has(anchorName)) {
          seen.add(anchorName); anchor = NAT.find(n => n.name === anchorName);
          if (anchor) break; anchorName = window.LOCATION_DATA[anchorName]?.parent;
        }
        if (!anchor) return false;
        const index = NAT.indexOf(anchor);
        openNation({...anchor, name, desc:loc.desc, form:loc.kind}, hots[index], false);
        if (anchor.name !== name) document.getElementById('ncDesc').textContent = '坐标未定 · 沿所属地区“' + anchor.name + '”定位。\n\n' + loc.desc;
        if (center) { s = Math.max(s, 2.2); tx = stage.clientWidth/2-anchor.x*cw0*s; ty = stage.clientHeight/2-anchor.y*ch0*s; clampT(); apply(); }
        return true;
      },
      stats: () => ({scale:s,x:tx,y:ty,mode,selected:curNation?.name,markers:hots.length})
    };
    setHH(); layout(); centerFit();
  })();

