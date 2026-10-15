import * as T from 'three';
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
const palette={grass:'#66734e',soil:'#70634d',rock:'#747771',path:'#aaa08b',litter:'#4e523b'};
// Authored material layers, not a scan. Distances here are campus scene units (0.01 scene unit = 1 metre).
export function campusSurface(kind='ground'){
 const m=new T.MeshStandardMaterial({name:'Campus '+kind+' / v14',color:'#ffffff',roughness:.96,envMapIntensity:.8});
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
   float rockMask=${kind==='rock'?'1.':kind==='path'?'0.':'1.-smoothstep(.42,.75,landUp)'};
   vec3 soilMix=mix(land_soil,land_litter,patches);
   vec3 surface=mix(soilMix,land_grass,smoothstep(.25,.70,patches));
   surface=mix(surface,land_rock,rockMask*${kind==='rock'?'1.':'.85'});
   ${kind==='path'?'surface=land_path;diffuseColor.a*=smoothstep(0.,.18,min(landUV.x,2.-landUV.x));':''}
   float cracks=pow(1.-abs(landNoise(landPosition*vec3(280.,115.,280.))*2.-1.),18.);
   float bands=landNoise(vec3(landPosition.x*80.,landPosition.y*650.,landPosition.z*80.));
   float weathering=landNoise(landPosition*155.)*.6+landNoise(landPosition*420.)*.4;
   float fleck=landNoise(landPosition*1300.);
   float landPixel=max(length(dFdx(landPosition)),length(dFdy(landPosition)));
   float landFade=1.-smoothstep(.000025,.00022,landPixel);
   diffuseColor.rgb=surface*(.94+.10*patches)*mix(1.,.91+.14*bands,rockMask);
   diffuseColor.rgb*=.86+.27*weathering;
   diffuseColor.rgb*=1.-cracks*.18*rockMask;
   diffuseColor.rgb*=1.+(fleck-.5)*.16*landFade;
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float relief=landNoise(landPosition*vec3(290.,470.,290.))*.00009*(.3+.7*rockMask)+(landNoise(landPosition*vec3(720.,1250.,720.))*.000020*rockMask+landNoise(landPosition*2600.)*.000006)*landFade;
   vec3 landQ0=dFdx(-vViewPosition),landQ1=dFdy(-vViewPosition);
   vec3 landR1=cross(landQ1,normal),landR2=cross(normal,landQ0);
   float landDet=dot(landQ0,landR1);
   vec3 landBump=abs(landDet)*normal-sign(landDet)*(dFdx(relief)*landR1+dFdy(relief)*landR2);
   float landLength=length(landBump);if(landLength>1.e-16)normal=landBump/landLength;
  `);
 };
 m.customProgramCacheKey=()=> 'campus-surface-14/'+kind;return m;
}
export function makeOutcrop(height,x,z,w,d,h,seed=0){
 const geo=new T.IcosahedronGeometry(1,2),p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){
  const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),irregular=.88+hash(px*23+seed,pz*31+py)*.18;
  const xx=x+px*w*.5*irregular,zz=z+pz*d*.5*irregular;
  p.setXYZ(i,xx,height(xx,zz)+(py+.06)*h*.65,zz);uv.setXY(i,xx*48,zz*48);
 }
 geo.computeVertexNormals();geo.computeBoundingBox();return geo;
}

export function addCampusLandscape(g,k,height,ground){
 const old=ground.material;ground.material=campusSurface();old.dispose();ground.name='Graded soil, meadow and exposed bedrock';
 const rock=campusSurface('rock');let outcrops=0;
 // Embedded ledges along the exposed northern shoulder, not randomly floating boulders.
 for(let row=0;row<4;row++)for(let j=0;j<11;j++){
  if(hash(j,row+17)>.77)continue;
  const x=-.31+j*.061+(hash(j,row)-.5)*.046,z=-.282-row*.027-.021*Math.cos(x*16+row*.5);
  if(height(x,z)<.11)continue;
  k.mesh(g,makeOutcrop(height,x,z,.015+hash(j,2+row)*.031,.009+hash(j,4+row)*.012,.005+hash(j,7+row)*.010,row*17+j),rock);outcrops++;
 }
 // Small planted groups on unused shoulders; the central lawn remains open.
 let shrubs=0;
 for(const [cx,cz]of [[-.26,.11],[.28,.10],[-.28,-.12],[.27,-.17],[-.31,.26]])for(let i=0;i<9;i++){
  const a=i*2.399,r=.008+hash(i,cx)*.016,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
  const y=height(x,z);if(y<.03)continue;k.tree(g,x,z,.14+hash(i,cz)*.075,y);shrubs++;
 }
 const meadow=addMeadow(g,height);
 return {...meadow,landscapeRevision:14,exposedRockLedges:outcrops,plantedShrubs:shrubs};
}

// Bunched groundcover at a lower scale than the trees; bare paths and graded court are excluded.
export function addMeadow(g,height){
 const p=[],uv=[],colors=[],indices=[];
 for(let blade=0;blade<11;blade++){
  const angle=blade*2.399,ox=(hash(blade,91)-.5)*.0016,oz=(hash(blade,19)-.5)*.0016,h=.0012+hash(blade,33)*.0021,w=.000065+hash(blade,7)*.00005,base=p.length/3;
  const color=new T.Color(blade%4===0?'#858257':'#657447');
  for(let row=0;row<4;row++)for(const side of [-1,1]){
   const t=row/3,bend=t*t*.0013,ww=w*(1-t*.94)*side;
   p.push(ox+Math.cos(angle)*bend+Math.sin(angle)*ww,t*h,oz+Math.sin(angle)*bend-Math.cos(angle)*ww);uv.push((side+1)/2,t);
   colors.push(color.r*(.65+t*.35),color.g*(.65+t*.35),color.b*(.65+t*.35));
  }
  for(let row=0;row<3;row++){const a=base+row*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(p.length),3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
 const placements=[];
 for(let i=0;i<26000;i++){
  const x=(hash(i,73)-.5)*1.10,z=(hash(i,109)-.5)*1.03,r=Math.hypot(x,z),y=height(x,z);
  if(r<.277||r>.535||y<.027||Math.hypot(x+.065,z-.257)<.11||Math.abs(x-.4)<.05&&Math.abs(z-.17)<.095)continue;
  const slope=Math.hypot(height(x+.001,z)-y,height(x,z+.001)-y)/.001;
  const patch=.5+.24*Math.sin(x*98+Math.sin(z*73))+.26*Math.sin(z*81-x*33);
  if(slope>1.15||hash(i,113)>patch*.88)continue;
  placements.push([x,y-.00012,z,.65+hash(i,12)*.8,hash(i,58)*Math.PI*2]);
 }
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.94,side:T.DoubleSide,envMapIntensity:.65});material.forceSinglePass=true;
 const mesh=new T.InstancedMesh(geo,material,placements.length),dummy=new T.Object3D();
 placements.forEach(([x,y,z,s,angle],i)=>{dummy.position.set(x,y,z);dummy.scale.setScalar(s);dummy.rotation.y=angle;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
 mesh.instanceMatrix.needsUpdate=true;mesh.userData.noBake=true;mesh.name='Grouped meadow tufts / v14';mesh.castShadow=false;mesh.receiveShadow=true;g.add(mesh);
 return {meadowTufts:placements.length,meadowRevision:14};
}
