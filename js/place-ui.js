/* 平面地图与 3D 地球共用的地点卡、相关角色和搜索建议（v23）。
   两个页面使用同一套 #ac* 卡片结构与 .atl-* 样式；页面只需提供定位、飞行等自己的行为。 */
(() => {
  'use strict';
  const LOC = window.LOCATION_DATA || {}, ALIAS = window.LOCATION_ALIAS || {};
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function chainOf(name) { const out = [], seen = new Set(); let n = LOC[name]?.parent; while (n && !seen.has(n)) { seen.add(n); out.unshift(n); n = LOC[n]?.parent; } return out; }
  const kidsOf = name => Object.keys(LOC).filter(n => LOC[n].parent === name);
  function coordText(u, v) { const A = window.ATLAS_DATA, latM = A ? 180 * A.H / A.W : 90, lon = u * 360 - 180, lat = latM * (1 - 2 * v); return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`; }

  /* 相关角色：按人设「属地」匹配地点名或别名（gallery-data.js 按需加载） */
  let peopleIndex = null, peopleLoading = null;
  function loadPeople(src) {
    if (peopleIndex) return Promise.resolve(peopleIndex);
    if (peopleLoading) return peopleLoading;
    peopleLoading = new Promise(res => {
      const done = () => {
        const idx = {}, G = window.GALLERY_DATA || [];
        for (const ideo of G) for (const c of (ideo.characters || [])) {
          const home = (c.info || []).find(i => i.k === '属地'); if (!home) continue;
          String(home.v).split('·').map(t => t.trim()).forEach(t => { const key = has(LOC, t) ? t : ALIAS[t]; if (key) (idx[key] = idx[key] || []).push({ c, ideo }); });
        }
        peopleIndex = idx; res(idx);
      };
      if (window.GALLERY_DATA || !src) return done();
      const sc = document.createElement('script'); sc.src = src; sc.onload = done; sc.onerror = () => { peopleIndex = {}; res(peopleIndex); }; document.head.appendChild(sc);
    });
    return peopleLoading;
  }

  /* 填充 #atlasCard。opts: { kind, coord, color, ghostText } */
  function fillCard(name, opts = {}) {
    const card = $('atlasCard'), d = LOC[name];
    if (opts.color) card.style.setProperty('--place', opts.color);
    $('acKind').textContent = d ? d.kind : (opts.kind || '未设定地区');
    $('acCoord').textContent = opts.coord || '';
    $('acName').textContent = name;
    const chain = chainOf(name);
    $('acTrail').innerHTML = chain.length ? chain.map(n => `<button type="button" data-go="${esc(n)}">${esc(n)}</button>`).join('<i>›</i>') + `<i>›</i><span>${esc(name)}</span>` : '';
    $('acTrail').hidden = !chain.length;
    const media = $('acMedia');
    media.hidden = !(d && d.image);
    if (d && d.image) media.innerHTML = `<img src="${esc(d.image)}" alt="${esc(name)}" loading="lazy">`;
    const desc = d ? d.desc : (opts.ghostText || '地图生成器划出的区域，还没有设定，也没有角色归属于此。');
    $('acDesc').innerHTML = String(desc).split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('');
    $('acDesc').classList.toggle('muted', !d);
    const kids = kidsOf(name);
    $('acChildren').hidden = !kids.length;
    $('acChildren').innerHTML = kids.length ? `<h3>下辖地点</h3><div class="atl-chips">${kids.map(n => `<button type="button" data-go="${esc(n)}"><b>${esc(n)}</b><small>${esc(LOC[n].kind)}</small></button>`).join('')}</div>` : '';
    const scene = $('acScene');
    if (scene) { scene.hidden = !(d && d.scene); if (d && d.scene) scene.innerHTML = `<h3>场景</h3><a class="atl-scene" href="${esc(d.scene)}">进入地点场景 →</a>`; }
    const ppl = $('acPeople'); ppl.hidden = !d; ppl.innerHTML = d ? '<h3>相关角色</h3><p class="atl-wait">正在查找…</p>' : '';
    if (d) loadPeople(card.dataset.galleryData).then(idx => {
      if ($('acName').textContent !== name) return;
      const groups = [[name, idx[name] || []]];
      kids.forEach(k => { if (idx[k]?.length) groups.push([k, idx[k]]); });
      const total = groups.reduce((a, g) => a + g[1].length, 0);
      if (!total) { ppl.innerHTML = '<h3>相关角色</h3><p class="atl-wait">暂时没有角色以此地为属地。</p>'; return; }
      ppl.innerHTML = `<h3>相关角色 <small>${total}</small></h3>` + groups.filter(g => g[1].length).map(([g, list]) => (g !== name ? `<p class="atl-sub">${esc(g)}</p>` : '') + '<div class="atl-people">' + list.map(({ c, ideo }) => {
        const im = c.images && c.images[0], th = im ? (typeof im === 'string' ? im : im.thumb) : '';
        const role = ((c.info || []).find(i => i.k === '身份') || {}).v || ideo.name;
        return `<a href="gallery.html?cat=character&open=${encodeURIComponent(c.id)}" style="--ca:${esc(ideo.theme?.accent || '#b08a4a')}"><span class="av">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : esc(c.name.slice(0, 1))}</span><span class="nm"><b>${esc(c.name)}</b><small>${esc(ideo.name)} · ${esc(String(role).replace(/^[^·]*·\s*/, ''))}</small></span></a>`;
      }).join('') + '</div>').join('');
    });
    card.scrollTop = 0;
    return { kids, known: !!d };
  }

  /* 搜索建议。entries: [{name,label,kind,canon}]；onPick(entry) */
  function search(input, list, entries, onPick) {
    let idx = -1, shown = [];
    function show() {
      const q = input.value.trim();
      shown = (q ? entries.filter(e => e.label.includes(q) || (e.kind || '').includes(q)) : entries.filter(e => e.canon && !LOC[e.name]?.parent && e.label === e.name)).slice(0, 9);
      idx = -1;
      list.innerHTML = shown.map((e, i) => `<li role="option" id="${list.id}-${i}" data-i="${i}"><b>${esc(e.label)}</b><small>${esc(e.kind || '')}</small></li>`).join('') || '<li class="none">没有找到这个地名</li>';
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    function hide() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    function pick(e) { if (!e) return; hide(); input.value = ''; input.blur(); onPick(e); }
    input.addEventListener('focus', show);
    input.addEventListener('input', show);
    input.addEventListener('blur', () => setTimeout(hide, 150));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); idx = clamp(idx + (e.key === 'ArrowDown' ? 1 : -1), 0, shown.length - 1); [...list.children].forEach((li, i) => li.classList.toggle('on', i === idx)); input.setAttribute('aria-activedescendant', list.id + '-' + idx); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(shown[Math.max(0, idx)]); }
      else if (e.key === 'Escape') { input.blur(); hide(); }
    });
    list.addEventListener('pointerdown', e => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(shown[+li.dataset.i]); } });
    return { hide };
  }
  const baseEntries = () => [
    ...Object.keys(LOC).map(n => ({ name: n, label: n, kind: LOC[n].kind, canon: true })),
    ...Object.keys(ALIAS).filter(a => !has(LOC, a)).map(a => ({ name: ALIAS[a], label: a, kind: '即「' + ALIAS[a] + '」', canon: true }))
  ];

  function toast(text) { const el = $('atlasToast'); if (!el) return; el.textContent = text; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 1800); }
  function copyLink() { const u = location.href; (navigator.clipboard?.writeText(u) || Promise.reject()).then(() => toast('已复制链接'), () => toast(u)); }

  window.PlaceUI = { esc, has, clamp, chainOf, kidsOf, coordText, loadPeople, fillCard, search, baseEntries, toast, copyLink };
})();
