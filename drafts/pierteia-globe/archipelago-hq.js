import * as T from 'three';
import { finish } from './world-finish.js?v=9';
import { scatterEcology } from './ecology.js?v=9';
import { Water } from 'three/addons/objects/Water.js';

// An interpretive local scene tied to the existing marker, not a new map.
// All dimensions are visual scene units. No new official names or jurisdictions.
const TAU = Math.PI * 2;
const clamp = T.MathUtils.clamp;
const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const fract = x => x - Math.floor(x);
const hash = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let a = fract(x), b = fract(z); a = a*a*(3-2*a); b = b*b*(3-2*b);
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),a),T.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),a),b);
}
function fbm(x,z) { return noise(x,z)*.53+noise(x*2.07,z*2.07)*.27+noise(x*4.31,z*4.31)*.13+noise(x*8.67,z*8.67)*.07; }

const islands = [
  {x:-.245,z:-.025,sx:.145,sz:.248,angle:-.38,h:.090,seed:2},
  {x:.222,z:-.140,sx:.145,sz:.178,angle:.58,h:.112,seed:7},
  {x:.189,z:.223,sx:.169,sz:.077,angle:-.35,h:.065,seed:11},
  {x:-.035,z:-.338,sx:.126,sz:.065,angle:.12,h:.057,seed:17},
  {x:-.105,z:.267,sx:.076,sz:.104,angle:-.6,h:.045,seed:23},
  {x:.358,z:.037,sx:.050,sz:.066,angle:.2,h:.042,seed:29},
  {x:-.401,z:.210,sx:.034,sz:.047,angle:.4,h:.030,seed:37}
];
function islandSample(x,z,s) {
  const dx=x-s.x,dz=z-s.z,cs=Math.cos(s.angle),sn=Math.sin(s.angle);
  const px=(dx*cs+dz*sn)/s.sx,pz=(-dx*sn+dz*cs)/s.sz;
  const a=Math.atan2(pz,px);
  const contour=1+.15*Math.sin(a*3+s.seed)+.075*Math.sin(a*7+s.seed*.7)+.035*Math.sin(a*13);
  // Local inlet variation breaks the old repeated circular-island silhouette.
  const inlet=.19*Math.exp(-Math.pow((Math.sin(a+.6+s.seed)*.5+.5)/.20,2));
  const r=Math.hypot(px,pz)/(contour-inlet);
  const shelf=-.002-(r-1)*.14;
  if(r>1) return Math.max(-.065,shelf);
  const plateau=s.h*(.61+.23*fbm(px*3+s.seed,pz*3))*smooth(1.025,.82,r);
  const crest=s.h*.45*Math.exp(-((px+.16)**2*4+(pz+.23)**2*2));
  const grain=(fbm(x*165+s.seed,z*165)-.5)*.007;
  return Math.max(-.003,plateau+crest+grain*smooth(1,.91,r));
}
export function islandHeightHQ(x,z) {
  let h=-.065;
  for(const s of islands) h=Math.max(h,islandSample(x,z,s));
  return h;
}

function terrain(g, kit) {
  const segments=640, span=1.13, count=(segments+1)**2;
  const pos=new Float32Array(count*3),col=new Float32Array(count*3),uv=new Float32Array(count*2);
  const idx=new Uint32Array(segments*segments*6);
  const rock=new T.Color('#a39f90'),wet=new T.Color('#4b5952'),grass=new T.Color('#74845a'),sand=new T.Color('#beb29a');
  let k=0;
  for(let z=0;z<=segments;z++)for(let x=0;x<=segments;x++) {
    const xx=(x/segments-.5)*span,zz=(z/segments-.5)*span,h=islandHeightHQ(xx,zz),i=z*(segments+1)+x;
    const slope=Math.hypot(islandHeightHQ(xx+.0006,zz)-h,islandHeightHQ(xx,zz+.0006)-h)/.0006;
    const growth=smooth(.012,.060,h)*(1-smooth(.45,1.8,slope));
    const c=rock.clone().lerp(grass,growth*.95).lerp(wet,(1-smooth(-.001,.016,h))*.7);
    if(h<.015&&slope<.8)c.lerp(sand,.45);
    const strata=Math.sin(h*970+fbm(xx*90,zz*90)*4)*.06;
    c.multiplyScalar(.97+noise(xx*29,zz*29)*.07+strata*(1-growth)*.25);
    pos.set([xx,h,zz],i*3);col.set([c.r,c.g,c.b],i*3);uv.set([xx*54,zz*54],i*2);
    if(x<segments&&z<segments){const a=i,b=i+segments+1;idx.set([a,b,a+1,a+1,b,b+1],k);k+=6;}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('color',new T.BufferAttribute(col,3));geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setIndex(new T.BufferAttribute(idx,1));geo.computeVertexNormals();
  const mat=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,map:kit.maps.rock.map,normalMap:kit.maps.rock.normal,normalScale:new T.Vector2(.9,.9),roughness:.92});
  finish(mat,'terrain');
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.noBake=true;g.add(mesh);
  return {segments,terrainTriangles:segments*segments*2};
}

function heightTexture(sampleHeight=islandHeightHQ) {
  const n=1024,a=new Uint8Array(n*n*4);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const h=sampleHeight((x/(n-1)-.5)*1.3,(z/(n-1)-.5)*1.3),i=(z*n+x)*4;
    const encoded=Math.round(clamp((h+.065)/.23,0,1)*65535);
    a[i]=encoded>>8;a[i+1]=encoded&255;a[i+2]=0;a[i+3]=255;
  }
  const t=new T.DataTexture(a,n,n);t.needsUpdate=true;t.magFilter=t.minFilter=T.LinearFilter;return t;
}

export function reflectiveSea(env, kit, sampleHeight=islandHeightHQ) {
  const water=new Water(new T.PlaneGeometry(10,10,128,128),{
    textureWidth:1024,textureHeight:1024,waterNormals:kit.maps.water.normal,
    alpha:1,clipBias:.00005,distortionScale:.002,waterColor:'#153f49',sunColor:'#ffebc9',fog:true
  });
  water.rotation.x=-Math.PI/2;water.position.y=-.001;water.renderOrder=1;
  const m=water.material;m.uniforms.depthField={value:heightTexture(sampleHeight)};
  m.vertexShader=`
    uniform mat4 textureMatrix;
    varying vec4 mirrorCoord;
    varying vec3 vWorld;
    varying vec2 vPlane;
    varying mat3 waterBasis;
    #include <common>
    #include <fog_pars_vertex>
    void main(){
      vPlane=vec2(position.x,-position.y);
      vec4 world=modelMatrix*vec4(position,1.);
      vWorld=world.xyz;mirrorCoord=textureMatrix*world;
      waterBasis=mat3(modelMatrix);
      vec4 mvPosition=modelViewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }
  `;
  m.fragmentShader=`
    uniform sampler2D mirrorSampler,normalSampler,depthField;
    uniform float time;
    uniform vec3 eye;
    varying vec4 mirrorCoord;
    varying vec3 vWorld;
    varying vec2 vPlane;
    varying mat3 waterBasis;
    #include <common>
    #include <fog_pars_fragment>
    void main(){
      vec2 p=vPlane;
      vec3 a=texture2D(normalSampler,p*12.+vec2(time*.006,time*.004)).xyz*2.-1.;
      vec3 b=texture2D(normalSampler,mat2(.8,-.6,.6,.8)*p*31.+vec2(-time*.003,time*.005)).xyz*2.-1.;
      vec3 localN=normalize(vec3(a.xy*.075+b.xy*.04,1.));
      vec3 N=normalize(waterBasis*localN),V=normalize(eye-vWorld);
      vec2 bathUv=p/1.3+.5;
      vec2 packed=texture2D(depthField,clamp(bathUv,0.,1.)).rg;
      float h=(packed.r*65280.+packed.g*255.)/65535.*.23-.065;
      if(any(lessThan(bathUv,vec2(0.)))||any(greaterThan(bathUv,vec2(1.))))h=-.065;
      float depth=max(0.,-.001-h);
      float shallow=exp(-depth*108.);
      vec3 deep=vec3(.017,.044,.049),shoal=vec3(.075,.15,.12);
      vec3 body=mix(deep,shoal,shallow*.88);
      vec2 distortion=(a.xy*.65+b.xy*.35)*.0013;
      vec3 reflection=texture2D(mirrorSampler,mirrorCoord.xy/mirrorCoord.w+distortion).rgb;
      float F=.035+.78*pow(1.-max(dot(N,V),0.),5.);
      vec3 color=mix(body,reflection,clamp(F+.065,0.,.88));
      float crest=.5+.5*sin(depth*1900.-time*1.45+(a.x+b.y)*1.2);
      float shore=exp(-depth*520.)*smoothstep(.4,.88,crest);
      float speck=smoothstep(-.15,.55,a.y+b.x);
      color=mix(color,vec3(.57,.69,.65),shore*speck*.56);
      vec3 L=normalize(waterBasis*vec3(-.65,-.28,.7));
      float glint=pow(max(dot(N,normalize(V+L)),0.),170.);
      color+=vec3(.45,.37,.22)*glint*.17;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `;
  env.add(water);return water;
}

function cottage(g,x,z,w,d,angle,kit) {
  const {box,beam,wood,stone,trim,darkStone,windowMat,roof,hipRoof}=kit;
  const y=islandHeightHQ(x,z)+.001;
  const group=new T.Group();group.position.set(x,y,z);group.rotation.y=angle;g.add(group);
  const height=w*.64;
  box(group,w+.002,.005,d+.002,darkStone,0,.0005,0);
  box(group,w,height,d,stone,0,height/2+.003,0);
  // Timber ties, lintels, weathered boarding, glazed openings and individual roof ribs.
  for(const sign of [-1,1]){
    for(let i=0;i<4;i++)box(group,w,.00055,.0007,wood,0,.006+i*height/4,sign*d*.505);
    for(const xx of [-w*.43,w*.43])box(group,.001,height,.001,wood,xx,height*.5+.003,sign*d*.51);
    for(const xx of [-w*.23,w*.23]){
      box(group,w*.19,height*.31,.0007,windowMat,xx,height*.62,sign*d*.508);
      box(group,.00055,height*.34,.0012,trim,xx,height*.62,sign*d*.52);
      box(group,w*.23,.0007,.0011,trim,xx,height*.45,sign*d*.52);
    }
  }
  box(group,w*.17,height*.58,.0009,wood,0,height*.28+.003,d*.51);
  hipRoof(group,0,height+.005,0,w*1.20,d*1.25,w*.28,roof);
  for(let i=0;i<10;i++){
    const xx=-w*.57+i*w*.126;
    beam(group,[xx,height+.005,-d*.60],[clamp(xx,-w*.32,w*.32),height+w*.28+.005,0],.00035,wood);
    beam(group,[xx,height+.005,d*.60],[clamp(xx,-w*.32,w*.32),height+w*.28+.005,0],.00035,wood);
  }
  box(group,.0035,.012,.004,darkStone,-w*.28,height+.012,-d*.2);
  for(const side of [-1,1]){beam(group,[-w*.55,height+.004,side*d*.59],[w*.55,height+.004,side*d*.59],.0004,kit.gold);beam(group,[w*.45,.004,side*d*.52],[w*.45,height+.004,side*d*.52],.0003,kit.gold);}
  return {x,z,r:Math.max(w,d)*.9};
}
function path(g,points,width,kit) {
  const p=[],uv=[],idx=[];
  const curve=new T.CatmullRomCurve3(points.map(a=>new T.Vector3(a[0],0,a[1])));
  for(let i=0;i<=100;i++){
    const t=i/100,c=curve.getPoint(t),dir=curve.getTangent(t);const a=new T.Vector3(-dir.z,0,dir.x).multiplyScalar(width*.5);
    for(const sign of [-1,1]){const x=c.x+a.x*sign,z=c.z+a.z*sign;p.push(x,islandHeightHQ(x,z)+.0007,z);uv.push(sign>0?1:0,t*25);}
    if(i<100){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();kit.mesh(g,geo,kit.paving);
}
function pier(g,x,z,len,angle,kit) {
  const q=new T.Group();q.position.set(x,.014,z);q.rotation.y=angle;g.add(q);
  for(let i=0;i<Math.ceil(len/.0018);i++)kit.box(q,.020,.0012,.00145,kit.wood,0,0,-len/2+i*.0018);
  for(let i=0;i<8;i++)for(const side of [-1,1]){
    const zz=-len/2+i*len/7;
    kit.cyl(q,.00115,.044,kit.wood,side*.0098,-.012,zz,8);
    kit.cyl(q,.0015,.0014,kit.darkStone,side*.0098,.010,zz,8);
    if(i<7)kit.beam(q,[side*.0098,.007,zz],[side*.0098,.007,zz+len/7],.00023,kit.wood);
  }
  for(let i=0;i<10;i++){
    const xx=(i%2?1:-1)*.005,zz=-len*.4+i*.0028;
    kit.cyl(q,.0019,.0036,kit.wood,xx,.0024,zz,12);
    kit.torus(q,.0019,.0002,kit.darkStone,xx,.003,zz,Math.PI/2);
  }
}

function rift(g,kit) {
  const effects=new T.Group();effects.userData.noBake=true;g.add(effects);
  const n=320,cross=12,positions=[],uv=[],idx=[];
  // A long fracture suspended ACROSS the sky; its spine is world-space horizontal.
  // Thickness and vertical deviations are independent, not a rotated vertical tube.
  const knots=[.010,-.016,.005,.026,-.010,.012,-.021,.013,-.002,.019,-.005];
  const spine=t=>{
    const k=t*(knots.length-1),i=Math.min(knots.length-2,Math.floor(k));
    const jag=T.MathUtils.lerp(knots[i],knots[i+1],k-i)+(noise(t*97,5)-.5)*.004;
    const distance=(t-.5)*1.23;
    return new T.Vector3(distance*.81,.325+jag,-.035-distance*.586);
  };
  for(let i=0;i<=n;i++){
    const t=i/n,center=spine(t);
    const width=(.0003+.016*Math.pow(Math.sin(t*Math.PI),.72))*(.28+noise(t*61,9)*1.25);
    for(let j=0;j<=cross;j++){
      const u=j/cross,sign=u*2-1;
      const tear=(noise(t*217,sign*9)-.5)*.004*Math.abs(sign);
      const depth=-.029*(1-sign*sign)*Math.sin(t*Math.PI);
      positions.push(center.x+depth*.586,center.y+sign*width+tear,center.z+depth*.81);uv.push(u,t);
      if(i<n&&j<cross){const a=i*(cross+1)+j;idx.push(a,a+1,a+cross+1,a+1,a+cross+2,a+cross+1);}
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const material=new T.ShaderMaterial({uniforms:{time:{value:0}},side:T.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:'varying vec2 U;void main(){U=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 U;uniform float time;void main(){
      float x=abs(U.x*2.-1.),tip=pow(sin(U.y*3.14159),.3);
      float edge=pow(x,22.);float filament=.5+.5*sin(U.y*170.-time*.8);
      vec3 color=mix(vec3(.001,.002,.005),vec3(.18,.70,.85)*3.5,edge);
      color+=vec3(.06,.035,.15)*pow(x,6.)*(.25+filament*.3);
      float stars=step(.996,fract(sin(dot(floor(U*vec2(40.,400.)),vec2(12.9898,78.233)))*43758.5453));
      color+=stars*vec3(.2,.6,.8)*.4;
      gl_FragColor=vec4(color,smoothstep(0.,.05,tip));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
  const tear=new T.Mesh(geo,material);effects.add(tear);
  for(const t of [.16,.31,.57,.77,.88]){
    const p=spine(t),sign=t<.5?1:-1;
    kit.tube(effects,[p.toArray(),[p.x+.015,p.y+sign*.017,p.z-.007],[p.x+.028,p.y+sign*.024,p.z-.017],[p.x+.042,p.y+sign*.043,p.z-.022]],'#b1d9e0',.00022);
  }
  const fog=[];for(let i=0;i<9;i++)fog.push(kit.mist(effects,(i%3-1)*.11,.015+hash(i,5)*.025,(Math.floor(i/3)-1)*.13,.26,'#b2c7c9'));
  const dust=kit.particles(effects,260,'#98d9e0',.075,.32);dust.material.size=.0012;const dp=dust.geometry.attributes.position;for(let i=0;i<dp.count;i++){const t=hash(i,19),p=spine(t);dp.setXYZ(i,p.x+(hash(i,71)-.5)*.025,p.y+(hash(i,23)-.5)*.044,p.z+(hash(i,29)-.5)*.026);}dp.needsUpdate=true;
  const light=new T.PointLight('#67b9d5',.026,.70,2);light.position.set(0,.29,-.035);effects.add(light);
  return {material,fog,dust};
}

export function createArchipelagoHQ(g,kit) {
  const meta=terrain(g,kit),occupied=[];
  const homes=[[-.24,.030,.027,.021,.4],[-.26,-.012,.025,.019,.2],[-.21,-.028,.029,.022,-.25],[-.24,-.078,.023,.020,.2],[-.215,.075,.025,.019,-.2],[-.275,.090,.021,.018,.35],[.225,-.12,.027,.022,.25],[.185,-.17,.023,.018,.6],[.26,-.19,.023,.020,-.25],[.13,.22,.023,.019,.15],[.19,.235,.024,.019,.1],[.24,.20,.022,.017,-.3]];
  for(const h of homes)occupied.push(cottage(g,...h,kit));
  path(g,[[-.24,-.10],[-.225,-.055],[-.25,.015],[-.225,.08],[-.215,.14]],.005,kit);
  path(g,[[.17,-.19],[.20,-.14],[.255,-.15],[.27,-.10]],.004,kit);
  path(g,[[.10,.22],[.18,.21],[.27,.21]],.004,kit);
  // Timber observation platform and a small optical instrument, no new official institution.
  const px=.222,pz=-.067,py=islandHeightHQ(px,pz)+.009;
  for(let i=0;i<18;i++)kit.box(g,.035,.001,.0015,kit.wood,px,py,pz-.014+i*.0016);
  for(const x of [-.013,.013])for(const z of [-.011,.011])kit.beam(g,[px+x,islandHeightHQ(px+x,pz+z),pz+z],[px+x,py+.009,pz+z],.0007,kit.wood);
  kit.cyl(g,.0011,.014,kit.gold,px,py+.007,pz,12);
  const telescope=kit.mesh(g,new T.CylinderGeometry(.0016,.002,.018,16),kit.gold,px,py+.017,pz);telescope.rotation.z=-.8;
  for(const [isle,angle] of [[islands[0],.5],[islands[1],1.2],[islands[2],1.8]]) {
    const dir=new T.Vector2(Math.cos(angle)*isle.sx,Math.sin(angle)*isle.sz).normalize();
    let shore=new T.Vector2(isle.x,isle.z);
    for(let distance=.01;distance<.40;distance+=.001){shore.set(isle.x+dir.x*distance,isle.z+dir.y*distance);if(islandHeightHQ(shore.x,shore.y)<.009)break;}
    const yaw=Math.atan2(dir.x,dir.y),center=shore.clone().addScaledVector(dir,.035);
    pier(g,center.x,center.y,.082,yaw,kit);
    const inland=shore.clone().addScaledVector(dir,-.064),h0=islandHeightHQ(inland.x,inland.y)+.003;
    let prior=null;
    for(let j=0;j<=52;j++){
      const t=j/52,p=inland.clone().lerp(shore,t),h=Math.max(islandHeightHQ(p.x,p.y)+.001,T.MathUtils.lerp(h0,.014,t));
      const step=kit.box(g,.008,.0015,.0016,kit.wood,p.x,h,p.y);step.rotation.y=yaw;
      if(j%4===0){const q=new T.Vector3(p.x+dir.y*.0045,h+.006,p.y-dir.x*.0045);kit.beam(g,[q.x,h-.002,q.z],q.toArray(),.00035,kit.wood);if(prior)kit.beam(g,prior.toArray(),q.toArray(),.00025,kit.wood);prior=q;}
    }
    const mooring=center.clone().addScaledVector(new T.Vector2(dir.y,-dir.x),.019);
    kit.boat(g,mooring.x,mooring.y,.7,yaw);
  }
  let trees=0;
  for(let i=0;i<2000;i++){
    const x=(hash(i,11)-.5)*1.02,z=(hash(i,23)-.5)*.96,h=islandHeightHQ(x,z);
    const slope=Math.hypot(islandHeightHQ(x+.001,z)-h,islandHeightHQ(x,z+.001)-h)/.001;
    if(h<.022||slope>1.15||occupied.some(a=>Math.hypot(x-a.x,z-a.z)<a.r+.008))continue;
    if(x<-.19&&x>-.27&&z>-.12&&z<.16&&Math.abs(x+.24)<.009)continue;
    kit.tree(g,x,z,.45+hash(i,37)*.9,h,i%6===0);trees++;
  }
  // Cliff talus: angular chunks rather than a ring of identical round boulders.
  for(let i=0;i<370;i++){
    const s=islands[i%islands.length],a=hash(i,71)*TAU,rr=.91+hash(i,41)*.22;
    const x=s.x+Math.cos(a)*s.sx*rr,z=s.z+Math.sin(a)*s.sz*rr,h=islandHeightHQ(x,z);
    if(h<-.015||h>.05)continue;
    const o=kit.mesh(g,new T.IcosahedronGeometry(.002+hash(i,53)*.006,0),kit.cliffMat,x,h+.001,z);o.scale.set(1.5,.6+hash(i,64),.8);o.rotation.set(hash(i,6),hash(i,7)*3,hash(i,8));
  }
  const ecology=scatterEcology(g,{height:islandHeightHQ,bounds:[-.52,.52,-.46,.38],count:1100,exclude:(x,z)=>occupied.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+.012),seed:901});
  const effects=rift(g,kit);
  return {focus:.132,eye:[.73,.49,1.0],light:[-1.7,1.7,.65],meta:{...meta,...ecology,trees,homes:homes.length},
    environment(env){return reflectiveSea(env,kit);},
    update(t){effects.material.uniforms.time.value=t;effects.dust.position.y=Math.sin(t*.2)*.0007;effects.fog.forEach((f,i)=>f.material.opacity=.16+Math.sin(t*.16+i)*.04);}
  };
}
