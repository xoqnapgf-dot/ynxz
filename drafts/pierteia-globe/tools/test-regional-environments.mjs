import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),three=new URL('vendor/three.module.js',root).href;
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL(file,root),'utf8').replaceAll("from 'three'",`from '${three}'`)).toString('base64'));
const {REGIONAL_PROFILES:profiles,regionalProfile}=await load('regional-profiles.js');
const {regionalizeSurfaces}=await load('regional-surfaces.js');
const {precipitationFloor,createRegionalWeather,configureRegionalWater,addRegionalHabitat,createRegionalSky}=await load('regional-environment.js');
assert.deepEqual(Object.keys(profiles).sort(),['11','12','9','900','901','902','falota','shiomi'].sort());
assert.equal(new Set(Object.values(profiles).map(p=>p.label)).size,8);
for(const p of Object.values(profiles)){assert(Object.isFrozen(p));assert(Object.isFrozen(p.wind));assert(p.interpretation);assert.equal(p.revision,18);}
assert.throws(()=>regionalProfile('unknown'));assert(profiles['11'].water.wave<profiles.falota.water.wave);assert.equal(profiles.shiomi.precipitation,'rain');assert.equal(profiles['902'].precipitation,'snow');
const source=new T.MeshStandardMaterial({color:'#ba9877',roughness:.84});source.userData.worldFinish='stone';source.onBeforeCompile=shader=>{shader.preserved=true;};source.customProgramCacheKey=()=> 'upstream-finish';
const original=source.color.getHex(),a=new T.Group(),b=new T.Group();
for(const g of [a,b])for(let i=0;i<2;i++)g.add(new T.Mesh(new T.BoxGeometry(),source));
assert.equal(regionalizeSurfaces(a,profiles.shiomi),1);assert.equal(regionalizeSurfaces(b,profiles['902']),1);
assert.equal(a.children[0].material,a.children[1].material);assert.notEqual(a.children[0].material,b.children[0].material);assert.notEqual(a.children[0].material,source);assert.equal(source.color.getHex(),original);assert.equal(source.userData.regionalFinish,undefined);
for(const g of [a,b]){const m=g.children[0].material,s={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>'};m.onBeforeCompile(s);assert(s.preserved);assert(s.vertexShader.includes('USE_INSTANCING'));assert(s.fragmentShader.includes('regionWet'));assert(m.customProgramCacheKey().startsWith('upstream-finish/regional-finish-18/'));}
assert.notEqual(a.children[0].material.customProgramCacheKey(),b.children[0].material.customProgramCacheKey());
const shelters=[{x:0,z:0,w:.04,d:.08,angle:Math.PI/2,top:.08}];
assert.equal(precipitationFloor(.03,0,()=>.01,shelters),.081);assert.equal(precipitationFloor(0,.03,()=>.01,shelters),.011);assert.equal(precipitationFloor(0,0,()=>.12,shelters),.121);
const water=new T.Mesh(new T.PlaneGeometry(),new T.ShaderMaterial({uniforms:{regionDeep:{value:new T.Color()},regionShallow:{value:new T.Color()},regionWave:{value:1},regionFoam:{value:1},regionWind:{value:new T.Vector2()},regionSun:{value:new T.Vector3()},regionLevel:{value:0},regionRain:{value:0}}}));
configureRegionalWater(water,profiles.shiomi);assert.equal(water.position.y,-.008);assert.equal(water.material.uniforms.regionRain.value,1);assert.equal(water.userData.regionalWater.kind,'sea');
const rainy=createRegionalWeather(new T.Group(),{...profiles.shiomi,mist:0},{height:()=>.01},shelters,water);assert.equal(rainy.count,850);assert.equal(rainy.group.children[0].geometry.attributes.position.count,1700);
rainy.update(2);assert.equal(rainy.stats().time,2);rainy.setEnabled(false);rainy.update(4);assert(!rainy.group.visible);assert.equal(rainy.stats().time,2);assert.equal(water.material.uniforms.regionRain.value,0);rainy.setEnabled(true);assert.equal(water.material.uniforms.regionRain.value,1);
configureRegionalWater(water,profiles['11']);assert.equal(water.userData.regionalWater.kind,'lake');assert.equal(water.material.uniforms.regionFoam.value,.08);
for(const p of Object.values(profiles)){
 const group=new T.Group(),height=()=>['reed','coastal'].includes(p.plant)?.012:.025,habitat={height,exclude:(x,z)=>x<0};
 const first=addRegionalHabitat(group,p,habitat),again=new T.Group();addRegionalHabitat(again,p,habitat);assert(first.plants>0,p.key);first.update(2);
 assert.deepEqual(group.children[0].instanceMatrix.array,again.children[0].instanceMatrix.array,'deterministic placement');
 for(const mesh of group.children){assert(mesh.userData.noBake);for(const attr of Object.values(mesh.geometry.attributes))assert(attr.array.every(Number.isFinite));assert(mesh.instanceMatrix.array.every(Number.isFinite));for(let i=0;i<mesh.count;i++)assert(mesh.instanceMatrix.array[i*16+12]>=0,'exclusion zone');}
 const env=new T.Group(),sky=createRegionalSky(env,p);sky.update(3);assert.equal(env.children[0].material.uniforms.time.value,3);assert.equal(env.children[0].material.uniforms.cloudCover.value,p.cloud);
}
console.log('PASS: eight immutable profiles; shared-material isolation and shader-hook chaining; rain roof occlusion; tidal water/ripple switches; deterministic, finite, excluded habitat batches; eight sky profiles. GPU rendering tested separately.');
