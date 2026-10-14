import * as T from 'three';
// Interpretive miniatures, not surveyed architecture. Local Y is the surface normal.
let seed=5471;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const mat=(color,roughness=.85,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
const stone=mat('#bdc1b0'),darkStone=mat('#535e63'),roof=mat('#425e66',.56,{metalness:.18}),gold=mat('#bca36b',.4,{metalness:.62}),wood=mat('#76654b'),foliage=mat('#365b46');
const glow=mat('#ffdb96',.35,{emissive:'#ffbc5f',emissiveIntensity:2.2});
function mesh(g,geo,m,x=0,y=0,z=0){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
const box=(g,w,h,d,m,x,y,z)=>mesh(g,new T.BoxGeometry(w,h,d),m,x,y,z);
const cyl=(g,r,h,m,x,y,z,n=20)=>mesh(g,new T.CylinderGeometry(r,r,h,n),m,x,y,z);
function line(g,points,color,width=.0015){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(g,new T.TubeGeometry(path,48,width,5,false),new T.MeshBasicMaterial({color,transparent:true,opacity:.8}));}
function island(g,r=.15,y=0){const vs=[],cs=[],indices=[];const n=60;const palette=[new T.Color('#334952'),new T.Color('#6b7773'),new T.Color('#909889'),new T.Color('#5d7956')];
 for(let k=0;k<4;k++)for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const jitter=1+.08*Math.sin(i*1.9)+.06*Math.sin(i*.6);const radii=[.68,1,.94,.72];const heights=[-.04,0,.018,.035];vs.push(Math.cos(a)*r*jitter*radii[k],y+heights[k]+rnd()*.004,Math.sin(a)*r*jitter*radii[k]);cs.push(...palette[k].toArray())}
 vs.push(0,y+.034,0);cs.push(...palette[3].toArray());for(let k=0;k<3;k++)for(let i=0;i<n;i++){const a=k*n+i,b=k*n+(i+1)%n,c=(k+1)*n+i,d=(k+1)*n+(i+1)%n;indices.push(a,c,b,b,c,d)}for(let i=0;i<n;i++)indices.push(3*n+i,4*n,3*n+(i+1)%n);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vs,3));geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(g,geo,mat('#ffffff',.95,{vertexColors:true}));}
function tree(g,x,z,s=1,y=.04){cyl(g,.0014*s,.018*s,wood,x,y+.009*s,z,5);mesh(g,new T.ConeGeometry(.009*s,.035*s,7),foliage,x,y+.028*s,z);}
function hall(g,x,z,w=.06,d=.035,h=.035,y=.04){box(g,w,h,d,stone,x,y+h/2,z);const cap=mesh(g,new T.ConeGeometry(1,1,4),roof,x,y+h+.010,z);cap.scale.set(w*.75,.023,d*.8);cap.rotation.y=Math.PI/4;for(let i=0;i<3;i++)box(g,.004,.009,.0007,glow,x-w*.3+i*w*.3,y+h*.62,z+d*.503);}
function dome(g,x,z,r=.026,y=.04){cyl(g,r,.035,stone,x,y+.018,z,24);mesh(g,new T.SphereGeometry(r*1.06,24,14,0,Math.PI*2,0,Math.PI/2),roof,x,y+.035,z);cyl(g,.0014,.021,gold,x,y+.073,z,8);}
function lamp(g,x,z,y=.04){cyl(g,.001,.018,darkStone,x,y+.009,z,6);mesh(g,new T.SphereGeometry(.0024,7,5),glow,x,y+.020,z);}
function arch(g,x,z,angle=0){const a=new T.Group();a.position.set(x,.04,z);a.rotation.y=angle;g.add(a);for(const t of [-1,1])cyl(a,.002,.022,stone,t*.012,.011,0,8);mesh(a,new T.TorusGeometry(.012,.002,6,18,Math.PI),stone,0,.022,0);}
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d'),r=x.createRadialGradient(48,48,0,48,48,48);r.addColorStop(0,'rgba(205,231,240,.52)');r.addColorStop(.35,'rgba(130,176,203,.14)');r.addColorStop(1,'rgba(80,120,180,0)');x.fillStyle=r;x.fillRect(0,0,96,96);return new T.CanvasTexture(c)}
const fogTex=glowTexture();function mist(g,x,y,z,size=.15,color='#aedee4'){const s=new T.Sprite(new T.SpriteMaterial({map:fogTex,color,transparent:true,opacity:.32,depthWrite:false}));s.position.set(x,y,z);s.scale.set(size,size*.5,1);g.add(s);return s;}
function particles(g,n,color,spread,height){const a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=(rnd()-.5)*spread;a[i*3+1]=rnd()*height+.04;a[i*3+2]=(rnd()-.5)*spread}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(a,3));const pts=new T.Points(geo,new T.PointsMaterial({color,size:.0022,transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending}));g.add(pts);return pts;}
function academy(g){island(g,.18);hall(g,0,-.06,.105,.04,.037);hall(g,-.07,.007,.035,.085,.026);hall(g,.07,.007,.035,.085,.026);dome(g,0,-.062,.026,.078);
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;arch(g,Math.cos(a)*.044,Math.sin(a)*.036+.013,-a+Math.PI/2)}
 cyl(g,.018,.002,darkStone,0,.043,.012);for(let i=0;i<3;i++){const ring=mesh(g,new T.TorusGeometry(.012,.0009,6,40),gold,0,.065,.012);ring.rotation.set(i*.7,i*.9,.4)}
 box(g,.034,.007,.14,wood,-.11,.026,.17);for(const x of [-.125,-.095])for(const z of [.13,.2])cyl(g,.002,.047,wood,x,.017,z,8);
 for(let i=0;i<19;i++){const a=rnd()*Math.PI*2;tree(g,Math.cos(a)*(.125+rnd()*.02),Math.sin(a)*(.1+rnd()*.035),.7+rnd()*.6)}
 for(const x of [-.044,.044])for(const z of [-.08,.04,.08])lamp(g,x,z);
 // Unflagged small sailing craft.
 const boat=new T.Group();g.add(boat);boat.position.set(-.155,.008,.195);box(boat,.014,.007,.036,wood,0,0,0);cyl(boat,.0008,.034,wood,0,.018,0,5);const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute([0,.033,0,0,.007,0,.017,.007,0],3));sail.computeVertexNormals();mesh(boat,sail,mat('#d9d5bf',1,{side:T.DoubleSide}));
 const light=new T.PointLight('#ffcf81',.13,.45,2);light.position.set(0,.10,0);g.add(light);return {boat};}
function archipelago(g){const clusters=[[-.11,-.07,.083],[.1,-.08,.07],[-.13,.1,.065],[.14,.08,.057],[.015,.18,.048],[.02,-.17,.051],[-.2,0,.035]];
 for(const[x,z,r]of clusters){const a=new T.Group();a.position.set(x,0,z);g.add(a);island(a,r);for(let j=0;j<7;j++){const angle=rnd()*6.28,rad=rnd()*r*.7;tree(a,Math.cos(angle)*rad,Math.sin(angle)*rad,.45+rnd()*.5)}if(r>.075)hall(a,0,0,.035,.025,.02);}
 const points=[[.022,.012,.018],[-.01,.07,.005],[.017,.116,-.006],[-.018,.163,.008],[.008,.215,0],[-.016,.27,-.014],[.016,.326,-.018]];
 line(g,points,'#cb9cf6',.0038);line(g,points.map(p=>[p[0]+.006,p[1],p[2]-.002]),'#88f9ef',.0012);
 const edge=line(g,points.map(p=>[p[0]-.005,p[1],p[2]+.004]),'#fbf0ff',.0008);
 const fog=[];for(let i=0;i<10;i++)fog.push(mist(g,(rnd()-.5)*.4,.032+rnd()*.05,(rnd()-.5)*.35,.17,'#a5d3d6'));
 const light=new T.PointLight('#88baff',.2,.8,2);light.position.set(0,.14,0);g.add(light);return {fog,edge,dust:particles(g,170,'#b2deff',.2,.31)};}
function mountain(g){const n=72,vs=[],cols=[],ind=[];for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const xx=(x/n-.5)*.42,zz=(z/n-.5)*.42;const a=Math.atan2(zz,xx),r=Math.hypot(xx,zz);const peak=.28*Math.exp(-Math.pow(r/.07,1.35));const ridges=(.010*Math.sin(a*11+r*75)+.008*Math.cos(xx*145+zz*51))*Math.exp(-r*8);const h=Math.max(.003,peak+ridges);vs.push(xx,h,zz);const c=new T.Color(h>.14+(Math.sin(a*7)*.009)?'#dee8e6':h>.055?'#7b8786':'#405b55');c.multiplyScalar(.86+rnd()*.22);cols.push(...c.toArray())}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x;ind.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2)}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vs,3));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.setIndex(ind);geo.computeVertexNormals();mesh(g,geo,mat('#ffffff',.96,{vertexColors:true}));
 const fog=[];for(let i=0;i<7;i++)fog.push(mist(g,(rnd()-.5)*.25,.09+rnd()*.06,(rnd()-.5)*.2,.27));
 const aurora=[];for(let j=0;j<3;j++){const pts=[];for(let i=0;i<8;i++){const t=i/7;pts.push([-.12+t*.24,.32+Math.sin(t*4+j)*.026+j*.013,-.03+Math.cos(t*3+j)*.03])}aurora.push(line(g,pts,j===1?'#a7cedf':'#b6b1d9',.0006));}return {fog,aurora,dust:particles(g,200,'#e1f2f4',.27,.27)};}
function city(g){island(g,.205);cyl(g,.166,.006,darkStone,0,.043,0,64);cyl(g,.157,.007,stone,0,.048,0,64);
 const paving=mat('#748482');box(g,.017,.001,.28,paving,0,.054,0);box(g,.28,.001,.017,paving,0,.054,0);
 for(let i=0;i<30;i++){const a=i/30*Math.PI*2,r=.142;const o=box(g,.032,.019,.008,stone,Math.cos(a)*r,.06,Math.sin(a)*r);o.rotation.y=-a+Math.PI/2;if(i%5===0)cyl(g,.009,.041,stone,Math.cos(a)*r,.071,Math.sin(a)*r,8)}
 hall(g,0,-.052,.096,.037,.038,.055);dome(g,0,-.05,.031,.096);hall(g,-.054,0,.033,.064,.024,.055);hall(g,.054,0,.033,.064,.024,.055);
 for(let i=0;i<15;i++){const a=i/15*Math.PI*2;const r=.095+rnd()*.015;hall(g,Math.cos(a)*r,Math.sin(a)*r,.018+rnd()*.008,.020,.018+rnd()*.02,.055)}
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;arch(g,Math.cos(a)*.039,Math.sin(a)*.031+.038,-a+Math.PI/2);lamp(g,Math.cos(a)*.076,Math.sin(a)*.076,.054)}
 const arm=new T.Group();g.add(arm);arm.position.set(0,.086,.038);for(let i=0;i<3;i++){const r=mesh(arm,new T.TorusGeometry(.017,.001,7,40),gold);r.rotation.set(i*.9,i*.6,0)}mesh(arm,new T.SphereGeometry(.006,12,8),roof);for(let i=0;i<14;i++){const a=rnd()*6.28;tree(g,Math.cos(a)*.174,Math.sin(a)*.174,.65,.037)}return {arm};}
export function createLandmark(id){const group=new T.Group();group.name='landmark-'+id;const builders={900:academy,901:archipelago,902:mountain,9:city};const bits=builders[id](group);return {group,update(t){if(bits.boat){bits.boat.rotation.z=Math.sin(t*.7)*.035;bits.boat.position.y=.008+Math.sin(t)*.0015}if(bits.edge)bits.edge.material.opacity=.55+Math.sin(t*1.4)*.18;if(bits.arm)bits.arm.rotation.y=t*.06;if(bits.dust)bits.dust.rotation.y=t*.025;if(bits.fog)bits.fog.forEach((s,i)=>{s.material.opacity=.20+Math.sin(t*.25+i)*.07;s.position.x+=Math.sin(t*.25+i)*.000015});}}}
