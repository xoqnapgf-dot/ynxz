import {createRequire} from 'node:module';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),c=require('@sparticuz/chromium');
const root=new URL('../',import.meta.url),base=process.env.ATLAS_URL||'http://127.0.0.1:8135/';
const sourceFiles=['map.html','js/map-view.js','css/map-view.css','js/map-flat.js','js/map-mobile.js','drafts/pierteia-globe/index.html','drafts/pierteia-globe/globe.js','drafts/pierteia-globe/globe.css','drafts/pierteia-globe/map-embed.css','drafts/pierteia-globe/map-bridge.js','drafts/pierteia-globe/responsive-ui.js','drafts/pierteia-globe/atlas-icons.js','drafts/pierteia-globe/compact-tools.js','drafts/pierteia-globe/landmarks.js','drafts/pierteia-globe/archipelago-hq.js','drafts/pierteia-globe/academy-hillside.js','drafts/pierteia-globe/academy-landscape.js','drafts/pierteia-globe/academy-craft.js','drafts/pierteia-globe/academy-study.js','drafts/pierteia-globe/academy-asset.js','drafts/pierteia-globe/planet-materials.js','drafts/pierteia-globe/world-occlusion.js','drafts/pierteia-globe/world-finish.js','drafts/pierteia-globe/roof-detail.js','drafts/pierteia-globe/regional-scenes.js','drafts/pierteia-globe/regional-environment.js','drafts/pierteia-globe/regional-surfaces.js','drafts/pierteia-globe/regional-profiles.js','drafts/pierteia-globe/ecology.js','drafts/pierteia-globe/vegetation.js'];
const hashes=()=>Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(fs.readFileSync(new URL(f,root))).digest('hex')]));
const report={revision:18,scope:'Actual eight-scene environmental render review for the v22 material pass (sky sun and glitter, pooled wetness, per-plant tone), weather controls, light reset, mobile layout and reduced-motion checks. Ordinary resolution; not physical Safari or meteorological simulation.',sourceHashes:hashes(),errors:[],scenes:[],closeViews:[],checks:{},screenshots:[]};
const output=new URL('drafts/pierteia-globe/screenshots/environments-v18/',root);fs.mkdirSync(output,{recursive:true});
if(process.env.TEST_FONT)await c.font(process.env.TEST_FONT);
const b=await chromium.launch({executablePath:await c.executablePath(),args:c.args.filter(a=>a!=='--disable-web-security'),headless:true});
function watch(p){p.setDefaultTimeout(180000);p.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGEERROR',e.message)});p.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('ERROR',m.text())}});}
async function capture(f,name){
 const image=await f.evaluate(async()=>{const url=await __globe.captureHQ({width:1000,height:650,samples:1,download:false});const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=1000;c.height=650;c.getContext('2d').drawImage(im,0,0);return c.toDataURL('image/jpeg',.92);});
 fs.writeFileSync(new URL(name+'.jpg',output),Buffer.from(image.split(',')[1],'base64'));report.screenshots.push({name,width:1000,height:650,kind:'actual WebGL canvas export, no UI'});return image;
}
try{
 const desktop=await b.newContext({viewport:{width:1200,height:800},hasTouch:true});const p=await desktop.newPage();watch(p);let glbRequests=0;p.on('request',r=>{if(r.url().includes('.glb'))glbRequests++;});
 await p.goto(new URL('map.html?view=globe',base).href);await p.waitForFunction(()=>window.__mapView?.stats().ready);
 const f=p.frames().find(f=>f.url().includes('embed=map'));await f.waitForFunction(()=>window.__globe?.ready);await f.locator('#loading').waitFor({state:'hidden'});await f.evaluate(()=>__globe.pause(true));assert.equal(glbRequests,0);
 for(const id of [900,9,12,11,'falota','shiomi',902,901]){
  console.log('ENTER',id);const ok=await f.evaluate(id=>__globe.inspect(id),id);assert(ok,JSON.stringify(await f.evaluate(()=>__globe.stats())));await f.evaluate(()=>__globe.setClean(true));
  await capture(f,String(id));const stats=await f.evaluate(()=>__globe.stats()),geo=stats.geometry.find(g=>g.id===id);
  assert.equal(stats.activeScene,id);assert.equal(stats.markers,20);assert.equal(stats.locations,28);assert.equal(stats.regionalEnvironment.revision,18);assert.equal(stats.regionalEnvironment.key,String(id));assert(stats.regionalEnvironment.interpretation);assert(geo.regionalMaterials>0);assert(geo.regionalPlants>0,'habitat missing '+id);assert(stats.lighting.fog);assert.equal(geo.vegetationRevision,12);assert.equal(stats.shadowSize,4096);
  if(id===900){assert.equal(geo.revision,14);assert.equal(geo.craftRevision,14);assert.equal(geo.drainageRuns,10);assert(geo.meadowTufts>2000);assert(geo.circledA);assert.equal(stats.environmentIntensity,.45);}
  if(id===11){assert.equal(geo.water.kind,'lake');assert(geo.water.wave<.4);assert(geo.water.foam<.1);}
  if(id==='shiomi'){assert.equal(geo.water.level,-.008);assert.equal(stats.regionalEnvironment.weather.kind,'rain');assert(stats.regionalEnvironment.weather.roofShelters>25);}
  if(id===902){assert.equal(stats.regionalEnvironment.weather.kind,'snow');assert.equal(geo.headwaterStreams,1);}
  report.scenes.push({id,name:stats.selected,geometry:geo,environment:stats.regionalEnvironment,lighting:stats.lighting});
  if([900,12,11,'falota','shiomi'].includes(id)){
   const preset=id===900?'hillside':'street';await f.evaluate(preset=>__globe.frame(preset),preset);await capture(f,String(id)+'-'+preset);report.closeViews.push({id,preset});
  }
  if(id==='shiomi'){
   await f.evaluate(()=>{__globe.frame('wide');__globe.setClean(false);});await f.locator('#weather-effects').uncheck();assert(!await f.evaluate(()=>__globe.stats().regionalEnvironment.weather.enabled));
   await f.evaluate(()=>__globe.setClean(true));const dry=await capture(f,'shiomi-effects-off');await f.evaluate(()=>__globe.setClean(false));await f.locator('#weather-effects').check();assert(await f.evaluate(()=>__globe.stats().regionalEnvironment.weather.enabled));await f.evaluate(()=>__globe.setClean(true));const wet=await capture(f,'shiomi-effects-on');assert.notEqual(dry,wet);report.checks.weatherToggleChangesActualRender=true;
   const time=await f.evaluate(()=>__globe.stats().regionalEnvironment.weather.time);await f.evaluate(()=>__globe.pause(false));await f.waitForFunction(t=>__globe.stats().regionalEnvironment.weather.time>t+.2,time);await f.evaluate(()=>__globe.pause(true));report.checks.weatherClockAdvances=true;
  }
  await f.evaluate(()=>{__globe.setClean(false);__globe.view('overview');__globe.settle();});const exit=await f.evaluate(()=>__globe.stats());assert.equal(exit.regionalEnvironment,null);assert.equal(exit.lighting.fog,null);assert.equal(exit.lighting.sunColor,'fff1dc');assert.equal(exit.lighting.sky,'cfdee1');assert.equal(exit.environmentIntensity,1);assert(!exit.assetLighting&&!exit.contactOcclusion);assert.deepEqual(report.errors,[]);console.log('PASS',id,'plants',geo.regionalPlants,'materials',geo.regionalMaterials);
 }
 report.checks.eightDistinctEnvironments=new Set(report.scenes.map(s=>s.environment.label)).size===8;report.checks.orbitLightFogAndEnvironmentRestored=true;assert.equal(glbRequests,1);report.checks.lazyAcademyAssetRetained=true;
 await f.evaluate(()=>__globe.inspect('shiomi'));await p.setViewportSize({width:390,height:844});await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await f.evaluate(()=>__globe.captureHQ({width:390,height:650,samples:1,download:false}));
 // A normal rendered frame after export restores the UI-aware viewport.
 await f.evaluate(()=>__globe.pause(false));await f.waitForFunction(()=>__globe.stats().renderer.frame>0);await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await f.evaluate(()=>__globe.pause(true));
 await p.screenshot({path:new URL('mobile-shiomi.jpg',output).pathname,type:'jpeg',quality:91});report.screenshots.push({name:'mobile-shiomi',width:390,height:844,kind:'actual map UI screenshot'});
 await f.locator('#detail-fold').tap();await f.locator('#weather-effects').scrollIntoViewIfNeeded();await f.locator('#weather-effects').uncheck();assert(!await f.evaluate(()=>__globe.stats().regionalEnvironment.weather.enabled));await f.locator('#weather-effects').check();
 const layout=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(layout.scroll<=layout.width);const box=await f.locator('#weather-effects').boundingBox();assert(box&&box.x>=0&&box.y>=0);const parent=await f.locator('#weather-effects').evaluate(e=>e.parentElement.getBoundingClientRect().height);assert(parent>=44);
 await f.evaluate(()=>__globe.pause(false));await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await f.evaluate(()=>__globe.pause(true));
 await p.screenshot({path:new URL('mobile-weather-controls.jpg',output).pathname,type:'jpeg',quality:91});report.screenshots.push({name:'mobile-weather-controls',width:390,height:844,kind:'actual expanded mobile map UI'});report.checks.mobileWeatherControlsReachable=true;
 await f.evaluate(()=>__globe.view('overview'));
 // Keep a page alive while recycling WebGL-heavy scenes in single-process Chromium.
 const rp=await desktop.newPage();await rp.setViewportSize({width:1000,height:700});await rp.emulateMedia({reducedMotion:'reduce'});watch(rp);await p.close();await rp.goto(new URL('drafts/pierteia-globe/',base).href);await rp.waitForFunction(()=>window.__globe?.ready);await rp.evaluate(()=>__globe.pause(true));assert(await rp.evaluate(()=>__globe.inspect('shiomi')));await rp.evaluate(()=>__globe.captureHQ({width:640,height:400,samples:1,download:false}));const state=await rp.evaluate(()=>__globe.stats());assert(!state.regionalEnvironment.weather.enabled);assert(await rp.locator('#weather-effects').isDisabled());report.checks.reducedMotionDisablesWeatherOverlays=true;await rp.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.sourceHashes,'source changed during browser validation');fs.writeFileSync(new URL('tools/verification-environments-v18.json',root),JSON.stringify(report,null,2)+'\n');console.log('COMPLETE',report.scenes.length,'scenes',report.screenshots.length,'images',JSON.stringify(report.checks));
}finally{await b.close();}
