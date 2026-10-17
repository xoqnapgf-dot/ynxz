import fs from 'node:fs';import assert from 'node:assert/strict';import * as T from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),three=new URL('vendor/three.module.js',root).href;
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL(name,root),'utf8').replaceAll("from 'three'",`from '${three}'`)).toString('base64'));
const {alignTimber,plankWalk,addRainwater}=await load('academy-craft.js');
for(const dims of [[.08,.001,.01],[.001,.08,.01],[.01,.001,.08]]){const geo=new T.BoxGeometry(...dims);alignTimber(geo,dims);assert.equal(geo.userData.grainAxis,dims.indexOf(.08));assert(geo.attributes.uv.array.every(Number.isFinite));}
const g=new T.Group(),k={mesh:(parent,geo,m,...p)=>{const o=new T.Mesh(geo,m);if(p.length)o.position.set(...p);parent.add(o);return o;},beam:()=>null};
const count=plankWalk(g,k,new T.Vector3(0,.01,0),new T.Vector3(.08,.02,.03),new T.MeshStandardMaterial());assert(count>30);assert.equal(g.children.length,count);
for(const o of g.children){assert(o.geometry.attributes.position.array.every(Number.isFinite));assert(Math.abs(o.quaternion.length()-1)<1e-8);}
const building=new T.Group();building.position.set(0,.08,0);addRainwater(building,k,{w:.08,d:.05,h:.05,ground:()=>.06});assert.equal(building.children.filter(o=>o.name.startsWith('Downpipe')).length,2);assert.equal(building.children.filter(o=>o.name.startsWith('Open half-round')).length,2);
const {addMeadow}=await load('academy-landscape.js');const meadow=new T.Group();const meta=addMeadow(meadow,()=>.08);assert(meta.meadowTufts>2000);assert(meta.meadowTufts<15000);assert(meadow.children[0].isInstancedMesh);assert(meadow.children[0].userData.noBake);const matrix=new T.Matrix4();
for(let i=0;i<meadow.children[0].count;i++){meadow.children[0].getMatrixAt(i,matrix);const p=new T.Vector3().setFromMatrixPosition(matrix);assert(Math.hypot(p.x,p.z)>=.277-1e-7);assert(Math.hypot(p.x+.065,p.z-.257)>=.11-1e-7);assert(Math.abs(p.y-.07988)<1e-6);}
console.log('PASS: v14 oriented timber UVs, separate sloped boards, open gutters / downpipes and instanced meadow exclusions.');
