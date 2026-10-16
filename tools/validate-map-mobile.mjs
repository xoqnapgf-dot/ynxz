await import('./validate-map.mjs');
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root));
const report=JSON.parse(read('tools/verification-map-mobile-v18.json'));
assert.equal(report.revision,18);assert.deepEqual(report.errors,[]);
for(const key of ['navigationAndFlatTools','globeToolsAndEscape','oneRowSceneCardAndWeather','flatTouchPinch','all28PlaceCards','responsiveSceneAreaAndReachableControls','sceneDisclosureCameraAndClean','globeTouchPinch','portraitLandscapeSearchLayersAndFlat'])assert.equal(report.checks[key],true,key);
// v18 mobile images are historical: its simplified parent navigation was rejected.
const current=JSON.parse(read('tools/verification-map-pages-v21.json'));assert.equal(current.revision,21);
const fresh=JSON.parse(read('tools/verification-environments-v18.json'));
const shell=new Set(['map.html','css/map-view.css','js/map-view.js']);
for(const [file]of Object.entries(report.sourceHashes)){const expected=shell.has(file)?current.sourceHashes[file]:fresh.sourceHashes[file];assert(expected,file);assert.equal(createHash('sha256').update(read(file)).digest('hex'),expected,'renderer changed after the eight-scene regression / stale current page: '+file);}
const gallery=read('drafts/pierteia-globe/screenshots/mobile-v18/index.html').toString();
assert.equal(report.screenshots.length,35);assert.equal(new Set(report.screenshots.map(s=>s.name)).size,35);
for(const s of report.screenshots){assert(gallery.includes(`after/${s.name}.jpg`),'gallery missing '+s.name);assert(s.scrollWidth<=s.width);const image=read(`drafts/pierteia-globe/screenshots/mobile-v18/after/${s.name}.jpg`);assert(image.length>2000);assert.equal(image[0],255);assert.equal(image[1],216);}
for(const name of ['390-scene','320-scene','844-scene','390-overview']){assert(gallery.includes(`before/${name}.jpg`));assert(read(`drafts/pierteia-globe/screenshots/mobile-v18/before/${name}.jpg`).length>2000);}
for(const size of ['320x640','360x740','390x844','390x480','430x932','667x375','844x390','768x1024','1440x900'])assert(report.screenshots.some(s=>`${s.width}x${s.height}`===size));
console.log('PASS: historical v18 35-after / 4-before images and unchanged shell navigation; inherited renderer matches the fresh v18 eight-scene regression; current shell checked by v21 report. Not physical Safari.');
