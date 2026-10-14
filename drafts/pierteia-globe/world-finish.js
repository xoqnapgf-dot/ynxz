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
    const t=await loader.loadAsync(new URL(`assets/${folder}/${name}-${channel}.jpg?v=9`,import.meta.url).href);
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
  material.normalScale?.set(.13,.13);
  material.roughness=kind==='roof'?.90:1;
 }
 material.envMapIntensity=kind==='glass'?.32:kind==='metal'?.40:.38;
 if(kind==='glass'){material.color.set('#354039');material.roughness=.27;material.metalness=0;}
 if(kind==='metal'){material.roughness=.69;material.map=null;material.normalMap=null;}
 if(kind==='roof'){material.map=null;material.normalScale?.set(.10,.10);}
 if(kind==='terrain'){material.map=null;material.normalMap=null;material.roughnessMap=null;material.roughness=1;material.envMapIntensity=.25;}

 const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  prior.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 atlasPosition; varying vec3 atlasNormal; varying vec2 atlasUV;').replace('#include <begin_vertex>','#include <begin_vertex>\natlasPosition=position; atlasNormal=normal; atlasUV=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 atlasPosition; varying vec3 atlasNormal; varying vec2 atlasUV;
   float atlasHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   float atlasNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(atlasHash(i),atlasHash(i+vec3(1,0,0)),f.x),mix(atlasHash(i+vec3(0,1,0)),atlasHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(atlasHash(i+vec3(0,0,1)),atlasHash(i+vec3(1,0,1)),f.x),mix(atlasHash(i+vec3(0,1,1)),atlasHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `).replace('#include <color_fragment>',`#include <color_fragment>
   float fleck=atlasNoise(atlasPosition*1550.);
   float age=atlasNoise(atlasPosition*83.)*.65+atlasNoise(atlasPosition*211.)*.35;
   float upward=abs(normalize(atlasNormal).y);
   float streak=atlasNoise(atlasPosition*vec3(460.,17.,460.));
   diffuseColor.rgb*=.98+.035*age+.006*fleck;
   ${kind==='terrain'?`
   float macro=atlasNoise(atlasPosition*21.)*.7+atlasNoise(atlasPosition*57.)*.3;
   float grit=atlasNoise(atlasPosition*370.);
   diffuseColor.rgb*=.86+.24*macro;
   float vegetation=smoothstep(.0,.025,diffuseColor.g-diffuseColor.r)*smoothstep(.55,.94,upward);
   float cover=smoothstep(.32,.69,atlasNoise(atlasPosition*73.)*.65+atlasNoise(atlasPosition*217.)*.35);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.07,.85,.69),vegetation*(1.-cover)*.36);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.09,1.035,.88),smoothstep(.40,.72,macro)*.32);
   float mineral=pow(.5+.5*sin(atlasPosition.y*530.+age*5.),10.);
   diffuseColor.rgb*=1.-mineral*(1.-upward)*.055;
   `:''}
   ${kind==='glass'?`
   // A restrained dark interior behind each pane; not a luminous blue rectangle.
   float edge=min(min(atlasUV.x,1.-atlasUV.x),min(atlasUV.y,1.-atlasUV.y));
   float room=smoothstep(0.,.23,edge);
   diffuseColor.rgb*=.30+.45*room;
   diffuseColor.rgb+=vec3(.019,.015,.009)*smoothstep(.45,.9,atlasUV.y)*room;
   `:''}
   ${['stone','plaster','roof'].includes(kind)?'diffuseColor.rgb*=1.-pow(streak,4.)*(1.-upward)*.08;':''}
   ${kind==='metal'?'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.64,.85,.79),pow(age,3.)*.28);':''}
  `);
  if(kind==='terrain')shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float microHeight=atlasNoise(atlasPosition*780.)*.000013+atlasNoise(atlasPosition*183.)*.000025;
   vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
   vec3 r1=cross(q1,normal),r2=cross(normal,q0);
   float det=dot(q0,r1);
   normal=normalize(abs(det)*normal-sign(det)*(dFdx(microHeight)*r1+dFdy(microHeight)*r2));
  `);
 };
 material.customProgramCacheKey=()=>priorKey+'/world-finish-9/'+kind;
 material.needsUpdate=true;return material;
}
export function upgradeSharedSurfaces(kit){
 for(const key of ['stone','trim','darkStone','paving','cliffMat'])if(kit[key])finish(kit[key],'stone');
 for(const key of ['wood','bark'])if(kit[key])finish(kit[key],'wood');
 for(const key of ['roof','redRoof'])if(kit[key])finish(kit[key],'roof');
 if(kit.gold)finish(kit.gold,'metal');if(kit.windowMat)finish(kit.windowMat,'glass');if(kit.grassMat)finish(kit.grassMat,'terrain');
}
