import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name));
const data=JSON.parse(read('assets/places.json'));
const provenance=JSON.parse(read('assets/provenance.json'));
assert.equal(data.markers.length,20);assert.equal(Object.keys(data.locations).length,28);
assert.equal(new Set(data.markers.map(m=>m.id)).size,20);
for(const m of data.markers){assert(m.x>=0&&m.x<=1&&m.y>=0&&m.y<=1,m.name);assert(data.locations[m.name],m.name);}
for(const [name,place]of Object.entries(data.locations)){if(place.parent)assert(data.locations[place.parent],name);}
assert.deepEqual(provenance.textureSize,[6144,3072]);assert.equal(provenance.cells,12450);
assert.equal(provenance.revision,3);assert.equal(provenance.borders,1732);assert.equal(provenance.rivers,91);
const pngSize=name=>{const b=read(name);assert.equal(b.subarray(1,4).toString(),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];};
assert.deepEqual(pngSize('assets/elevation.png'),provenance.textureSize);
assert.deepEqual(pngSize('assets/land-mask.png'),provenance.textureSize);
assert.deepEqual(pngSize('assets/clouds.png'),[4096,2048]);
assert.deepEqual(pngSize('assets/cirrus.png'),[4096,2048]);
for(const name of ['01-world-overview','02-anarchist-academy','03-changling-rift','04-tianshen-peak','05-wanzhi-city','08-planet-same-angle','09-eastern-relief','10-strait-weather']){
 assert.deepEqual(pngSize(`screenshots/${name}.png`),[2160,1350]);assert(read(`screenshots/previews/${name}.jpg`).length>1000);
}
for(const name of ['06-mobile-overview','07-mobile-academy'])assert.deepEqual(pngSize(`screenshots/${name}.png`),[390,844]);
const html=read('index.html').toString();assert(html.includes('globe.js?v=4'));assert(html.includes('globe.css?v=4'));
assert(read('globe.js').toString().includes('landmarks.js?v=4'));
for(const name of ['assets/surface.jpg','assets/surface-normal.jpg','assets/roughness.jpg','assets/atlas-font.woff2','vendor/THREE-LICENSE.txt','vendor/FONT-LICENSE.txt','vendor/addons/BufferGeometryUtils.js'])assert(read(name).length>100);
const docs=read('README.md').toString();for(const match of docs.matchAll(/\]\((screenshots\/[^)]+)\)/g))assert(fs.existsSync(path.join(root,match[1])),match[1]);
assert(read('globe.js').toString().includes('planet-materials.js?v=3'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const preserved={
 'assets/places.json':'15808ba2d908b64954062182e95f00fea08a580b7268db667b6562a7334a8a67',
 'assets/lines.json':'ec516ceb7bdec27105fa136a82fe37965547e78659ffc53a4d5c1ab203965937',
 'assets/land-mask.png':'9bafc1af7f096559c29dd8a25df9704d82e92f5e00dc2d034d7601663678a758'
};
for(const [name,expected]of Object.entries(preserved))assert.equal(hash(read(name)),expected,'v2 preservation: '+name);
assert.equal(hash(fs.readFileSync(path.resolve(root,'../..',provenance.source))),provenance.sourceSha256);
const weather=JSON.parse(read('assets/weather-provenance.json'));assert.equal(weather.revision,3);assert(weather.coverageAbove10Percent>.05&&weather.coverageAbove10Percent<.45);
const verification=JSON.parse(read('tools/verification-v3.json'));assert.deepEqual(verification.desktop.errors,[]);assert.deepEqual(verification.mobile.errors,[]);assert.equal(verification.mobile.result.documentWidth,390);
const hq=JSON.parse(read('tools/verification-v4.json'));
assert.equal(hq.revision,4);assert.deepEqual(hq.errors,[]);assert.equal(hq.captures.length,3);
for(const shot of hq.captures){assert.equal(shot.samples,4);assert.deepEqual(pngSize('screenshots/hq/'+shot.file),[3840,2160]);assert(read('screenshots/hq/previews/'+shot.file.replace('.png','.jpg')).length>1000);}
assert.equal(hq.stats.quality,'Desktop HQ');assert.equal(hq.stats.shadowSize,4096);assert.deepEqual(hq.stats.surfaceSize,[6144,3072]);
const islands=hq.stats.geometry.find(g=>g.id===901);assert.equal(islands.terrainTriangles,819200);assert(islands.triangles>900000);assert.equal(islands.homes,12);assert(islands.trees>200);
assert(read('globe.js').toString().includes('SSAARenderPass'));assert(!read('globe.js').toString().includes('cv.width=2048'));
assert(read('landmarks.js').toString().includes('archipelago-hq.js?v=4'));assert(html.includes('data-detail-view="harbor"'));
for(const name of ['archipelago-hq.js','vendor/addons/objects/Water.js','vendor/addons/postprocessing/SSAARenderPass.js'])assert(read(name).length>100);
console.log('PASS: unchanged official geography; 20 markers / 28 places; full 6K textures; 3 native 4K/4-sample exports; HQ terrain and reflection resources; browser regression record.');
