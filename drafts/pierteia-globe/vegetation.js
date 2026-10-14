import * as T from 'three';
// Eight deterministic prototypes, now with forked crowns and twig-attached foliage.
const prototypes=new Map();
const foliage=new T.MeshStandardMaterial({vertexColors:true,roughness:.79,side:T.DoubleSide,envMapIntensity:.7});foliage.forceSinglePass=true;
const timber=new T.MeshStandardMaterial({color:'#665b4b',roughness:.96,envMapIntensity:.6});
const V=(x,y,z)=>new T.Vector3(x,y,z);
function generator(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function prototype(pine,variant){
 const key=`${pine?'fir':'broadleaf'}-${variant}`;if(prototypes.has(key))return prototypes.get(key);
 const rand=generator(19073+variant*931+(pine?41:0)),wp=[],wi=[],lp=[],li=[],lc=[];
 function branch(a,b,r){
  const axis=b.clone().sub(a);if(axis.length()<1e-8)return;
  const direction=axis.clone().normalize(),u=direction.clone().cross(Math.abs(direction.z)>.9?V(0,1,0):V(0,0,1)).normalize(),v=direction.clone().cross(u),base=wp.length/3;
  const rings=r>.00055?5:2,sides=r>.00055?9:6;
  for(let ring=0;ring<rings;ring++)for(let side=0;side<sides;side++){
   const t=ring/(rings-1),angle=side/sides*Math.PI*2,radius=r*(1-t*.79)*(1+.07*Math.sin(side*3.1+ring));
   const q=a.clone().addScaledVector(axis,t).addScaledVector(u,Math.cos(angle)*radius).addScaledVector(v,Math.sin(angle)*radius);q.x+=Math.sin(t*Math.PI)*r*.38;wp.push(q.x,q.y,q.z);
  }
  for(let ring=0;ring<rings-1;ring++)for(let side=0;side<sides;side++){const a=base+ring*sides+side,b=base+ring*sides+(side+1)%sides;wi.push(a,b,a+sides,b,b+sides,a+sides);}
 }
 function leaf(center,size,dark=false){
  const normal=V(rand()-.5,.2+rand()*.8,rand()-.5).normalize(),u=normal.clone().cross(V(0,0,1)).normalize(),v=normal.clone().cross(u),angle=rand()*Math.PI*2;
  const U=u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle)),W=v.clone().multiplyScalar(Math.cos(angle)).addScaledVector(u,-Math.sin(angle));
  const base=lp.length/3,shade=(.82+rand()*.30)*(dark?.74:1),hue=(variant-1.5)*.006;
  for(const [x,y,z]of [[0,-1,0],[-.30,-.5,0],[-.42,.3,0],[0,1,0],[.42,.3,0],[.30,-.5,0],[0,.12,.12]]){
   const q=center.clone().addScaledVector(U,x*size).addScaledVector(W,y*size).addScaledVector(normal,z*size);lp.push(q.x,q.y,q.z);
   const tip=1+(y+1)*.025;lc.push((.096+hue)*shade*tip,(.151+hue*.5)*shade*tip,.050*shade*tip);
  }
  for(let j=0;j<6;j++)li.push(base+6,base+j,base+(j+1)%6);
 }
 const height=.040+variant*.002+(rand()-.5)*.003,lean=V((rand()-.5)*.004,height,(rand()-.5)*.004);
 if(pine){
  branch(V(0,0,0),lean,.00125);
  for(let tier=0;tier<11;tier++)for(let arm=0;arm<5;arm++){
   const t=(tier+1)/12,angle=arm*Math.PI*.4+tier*1.91+rand()*.3,r=(1-t)*.016;
   const a=V(lean.x*t,height*(.13+t*.82),lean.z*t),b=a.clone().add(V(Math.cos(angle)*r,-.002*(1-t),Math.sin(angle)*r));branch(a,b,.00030*(1-t)+.00006);
   for(let twig=0;twig<5;twig++){
    const start=a.clone().lerp(b,(twig+1)/6),tip=start.clone().add(V(Math.cos(angle+.9)*r*.26,.0006,Math.sin(angle+.9)*r*.26));branch(start,tip,.00007);
    for(let i=0;i<12;i++){const c=start.clone().lerp(tip,rand());c.x+=(rand()-.5)*.0018;c.z+=(rand()-.5)*.0018;c.y+=(rand()-.5)*.0012;leaf(c,.00034+rand()*.00016,true);}
   }
  }
 }else{
  branch(V(0,0,0),lean.clone().multiplyScalar(.67),.0014);
  const spread=variant%2===0?1:.78;
  for(let limb=0;limb<5;limb++){
   const angle=limb*2.399+rand()*.3,t=.36+limb*.05,r=(.010+rand()*.004)*spread;
   const start=lean.clone().multiplyScalar(t),end=V(lean.x+Math.cos(angle)*r,height*(.73+rand()*.13),lean.z+Math.sin(angle)*r);branch(start,end,.00064-limb*.00005);
   for(let twig=0;twig<4;twig++){
    const root=start.clone().lerp(end,.48+twig*.12),az=angle+(twig-1.5)*.68;
    const tip=end.clone().add(V(Math.cos(az)*.005*spread,(rand()-.2)*.006,Math.sin(az)*.005*spread));branch(root,tip,.00022);
    for(let shoot=0;shoot<5;shoot++){
     const from=root.clone().lerp(tip,.25+shoot*.17),a=az+(shoot%2?1:-1)*.8;
     const to=from.clone().add(V(Math.cos(a)*(.0025+rand()*.002),.001+rand()*.002,Math.sin(a)*(.0025+rand()*.002)));branch(from,to,.000055);
     for(let i=0;i<12;i++){
      const c=from.clone().lerp(to,(i+.5)/12),offset=(i%2?1:-1)*(.00045+rand()*.00025);
      c.x+=Math.cos(a+Math.PI/2)*offset;c.z+=Math.sin(a+Math.PI/2)*offset;c.y+=(rand()-.5)*.00045;
      leaf(c,.00043+rand()*.00022);
     }
    }
   }
  }
 }
 function geometry(p,i,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.length/3*2),2));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(i);g.computeVertexNormals();g.computeBoundingBox();return g;}
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
 remove.forEach(o=>o.removeFromParent());return {botanicalTrees:remove.length,treePrototypes:groups.size,vegetationRevision:12,foliageMode:'forked crowns / twig-attached elliptic leaves / instanced'};
}
