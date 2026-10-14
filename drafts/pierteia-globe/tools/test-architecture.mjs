import assert from 'node:assert/strict';
import fs from 'node:fs';
// Use the shipped Three version; no npm dependency or browser is required here.
const threeURL=new URL('../vendor/three.module.js',import.meta.url).href;
const T=await import(threeURL);
const source=fs.readFileSync(new URL('../architecture.js',import.meta.url),'utf8').replace("from 'three'",`from '${threeURL}'`);
const {wallWithOpenings,bendWall}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const opening={x:0,y:.018,w:.012,h:.016};
const spec={width:.04,height:.04,openings:[opening]};
const mesh=new T.Mesh(wallWithOpenings(spec),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
function hit(object,origin,direction){return new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction).normalize()).intersectObject(object).length;}
assert.equal(hit(mesh,[0,.018,.01],[0,0,-1]),0,'window must be a through-hole');
assert(hit(mesh,[.017,.018,.01],[0,0,-1])>0,'pier must remain solid');
assert(hit(mesh,[0,.034,.01],[0,0,-1])>0,'lintel must remain solid');
assert(hit(mesh,[0,.005,.01],[0,0,-1])>0,'sill must remain solid');
assert(hit(mesh,[0,.018,-.0009],[1,0,0])>0,'opening must have a thickness/reveal');
for(const facing of [-1,1]){
 const geo=bendWall(wallWithOpenings(spec),.20,.7,facing),object=new T.Mesh(geo,mesh.material);object.updateMatrixWorld();
 const radial=new T.Vector3(Math.sin(.7),0,Math.cos(.7)),origin=radial.clone().multiplyScalar(.20+facing*.01);origin.y=.018;
 assert.equal(hit(object,origin.toArray(),radial.clone().multiplyScalar(-facing).toArray()),0);
 origin.y=.034;assert(hit(object,origin.toArray(),radial.clone().multiplyScalar(-facing).toArray())>0);
 for(const v of geo.attributes.position.array)assert(Number.isFinite(v));
 assert.equal(geo.userData.openingCount,1);
}
assert.throws(()=>wallWithOpenings({...spec,openings:[{...opening,x:.019}]}),/outside/);
assert.throws(()=>wallWithOpenings({...spec,openings:[opening,opening]}),/Overlapping/);
assert.throws(()=>wallWithOpenings({...spec,width:0}),/dimensions/);
assert.throws(()=>wallWithOpenings({...spec,width:Infinity}),/dimensions/);
assert.throws(()=>wallWithOpenings({...spec,openings:[{...opening,x:NaN}]}),/outside/);
console.log('PASS: flat and curved wall openings, reveals, piers, lintels, finite vertices, invalid-layout guards.');
