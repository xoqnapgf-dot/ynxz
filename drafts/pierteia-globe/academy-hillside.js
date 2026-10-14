import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { finish } from './world-finish.js?v=8';
import { scatterEcology } from './ecology.js?v=8';
import { attachAtelier } from './academy-asset.js?v=8';
import { reflectiveSea } from './archipelago-hq.js?v=8';
import { gridGround, lane } from './regional-scenes.js?v=8';

// A circular CAMPUS PLAN, not one circular building: separate teaching, library,
// workshop and common-room masses follow the contour around an open planted garden.
const TAU=Math.PI*2;
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
function height(x,z){
 const r=Math.hypot(x,z),a=Math.atan2(z,x),edge=.57+.035*Math.sin(a*5)+.020*Math.cos(a*9);
 const campus=.041+.067*smooth(.20,-.26,z);
 const hills=.185*Math.exp(-((x+.12)**2*15+(z+.405)**2*38))+.095*Math.exp(-((x-.22)**2*34+(z+.39)**2*42));
 const strata=.004*Math.sin(x*73+Math.sin(z*47))+.003*Math.sin(z*105+x*31);
 return T.MathUtils.lerp(-.055,campus+(hills+strata)*smooth(.25,.36,r),1-smooth(edge-.10,edge+.025,r));
}
function makeMaterials(k){
 const stone=new T.MeshStandardMaterial({color:'#a6a594',map:k.maps.stone.map,normalMap:k.maps.stone.normal,normalScale:new T.Vector2(.26,.26),roughness:.9});
 const roof=color=>new T.MeshStandardMaterial({color,map:k.maps.roof.map,normalMap:k.maps.roof.normal,normalScale:new T.Vector2(.25,.25),roughness:.74,side:T.DoubleSide});
 return {
  stone, plaster:new T.MeshStandardMaterial({color:'#c5bfa8',normalMap:k.maps.rock.normal,normalScale:new T.Vector2(.08,.08),roughness:.92}),
  light:new T.MeshStandardMaterial({color:'#e2d4af',roughness:.83}), dark:new T.MeshStandardMaterial({color:'#334441',roughness:.87}),
  wood:new T.MeshStandardMaterial({color:'#78614a',map:k.maps.wood.map,roughness:.88}),
  copper:roof('#668b7d'), tile:roof('#8a6856'), slate:roof('#617575'),
  glass:new T.MeshStandardMaterial({color:'#496d70',roughness:.18,metalness:.38}),
  brass:new T.MeshStandardMaterial({color:'#afa17a',roughness:.48,metalness:.65}),
  red:new T.MeshStandardMaterial({color:'#93483b',roughness:.69}),
  paving:new T.MeshStandardMaterial({color:'#b1aa94',map:k.maps.rock.map,roughness:.94}),
  earth:new T.MeshStandardMaterial({color:'#69734b',roughness:1}),
  water:new T.MeshStandardMaterial({color:'#5b9291',metalness:.42,roughness:.16}),
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
 return k.mesh(g,geo,m,x,y,z);
}
function panel(g,k,p,x,y,z,w,h,{books=false}={}){
 box(g,k,w+.002,h+.002,.0014,p.dark,x,y,z);
 box(g,k,w,h,.001,p.glass,x,y,z+.001);
 for(const side of [-1,1]){box(g,k,.0008,h+.003,.002,p.wood,x+side*w/2,y,z+.002);box(g,k,w+.002,.0008,.002,p.wood,x,y+side*h/2,z+.002);}
 box(g,k,w,.0006,.002,p.wood,x,y+h*.12,z+.002);
 for(let i=1;i<Math.ceil(w/.006);i++)box(g,k,.00045,h,.002,p.light,x-w/2+i*w/Math.ceil(w/.006),y,z+.0022);
 box(g,k,w+.004,.0014,.005,p.light,x,y-h/2-.001,z+.002);
 if(books)for(let i=0;i<6;i++)box(g,k,.0014,.003+(i%3)*.0005,.002,i%2?p.paper:p.red,x-w*.37+i*w*.14,y-h*.28,z+.0025);
}
function gableRoof(g,k,p,w,d,y,rise,m){
 const shape=new T.Shape();shape.moveTo(-d/2,0);shape.lineTo(d/2,0);shape.lineTo(0,rise);shape.closePath();
 for(const side of [-1,1]){const q=new T.Group();q.rotation.y=side*Math.PI/2;g.add(q);const end=k.mesh(q,new T.ShapeGeometry(shape),p.plaster,0,y,w/2);end.material.side=T.DoubleSide;}
 for(const sign of [-1,1]){
  const slope=box(g,k,w+.008,.0012,Math.hypot(d*.56,rise),m,0,y+rise/2,sign*d*.28);slope.rotation.x=sign*Math.atan2(rise,d*.56);
  k.beam(g,[-w*.55,y,sign*d*.57],[w*.55,y,sign*d*.57],.00055,p.dark);
  for(let i=0;i<Math.ceil(w/.007);i++)box(g,k,.0007,.0018,.009,p.wood,-w*.48+i*.007,y-.001,sign*d*.49);
 }
 k.beam(g,[-w*.56,y+rise,0],[w*.56,y+rise,0],.00085,m);
 for(let i=0;i<Math.ceil(w/.006);i++)for(const sign of [-1,1])k.beam(g,[-w*.50+i*.006,y+rise,0],[-w*.50+i*.006,y,sign*d*.56],.0002,m);
}
function rail(g,k,p,a,b){
 const dist=new T.Vector3(...a).distanceTo(new T.Vector3(...b)),n=Math.ceil(dist/.007);
 for(let i=0;i<=n;i++){const v=new T.Vector3(...a).lerp(new T.Vector3(...b),i/n);k.beam(g,v.toArray(),[v.x,v.y+.009,v.z],.0004,p.wood);}
 k.beam(g,[a[0],a[1]+.010,a[2]],[b[0],b[1]+.010,b[2]],.00055,p.wood);
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
function building(g,k,p,{x,z,w,d,h,y=height(x,z)+.006,angle=0,roof=p.tile,bookshop=false,balcony=false}){
 const q=new T.Group();q.position.set(x,y,z);q.rotation.y=angle;g.add(q);
 box(q,k,w+.005,.021,d+.005,p.stone,0,-.008,0);
 box(q,k,w,h,d,p.plaster,0,h/2,0);
 box(q,k,w+.002,.002,d+.002,p.light,0,h*.51,0);
 const floors=h>.038?2:1,count=Math.max(2,Math.floor(w/.022));
 for(const side of [-1,1]){
  const f=new T.Group();f.rotation.y=side<0?Math.PI:0;q.add(f);
  for(let row=0;row<floors;row++)for(let i=0;i<count;i++)panel(f,k,p,-w*.36+i*w*.72/(count-1),.012+row*.025,d/2+.001,.012,.016,{books:bookshop});
  for(const x of [-w*.47,w*.47]){box(f,k,.0025,h,.0025,p.wood,x,h/2,d*.51);k.beam(f,[x,.001,d*.51],[x,h,d*.51],.0005,p.dark);}
  box(f,k,.009,.020,.001,p.dark,0,.010,d/2+.002);box(f,k,.001,.021,.002,p.wood,.0047,.0105,d/2+.003);
 }
 for(const side of [-1,1]){
  const f=new T.Group();f.rotation.y=side*Math.PI/2;q.add(f);
  for(let row=0;row<floors;row++)panel(f,k,p,0,.012+row*.025,w/2+.001,.014,.016);
 }
 gableRoof(q,k,p,w,d,h,.013,roof);
 if(balcony){
  box(q,k,w+.008,.002,.014,p.wood,0,.024,d*.65);
  rail(q,k,p,[-w*.53,.025,d*.79],[w*.53,.025,d*.79]);
  for(const x of [-w*.46,0,w*.46])k.beam(q,[x,-.005,d*.76],[x,h+.001,d*.76],.0007,p.wood);
  const canopy=box(q,k,w+.012,.001,.018,roof,0,h+.002,d*.69);canopy.rotation.x=.13;
 }
 // Chimney caps, rainpipes, doors, shelf contents and individual rafters.
 box(q,k,.004,.018,.005,p.stone,-w*.27,h+.007,-d*.24);box(q,k,.005,.001,.006,p.dark,-w*.27,h+.016,-d*.24);
 for(const side of [-1,1])k.beam(q,[w*.46,0,side*d*.52],[w*.46,h,side*d*.52],.00045,p.dark);
 return {group:q,y};
}
function curvedWing(g,k,p,{r,depth,start,end,y,h,roof=p.copper}){
 const shape=new T.Shape(),n=100,ri=r-depth/2,ro=r+depth/2;
 for(let i=0;i<=n;i++){const a=T.MathUtils.lerp(start,end,i/n),x=Math.sin(a)*ro,z=-Math.cos(a)*ro;i?shape.lineTo(x,z):shape.moveTo(x,z);}
 for(let i=n;i>=0;i--){const a=T.MathUtils.lerp(start,end,i/n);shape.lineTo(Math.sin(a)*ri,-Math.cos(a)*ri);}shape.closePath();
 for(const [bottom,hh,m]of [[y-.024,.026,p.stone],[y,h,p.plaster],[y+h*.50,.002,p.light]]){const mesh=k.mesh(g,new T.ExtrudeGeometry(shape,{depth:hh,bevelEnabled:false}),m,0,bottom,0);mesh.rotation.x=-Math.PI/2;}
 const pos=[],uv=[],idx=[];
 for(let i=0;i<=n;i++){
  const a=T.MathUtils.lerp(start,end,i/n);for(const [j,rr]of [ri-.006,r,ro+.006].entries()){pos.push(Math.sin(a)*rr,y+h+(j===1?.018:0),Math.cos(a)*rr);uv.push(i*.05,j*1.1);}
  if(i<n){const b=i*3;idx.push(b,b+3,b+1,b+1,b+3,b+4,b+1,b+4,b+2,b+2,b+4,b+5);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();k.mesh(g,geo,roof);
 const bays=Math.ceil((end-start)*r/.024);
 for(let i=0;i<bays;i++){
  const a=T.MathUtils.lerp(start+.04,end-.04,i/(bays-1));
  for(const inner of [true,false]){
   const q=new T.Group(),rr=inner?ri:ro;q.position.set(Math.sin(a)*rr,y,Math.cos(a)*rr);q.rotation.y=a+(inner?Math.PI:0);g.add(q);
   panel(q,k,p,0,.015,.001,.016,.022,{books:true});panel(q,k,p,0,.041,.001,.016,.018);
   box(q,k,.0015,h,.002,p.wood,.010,h/2,.002);
  }
  const beamRadius=ri-.012;qPergola(g,k,p,a,beamRadius,y,.030);
  if(i%3===0){const q=new T.Group();q.position.set(Math.sin(a)*r,y+h+.012,Math.cos(a)*r);q.rotation.y=a;g.add(q);box(q,k,.016,.009,.012,p.glass,0,.004,0);for(const x of [-.008,0,.008])box(q,k,.0006,.010,.013,p.brass,x,.004,0);}
 }
 for(const [a,sign]of [[start,-1],[end,1]]){
  const endFace=new T.Group();endFace.position.set(Math.sin(a)*r,y,Math.cos(a)*r);endFace.rotation.y=a+sign*Math.PI/2;g.add(endFace);
  for(const x of [-depth*.23,depth*.23])for(const yy of [.015,.041])panel(endFace,k,p,x,yy,.0008,.013,.018,{books:true});
 }
 // Gable closures at the two ends of the crescent; no open roof voids.
 for(const a of [start,end]){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([Math.sin(a)*ri,y+h,Math.cos(a)*ri,Math.sin(a)*r,y+h+.018,Math.cos(a)*r,Math.sin(a)*ro,y+h,Math.cos(a)*ro],3));geo.computeVertexNormals();p.plaster.side=T.DoubleSide;k.mesh(g,geo,p.plaster);}
}
function qPergola(g,k,p,a,r,y,h){
 const q=new T.Group();q.rotation.y=a;g.add(q);
 k.beam(q,[0,y,r],[0,y+h,r],.0008,p.wood);box(q,k,.022,.0014,.020,p.wood,0,y+h,r+.006);box(q,k,.022,.001,.021,p.slate,0,y+h+.001,r+.006);
}
function coveredWalk(g,k,p,points){
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],length=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.ceil(length/.013),right=new T.Vector3(b[2]-a[2],0,a[0]-b[0]).normalize();
  for(let j=0;j<=n;j++){
   const v=new T.Vector3(...a).lerp(new T.Vector3(...b),j/n),q=new T.Group();q.position.copy(v);q.rotation.y=Math.atan2(b[0]-a[0],b[2]-a[2]);g.add(q);
   box(q,k,.018,.002,.0135,p.wood,0,0,0);box(q,k,.023,.0015,.014,p.slate,0,.026,0);
   if(j%2===0)for(const sign of [-1,1]){const x=v.x+right.x*.008*sign,z=v.z+right.z*.008*sign;k.beam(g,[x,height(x,z)-.004,z],[x,v.y+.026,z],.00065,p.wood);}
  }
 }
}
function circledA(g,k,p,x,y,z,r){
 k.torus(g,r,.00085,p.red,x,y,z);
 k.beam(g,[x-r*.65,y-r*.76,z],[x,y+r*.82,z],.00075,p.red);k.beam(g,[x,y+r*.82,z],[x+r*.65,y-r*.76,z],.00075,p.red);k.beam(g,[x-r*.57,y-r*.16,z],[x+r*.57,y-r*.16,z],.0006,p.red);
}
export function createAcademyHillside(g,k){
 const p=makeMaterials(k);for(const key of ['stone','plaster','wood','glass'])finish(p[key],key);for(const key of ['tile','slate'])finish(p[key],'roof');finish(p.copper,'metal');
 gridGround(g,k,height,(x,z,y)=>{
  const slope=Math.hypot(height(x+.001,z)-y,height(x,z+.001)-y)/.001;
  return new T.Color(y<.010?'#aba58a':slope>1.25?'#9a9c8a':'#76865b').multiplyScalar(.91+hash(Math.floor(x*130),Math.floor(z*130))*.10);
 },1.55,320);
 // Only the northern library is a crescent. The other wings have their own massing.
 curvedWing(g,k,p,{r:.204,depth:.051,start:Math.PI*.74,end:Math.PI*1.27,y:.112,h:.055});
 const teaching=[{x:-.210,z:.046,angle:1.30,w:.078,d:.047,h:.051,y:.069},{x:-.216,z:-.059,angle:1.78,w:.072,d:.046,h:.056,y:.089},{x:-.170,z:-.142,angle:2.28,w:.073,d:.047,h:.049,y:.109}];
 for(const b of teaching)building(g,k,p,{...b,balcony:true,roof:p.tile});
 // Shared workshops: lower brick-and-timber volumes with northlight roof monitors.
 for(const b of [{x:.210,z:.015,angle:-1.35,w:.100,d:.055,h:.029,y:.074},{x:.181,z:-.098,angle:-2.10,w:.077,d:.050,h:.043,y:.097}]){
  const {group:q}=building(g,k,p,{...b,roof:p.slate,bookshop:true});
  for(let i=0;i<3;i++){const x=-b.w*.27+i*b.w*.27;box(q,k,.017,.006,.013,p.glass,x,b.h+.012,0);box(q,k,.019,.001,.015,p.slate,x,b.h+.016,0);}
  for(let i=0;i<3;i++)lessonTable(q,k,p,-b.w*.30+i*b.w*.28,b.d*.90,.002);
 }
 // Common room at the south-west and a smaller, low entrance porch. No gate towers.
 attachAtelier(g);
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
  if(r<.284||y<.020||Math.abs(x)<.050&&z>.20||Math.hypot(x-.40,z-.17)<.045)continue;
  const slope=Math.hypot(height(x+.001,z)-y,height(x,z+.001)-y)/.001;if(slope>1.65)continue;
  k.tree(g,x,z,.60+hash(i,81)*.90,y,i%5===0);trees++;
 }
 for(let i=0;i<45;i++){const a=hash(i,88)*TAU,r=.141+hash(i,22)*.024,x=Math.sin(a)*r,z=Math.cos(a)*r;k.person(g,x,z,height(x,z)+.003);}
 for(let i=0;i<12;i++){const a=i/12*TAU,x=Math.sin(a)*.145,z=Math.cos(a)*.145;k.lamp(g,x,z,height(x,z)+.002);}
 // Small coastal landing keeps the island setting without dominating the campus.
 for(let i=0;i<24;i++)box(g,k,.029,.0015,.0025,p.wood,.44,.010,.16+i*.0028);
 for(const x of [.427,.453])for(const z of [.16,.19,.222])k.beam(g,[x,-.025,z],[x,.011,z],.0009,p.wood);
 k.boat(g,.477,.20,.7,.1);
 const ecology=scatterEcology(g,{height,bounds:[-.53,.53,-.53,.47],count:1200,exclude:(x,z)=>Math.hypot(x,z)<.29||Math.abs(x-.40)<.04&&Math.abs(z-.17)<.08,seed:900});
 return {focus:.116,eye:[.52,.39,.70],light:[-2.2,3.3,4.5],views:{street:{eye:[-.007,.105,.237],target:[-.119,.077,.170]},materials:{eye:[-.054,.080,.202],target:[-.081,.076,.170]}},meta:{...ecology,sceneType:'open circular hillside campus / separated academic wings',circledA:true,trees,revision:8,blenderAsset:true},environment:env=>reflectiveSea(env,k,height)};
}
