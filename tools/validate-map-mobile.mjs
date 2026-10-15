import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root)),hash=f=>createHash('sha256').update(read(f)).digest('hex');
const current=fs.existsSync(new URL('tools/verification-map-mobile-v17.json',root));
const report=JSON.parse(read(current?'tools/verification-map-mobile-v17.json':'tools/verification-map-mobile-v16.json'));
assert.equal(report.revision,current?17:16);assert.deepEqual(report.errors,[]);
for(const key of ['flatTouchPinch','all28PlaceCards','responsiveSceneAreaAndReachableControls','sceneDisclosureCameraAndClean','globeTouchPinch','portraitLandscapeSearchLayersAndFlat'])assert.equal(report.checks[key],true,key);
if(current){for(const [file,sha]of Object.entries(report.sourceHashes))assert.equal(hash(file),sha,'stale mobile report: '+file);}
else {
 // v16's 28 images remain historical, not an assertion that all 28 were re-shot.
 for(const file of ['css/map-view.css','drafts/pierteia-globe/map-bridge.js','drafts/pierteia-globe/map-embed.css','drafts/pierteia-globe/responsive-ui.js'])assert.equal(hash(file),report.sourceHashes[file],'v16 UI inheritance changed: '+file);
 const regional=JSON.parse(read('tools/verification-environments-v17.json')),core=JSON.parse(read('tools/verification-map-v17.json'));
 for(const fresh of [regional,core]){assert.equal(fresh.revision,17);assert.deepEqual(fresh.errors,[]);for(const [file,sha]of Object.entries(fresh.sourceHashes))assert.equal(hash(file),sha,'stale v17 browser report: '+file);}
 for(const key of ['mobileWeatherControlsReachable','reducedMotionDisablesWeatherOverlays'])assert(regional.checks[key]);
 for(const key of ['responsivePanels','touchEmulatedCleanExit','shortScreenSearchAndTapReturn','responsiveModeRestoredAfterHiddenFrame'])assert(core.checks[key]);
}
assert.equal(report.screenshots.length,28);assert.equal(new Set(report.screenshots.map(s=>s.name)).size,28);
for(const s of report.screenshots){assert(s.scrollWidth<=s.width);const image=read(`drafts/pierteia-globe/screenshots/mobile-v${report.revision}/after/${s.name}.jpg`);assert(image.length>2000);assert.equal(image[0],255);assert.equal(image[1],216);}
for(const name of ['390-country','390-academy-selected','390-academy-scene','844-academy-scene','320-academy-scene'])assert(read(`drafts/pierteia-globe/screenshots/mobile-v16/before/${name}.jpg`).length>2000);
for(const size of ['320x640','360x740','390x844','390x480','430x932','667x375','844x390','768x1024','1440x900'])assert(report.screenshots.some(s=>`${s.width}x${s.height}`===size),'missing viewport '+size);
console.log(current?'PASS: v17 full mobile report and source hashes.':'PASS: v16 historical 28 after / 5 before images and unchanged responsive modules; fresh v17 mobile-weather / reduced-motion / core-layout checks with current source hashes. The full v16 grid was NOT re-shot. Not physical Safari.');
