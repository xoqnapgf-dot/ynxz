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
const html=read('index.html').toString();assert(html.includes('globe.js?v=3'));assert(html.includes('globe.css?v=2'));
assert(read('globe.js').toString().includes('landmarks.js?v=2'));
for(const name of ['assets/surface.jpg','assets/surface-normal.jpg','assets/roughness.jpg','assets/atlas-font.woff2','vendor/THREE-LICENSE.txt','vendor/FONT-LICENSE.txt','vendor/addons/BufferGeometryUtils.js'])assert(read(name).length>100);
const docs=read('README.md').toString();for(const match of docs.matchAll(/\]\((screenshots\/[^)]+)\)/g))assert(fs.existsSync(path.join(root,match[1])),match[1]);
assert(read('globe.js').toString().includes('planet-materials.js?v=3'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const preserved={
 'landmarks.js':'f844e5d56646f833aec22367fc957848aff1b452af5e9e62e7f4f5d963da5496',
 'assets/places.json':'15808ba2d908b64954062182e95f00fea08a580b7268db667b6562a7334a8a67',
 'assets/lines.json':'ec516ceb7bdec27105fa136a82fe37965547e78659ffc53a4d5c1ab203965937',
 'assets/land-mask.png':'9bafc1af7f096559c29dd8a25df9704d82e92f5e00dc2d034d7601663678a758'
};
for(const [name,expected]of Object.entries(preserved))assert.equal(hash(read(name)),expected,'v2 preservation: '+name);
assert.equal(hash(fs.readFileSync(path.resolve(root,'../..',provenance.source))),provenance.sourceSha256);
const weather=JSON.parse(read('assets/weather-provenance.json'));assert.equal(weather.revision,3);assert(weather.coverageAbove10Percent>.05&&weather.coverageAbove10Percent<.45);
const verification=JSON.parse(read('tools/verification-v3.json'));assert.deepEqual(verification.desktop.errors,[]);assert.deepEqual(verification.mobile.errors,[]);assert.equal(verification.mobile.result.documentWidth,390);
console.log('PASS: 20 markers / 28 places; geography provenance; 6K maps; 10 actual-render screenshots; 8 preview JPEGs; v3 shaders; v2 landmark/geography SHA-256 preservation; desktop/mobile records.');
