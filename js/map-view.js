/* One lazy, same-origin 3D renderer; no model/texture download on a flat visit. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), origin = location.origin;
  const locations = window.LOCATION_DATA || {}, channel = 'pierteia-map-v1';
  let mode = 'flat', selected = '', frame = null, ready = false, lastSent = '', timer, clean = false, clearPending = false;
  const valid = name => typeof name === "string" && Object.hasOwn(locations, name);
  const names = Object.keys(locations);
  for (const name of names) { const option = document.createElement('option'); option.value = name; option.textContent = (locations[name].parent ? '↳ ' : '') + name; $('mapPlace').append(option); }
  function fromURL() {
    const query = new URLSearchParams(location.search);
    const site = query.get('place') || query.get('site');
    const name = valid(site) ? site : (window.MAP_NATIONS || []).find(n => String(n.id) === site)?.name;
    return {mode:query.get('view') === 'globe' ? 'globe' : 'flat', name:valid(name) ? name : ''};
  }
  function writeURL(push = false) {
    const url = new URL(location.href); url.searchParams.set('view', mode);
    if (selected) url.searchParams.set('place', selected); else url.searchParams.delete('place');
    url.searchParams.delete('site');
    if (url.href !== location.href) history[push ? 'pushState' : 'replaceState']({}, '', url);
  }
  function send(action, extra = {}) { if (frame?.contentWindow) frame.contentWindow.postMessage({channel, action, ...extra}, origin); }
  function sync() {
    if (!ready) return;
    send('visibility', {visible:mode === 'globe' && !document.hidden});
    if (clearPending) { clearPending = false; send('overview'); }
    if (mode === 'globe' && selected && lastSent !== selected) { lastSent = selected; send('select', {name:selected}); }
  }
  function notice(title, text, failed = false) {
    $('globeNotice').hidden = false; $('globeNotice').dataset.state = failed ? 'error' : 'loading';
    $('globeNoticeTitle').textContent = title; $('globeNoticeText').textContent = text; $('retryGlobe').hidden = !failed;
  }
  function createFrame() {
    clearTimeout(timer); ready = false; lastSent = ''; clean = false; $('mapRestoreUI').hidden = true; frame?.remove();
    notice('正在展开球体地图', '首次打开需要加载高清地形。平面地图随时可用，局部建筑仅在进入场景时加载。');
    if (location.protocol === 'file:') {
      notice('球体需要通过网站打开', '直接双击文件无法读取三维资源。请使用网站或本地 HTTP 服务；平面地图仍可使用。', true); return;
    }
    frame = document.createElement('iframe'); frame.id = 'globeFrame'; frame.title = 'Pierteia 球体地图，可旋转、缩放并探索地点';
    const url = new URL('drafts/pierteia-globe/index.html', location.href); url.searchParams.set('embed', 'map'); url.searchParams.set('v', '17');
    // Optional deep links retain the existing scene/camera route; ordinary selection does not load a model.
    const query = new URLSearchParams(location.search);
    if (selected && query.has('inspect')) { url.searchParams.set('site', selected); url.searchParams.set('inspect', ''); if (query.has('frame')) url.searchParams.set('frame', query.get('frame')); lastSent = selected; }
    frame.src = url.href; $('globeHost').prepend(frame);
    frame.addEventListener('error', () => notice('球体资源未能打开', '可以重试，或先返回平面地图。你的平面缩放和图层不会丢失。', true));
    timer = setTimeout(() => { if (!ready) notice('资源加载时间较长', '仍在等待球体资源。可以继续等待、重新加载，或先返回平面地图；加载成功后会自动显示。', true); }, 60000);
  }
  function setMode(next, push = true) {
    if (!['flat','globe'].includes(next)) return;
    mode = next; const globe = mode === 'globe';
    $('mapStage').hidden = globe; $('globeHost').hidden = !globe;
    for (const button of document.querySelectorAll('[data-projection]')) button.setAttribute('aria-pressed', String(button.dataset.projection === mode));
    $('mapHelp').textContent = globe ? '拖动旋转 · 点击地标探索' : '拖动平移 · 滚轮缩放';
    $('mapAnnouncement').textContent = globe ? '球体视图。可随时切回平面地图。' : '已切换到平面地图。';
    if (globe && !frame) createFrame();
    if (!globe) { window.__flatMap.resize(); if (selected && window.__flatMap.stats().selected !== selected) window.__flatMap.select(selected); }
    sync(); writeURL(push);
  }
  function select(name, source = 'toolbar') {
    if (!valid(name)) return;
    const changed = selected !== name; clearPending = false; selected = name; $('mapPlace').value = name;
    if (source === 'globe') lastSent = name; else lastSent = '';
    if (mode === 'flat' && source !== 'flat') window.__flatMap.select(name);
    // A fresh choice supersedes an old scene-specific permalink.
    if (changed || source !== 'globe') { const url = new URL(location.href); url.searchParams.delete('inspect'); url.searchParams.delete('frame'); history.replaceState({}, '', url); }
    sync(); writeURL();
  }
  function clearSelection(source = 'toolbar') {
    selected = ''; lastSent = ''; $('mapPlace').value = ''; window.__flatMap.clear();
    const url = new URL(location.href); url.searchParams.delete('inspect'); url.searchParams.delete('frame'); history.replaceState({}, '', url);
    if (source !== 'globe') { clearPending = true; sync(); }
    writeURL();
  }
  addEventListener('message', e => {
    if (e.origin !== origin || e.source !== frame?.contentWindow || e.data?.channel !== channel) return;
    const message = e.data;
    if (message.type === 'ready') { ready = true; clearTimeout(timer); $('globeNotice').hidden = true; sync(); }
    if (ready && message.type === 'cleared') clearSelection('globe');
    // Ignore initial deep-link echoes until ready; the user's latest toolbar choice wins.
    if (ready && message.type === 'selected' && typeof message.name === 'string') select(message.name, 'globe');
    if (message.type === 'ui-state' && typeof message.clean === 'boolean') { clean = message.clean; $('mapRestoreUI').hidden = !clean; }
    if (message.type === 'error') { ready = false; clean = false; $('mapRestoreUI').hidden = true; clearTimeout(timer); notice('球体暂时无法显示', '图形环境或资源加载遇到问题。可重新加载球体，或返回平面地图继续查看。', true); }
    if (message.type === 'flat') { setMode('flat'); $('viewFlat').focus(); }
  });
  addEventListener('atlas:select', e => select(e.detail.name, 'flat'));
  for (const button of document.querySelectorAll('[data-projection]')) button.onclick = () => setMode(button.dataset.projection);
  $('mapPlace').onchange = e => { if (e.target.value) select(e.target.value); else clearSelection(); };
  $('mapRestoreUI').onclick = () => send('clean', {clean:false});
  addEventListener('keydown', e => {
    if (mode !== 'globe' || !ready || e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!(clean && e.key === 'Escape') && e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    const key = e.key === 'Escape' ? 'Escape' : e.key.toLowerCase();
    if (['Escape','h','/'].includes(key)) { e.preventDefault(); send('shortcut', {key}); }
  });
  $('ncGlobe').onclick = () => { select(window.__flatMap.stats().selected, 'flat'); setMode('globe'); };
  $('retryGlobe').onclick = createFrame;
  $('fallbackFlat').onclick = () => { setMode('flat'); $('viewFlat').focus(); };
  document.addEventListener('visibilitychange', sync);
  addEventListener('popstate', () => {
    const route = fromURL(); selected = route.name; clearPending = !selected; $('mapPlace').value = selected;
    setMode(route.mode, false);
    if (!selected) window.__flatMap.clear();
  });
  const compact = matchMedia('(max-width:900px), (max-height:500px)');
  function foldFlat() { $('ncDesc').hidden = compact.matches; $('ncFold').hidden = !compact.matches; $('ncFold').setAttribute('aria-expanded', String(!compact.matches)); $('ncFold').textContent = compact.matches ? '地点介绍' : '收起介绍'; }
  $('ncFold').onclick = () => { const open = $('ncDesc').hidden; $('ncDesc').hidden = !open; $('ncFold').setAttribute('aria-expanded', String(open)); $('ncFold').textContent = open ? '收起介绍' : '地点介绍'; };
  new MutationObserver(foldFlat).observe($('ncName'), {childList:true});compact.addEventListener('change', foldFlat);foldFlat();
  function fitVisualViewport() {
    document.documentElement.style.setProperty('--map-vh', `${window.visualViewport?.height || innerHeight}px`);
    window.__flatMap.resize();
  }
  window.visualViewport?.addEventListener('resize', fitVisualViewport);addEventListener('resize', fitVisualViewport);fitVisualViewport();
  const route = fromURL(); selected = route.name; $('mapPlace').value = selected;
  if (selected) window.__flatMap.select(selected);
  setMode(route.mode, false);
  window.__mapView = {stats:() => ({mode, selected, ready, clean, frames:document.querySelectorAll('#globeFrame').length}), setMode};
})();
