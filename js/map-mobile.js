/* Map-only mobile chrome. Other site pages and the renderer are unchanged. */
(() => {
 const $=s=>document.querySelector(s),mq=matchMedia('(max-width:900px), (max-height:500px)'),menu=$('#mapMenu'),header=$('#mapNavigation');
 const backdrop=document.createElement('button');backdrop.id='mapMenuBackdrop';backdrop.hidden=true;backdrop.setAttribute('aria-label','关闭网站导航');document.body.append(backdrop);
 function navigation(open,focus=false){document.body.classList.toggle('map-nav-open',open);menu.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;if(open)header.querySelector('a').focus({preventScroll:true});else if(focus)menu.focus({preventScroll:true});}
 menu.onclick=()=>{closeTools();navigation(menu.getAttribute('aria-expanded')!=='true');};backdrop.onclick=()=>navigation(false,true);
 header.addEventListener('click',e=>{if(e.target.closest('a'))navigation(false);});
 const button=document.createElement('button'),panel=document.createElement('section');button.id='flatTools';button.className='map-ui';button.type='button';button.textContent='工具';button.setAttribute('aria-controls','flatToolsPanel');button.setAttribute('aria-expanded','false');panel.id='flatToolsPanel';panel.className='map-ui';panel.hidden=true;panel.setAttribute('aria-label','平面地图工具');$('#mapStage').append(button,panel);
 const tools=['.map-modes','.map-ghost','.map-zoomctl'].map(selector=>{const node=$(selector),anchor=document.createComment('desktop map control');node.before(anchor);return {node,anchor};});
 function closeTools(focus=false){panel.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus({preventScroll:true});}
 button.onclick=()=>{navigation(false);const open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));};
 let compact;
 function adapt(){if(compact===mq.matches)return;compact=mq.matches;navigation(false);closeTools();for(const {node,anchor}of tools)if(compact)panel.append(node);else anchor.after(node);}
 mq.addEventListener('change',adapt);adapt();
 document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&e.target!==button)closeTools();});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(menu.getAttribute('aria-expanded')==='true'){navigation(false,true);e.preventDefault();e.stopPropagation();}else if(!panel.hidden){closeTools(true);e.preventDefault();e.stopPropagation();}});
 window.__mapMobile={close:()=>{navigation(false);closeTools();}};
})();
