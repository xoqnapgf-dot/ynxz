import * as T from 'three';
import { tiledRoof } from './roof-detail.js?v=12';
import { finish } from './world-finish.js?v=9';
import { scatterEcology } from './ecology.js?v=9';
import { reflectiveSea } from './archipelago-hq.js?v=9';

// Representative neighbourhoods, not miniature whole countries or new official towns.
// Secondary scenes inherit the parent anchor in the viewer; no coordinates are minted.
const hash=(x,y)=>{const f=Math.sin(x*127.1+y*311.7)*43758.5453;return f-Math.floor(f);};
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function material(kit,color,type='stone',roughness=.88,extra={}){
 return finish(new T.MeshStandardMaterial({color,map:kit.maps[type].map,normalMap:kit.maps[type].normal,normalScale:new T.Vector2(.28,.28),roughness,...extra}),type==='wood'?'wood':extra.metalness?'metal':type==='roof'?'roof':type==='rock'?'terrain':color==='#895644'?'brick':'stone');
}
export function palette(k){return {brick:material(k,'#895644'),cream:material(k,'#c2ba9e'),plaster:finish(new T.MeshStandardMaterial({color:'#b7b1a0'}),'plaster'),stone:material(k,'#888d83'),steel:material(k,'#626963','roof',.7,{metalness:.2}),roof:material(k,'#545c56','roof',.84),wood:material(k,'#685241','wood'),dark:material(k,'#343c3a','rock'),glass:finish(new T.MeshStandardMaterial({color:'#343d39'}),'glass'),paper:new T.MeshStandardMaterial({color:'#d1c8a7',roughness:.9}),warm:new T.MeshStandardMaterial({color:'#d6b676',emissive:'#efb46b',emissiveIntensity:1.3,roughness:.65}),ground:material(k,'#656958','rock')};}
export function gridGround(g,k,height,colors,span=1.5,n=160){
 const p=[],c=[],uv=[],idx=[];
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
  const x=(i/n-.5)*span,z=(j/n-.5)*span,h=height(x,z),v=colors(x,z,h);
  p.push(x,h,z);c.push(v.r,v.g,v.b);uv.push(x*45,z*45);
  if(i<n&&j<n){const a=j*(n+1)+i;idx.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(c,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
 const m=new T.MeshStandardMaterial({vertexColors:true,map:k.maps.rock.map,normalMap:k.maps.rock.normal,normalScale:new T.Vector2(.48,.48),roughness:.95});
 finish(m,'terrain');const mesh=k.mesh(g,geo,m);mesh.userData.noBake=true;
}
function groundEnvironment(env,k,m){const geo=new T.PlaneGeometry(10,10);geo.rotateX(-Math.PI/2);const uv=geo.attributes.uv,pos=geo.attributes.position;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)*45,pos.getZ(i)*45);const p=k.mesh(env,geo,m,0,.004,0);p.castShadow=false;return null;}
function pane(g,x,y,z,w,h,k,p,recessed=false){
 k.box(g,w+.0015,h+.0015,.0007,p.dark,x,y,z+(recessed?-.0022:-.00015));
 k.box(g,w-.0004,h-.0004,.0005,p.glass,x,y,z+(recessed?-.00065:.00025));
 for(const sign of [-1,1]){k.box(g,.00065,h+.0015,.0018,p.wood,x+sign*w*.5,y,z+.0005);k.box(g,w+.0015,.00065,.0018,p.wood,x,y+sign*h*.5,z+.0005);}
 k.box(g,.00045,h,.0016,p.wood,x,y,z+.00065);
 k.box(g,w+.002,.001,.0028,p.cream,x,y-h*.5-.0007,z+.0008);
}
function pitchedRoof(g,w,d,h,k,m,curved=false){
 tiledRoof(g,{w,d,rise:h,curved,material:m});
 const p=[],uv=[],idx=[],n=curved?16:2;
 for(let side=0;side<2;side++)for(let i=0;i<=n;i++){
  const t=i/n,z=(side?1:-1)*t*d/2,y=h*(1-t)+(curved?Math.pow(t,4)*h*.28:0);
  p.push(-w/2,y,z,w/2,y,z);uv.push(0,t*3,3,t*3);
  if(i<n){const a=side*(n+1)*2+i*2;if(side)idx.push(a,a+2,a+1,a+1,a+2,a+3);else idx.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();m.side=T.DoubleSide;k.mesh(g,geo,m);
 k.beam(g,[-w/2,h,0],[w/2,h,0],.00085,m);

}
function windowBays(w,h,floors){
 const count=Math.max(2,Math.floor(w/.014)),result=[];
 for(let f=0;f<floors;f++)for(let i=0;i<count;i++){
  const x=-w*.36+i*w*.72/(count-1),y=.003+(f+.52)*h/floors;
  if(f===0&&Math.abs(x-w*.21)<w*.07+.0042)continue; // Leave room for a real doorway.
  result.push({x,y,w:w*.14,h:h*.25,f});
 }
 return result;
}
function piercedWall(g,width,height,depth,openings,k,material){
 const shape=new T.Shape();shape.moveTo(-width/2,.003);shape.lineTo(width/2,.003);shape.lineTo(width/2,height+.003);shape.lineTo(-width/2,height+.003);shape.closePath();
 for(const a of openings){
  const hole=new T.Path();hole.moveTo(a.x-a.w/2,a.y-a.h/2);hole.lineTo(a.x-a.w/2,a.y+a.h/2);hole.lineTo(a.x+a.w/2,a.y+a.h/2);hole.lineTo(a.x+a.w/2,a.y-a.h/2);hole.closePath();shape.holes.push(hole);
 }
 const geo=new T.ExtrudeGeometry(shape,{depth:.0018,steps:1,bevelEnabled:true,bevelSize:.000045,bevelThickness:.000045,bevelSegments:1});
 const pos=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)*45,pos.getY(i)*45);
 k.mesh(g,geo,material,0,0,depth/2-.0018);
}
function house(g,x,z,w,d,h,angle,k,p,{y=.012,timber=false,curved=false,open=false,floors=2}={}){
 const q=new T.Group();q.position.set(x,y,z);q.rotation.y=angle;g.add(q);
 k.box(q,w+.002,.004,d+.002,p.stone,0,.002,0);
 const bays=windowBays(w,h,floors);
 for(let floor=0;floor<=floors;floor++)k.box(q,w-.002,.001,d-.002,p.wood,0,.003+floor*h/floors,0);
 // Four complete facades, recesses and sills instead of a single printed front.
 for(const side of [-1,1]){
  const face=new T.Group();face.rotation.y=side===-1?Math.PI:0;q.add(face);
  const shop=open&&side===1,windows=bays.filter(a=>!shop||a.f>0);
  const doorHeight=Math.min(h*.38,h/floors*.86),door={x:w*.21,y:.004+doorHeight*.5,w:.007,h:doorHeight};
  const display={x:-w*.035,y:.005+h*.225,w:w*.87,h:h*.45};
  piercedWall(face,w,h,d,[...windows,...(shop?[display]:[door])],k,timber?p.wood:p.plaster);
  for(const a of windows){
   pane(face,a.x,a.y,d/2,a.w,a.h,k,p,true);
   for(const sign of [-1,1]){const shutter=k.box(face,.0021,a.h+.001,.0011,timber?p.wood:p.roof,a.x+sign*(a.w*.5+.0014),a.y,d/2+.001);shutter.rotation.y=sign*.28;}
  }
  for(let f=1;f<floors;f++)k.box(face,w,.0012,.002,p.wood,0,.003+f*h/floors,d*.515);
  for(const x of [-w*.46,w*.46])k.box(face,.0015,h,.002,p.wood,x,h*.5+.003,d*.515);
  // Timber lintel, front door and stone doorstep.
  k.box(face,door.w,door.h,.0012,p.wood,door.x,door.y,d/2-.0006);
  for(const dx of [-.004,.004])k.box(face,.0007,door.h+.001,.0018,p.wood,door.x+dx,door.y,d/2+.0002);
  k.box(face,.009,.0015,.002,p.wood,door.x,door.y+door.h*.5+.0005,d*.53);
  k.box(face,.011,.002,.007,p.stone,w*.21,.004,d*.58);
 }
 for(const side of [-1,1]){
  const end=new T.Group();end.rotation.y=side*Math.PI/2;q.add(end);
  const endWindows=Array.from({length:floors},(_,f)=>({x:0,y:.003+(f+.52)*h/floors,w:d*.25,h:h*.25}));
  piercedWall(end,d,h,w,endWindows,k,timber?p.wood:p.plaster);
  for(const a of endWindows)pane(end,a.x,a.y,w/2,a.w,a.h,k,p,true);
  const shape=new T.Shape();shape.moveTo(-d*.5,0);shape.lineTo(d*.5,0);shape.lineTo(0,h*.32);shape.closePath();
  const gable=k.mesh(end,new T.ShapeGeometry(shape),timber?p.wood:p.plaster,0,h+.003,w/2);gable.material.side=T.DoubleSide;
  k.beam(end,[-d*.52,h+.003,w*.52],[0,h*1.33,w*.52],.0006,p.wood);k.beam(end,[0,h*1.33,w*.52],[d*.52,h+.003,w*.52],.0006,p.wood);
 }
 if(timber&&!open)for(let i=0;i<Math.ceil(w/.004);i++){
  const x=-w*.48+i*.004;if(bays.some(a=>a.f===0&&Math.abs(x-a.x)<a.w*.5+.0005)||Math.abs(x-w*.21)<.0042)continue;
  k.box(q,.0004,h*.46,.0012,p.dark,x,h*.24+.003,d*.52);
 }
 const roof=new T.Group();roof.position.y=h+.003;q.add(roof);pitchedRoof(roof,w*1.18,d*1.25,h*.32,k,p.roof,curved);
 if(!timber)k.box(q,.004,.013,.005,p.brick,-w*.24,h+.012,-d*.23);
 if(open){
  k.box(q,w*.65,h*.33,.001,p.dark,-w*.10,h*.22,d/2-.003);
  for(let shelf=0;shelf<2;shelf++)for(let i=0;i<10;i++)k.box(q,.0019,.003+(i%3)*.0005,.002,i%3?p.cream:p.brick,-w*.37+i*w*.045,.008+shelf*.005,d*.56);
  k.box(q,w*.70,.0012,.006,p.wood,-w*.09,.012,d*.60);
  const canopy=k.box(q,w*1.03,.001,.014,p.roof,0,h*.55,d*.65);canopy.rotation.x=.17;
  for(const xx of [-w*.45,w*.45])k.beam(q,[xx,.002,d*.79],[xx,h*.53,d*.79],.00055,p.wood);
  k.box(q,.005,.010,.001,p.cream,-w*.48,h*.60,d*.64);
 }
 // Gutters, downpipes and exposed rafter ends remain geometry in close views.
 for(const sign of [-1,1]){k.beam(q,[-w*.58,h+.003,sign*d*.61],[w*.58,h+.003,sign*d*.61],.0006,p.dark);k.beam(q,[w*.47,.004,sign*d*.52],[w*.47,h+.003,sign*d*.52],.00045,p.dark);}
 for(let i=0;i<w/.006;i++)for(const side of [-1,1])k.box(q,.0007,.002,.006,p.wood,-w*.48+i*.006,h,side*d*.51);
 if(open){barrel(q,w*.55,0,d*.55,k,p);}
 return q;
}
function road(g,x,z,w,d,k,m,y=.011){k.box(g,w,.001,d,m,x,y,z);for(const sign of [-1,1])k.box(g,.001,.0015,d,k.trim,x+sign*w/2,y+.0003,z);}
function barrel(g,x,y,z,k,p){k.cyl(g,.0023,.0046,p.wood,x,y+.0023,z,12);for(const dy of [.001,.0035])k.torus(g,.00235,.00025,p.dark,x,y+dy,z,Math.PI/2);}
function crates(g,x,z,n,k,p,y=.012){for(let i=0;i<n;i++){const xx=x+(i%4)*.006,zz=z+Math.floor(i/4)*.006;const h=.005+(i%3)*.001;k.box(g,.005,h,.005,p.wood,xx,y+h/2,zz);for(const sign of [-1,1])k.box(g,.0006,h+.0003,.0054,p.cream,xx+sign*.0017,y+h/2,zz);}}
function quay(g,x,z,w,d,k,p,y=.017){k.box(g,w,.022,d,p.stone,x,y-.011,z);for(let i=0;i<Math.floor(w/.022);i++){k.cyl(g,.0015,.005,p.dark,x-w*.46+i*.022,y+.003,z+d*.43,8);k.torus(g,.002,.0004,p.dark,x-w*.46+i*.022,y+.006,z+d*.43,Math.PI/2);}}
function crane(g,x,z,k,p,scale=1){const q=new T.Group();q.position.set(x,.018,z);q.scale.setScalar(scale);g.add(q);k.cyl(q,.005,.008,p.stone,0,.004,0,12);for(const s of [-1,1])k.beam(q,[s*.006,0,0],[s*.004,.065,0],.0013,p.steel);k.beam(q,[-.004,.065,0],[.004,.065,0],.001,p.steel);k.beam(q,[0,.063,0],[0,.074,.061],.0014,p.steel);k.beam(q,[0,.025,0],[0,.074,.061],.0009,p.steel);for(let i=0;i<6;i++)k.beam(q,[0,.061+i*.002,i*.01],[0,.038+i*.006,i*.01+.01],.00055,p.steel);k.beam(q,[0,.074,.058],[0,.021,.058],.00025,p.dark);k.torus(q,.002,.0005,p.dark,0,.020,.058);}
function rails(g,x,z,length,k,p){k.box(g,.029,.002,length,p.ground,x,.009,z);for(let i=0;i<length/.004;i++)k.box(g,.024,.001,.0017,p.wood,x,.011,z-length/2+i*.004);for(const sign of [-1,1])k.box(g,.0011,.0018,length,p.steel,x+sign*.008,.0125,z);}
function train(g,x,z,k,p){
 const q=new T.Group();q.position.set(x,.013,z);g.add(q);k.box(q,.024,.004,.077,p.dark,0,.008,0);
 const boiler=k.mesh(q,new T.CylinderGeometry(.009,.009,.048,24),p.steel,0,.023,.010);boiler.rotation.x=Math.PI/2;
 k.box(q,.025,.024,.023,p.steel,0,.025,-.026);pane(q,0,.030,-.0138,.015,.009,k,p);k.box(q,.030,.002,.029,p.dark,0,.038,-.027);
 k.cyl(q,.003,.012,p.dark,0,.036,.024,12);k.cyl(q,.0045,.006,p.steel,0,.034,-.002,16);
 for(const side of [-1,1])for(const zz of [-.021,0,.024]){const wheel=k.cyl(q,.006,.002,p.dark,side*.012,.006,zz,16);wheel.rotation.z=Math.PI/2;const hub=k.cyl(q,.0016,.0025,p.steel,side*.013,.006,zz,10);hub.rotation.z=Math.PI/2;}for(const side of [-1,1])k.beam(q,[side*.014,.006,-.021],[side*.014,.006,.024],.0006,p.steel);
 for(let i=0;i<4;i++){const zz=-.078-i*.057;k.box(q,.024,.011,.046,p.wood,0,.013,zz);for(const side of [-1,1])for(const dz of [-.015,.015]){const w=k.cyl(q,.004,.002,p.dark,side*.012,.004,zz+dz,12);w.rotation.z=Math.PI/2;}for(let j=0;j<12;j++){const o=k.mesh(q,new T.IcosahedronGeometry(.0035,0),p.dark,(hash(j,i)-.5)*.017,.021,zz+(hash(j+9,i)-.5)*.037);o.scale.y=.6;}}
 return q;
}
function factory(g,x,z,w,d,k,p){
 const q=new T.Group();q.position.set(x,.012,z);g.add(q);const h=.044;
 k.box(q,w,h,d,p.brick,0,h/2,0);k.box(q,w+.004,.005,d+.004,p.stone,0,.0025,0);
 for(let i=0;i<Math.floor(w/.019);i++){const xx=-w*.45+i*.019;pane(q,xx,.027,d*.505,.010,.017,k,p);k.box(q,.003,.042,.002,p.cream,xx+.007,.021,d*.51);}
 for(let i=0;i<7;i++){
  const zz=-d/2+i*d/7,strip=d/7;
  const slope=k.box(q,w+.004,.0018,Math.hypot(strip,.012),p.roof,0,h+.006,zz+strip*.5);slope.rotation.x=-Math.atan2(.012,strip);
  k.box(q,w,.012,.0008,p.glass,0,h+.006,zz+strip);
  for(let j=0;j<Math.floor(w/.019);j++)k.box(q,.0008,.012,.0012,p.steel,-w*.46+j*.019,h+.006,zz+strip);
 }
 k.box(q,.029,.024,.002,p.dark,0,.012,d*.52);for(const sign of [-1,1])k.box(q,.002,.027,.003,p.steel,sign*.016,.013,d*.53);
 return q;
}
export function lane(g,points,width,height,k,m){
 const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z))),p=[],uv=[],ix=[],n=80;
 for(let i=0;i<=n;i++){const t=i/n,v=curve.getPoint(t),d=curve.getTangent(t),normal=new T.Vector3(-d.z,0,d.x);for(const side of [-1,1]){const x=v.x+normal.x*width*.5*side,z=v.z+normal.z*width*.5*side;p.push(x,height(x,z)+.0015,z);uv.push(side+1,t*20);}if(i<n){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();k.mesh(g,geo,m);
}
function fence(g,a,b,height,k,p){const dist=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(dist/.015);for(let i=0;i<=n;i++){const t=i/n,x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t),y=height(x,z);k.cyl(g,.0006,.012,p.steel,x,y+.006,z,6);if(i<n){const nx=T.MathUtils.lerp(a[0],b[0],(i+1)/n),nz=T.MathUtils.lerp(a[1],b[1],(i+1)/n);for(const dy of [.004,.009])k.beam(g,[x,y+dy,z],[nx,height(nx,nz)+dy,nz],.00022,p.steel);}}}
function bench(g,x,z,k,p,y=.022){for(const dz of [-.002,.002]){k.box(g,.016,.001,.0016,p.wood,x,y+.003,z+dz);for(const dx of [-.006,.006])k.box(g,.001,.003,.001,p.dark,x+dx,y+.0015,z+dz);}k.box(g,.016,.004,.001,p.wood,x,y+.006,z-.003);}
function cart(g,x,z,k,p,y=.027){k.box(g,.012,.003,.021,p.wood,x,y+.004,z);for(const side of [-1,1]){const wheel=k.cyl(g,.003,.001,p.dark,x+side*.006,y+.003,z,12);wheel.rotation.z=Math.PI/2;k.beam(g,[x+side*.005,y+.005,z],[x+side*.005,y+.009,z+.020],.0005,p.wood);}crates(g,x-.003,z-.007,2,k,p,y+.006);}
function utilityPoles(g,x,z0,z1,height,k,p){let previous=null;for(let z=z0;z<=z1;z+=.08){const y=height(x,z);k.cyl(g,.001,.044,p.wood,x,y+.022,z,8);k.box(g,.016,.0015,.002,p.dark,x,y+.041,z);for(const side of [-1,1]){k.cyl(g,.001,.003,p.cream,x+side*.006,y+.043,z,8);if(previous){const points=[[x+side*.006,y+.045,z],[x+side*.006,(y+previous.y)/2+.039,z-.04],[x+side*.006,previous.y+.045,previous.z]];k.mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),12,.00013,4),p.dark);}}previous={y,z};}}
function industrialContext(g,k,p,h){
 lane(g,[[.39,-.46],[.38,-.21],[.38,.10],[.37,.29],[.15,.34],[-.25,.34],[-.28,.20]],.029,h,k,p.stone);
 lane(g,[[.35,-.02],[.15,-.02],[.015,-.02]],.025,h,k,p.stone);
 lane(g,[[-.27,-.25],[-.27,.33]],.024,h,k,p.stone);
 for(const [a,b]of [[[.365,-.28],[.025,-.28]],[[.365,-.28],[.365,.14]],[[.03,.14],[.03,.29]],[[.03,.29],[.34,.29]]])fence(g,a,b,h,k,p);
 for(const z of [-.25,-.02,.16,.29])for(const x of [-.19,.35])k.lamp(g,x,z,h(x,z));
 utilityPoles(g,-.20,-.38,.38,h,k,p);
 for(let i=0;i<9;i++){const x=.08+i*.026;for(let j=0;j<3;j++){const bar=k.cyl(g,.0018,.022,p.steel,x,.014+j*.003,.265,10);bar.rotation.x=Math.PI/2;}}
 for(let i=0;i<5;i++){const x=.09+i*.027;for(let j=0;j<4;j++)k.box(g,.023,.0018,.003,p.wood,x,.011+j*.002,.19);}
 // Yard coal bunkers, loading conveyor, connecting service hut and cycle racks.
 for(const x of [.23,.29]){k.box(g,.002,.012,.08,p.stone,x,.016,.23);}k.box(g,.063,.012,.002,p.stone,.26,.016,.269);
 for(let i=0;i<5;i++){const z=.18+i*.014;k.box(g,.029,.002,.002,p.steel,.26,.032,z);for(const x of [.246,.274])k.beam(g,[x,.01,z],[x,.033,z],.00045,p.steel);}
 factory(g,.26,-.32,.09,.055,k,p);
 for(let i=0;i<8;i++){const x=-.38+hash(i,55)*.19,z=.29+hash(i,57)*.035;k.tree(g,x,z,.45,h(x,z));}
 for(let i=0;i<7;i++){const z=-.04+i*.045;fence(g,[-.405,z],[-.40,z+.028],h,k,p);for(let j=0;j<4;j++)k.box(g,.007,.001,.025,p.ground,-.42+j*.009,h(-.42,z)+.001,z);}
 for(const z of [-.29,.18]){const q=new T.Group();q.position.set(-.035,.015,z);g.add(q);k.cyl(q,.001,.033,p.dark,0,.016,0,8);k.box(q,.013,.003,.002,p.cream,.004,.031,0);k.box(q,.004,.007,.002,p.dark,0,.028,0);}
}
function lakeContext(g,k,p,h){
 lane(g,[[-.39,.055],[-.31,-.08],[-.28,-.32],[.13,-.36],[.42,-.27],[.45,-.08],[.39,.06]],.021,h,k,p.stone);
 for(let i=0;i<160;i++){const x=(hash(i,17)-.5)*1.9,z=-.40-hash(i,41)*.7;k.tree(g,x,z,.7+hash(i,22)*.9,h(x,z),i%4===0);}
 for(const x of [-.27,-.035,.15])for(const z of [-.30,.04]){k.box(g,.030,.004,.014,p.stone,x,.024,z);for(let i=0;i<4;i++)k.tree(g,x-.012+i*.008,z,.20,.026);bench(g,x,z+.012,k,p);}
 for(let i=0;i<9;i++){k.lamp(g,-.15+i*.058,.068,.023);}
 // Freestanding covered walkway, glazing subdivisions and workshop extraction stacks.
 for(let i=0;i<7;i++){const x=-.20+i*.060;for(const z of [-.060,-.042])k.cyl(g,.001,.022,p.steel,x,.033,z,8);}k.box(g,.39,.0015,.024,p.glass,-.02,.045,-.051);
 for(const [x,z,w,d,hh]of [[-.15,-.11,.15,.07,.058],[.055,-.15,.12,.085,.068],[.21,-.08,.10,.061,.044],[-.12,-.25,.13,.055,.037],[.14,-.26,.12,.05,.039]]){
  for(const side of [-1,1]){const face=new T.Group();face.position.set(x,.023,z);face.rotation.y=side*Math.PI/2;g.add(face);for(let f=0;f<2;f++)for(let i=0;i<4;i++)pane(face,-d*.33+i*d*.22,.013+f*.018,w*.505,.008,.011,k,p);}
  for(let i=0;i<3;i++)k.cyl(g,.002,.009,p.steel,x-w*.24+i*w*.2,.028+hh,z-d*.25,10);
 }
 const a=new T.Group();a.position.set(.055,.023,-.15);g.add(a);k.cyl(a,.018,.012,p.cream,0,.074,0,48);k.mesh(a,new T.SphereGeometry(.018,32,16,0,Math.PI*2,0,Math.PI/2),p.steel,0,.080,0);k.box(a,.003,.017,.039,p.dark,0,.085,0);
}
function harbourContext(g,k,p,h){
 for(const z of [-.06,-.134,-.207,-.281])lane(g,[[-.39,z],[0,z+.006],[.40,z]],.018,h,k,p.stone);
 for(const x of [-.345,-.052,.33])lane(g,[[x,.135],[x,-.08],[x-.015,-.29]],.016,h,k,p.stone);
 for(let i=0;i<120;i++){const x=(hash(i,78)-.5)*1.6,z=-.40-hash(i,52)*.7;k.tree(g,x,z,.7+hash(i,24)*.8,h(x,z),i%7===0);}
 utilityPoles(g,-.36,-.30,.10,h,k,p);
 for(let i=0;i<8;i++){const x=-.30+i*.084;
  k.box(g,.019,.002,.012,p.wood,x,.026,.092);crates(g,x-.006,.088,4,k,p,.027);
  k.beam(g,[x,.071,.076],[x,.084,.113],.0008,p.wood);k.beam(g,[x,.084,.112],[x,.039,.112],.00016,p.dark);k.torus(g,.0015,.0004,p.dark,x,.038,.112);
  for(const side of [-1,1])k.box(g,.009,.014,.0015,p.wood,x+side*.017,.041,.081);
 }
 for(const x of [-.18,.10,.29]){cart(g,x,.135,k,p);marketStall(g,x+.02,.140,k,p,'#ac8962');}
 for(let i=0;i<7;i++){const x=-.15+i*.020;for(let j=0;j<3;j++){const pole=k.cyl(g,.001,.025,p.wood,x,.030+j*.002,.14,8);pole.rotation.z=Math.PI/2;}}
 // Fishing-net drying frame, floats and coiled rope on the working apron.
 for(const x of [-.11,-.05])k.cyl(g,.0007,.021,p.wood,x,.038,.102,8);
 for(let i=0;i<12;i++){const x=-.11+i*.005;k.beam(g,[x,.029,.102],[x,.049,.102],.00013,p.dark);}for(let i=0;i<5;i++)k.beam(g,[-.11,.030+i*.004,.102],[-.05,.030+i*.004,.102],.00013,p.dark);
 for(let i=0;i<10;i++){const x=-.30+i*.059;for(let j=0;j<3;j++)k.torus(g,.0026-j*.0006,.0002,p.cream,x,.027,.150,Math.PI/2);}
}
function townContext(g,k,p,h){
 lane(g,[[-.05,.075],[-.05,-.12],[-.045,-.25],[-.06,-.37]],.033,h,k,p.stone);
 lane(g,[[-.06,-.20],[.04,-.205],[.15,-.205],[.15,-.24]],.023,h,k,p.stone);
 lane(g,[[.05,.062],[.26,.061],[.30,-.17]],.017,h,k,p.stone);
 utilityPoles(g,-.025,-.30,.018,h,k,p);
 for(let i=0;i<180;i++){const x=(hash(i,44)-.5)*1.5,z=-.38-hash(i,11)*.75;k.tree(g,x,z,.75+hash(i,23),h(x,z),i%3===0);}
 // Terraced plots and stacked-stone retaining walls on the uphill side.
 for(let i=0;i<3;i++){const z=-.13-i*.054;k.box(g,.13,.012,.003,p.stone,.21,h(.21,z)-.006,z);for(let j=0;j<5;j++)k.box(g,.013,.001,.040,p.ground,.16+j*.021,h(.16+j*.021,z-.026)+.001,z-.025);}
 for(const x of [.10,.205])for(const z of [-.22,-.32]){k.cyl(g,.002,.009,p.stone,x,h(x,z)+.0045,z,8);k.box(g,.006,.004,.006,p.cream,x,h(x,z)+.011,z);k.mesh(g,new T.ConeGeometry(.005,.003,4),p.dark,x,h(x,z)+.014,z);}
 for(const x of [-.21,.08,.23]){bench(g,x,.065,k,p,.019);for(let i=0;i<3;i++)barrel(g,x+i*.006,.019,.082,k,p);}
 for(let i=0;i<25;i++){const x=-.34+hash(i,22)*.65,z=.11+hash(i,46)*.032,y=h(x,z);const r=k.mesh(g,new T.IcosahedronGeometry(.002+hash(i,53)*.003,1),p.stone,x,y,z);r.scale.y=.3;}
 for(let i=0;i<5;i++){const x=.03+i*.025;k.beam(g,[x,h(x,.10),.10],[x,.030,.10],.00065,p.wood);k.beam(g,[x,.026,.10],[x,.026,.133],.00035,p.wood);}
}

function iron(g,k,p){
 const h=(x,z)=>.008+(1-smooth(.28,.47,Math.abs(x)))*.001+Math.exp(-((x+.50)**2+(z+.4)**2)*30)*.07;
 gridGround(g,k,h,(x,z)=>new T.Color('#726d59').multiplyScalar(.87+hash(Math.floor(x*170),Math.floor(z*170))*.15),3.4,240);
 rails(g,-.16,0,.88,k,p);rails(g,-.10,0,.88,k,p);rails(g,-.035,0,.88,k,p);train(g,-.10,.17,k,p);
 factory(g,.13,-.12,.19,.105,k,p);factory(g,.17,.070,.135,.08,k,p);
 const smoke=new T.Group();smoke.userData.noBake=true;g.add(smoke);
 for(const [x,z,height]of [[.21,-.23,.145],[.28,-.13,.119]]){k.mesh(g,new T.CylinderGeometry(.007,.013,height,20),p.brick,x,.012+height/2,z);for(let i=0;i<6;i++)k.cyl(g,.013-i*.0009,.002,p.stone,x,.028+i*height*.15,z,20);for(let i=0;i<6;i++)k.mist(smoke,x-i*.008,.012+height+i*.014,z,.033+i*.006,'#9b9d95');}
 // Elevated service pipe rack and steel-braced water tower.
 for(let i=0;i<5;i++){const zz=-.22+i*.08;for(const xx of [.008,.031])k.beam(g,[xx,.01,zz],[xx,.064,zz],.0013,p.steel);k.beam(g,[.008,.064,zz],[.031,.064,zz],.0013,p.steel);}for(const xx of [.012,.021,.029])k.beam(g,[xx,.066,-.25],[xx,.066,.15],.002,p.steel);
 const tx=-.27,tz=-.22;for(const dx of [-.011,.011])for(const dz of [-.011,.011])k.beam(g,[tx+dx,.012,tz+dz],[tx+dx,.073,tz+dz],.0013,p.steel);for(const z of [-.011,.011]){k.beam(g,[tx-.011,.016,tz+z],[tx+.011,.070,tz+z],.0007,p.steel);k.beam(g,[tx+.011,.016,tz+z],[tx-.011,.070,tz+z],.0007,p.steel);}k.cyl(g,.021,.026,p.steel,tx,.084,tz,40);k.mesh(g,new T.ConeGeometry(.022,.009,40),p.roof,tx,.102,tz);
 road(g,-.27,.06,.055,.40,k,p.stone);for(let row=0;row<2;row++)for(let i=0;i<7;i++)house(g,-.36+row*.13,-.06+i*.045,.041,.033,.032,row===0?Math.PI/2:-Math.PI/2,k,p,{y:.011,floors:2});
 for(let i=0;i<3;i++){k.cyl(g,.013,.047,p.steel,.32,.035,-.23+i*.041,28);k.mesh(g,new T.SphereGeometry(.013,20,10,0,Math.PI*2,0,Math.PI/2),p.steel,.32,.058,-.23+i*.041);}
 crane(g,.15,.22,k,p,1.0);crates(g,.08,.21,24,k,p);for(let i=0;i<24;i++){const o=k.mesh(g,new T.IcosahedronGeometry(.006,1),p.dark,.26+(hash(i,2)-.5)*.08,.017,.23+(hash(i,4)-.5)*.08);o.scale.y=.45;}
 for(let i=0;i<16;i++){const x=-.42+hash(i,9)*.81,z=-.38+hash(i,2)*.76;if(Math.abs(x)>.32)k.tree(g,x,z,.6,h(x,z),true);}for(let i=0;i<30;i++)k.person(g,-.25+hash(i,13)*.40,.25+hash(i,19)*.08,.013);
 industrialContext(g,k,p,h);
 const ecology=scatterEcology(g,{height:h,bounds:[-.70,.70,-.72,.40],count:900,exclude:(x,z)=>x>-.44&&x<.46&&z>-.46&&z<.38,seed:12});
 return {views:{street:{eye:[.31,.16,.36],target:[.11,.05,.04]}},focus:.06,eye:[.60,.47,.78],light:[-1.6,2.3,1.1],meta:{...ecology,sceneType:'rail-and-steel neighbourhood',piercedFacades:true,scope:'representative district, not the whole country'},environment:env=>groundEnvironment(env,k,p.ground)};
}
function xuanji(g,k,p){
 const shoreline=x=>.105+Math.sin(x*9)*.024;
 const h=(x,z)=>T.MathUtils.lerp(-.045,.021+Math.exp(-((x+.52)**2+(z+.44)**2)*22)*.05,smooth(-.035,.014,shoreline(x)-z));
 gridGround(g,k,h,(x,z,y)=>new T.Color(y<0?'#766f5b':Math.abs(x)<.38&&z>-.33?'#909e8d':'#607453'),3.6,320);
 const white=material(k,'#c4ccc5'),glass=new T.MeshStandardMaterial({color:'#688f96',roughness:.19,metalness:.5}),metal=material(k,'#a2b0ad','roof',.4,{metalness:.55});
 // Compact research buildings and workshop wings, not a skyline of invented skyscrapers.
 for(const [x,z,w,d,hh]of [[-.15,-.11,.15,.07,.058],[.055,-.15,.12,.085,.068],[.21,-.08,.10,.061,.044],[-.12,-.25,.13,.055,.037],[.14,-.26,.12,.05,.039]]){
  k.box(g,w,hh,d,white,x,.023+hh/2,z);k.box(g,w+.007,.003,d+.007,metal,x,.023+hh,z);
  for(let f=0;f<3;f++){k.box(g,w*.93,.010,.001,glass,x,.035+f*.016,z+d*.506);for(let j=0;j<w/.014;j++)k.box(g,.0008,.012,.0015,metal,x-w*.45+j*.014,.035+f*.016,z+d*.51);}
  for(let i=0;i<4;i++)k.box(g,.011,.005,.017,metal,x-w*.3+i*w*.2,.029+hh,z);
 }
 // Glass cultivation / research galleries, with visible structural ribs.
 for(const x of [-.25,-.17]){
  k.box(g,.065,.012,.083,white,x,.027,.012);
  const greenGlass=new T.MeshPhysicalMaterial({color:'#99b7b5',roughness:.13,metalness:.05,transmission:.45,thickness:.001,transparent:true,opacity:.76,side:T.DoubleSide});
  const roof=k.mesh(g,new T.CylinderGeometry(.032,.032,.085,32,1,true,0,Math.PI),greenGlass,x,.034,.012);roof.rotation.z=Math.PI/2;roof.rotation.y=Math.PI/2;roof.userData.noBake=true;roof.castShadow=false;
  for(const side of [-1,1]){const end=k.mesh(g,new T.CircleGeometry(.032,32,0,Math.PI),greenGlass,x,.034,.012+side*.0425);end.userData.noBake=true;end.castShadow=false;}
  for(let j=0;j<11;j++){const rib=k.mesh(g,new T.TorusGeometry(.032,.0007,5,24,Math.PI),metal,x,.034,-.029+j*.0083);}
  for(let j=0;j<18;j++)k.tree(g,x+(hash(j,1)-.5)*.05,-.020+hash(j,3)*.066,.14,.032);
 }
 road(g,0,-.08,.032,.36,k,p.stone,.024);road(g,.11,.027,.29,.025,k,p.stone,.024);
 quay(g,.08,.107,.29,.025,k,p,.024);for(let i=0;i<22;i++){const x=-.058+i*.013;k.cyl(g,.00065,.012,metal,x,.031,.122,8);if(i<21)k.beam(g,[x,.037,.122],[x+.013,.037,.122],.00045,metal);}
 for(let i=0;i<12;i++){const x=.27+(i%3)*.039,z=-.30+Math.floor(i/3)*.06;house(g,x,z,.031,.039,.033,0,k,p,{y:.022});}
 for(let i=0;i<10;i++)k.tree(g,-.31+i*.063,.067,.55,.021);for(let i=0;i<22;i++)k.person(g,-.08+hash(i,7)*.30,.09,.025);
 // Inland cargo pontoons and a modest transfer crane; no ocean harbour identity.
 for(const x of [.0,.11]){k.box(g,.032,.009,.085,p.steel,x,.004,.185);k.box(g,.028,.002,.076,p.wood,x,.010,.185);crates(g,x-.01,.164,8,k,p,.012);}
 crane(g,.18,.09,k,p,.65);
 lakeContext(g,k,p,h);
 const ecology=scatterEcology(g,{height:h,bounds:[-.70,.70,-.72,.40],count:900,exclude:(x,z)=>x>-.40&&x<.46&&z>-.40&&z<.24,seed:11});
 return {views:{street:{eye:[.23,.17,.34],target:[-.05,.045,-.06]}},focus:.060,eye:[.53,.41,.73],light:[-1.7,2.4,1.3],meta:{...ecology,sceneType:'landlocked lake research/workshop district',piercedFacades:true,scope:'representative district; no seaport'},environment:env=>reflectiveSea(env,k,h)};
}
function marketStall(g,x,z,k,p,color){const q=new T.Group();q.position.set(x,.027,z);g.add(q);for(const a of [-1,1])for(const b of [-1,1])k.cyl(q,.0005,.014,p.wood,a*.009,.007,b*.005,6);const fabric=new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide});const roof=k.box(q,.022,.0006,.014,fabric,0,.016,0);roof.rotation.x=.13;k.box(q,.020,.0015,.008,p.wood,0,.006,0);for(let i=0;i<5;i++)k.mesh(q,new T.SphereGeometry(.0015,6,4),i%2?p.cream:p.brick,-.008+i*.004,.008,0);}
function falota(g,k,p){
 const edge=x=>.10+Math.sin(x*7)*.018;
 const h=(x,z)=>T.MathUtils.lerp(-.055,.022+Math.min(.18,Math.max(0,-z-.23)*.22),smooth(-.025,.010,edge(x)-z));
 gridGround(g,k,h,(x,z,y)=>new T.Color(y<0?'#786f58':z<-.27?'#738063':'#868273'),3.6,320);
 road(g,0,-.01,.68,.042,k,p.stone,.024);road(g,-.06,-.13,.032,.29,k,p.stone,.024);
 for(let i=0;i<8;i++){
  const x=-.30+i*.084;house(g,x,.047,.071,.063,.052+(i%2)*.013,0,k,{...p,plaster:i%3?p.brick:p.plaster,roof:i%3===1?p.dark:p.roof},{y:.023,floors:3});
  const door=k.box(g,.024,.025,.0013,p.dark,x,.036,.080);for(const sign of [-1,1])k.box(g,.002,.027,.0018,p.wood,x+sign*.013,.037,.081);
 }
 for(let row=0;row<3;row++)for(let i=0;i<9;i++){
  const x=-.31+i*.076+(row%2)*.009,z=-.086-row*.073,w=.045+hash(i,row)*.013;
  house(g,x,z,w,.052,.030+hash(i,7+row)*.031,(hash(i,row)-.5)*.12,k,p,{y:h(x,z)+.001,open:row===0,floors:2});
 }
 quay(g,0,.116,.72,.078,k,p,.026);for(const x of [-.24,.19]){quay(g,x,.20,.055,.16,k,p,.022);crane(g,x,.185,k,p,.9);crates(g,x-.018,.15, 12,k,p,.024);}
 for(let i=0;i<10;i++)marketStall(g,-.29+i*.061,-.016,k,p,i%2?'#ae9373':'#668783');
 for(let i=0;i<26;i++)barrel(g,-.31+hash(i,8)*.62,.027,.111+hash(i,3)*.025,k,p);
 k.boat(g,-.29,.23,1.05,.05);k.boat(g,.245,.26,1.3,.1);k.boat(g,.02,.19,.9,Math.PI/2);
 for(let i=0;i<12;i++){const x=-.3+i*.055;k.lamp(g,x,.112,.026);crates(g,x,-.035,3,k,p,.026);}
 for(let i=0;i<55;i++)k.person(g,-.32+hash(i,2)*.65,-.036+hash(i,4)*.18,.027);
 for(let i=0;i<36;i++){const x=-.41+hash(i,30)*.82,z=-.34-hash(i,16)*.12;k.tree(g,x,z,.55+hash(i,13)*.3,h(x,z));}
 harbourContext(g,k,p,h);
 const ecology=scatterEcology(g,{height:h,bounds:[-.70,.70,-.72,.40],count:900,exclude:(x,z)=>x>-.41&&x<.43&&z>-.39&&z<.29,seed:61});
 return {views:{street:{eye:[.27,.14,.44],target:[0,.049,.083]}},focus:.073,eye:[.50,.40,.79],light:[-1.7,1.6,1.0],meta:{...ecology,sceneType:'working coastal harbour and market streets',piercedFacades:true,scope:'secondary place; no independent coordinates'},environment:env=>reflectiveSea(env,k,h)};
}
function shiomi(g,k,p){
 const edge=x=>.075+Math.sin(x*10)*.015;
 const h=(x,z)=>z>edge(x)?T.MathUtils.lerp(.017,-.045,smooth(0,.20,z-edge(x))):.017+Math.min(.22,Math.max(0,-z-.15)*.24);
 gridGround(g,k,h,(x,z,y)=>new T.Color(y<.012?'#9c9075':z<-.26?'#596f4b':'#8a8973'),3.6,320);
 const timber={...p,roof:material(k,'#4b6268','roof'),wood:material(k,'#765d46','wood'),plaster:material(k,'#bdb69b')};
 // The narrow shopping street follows the sloped terrain (townContext).
 for(const side of [-1,1])for(let i=0;i<8;i++){
  const x=-.05+side*(.064+hash(i,2)*.008),z=.055-i*.048;house(g,x,z,.039,.035,.027+hash(i,side)*.014,side*Math.PI/2,k,timber,{y:h(x,z)+.001,timber:true,curved:true,open:i<4,floors:1});
 }
 for(let i=0;i<9;i++){const x=.14+(i%3)*.052,z=-.01-Math.floor(i/3)*.062;house(g,x,z,.037,.035,.029+(i%3)*.004,0,k,timber,{y:h(x,z)+.001,timber:true,curved:true,floors:2});}
 // Small shrine above the street, with a forest approach rather than a monumental palace.
 const sx=.15,sz=-.28,sy=h(sx,sz);k.box(g,.095,.007,.074,p.stone,sx,sy+.003,sz);house(g,sx,sz,.073,.051,.037,0,k,timber,{y:sy+.008,timber:true,curved:true,floors:1});
 for(let i=0;i<16;i++)k.box(g,.031,.002,.003,p.stone,sx,sy-.018+i*.0015,sz+.082-i*.003);
 const vermilion=new T.MeshStandardMaterial({color:'#864e38',roughness:.82});for(const sign of [-1,1]){k.cyl(g,.0018,.041,vermilion,sx+sign*.018,sy+.02,sz+.067,12);k.box(g,.009,.003,.008,p.stone,sx+sign*.018,sy,sz+.067);}k.box(g,.053,.003,.004,vermilion,sx,sy+.039,sz+.067);k.box(g,.064,.003,.006,p.dark,sx,sy+.045,sz+.067);
 quay(g,-.07,.149,.040,.179,k,p,.016);k.boat(g,-.102,.222,.86,.1);k.boat(g,.014,.205,.55,Math.PI/2);
 for(let i=0;i<7;i++)marketStall(g,.065+i*.030,.054,k,timber,i%2?'#b9ab84':'#667f85');
 for(let i=0;i<13;i++)k.lamp(g,-.048,.057-i*.023,h(-.048,.057-i*.023)+.001);
 for(let i=0;i<115;i++){const x=(hash(i,7)-.5)*.85,z=-.19-hash(i,15)*.31;if(Math.abs(x-sx)<.080&&Math.abs(z-sz)<.07||Math.abs(x+.05)<.13&&z>-.33)continue;k.tree(g,x,z,.55+hash(i,41)*.55,h(x,z),i%3===0);}
 for(let i=0;i<24;i++)k.person(g,-.047+(hash(i,9)-.5)*.035,.04-hash(i,18)*.27,h(-.047,.04-hash(i,18)*.27)+.001);
 townContext(g,k,p,h);
 const ecology=scatterEcology(g,{height:h,bounds:[-.70,.70,-.72,.40],count:900,exclude:(x,z)=>x>-.23&&x<.34&&z>-.37&&z<.18,seed:31});
 return {views:{street:{eye:[-.15,.100,.17],target:[-.055,.036,-.11]}},focus:.062,eye:[.50,.36,.71],light:[-1.9,2.6,.9],meta:{...ecology,sceneType:'tidal port town, narrow shops and small shrine',piercedFacades:true,scope:'secondary place; no independent coordinates'},environment:env=>reflectiveSea(env,k,h)};
}
export function createRegionalScene(g,key,kit){const p=palette(kit);const builders={12:iron,11:xuanji,falota,shiomi};if(!builders[key])throw Error('Unknown regional scene: '+key);return builders[key](g,kit,p);}
