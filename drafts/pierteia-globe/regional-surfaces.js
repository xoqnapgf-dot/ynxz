import * as T from 'three';

// Local copies are essential: the builders intentionally share a material kit.
// Copy shader hooks explicitly; Material.clone() does not preserve those hooks.
export function regionalizeSurfaces(group,profile){
 const copies=new Map();
 function local(source){
  if(!source.isMeshStandardMaterial||!source.userData.worldFinish)return source;
  if(copies.has(source))return copies.get(source);
  const material=source.clone(),kind=source.userData.worldFinish,role=source.userData.regionalRole;
  const hook=source.onBeforeCompile,key=source.customProgramCacheKey();
  copies.set(source,material);
  material.userData={...source.userData,regionalFinish:17,region:profile.key};
  if(profile.palette?.[role])material.color.set(profile.palette[role]);
  else if(kind==='stone'&&profile.stone)material.color.lerp(new T.Color(profile.stone),.24);
  else if(kind==='roof'&&profile.roof&&material.color.g>=material.color.r*.9)material.color.lerp(new T.Color(profile.roof),.68);
  if(kind==='terrain'&&!material.vertexColors&&role!=='dark')material.color.set(profile.ground);
  if(role==='steel')material.metalness=profile.key==='11'?.6:.48;
  const wet=['stone','plaster','brick','wood','roof','terrain'].includes(kind)&&role!=='dark'?profile.wetness:0;
  const salt=['stone','plaster','brick','wood'].includes(kind)?profile.salt:0;
  const rust=role==='steel'?profile.rust:0;
  const snow=profile.key==='902'&&['stone','terrain'].includes(kind);
  material.onBeforeCompile=(shader,renderer)=>{
   hook.call(material,shader,renderer);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 regionPosition; varying vec3 regionNormal;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     regionPosition=position;regionNormal=normal;
     #ifdef USE_INSTANCING
      regionPosition=(instanceMatrix*vec4(position,1.)).xyz;
      regionNormal=mat3(instanceMatrix)*normal;
     #endif
    `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 regionPosition;varying vec3 regionNormal;
    float regionHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float regionNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
     return mix(mix(mix(regionHash(i),regionHash(i+vec3(1,0,0)),f.x),mix(regionHash(i+vec3(0,1,0)),regionHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(regionHash(i+vec3(0,0,1)),regionHash(i+vec3(1,0,1)),f.x),mix(regionHash(i+vec3(0,1,1)),regionHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
   `).replace('#include <color_fragment>',`#include <color_fragment>
    float regionUp=clamp(normalize(regionNormal).y,0.,1.);
    float regionPatch=regionNoise(regionPosition*135.);
    float regionWet=${wet.toFixed(3)}*(.38+.62*regionUp)*(.65+.35*regionPatch);
    float regionSalt=${salt.toFixed(3)}*(1.-smoothstep(.012,.060,regionPosition.y))*(1.-regionUp)*smoothstep(.38,.72,regionPatch);
    float regionRust=${rust.toFixed(3)}*smoothstep(.48,.74,regionNoise(regionPosition*vec3(650.,55.,650.)))*(.5+.5*regionUp);
    float regionSnow=${snow?'smoothstep(.12,.25,regionPosition.y)*smoothstep(.50,.88,regionUp)':'0.'};
    diffuseColor.rgb*=1.-regionWet*.28;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.56,.57,.48),regionSalt*.22);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.070,.027),regionRust*.70);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.91,.94),regionSnow*.86);
    ${profile.key==='902'&&kind==='terrain'?'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.86,.92,1.08),.5);':''}
   `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor=mix(roughnessFactor,max(.30,roughnessFactor*.53),regionWet);
    roughnessFactor=mix(roughnessFactor,.93,regionSnow);
    roughnessFactor=mix(roughnessFactor,.91,regionRust);
   `).replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor*=1.-regionRust*.95;');
  };
  material.customProgramCacheKey=()=>key+'/regional-finish-17/'+profile.key+'/'+kind+'/'+(role||'');
  material.needsUpdate=true;
  return material;
 }
 group.traverse(o=>{if(o.material)o.material=Array.isArray(o.material)?o.material.map(local):local(o.material);});
 return copies.size;
}
