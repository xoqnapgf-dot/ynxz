import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8'),hash=f=>createHash('sha256').update(fs.readFileSync(new URL(f,root))).digest('hex');
const context={};vm.runInNewContext(read('js/map-data.js')+'\n'+read('js/locations-data.js'),context);
const places=JSON.parse(read('drafts/pierteia-globe/assets/places.json'));
assert.deepEqual(JSON.parse(JSON.stringify(context.LOCATION_DATA)),places.locations,'flat and globe location records must agree');
const official=context.MAP_NATIONS.filter(n=>Object.hasOwn(context.LOCATION_DATA,n.name));assert.equal(official.length,20);assert.equal(Object.keys(places.locations).length,28);
for(const marker of places.markers){const flat=official.find(n=>n.name===marker.name);assert(flat);assert.equal(flat.x,marker.x);assert.equal(flat.y,marker.y);assert.equal(flat.id,marker.id);}
const html=read('map.html');for(const id of ['viewFlat','viewGlobe','mapPlace','mapStage','globeHost','fallbackFlat','retryGlobe','mapRestoreUI'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
assert(!html.includes('<iframe'),'3D iframe must be lazy');assert(html.includes('map-view.css?v=2'));assert(html.includes('map-flat.js?v=2'));assert(html.includes('map-view.js?v=5'));
assert(read('drafts/pierteia-globe/index.html').includes('globe.js?v=15'));assert(read('drafts/pierteia-globe/index.html').includes('map-embed.css?v=13.1'));
const report=JSON.parse(read('tools/verification-map-v15.json'));assert.equal(report.revision,15);assert.deepEqual(report.errors,[]);
for(const key of ['flatDoesNotLoad3D','flatStateAndSuspendedRenderer','historyAndSingleFrame','bidirectionalParentLocation','messageOriginSourceAndNameGuards','responsivePanels','hiddenLoadCannotActivate','optionalAcademyAndCamera','scenePreservedAcrossSwitch','contextLossAndRetry','noWebGLFlatFallback','failedTextureRetry','standaloneRetained','cleanExitClickKeyboardParentAndResponsive','layerSelectionAndEscapePriority','samePlaceReopensDetails','emptySelectionClearsBothViews','shortcutEditingModifiersAndRepeat','sceneCleanRestoreAndSearch','standaloneCleanRestore','latestChoiceWinsDuringInitialLoad','academyDeepLinkAndCleanRestore','touchEmulatedCleanExit'])assert.equal(report.checks[key],true,key);
assert.equal(report.viewports.length,4);for(const [file,sha]of Object.entries(report.sourceHashes))assert.equal(hash(file),sha,'browser report is stale: '+file);
assert.equal(report.academy.activeScene,900);assert.equal(report.academy.markers,20);assert.equal(report.academy.locations,28);assert.equal(report.academy.geometry[0].revision,14);assert.equal(report.academy.geometry[0].craftRevision,14);assert(report.academy.geometry[0].meadowTufts>2000);
console.log('PASS: 20 shared coordinates / 28 identical location records, versioned lazy entry, v15 integration checks and tested source hashes.');
