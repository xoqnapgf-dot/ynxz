import {chromium} from 'playwright';import c from '@sparticuz/chromium';import fs from 'node:fs';import assert from 'node:assert/strict';
const report={revision:11,scope:'Failure injection, retry, cancellation, rapid scene switch, UI navigation',errors:[],expectedNetworkFailures:[]};
const b=await chromium.launch({executablePath:await c.executablePath(),args:c.args,headless:true});
try{
 const p=await b.newPage({viewport:{width:1000,height:650}});p.setDefaultTimeout(120000);
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'){if(m.text().includes('Failed to load resource'))report.expectedNetworkFailures.push(m.text());else report.errors.push(m.text());}});
 await p.goto(process.env.ATLAS_URL||'http://127.0.0.1:8135/');await p.waitForFunction(()=>window.__globe?.ready);await p.evaluate(()=>__globe.pause(true));
 let failedTexture=false;
 await p.route('**/oak-color.jpg*',async route=>{if(!failedTexture){failedTexture=true;await route.abort();}else await route.continue();});
 assert.equal(await p.evaluate(()=>__globe.inspect(9)),false);assert(await p.locator('#scene-retry').isVisible());assert.equal(await p.evaluate(()=>__globe.stats().activeScene),null);report.textureFailureContained=true;
 await p.locator('#scene-retry').click();await p.waitForFunction(()=>__globe.stats().activeScene===9);report.textureRetryPassed=true;
 console.log('PASS texture fail / retry');
 let failedStudyMap=false,hdrAttempts=0;
 await p.route('**/wood_color.jpg',async route=>{if(!failedStudyMap){failedStudyMap=true;await route.abort();}else await route.continue();});
 assert.equal(await p.evaluate(()=>__globe.inspect(900)),false);assert.equal(await p.evaluate(()=>__globe.stats().activeScene),9);report.studyMapFailureContained=true;
 await p.route('**/forest_slope_512.hdr',async route=>{hdrAttempts++;if(hdrAttempts===1)await route.abort();else await route.continue();});
 assert.equal(await p.evaluate(()=>__globe.inspect(900)),false);assert(await p.locator('#scene-retry').isVisible());report.hdrFailureContained=true;

 let attempt=0,release,arrived;const gate=new Promise(resolve=>release=resolve),held=new Promise(resolve=>arrived=resolve);
 await p.route('**/academy-atelier.glb',async route=>{attempt++;if(attempt===1){await route.abort();return;}arrived();await gate;await route.continue();});
 assert.equal(await p.evaluate(()=>__globe.inspect(900)),false);assert(await p.locator('#scene-retry').isVisible());report.glbFailureContained=true;assert.equal(hdrAttempts,2);report.studyAssetsRetryPassed=true;
 await p.locator('#scene-retry').click();await held;
 await p.locator('#scene-cancel').click();assert.equal(await p.evaluate(()=>__globe.stats().pendingScene),null);assert(await p.locator('#scene-loading').isHidden());report.cancelPassed=true;
 assert(await p.evaluate(()=>__globe.inspect(12)));release();
 // The cancelled request is permitted to finish caching, never to activate itself.
 await p.evaluate(async()=>{const {loadAtelier}=await import('./academy-asset.js?v=11');await loadAtelier();});
 assert.equal(await p.evaluate(()=>__globe.stats().activeScene),12);report.lateLoadDidNotStealScene=true;
 assert(await p.evaluate(()=>__globe.inspect(900)));assert.equal(await p.evaluate(()=>__globe.stats().activeScene),900);assert.equal(attempt,2);report.glbRetryAndCachePassed=true;
 await p.evaluate(()=>__globe.frame('materials'));await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>__globe.stats().activeScene),null);report.escapePassed=true;
 await p.locator('#search').fill('学院');await p.locator('#place-list button').click();await p.locator('#inspect').click();await p.waitForFunction(()=>__globe.stats().activeScene===900);report.searchAndReentryPassed=true;
 await p.locator('[data-detail-view="materials"]').click();await p.locator('#close-detail').click();assert.equal(await p.evaluate(()=>__globe.stats().activeScene),null);report.detailControlsPassed=true;
 assert.deepEqual(report.errors,[]);assert.equal(report.expectedNetworkFailures.length,4);
 fs.writeFileSync(new URL('./verification-loading-v11.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('COMPLETE',JSON.stringify(report));
}finally{await b.close();}
