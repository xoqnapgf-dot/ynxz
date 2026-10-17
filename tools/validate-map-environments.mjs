await import('./validate-map.mjs');
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root));
await import('../drafts/pierteia-globe/tools/test-regional-environments.mjs');
const report=JSON.parse(read('tools/verification-environments-v18.json'));
assert.equal(report.revision,18);assert.deepEqual(report.errors,[]);
assert.deepEqual(report.scenes.map(s=>s.id),[900,9,12,11,'falota','shiomi',902,901]);
// The v22 material pass re-ran the eight-scene regression; this v18 environment
// report is the fresh renderer baseline. Every source it hashed must still be
// byte-identical in the working tree, so any renderer edit fails until the
// suite is rerun. The earlier v17 report/images stay in Git history.
const current=JSON.parse(read('tools/verification-map-pages-v21.json'));assert.equal(current.revision,21);assert.deepEqual(current.errors,[]);
for(const [file,sha]of Object.entries(report.sourceHashes))assert.equal(createHash('sha256').update(read(file)).digest('hex'),sha,'stale eight-scene regression source: '+file);
for(const [file,sha]of Object.entries(current.sourceHashes))assert.equal(createHash('sha256').update(read(file)).digest('hex'),sha,'stale v21 report: '+file);
for(const key of ['weatherToggleChangesActualRender','weatherClockAdvances','eightDistinctEnvironments','orbitLightFogAndEnvironmentRestored','lazyAcademyAssetRetained','mobileWeatherControlsReachable','reducedMotionDisablesWeatherOverlays'])assert.equal(report.checks[key],true,key);
for(const scene of report.scenes){assert.equal(scene.environment.revision,18);assert(scene.environment.interpretation);assert(scene.geometry.regionalMaterials>0);assert(scene.geometry.regionalPlants>0);}
assert.equal(report.closeViews.length,5);assert.equal(report.screenshots.length,17);
for(const shot of report.screenshots){const image=read(`drafts/pierteia-globe/screenshots/environments-v18/${shot.name}.jpg`);assert(image.length>2000);assert.equal(image[0],255);assert.equal(image[1],216);assert(shot.width<=1000&&shot.height<=844);}
const gallery=read('drafts/pierteia-globe/screenshots/environments-v18/index.html').toString();for(const shot of report.screenshots)assert(gallery.includes(shot.name+'.jpg'));
console.log('PASS: fresh v18 eight-scene GPU regression for the v22 material pass; current v21 page source hashes. Historical v17 images kept in Git history. Not physical Safari and not an assertion of final art quality.');
