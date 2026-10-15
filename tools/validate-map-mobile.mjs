import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root)),hash=f=>createHash('sha256').update(read(f)).digest('hex');
const report=JSON.parse(read('tools/verification-map-mobile-v16.json'));
assert.equal(report.revision,16);assert.deepEqual(report.errors,[]);
for(const key of ['flatTouchPinch','all28PlaceCards','responsiveSceneAreaAndReachableControls','sceneDisclosureCameraAndClean','globeTouchPinch','portraitLandscapeSearchLayersAndFlat'])assert.equal(report.checks[key],true,key);
for(const [file,sha]of Object.entries(report.sourceHashes))assert.equal(hash(file),sha,'stale mobile report: '+file);
assert.equal(report.screenshots.length,28);assert.equal(new Set(report.screenshots.map(s=>s.name)).size,28);
for(const s of report.screenshots){assert(s.scrollWidth<=s.width);const image=read(`drafts/pierteia-globe/screenshots/mobile-v16/after/${s.name}.jpg`);assert(image.length>2000);assert.equal(image[0],255);assert.equal(image[1],216);}
for(const name of ['390-country','390-academy-selected','390-academy-scene','844-academy-scene','320-academy-scene'])assert(read(`drafts/pierteia-globe/screenshots/mobile-v16/before/${name}.jpg`).length>2000);
for(const size of ['320x640','360x740','390x844','390x480','430x932','667x375','844x390','768x1024','1440x900'])assert(report.screenshots.some(s=>`${s.width}x${s.height}`===size),'missing viewport '+size);
console.log('PASS: mobile UI source hashes, 28 after / 5 before screenshots, 8 viewport sizes plus short-screen search, six touch/layout checks. Not a physical-device Safari test.');
