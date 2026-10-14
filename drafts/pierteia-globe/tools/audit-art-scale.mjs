import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),read=name=>fs.readFileSync(new URL(name,root),'utf8');
const landmarks=read('landmarks.js'),campus=read('academy-hillside.js'),asset=read('academy-asset.js');
// Evaluate only the local, version-controlled geometry/height constructors below.
// This audit never fetches or executes third-party prompts or downloaded skills.
function declaration(source,name){
 const start=source.indexOf(`function ${name}(`);assert(start>=0,name);
 const begin=source.indexOf('{',start);let depth=1,end=begin+1;
 while(depth&&end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
 assert.equal(depth,0,name);return source.slice(start,end);
}
const scale=Number(asset.match(/g\.scale\.setScalar\(([\d.]+)\)/)?.[1]);assert(scale>0);
const group=new T.Group(),material=new T.MeshBasicMaterial();
const mesh=(g,geo,m,x=0,y=0,z=0)=>{const o=new T.Mesh(geo,material);o.position.set(x,y,z);g.add(o);return o;};
const cyl=(g,r,h,m,x,y,z,n)=>mesh(g,new T.CylinderGeometry(r,r,h,n),m,x,y,z);
const person=new Function('T','leafMats','rnd','cyl','mesh','trim',declaration(landmarks,'person')+';return person;')(T,[material],()=>0,cyl,mesh,material);
person(group,0,0,0);group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group);
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const height=new Function('T','smooth',declaration(campus,'height')+';return height;')(T,smooth);
const viewsExpression=campus.match(/views:(\{.*\}),meta:/)?.[1];assert(viewsExpression);
const views=new Function('return ('+viewsExpression+');')();
const round=n=>Math.round(n*10000)/10000;
const cameras=Object.entries(views).map(([name,v])=>({name,eyeSceneUnits:v.eye,terrainAtEyeSceneUnits:round(height(v.eye[0],v.eye[2])),eyeAboveTerrainMeters:round((v.eye[1]-height(v.eye[0],v.eye[2]))/scale),targetSceneUnits:v.target}));
const result={reviewDate:'2026-10-15',baseline:'v10 / 0f7f1ae',status:'needs-art-direction-rework',
 interpretation:'Relative scale inferred from the metre-authored Blender GLB attachment. Not an official world measurement. Terrain excludes elevated decks/floors.',
 sceneUnitsPerAssetMeter:scale,
 person:{meshHeightMeters:round((bounds.max.y-bounds.min.y)/scale),topAbovePlacementMeters:round(bounds.max.y/scale),bottomAbovePlacementMeters:round(bounds.min.y/scale),proposedReferenceHeightMeters:1.7},
 cameras,
 checks:{finiteMeasurements:cameras.every(c=>Number.isFinite(c.eyeAboveTerrainMeters)),adultScaleCue:Math.abs((bounds.max.y-bounds.min.y)/scale-1.7)<.2,hasGroundLevelInspection:cameras.some(c=>c.eyeAboveTerrainMeters>=1.5&&c.eyeAboveTerrainMeters<=1.8)},
 sourceHashes:Object.fromEntries(['landmarks.js','academy-hillside.js','academy-asset.js'].map(name=>[name,createHash('sha256').update(read(name)).digest('hex')]))};
assert(result.checks.finiteMeasurements);
if(process.argv.includes('--write'))fs.writeFileSync(new URL('research/v10-scale-audit.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--require-art-gates')&&(!result.checks.adultScaleCue||!result.checks.hasGroundLevelInspection))process.exitCode=1;
