import * as T from 'three';
// Real leaf silhouettes and branching volumes, not camera-facing foliage cards.
// A small deterministic prototype library is instanced across each local scene.
const prototypes=new Map();
const foliage=new T.MeshStandardMaterial({vertexColors:true,roughness:.91,side:T.DoubleSide,envMapIntensity:.30});
foliage.forceSinglePass=true;
const timber=new T.MeshStandardMaterial({color:'#625444',roughness:.98,envMapIntensity:.25});
const V=(x,y,z)=>new T.Vector3(x,y,z);
function generator(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function prototype(pine,variant){
 const key=`${pine?'fir':'broadleaf'}-${variant}`;if(prototypes.has(key))return prototypes.get(key);
 const rand=generator(19073+variant*931+(pine?41:0)),wp=[],wi=[],lp=[],li=[],lc=[];
 function branch(a,b,r){
  const axis=b.clone().sub(a),u=axis.clone().cross(V(0,0,1)).normalize(),v=axis.clone().normalize().cross(u),base=wp.length/3;
  for(let ring=0;ring<4;ring++)for(let side=0;side<7;side++){
   const t=ring/3,angle=side/7*Math.PI*2,q=a.clone().addScaledVector(axis,t).addScaledVector(u,Math.cos(angle)*r*(1-t*.83)).addScaledVector(v,Math.sin(angle)*r*(1-t*.83));
   q.x+=Math.sin(t*Math.PI)*r*.45;wp.push(q.x,q.y,q.z);
  }
  for(let ring=0;ring<3;ring++)for(let side=0;side<7;side++){const a=base+ring*7+side,b=base+ring*7+(side+1)%7;wi.push(a,b,a+7,b,b+7,a+7);}
 }
 function leaf(center,size,dark){
  const normal=V(rand()-.5,.3+rand()*.7,rand()-.5).normalize(),u=normal.clone().cross(V(0,0,1)).normalize(),v=normal.clone().cross(u),a=rand()*Math.PI*2;
  const U=u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a)),W=v.clone().multiplyScalar(Math.cos(a)).addScaledVector(u,-Math.sin(a));
  const base=lp.length/3,shade=(.76+rand()*.38)*(dark?.75:1);
  for(const [x,y,z]of [[0,-1,0],[-.43,0,0],[0,.15,.15],[.43,0,0],[0,1,0]]){
   const q=center.clone().addScaledVector(U,x*size).addScaledVector(W,y*size).addScaledVector(normal,z*size);
   lp.push(q.x,q.y,q.z);lc.push(.095*shade,.135*shade,.049*shade);
  }
  li.push(base,base+1,base+2,base,base+2,base+3,base+1,base+4,base+2,base+2,base+4,base+3);
 }
 const height=.033+(rand()-.5)*.005,lean=V((rand()-.5)*.003,height,(rand()-.5)*.003);
 branch(V(0,0,0),lean,.0011);
 if(pine){
  for(let tier=0;tier<10;tier++)for(let arm=0;arm<4;arm++){
   const t=(tier+1)/11,angle=arm*Math.PI*.5+tier*1.91+rand()*.3,r=(1-t)*.013;
   const a=V(lean.x*t,height*(.16+t*.8),lean.z*t),b=a.clone().add(V(Math.cos(angle)*r,-.002*(1-t),Math.sin(angle)*r));branch(a,b,.00032*(1-t)+.00006);
   for(let i=0;i<26;i++){const f=rand(),c=a.clone().lerp(b,f);c.x+=(rand()-.5)*r*.40;c.z+=(rand()-.5)*r*.40;c.y+=(rand()-.4)*.0025;leaf(c,.0008+rand()*.0006,true);}
  }
 }else{
  for(let limb=0;limb<11;limb++){
   const a=limb*2.399+rand()*.3,t=.38+limb/11*.53,r=(.004+Math.sin((t-.2)*Math.PI)*.007)*(1+rand()*.2);
   const start=V(lean.x*t,height*t,lean.z*t),end=start.clone().add(V(Math.cos(a)*r,.003+rand()*.004,Math.sin(a)*r));branch(start,end,.00040*(1-t)+.0001);
   for(let twig=0;twig<3;twig++){
    const tip=end.clone().add(V((rand()-.5)*.010,(rand()-.2)*.004,(rand()-.5)*.010));branch(start.clone().lerp(end,.65),tip,.00011);
    for(let i=0;i<27;i++){
     const az=rand()*Math.PI*2,elevation=rand()*2-1,radius=Math.cbrt(rand()),radial=Math.sqrt(1-elevation*elevation);
     const c=tip.clone().add(V(Math.cos(az)*radial*.0053*radius,elevation*.0032*radius,Math.sin(az)*radial*.0053*radius));
     leaf(c,.0010+rand()*.00055,false);
    }
   }
  }
 }
 function geometry(p,i,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.length/3*2),2));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(i);g.computeVertexNormals();return g;}
 const value={key,wood:geometry(wp,wi),leaves:geometry(lp,li,lc)};prototypes.set(key,value);return value;
}
export function plantTree(parent,x,z,scale=1,y=.034,pine=false){
 const h=Math.abs(Math.sin(x*731+z*281+scale*19)),variant=Math.min(3,Math.floor(h*4));
 const marker=new T.Object3D();marker.userData.treePrototype=prototype(pine,variant);marker.position.set(x,y,z);marker.rotation.y=h*Math.PI*2;marker.scale.set(scale*(.9+h*.2),scale,scale*(1.1-h*.2));parent.add(marker);
}
export function batchVegetation(root){
 root.updateMatrixWorld(true);const groups=new Map(),remove=[],inverse=root.matrixWorld.clone().invert();
 root.traverse(o=>{const p=o.userData.treePrototype;if(!p)return;if(!groups.has(p))groups.set(p,[]);groups.get(p).push(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));remove.push(o);});
 for(const [p,matrices]of groups)for(const [geometry,material]of [[p.wood,timber],[p.leaves,foliage]]){
  const mesh=new T.InstancedMesh(geometry,material,matrices.length);mesh.name=p.key;mesh.userData.noBake=true;mesh.castShadow=mesh.receiveShadow=true;
  matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;root.add(mesh);
 }
 remove.forEach(o=>o.removeFromParent());return {botanicalTrees:remove.length,treePrototypes:groups.size,foliageMode:'individual folded leaves / instanced branching trees'};
}
