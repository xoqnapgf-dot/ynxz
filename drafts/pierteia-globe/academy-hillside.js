import * as T from 'three';
import { alignTimber, addRainwater, plankWalk } from './academy-craft.js?v=14.1';
import { campusSurface, addCampusLandscape } from './academy-landscape.js?v=14';
import { studyMaterial, readingCourt, scalePerson } from './academy-study.js?v=11';
import { wallWithOpenings, bendWall } from './architecture.js?v=10';
import { tiledRoof } from './roof-detail.js?v=12';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { finish } from './world-finish.js?v=9';
import { scatterEcology } from './ecology.js?v=9';
import { attachAtelier } from './academy-asset.js?v=11';
import { reflectiveSea } from './archipelago-hq.js?v=17';
import { gridGround, lane } from './regional-scenes.js?v=17';

// A circular CAMPUS PLAN, not one circular building: separate teaching, library,
// workshop and common-room masses follow the contour around an open planted garden.
const TAU=Math.PI*2;
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
function height(x,z){
 const r=Math.hypot(x,z),a=Math.atan2(z,x),edge=.57+.035*Math.sin(a*5)+.020*Math.cos(a*9);
 const campus=.041+.067*smooth(.20,-.26,z);
 // An oblique shoulder with separate spurs; no single gaussian dome behind the library.
 const ridge=z+.43+.055*Math.sin(x*9);
 const spurs=.132*Math.exp(-((x+.19)**2*28+ridge*ridge*70))+.098*Math.exp(-((x-.19)**2*46+(ridge-.028)**2*90));
 const fold=Math.sin(x*67+Math.sin(z*21)*2.2),cuts=Math.pow(.5+.5*fold,6);
 const shelves=.0045*Math.tanh(Math.sin(z*166+x*24)*2.8);
 const strata=.003*Math.sin(x*73+Math.sin(z*47))+.002*Math.sin(z*105+x*31);
 const sculpt=spurs+strata+(-.019*cuts+shelves)*smooth(-.25,-.35,z);
 const natural=T.MathUtils.lerp(-.055,campus+sculpt*smooth(.25,.405,r),1-smooth(edge-.10,edge+.025,r));
 const dx=x+.119,dz=z-.163,lx=(dx*Math.cos(.52)-dz*Math.sin(.52))*100,lz=(dx*Math.sin(.52)+dz*Math.cos(.52))*100;
 const courtDistance=Math.max(Math.abs(lx)-4.9,Math.abs(lz-9.95)-3.2);
 return T.MathUtils.lerp(natural,.0407,1-smooth(-.2,1.3,courtDistance));
}
function makeMaterials(k){
 const stone=new T.MeshStandardMaterial({color:'#a6a594',map:k.maps.stone.map,normalMap:k.maps.stone.normal,normalScale:new T.Vector2(.26,.26),roughness:.9});
 const roof=color=>new T.MeshStandardMaterial({color,map:k.maps.roof.map,normalMap:k.maps.roof.normal,normalScale:new T.Vector2(.25,.25),roughness:.74,side:T.DoubleSide});
 return {
  stone, plaster:new T.MeshStandardMaterial({color:'#c5bfa8',normalMap:k.maps.rock.normal,normalScale:new T.Vector2(.08,.08),roughness:.92}),
  light:new T.MeshStandardMaterial({color:'#e2d4af',roughness:.83}), dark:new T.MeshStandardMaterial({color:'#334441',roughness:.87}),
  wood:new T.MeshStandardMaterial({color:'#78614a',map:k.maps.wood.map,roughness:.88}),
  copper:roof('#657065'), tile:roof('#896b57'), slate:roof('#5c655e'),
  clearGlass:new T.MeshPhysicalMaterial({color:'#b5beb4',roughness:.20,metalness:0,transparent:true,opacity:.25,depthWrite:false,envMapIntensity:.45}),
  glass:new T.MeshStandardMaterial({color:'#35413b',roughness:.18,metalness:.38}),
  brass:new T.MeshStandardMaterial({color:'#afa17a',roughness:.48,metalness:.65}),
  red:new T.MeshStandardMaterial({color:'#93483b',roughness:.69}),
  paving:new T.MeshStandardMaterial({color:'#b1aa94',map:k.maps.rock.map,roughness:.94}),
  earth:new T.MeshStandardMaterial({color:'#69734b',roughness:1}),
  water:new T.MeshStandardMaterial({color:'#5b9291',metalness:.42,roughness:.16}),
  books:['#a99b7e','#785c50','#5b6b60','#79807c','#b3a78f','#6d6573'].map(color=>new T.MeshStandardMaterial({color,roughness:.96})),
  paper:new T.MeshStandardMaterial({color:'#c9bb98',roughness:.98})
 };
}
// Brick courses use physical-sized UVs instead of stretching one texture over a wall.
function box(g,k,w,h,d,m,x=0,y=0,z=0){
 const geo=Math.min(w,h,d)>.004?new RoundedBoxGeometry(w,h,d,1,Math.min(w,h,d)*.035):new T.BoxGeometry(w,h,d),p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){
  if(Math.abs(n.getY(i))>.5)uv.setXY(i,p.getX(i)*48,p.getZ(i)*48);
  else uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))*48,p.getY(i)*48);
 }
 if(m.userData.grainAligned)alignTimber(geo,[w,h,d]);
 return k.mesh(g,geo,m,x,y,z);
}
function panel(g,k,p,x,y,z,w,h,{books=false,recessed=false,louvers=false}={}){
 box(g,k,w+.001,h+.001,.0006,p.dark,x,y,z+(recessed?-.003:0));
 const glass=box(g,k,w,h,.00025,recessed?p.clearGlass:p.glass,x,y,z+(recessed?-.0005:.001));glass.castShadow=!recessed;
 for(const side of [-1,1]){box(g,k,.0007,h+.0018,.0014,p.wood,x+side*w/2,y,z+.0005);box(g,k,w+.0018,.0007,.0014,p.wood,x,y+side*h/2,z+.0005);}
 box(g,k,w,.00055,.0014,p.wood,x,y+h*.12,z+.00065);
 for(let i=1;i<Math.ceil(w/.007);i++)box(g,k,.0004,h,.0014,p.wood,x-w/2+i*w/Math.ceil(w/.007),y,z+.00065);
 box(g,k,w+.003,.0011,.003,p.light,x,y-h/2-.0007,z+.0008);
 box(g,k,w+.002,.0007,.002,p.light,x,y+h/2+.0006,z+.0003);
 if(books)for(const yy of [-h*.29,h*.08]){
  box(g,k,w*.92,.0006,.0015,p.wood,x,y+yy-.0003,z-.0016);
  for(let i=0;i<8;i++){
   const n=hash(i+g.position.x*123+yy*100,g.position.z*913+y*718);if(n>.86)continue;
   const hh=.0020+n*.0018,book=box(g,k,.0008+n*.0003,hh,.0012,p.books[Math.floor(n*p.books.length)],x-w*.40+i*w*.112,y+yy+hh/2,z-.0016);
   if(n<.16)book.rotation.z=.12;
  }
 }
 if(louvers)for(const side of [-1,1]){
  const q=new T.Group();q.position.set(x+side*(w/2+.0012),y,z+.001);q.rotation.y=side*.45;g.add(q);
  for(const dx of [-.0015,.0015])box(q,k,.00045,h+.001,.0007,p.wood,dx,0,0);
  for(let i=0;i<7;i++){const slat=box(q,k,.0034,.00065,.0007,p.wood,0,-h*.43+i*h*.143,0);slat.rotation.x=-.30;}
 }
}
function gableRoof(g,k,p,w,d,y,rise,m){
 tiledRoof(g,{w:w+.008,d:d*1.12,rise,y,bed:.00052,material:m});
 const shape=new T.Shape();shape.moveTo(-d/2,0);shape.lineTo(d/2,0);shape.lineTo(0,rise);shape.closePath();
 for(const side of [-1,1]){const q=new T.Group();q.rotation.y=side*Math.PI/2;g.add(q);const end=k.mesh(q,new T.ShapeGeometry(shape),p.plaster,0,y,w/2);end.material.side=T.DoubleSide;}
 for(const sign of [-1,1]){
  const slope=box(g,k,w+.008,.00065,Math.hypot(d*.56,rise),m,0,y+rise/2,sign*d*.28);slope.rotation.x=sign*Math.atan2(rise,d*.56);
  k.beam(g,[-w*.55,y,sign*d*.57],[w*.55,y,sign*d*.57],.00055,p.dark);
  for(let i=0;i<Math.ceil(w/.007);i++)box(g,k,.0007,.0018,.009,p.wood,-w*.48+i*.007,y-.001,sign*d*.49);
 }
 k.beam(g,[-w*.56,y+rise,0],[w*.56,y+rise,0],.00085,m);

}
// Shallow northlight: glazed front, sloping opaque back, closed triangular cheeks.
function roofMonitor(parent,k,p,x,y,w=.017,d=.013,h=.006){
 const q=new T.Group();q.position.set(x,y,0);parent.add(q);
 const vertices=[-w/2,0,-d/2,w/2,0,-d/2,-w/2,h,d/2,w/2,h,d/2,-w/2,0,d/2,w/2,0,d/2];
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1,0,0,1,0],2));geo.setIndex([0,2,1,1,2,3,0,4,2,1,3,5]);geo.computeVertexNormals();k.mesh(q,geo,p.slate);
 const glass=box(q,k,w-.001,h-.0007,.0002,p.clearGlass,0,h/2,d/2-.0003);glass.castShadow=false;
 box(q,k,w,.0005,d,p.dark,0,0,0);
 for(const xx of [-w/2,0,w/2])box(q,k,.0004,h,.0007,p.wood,xx,h/2,d/2);
 for(const yy of [0,h])box(q,k,w+.001,.0004,.0008,p.dark,0,yy,d/2);
}
function rail(g,k,p,a,b){
 const dist=new T.Vector3(...a).distanceTo(new T.Vector3(...b)),n=Math.ceil(dist/.007);
 for(let i=0;i<=n;i++){const v=new T.Vector3(...a).lerp(new T.Vector3(...b),i/n);k.beam(g,v.toArray(),[v.x,v.y+.009,v.z],.00025,p.wood);}
 k.beam(g,[a[0],a[1]+.010,a[2]],[b[0],b[1]+.010,b[2]],.00028,p.wood);
}
function steps(g,k,p,x,z,width,from,to,count=12,angle=0){
 const q=new T.Group();q.position.set(x,0,z);q.rotation.y=angle;g.add(q);
 for(let i=0;i<count;i++)box(q,k,width,.0025,.0045,p.stone,0,T.MathUtils.lerp(from,to,i/(count-1)),i*.004);
 for(const side of [-1,1])rail(q,k,p,[side*width*.51,from,0],[side*width*.51,to,(count-1)*.004]);
}
function bench(g,k,p,x,z,y,angle=0){
 const q=new T.Group();q.position.set(x,y,z);q.rotation.y=angle;g.add(q);
 for(let j=0;j<3;j++)box(q,k,.020,.001,.0015,p.wood,0,.004,-.002+j*.002);
 box(q,k,.020,.0035,.001,p.wood,0,.007,-.003);
 for(const x of [-.007,.007])box(q,k,.001,.005,.005,p.dark,x,.0025,0);
}
function pot(g,k,p,x,z,y,s=1){k.mesh(g,new T.CylinderGeometry(.0025*s,.0018*s,.004*s,10),p.red,x,y+.002*s,z);k.tree(g,x,z,.14*s,y+.004*s);}
function lessonTable(g,k,p,x,z,y){
 box(g,k,.021,.0014,.009,p.wood,x,y+.007,z);for(const dx of [-.008,.008])for(const dz of [-.003,.003])box(g,k,.001,.007,.001,p.wood,x+dx,y+.0035,z+dz);
 for(const sign of [-1,1])bench(g,k,p,x,z+sign*.010,y,sign<0?0:Math.PI);
 box(g,k,.004,.0006,.003,p.paper,x-.004,y+.008,z);box(g,k,.004,.0008,.003,p.red,x+.004,y+.008,z+.001);
}
function building(g,k,p,{x,z,w,d,h,y=height(x,z)+.006,angle=0,roof=p.tile,bookshop=false,balcony=false,profile=0}){
 const q=new T.Group();q.position.set(x,y,z);q.rotation.y=angle;g.add(q);
 box(q,k,w+.005,.021,d+.005,p.masonry,0,-.008,0);
 const floors=h>.038?2:1,floorHeight=h/floors,count=Math.max(2,Math.floor(w/(bookshop?.032:.024)));
 const windowW=bookshop?.019:profile===1?.0135:.012,windowH=Math.min(bookshop?.018:.017,floorHeight*.66);
 for(let floor=0;floor<=floors;floor++)box(q,k,w-.002,.001,d-.002,p.wood,0,floor*floorHeight,0);
 for(const side of [-1,1]){
  const f=new T.Group();f.rotation.y=side<0?Math.PI:0;q.add(f);const openings=[];
  for(let row=0;row<floors;row++)for(let i=0;i<count;i++){
   const xx=-w*.34+i*w*.68/(count-1),yy=(row+.53)*floorHeight;
   if(row===0&&Math.abs(xx)<windowW/2+.0055)continue;
   openings.push({x:xx,y:yy,w:windowW,h:windowH});
  }
  const doorHeight=Math.min(.021,floorHeight*.84),door={x:0,y:.0004+doorHeight/2,w:.009,h:doorHeight};
  k.mesh(f,wallWithOpenings({width:w,height:h,openings:[...openings,door]}),p.plaster,0,0,d/2);
  for(const a of openings)panel(f,k,p,a.x,a.y,d/2,a.w,a.h,{books:bookshop||profile===2,recessed:true,louvers:!bookshop&&profile===1});
  for(let row=1;row<floors;row++)box(f,k,w+.001,.0014,.0016,p.light,0,row*floorHeight,d/2+.0004);
  for(const xx of [-w*.48,w*.48])box(f,k,.0014,h,.0016,bookshop?p.wood:p.light,xx,h/2,d/2+.0004);
  box(f,k,.0087,doorHeight,.0009,p.wood,0,door.y,d/2-.0006);
  for(const sign of [-1,1])box(f,k,.0008,doorHeight+.001,.0018,p.light,sign*.005,door.y,d/2+.0004);
  box(f,k,.011,.0012,.002,p.light,0,doorHeight+.001,d/2+.0004);
  box(f,k,.0003,.003,.0005,p.brass,.0028,doorHeight*.46,d/2+.00005);
  box(f,k,.013,.0018,.006,p.stone,0,0,d/2+.002);
 }
 for(const side of [-1,1]){
  const f=new T.Group();f.rotation.y=side*Math.PI/2;q.add(f);
  const openings=Array.from({length:floors},(_,row)=>({x:0,y:(row+.53)*floorHeight,w:bookshop?.021:.014,h:windowH}));
  k.mesh(f,wallWithOpenings({width:d,height:h,openings}),p.plaster,0,0,w/2);
  for(const a of openings)panel(f,k,p,a.x,a.y,w/2,a.w,a.h,{recessed:true,books:bookshop});
 }
 gableRoof(q,k,p,w,d,h,bookshop?.011:profile===1?.016:.013,roof);
 if(balcony){
  const deck=floorHeight-.001;box(q,k,w+.008,.002,.014,p.wood,0,deck,d*.65);
  rail(q,k,p,[-w*.53,deck+.001,d*.79],[w*.53,deck+.001,d*.79]);
  for(const xx of [-w*.46,0,w*.46])k.beam(q,[xx,-.005,d*.76],[xx,deck+.011,d*.76],.00055,p.wood);

  for(const xx of [-w*.46,w*.46])k.beam(q,[xx,deck-.001,d*.72],[xx,deck-.009,d*.52],.0006,p.wood);
 }
 box(q,k,.004,.018,.005,p.stone,-w*.27,h+.007,-d*.24);box(q,k,.005,.001,.006,p.dark,-w*.27,h+.016,-d*.24);
 addRainwater(q,k,{w,d,h,ground:height});
 return {group:q,y};
}
function curvedWing(g,k,p,{r,depth,start,end,y,h,roof=p.copper}){
 const shape=new T.Shape(),n=100,ri=r-depth/2,ro=r+depth/2;
 for(let i=0;i<=n;i++){const a=T.MathUtils.lerp(start,end,i/n),x=Math.sin(a)*ro,z=-Math.cos(a)*ro;i?shape.lineTo(x,z):shape.moveTo(x,z);}
 for(let i=n;i>=0;i--){const a=T.MathUtils.lerp(start,end,i/n);shape.lineTo(Math.sin(a)*ri,-Math.cos(a)*ri);}shape.closePath();
 for(const [bottom,hh,m]of [[y-.024,.024,p.stone],[y,.0012,p.wood],[y+h*.50,.0012,p.wood],[y+h-.0012,.0012,p.wood]]){const mesh=k.mesh(g,new T.ExtrudeGeometry(shape,{depth:hh,bevelEnabled:false}),m,0,bottom,0);mesh.rotation.x=-Math.PI/2;}
 const pos=[],uv=[],idx=[];
 for(let i=0;i<=n;i++){
  const a=T.MathUtils.lerp(start,end,i/n);for(const [j,rr]of [ri-.006,r,ro+.006].entries()){pos.push(Math.sin(a)*rr,y+h+(j===1?.018:0),Math.cos(a)*rr);uv.push(i*.05,j*1.1);}
  if(i<n){const b=i*3;idx.push(b,b+3,b+1,b+1,b+3,b+4,b+1,b+4,b+2,b+2,b+4,b+5);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();k.mesh(g,geo,roof);
 // Raised standing seams on the crescent's metal roof, not a flat green sheet.
 for(let i=0;i<=Math.ceil((end-start)*r/.009);i++){
  const a=T.MathUtils.lerp(start,end,i/Math.ceil((end-start)*r/.009));
  for(const radius of [ri-.006,ro+.006])k.beam(g,[Math.sin(a)*radius,y+h+.0009,Math.cos(a)*radius],[Math.sin(a)*r,y+h+.0188,Math.cos(a)*r],.00019,roof);
 }
 const bays=Math.ceil((end-start)*r/.024);
 for(let i=0;i<bays;i++){
  const a=start+(i+.5)*(end-start)/bays;
  for(const inner of [true,false]){
   const q=new T.Group(),rr=inner?ri:ro;
   const openings=[{x:0,y:.015,w:.016,h:.022},{x:0,y:.041,w:.016,h:.018}];
   k.mesh(g,bendWall(wallWithOpenings({width:rr*(end-start)/bays,height:h,openings}),rr,a,inner?-1:1),p.plaster,0,y,0);
   q.position.set(Math.sin(a)*rr,y,Math.cos(a)*rr);q.rotation.y=a+(inner?Math.PI:0);g.add(q);
   panel(q,k,p,0,.015,0,.016,.022,{books:inner&&i%4===1,recessed:true});panel(q,k,p,0,.041,0,.016,.018,{books:inner&&i%3===1,recessed:true});
   box(q,k,.0015,h,.002,p.wood,.010,h/2,.002);
  }
  const beamRadius=ri-.015;qPergola(g,k,p,a,beamRadius,y,.030);
  if(i%3===0){const q=new T.Group();q.position.set(Math.sin(a)*r,y+h+.016,Math.cos(a)*r);q.rotation.y=a+Math.PI;g.add(q);roofMonitor(q,k,p,0,0,.016,.012,.0045);}
 }
 for(const [a,sign]of [[start,-1],[end,1]]){
  const endFace=new T.Group();endFace.position.set(Math.sin(a)*r,y,Math.cos(a)*r);endFace.rotation.y=a+sign*Math.PI/2;g.add(endFace);
  const ends=[];for(const x of [-depth*.23,depth*.23])for(const yy of [.015,.041])ends.push({x,y:yy,w:.013,h:.018});
  k.mesh(endFace,wallWithOpenings({width:depth,height:h,openings:ends}),p.plaster);
  for(const a of ends)panel(endFace,k,p,a.x,a.y,0,a.w,a.h,{books:true,recessed:true});
 }
 // One thin annular canopy follows the library; no overlapping shelf-like boxes.
 const cp=[],ci=[],cu=[];
 for(let i=0;i<=n;i++){
  const a=T.MathUtils.lerp(start,end,i/n);
  for(const rr of [ri-.017,ri+.001]){cp.push(Math.sin(a)*rr,y+.030+(rr-(ri-.017))*.075,Math.cos(a)*rr);cu.push(i*.04,rr*48);}
  if(i<n){const b=i*2;ci.push(b,b+1,b+2,b+1,b+3,b+2);}
 }
 const canopy=new T.BufferGeometry();canopy.setAttribute('position',new T.Float32BufferAttribute(cp,3));canopy.setAttribute('uv',new T.Float32BufferAttribute(cu,2));canopy.setIndex(ci);canopy.computeVertexNormals();k.mesh(g,canopy,p.copper);
 for(const rr of [ri-.017,ri+.001]){
  const points=[];for(let i=0;i<=60;i++){const a=T.MathUtils.lerp(start,end,i/60);points.push(new T.Vector3(Math.sin(a)*rr,y+.030+(rr-(ri-.017))*.075,Math.cos(a)*rr));}
  k.mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points),80,.00025,5,false),p.dark);
 }
 // Gable closures at the two ends of the crescent; no open roof voids.
 for(const a of [start,end]){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([Math.sin(a)*ri,y+h,Math.cos(a)*ri,Math.sin(a)*r,y+h+.018,Math.cos(a)*r,Math.sin(a)*ro,y+h,Math.cos(a)*ro],3));geo.computeVertexNormals();p.plaster.side=T.DoubleSide;k.mesh(g,geo,p.plaster);}
}
function qPergola(g,k,p,a,r,y,h){
 const q=new T.Group();q.rotation.y=a;g.add(q);
 k.beam(q,[0,y,r],[0,y+h,r],.00065,p.wood);
 k.beam(q,[0,y+h-.006,r],[0,y+h,r+.006],.00035,p.wood);
}
function coveredWalk(g,k,p,points){
 for(let i=0;i<points.length-1;i++){
  const a=new T.Vector3(...points[i]),b=new T.Vector3(...points[i+1]),delta=b.clone().sub(a),length=Math.hypot(delta.x,delta.z);
  const right=new T.Vector3(delta.z,0,-delta.x).normalize(),along=delta.clone().normalize();
  // One continuous deck per sloping run, rather than overlapping square plates.
  const vertices=[];for(const dy of [0,-.002])for(const [v,sign]of [[a,1],[b,1],[b,-1],[a,-1]]){const q=v.clone().addScaledVector(right,.009*sign);q.y+=dy;vertices.push(q.x,q.y,q.z);}
  const indices=[4,5,6,4,6,7];for(let j=0;j<4;j++){const n=(j+1)%4;indices.push(j,n,j+4,j+4,n,n+4);}
  const deck=new T.BufferGeometry();deck.setAttribute('position',new T.Float32BufferAttribute(vertices,3));deck.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap((_,j)=>j%3===0?[vertices[j]*48,vertices[j+2]*48]:[]),2));deck.setIndex(indices);deck.computeVertexNormals();k.mesh(g,deck,p.wood);plankWalk(g,k,a,b,p.wood);
  // Continuous shallow-pitched roof, with a narrow ridge and standing seams.
  const rp=[],uv=[];for(const [end,t]of [[a,0],[b,1]])for(const sign of [-1,0,1]){const q=end.clone().addScaledVector(right,sign*.010);q.y+=.027+(sign===0?.002:0);rp.push(q.x,q.y,q.z);uv.push(t*length*48,(sign+1)*.5);}
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(rp,3));roof.setAttribute('uv',new T.Float32BufferAttribute(uv,2));roof.setIndex([0,3,1,1,3,4,1,4,2,2,4,5]);roof.computeVertexNormals();k.mesh(g,roof,p.slate);
  for(const sign of [-1,1]){
   const ea=a.clone().addScaledVector(right,sign*.010),eb=b.clone().addScaledVector(right,sign*.010);ea.y+=.027;eb.y+=.027;k.beam(g,ea.toArray(),eb.toArray(),.00045,p.dark);
   const ra=a.clone().addScaledVector(right,sign*.009),rb=b.clone().addScaledVector(right,sign*.009);rail(g,k,p,ra.toArray(),rb.toArray());
  }
  const seams=Math.ceil(length/.012);for(let j=0;j<=seams;j++){
   const mid=a.clone().lerp(b,j/seams);mid.y+=.029;
   for(const sign of [-1,1]){const edge=mid.clone().addScaledVector(right,sign*.010);edge.y-=.002;k.beam(g,mid.toArray(),edge.toArray(),.00012,p.slate);}
  }
  const posts=Math.ceil(length/.025);for(let j=0;j<=posts;j++)for(const sign of [-1,1]){
   const v=a.clone().lerp(b,j/posts).addScaledVector(right,sign*.009),top=v.clone();top.y+=.027;
   k.beam(g,[v.x,height(v.x,v.z)-.004,v.z],top.toArray(),.00045,p.wood);
   if(j<posts){const brace=top.clone().addScaledVector(along,.007);k.beam(g,[v.x,top.y-.007,v.z],brace.toArray(),.00035,p.wood);}
  }
 }
}
function circledA(g,k,p,x,y,z,r){
 k.torus(g,r,.00085,p.red,x,y,z);
 k.beam(g,[x-r*.65,y-r*.76,z],[x,y+r*.82,z],.00075,p.red);k.beam(g,[x,y+r*.82,z],[x+r*.65,y-r*.76,z],.00075,p.red);k.beam(g,[x-r*.57,y-r*.16,z],[x+r*.57,y-r*.16,z],.0006,p.red);
}
export function createAcademyHillside(g,k){
 const originalBeam=k.beam;k={...k,beam:(...args)=>{const o=originalBeam(...args);if(o.material.userData.grainAligned)alignTimber(o.geometry,[args[3]*2,new T.Vector3(...args[2]).distanceTo(new T.Vector3(...args[1])),args[3]*2]);return o;}};
 const p=makeMaterials(k);for(const key of ['stone','plaster','glass'])finish(p[key],key);for(const key of ['tile','slate'])finish(p[key],'roof');finish(p.copper,'metal');p.wood=studyMaterial('wood');p.wood.userData.grainAligned=true;p.masonry=studyMaterial('stone');p.plaster.color.set('#dad7cc');p.plaster.normalScale.set(.23,.23);p.paving=campusSurface('path');
 const groundIndex=g.children.length;
 gridGround(g,k,height,(x,z,y)=>{
  const slope=Math.hypot(height(x+.001,z)-y,height(x,z+.001)-y)/.001;
  return new T.Color(y<.010?'#aba58a':slope>1.25?'#9a9c8a':'#76865b').multiplyScalar(.98+Math.sin(x*19+Math.cos(z*23))*.025);
 },1.55,384);
 const landscape=addCampusLandscape(g,k,height,g.children[groundIndex]);
 // Only the northern library is a crescent. The other wings have their own massing.
 curvedWing(g,k,p,{r:.204,depth:.051,start:Math.PI*.74,end:Math.PI*1.27,y:.112,h:.055});
 const teaching=[{x:-.210,z:.046,angle:1.30,w:.078,d:.047,h:.051,y:.069},{x:-.216,z:-.059,angle:1.78,w:.072,d:.046,h:.056,y:.089},{x:-.170,z:-.142,angle:2.28,w:.073,d:.047,h:.049,y:.109}];
 for(const [profile,b]of teaching.entries())building(g,k,p,{...b,profile,balcony:true,roof:profile===2?p.slate:p.tile});
 // Shared workshops: lower brick-and-timber volumes with northlight roof monitors.
 for(const b of [{x:.210,z:.015,angle:-1.35,w:.100,d:.055,h:.029,y:.074},{x:.181,z:-.098,angle:-2.10,w:.077,d:.050,h:.043,y:.097}]){
  const {group:q}=building(g,k,p,{...b,roof:p.slate,bookshop:true});
  for(let i=0;i<3;i++)roofMonitor(q,k,p,-b.w*.27+i*b.w*.27,b.h+.009);
  for(let i=0;i<3;i++)lessonTable(q,k,p,-b.w*.30+i*b.w*.28,b.d*.90,.002);
 }
 // Common room at the south-west and a smaller, low entrance porch. No gate towers.
 attachAtelier(g);const court=readingCourt(g,k,height);
 const entry=new T.Group();entry.position.set(.017,.047,.223);entry.rotation.y=.06;g.add(entry);
 box(entry,k,.076,.008,.037,p.stone,0,-.003,0);
 box(entry,k,.021,.041,.025,p.plaster,-.025,.020,0);
 for(const [x,z]of [[.033,-.014],[.033,.014],[-.007,.014]])k.beam(entry,[x,0,z],[x,.035,z],.0011,p.wood);
 const canopy=box(entry,k,.084,.002,.045,p.copper,0,.039,0);canopy.rotation.z=-.075;
 for(let i=0;i<12;i++)box(entry,k,.001,.002,.043,p.wood,-.039+i*.007,.036,0);
 circledA(entry,k,p,-.025,.023,.0138,.010);
 // Noticeboard and glass-fronted work display make the entrance academic, not defensive.
 box(entry,k,.011,.012,.0015,p.wood,-.008,.020,.016);box(entry,k,.009,.009,.001,p.paper,-.008,.020,.017);
 for(let i=0;i<3;i++)box(entry,k,.009,.001,.001,p.red,-.008,.017+i*.003,.0177);
 coveredWalk(g,k,p,[[-.176,.079,.089],[-.170,.091,-.025],[-.145,.113,-.129],[-.105,.114,-.157]]);
 coveredWalk(g,k,p,[[.122,.111,-.134],[.151,.093,-.056],[.158,.075,.055]]);
 // Ring route is a landscaped, sloping footpath, not a retaining-wall drum.
 const orbit=[];for(let i=0;i<=72;i++){const a=i/72*TAU;orbit.push([Math.sin(a)*.154,Math.cos(a)*.154]);}
 lane(g,orbit,.012,height,k,p.paving);
 lane(g,[[.017,.245],[.015,.155],[-.024,.067],[.014,-.033],[.030,-.118],[.015,-.170]],.017,height,k,p.paving);
 lane(g,[[-.177,.051],[-.10,.040],[-.03,-.015],[.075,-.04],[.155,-.025]],.011,height,k,p.paving);
 lane(g,[[.022,.260],[.077,.30],[.18,.34],[.32,.29],[.40,.17]],.013,height,k,p.paving);
 // Short local stairs connect each wing to the contour path rather than one grand stair.
 steps(g,k,p,-.165,.071,.023,.074,.061,9,Math.PI*.5);
 steps(g,k,p,.143,.036,.024,.074,.066,7,-Math.PI*.5);
 steps(g,k,p,.022,-.153,.036,.111,.093,10,0);
 // Rain garden with an irregular, small pond; no concentric seating or central arena.
 const garden=new T.Group();const gy=height(.056,.046)+.002;garden.position.set(.056,gy,.046);g.add(garden);
 const pond=new T.Shape();pond.moveTo(-.034,0);pond.bezierCurveTo(-.028,-.019,.018,-.024,.032,-.005);pond.bezierCurveTo(.041,.009,.016,.026,-.006,.012);pond.bezierCurveTo(-.016,.004,-.040,.015,-.034,0);
 const bankShape=new T.Shape(pond.getPoints(64).map(v=>v.clone().multiplyScalar(1.13)));bankShape.holes.push(new T.Path(pond.getPoints(64).reverse()));
 const bank=k.mesh(garden,new T.ExtrudeGeometry(bankShape,{depth:.005,bevelEnabled:true,bevelThickness:.0007,bevelSize:.0007,bevelSegments:2}),p.stone);bank.rotation.x=-Math.PI/2;bank.position.y=-.003;
 const water=k.mesh(garden,new T.ShapeGeometry(pond,32),p.water,0,.003,0);water.rotation.x=-Math.PI/2;
 for(let i=0;i<5;i++)box(garden,k,.008,.002,.006,p.light,-.019+i*.009,.004,.010-i*.002);
 for(const [x,z,s]of [[-.066,.065,1.8],[-.016,-.054,2.1],[.080,-.070,1.4],[-.095,-.092,1.1],[.081,.109,.7]])k.tree(g,x,z,s,height(x,z));
 for(const [x,z,a]of [[-.058,.094,.4],[.058,-.075,-.3],[-.098,-.035,-1.2],[.111,.023,-1.5]])bench(g,k,p,x,z,height(x,z)+.002,a);
 for(const [x,z]of [[-.083,.115],[.120,.080],[-.06,-.117]])lessonTable(g,k,p,x,z,height(x,z)+.002);
 for(let i=0;i<40;i++){const a=i/40*TAU,x=Math.sin(a)*.138,z=Math.cos(a)*.138;if(i%4===0)pot(g,k,p,x,z,height(x,z),1.3);}
 // Low garden walls only where the contour changes; never an enclosing stadium wall.
 for(const side of [-1,1])for(let i=0;i<9;i++){
  const x=side*(.10+i*.012),z=-.20,y=height(x,z);box(g,k,.012,.009,.004,p.stone,x,y+.003,z);
 }
 // A planted shoulder, not a temple or round tower on the summit.
 let trees=0;for(let i=0;i<950;i++){
  const x=(hash(i,6)-.5)*1.2,z=(hash(i,11)-.5)*1.2,r=Math.hypot(x,z),y=height(x,z);
  if(Math.hypot(x+.065,z-.257)<.09||r<.284||y<.020||Math.abs(x)<.050&&z>.20||Math.hypot(x-.40,z-.17)<.045)continue;
  const slope=Math.hypot(height(x+.001,z)-y,height(x,z+.001)-y)/.001;if(slope>1.65)continue;
  const grove=.5+.25*Math.sin(x*24+Math.sin(z*13))+.25*Math.cos(z*27-x*8);
  if(hash(i,29)>.30+grove*.56)continue;
  k.tree(g,x,z,1.05+hash(i,81)*.80,y,i%5===0);trees++;
 }
 for(let i=0;i<12;i++){const a=(i+.35)/12*TAU,r=.154,x=Math.sin(a)*r,z=Math.cos(a)*r;scalePerson(g,x,z,height(x,z)+.0015,{yaw:a+.4,variant:i%4});}
 for(let i=0;i<12;i++){const a=i/12*TAU,x=Math.sin(a)*.145,z=Math.cos(a)*.145;k.lamp(g,x,z,height(x,z)+.002);}
 // Small coastal landing keeps the island setting without dominating the campus.
 for(let i=0;i<24;i++)box(g,k,.029,.0015,.0025,p.wood,.44,.010,.16+i*.0028);
 for(const x of [.427,.453])for(const z of [.16,.19,.222])k.beam(g,[x,-.025,z],[x,.011,z],.0009,p.wood);
 k.boat(g,.477,.20,.7,.1);
 const ecology=scatterEcology(g,{height,bounds:[-.53,.53,-.53,.47],count:1200,exclude:(x,z)=>Math.hypot(x+.065,z-.257)<.09||Math.hypot(x,z)<.29||Math.abs(x-.40)<.04&&Math.abs(z-.17)<.08,seed:900});
 let academyOpenings=0;g.traverse(o=>academyOpenings+=o.geometry?.userData.openingCount||0);
 return {habitat:{height,bounds:[-.48,.48,-.50,-.28],exclude:(x,z)=>Math.hypot(x,z)<.32},focus:.116,eye:[.52,.39,.70],light:[-2.2,3.3,4.5],views:{hillside:{eye:[.29,.20,.035],target:[-.06,.18,-.31]},courtyard:court,joinery:court.detail,library:{eye:[.10,.205,-.075],target:[-.01,.14,-.196]},teaching:{eye:[-.075,.136,.115],target:[-.21,.093,.035]},workshop:{eye:[.09,.133,.14],target:[.208,.095,.015]},street:court,materials:{eye:[-.054,.080,.202],target:[-.081,.076,.170]}},meta:{...ecology,sceneType:'open circular hillside campus / separated academic wings',circledA:true,trees,revision:14,craftRevision:14,drainageRuns:10,...landscape,humanScaleMeters:1.70,courtyardEyeHeightMeters:1.65,photographicIBL:true,referenceWood:true,academyOpenings,piercedLibrary:true,blenderAsset:true},environment:env=>reflectiveSea(env,k,height)};
}
