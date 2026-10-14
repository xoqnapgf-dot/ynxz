import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),three=new URL('vendor/three.module.js',root).href;
const module=async path=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL(path,root),'utf8').replaceAll("from 'three'",`from '${three}'`)).toString('base64'));
const {plantTree,batchVegetation}=await module('vegetation.js');
const trees=new T.Group();for(let i=0;i<48;i++)plantTree(trees,i*.025,i*.017,.7+i*.025,0,i%3===0);
const meta=batchVegetation(trees);assert.equal(meta.botanicalTrees,48);assert(meta.treePrototypes<=8);assert.equal(meta.vegetationRevision,12);
for(const o of trees.children){assert(o.isInstancedMesh);assert(o.userData.noBake);assert(o.geometry.attributes.position.array.every(Number.isFinite));assert(o.geometry.attributes.normal.array.every(Number.isFinite));o.geometry.computeBoundingBox();assert(o.geometry.boundingBox.max.y<.06);}
const {makeOutcrop,campusSurface}=await module('academy-landscape.js');
const ground=(x,z)=>.1+x*.3-z*2;
const out=makeOutcrop(ground,0,0,.05,.04,.01,7);assert(out.attributes.position.array.every(Number.isFinite));assert(out.attributes.normal.array.every(Number.isFinite));
const rock=new T.Mesh(out,new T.MeshBasicMaterial());rock.updateMatrixWorld();
const ray=new T.Raycaster(new T.Vector3(0,.3,0),new T.Vector3(0,-1,0));assert(ray.intersectObject(rock).length>0,'top winding must face outward');
// Downhill sides must have an exterior face and extend into the ground, not float.
const frontRay=new T.Raycaster(new T.Vector3(0,.091,.12),new T.Vector3(0,0,-1));assert(frontRay.intersectObject(rock).length>0,'side winding must face outward');
let embedded=0;const p=out.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<ground(p.getX(i),p.getZ(i)))embedded++;assert(embedded>0);
assert(campusSurface('path').transparent);assert(!campusSurface('rock').transparent);
const {tiledRoof,TILE_PROFILE}=await module('roof-detail.js');const roof=new T.Group();tiledRoof(roof,{w:.08,d:.05,rise:.015,material:new T.MeshStandardMaterial()});assert.equal(TILE_PROFILE.edgeThicknessMeters,.01);assert.equal(TILE_PROFILE.widthMeters,.24);assert.equal(roof.children.length,1);
const geometry=roof.children[0].geometry;assert(geometry.attributes.position.array.every(Number.isFinite));assert(geometry.attributes.normal.array.every(Number.isFinite));assert(geometry.userData.tileRows>=13);assert(geometry.userData.tileColumns>=33);
console.log('PASS: v12 tree instancing/finite geometry, embedded outward-facing outcrops and 1 cm roof edges. Visual quality is reviewed separately.');
