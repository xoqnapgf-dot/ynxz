import {chromium} from 'playwright';
import c from '@sparticuz/chromium';
import fs from 'node:fs';import assert from 'node:assert/strict';
const out=new URL('./verification-v8.json',import.meta.url);
const report={revision:8,scope:'Eight interactive scenes, ordinary-resolution shader/render and navigation regression; no new 4K delivery',viewport:[800,500],errors:[],scenes:[]};
const b=await chromium.launch({executablePath:await c.executablePath(),args:c.args,headless:true});
try{
 const p=await b.newPage({viewport:{width:800,height:500}});p.setDefaultTimeout(180000);
 let glbRequests=0;p.on('request',r=>{if(r.url().includes('.glb'))glbRequests++;});
 p.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGEERROR',e.message)});
 p.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('ERROR',m.text().slice(0,2500))}});
 await p.goto(process.env.ATLAS_URL||'http://127.0.0.1:8135/');await p.waitForFunction(()=>window.__globe?.ready);
 await p.evaluate(()=>__globe.pause(true));report.initial=await p.evaluate(()=>__globe.stats());report.initial.glbRequests=glbRequests;
 assert.equal(glbRequests,0,'GLB must not block planet');assert.equal(report.initial.loadedModels,0);
 console.log('PLANET READY',JSON.stringify(report.initial));
 for(const id of [9,12,11,'falota','shiomi',902,901,900]){
  const start=Date.now();console.log('ENTER',id);
  const ok=await p.evaluate(id=>__globe.inspect(id),id);assert(ok,await p.locator('#scene-loading-text').textContent());
  await p.evaluate(()=>__globe.setClean(true));
  const u=await p.evaluate(()=>__globe.captureHQ({width:800,height:500,samples:1,download:false}));
  assert(u.startsWith('data:image/png;base64,')); // ordinary-resolution render, not a screenshot deliverable
  const stats=await p.evaluate(()=>__globe.stats());assert.equal(stats.activeScene,id);assert(stats.assetLighting&&stats.contactOcclusion);assert.equal(stats.markers,20);assert.equal(stats.locations,28);
  const geo=stats.geometry.find(g=>g.id===id);assert.equal(geo.finishRevision,8);assert(geo.grassClumps>0,'missing ecology '+id);
  await p.evaluate(()=>__globe.frame('street'));await p.evaluate(()=>__globe.frame('wide'));
  await p.evaluate(()=>{__globe.setClean(false);__globe.view('overview');__globe.settle();});
  const exit=await p.evaluate(()=>__globe.stats());assert.equal(exit.activeScene,null);assert(!exit.assetLighting&&!exit.contactOcclusion);
  report.scenes.push({id,geometry:geo,assetLighting:stats.assetLighting,contactOcclusion:stats.contactOcclusion,returnedToGlobe:true,elapsedMs:Date.now()-start});console.log('PASS',id,JSON.stringify(geo));
 }
 report.final=await p.evaluate(()=>__globe.stats());assert.equal(report.final.loadedModels,8);assert.deepEqual(report.errors,[]);report.glbRequests=glbRequests;
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('COMPLETE',report.scenes.length);
}finally{await b.close();}
