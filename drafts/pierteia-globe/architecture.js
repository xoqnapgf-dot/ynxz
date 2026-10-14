import * as T from 'three';
// Front face z=0, wall thickness inward. Openings are holes in the mesh.
export function wallWithOpenings({width,height,thickness=.0018,openings=[]}){
 if(!(width>0&&height>0&&thickness>0))throw Error('Invalid wall dimensions');
 for(let i=0;i<openings.length;i++){
  const a=openings[i];
  if(!(a.w>0&&a.h>0)||a.x-a.w/2<=-width/2||a.x+a.w/2>=width/2||a.y-a.h/2<0||a.y+a.h/2>=height)throw Error('Opening outside wall');
  for(const b of openings.slice(0,i))if(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2)throw Error('Overlapping wall openings');
 }
 const shape=new T.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(width/2,height);shape.lineTo(-width/2,height);shape.closePath();
 for(const a of openings){const hole=new T.Path();hole.moveTo(a.x-a.w/2,a.y-a.h/2);hole.lineTo(a.x-a.w/2,a.y+a.h/2);hole.lineTo(a.x+a.w/2,a.y+a.h/2);hole.lineTo(a.x+a.w/2,a.y-a.h/2);hole.closePath();shape.holes.push(hole);}
 const geo=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});geo.translate(0,0,-thickness);
 const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)*48,p.getY(i)*48);
 geo.userData.openingCount=openings.length;return geo;
}
export function bendWall(geometry,radius,angle,facing=1){
 if(!(radius>0)||![1,-1].includes(facing))throw Error('Invalid curved wall');
 const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const a=angle+facing*p.getX(i)/radius,r=radius+facing*p.getZ(i);p.setXYZ(i,Math.sin(a)*r,p.getY(i),Math.cos(a)*r);}
 p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
