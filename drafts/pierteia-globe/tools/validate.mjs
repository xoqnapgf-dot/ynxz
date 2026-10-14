import assert from 'node:assert/strict';
import fs from 'node:fs';
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
assert.equal(provenance.revision,2);assert.equal(provenance.borders,1732);assert.equal(provenance.rivers,91);
const pngSize=name=>{const b=read(name);assert.equal(b.subarray(1,4).toString(),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)];};
assert.deepEqual(pngSize('assets/elevation.png'),provenance.textureSize);
assert.deepEqual(pngSize('assets/land-mask.png'),provenance.textureSize);
assert.deepEqual(pngSize('assets/clouds.png'),[4096,2048]);
for(const name of ['01-world-overview','02-anarchist-academy','03-changling-rift','04-tianshen-peak','05-wanzhi-city']){
 assert.deepEqual(pngSize(`screenshots/${name}.png`),[2160,1350]);assert(read(`screenshots/previews/${name}.jpg`).length>1000);
}
for(const name of ['06-mobile-overview','07-mobile-academy'])assert.deepEqual(pngSize(`screenshots/${name}.png`),[390,844]);
const html=read('index.html').toString();assert(html.includes('globe.js?v=2'));assert(html.includes('globe.css?v=2'));
assert(read('globe.js').toString().includes('landmarks.js?v=2'));
for(const name of ['assets/surface.jpg','assets/surface-normal.jpg','assets/roughness.jpg','assets/atlas-font.woff2','vendor/THREE-LICENSE.txt','vendor/FONT-LICENSE.txt','vendor/addons/BufferGeometryUtils.js'])assert(read(name).length>100);
const docs=read('README.md').toString();for(const match of docs.matchAll(/\]\((screenshots\/[^)]+)\)/g))assert(fs.existsSync(path.join(root,match[1])),match[1]);
console.log('PASS: 20 markers / 28 places; geography provenance; 6K maps; 7 actual-render screenshots; 5 preview JPEGs; v2 cache references and licenses.');
