import {chromium} from 'playwright';
import c from '@sparticuz/chromium';
import fs from 'node:fs';import assert from 'node:assert/strict';
const out=new URL('./verification-v14.json',import.meta.url);
const report={revision:14,scope:'Eight interactive scenes, ordinary-resolution shader/render and navigation regression; no new 4K delivery',viewport:[800,500],errors:[],scenes:[],closeViews:[]};
const b=await chromium.launch({executablePath:await c.executablePath(),args:c.args,headless:true});
try{
 const p=await b.newPage({viewport:{width:800,height:500}});p.setDefaultTimeout(180000);
 let glbRequests=0;p.on('request',r=>{if(r.url().includes('.glb'))glbRequests++;});
 p.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGEERROR',e.message)});
 p.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('ERROR',m.text().slice(0,2500))}});
 await p.goto(process.env.ATLAS_URL||'http://127.0.0.1:8135/');await p.waitForFunction(()=>window.__globe?.ready);
 await p.evaluate(()=>__globe.pause(true));report.initial=await p.evaluate(()=>__globe.stats());report.initial.glbRequests=glbRequests;assert.equal(report.initial.revision,14);
 assert.equal(glbRequests,0,'GLB must not block planet');assert.equal(report.initial.loadedModels,0);
 console.log('PLANET READY',JSON.stringify(report.initial));
 for(const id of [900,9,12,11,'falota','shiomi',902,901]){
  const start=Date.now();console.log('ENTER',id);
  const ok=await p.evaluate(id=>__globe.inspect(id),id);assert(ok,await p.locator('#scene-loading-text').textContent());
  await p.evaluate(()=>__globe.setClean(true));
  const u=await p.evaluate(()=>__globe.captureHQ({width:800,height:500,samples:1,download:false}));
  assert(u.startsWith('data:image/png;base64,')); // ordinary-resolution render, not a screenshot deliverable
  const stats=await p.evaluate(()=>__globe.stats());assert.equal(stats.activeScene,id);assert(stats.assetLighting&&stats.contactOcclusion);assert.equal(stats.markers,20);assert.equal(stats.locations,28);
  const geo=stats.geometry.find(g=>g.id===id);assert.equal(geo.finishRevision,9);if(id===900){assert.equal(geo.revision,14);assert.equal(geo.landscapeRevision,14);assert(geo.exposedRockLedges>20);assert.equal(geo.plantedShrubs,45);assert.equal(geo.craftRevision,14);assert(geo.meadowTufts>2000);assert(geo.academyOpenings>100);assert(geo.piercedLibrary);}assert(geo.grassClumps>0,'missing ecology '+id);assert(geo.botanicalTrees>0);assert.equal(geo.vegetationRevision,12);assert(geo.treePrototypes<=8);if([12,11,'falota','shiomi'].includes(id))assert(geo.piercedFacades);assert.equal(stats.edgeAntialias,'SMAA');assert(stats.antialiasSamples>0);
  if(id===900||id==='falota')for(const preset of id===900?['hillside','courtyard','joinery','library','teaching','workshop','street','materials']:['street']){
   await p.evaluate(()=>__globe.setClean(false));
   assert(await p.locator(`[data-detail-view="${preset}"]`).isVisible());
   await p.locator(`[data-detail-view="${preset}"]`).click({timeout:10000});await p.evaluate(()=>__globe.setClean(true));
   const close=await p.evaluate(()=>__globe.captureHQ({width:1000,height:650,samples:1,download:false}));
   assert(close.startsWith('data:image/png;base64,'));
   if(id===900&&preset==='courtyard'){
    const now=await p.evaluate(()=>__globe.stats());assert.equal(now.cameraFov,47);assert.equal(now.environmentIntensity,.45);
    const prescribed=[-.03730108067878085,.05875,.2614138536068217];for(let i=0;i<3;i++)assert(Math.abs(now.localCamera[i]-prescribed[i])<1e-7,'controls must not move the ground camera');
    report.groundCamera={local:now.localCamera,eyeAbovePavingMeters:(now.localCamera[1]-.04225)/.01,fov:now.cameraFov};
   }
   if(process.env.CHECK_IMAGES&&id===900&&['hillside','courtyard','joinery','library'].includes(preset))fs.writeFileSync(`${process.env.CHECK_IMAGES}/v14-${preset}.png`,Buffer.from(close.split(',')[1],'base64'));

   report.closeViews.push({id,preset,width:1000,height:650});
  }
  if(id!==900)for(const preset of ['library','teaching','workshop','courtyard','joinery','hillside'])assert(await p.locator(`[data-detail-view="${preset}"]`).isHidden());
  await p.evaluate(()=>__globe.frame('wide'));
  await p.evaluate(()=>{__globe.setClean(false);__globe.view('overview');__globe.settle();});
  const exit=await p.evaluate(()=>__globe.stats());assert.equal(exit.activeScene,null);assert(!exit.assetLighting&&!exit.contactOcclusion);assert.equal(exit.environmentIntensity,1);assert.equal(exit.cameraFov,39);
  report.scenes.push({id,geometry:geo,assetLighting:stats.assetLighting,contactOcclusion:stats.contactOcclusion,returnedToGlobe:true,elapsedMs:Date.now()-start});console.log('PASS',id,JSON.stringify(geo));
 }
 report.final=await p.evaluate(()=>__globe.stats());assert.equal(report.final.loadedModels,8);assert.deepEqual(report.errors,[]);report.glbRequests=glbRequests;
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('COMPLETE',report.scenes.length);
}finally{await b.close();}
