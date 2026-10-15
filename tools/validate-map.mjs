import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8'),hash=f=>createHash('sha256').update(fs.readFileSync(new URL(f,root))).digest('hex');
const context={};vm.runInNewContext(read('js/map-data.js')+'\n'+read('js/locations-data.js'),context);
const places=JSON.parse(read('drafts/pierteia-globe/assets/places.json'));
assert.deepEqual(JSON.parse(JSON.stringify(context.LOCATION_DATA)),places.locations,'flat and globe location records must agree');
const official=context.MAP_NATIONS.filter(n=>Object.hasOwn(context.LOCATION_DATA,n.name));assert.equal(official.length,20);assert.equal(Object.keys(places.locations).length,28);
for(const marker of places.markers){const flat=official.find(n=>n.name===marker.name);assert(flat);assert.equal(flat.x,marker.x);assert.equal(flat.y,marker.y);assert.equal(flat.id,marker.id);}
const html=read('map.html');for(const id of ['viewFlat','viewGlobe','mapPlace','mapStage'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
assert(!html.includes('map-mobile.js'));assert(!html.includes('id="mapMenu"'));assert(!html.includes('id="globeHost"'));
const globe=read('globe.html');assert(globe.includes('id="globeHost"'));assert(!globe.includes('map-flat.js'));assert(!globe.includes('id="mapStage"'));for(const page of [html,globe]){assert(page.includes('href="map.html?release=21"'));assert(page.includes('href="globe.html?release=21"'));assert(page.includes('map-view.css?v=5'));assert(page.includes('map-view.js?v=10'));}
assert(!html.includes('<iframe'),'3D iframe must be lazy');assert(html.includes('map-view.css?v=5'));assert(html.includes('map-flat.js?v=2'));assert(html.includes('map-view.js?v=10'));
assert(read('drafts/pierteia-globe/index.html').includes('globe.js?v=18'));assert(read('drafts/pierteia-globe/index.html').includes('map-embed.css?v=18'));
const report=JSON.parse(read('tools/verification-map-pages-v21.json'));assert.equal(report.revision,21);assert.deepEqual(report.errors,[]);
for(const key of ['homePageNavigation','flatImagesDecoded','portraitImagesDecoded','restoredNavigationAndFlatControls','flatZero3DAndAll28Places','realPageNavigationAndBack','cleanSearchLayersAndMessageGuards','legacyLinksSceneAndReturn','latestChoiceDuringLoad','textureAndContextRetry','noWebGLFlatFallback'])assert.equal(report.checks[key],true,key);
for(const [file,sha]of Object.entries(report.sourceHashes))assert.equal(hash(file),sha,'stale v21 page report: '+file);
assert.equal(report.screenshots.length,10);for(const name of report.screenshots){const image=fs.readFileSync(new URL(`drafts/pierteia-globe/screenshots/pages-v21/${name}.jpg`,root));assert(image.length>2000);assert.equal(image[0],255);assert.equal(image[1],216);}
// The 3D implementation is unchanged from the fully tested v18 renderer.
const old=JSON.parse(read('tools/verification-map-v18.json')),shell=new Set(['map.html','js/map-view.js','css/map-view.css']);
for(const [file,sha]of Object.entries(old.sourceHashes))if(!shell.has(file))assert.equal(hash(file),sha,'changed renderer needs a fresh full regression: '+file);
console.log('PASS: v21 versioned entry points and separate pages, restored navigation, zero flat-page 3D downloads, 28 places, ten images and eleven current checks; unchanged v18 renderer.');
