// Narrow, same-origin bridge; neither endpoint accepts arbitrary URLs or code.
const channel='pierteia-map-v1';
export const embedded=window.parent!==window && new URLSearchParams(location.search).get('embed')==='map';
export function notifyHost(type,fields={}){if(embedded)window.parent.postMessage({channel,type,...fields},location.origin);}
export function setLayersOpen(open,focus=false){
 if(!embedded)return;
 const layers=document.querySelector('.layers'),button=document.getElementById('embed-layers');
 layers.hidden=!open;button.setAttribute('aria-expanded',String(open));document.documentElement.classList.toggle('layers-open',open);
 if(focus)button.focus({preventScroll:true});
}
export const layersOpen=()=>embedded&&!document.querySelector('.layers').hidden;
if(embedded){
 document.documentElement.classList.add('embedded');
 const layers=document.querySelector('.layers'),layerButton=document.getElementById('embed-layers');layers.hidden=true;
 layerButton.onclick=()=>setLayersOpen(layers.hidden);
 document.getElementById('embed-clean').onclick=()=>window.__globe?.setClean(true);
 document.getElementById('embed-flat').onclick=()=>notifyHost('flat');
 const small=matchMedia('(max-width:700px), (max-height:460px)');
 const fold=()=>{document.getElementById('explorer-content').hidden=small.matches;document.getElementById('fold').textContent=small.matches?'+':'−';document.getElementById('fold').setAttribute('aria-expanded',String(!small.matches));};fold();small.addEventListener('change',fold);
 addEventListener('message',e=>{
  if(e.source!==window.parent||e.origin!==location.origin||e.data?.channel!==channel)return;
  const api=window.__globe;if(!api?.ready)return;
  if(e.data.action==='visibility'&&typeof e.data.visible==='boolean')api.suspend(!e.data.visible);
  if(e.data.action==='overview')api.view('overview');
  if(e.data.action==='clean'&&typeof e.data.clean==='boolean')api.setClean(e.data.clean);
  if(e.data.action==='shortcut'&&['Escape','h','/'].includes(e.data.key))api.shortcut(e.data.key);
  if(e.data.action==='select'&&typeof e.data.name==='string'&&e.data.name.length<100)api.select(e.data.name);
 });
}
