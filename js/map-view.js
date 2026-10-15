/* v19: separate flat/globe pages, with the original visible site navigation. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),locations=window.LOCATION_DATA||{},channel='pierteia-map-v1',origin=location.origin;
 const mode=document.body.dataset.mapView,globe=mode==='globe';
 let selected='',frame=null,ready=false,clean=false,lastSent='',clearPending=false,timer;
 const valid=name=>typeof name==='string'&&Object.hasOwn(locations,name);
 function route(){const q=new URLSearchParams(location.search),site=q.get('place')||q.get('site');const name=valid(site)?site:(window.MAP_NATIONS||[]).find(n=>String(n.id)===site)?.name;return valid(name)?name:'';}
 function link(page){const u=new URL(page,location.href);if(selected)u.searchParams.set('place',selected);return u.href;}
 function links(){ $('viewFlat').href=link('map.html');$('viewGlobe').href=link('globe.html');if($('fallbackFlat'))$('fallbackFlat').href=link('map.html'); }
 function writeURL(){const u=new URL(location.href);u.searchParams.delete('view');u.searchParams.delete('site');if(selected)u.searchParams.set('place',selected);else u.searchParams.delete('place');if(u.href!==location.href)history.replaceState({},'',u);links();}
 function clearSceneRoute(){const u=new URL(location.href);u.searchParams.delete('inspect');u.searchParams.delete('frame');history.replaceState({},'',u);}
 for(const name of Object.keys(locations)){const o=document.createElement('option');o.value=name;o.textContent=(locations[name].parent?'↳ ':'')+name;$('mapPlace').append(o);}
 function send(action,extra={}){frame?.contentWindow?.postMessage({channel,action,...extra},origin);}
 function sync(){if(!ready)return;send('visibility',{visible:!document.hidden});if(clearPending){clearPending=false;send('overview');}if(selected&&lastSent!==selected){lastSent=selected;send('select',{name:selected});}}
 function select(name,source='toolbar'){
  if(!valid(name))return;const changed=selected!==name;selected=name;clearPending=false;$('mapPlace').value=name;
  lastSent=source==='globe'?name:'';
  if(!globe&&source!=='flat')window.__flatMap.select(name);
  if(changed||source!=='globe')clearSceneRoute();sync();writeURL();
 }
 function clear(source='toolbar'){selected='';lastSent='';$('mapPlace').value='';window.__flatMap?.clear();clearSceneRoute();if(globe&&source!=='globe'){clearPending=true;sync();}writeURL();}
 function notice(title,text,failed=false){$('globeNotice').hidden=false;$('globeNotice').dataset.state=failed?'error':'loading';$('globeNoticeTitle').textContent=title;$('globeNoticeText').textContent=text;$('retryGlobe').hidden=!failed;}
 function createFrame(){
  clearTimeout(timer);ready=false;clean=false;lastSent='';$('mapRestoreUI').hidden=true;frame?.remove();frame=null;
  notice('正在展开3D地球','首次打开需要加载高清地形。局部建筑按需加载；可随时返回平面地图。');
  if(location.protocol==='file:'){notice('球体需要通过网站打开','请使用网站或本地HTTP服务；平面地图仍可使用。',true);return;}
  frame=document.createElement('iframe');frame.id='globeFrame';frame.title='Pierteia 3D地球，可旋转、缩放并探索地点';
  const u=new URL('drafts/pierteia-globe/index.html',location.href);u.searchParams.set('embed','map');u.searchParams.set('v','18');
  const q=new URLSearchParams(location.search);
  if(selected&&q.has('inspect')){u.searchParams.set('site',selected);u.searchParams.set('inspect','');if(q.has('frame'))u.searchParams.set('frame',q.get('frame'));lastSent=selected;}
  frame.src=u.href;$('globeHost').prepend(frame);
  frame.addEventListener('error',()=>notice('球体资源未能打开','可以重试，或返回平面地图。',true));
  timer=setTimeout(()=>{if(!ready)notice('资源加载时间较长','可以继续等待、重新加载，或返回平面地图；加载成功后会自动显示。',true);},60000);
 }
 $('mapPlace').onchange=e=>e.target.value?select(e.target.value):clear();
 if(globe){
  addEventListener('message',e=>{
   if(e.origin!==origin||e.source!==frame?.contentWindow||e.data?.channel!==channel)return;
   const m=e.data;
   if(m.type==='ready'){ready=true;clearTimeout(timer);$('globeNotice').hidden=true;sync();}
   if(ready&&m.type==='selected'&&valid(m.name))select(m.name,'globe');
   if(ready&&m.type==='cleared')clear('globe');
   if(m.type==='ui-state'&&typeof m.clean==='boolean'){clean=m.clean;$('mapRestoreUI').hidden=!clean;}
   if(m.type==='error'){ready=false;clean=false;clearTimeout(timer);$('mapRestoreUI').hidden=true;notice('球体暂时无法显示','图形环境或资源加载遇到问题。可重新加载，或返回平面地图。',true);}
   if(m.type==='flat')location.assign(link('map.html'));
  });
  $('retryGlobe').onclick=createFrame;$('mapRestoreUI').onclick=()=>send('clean',{clean:false});
  addEventListener('keydown',e=>{
   if(!ready||e.defaultPrevented||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
   if(!(clean&&e.key==='Escape')&&e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
   const key=e.key==='Escape'?'Escape':e.key.toLowerCase();if(['Escape','h','/'].includes(key)){e.preventDefault();send('shortcut',{key});}
  });
  document.addEventListener('visibilitychange',sync);
 }else{
  addEventListener('atlas:select',e=>select(e.detail.name,'flat'));
  $('ncGlobe').onclick=()=>{const name=window.__flatMap.stats().selected;selected=valid(name)?name:'';location.assign(link('globe.html'));};
  const compact=matchMedia('(max-width:900px), (max-height:500px)');
  function fold(){ $('ncDesc').hidden=compact.matches;$('ncFold').hidden=!compact.matches;$('ncFold').setAttribute('aria-expanded',String(!compact.matches));$('ncFold').textContent=compact.matches?'地点介绍':'收起介绍'; }
  $('ncFold').onclick=()=>{const open=$('ncDesc').hidden;$('ncDesc').hidden=!open;$('ncFold').setAttribute('aria-expanded',String(open));$('ncFold').textContent=open?'收起介绍':'地点介绍';};
  new MutationObserver(fold).observe($('ncName'),{childList:true});compact.addEventListener('change',fold);fold();
 }
 function fit(){document.documentElement.style.setProperty('--hh',document.querySelector('.site-header').offsetHeight+'px');document.documentElement.style.setProperty('--map-vh',(window.visualViewport?.height||innerHeight)+'px');window.__flatMap?.resize();}
 new ResizeObserver(fit).observe(document.querySelector('.site-header'));window.visualViewport?.addEventListener('resize',fit);addEventListener('resize',fit);fit();
 addEventListener('popstate',()=>{const name=route();if(name)select(name,'route');else clear();});
 selected=route();$('mapPlace').value=selected;if(!globe&&selected)window.__flatMap.select(selected);if(globe)createFrame();writeURL();
 window.__mapView={stats:()=>({mode,selected,ready,clean,frames:document.querySelectorAll('#globeFrame').length}),setMode:next=>{if(['flat','globe'].includes(next)&&next!==mode)location.assign(link(next==='globe'?'globe.html':'map.html'));}};
})();
