import * as T from 'three';
// Shared PBR finish library. Data maps stay linear; base colour is sRGB.
const maps={},jobs=new Map();
export async function loadWorldSurfaces(progress=()=>{}){
 if(jobs.has('all'))return jobs.get('all');
 const promise=(async()=>{
  const loader=new T.TextureLoader();let done=0;
  await Promise.all(['limewash','limestone','oak','clay'].map(async name=>{
   const values=await Promise.all(['color','normal','rough'].map(async channel=>{
    const folder=name==='oak'?'world':'atelier';
    const t=await loader.loadAsync(new URL(`assets/${folder}/${name}-${channel}.jpg?v=8`,import.meta.url).href);
    t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=16;
    if(channel==='color')t.colorSpace=T.SRGBColorSpace;
    progress(++done/12);return t;
   }));maps[name]={map:values[0],normalMap:values[1],roughnessMap:values[2]};
  }));
 })().catch(e=>{jobs.delete('all');throw e;});jobs.set('all',promise);return promise;
}
export function finish(material,kind='stone'){
 if(material.userData.worldFinish)return material;
 material.userData.worldFinish=kind;
 const name=({stone:'limestone',plaster:'limewash',wood:'oak',roof:'clay'})[kind];
 if(name&&maps[name]){
  // Neutralize albedo colour but preserve each region's tint and architectural identity.
  if(kind==='wood'||kind==='stone'||kind==='plaster'){
   material.map=maps[name].map;
   material.color?.lerp(new T.Color('#e4dfcf'),kind==='wood'?.28:.12);
  }
  material.normalMap=maps[name].normalMap;material.roughnessMap=maps[name].roughnessMap;
  material.normalScale?.set(.28,.28);
  material.roughness=kind==='roof'?.90:1;
 }
 material.envMapIntensity=kind==='glass'?.8:kind==='metal'?.75:.48;
 if(kind==='glass'){material.roughness=.16;material.metalness=.18;}
 if(kind==='metal')material.roughness=.48;
 const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  prior.call(material,shader);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 atlasPosition; varying vec3 atlasNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\natlasPosition=position; atlasNormal=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 atlasPosition; varying vec3 atlasNormal;
   float atlasHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   float atlasNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(atlasHash(i),atlasHash(i+vec3(1,0,0)),f.x),mix(atlasHash(i+vec3(0,1,0)),atlasHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(atlasHash(i+vec3(0,0,1)),atlasHash(i+vec3(1,0,1)),f.x),mix(atlasHash(i+vec3(0,1,1)),atlasHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `).replace('#include <color_fragment>',`#include <color_fragment>
   float fleck=atlasNoise(atlasPosition*1550.);
   float age=atlasNoise(atlasPosition*83.)*.65+atlasNoise(atlasPosition*211.)*.35;
   float upward=abs(normalize(atlasNormal).y);
   float streak=atlasNoise(atlasPosition*vec3(460.,17.,460.));
   diffuseColor.rgb*=.94+.085*age+.025*fleck;
   ${kind==='terrain'?`float mineral=pow(.5+.5*sin(atlasPosition.y*900.+age*6.),12.);diffuseColor.rgb*=1.-mineral*(1.-upward)*.10;`:''}
   ${['stone','plaster','roof'].includes(kind)?'diffuseColor.rgb*=1.-pow(streak,4.)*(1.-upward)*.08;':''}
   ${kind==='metal'?'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.64,.85,.79),pow(age,3.)*.28);':''}
  `);
 };
 material.customProgramCacheKey=()=>priorKey+'/world-finish-8/'+kind;
 material.needsUpdate=true;return material;
}
export function upgradeSharedSurfaces(kit){
 for(const key of ['stone','trim','darkStone','paving','cliffMat'])if(kit[key])finish(kit[key],'stone');
 for(const key of ['wood','bark'])if(kit[key])finish(kit[key],'wood');
 for(const key of ['roof','redRoof'])if(kit[key])finish(kit[key],'roof');
 if(kit.gold)finish(kit.gold,'metal');if(kit.windowMat)finish(kit.windowMat,'glass');if(kit.grassMat)finish(kit.grassMat,'terrain');
}
