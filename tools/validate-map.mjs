// v22 静态校验：平面地图改为代码渲染（atlas），不再依赖底图图片。
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const ctx={};ctx.window=ctx;vm.runInNewContext(read('js/map-data.js')+'\n'+read('js/locations-data.js')+'\n'+read('js/atlas-data.js'),ctx);
const L=ctx.LOCATION_DATA,N=ctx.MAP_NATIONS,A=ctx.ATLAS_DATA;
const places=JSON.parse(read('drafts/pierteia-globe/assets/places.json'));
assert.deepEqual(JSON.parse(JSON.stringify(L)),places.locations,'flat and globe location records must agree');
const official=N.filter(n=>Object.hasOwn(L,n.name));assert.equal(official.length,20);
for(const marker of places.markers){const flat=official.find(n=>n.name===marker.name);assert(flat,marker.name);assert.equal(flat.x,marker.x);assert.equal(flat.y,marker.y);}
for(const [k,v] of Object.entries(L)){if(v.parent)assert(Object.hasOwn(L,v.parent),k+' parent');}
for(const [a,n] of Object.entries(ctx.LOCATION_ALIAS||{}))assert(Object.hasOwn(L,n),'alias '+a);
// atlas 数据完整
assert.equal(A.W,3000);assert.equal(A.H,935);assert.equal(A.gw*A.step,3000);
for(const k of ['height','biome','state','temp'])assert.equal(Buffer.from(A[k],'base64').length,A.gw*A.gh,k);
assert(A.coast.length>10&&A.rivers.length>100&&A.borders.length>50&&A.islets.length>=20);
for(const n of N)if(n.id<900&&n.type!=='special'||n.name==='万知城')assert(A.regions[n.id],'region for '+n.name);
// 页面入口
const html=read('map.html'),globe=read('globe.html');
for(const id of ['viewFlat','viewGlobe','mapStage','atlasCanvas','atlasCard','atlasSearch'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
assert(!/<img[^>]+素材\/地图/.test(html),'flat map must not load base images');assert(!html.includes('<iframe'),'3D iframe must be lazy');
assert(globe.includes('id="globeHost"')&&globe.includes('id="mapPlace"'));
const ver=p=>(p.match(/map-view\.(css|js)\?v=\d+/g)||[]).sort().join();assert.equal(ver(html),ver(globe),'map/globe share map-view versions');
for(const page of fs.readdirSync(new URL('.',root)).filter(f=>f.endsWith('.html')))assert(!read(page).includes('release=21'),page+' still on release 21');
console.log('PASS: v22 code-rendered atlas, 28 places, 20 mapped places, atlas data and entry points consistent.');
