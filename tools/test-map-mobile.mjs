import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),c=require('@sparticuz/chromium');
const root=new URL('../',import.meta.url),base=process.env.ATLAS_URL||'http://127.0.0.1:8135/',folder=new URL('drafts/pierteia-globe/screenshots/mobile-v18/after/',root);
fs.mkdirSync(folder,{recursive:true});if(process.env.TEST_FONT)await c.font(process.env.TEST_FONT);
const report={revision:18,scope:'UI screenshots / touch emulation; not physical iOS or art approval',screenshots:[],checks:{},errors:[],sourceHashes:{}};
for(const f of ['map.html','js/map-mobile.js','drafts/pierteia-globe/compact-tools.js','css/map-view.css','js/map-view.js','drafts/pierteia-globe/index.html','drafts/pierteia-globe/globe.js','drafts/pierteia-globe/globe.css','drafts/pierteia-globe/regional-environment.js','drafts/pierteia-globe/regional-surfaces.js','drafts/pierteia-globe/regional-profiles.js','drafts/pierteia-globe/map-bridge.js','drafts/pierteia-globe/map-embed.css','drafts/pierteia-globe/responsive-ui.js'])report.sourceHashes[f]=createHash('sha256').update(fs.readFileSync(new URL(f,root))).digest('hex');
const b=await chromium.launch({executablePath:await c.executablePath(),args:c.args.filter(a=>a!=='--disable-web-security'),headless:true});
const reveal=async(f,selector)=>{if(!await f.locator(selector).isVisible()&&await f.locator('#compact-tools').isVisible())await f.locator('#compact-tools').click();};
const tool=async(f,selector,method='click')=>{if(selector==='#embed-layers'&&!await f.locator(selector).isVisible()&&await f.locator('.layers').isVisible()){await f.locator('#close-layers')[method]();return;}await reveal(f,selector);await f.locator(selector)[method]();};
try{
 const context=await b.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await context.newPage();p.setDefaultTimeout(180000);p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});let f;
 const shot=async(name,render=true)=>{
  if(f&&render){await f.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await f.evaluate(()=>new Promise(resolve=>{__globe.settle();const n=__globe.stats().renderer.frame;__globe.pause(false);const done=()=>{if(__globe.stats().renderer.frame>n){__globe.pause(true);resolve();}else requestAnimationFrame(done);};requestAnimationFrame(done);}));}
  await p.screenshot({path:new URL(name+'.jpg',folder).pathname,type:'jpeg',quality:82});
  const layout=await p.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,header:document.querySelector('.site-header').getBoundingClientRect().height,toolbar:document.querySelector('.map-toolbar').getBoundingClientRect().height}));
  assert(layout.scrollWidth<=layout.width);report.screenshots.push({name,...layout,sceneViewport:f?await f.evaluate(()=>__globe.stats().sceneViewport):null});console.log('SHOT',name);
 };
 const hit=async(frame,selector)=>{const result=await frame.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,inBounds:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});assert(result.inBounds&&result.hit,selector+' not reachable '+JSON.stringify(result));assert(result.height>=44,selector+' too short');};
 const select=async name=>{await p.locator('#mapPlace').selectOption(name);await f.waitForFunction(name=>__globe.stats().selected===name,name);};
 await p.goto(new URL('map.html',base).href);await p.waitForFunction(()=>window.__mapView);
 await hit(p,'#mapMenu');await p.locator('#mapMenu').tap();assert(await p.locator('#mapNavigation').isVisible());await shot('390-navigation',false);await p.keyboard.press('Escape');assert(!await p.locator('#mapNavigation').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.id),'mapMenu');
 await p.locator('#flatTools').tap();await shot('390-flat-tools',false);await hit(p,'#zin');const zoomBefore=await p.evaluate(()=>__flatMap.stats().scale);await p.locator('#zin').tap();assert(await p.evaluate(()=>__flatMap.stats().scale)>zoomBefore);await p.keyboard.press('Escape');assert(!await p.locator('#flatToolsPanel').isVisible());report.checks.navigationAndFlatTools=true;
 await p.locator('#mapPlace').selectOption('铁枢人民共和国');assert(!await p.locator('#ncDesc').isVisible());await shot('390-flat-summary',false);await p.locator('#ncFold').tap();assert(await p.locator('#ncDesc').isVisible());await shot('390-flat-description',false);await p.locator('#ncClose').tap();
 // Actual touchscreen pinch events, not an API-only zoom test.
 const cdp=await context.newCDPSession(p),startScale=await p.evaluate(()=>__flatMap.stats().scale);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:330},{x:230,y:330}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:330},{x:270,y:330}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await p.evaluate(()=>__flatMap.stats().scale)>startScale);report.checks.flatTouchPinch=true;
 await p.locator('#viewGlobe').tap();await p.waitForFunction(()=>__mapView.stats().ready);f=p.frames().find(f=>f.url().includes('embed=map'));await f.locator('#loading').waitFor({state:'hidden'});await f.evaluate(()=>{__globe.view('overview');__globe.pause(true)});await shot('390-overview');assert(!await f.locator('.explorer').isVisible());assert(!await f.locator('.zoom-controls').isVisible());assert(!await f.locator('.view-switch').isVisible());await f.locator('#compact-tools').tap();await shot('390-globe-tools');await hit(f,'#zoom-in');await p.keyboard.press('Escape');assert(!await f.locator('#compact-tools-panel').isVisible());assert.equal(await f.evaluate(()=>document.activeElement.id),'compact-tools');report.checks.globeToolsAndEscape=true;
 await tool(f,'#embed-layers','tap');await shot('390-layers');await hit(f,'#close-layers');await tool(f,'#embed-layers','tap');
 await f.locator('#embed-search').tap();await f.locator('#search').fill('学院');await shot('390-search');assert(await f.locator('#search').isVisible());
 await p.setViewportSize({width:390,height:480});await shot('390-short-search');await hit(f,'#search');await p.setViewportSize({width:390,height:844});await f.locator('#search').fill('');
 await select('铁枢人民共和国');await shot('390-country-summary');assert(!await f.locator('#detail-copy').isVisible());await f.locator('#detail-fold').tap();await shot('390-country-description');await hit(f,'#detail-fold');await hit(f,'#close-detail');
 // Every formal place, including children and long names, must produce a reachable card.
 const names=await p.locator('#mapPlace option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
 for(const name of names){await select(name);assert(!await f.locator('#detail-copy').isVisible());await hit(f,'#detail-fold');await hit(f,'#close-detail');}report.checks.all28PlaceCards=true;
 await select('安那其学院');await shot('390-academy-selected');
 for(const [width,height] of [[360,740],[768,1024],[1440,900]]){await p.setViewportSize({width,height});await shot(`${width}-selected`);}
 await p.setViewportSize({width:390,height:844});await hit(f,'#inspect');await f.locator('#inspect').tap();await f.waitForFunction(()=>__globe.stats().activeScene===900);await f.evaluate(()=>__globe.pause(true));
 for(const [width,height] of [[320,640],[390,844],[430,932],[667,375],[844,390]]){
  await p.setViewportSize({width,height});await shot(`${width}-academy-scene`);assert((await f.locator('#detail').boundingBox()).height<=66,'collapsed scene card should be one row');
  if(width<=700||height<=500){await hit(f,'#detail-fold');await hit(f,'#close-detail');await hit(f,'#scene-camera');assert(!await f.locator('#detail-copy').isVisible());assert(await f.locator('#embed-overview').isVisible());
   const geometry=await f.evaluate(()=>{const a=__globe.stats().sceneViewport,d=document.querySelector('#detail').getBoundingClientRect();return {a,d:{x:d.x,y:d.y,right:d.right,bottom:d.bottom},w:innerWidth,h:innerHeight};});const {a,d}=geometry;
   assert(a.width>100&&a.height>90);assert(a.x+a.width<=d.x||a.y+a.height<=d.y||a.x>=d.right||a.y>=d.bottom,'scene area intersects detail card');
   if(width>=560){await f.locator('#detail-fold').tap();for(const control of ['#close-detail','#detail-fold','#scene-camera','#compact-tools'])await hit(f,control);await f.locator('#detail-fold').tap();}
  }
 }
 report.checks.responsiveSceneAreaAndReachableControls=true;
 await p.setViewportSize({width:390,height:844});await f.locator('#scene-camera').selectOption('courtyard');await shot('390-courtyard');assert.equal(await f.locator('[data-detail-view=courtyard]').getAttribute('aria-pressed'),'true');
 await f.locator('#detail-fold').tap();await shot('390-scene-description');await f.locator('#detail-copy').evaluate(el=>el.scrollTop=el.scrollHeight);await hit(f,'#scene-camera');await hit(f,'#detail-fold');await f.locator('#detail-fold').tap();
 await tool(f,'#embed-clean','tap');await shot('390-clean');await f.locator('#restore-ui').tap();assert.equal(await f.evaluate(()=>__globe.stats().activeScene),900);report.checks.sceneDisclosureCameraAndClean=true;
 // Pinch in the 3D viewport must leave the card usable and change the orbit distance.
 const before=await f.evaluate(()=>__globe.stats().localCamera);const frameBox=await p.locator('#globeFrame').boundingBox();const y=frameBox.y+220;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y},{x:230,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:115,y},{x:265,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notDeepEqual(await f.evaluate(()=>__globe.stats().localCamera),before);await hit(f,'#scene-camera');report.checks.globeTouchPinch=true;
 await p.setViewportSize({width:844,height:390});await f.locator('#detail-fold').tap();await shot('844-scene-description');await hit(f,'#close-detail');await hit(f,'#compact-tools');await hit(f,'#detail-fold');await hit(f,'#scene-camera');await f.locator('#detail-fold').tap();
 await f.locator('#embed-overview').tap();assert(!await f.evaluate(()=>__globe.stats().inspection));await tool(f,'#embed-layers','tap');await shot('844-layers');await hit(f,'#close-layers');await tool(f,'#embed-layers','tap');await f.locator('#embed-search').tap();await shot('844-search');
 await p.setViewportSize({width:390,height:844});await select('常灵群岛');await f.locator('#inspect').tap();await f.waitForFunction(()=>__globe.stats().inspection);await shot('390-islands-scene');assert((await f.locator('#scene-camera option').count())>=2);
 await f.locator('#scene-camera').selectOption('harbor');await shot('390-islands-harbor');
 await select('万知城');await f.locator('#inspect').tap();await f.waitForFunction(()=>__globe.stats().inspection);await shot('390-city-scene');
 await p.setViewportSize({width:390,height:844});await select('汐见町');await f.locator('#inspect').tap();await f.waitForFunction(()=>__globe.stats().activeScene==='shiomi');
 for(const [width,height]of [[390,844],[320,640],[844,390]]){await p.setViewportSize({width,height});await shot(`${width}-scene`);await hit(f,'#scene-camera');}
 await p.setViewportSize({width:390,height:844});await f.locator('#detail-fold').tap();await f.locator('#weather-effects').scrollIntoViewIfNeeded();await f.locator('#weather-effects').tap();assert(!await f.evaluate(()=>__globe.stats().regionalEnvironment.weather.enabled));await f.locator('#weather-effects').tap();await shot('390-weather');await f.locator('#detail-fold').tap();report.checks.oneRowSceneCardAndWeather=true;
 await p.setViewportSize({width:320,height:640});await f.locator('#embed-overview').tap();await f.locator('#embed-search').tap();await shot('320-search');await hit(f,'#search');
 await p.locator('#viewFlat').tap();await p.locator('#mapPlace').selectOption('安那其学院');await shot('320-flat-summary',false);report.checks.portraitLandscapeSearchLayersAndFlat=true;
 assert.deepEqual(report.errors,[]);fs.writeFileSync(new URL('tools/verification-map-mobile-v18.json',root),JSON.stringify(report,null,2)+'\n');console.log('PASS',report.checks);
}finally{await b.close()}
