import * as T from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
let resources,job;
export function loadStudyAssets(renderer,progress=()=>{}){
 if(resources)return Promise.resolve(resources);if(job)return job;
 job=(async()=>{
  const acquired=[],maps={};let done=0;
  try{
   const loader=new T.TextureLoader();
   const files=['wood_color','wood_roughness','brick_base_gray','brick_normal','brick_roughness'];
   const tasks=files.map(async name=>{
    const texture=await loader.loadAsync(new URL(`./assets/study/${name}.jpg`,import.meta.url).href);acquired.push(texture);
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
    if(name.endsWith('color')||name.endsWith('gray'))texture.colorSpace=T.SRGBColorSpace;
    maps[name]=texture;progress(++done/6);
   });
   let hdr;tasks.push(new RGBELoader().loadAsync(new URL('./assets/study/forest_slope_512.hdr',import.meta.url).href).then(t=>{hdr=t;acquired.push(t);progress(++done/6);}));
   const results=await Promise.allSettled(tasks);const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
   hdr.mapping=T.EquirectangularReflectionMapping;const pmrem=new T.PMREMGenerator(renderer);
   let environment;try{environment=pmrem.fromEquirectangular(hdr);}finally{pmrem.dispose();hdr.dispose();}
   resources={maps,environment};return resources;
  }catch(error){for(const t of acquired)t.dispose();job=null;throw error;}
 })();return job;
}
export function studyEnvironment(){if(!resources)throw Error('Academy reference assets not loaded');return resources.environment;}
export function studyMaterial(kind){
 if(!resources)throw Error('Academy reference assets not loaded');const m=resources.maps;
 if(kind==='wood')return new T.MeshStandardMaterial({name:'Reference wood / MaterialX',color:'#ffffff',map:m.wood_color,roughnessMap:m.wood_roughness,roughness:.82,envMapIntensity:.8});
 return new T.MeshStandardMaterial({name:'Reference masonry / MaterialX',color:'#b4aaa0',map:m.brick_base_gray,normalMap:m.brick_normal,normalScale:new T.Vector2(.48,.48),roughnessMap:m.brick_roughness,roughness:1,envMapIntensity:.8});
}
export function finishAtelier(root){
 const wood=studyMaterial('wood');
 root.traverse(o=>{if(!o.isMesh)return;
  if(o.material.name==='Oak'){
   // Retain authored UVs, use the original colour without a second brown tint.
   o.material=wood;
  }else{
   o.material=o.material.clone();o.material.envMapIntensity=.8;
   if(o.material.transmission){
    const m=o.material;m.transmission=1;m.transparent=false;m.opacity=1;m.depthWrite=true;m.roughness=.08;m.metalness=0;m.ior=1.5;m.thickness=.006;m.color.set('#ffffff');m.side=T.FrontSide;o.castShadow=false;
   }
  }
 });
}
const palettes=['#53666c','#817767','#6b7467','#79625b'].map(color=>new T.MeshStandardMaterial({color,roughness:.93}));
const skin=new T.MeshStandardMaterial({color:'#bca690',roughness:.91}),shoes=new T.MeshStandardMaterial({color:'#393b39',roughness:.85});
// Authored in metres. This is a scale figure, not any canonical character.
export function scalePerson(parent,x,z,y=0,{yaw=0,variant=0}={}){
 const g=new T.Group();g.name='1.70 m scale figure';g.position.set(x,y,z);g.rotation.y=yaw;g.scale.setScalar(.01);parent.add(g);
 const cloth=palettes[variant%palettes.length];
 const add=(geometry,m,position,scale)=>{const o=new T.Mesh(geometry,m);o.position.set(...position);if(scale)o.scale.set(...scale);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 const ellipsoid=(x,y,z,rx,ry,rz,m)=>add(new T.SphereGeometry(1,12,10),m,[x,y,z],[rx,ry,rz]);
 const limb=(a,b,r1,r2,m)=>{const v=new T.Vector3(...b).sub(new T.Vector3(...a)),o=add(new T.CylinderGeometry(r2,r1,v.length(),10),m,new T.Vector3(...a).addScaledVector(v,.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());};
 for(const side of [-1,1]){
  add(new T.BoxGeometry(.10,.075,.23),shoes,[side*.085,.0375,.035]);
  limb([side*.085,.075,0],[side*.085,.80,0],.04,.065,cloth);
  limb([side*.17,1.34,0],[side*.23,1.06,.018],.067,.048,cloth);
  limb([side*.23,1.06,.018],[side*.23,.88,.04],.047,.035,cloth);
  ellipsoid(side*.23,.855,.04,.038,.064,.032,skin);
 }
 ellipsoid(0,.845,0,.14,.15,.10,cloth);ellipsoid(0,1.12,0,.185,.28,.11,cloth);
 limb([0,1.38,0],[0,1.455,0],.05,.05,skin);
 ellipsoid(0,1.5775,0,.093,.1225,.095,skin);
 g.userData.heightMeters=1.70;return g;
}
// Ground-level study of the existing room, not a separate offline render.
export function readingCourt(parent,k,height){
 const g=new T.Group();g.name='Reading courtyard';g.position.set(-.119,.056,.163);g.rotation.y=.52;g.scale.setScalar(.01);parent.add(g);
 const wood=studyMaterial('wood'),stone=new T.MeshStandardMaterial({color:'#aaa49a',roughness:.87}),joint=new T.MeshStandardMaterial({color:'#56564e',roughness:1});
 const box=(w,h,d,x,y,z,m)=>{
  const geo=new T.BoxGeometry(w,h,d),p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))*.5,(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))*.5);
  return k.mesh(g,geo,m,x,y,z);
 };
 // 10 cm stone setts, narrow joints; individual slabs have restrained variation.
 box(9.4,.15,5.9,0,-1.53,9.95,joint);
 const stones=Array.from({length:5},(_,i)=>{const m=stone.clone();m.color.multiplyScalar(.92+i*.03);return m;});
 for(let row=0;row<9;row++)for(let col=0;col<14;col++){
  const x=-4.45+col*.66,z=7.36+row*.65;
  box(.642,.10,.632,x,-1.425,z,stones[(col*3+row*7)%5]);
 }
 // Long, low seating edge supports the space without walling it in.
 for(const side of [-1,1]){
  box(.40,.36,4.45,side*4.30,-1.14,9.85,stone);
  for(let j=0;j<3;j++)box(.105,.045,4.48,side*4.30+(j-1)*.125,-.935,9.85,wood);
 }
 // The path actually reaches the old apron stair foot at local z=7.0.
 box(2.55,.08,.50,0,-1.43,7.05,stone);
 const localToScene=(x,y,z)=>new T.Vector3(x,y,z).multiplyScalar(.01).applyAxisAngle(new T.Vector3(0,1,0),.52).add(g.position);
 const positions=[[2.95,8.75,.8,0],[-3.15,10.6,-.9,2]];
 for(const [x,z,yaw,variant]of positions){const v=localToScene(x,-1.375,z);scalePerson(parent,v.x,v.z,v.y,{yaw:yaw+.52,variant});}
 const eye=localToScene(2.2,-1.375+1.65,12.6),target=localToScene(-.5,1.5,2.3);
 const close=localToScene(2.8,-.25+1.65,4.0),detail=localToScene(2.7,1.6,2.4);
 return {eye:eye.toArray(),target:target.toArray(),walkableY:localToScene(2.2,-1.375,12.6).y,eyeHeightMeters:1.65,detail:{eye:close.toArray(),target:detail.toArray()}};
}
