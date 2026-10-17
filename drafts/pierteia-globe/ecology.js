import * as T from 'three';
import { finish } from './world-finish.js?v=9';
const hash=(x,z)=>{const f=Math.sin(x*127.1+z*311.7)*43758.5453;return f-Math.floor(f);};
const wind={value:0};
export function updateEcology(t){wind.value=t;}
function grassGeometry(){
 const p=[],c=[],uv=[],idx=[];
 for(let blade=0;blade<5;blade++){
  const angle=blade*2.399,h=.0015+hash(blade,9)*.0017,w=.00022,offset=blade*.00018;
  for(let i=0;i<4;i++)for(const side of [-1,1]){
   const t=i/3,bend=t*t*.0012,width=w*(1-t*.92)*side;
   p.push(Math.cos(angle)*bend+Math.sin(angle)*width+offset,t*h,Math.sin(angle)*bend-Math.cos(angle)*width);
   c.push(.072+t*.024,.115+t*.030,.032+t*.015);uv.push(side<0?0:1,t);
  }
  for(let i=0;i<3;i++){const a=blade*8+i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function scatterEcology(g,{height,bounds=[-.6,.6,-.6,.6],count=1400,exclude=()=>false,maxGrassHeight=.20,rockMin=.01,minHeight=.009,seed=1}){
 const grass=[],rocks=[];
 for(let i=0;i<count*4;i++){
  const x=T.MathUtils.lerp(bounds[0],bounds[1],hash(i,seed)),z=T.MathUtils.lerp(bounds[2],bounds[3],hash(i,seed+17)),y=height(x,z);
  if(y<minHeight||exclude(x,z))continue;
  const slope=Math.hypot(height(x+.001,z)-y,height(x,z+.001)-y)/.001;
  if(slope<.8&&y<maxGrassHeight&&grass.length<count)grass.push({x,y,z,s:.6+hash(i,23)*1.1,a:hash(i,51)*Math.PI*2});
  if(y>rockMin&&y<.14&&slope>.55&&slope<2.2&&rocks.length<Math.ceil(count*.05))rocks.push({x,y,z,s:.55+hash(i,31)*1.5,a:hash(i,53)*Math.PI*2});
 }
 const dummy=new T.Object3D();
 const gm=new T.MeshStandardMaterial({vertexColors:true,roughness:.94,side:T.DoubleSide,envMapIntensity:.35});
 gm.onBeforeCompile=s=>{s.uniforms.ecologyTime=wind;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float ecologyTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
 float sway=sin(ecologyTime*.85+instanceMatrix[3].x*27.+instanceMatrix[3].z*18.);
 transformed.x+=sway*.00035*pow(clamp(position.y/.005,0.,1.),2.);`);};
 gm.customProgramCacheKey=()=> 'ecology-grass-8';
 if(grass.length){const mesh=new T.InstancedMesh(grassGeometry(),gm,grass.length);mesh.userData.noBake=true;mesh.castShadow=false;mesh.receiveShadow=true;for(let i=0;i<grass.length;i++){const a=grass[i];dummy.position.set(a.x,a.y+.00015,a.z);dummy.rotation.set(0,a.a,0);dummy.scale.setScalar(a.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;g.add(mesh);}
 if(rocks.length){const geo=new T.IcosahedronGeometry(.0016,2),m=finish(new T.MeshStandardMaterial({color:'#818273',roughness:.96}),'terrain');const mesh=new T.InstancedMesh(geo,m,rocks.length);mesh.userData.noBake=true;mesh.castShadow=mesh.receiveShadow=true;for(let i=0;i<rocks.length;i++){const a=rocks[i];dummy.position.set(a.x,a.y,a.z);dummy.rotation.set(.2,a.a,.1);dummy.scale.set(a.s*1.3,a.s*.65,a.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;g.add(mesh);}
 return {grassClumps:grass.length,talusRocks:rocks.length};
}
