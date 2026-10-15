import * as T from 'three';
const fract=x=>x-Math.floor(x);
const hash=(i,s)=>fract(Math.sin(i*127.1+s*311.7)*43758.5453);

export function createRegionalSky(env,p){
 const time={value:0};
 const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time,zenith:{value:new T.Color(p.zenith)},horizon:{value:new T.Color(p.horizon)},cloudCover:{value:p.cloud},wind:{value:new T.Vector2(...p.wind).normalize().multiplyScalar(p.windSpeed)}},
  vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`
   varying vec3 direction;uniform vec3 zenith,horizon;uniform float cloudCover,time;uniform vec2 wind;
   float nh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float nn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(nh(i),nh(i+vec2(1,0)),f.x),mix(nh(i+vec2(0,1)),nh(i+vec2(1,1)),f.x),f.y);}
   float fb(vec2 p){return nn(p)*.55+nn(p*2.03+8.)*.28+nn(p*4.07+19.)*.17;}
   void main(){
    vec3 ray=normalize(direction);float h=max(0.,ray.y);
    vec3 color=mix(horizon,zenith,pow(h,.42));
    vec2 c=ray.xz/(.20+max(.03,ray.y))*2.6-wind*time*.009;
    float field=fb(c),shape=smoothstep(.72-cloudCover*.46,.88-cloudCover*.37,field);
    float veil=shape*smoothstep(.005,.11,h)*(.45+cloudCover*.35);
    vec3 cloud=mix(horizon*.82,vec3(.86,.88,.85),smoothstep(.3,.7,field));
    color=mix(color,cloud,veil);
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 const sky=new T.Mesh(new T.SphereGeometry(15,40,24),material);sky.name='regional-sky';sky.renderOrder=-10;sky.frustumCulled=false;env.add(sky);
 return {update:t=>time.value=t};
}

export function configureRegionalWater(water,p,light){
 if(!water)return;
 const u=water.material.uniforms;if(!u.regionWave)throw Error('Regional water shader contract is missing');
 const w=p.water;u.regionDeep.value.set(w.deep);u.regionShallow.value.set(w.shallow);u.regionWave.value=w.wave;u.regionFoam.value=w.foam;
 u.regionWind.value.set(...p.wind).normalize();u.regionRain.value=p.precipitation==='rain'?1:0;u.regionLevel.value=p.level;water.position.y=p.level;
 const l=light||[-1.7,2.4,1.3];u.regionSun.value.set(l[0],-l[2],l[1]).normalize();
 water.userData.regionalWater={...w,level:p.level,kind:p.key==='11'?'lake':'sea'};
}

// Conservative roof volumes prevent rain falling through the town's shops.
// These are visual occlusion proxies, not a collision/meteorology simulation.
export function precipitationFloor(x,z,height,shelters=[]){
 let y=height(x,z);
 for(const s of shelters){const dx=x-s.x,dz=z-s.z,c=Math.cos(s.angle),a=Math.sin(s.angle),xx=dx*c-dz*a,zz=dx*a+dz*c;
  if(Math.abs(xx)<=s.w/2&&Math.abs(zz)<=s.d/2)y=Math.max(y,s.top);
 }
 return y+.001;
}
let mistMap;
function fogMap(){
 if(mistMap)return mistMap;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),image=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const u=(x-63.5)/63.5,v=(y-63.5)/63.5,r=Math.hypot(u,v),edge=Math.max(0,1-r*r),n=.85+.15*Math.sin(x*.13+Math.sin(y*.1)*2.);
  const i=(y*128+x)*4;image.data[i]=image.data[i+1]=image.data[i+2]=255;image.data[i+3]=Math.round(255*Math.pow(edge,2.6)*n);
 }ctx.putImageData(image,0,0);mistMap=new T.CanvasTexture(c);return mistMap;
}
export function createRegionalWeather(env,p,habitat={},shelters=[],water=null){
 const group=new T.Group();group.name='regional-weather';group.userData.noBake=true;env.add(group);
 const time={value:0},height=habitat.height||(()=>.005),snow=p.precipitation==='snow',rain=p.precipitation==='rain',count=rain?850:snow?540:0;
 const seeds=[],positions=[],floors=[],ends=[];
 for(let i=0;i<count;i++){
  const x=(hash(i,27)-.5)*1.15,z=(hash(i,39)-.5)*1.15,base=precipitationFloor(x,z,height,shelters),phase=hash(i,51);
  for(let j=0;j<(rain?2:1);j++){positions.push(x,0,z);seeds.push(phase);floors.push(base);ends.push(j);}
 }
 if(count){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('phase',new T.Float32BufferAttribute(seeds,1));geo.setAttribute('floorHeight',new T.Float32BufferAttribute(floors,1));geo.setAttribute('endpoint',new T.Float32BufferAttribute(ends,1));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),time,wind:{value:new T.Vector2(...p.wind).normalize()}},
   vertexShader:`
    uniform float time;uniform vec2 wind;attribute float phase,floorHeight,endpoint;varying float fade;
    #include <common>
    #include <fog_pars_vertex>
    void main(){
     float a=fract(phase-time*${rain?'.65':'.08'}),altitude=a*.42;
     float dy=max(0.,altitude-endpoint*.005);
     vec3 pos=vec3(position.x+wind.x*dy*.10,floorHeight+dy,position.z+wind.y*dy*.10);
     ${snow?'pos.x+=sin(time*.7+phase*50.)*.002;':''}
     vec4 mvPosition=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mvPosition;
     gl_PointSize=clamp(1.0+1.0/max(.4,-mvPosition.z),1.1,3.2);
     fade=smoothstep(0.,.07,a)*(1.-smoothstep(.78,1.,a));
     #include <fog_vertex>
    }`,
   fragmentShader:`varying float fade;
    #include <common>
    #include <fog_pars_fragment>
    void main(){
     float alpha=fade*${rain?'.15':'.65'};
     ${snow?'float r=length(gl_PointCoord-.5);alpha*=1.-smoothstep(.22,.5,r);if(r>.5)discard;':''}
     gl_FragColor=vec4(.74,.84,.87,alpha);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
     #include <fog_fragment>
    }`
  });
  const drops=rain?new T.LineSegments(geo,material):new T.Points(geo,material);drops.name=p.precipitation;drops.frustumCulled=false;group.add(drops);
 }
 const veils=[];
 for(let i=0;i<p.mist;i++){
  // Background pockets only: leave the central architecture and paths readable.
  const x=(hash(i,78)-.5)*.95,z=-.26-hash(i,83)*.25,y=Math.max(p.level+.014,height(x,z)+.012);
  const sprite=new T.Sprite(new T.SpriteMaterial({map:fogMap(),color:p.horizon,transparent:true,opacity:p.key==='901'?.15:.065,depthWrite:false}));
  sprite.position.set(x,y,z);sprite.scale.set(.20+hash(i,8)*.19,.016+hash(i,4)*.009,1);sprite.userData.origin=[x,y,z];group.add(sprite);veils.push(sprite);
 }
 return {group,count,shelters:shelters.length,enabled:true,
  setEnabled(enabled){this.enabled=!!enabled;group.visible=this.enabled;if(water)water.material.uniforms.regionRain.value=this.enabled&&rain?1:0;},
  update(t){if(!this.enabled)return;time.value=t;veils.forEach((s,i)=>{s.position.x=s.userData.origin[0]+Math.sin(t*.08*p.windSpeed+i)*.015*p.wind[0];s.material.opacity=(p.key==='901'?.15:.065)*(.82+Math.sin(t*.11+i)*.18);});},
  stats(){return {kind:p.precipitation,count,enabled:this.enabled,mist:veils.length,roofShelters:shelters.length,time:time.value};}
 };
}

function herbGeometry(kind){
 const positions=[],colors=[],uv=[],indices=[];
 const fern=kind==='fern',reed=kind==='reed',alpine=kind==='alpine';
 const blades=fern?7:reed?5:8;
 for(let b=0;b<blades;b++){
  const a=b*2.399,h=(reed?.012:fern?.006:alpine?.0026:.0048)*(.6+hash(b,3)*.7),w=fern?.0011:reed?.00021:.00032,base=positions.length/3;
  for(let j=0;j<=5;j++){
   const t=j/5,bend=fern?t*t*h*.85:t*t*h*.28,width=w*(fern?Math.sin(t*Math.PI)*(.65+.35*(j%2)):1-t*.93);
   for(const sign of [-1,1]){positions.push(Math.cos(a)*bend+Math.sin(a)*width*sign,t*h,Math.sin(a)*bend-Math.cos(a)*width*sign);colors.push(.50+t*.5,.55+t*.45,.48+t*.40);uv.push(sign<0?0:1,t);}
   if(j<5){const n=base+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  if(reed){const base=positions.length/3;for(const [u,v]of [[-.00045,h*.78],[.00045,h*.78],[0,h*1.18]]){positions.push(Math.sin(a)*u+Math.cos(a)*h*.28,v,-Math.cos(a)*u+Math.sin(a)*h*.28);colors.push(.35,.30,.20);uv.push(.5,1);}indices.push(base,base+1,base+2);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
export function addRegionalHabitat(group,p,habitat={}){
 const height=habitat.height||(()=>.005),exclude=habitat.exclude||(()=>false),bounds=habitat.bounds||[-.65,.65,-.65,.65];
 const time={value:0},samples=[],rocks=[],coast=['reed','coastal'].includes(p.plant);
 for(let i=0;i<p.plants*36&&samples.length<p.plants;i++){
  const x=T.MathUtils.lerp(bounds[0],bounds[1],hash(i,Number(p.key)||71)),z=T.MathUtils.lerp(bounds[2],bounds[3],hash(i,133)),y=height(x,z);
  if(exclude(x,z)||y<p.level+.0007||coast&&y>.018||p.plant==='alpine'&&y>.07||p.plant==='fern'&&y<.02)continue;
  const slope=Math.hypot(height(x+.001,z)-y,height(x,z+.001)-y)/.001;if(slope>1.05)continue;
  const sample={x,y,z,scale:.6+hash(i,45)*.85,angle:hash(i,79)*Math.PI*2};samples.push(sample);if(i%7===0)rocks.push(sample);
 }
 const material=new T.MeshStandardMaterial({color:p.plantColor,vertexColors:true,roughness:.95,side:T.DoubleSide,envMapIntensity:.30});
 material.onBeforeCompile=s=>{s.uniforms.regionalPlantTime=time;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float regionalPlantTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
  float amount=pow(clamp(position.y/.012,0.,1.),2.)*.0008;
  transformed.x+=sin(regionalPlantTime+instanceMatrix[3].x*37.+instanceMatrix[3].z*29.)*amount;
 `);};material.customProgramCacheKey=()=> 'regional-herbs-17';
 const dummy=new T.Object3D();
 function batch(geo,m,entries,rock=false){if(!entries.length){geo.dispose();m.dispose();return;}
  const mesh=new T.InstancedMesh(geo,m,entries.length);mesh.name=rock?'regional-shore-stones':'regional-'+p.plant;mesh.userData.noBake=true;mesh.castShadow=rock;mesh.receiveShadow=true;
  entries.forEach((s,i)=>{dummy.position.set(s.x,s.y+(rock?-.0004:.0001),s.z);dummy.rotation.set(rock?hash(i,3):0,s.angle,rock?.2:0);dummy.scale.set(s.scale*(rock?1.4:1),s.scale*(rock?.55:1),s.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
 }
 batch(herbGeometry(p.plant),material,samples);batch(new T.IcosahedronGeometry(.0022,1),new T.MeshStandardMaterial({color:p.rockColor,roughness:.94}),rocks,true);
 return {plants:samples.length,stones:rocks.length,kind:p.plant,update:t=>time.value=t*p.windSpeed};
}
