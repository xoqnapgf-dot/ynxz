import { setLayersOpen } from './map-bridge.js?v=18';
// Reuse the real controls, not copies with separate state/listeners.
export function setupCompactTools(){
 const $=s=>document.querySelector(s),button=document.createElement('button'),panel=document.createElement('section');
 button.id='compact-tools';button.type='button';button.textContent='工具';button.setAttribute('aria-controls','compact-tools-panel');button.setAttribute('aria-expanded','false');
 panel.id='compact-tools-panel';panel.className='panel';panel.hidden=true;panel.setAttribute('aria-label','地图工具');
 document.body.append(button,panel);
 const layerClose=document.createElement('button');layerClose.id='close-layers';layerClose.type='button';layerClose.textContent='关闭';layerClose.setAttribute('aria-label','关闭图层');$('.layers').append(layerClose);layerClose.onclick=()=>setLayersOpen(false,true);
 const nodes=['#embed-layers','#embed-clean','.zoom-controls','.view-switch'].map(selector=>{const node=$(selector),anchor=document.createComment('desktop tool position');node.before(anchor);return {node,anchor};});
 let compact=false;
 function close(focus=false){if(panel.hidden&&button.getAttribute('aria-expanded')==='false')return;panel.hidden=true;button.setAttribute('aria-expanded','false');document.documentElement.classList.remove('tools-open');if(focus)button.focus({preventScroll:true});document.dispatchEvent(new Event('atlas:layout'));}
 function adapt(){
  const next=document.documentElement.classList.contains('compact-ui');if(next===compact)return;compact=next;close();
  for(const {node,anchor}of nodes)if(compact)panel.append(node);else anchor.after(node);
 }
 button.onclick=()=>{if(!panel.hidden){close();return;}document.querySelector('#embed-layers').getAttribute('aria-expanded')==='true'&&document.querySelector('#embed-layers').click();panel.hidden=false;button.setAttribute('aria-expanded','true');document.documentElement.classList.add('tools-open');document.dispatchEvent(new Event('atlas:layout'));};
 panel.addEventListener('click',e=>{if(e.target.closest('#embed-layers,#embed-clean,[data-view]')){close(!!e.target.closest('[data-view]'));if(e.target.closest('#embed-layers')&&!$('.layers').hidden)$('.layers input').focus({preventScroll:true});}});
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==button)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();close(true);}});
 const observer=new MutationObserver(()=>{adapt();if(document.body.classList.contains('clean')||document.body.classList.contains('search-active'))close();});
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 // A collapsed explorer is a duplicate of Search, not another permanent panel.
 new MutationObserver(()=>close()).observe($('#detail'),{attributes:true,attributeFilter:['hidden']});
 const explorer=$('.explorer'),content=$('#explorer-content');
 const syncExplorer=()=>explorer.classList.toggle('explorer-collapsed',content.hidden);
 new MutationObserver(syncExplorer).observe(content,{attributes:true,attributeFilter:['hidden']});syncExplorer();adapt();
}
