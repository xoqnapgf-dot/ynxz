import * as T from 'three';
const materials=new WeakMap();
// Real overlapping tile courses: a curved crown plus the exposed lower lip.
// One material per roof family, so construction still joins the static batches.
export function tiledRoof(parent,{w,d,rise,y=0,x=0,z=0,hip=false,curved=false,material}){
 if(w<.015||d<.012)return;
 let m=materials.get(material);if(!m){m=new T.MeshStandardMaterial({color:material.color.clone(),vertexColors:true,roughness:.86,side:T.DoubleSide,envMapIntensity:.35});m.forceSinglePass=true;materials.set(material,m);}
 const p=[],uv=[],colors=[],indices=[],rows=Math.max(3,Math.ceil(d/.009)),step=d/2/rows,cols=Math.max(4,Math.ceil(w/.004)),cw=w/cols;
 const roofY=(xx,zz)=>{const t=Math.abs(zz)/(d*.5),gable=rise*(1-t)+(curved?Math.pow(t,4)*rise*.28:0);return hip?Math.min(gable,rise*(w/2-Math.abs(xx))/(w*.23)):gable;};
 for(const side of [-1,1])for(let row=0;row<rows;row++)for(let col=0;col<=cols;col++){
  const left=Math.max(-w/2,-w/2+(col-(row%2)*.5)*cw+.00006),right=Math.min(w/2,left+cw-.00012);if(right-left<.0002)continue;
  const indexStart=indices.length;
  const front=(row+1)*step,back=Math.max(0,row*step-step*.10),base=p.length/3;
  const h=Math.sin(col*12.71+row*9.31+side*4)*43758.54,shade=.88+(h-Math.floor(h))*.21;
  for(const zz of [back,front])for(let k=0;k<3;k++){
   const xx=T.MathUtils.lerp(left,right,k/2),crown=k===1?.00022:0,yy=roofY(xx,zz)+.00090+crown;
   p.push(x+xx,y+yy,z+side*zz);uv.push((xx+w/2)/w,zz/d);colors.push(shade,shade*.995,shade*.98);
  }
  indices.push(base,base+3,base+1,base+1,base+3,base+4,base+1,base+4,base+2,base+2,base+4,base+5);
  // Exposed tile thickness, not a painted dark line.
  for(let k=0;k<3;k++){const i=(base+3+k)*3;p.push(p[i],p[i+1]-.00020,p[i+2]);uv.push(k/2,1);colors.push(shade*.80,shade*.80,shade*.80);}
  indices.push(base+3,base+6,base+4,base+4,base+6,base+7,base+4,base+7,base+5,base+5,base+7,base+8);
  if(side<0)for(let i=indexStart;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
 const mesh=new T.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
}
