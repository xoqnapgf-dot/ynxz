import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root));
await import('../drafts/pierteia-globe/tools/test-regional-environments.mjs');
const report=JSON.parse(read('tools/verification-environments-v17.json'));
assert.equal(report.revision,17);assert.deepEqual(report.errors,[]);
assert.deepEqual(report.scenes.map(s=>s.id),[900,9,12,11,'falota','shiomi',902,901]);
for(const [file,sha]of Object.entries(report.sourceHashes))assert.equal(createHash('sha256').update(read(file)).digest('hex'),sha,'stale environment browser report: '+file);
for(const key of ['weatherToggleChangesActualRender','weatherClockAdvances','eightDistinctEnvironments','orbitLightFogAndEnvironmentRestored','lazyAcademyAssetRetained','mobileWeatherControlsReachable','reducedMotionDisablesWeatherOverlays'])assert.equal(report.checks[key],true,key);
for(const scene of report.scenes){assert.equal(scene.environment.revision,17);assert(scene.environment.interpretation);assert(scene.geometry.regionalMaterials>0);assert(scene.geometry.regionalPlants>0);}
assert.equal(report.closeViews.length,5);assert.equal(report.screenshots.length,17);
for(const shot of report.screenshots){const image=read(`drafts/pierteia-globe/screenshots/environments-v17/${shot.name}.jpg`);assert(image.length>2000);assert.equal(image[0],255);assert.equal(image[1],216);assert(shot.width<=1000&&shot.height<=844);}
const gallery=read('drafts/pierteia-globe/screenshots/environments-v17/index.html').toString();for(const shot of report.screenshots)assert(gallery.includes(shot.name+'.jpg'));
console.log('PASS: v17 eight-scene GPU report, five close views, 17 ordinary-resolution images, seven environmental/UI checks and matching source hashes. Not an assertion of final art quality.');
