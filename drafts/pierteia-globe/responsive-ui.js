import { setupCompactTools } from './compact-tools.js?v=18';
// UI geometry, not a lower-quality mobile renderer. No model or geographic data here.
const $=s=>document.querySelector(s);
const compact=matchMedia('(max-width:900px), (max-height:500px)');
let update=()=>{},adapt=()=>{},queued=false;
// Hidden iframes can retain a stale MediaQueryList.matches value. Use the actual
// viewport on resume; never turn a zero-sized hidden frame into a mobile layout.
const isCompact=()=>innerWidth&&innerHeight?(innerWidth<=900||innerHeight<=500):document.documentElement.classList.contains('compact-ui');
export function refreshResponsiveUI(){if(document.documentElement.classList.contains('compact-ui')!==isCompact())adapt();}
function requestLayout(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update();});}
function setCollapsed(on){
 $('#detail-copy').hidden=on;$('#detail').classList.toggle('detail-collapsed',on);
 $('#detail-fold').textContent=on?'介绍':'收起';$('#detail-fold').setAttribute('aria-expanded',String(!on));requestLayout();
}
export function resetSearchPanel(){
 document.body.classList.remove('search-active');
 if(isCompact()){$('#explorer-content').hidden=true;$('#fold').textContent='+';$('#fold').setAttribute('aria-expanded','false');}
 requestLayout();
}
export function collapseDetail(){if(isCompact())setCollapsed(true);else requestLayout();}
export function syncCameraPicker(){
 const picker=$('.camera-picker'),select=$('#scene-camera');
 picker.hidden=!isCompact()||!document.body.classList.contains('inspection')||$('#detail-views').hidden;
 if(picker.hidden)return;
 const buttons=[...document.querySelectorAll('[data-detail-view]')].filter(b=>!b.hidden);
 select.replaceChildren(...buttons.map(b=>{const option=document.createElement('option');option.value=b.dataset.detailView;option.textContent=b.textContent;option.selected=b.getAttribute('aria-pressed')==='true';return option;}));
 requestLayout();
}
export function setupResponsiveUI({onLayout,onSearch,onOverview,onClean,embedded}){
 update=onLayout;
 adapt=()=>{
  document.documentElement.classList.toggle('compact-ui',isCompact());
  $('#explorer-content').hidden=isCompact();$('#fold').textContent=isCompact()?'+':'−';$('#fold').setAttribute('aria-expanded',String(!isCompact()));
  if(!embedded){$('.layers').hidden=isCompact();document.documentElement.classList.remove('layers-open');$('#embed-layers').setAttribute('aria-expanded','false');}
  setCollapsed(isCompact());syncCameraPicker();requestLayout();
 };
 adapt();setupCompactTools();compact.addEventListener('change',refreshResponsiveUI);addEventListener('resize',refreshResponsiveUI);
 $('#search').addEventListener('focus',()=>{document.body.classList.add('search-active');requestLayout();});
 // Keep the short-screen sheet stationary through pointerdown/blur/pointerup.
 // Closing it on input blur moves the fold button away before a tap completes.
 $('#detail-fold').onclick=()=>setCollapsed(!$('#detail-copy').hidden);
 $('#embed-search').onclick=onSearch;$('#embed-overview').onclick=onOverview;
 $('#scene-camera').onchange=e=>document.querySelector(`[data-detail-view="${e.target.value}"]`)?.click();
 if(!embedded){
  $('#embed-clean').onclick=onClean;$('.layers').hidden=isCompact();
  $('#embed-layers').onclick=()=>{const open=$('.layers').hidden;$('.layers').hidden=!open;$('#embed-layers').setAttribute('aria-expanded',String(open));document.documentElement.classList.toggle('layers-open',open);requestLayout();};
 }
 const resize=new ResizeObserver(requestLayout);
 for(const node of document.querySelectorAll('#embed-tools,.explorer,.detail,.layers,.view-switch,.zoom-controls'))resize.observe(node);
 const state=new MutationObserver(()=>{
  if(document.body.classList.contains('search-active')&&($('#explorer-content').hidden||!$('#detail').hidden||$('.explorer').style.visibility==='hidden'||document.body.classList.contains('clean')))document.body.classList.remove('search-active');
  requestLayout();
 });
 for(const node of document.querySelectorAll('body,#detail,#detail-copy,#explorer-content,.layers'))state.observe(node,{attributes:true,attributeFilter:['class','hidden','style']});
 document.addEventListener('atlas:layout',requestLayout);
}
const visible=el=>el&&el.getClientRects().length>0&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&Number(getComputedStyle(el).opacity)>0;
export function sceneViewport(embedded){
 if(!embedded&&!isCompact())return null;
 let left=8,top=8,right=innerWidth-8,bottom=innerHeight-8;
 if(document.body.classList.contains('clean')||(isCompact()&&innerWidth<560&&innerHeight<=460&&document.body.classList.contains('search-active')))return {x:0,y:0,width:innerWidth,height:innerHeight};
 const wide=isCompact()&&innerWidth>=560&&innerHeight<=500;
 const tools=$('#embed-tools');if(visible(tools)){const r=tools.getBoundingClientRect();if(wide)left=r.right+12;else top=r.bottom+8;}
 for(const el of document.querySelectorAll('.view-switch,.zoom-controls'))if(visible(el)&&!el.closest('#compact-tools-panel')){
  const r=el.getBoundingClientRect();if(r.top>innerHeight/2&&r.right>left&&r.left<right)bottom=Math.min(bottom,r.top-8);
 }
 for(const el of document.querySelectorAll('.explorer,.detail,.layers'))if(visible(el)){
  const r=el.getBoundingClientRect();
  if(r.width>innerWidth*.65||(wide&&el.classList.contains('detail-collapsed')&&r.top>innerHeight*.55))bottom=Math.min(bottom,r.top-10);
  else if((r.left+r.right)/2>innerWidth/2)right=Math.min(right,r.left-12);
  else left=Math.max(left,r.right+12);
 }
 top=Math.min(top,Math.max(0,bottom-1));left=Math.min(left,Math.max(0,right-1));
 return {x:left,y:top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
}
