import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),three=new URL('vendor/three.module.js',root).href;
function addon(name){return 'data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('vendor/addons/'+name,root),'utf8').replaceAll("from 'three'",`from '${three}'`)).toString('base64');}
const source=fs.readFileSync(new URL('academy-study.js',root),'utf8').replaceAll("from 'three'",`from '${three}'`).replace("from 'three/addons/loaders/RGBELoader.js'",`from '${addon('loaders/RGBELoader.js')}'`).replace("from 'three/addons/geometries/RoundedBoxGeometry.js'",`from '${addon('geometries/RoundedBoxGeometry.js')}'`);
const {scalePerson,courtView}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const g=new T.Group();const person=scalePerson(g,0,0,0);g.updateMatrixWorld(true);const box=new T.Box3().setFromObject(person);
const actualHeight=(box.max.y-box.min.y)/.01;assert(Math.abs(actualHeight-1.70)<1e-5);assert(Math.abs(box.min.y)<1e-8,'feet must touch placement surface');
const court=courtView();assert(Math.abs((court.eye[1]-court.walkableY)/.01-1.65)<1e-8);
assert(court.fov>=39&&court.fov<=50);for(const vec of [court.eye,court.target,court.detail.eye,court.detail.target])assert(vec.every(Number.isFinite));
const campus=fs.readFileSync(new URL('academy-hillside.js',root),'utf8');
const heightSource=campus.slice(campus.indexOf('function height('),campus.indexOf('function makeMaterials('));
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const ground=new Function('T','smooth',heightSource+';return height;')(T,smooth);
for(let row=0;row<9;row++)for(let col=0;col<14;col++)for(const dx of [-.321,.321])for(const dz of [-.316,.316]){
 const v=new T.Vector3(-4.45+col*.66+dx,0,7.36+row*.65+dz).multiplyScalar(.01).applyAxisAngle(new T.Vector3(0,1,0),.52).add(new T.Vector3(-.119,.056,.163));
 assert(ground(v.x,v.z)<.04225-.0003,'terrain must not break through a slab corner');
}
const manifest=JSON.parse(fs.readFileSync(new URL('assets/study/manifest.json',root),'utf8'));
for(const a of manifest.assets){const data=fs.readFileSync(new URL('assets/study/'+a.file,root));assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256,a.file);assert.equal(data.length,a.bytes);assert(a.source&&a.license&&a.modification);}
const {RGBELoader}=await import(addon('loaders/RGBELoader.js'));const hdr=fs.readFileSync(new URL('assets/study/forest_slope_512.hdr',root));const parsed=new RGBELoader().setDataType(T.FloatType).parse(hdr.buffer.slice(hdr.byteOffset,hdr.byteOffset+hdr.byteLength));assert.equal(parsed.width,512);assert.equal(parsed.height,256);assert(parsed.data.every(Number.isFinite));
const report={revision:11,scope:'Academy study only; no claim that other region scale or whole-scene aesthetics are approved',personHeightMeters:Math.round(actualHeight*1e5)/1e5,feetAtSurface:true,pavingClearOfTerrain:true,courtyard: court,assets:manifest.assets.length,hdrSize:[parsed.width,parsed.height],provenanceHashesVerified:true};
if(process.argv.includes('--write'))fs.writeFileSync(new URL('research/v11-study-audit.json',root),JSON.stringify(report,null,2)+'\n');
console.log('PASS: actual 1.70 m geometry, planted feet, 1.65 m court camera, reference maps and finite HDR; visual quality remains a separate review.');
