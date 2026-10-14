import * as T from 'three';
import { reflectiveSea } from './archipelago-hq.js?v=5';
import { gridGround, palette, lane } from './regional-scenes.js?v=5';
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
function height(x,z){
 const r=Math.hypot(x,z),angle=Math.atan2(z,x),edge=.49+.027*Math.sin(angle*5)+.023*Math.cos(angle*9);
 const hill=.29*Math.exp(-((x+.04)**2*26+(z+.36)**2*38));
 const ridge=(Math.sin(x*57+Math.sin(z*23))*Math.sin(z*61))*.009;
 const land=.042+hill*smooth(.20,.29,r)+ridge*smooth(.24,.31,r);
 return T.MathUtils.lerp(-.055,land,1-smooth(edge-.07,edge+.03,r));
}
function ring(g,k,m,inner,outer,bottom,h,start,end){
 const s=new T.Shape(),n=160;
 for(let i=0;i<=n;i++){const a=T.MathUtils.lerp(start,end,i/n),x=Math.sin(a)*outer,y=-Math.cos(a)*outer;i?s.lineTo(x,y):s.moveTo(x,y);}
 for(let i=n;i>=0;i--){const a=T.MathUtils.lerp(start,end,i/n);s.lineTo(Math.sin(a)*inner,-Math.cos(a)*inner);}s.closePath();
 const o=k.mesh(g,new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:24}),m,0,bottom,0);o.rotation.x=-Math.PI/2;return o;
}
function roofRing(g,k,p,inner,outer,y,start,end){
 const pos=[],uv=[],idx=[],n=160,rs=[inner,(inner+outer)/2,outer];
 for(let i=0;i<=n;i++){const a=T.MathUtils.lerp(start,end,i/n);for(let j=0;j<3;j++){pos.push(Math.sin(a)*rs[j],y+(j===1?.018:0),Math.cos(a)*rs[j]);uv.push(i*.14,j*2);}if(i<n){const b=i*3;idx.push(b,b+3,b+1,b+1,b+3,b+4,b+1,b+4,b+2,b+2,b+4,b+5);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();p.roof.side=T.DoubleSide;k.mesh(g,geo,p.roof);
 for(const a of [start,end]){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([Math.sin(a)*inner,y,Math.cos(a)*inner,Math.sin(a)*(inner+outer)/2,y+.018,Math.cos(a)*(inner+outer)/2,Math.sin(a)*outer,y,Math.cos(a)*outer],3));geo.computeVertexNormals();p.cream.side=T.DoubleSide;k.mesh(g,geo,p.cream);}
 for(let i=0;i<=90;i++){const a=T.MathUtils.lerp(start,end,i/90);k.beam(g,[Math.sin(a)*inner,y,Math.cos(a)*inner],[Math.sin(a)*(inner+outer)/2,y+.018,Math.cos(a)*(inner+outer)/2],.00035,p.steel);k.beam(g,[Math.sin(a)*(inner+outer)/2,y+.018,Math.cos(a)*(inner+outer)/2],[Math.sin(a)*outer,y,Math.cos(a)*outer],.00035,p.steel);}
}
export function createAcademyHillside(g,k){
 const p=palette(k),start=.17*Math.PI,end=1.83*Math.PI;
 gridGround(g,k,height,(x,z,h)=>{const slope=Math.hypot(height(x+.001,z)-h,height(x,z+.001)-h)/.001;return new T.Color(h<.008?'#9b9b85':slope>1.6?'#a0a18c':'#6e8056').multiplyScalar(.90+hash(Math.floor(x*130),Math.floor(z*130))*.12);},1.45,300);
 // Three circular retaining terraces cut into the mountain's lower slope.
 for(let i=0;i<3;i++)k.cyl(g,.246-i*.008,.024,p.stone,0,.044+i*.023,0,160);
 k.cyl(g,.231,.003,p.cream,0,.104,0,160);
 ring(g,k,p.cream,.158,.222,.105,.053,start,end);
 ring(g,k,p.stone,.156,.225,.105,.004,start,end);
 ring(g,k,p.stone,.157,.224,.131,.002,start,end);
 roofRing(g,k,p,.150,.232,.159,start,end);
 // Continuous inner arcaded cloister and complete curved outer facades.
 for(let i=0;i<56;i++){
  const a=T.MathUtils.lerp(start+.03,end-.03,i/55),q=new T.Group();q.rotation.y=a;g.add(q);
  for(const side of [-1,1]){
   const face=new T.Group();face.rotation.y=side<0?Math.PI:0;q.add(face);const r=side<0?-.158:.223;
   for(const y of [.119,.145]){k.box(face,.008,.013,.0007,p.dark,0,y,r);k.box(face,.0006,.014,.0013,p.cream,0,y,r+.0007);k.box(face,.010,.0012,.002,p.cream,0,y-.007,r+.001);}
  }
  k.cyl(q,.0013,.028,p.cream,0,.119,.143,10);k.mesh(q,new T.TorusGeometry(.007,.0012,6,16,Math.PI),p.cream,0,.133,.143);
  k.box(q,.0012,.048,.002,p.stone,.009,.132,.225);
 }
 ring(g,k,p.stone,.136,.158,.103,.002,start,end);ring(g,k,p.cream,.139,.155,.142,.002,start,end);
 // Circular garden, lecture steps and radial paths remain open in the centre.
 k.cyl(g,.119,.002,p.ground,0,.107,0,100);
 ring(g,k,p.stone,.108,.120,.108,.001,0,Math.PI*2);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,q=new T.Group();q.rotation.y=a;g.add(q);k.box(q,.012,.001,.087,p.cream,0,.109,.071);if(i%2===0)for(let j=0;j<3;j++){k.tree(q,-.031+j*.03,.083,.32,.109);}}
 k.cyl(g,.036,.003,p.stone,0,.109,0,80);k.cyl(g,.029,.002,p.glass,0,.111,0,80);
 for(let j=0;j<3;j++)ring(g,k,p.cream,.052+j*.008,.059+j*.008,.109+j*.003,.003,.68*Math.PI,1.32*Math.PI);
 // Main entry sits on the front of the ring, with an actual open passage.
 for(const x of [-.038,.038]){
  k.cyl(g,.022,.059,p.cream,x,.135,.197,40);k.cyl(g,.023,.003,p.stone,x,.164,.197,40);k.mesh(g,new T.ConeGeometry(.026,.018,40),p.roof,x,.175,.197);
  for(const dx of [-.007,.007])k.box(g,.005,.014,.001,p.dark,x+dx,.141,.218);
 }
 k.mesh(g,new T.TorusGeometry(.025,.003,8,40,Math.PI),p.cream,0,.115,.215);
 k.box(g,.068,.017,.016,p.cream,0,.151,.202);
 // The circled A is solid raised geometry on the gateway, not a caption or decal.
 const emblem=new T.MeshStandardMaterial({color:'#8b302a',roughness:.63,metalness:.20});
 k.mesh(g,new T.CircleGeometry(.022,64),p.cream,0,.162,.212);
 k.torus(g,.018,.0017,emblem,0,.162,.214);
 k.beam(g,[-.012,.148,.215],[0,.178,.215],.0012,emblem);k.beam(g,[0,.178,.215],[.012,.148,.215],.0012,emblem);k.beam(g,[-.011,.158,.215],[.011,.158,.215],.0011,emblem);
 for(let j=0;j<24;j++)k.box(g,.047,.0025,.0045,p.cream,0,.104-j*.0025,.211+j*.0045);
 lane(g,[[0,.315],[.09,.35],[.23,.31],[.34,.22]],.016,height,k,p.stone);
 // A second, smaller circular study terrace higher on the slope.
 const annex=new T.Group();annex.position.set(-.10,height(-.10,-.315)+.008,-.315);g.add(annex);k.cyl(annex,.053,.050,p.stone,0,-.015,0,64);ring(annex,k,p.cream,.033,.049,.008,.032,0,Math.PI*2);roofRing(annex,k,p,.030,.054,.040,0,Math.PI*2);
 for(let i=0;i<22;i++){const a=i/22*Math.PI*2,q=new T.Group();q.rotation.y=a;annex.add(q);k.box(q,.006,.016,.001,p.dark,0,.025,.049);}
 lane(g,[[-.20,-.12],[-.26,-.21],[-.22,-.31],[-.10,-.32]],.012,height,k,p.stone);
 let trees=0;for(let i=0;i<600;i++){const x=(hash(i,6)-.5)*1.02,z=(hash(i,11)-.5)*1.03,r=Math.hypot(x,z),h=height(x,z);if(r<.265||h<.020||Math.hypot(x+.10,z+.315)<.07||Math.abs(x)<.034&&z>.20)continue;const slope=Math.hypot(height(x+.001,z)-h,height(x,z+.001)-h)/.001;if(slope>2)continue;k.tree(g,x,z,.55+hash(i,81)*.7,h,i%4===0);trees++;}
 for(let i=0;i<40;i++){const a=hash(i,88)*Math.PI*2,r=.078+hash(i,22)*.05;k.person(g,Math.sin(a)*r,Math.cos(a)*r,.109);}
 for(let i=0;i<15;i++){const a=T.MathUtils.lerp(start,end,i/14);k.lamp(g,Math.sin(a)*.136,Math.cos(a)*.136,.105);}
 k.boat(g,.34,.28,.9,.6);
 return {focus:.145,eye:[.50,.40,.70],light:[-1.7,2.3,1.4],views:{street:{eye:[.12,.25,.45],target:[0,.14,.12]}},meta:{sceneType:'circular hillside academy',circledA:true,trees},environment:env=>reflectiveSea(env,k,height)};
}
