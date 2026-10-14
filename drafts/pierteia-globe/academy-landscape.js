import * as T from 'three';
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
const palette={grass:'#657052',soil:'#746753',rock:'#74776c',path:'#aaa08b',litter:'#68604c'};
// Authored material layers, not a scan. Distances here are campus scene units (0.01 scene unit = 1 metre).
export function campusSurface(kind='ground'){
 const m=new T.MeshStandardMaterial({name:'Campus '+kind+' / v12',color:'#ffffff',roughness:.96,envMapIntensity:.8});
 if(kind==='path'){m.transparent=true;m.depthWrite=false;m.polygonOffset=true;m.polygonOffsetFactor=-1;}
 m.onBeforeCompile=shader=>{
  for(const [key,value]of Object.entries(palette))shader.uniforms['land_'+key]={value:new T.Color(value)};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 landPosition;varying vec3 landNormal;varying vec2 landUV;').replace('#include <begin_vertex>','#include <begin_vertex>\nlandPosition=position;landNormal=normal;landUV=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 landPosition;varying vec3 landNormal;varying vec2 landUV;
   uniform vec3 land_grass,land_soil,land_rock,land_path,land_litter;
   float landHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   float landNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(landHash(i),landHash(i+vec3(1,0,0)),f.x),mix(landHash(i+vec3(0,1,0)),landHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(landHash(i+vec3(0,0,1)),landHash(i+vec3(1,0,1)),f.x),mix(landHash(i+vec3(0,1,1)),landHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `).replace('#include <color_fragment>',`#include <color_fragment>
   float landUp=abs(normalize(landNormal).y);
   float patches=landNoise(landPosition*vec3(37.,9.,37.));
   float rockMask=${kind==='rock'?'1.':kind==='path'?'0.':'1.-smoothstep(.48,.83,landUp)'};
   vec3 soilMix=mix(land_soil,land_litter,patches);
   vec3 surface=mix(soilMix,land_grass,smoothstep(.25,.70,patches));
   surface=mix(surface,land_rock,rockMask*.78);
   ${kind==='path'?'surface=land_path;diffuseColor.a*=smoothstep(0.,.18,min(landUV.x,2.-landUV.x));':''}
   float bands=landNoise(vec3(landPosition.x*80.,landPosition.y*650.,landPosition.z*80.));
   float weathering=landNoise(landPosition*155.)*.6+landNoise(landPosition*420.)*.4;
   float fleck=landNoise(landPosition*1300.);
   float landPixel=max(length(dFdx(landPosition)),length(dFdy(landPosition)));
   float landFade=1.-smoothstep(.000025,.00022,landPixel);
   diffuseColor.rgb=surface*(.94+.10*patches)*mix(1.,.91+.14*bands,rockMask);
   diffuseColor.rgb*=.87+.26*weathering;
   diffuseColor.rgb*=1.+(fleck-.5)*.16*landFade;
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float relief=(landNoise(landPosition*vec3(720.,1250.,720.))*.000020*rockMask+landNoise(landPosition*2600.)*.000006)*landFade;
   vec3 landQ0=dFdx(-vViewPosition),landQ1=dFdy(-vViewPosition);
   vec3 landR1=cross(landQ1,normal),landR2=cross(normal,landQ0);
   float landDet=dot(landQ0,landR1);
   vec3 landBump=abs(landDet)*normal-sign(landDet)*(dFdx(relief)*landR1+dFdy(relief)*landR2);
   float landLength=length(landBump);if(landLength>1.e-16)normal=landBump/landLength;
  `);
 };
 m.customProgramCacheKey=()=> 'campus-surface-12/'+kind;return m;
}
export function makeOutcrop(height,x,z,w,d,h,seed=0){
 const p=[],uv=[],index=[],n=14;
 const ring=Array.from({length:n},(_,j)=>{const a=j/n*Math.PI*2,scale=.66+hash(j,seed)*.34;return [x+Math.cos(a)*w*.5*scale,z+Math.sin(a)*d*.5*scale];});
 for(let level=0;level<3;level++)for(let j=0;j<n;j++){
  const [xx,zz]=ring[j],inset=level===2?.91:1;
  const localGround=height(x+(xx-x)*inset,z+(zz-z)*inset);
  const y=level===0?localGround-.004:localGround+h*(.22+hash(j,seed+11)*.24)-(level===1?h*.23:0);p.push(x+(xx-x)*inset,y,z+(zz-z)*inset);uv.push(xx*48,zz*48);
 }
 for(let level=0;level<2;level++)for(let j=0;j<n;j++){const a=level*n+j,b=level*n+(j+1)%n;index.push(a,a+n,b,b,a+n,b+n);}
 for(let j=1;j<n-1;j++)index.push(2*n,2*n+j+1,2*n+j);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);
 const flat=geo.toNonIndexed();geo.dispose();flat.computeVertexNormals();flat.computeBoundingBox();return flat;
}
export function addCampusLandscape(g,k,height,ground){
 const old=ground.material;ground.material=campusSurface();old.dispose();ground.name='Graded soil, meadow and exposed bedrock';
 const rock=campusSurface('rock');let outcrops=0;
 // Embedded ledges along the exposed northern shoulder, not randomly floating boulders.
 for(let row=0;row<4;row++)for(let j=0;j<11;j++){
  if(hash(j,row+17)>.77)continue;
  const x=-.31+j*.061+(hash(j,row)-.5)*.046,z=-.282-row*.027-.021*Math.cos(x*16+row*.5);
  if(height(x,z)<.11)continue;
  k.mesh(g,makeOutcrop(height,x,z,.024+hash(j,2+row)*.046,.009+hash(j,4+row)*.008,.005+hash(j,7+row)*.008,row*17+j),rock);outcrops++;
 }
 // Small planted groups on unused shoulders; the central lawn remains open.
 let shrubs=0;
 for(const [cx,cz]of [[-.26,.11],[.28,.10],[-.28,-.12],[.27,-.17],[-.31,.26]])for(let i=0;i<9;i++){
  const a=i*2.399,r=.008+hash(i,cx)*.016,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
  const y=height(x,z);if(y<.03)continue;k.tree(g,x,z,.14+hash(i,cz)*.075,y);shrubs++;
 }
 return {landscapeRevision:12,exposedRockLedges:outcrops,plantedShrubs:shrubs};
}
