import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),c=require('@sparticuz/chromium');
const root=new URL('../',import.meta.url),base=process.env.ATLAS_URL||'http://127.0.0.1:8135/';
const report={revision:17,scope:'Map-page integration; ordinary-resolution UI and one optional academy scene, not a new eight-scene art review',errors:[],checks:{},viewports:[],sourceHashes:{}};
for(const f of ['map.html','css/map-view.css','js/map-flat.js','js/map-view.js','drafts/pierteia-globe/globe.js','drafts/pierteia-globe/globe.css','drafts/pierteia-globe/responsive-ui.js','drafts/pierteia-globe/map-bridge.js','drafts/pierteia-globe/map-embed.css','drafts/pierteia-globe/atlas-icons.js','drafts/pierteia-globe/index.html','drafts/pierteia-globe/academy-hillside.js','drafts/pierteia-globe/academy-landscape.js','drafts/pierteia-globe/academy-craft.js','drafts/pierteia-globe/landmarks.js','drafts/pierteia-globe/archipelago-hq.js','drafts/pierteia-globe/regional-scenes.js','drafts/pierteia-globe/regional-profiles.js','drafts/pierteia-globe/regional-surfaces.js','drafts/pierteia-globe/regional-environment.js'])report.sourceHashes[f]=createHash('sha256').update(fs.readFileSync(new URL(f,root))).digest('hex');
if(process.env.TEST_FONT)await c.font(process.env.TEST_FONT);
const b=await chromium.launch({executablePath:await c.executablePath(),args:c.args.filter(a=>a!=='--disable-web-security'),headless:true});
const shot=async(p,name)=>{if(process.env.CHECK_IMAGES)await p.screenshot({path:`${process.env.CHECK_IMAGES}/${name}.png`});};
const globe=p=>p.frames().find(f=>f.url().includes('embed=map'));
const ready=async p=>{await p.waitForFunction(()=>__mapView.stats().ready);const f=globe(p);await f.waitForFunction(()=>__globe.stats().renderer.frame>12);await f.locator('#loading').waitFor({state:'hidden'});return f;};
const watch=p=>{p.setDefaultTimeout(180000);p.on('pageerror',e=>report.errors.push(e.message));};
try{
 const context=await b.newContext({viewport:{width:1440,height:900}});const p=await context.newPage();watch(p);const requests=[];p.on('request',r=>requests.push(r.url()));
 p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await p.goto(new URL('map.html',base).href);await p.waitForFunction(()=>window.__mapView);await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.locator('iframe').count(),0);assert(!requests.some(x=>x.includes('/drafts/')));report.checks.flatDoesNotLoad3D=true;
 await p.locator('[data-mode=nations]').click();await p.locator('#zin').click();await p.locator('#mapPlace').selectOption('安那其学院');
 const before=await p.evaluate(()=>__flatMap.stats());await shot(p,'map-flat');
 await p.locator('#viewGlobe').click();let f=await ready(p);await f.waitForFunction(()=>__globe.stats().selected==='安那其学院');
 assert.equal(await f.evaluate(()=>__globe.stats().loadedModels),0);assert(!requests.some(x=>x.includes('.glb')));await f.evaluate(()=>__globe.pause(true));
 assert.equal(await f.locator('.topbar').isVisible(),false);assert.equal(await f.locator('.intro').isVisible(),false);await shot(p,'map-globe');
 await f.evaluate(()=>__globe.pause(false));await p.locator('#viewFlat').click();await f.waitForFunction(()=>__globe.stats().hostSuspended);
 const stopped=await f.evaluate(()=>__globe.stats().renderer.frame);await p.waitForTimeout(600);assert.equal(await f.evaluate(()=>__globe.stats().renderer.frame),stopped);
 assert.deepEqual(await p.evaluate(()=>__flatMap.stats()),before);report.checks.flatStateAndSuspendedRenderer=true;
 await p.locator('#viewGlobe').click();await f.waitForFunction(()=>!__globe.stats().hostSuspended);assert.equal(await p.locator('iframe').count(),1);
 await p.goBack();await p.waitForFunction(()=>__mapView.stats().mode==='flat');await p.goForward();await p.waitForFunction(()=>__mapView.stats().mode==='globe');report.checks.historyAndSingleFrame=true;
 await f.evaluate(()=>__globe.select('法洛塔'));await p.waitForFunction(()=>__mapView.stats().selected==='法洛塔');assert.equal(await p.locator('#mapPlace').inputValue(),'法洛塔');
 await p.locator('#viewFlat').click();assert((await p.locator('#ncDesc').textContent()).includes('坐标未定'));assert((await p.locator('#ncDesc').textContent()).includes('铁枢人民共和国'));report.checks.bidirectionalParentLocation=true;
 await p.evaluate(()=>{for(const [origin,source,name] of [['https://invalid.example',document.querySelector('iframe').contentWindow,'万知城'],[location.origin,window,'万知城'],[location.origin,document.querySelector('iframe').contentWindow,'__proto__']])window.dispatchEvent(new MessageEvent('message',{origin,source,data:{channel:'pierteia-map-v1',type:'selected',name}}));});
 assert.equal(await p.locator('#mapPlace').inputValue(),'法洛塔');report.checks.messageOriginSourceAndNameGuards=true;
 await p.locator('#viewGlobe').click();await f.evaluate(()=>__globe.view('overview'));
 for(const [width,height]of [[1024,768],[390,844],[320,640],[844,390]]){
  await p.setViewportSize({width,height});await f.evaluate(()=>__globe.pause(false));const n=await f.evaluate(()=>__globe.stats().renderer.frame);await f.waitForFunction(n=>__globe.stats().renderer.frame>n+12,n);await f.evaluate(()=>__globe.pause(true));
  const layout=await p.evaluate(()=>{const button=document.querySelector('#viewGlobe').getBoundingClientRect(),stage=document.querySelector('#globeHost').getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,button:[button.x,button.y,button.right,button.bottom],stage:[stage.x,stage.y,stage.width,stage.height]};});
  assert(layout.scroll<=width);assert(layout.button[0]>=0&&layout.button[2]<=width);assert(layout.stage[2]>0&&layout.stage[3]>130);
  const ui=await f.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,explorer:rect('.explorer'),zoom:rect('.zoom-controls'),view:rect('.view-switch'),collapsed:document.querySelector('#explorer-content').hidden};});
  assert(ui.scroll<=width);assert(ui.explorer.x>=0&&ui.explorer.right<=width);assert(ui.explorer.bottom<=ui.height);assert(ui.explorer.y>=ui.zoom.bottom||ui.explorer.bottom<=ui.zoom.y||ui.explorer.x>=ui.zoom.right||ui.explorer.right<=ui.zoom.x,'explorer overlaps zoom');
  if(width<=700){assert(ui.collapsed);await f.locator('#embed-layers').click();assert(await f.locator('.layers').isVisible());await f.locator('label:has(#clouds)').click();assert(!await f.locator('#clouds').isChecked());await f.locator('label:has(#clouds)').click();assert(await f.locator('#clouds').isChecked());await f.locator('#embed-layers').click();}
  // Real clicks + keyboard, in every tested viewport; no synthetic onclick invocation.
  await f.locator('#embed-clean').click();await p.waitForFunction(()=>__mapView.stats().clean);
  const restore=await f.locator('#restore-ui').evaluate(el=>{const r=el.getBoundingClientRect();return {opacity:Number(getComputedStyle(el).opacity),width:r.width,height:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),focused:document.activeElement===el};});
  assert(restore.opacity>=.95&&restore.height>=44&&restore.x>=0&&restore.y>=0&&restore.right<=ui.width&&restore.bottom<=ui.height&&restore.hit&&restore.focused);
  assert(await p.locator('#mapRestoreUI').isVisible());await shot(p,`clean-${width}x${height}`);
  await p.keyboard.press('Escape');await f.waitForFunction(()=>!__globe.stats().clean);assert.equal(await f.locator('#embed-clean').evaluate(el=>el===document.activeElement),true);
  await f.locator('#embed-clean').click();await p.locator('#mapRestoreUI').click();await f.waitForFunction(()=>!__globe.stats().clean);
  await f.locator('#embed-clean').click();await p.locator('#viewGlobe').focus();await p.keyboard.press('Escape');await f.waitForFunction(()=>!__globe.stats().clean);
  await f.locator('#embed-clean').click();await f.locator('#restore-ui').click();await p.waitForFunction(()=>!__mapView.stats().clean);
  assert(!await p.locator('#mapRestoreUI').isVisible());
  await shot(p,`map-${width}x${height}`);report.viewports.push({width,height,layout,ui});
 }
 report.checks.responsivePanels=true;
 report.checks.cleanExitClickKeyboardParentAndResponsive=true;
 await f.locator('#embed-layers').click();await p.locator('#mapPlace').selectOption('安那其学院');await f.waitForFunction(()=>__globe.stats().selected==='安那其学院');
 assert(await f.locator('#detail').isVisible());assert(!await f.locator('.layers').isVisible());
 await f.locator('#embed-layers').click();await f.locator('#clouds').focus();await p.keyboard.press('Escape');
 assert(!await f.locator('.layers').isVisible());assert.equal(await f.evaluate(()=>__globe.stats().selected),'安那其学院');assert(await f.locator('#detail').isVisible());
 assert.equal(await f.locator('#embed-layers').getAttribute('aria-expanded'),'false');report.checks.layerSelectionAndEscapePriority=true;
 await f.locator('#close-detail').click();assert(await f.locator('.explorer').isVisible());
 await p.locator('#mapPlace').selectOption('安那其学院');await f.locator('#detail').waitFor({state:'visible'});report.checks.samePlaceReopensDetails=true;
 await p.locator('#mapPlace').selectOption('');await f.waitForFunction(()=>__globe.stats().selected===null);assert.equal(await p.evaluate(()=>__mapView.stats().selected),'');assert(!await f.locator('#detail').isVisible());
 await p.locator('#viewFlat').click();await p.locator('#mapPlace').selectOption('万知城');await p.locator('#mapPlace').selectOption('');await p.locator('#viewGlobe').click();assert.equal(await p.locator('#mapPlace').inputValue(),'');await f.waitForFunction(()=>__globe.stats().selected===null);report.checks.emptySelectionClearsBothViews=true;
 await p.locator('#viewGlobe').focus();await p.keyboard.press('/');await f.locator('#search').waitFor({state:'visible'});assert.equal(await f.locator('#search').evaluate(el=>document.activeElement===el),true);
 await p.keyboard.type('h/');assert.equal(await f.locator('#search').inputValue(),'h/');assert(!await f.evaluate(()=>__globe.stats().clean));await f.locator('#search').fill('');await p.keyboard.press('Escape');
 await f.locator('#embed-clean').focus();await p.keyboard.press('Control+h');assert(!await f.evaluate(()=>__globe.stats().clean));await p.keyboard.down('h');await f.waitForFunction(()=>__globe.stats().clean);await p.keyboard.down('h');assert(await f.evaluate(()=>__globe.stats().clean));await p.keyboard.up('h');await p.keyboard.press('h');await f.waitForFunction(()=>!__globe.stats().clean);report.checks.shortcutEditingModifiersAndRepeat=true;

 await p.setViewportSize({width:1200,height:800});await p.locator('#mapPlace').selectOption('安那其学院');
 let release,arrived;const held=new Promise(r=>arrived=r),gate=new Promise(r=>release=r);
 await p.route('**/academy-atelier.glb',async route=>{arrived();await gate;await route.continue();});
 await f.evaluate(()=>{window.pendingTest=__globe.inspect(900);});await held;await p.locator('#viewFlat').click();release();assert.equal(await f.evaluate(()=>window.pendingTest),false);
 assert.equal(await f.evaluate(()=>__globe.stats().activeScene),null);report.checks.hiddenLoadCannotActivate=true;
 await p.locator('#viewGlobe').click();assert.equal(await f.evaluate(()=>__globe.inspect(900)),true);await f.evaluate(()=>__globe.pause(true));
 assert.equal(await f.evaluate(()=>__globe.stats().activeScene),900);await f.evaluate(()=>__globe.frame('__proto__'));assert.equal(await f.locator('[data-detail-view=wide]').getAttribute('aria-pressed'),'true');assert(await f.locator('[data-detail-view=hillside]').isVisible());
 await f.locator('[data-detail-view=hillside]').click();const image=await f.evaluate(()=>__globe.captureHQ({width:800,height:500,samples:1,download:false}));assert(image.startsWith('data:image/png;base64,'));
 report.checks.optionalAcademyAndCamera=true;report.academy=await f.evaluate(()=>__globe.stats());
 await p.locator('#viewFlat').click();await p.locator('#viewGlobe').click();assert.equal(await f.evaluate(()=>__globe.stats().activeScene),900);report.checks.scenePreservedAcrossSwitch=true;assert(!await f.locator('html').evaluate(el=>el.classList.contains('compact-ui')));assert(await f.locator('[data-detail-view=hillside]').isVisible());report.checks.responsiveModeRestoredAfterHiddenFrame=true;
 await f.locator('#embed-clean').click();assert.equal(await f.evaluate(()=>__globe.stats().activeScene),900);await p.locator('#mapRestoreUI').click();await f.waitForFunction(()=>!__globe.stats().clean);assert.equal(await f.evaluate(()=>__globe.stats().activeScene),900);
 await f.locator('#embed-clean').click();await p.locator('#viewFlat').click();await p.locator('#viewGlobe').click();assert(await p.locator('#mapRestoreUI').isVisible());await f.locator('#restore-ui').click();assert.equal(await f.evaluate(()=>__globe.stats().activeScene),900);
 await f.locator('#embed-clean').focus();await p.keyboard.press('/');assert(await f.locator('#search').isVisible());assert(!await f.evaluate(()=>__globe.stats().inspection));assert.equal(await f.locator('#search').evaluate(el=>document.activeElement===el),true);assert.equal(await f.locator('#fold').getAttribute('aria-expanded'),'true');report.checks.sceneCleanRestoreAndSearch=true;

 await f.evaluate(()=>__globe.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());await p.locator('#globeNotice[data-state=error]').waitFor();assert(await p.locator('#fallbackFlat').isVisible());
 await p.locator('#fallbackFlat').click();assert.equal(await p.evaluate(()=>__mapView.stats().mode),'flat');await p.locator('#viewGlobe').click();await p.locator('#retryGlobe').click();f=await ready(p);await f.evaluate(()=>__globe.pause(true));assert.equal(await p.locator('iframe').count(),1);report.checks.contextLossAndRetry=true;
 await p.close();
 // WebGL unavailable: neither the map shell nor the flat renderer depends on it.
 console.log('PASS main integration and context recovery');const off=await context.newPage();await off.setViewportSize({width:390,height:844});watch(off);
 await off.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
 await off.goto(new URL('map.html?view=globe',base).href);await off.locator('#globeNotice[data-state=error]').waitFor();await off.locator('#fallbackFlat').click();await off.locator('#zin').click();assert((await off.evaluate(()=>__flatMap.stats().scale))>1);report.checks.noWebGLFlatFallback=true;await shot(off,'map-no-webgl');await off.close();
 // A missing texture is contained by the shell; an explicit retry starts a fresh frame.
 console.log('PASS unavailable WebGL fallback');const failed=await context.newPage();await failed.setViewportSize({width:900,height:650});watch(failed);let failOnce=true;
 await failed.route('**/land-mask.png*',async route=>{if(failOnce){failOnce=false;await route.abort();}else await route.continue();});
 await failed.goto(new URL('map.html?view=globe&place=万知城',base).href);await failed.locator('#globeNotice[data-state=error]').waitFor();await failed.locator('#retryGlobe').click();const recovered=await ready(failed);await recovered.evaluate(()=>__globe.pause(true));assert.equal(await failed.locator('#mapPlace').inputValue(),'万知城');report.checks.failedTextureRetry=true;await failed.close();
 // Direct draft routes still work; integration does not force a parent page.
 console.log('PASS missing texture retry');const standalone=await context.newPage();await standalone.setViewportSize({width:1000,height:650});watch(standalone);await standalone.goto(new URL('drafts/pierteia-globe/?site=900',base).href);await standalone.waitForFunction(()=>window.__globe?.ready);assert(!await standalone.locator('html').evaluate(el=>el.classList.contains('embedded')));assert(await standalone.locator('.topbar').isVisible());await standalone.evaluate(()=>__globe.pause(true));await standalone.locator('#loading').waitFor({state:'hidden'});await standalone.locator('#clean').click();assert(await standalone.locator('#restore-ui').isVisible());await standalone.keyboard.press('Escape');assert(!await standalone.evaluate(()=>__globe.stats().clean));await standalone.locator('#clean').click();await standalone.locator('#restore-ui').click();assert(!await standalone.evaluate(()=>__globe.stats().clean));report.checks.standaloneRetained=true;report.checks.standaloneCleanRestore=true;await standalone.close();
 // A slow initial deep link must not override a newer toolbar selection/clear.
 const race=await context.newPage();watch(race);
 for(const choice of ['万知城','']){
  let allow,seen;const waiting=new Promise(r=>seen=r),blocked=new Promise(r=>allow=r);
  await race.route('**/land-mask.png*',async route=>{seen();await blocked;await route.continue();});
  await race.goto(new URL('map.html?view=globe&site=900&inspect',base).href,{waitUntil:'domcontentloaded'});await waiting;
  await race.locator('#mapPlace').selectOption(choice);allow();const rf=await ready(race);await rf.evaluate(()=>__globe.pause(true));
  await rf.waitForFunction(name=>__globe.stats().selected===(name||null),choice);assert.equal(await race.locator('#mapPlace').inputValue(),choice);assert.equal(await rf.evaluate(()=>__globe.stats().activeScene),null);assert.equal(await rf.evaluate(()=>__globe.stats().pendingScene),null);
  await race.unroute('**/land-mask.png*');
 }
 report.checks.latestChoiceWinsDuringInitialLoad=true;
 await race.goto(new URL('map.html?view=globe&site=900&inspect&frame=wide',base).href);const direct=await ready(race);await direct.waitForFunction(()=>__globe.stats().activeScene===900);await direct.evaluate(()=>__globe.pause(true));assert.equal(await race.locator('#mapPlace').inputValue(),'安那其学院');
 await direct.locator('#embed-clean').click();await direct.locator('#restore-ui').click();assert.equal(await direct.evaluate(()=>__globe.stats().activeScene),900);report.checks.academyDeepLinkAndCleanRestore=true;await race.close();
 const touchContext=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});const touch=await touchContext.newPage();watch(touch);
 await touch.goto(new URL('map.html?view=globe',base).href);const tf=await ready(touch);await tf.evaluate(()=>__globe.pause(true));
 await tf.locator('#embed-clean').tap();await tf.locator('#restore-ui').tap();await tf.waitForFunction(()=>!__globe.stats().clean);
 await tf.locator('#embed-clean').tap();await touch.locator('#mapRestoreUI').tap();await touch.waitForFunction(()=>!__mapView.stats().clean);
 await tf.locator('#embed-layers').tap();await touch.locator('#mapPlace').selectOption('安那其学院');await tf.locator('#detail').waitFor({state:'visible'});assert(!await tf.locator('.layers').isVisible());
 report.checks.touchEmulatedCleanExit=true;
 await touch.setViewportSize({width:390,height:480});await tf.locator('#embed-search').tap();await tf.locator('#search').fill('学院');
 assert(await tf.locator('#place-list .place').first().isVisible());await tf.locator('#fold').tap();await tf.locator('#explorer-content').waitFor({state:'hidden'});assert(await tf.locator('#embed-search').isVisible());report.checks.shortScreenSearchAndTapReturn=true;await touchContext.close();
 assert.deepEqual(report.errors,[]);fs.writeFileSync(new URL('verification-map-v17.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report.checks));
}finally{await b.close();}
