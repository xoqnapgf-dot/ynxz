/* v23: 平面地图（js/atlas.js）与 3D 地球（js/globe/app.js）共用的选择、网址与视图切换。
   网址参数：place=地点名；scene=1 表示 3D 页直接进入该地点的 2.5D 沙盘。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), locations = window.LOCATION_DATA || {};
  const mode = document.body.dataset.mapView, globe = mode === 'globe';
  const RELEASE = '23';
  const valid = name => typeof name === 'string' && Object.hasOwn(locations, name);
  let selected = '', scene = false;
  function route() {
    const q = new URLSearchParams(location.search), site = q.get('place') || q.get('site');
    const name = valid(site) ? site : (window.MAP_NATIONS || []).find(n => String(n.id) === site)?.name;
    return { name: valid(name) ? name : '', scene: q.get('scene') === '1' };
  }
  function link(page, opts = {}) {
    const u = new URL(page, location.href);
    u.searchParams.set('release', RELEASE);
    if (selected) u.searchParams.set('place', selected);
    if (opts.scene && selected) u.searchParams.set('scene', '1');
    return u.href;
  }
  function links() { $('viewFlat').href = link('map.html'); $('viewGlobe').href = link('globe.html'); }
  function writeURL() {
    const u = new URL(location.href);
    ['view', 'site', 'inspect', 'frame'].forEach(k => u.searchParams.delete(k));
    if (selected) u.searchParams.set('place', selected); else u.searchParams.delete('place');
    if (globe && scene && selected) u.searchParams.set('scene', '1'); else u.searchParams.delete('scene');
    if (u.href !== location.href) history.replaceState({}, '', u);
    links();
  }
  function select(name, source) {
    if (!valid(name)) return;
    selected = name;
    if (source === 'route') { if (globe) window.__globe?.select(name); else window.__flatMap?.select(name); }
    writeURL();
  }
  function clear(source) {
    selected = ''; scene = false;
    if (source === 'route') { if (globe) window.__globe?.clear(); else window.__flatMap?.clear(); }
    writeURL();
  }
  if (globe) {
    addEventListener('globe:select', e => { scene = false; select(e.detail.name, 'globe'); });
    addEventListener('globe:clear', () => clear('globe'));
    addEventListener('globe:scene', e => { scene = !!e.detail.on; if (e.detail.on) selected = e.detail.name; writeURL(); });
  } else {
    addEventListener('atlas:select', e => select(e.detail.name, 'flat'));
    addEventListener('atlas:clear', () => clear('flat'));
  }
  function fit() {
    document.documentElement.style.setProperty('--hh', document.querySelector('.site-header').offsetHeight + 'px');
    document.documentElement.style.setProperty('--map-vh', (window.visualViewport?.height || innerHeight) + 'px');
    window.__flatMap?.resize();
  }
  new ResizeObserver(fit).observe(document.querySelector('.site-header'));
  window.visualViewport?.addEventListener('resize', fit);
  addEventListener('resize', fit);
  fit();
  addEventListener('popstate', () => { const r = route(); if (r.name) select(r.name, 'route'); else clear('route'); });
  const r = route();
  selected = r.name; scene = globe && r.scene && !!r.name;
  if (!globe && selected) window.__flatMap.select(selected);
  writeURL();
  window.__mapView = {
    stats: () => ({ mode, selected, scene }),
    setMode: (next, opts = {}) => { if (['flat', 'globe'].includes(next) && next !== mode) location.assign(link(next === 'globe' ? 'globe.html' : 'map.html', opts)); }
  };
})();
