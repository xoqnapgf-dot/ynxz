import * as T from 'three';
// Scene units: .01 = 1 m. Orient reference grain along each member, not its face UV axes.
export function alignTimber(geo,dimensions){
 const axis=dimensions.indexOf(Math.max(...dimensions)),p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){
  const v=[p.getX(i),p.getY(i),p.getZ(i)],normal=[n.getX(i),n.getY(i),n.getZ(i)];
  const face=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const cross=[0,1,2].find(a=>a!==axis&&a!==face)??(axis+1)%3;
  const end=Math.abs(normal[axis])>.8,others=[0,1,2].filter(a=>a!==axis);
  uv.setXY(i,v[end?others[0]:axis]*28,v[end?others[1]:cross]*110);
 }
 uv.needsUpdate=true;geo.userData.grainAxis=axis;
}
export function plankWalk(g,k,a,b,material){
 const delta=b.clone().sub(a),length=delta.length(),along=delta.clone().normalize(),right=new T.Vector3(along.z,0,-along.x).normalize(),up=along.clone().cross(right);
 const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,along)),count=Math.ceil(length/.0028);
 for(let i=0;i<count;i++){
  const center=a.clone().lerp(b,(i+.5)/count);center.y+=.00013;
  const geo=new T.BoxGeometry(.018,.00065,length/count-.00006);alignTimber(geo,[.018,.00065,length/count]);
  const mesh=k.mesh(g,geo,material,...center.toArray());mesh.quaternion.copy(q);mesh.name='Individual 28 cm walkway board';
 }
 return count;
}
export function addRainwater(g,k,{w,d,h,ground}){
 const metal=new T.MeshStandardMaterial({name:'Weathered zinc rainwater goods',color:'#77807b',metalness:.85,roughness:.64,side:T.DoubleSide});
 g.updateWorldMatrix(true,false);
 for(const sign of [-1,1]){
  const z=sign*d*.565,y=h-.00055,x=w*.43,r=.00045;
  const gutter=k.mesh(g,new T.CylinderGeometry(r,r,w+.010,16,1,true,Math.PI,Math.PI),metal,0,y,z);gutter.rotation.z=Math.PI/2;gutter.name='Open half-round eaves gutter';
  const base=g.localToWorld(new T.Vector3(x,0,z));const foot=ground(base.x,base.z)-g.position.y+.001;
  const points=[[x,y,z],[x,y-.0015,z],[x,y-.003,sign*d*.518],[x,foot+.0015,sign*d*.518],[x,foot,sign*d*.555]].map(p=>new T.Vector3(...p));
  const pipe=k.mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.00032,10,false),metal);pipe.name='Downpipe with swan-neck and ground outlet';
  for(let j=0;j<3;j++){const yy=T.MathUtils.lerp(foot+.003,y-.004,j/2);k.mesh(g,new T.TorusGeometry(.00037,.00008,5,12),metal,x,yy,sign*d*.518).rotation.x=Math.PI/2;}
  for(let j=0;j<=Math.floor(w/.012);j++)k.beam(g,[-w/2+j*.012,y-.0003,z],[-w/2+j*.012,y-.0015,z-sign*.0007],.00008,metal);
 }
}
