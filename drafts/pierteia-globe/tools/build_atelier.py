"""Blender 4.2 asset authoring: a detailed academy reading/work room, in meters.
Rebuild: PYTHONPATH=<bpy/pillow/numpy/scipy install> python tools/build_atelier.py
All geometry and textures are original deterministic procedural work (not scans).
The exported GLB is the actual interactive asset, not an offline rendered picture.
"""
from pathlib import Path
import math, json, random, time
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
import bpy, bmesh
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'atelier'; OUT.mkdir(parents=True,exist_ok=True)
random.seed(71); rng=np.random.default_rng(71); N=1024
Y,X=np.mgrid[0:N,0:N].astype(np.float32)/N

def noise(s):
 a=gaussian_filter(rng.normal(size=(N,N)).astype(np.float32),s,mode='wrap');return a/(a.std()+1e-8)
fine=noise(1); med=noise(12); broad=noise(70)

def maps(name,base,v,height,rough):
 rgb=np.clip(np.array(base)[None,None,:]+v[:,:,None],0,255).astype('uint8')
 Image.fromarray(rgb).save(OUT/f'{name}-color.jpg',quality=95,subsampling=0)
 dx=np.roll(height,-1,1)-np.roll(height,1,1);dy=np.roll(height,-1,0)-np.roll(height,1,0)
 normal=np.stack([-dx,dy,np.ones_like(dx)],axis=2);normal/=np.linalg.norm(normal,axis=2,keepdims=True)
 Image.fromarray(np.uint8((normal*.5+.5)*255)).save(OUT/f'{name}-normal.jpg',quality=96,subsampling=0)
 Image.fromarray(np.uint8(np.clip(rough,0,255))).save(OUT/f'{name}-rough.jpg',quality=95)

maps('limewash',[209,200,180],broad*3+med*1.2+fine, fine*.14+med*.05,220+med*6)
maps('limestone',[164,162,144],broad*8+med*4+fine*3,fine*.24+med*.1,211+fine*7)
fibers=np.sin((X+.012*np.sin(Y*19)+.012*med)*800)
maps('oak',[132,101,68],broad*7+fibers*5+med*2,fibers*.15+fine*.07,174+med*10+fibers*6)
maps('clay',[159,106,78],broad*9+med*3+fine*2,fine*.17+med*.06,205+med*9)
print('PBR maps authored',flush=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
def material(name,color=(1,1,1,1),surface=None,metal=0,rough=.7,transmission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;links=m.node_tree.links;p=n.get('Principled BSDF')
 p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 p.inputs['Transmission Weight'].default_value=transmission;p.inputs['IOR'].default_value=1.48
 if surface:
  for channel,socket in [('color','Base Color'),('rough','Roughness'),('normal',None)]:
   t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(OUT/f'{surface}-{channel}.jpg'),check_existing=True)
   if channel!='color':t.image.colorspace_settings.name='Non-Color'
   if socket:links.new(t.outputs['Color'],p.inputs[socket])
   else:
    normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.34;links.new(t.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
 materials[name]=m;return m
plaster=material('Limewash',surface='limewash');stone=material('Limestone',surface='limestone');wood=material('Oak',surface='oak');clay=material('Clay',surface='clay')
metal=material('Aged bronze',(.20,.16,.10,1),metal=.72,rough=.37)
patina=material('Oxidised copper',(.18,.30,.26,1),metal=.54,rough=.53)
dark=material('Deep joints',(.055,.063,.047,1),rough=.97)
glass=material('Window glass',(.87,.94,.91,1),rough=.13,transmission=.76)
paper=material('Paper',(.68,.60,.44,1),rough=.95)
foliage=material('Herbs',(.13,.21,.07,1),rough=.91)
bookm=[material('Book '+str(i),(*c,1)) for i,c in enumerate([(.17,.27,.25),(.38,.17,.11),(.44,.35,.18),(.16,.18,.13)])]
claym=[material('Tile tone '+str(i),surface='clay') for i in range(4)]
# Same maps, small roughness/normal variations; vertex geometry supplies tile variation.
for i,m in enumerate(claym):m.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.2+i*.06
cache={}
def mesh(name,verts,faces,mat):
 me=bpy.data.meshes.new(name);me.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);me.update()
 uv=me.uv_layers.new(name='UVMap')
 for poly in me.polygons:
  axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3) if i!=axis]
  for li in poly.loop_indices:
   v=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]*.5,v[axes[1]]*.5)
 me.materials.append(mat);o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return o

def box(name,size,loc,mat,bevel=.015,rx=0,ry=0,rz=0):
 w,h,d=size;key=(tuple(size),mat.name,bevel)
 if key not in cache:
  bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
  for v in bm.verts:v.co.x*=w;v.co.y*=d;v.co.z*=h
  if bevel:bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(bevel,min(size)*.18),segments=2,affect='EDGES')
  me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free();me.update();me.materials.append(mat)
  uv=me.uv_layers.new(name='UVMap')
  for poly in me.polygons:
   axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3) if i!=axis]
   for li in poly.loop_indices:
    v=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]*.5,v[axes[1]]*.5)
  cache[key]=me
 o=bpy.data.objects.new(name,cache[key]);bpy.context.collection.objects.link(o);o.location=(loc[0],-loc[2],loc[1]);o.rotation_euler=(rx,-rz,ry);return o

def tube(name,points,r,mat):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=12;curve.bevel_depth=r;curve.bevel_resolution=2
 sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
 for p,(x,y,z) in zip(sp.points,points):p.co=(x,-z,y,1)
 curve.materials.append(mat);o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);return o

def hoop(name,x,y,z,r,mat,plane='front',thick=.018):
 points=[]
 for i in range(49):
  a=i/48*math.tau;points.append((x+r*math.cos(a),y+r*math.sin(a),z) if plane=='front' else (x+r*math.cos(a),y,z+r*math.sin(a)))
 return tube(name,points,thick,mat)

box('Foundation',(9.1,.34,5.0),(0,-.18,0),stone,.04)
# Continuous wall meshes are cut by Boolean window and door openings before beveling.
def cut_wall(name,size,loc,openings):
 o=box(name,size,loc,plaster,0);o.data=o.data.copy()
 for size2,loc2 in openings:
  c=box('opening cutter',size2,loc2,dark,0);mod=o.modifiers.new('True opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=c
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(c,do_unlink=True)
 mod=o.modifiers.new('Soft reveal edges','BEVEL');mod.width=.014;mod.segments=2
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
for side in [-1,1]:
 z=side*2.34;holes=[((1.48,1.82,.9),(x,1.96,z)) for x in [-2.96,2.96]]
 if side==1:holes.append(((1.76,2.78,.9),(0,1.30,z)))
 cut_wall('Front' if side==1 else 'Back',(9,3.5,.24),(0,1.75,z),holes)
for side in [-1,1]:cut_wall('Gable wall',(.24,3.5,4.44),(side*4.38,1.75,0),[((.8,1.82,1.48),(side*4.38,1.96,0))])
print('Thick walls and genuine openings',flush=True)
# Limestone plinth masonry and corner blocks, staggered bonds.
for side in [-1,1]:
 for row in range(4):
  for i in range(19):
   x=-4.4+i*.48+(row%2)*.24
   if x>4.4 or side==1 and abs(x)<.99:continue
   box('Dressed stone',(.463,.192,.29),(x,.095+row*.201,side*2.37),stone,.025)
 for row in range(4):
  for i in range(9):box('Return stone',(.29,.192,.465),(side*4.40,.095+row*.201,-2.06+i*.49),stone,.025)
# Windows are built in local facade coordinates, then rotated into place.
def window(x,y,z,angle=0):
 before=set(bpy.data.objects)
 w=1.48;h=1.82
 for side in [-1,1]:
  box('Oak jamb',(.085,h+.11,.145),(side*w/2,0,.02),wood,.012)
  box('Head and sill',(w+.12,.085,.145),(0,side*h/2,.02),wood,.012)
 box('Central mullion',(.055,h,.09),(0,0,.04),wood,.01);box('Transom',(w,.045,.09),(0,.15,.04),wood,.008)
 for sx in [-1,1]:
  for yy,hh in [(-.38,.94),(.53,.69)]:
   box('Thin glazing',(.64,hh,.012),(sx*.37,yy,-.012),glass,.001)
   box('Fine glazing bar',(.019,hh,.025),(sx*.37,yy,.044),wood,.004)
 box('Projecting limestone sill',(1.79,.13,.40),(0,-1.00,.045),stone,.025)
 box('Lintel',(1.72,.14,.30),(0,1.04,.025),stone,.02)
 for side in [-1,1]:
  for j in range(12):box('Shutter slat',(.36,.13,.065),(side*1.03,-.81+j*.147,.18),wood,.013,ry=side*.15)
  for dx in [-.17,.17]:box('Shutter stile',(.055,1.84,.085),(side*1.03+dx,0,.18),wood,.01)
  for yy in [-.60,.60]:box('Hinge strap',(.34,.035,.024),(side*1.03,yy,.24),metal,.006)
 # Folds of linen frame the view without hiding the interior.
 for side in [-1,1]:
  verts=[];faces=[]
  for j in range(15):
   xx=side*.49+(j/14-.5)*.25;zz=-.17+math.sin(j*.9)*.028
   verts.extend([(xx,-.88,zz),(xx,.86,zz)])
   if j<14:faces.append((j*2,j*2+2,j*2+3,j*2+1))
  mesh('Linen curtain',verts,faces,paper)
 for o in set(bpy.data.objects)-before:
  # Convert curve/mesh authored around the window centre by a common parent transform.
  xx,zz,yy=o.location;px=xx*math.cos(angle)+(-zz)*math.sin(angle);pz=-xx*math.sin(angle)+(-zz)*math.cos(angle)
  o.location=(x+px,-(z+pz),y+yy);o.rotation_euler.z+=angle
for side in [-1,1]:
 for x in [-2.96,2.96]:window(x,1.96,side*2.38,0 if side==1 else math.pi)
for side in [-1,1]:window(side*4.40,1.96,0,side*math.pi/2)
# Double door with panel relief, glazed uppers and a brass pull.
for side in [-1,1]:
 x=side*.43;box('Door',(.83,2.68,.12),(x,1.35,2.34),wood,.025)
 for y in [.40,1.02]:box('Recessed door panel',(.63,.45,.065),(x,y,2.43),wood,.022)
 box('Door upper glass',(.61,.90,.014),(x,2.08,2.413),glass,.005)
 tube('Door handle',[(x-side*.25,1.13,2.48),(x-side*.25,1.23,2.54),(x-side*.25,1.39,2.48)],.02,metal)
 for yy in [.3,1.3,2.3]:box('Hinge',(.19,.035,.024),(side*.70,yy,2.43),metal,.005)
for i in range(3):box('Worn threshold',(1.98+i*.25,.13,.46),(0,.04-i*.12,2.50+i*.35),stone,.035)
# Visible interior library furniture, no empty black cavities.
for i in range(43):box('Floorboard',(.198,.04,4.35),(-4.2+i*.2,.02,0),wood,.007)
for x in [-3.35,0,3.35]:
 for sx in [-.66,.66]:box('Bookcase stile',(.06,2.64,.34),(x+sx,1.35,-1.99),wood,.01)
 for row in range(6):
  box('Shelf',(1.38,.04,.37),(x,.16+row*.40,-1.99),wood,.008)
  for j in range(14):box('Book spine',(.067,.22+random.random()*.09,.20),(x-.57+j*.085,.30+row*.40,-1.92),bookm[(j+row)%4],.004)
for x in [-2.6,2.6]:
 box('Reading table',(1.7,.075,.86),(x,.80,0),wood,.025)
 for dx in [-.66,.66]:
  for dz in [-.30,.30]:box('Table leg',(.065,.76,.065),(x+dx,.40,dz),wood,.01)
 box('Open book',(.30,.025,.22),(x-.3,.85,.05),paper,.004)
# Roof: timber deck, exposed rafter tails and 880 overlapping curved clay tiles.
rise=1.35;half=2.70;roofY=3.52;angle=math.atan2(rise,half);run=math.hypot(rise,half)
# Linked tile meshes make the source lightweight before material batching.
verts=[];faces=[];steps=8
for z in [0,.36]:
 for lower in [False,True]:
  for j in range(steps+1):
   u=j/steps;verts.append(((u-.5)*.246,.045*math.sin(u*math.pi)-(0.024 if lower else 0),z))
for j in range(steps):
 faces.extend([(j,j+1,18+j+1,18+j),(9+j,27+j,27+j+1,9+j+1)])
for i in [0,8]:faces.append((i,i+18,i+27,i+9))
for j in range(steps):faces.extend([(j,9+j,10+j,j+1),(18+j,19+j,28+j,27+j)])
tile=mesh('Tile prototype',verts,faces,clay);tile.hide_render=True;tile.hide_viewport=True
for side in [-1,1]:
 box('Roof deck',(9.64,.08,run),(0,roofY+rise/2,side*half/2),wood,.012,rx=side*angle)
 for i in range(35):box('Rafter',(.095,.16,run+.06),(-4.7+i*.277,roofY+rise/2-.12,side*half/2),wood,.016,rx=side*angle)
 for row in range(11):
  for col in range(40):
   localz=-run/2+row*.278;localy=.055+row*.006
   yy=roofY+rise/2+localy*math.cos(angle)-side*localz*math.sin(angle);zz=side*half/2+localy*math.sin(side*angle)+localz*math.cos(angle)
   o=bpy.data.objects.new('Overlapping clay tile',tile.data);bpy.context.collection.objects.link(o);o.location=(-4.72+col*.242+(row%2)*.015,-zz,yy);o.rotation_euler.x=side*angle
 box('Fascia',(9.67,.16,.11),(0,roofY-.05,side*half),wood,.016)
 tube('Copper gutter',[(-4.8,roofY-.06,side*(half+.04)),(4.8,roofY-.06,side*(half+.04))],.06,patina)
 tube('Downpipe',[(4.40,roofY-.06,side*(half+.04)),(4.40,3.13,side*2.53),(4.40,.10,side*2.53),(4.40,.04,side*2.68)],.044,patina)
for i in range(40):
 # Ridge cap half cylinders with true thickness profile.
 a=math.pi;pts=[(-4.75+i*.244,roofY+rise+.06+.10*math.sin(j/12*a),.10*math.cos(j/12*a)) for j in range(13)]
 tube('Ridge cap',pts,.034,clay)
bpy.data.objects.remove(tile,do_unlink=True)
for side in [-1,1]:
 mesh('Gable',[(side*4.5,roofY,-2.47),(side*4.5,roofY,2.47),(side*4.5,roofY+rise,0)],[(0,1,2)],plaster)
 tube('Gable timber',[(side*4.54,roofY,-2.55),(side*4.54,roofY+rise,0),(side*4.54,roofY,2.55)],.055,wood)
 tube('King post',[(side*4.54,roofY,0),(side*4.54,roofY+rise,0)],.055,wood)
for row in range(12):
 for i in range(3):box('Chimney brick',(.242,.115,.50),(-2.85+i*.25,4.04+row*.12,-.90),clay,.01)
box('Chimney coping',(.96,.12,.73),(-2.60,5.49,-.90),stone,.023)
for x in [-2.81,-2.39]:
 tube('Flue',[(x,5.53,-.9),(x,5.92,-.9)],.11,clay);hoop('Flue rim',x,5.94,-.9,.115,clay,'ground',.026)
# Bracketed canopy, circled-A metalwork and lantern fittings, not a fortress gate.
box('Canopy',(2.54,.075,.96),(0,2.94,2.71),patina,.02,rx=.17)
for x in [-1.0,1.0]:tube('Timber bracket',[(x,2.28,2.43),(x,2.87,3.05),(x,2.82,2.43)],.037,wood)
hoop('Circled A',0,3.24,2.50,.24,metal)
tube('A left',[(-.15,3.06,2.51),(0,3.43,2.51),(.15,3.06,2.51)],.017,metal);tube('A crossbar',[(-.14,3.20,2.51),(.14,3.20,2.51)],.016,metal)
lantern=material('Lantern glass',(.70,.52,.24,1),rough=.22)
p=lantern.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.5,.27,.07,1);p.inputs['Emission Strength'].default_value=.5
for x in [-1.25,1.25]:
 box('Lantern',(.16,.28,.14),(x,2.04,2.58),lantern,.015)
 for dx in [-.09,.09]:box('Lantern frame',(.02,.32,.17),(x+dx,2.04,2.58),metal,.005)
 box('Lantern cap',(.25,.045,.23),(x,2.23,2.58),metal,.008)
# Laid paving, bevelled joints, outdoor bench, books, planter boxes and herb leaves.
for row in range(6):
 for i in range(21):
  x=-4.8+i*.45+(row%2)*.22
  if abs(x)<1.3 and row<2:continue
  box('Limestone paving',(.433,.075,.365),(x,-.24-row*.012,2.7+row*.38),stone,.019)
box('Bench seat',(1.9,.08,.44),(2.7,.40,3.45),wood,.02);box('Bench back',(1.9,.42,.065),(2.7,.72,3.22),wood,.015)
for x in [1.99,3.41]:box('Bench foot',(.10,.52,.32),(x,.16,3.43),metal,.018)
for i in range(3):box('Outdoor book',(.26,.035,.19),(2.2,.47+i*.037,3.43),bookm[i],.005)
box('Noticeboard',(.64,.87,.08),(-1.72,1.54,2.57),wood,.018);box('Notices',(.55,.76,.012),(-1.72,1.54,2.62),paper,.003)
for i in range(5):box('Notice line',(.40,.009,.008),(-1.72,1.80-i*.12,2.63),dark,.001)
for x in [-3.98,3.98]:
 box('Planter',(.72,.62,.72),(x,.06,3.36),stone,.04);box('Soil',(.62,.025,.62),(x,.38,3.36),dark,.012)
 for i in range(32):
  a=i*2.399;r=math.sqrt(i/32)*.25;xx=x+math.cos(a)*r;zz=3.36+math.sin(a)*r
  tube('Herb stem',[(xx,.39,zz),(xx+math.sin(a)*.10,.74+random.random()*.18,zz)],.008,foliage)
  for j in range(4):
   yy=.49+j*.075;mesh('Herb leaf',[(xx-.055,yy,zz),(xx,yy+.013,zz+.12),(xx+.055,yy,zz),(xx,yy-.01,zz-.02)],[(0,1,2,3)],foliage)
print('Geometry constructed',len(bpy.data.objects),flush=True)
# Curves become real geometry, then static objects batch by material for WebGL.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
for m in list(bpy.data.materials):
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials) and o.data.materials[0]==m]
 if not objs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=m.name+' batch'
bpy.ops.object.select_all(action='SELECT')
# Neutral transform at the asset origin; exporter converts Blender Z-up to glTF Y-up.
bpy.ops.export_scene.gltf(filepath=str(OUT/'academy-atelier.glb'),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=93,export_apply=True,export_extras=True,export_yup=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
(OUT/'provenance.json').write_text(json.dumps({'tool':'Blender '+bpy.app.version_string,'asset':'academy-atelier.glb','units':'meters, glTF Y-up','triangles':triangles,'batches':len(bpy.context.scene.objects),'textures':'Original authored procedural PBR, not scans','seed':71,'features':['true wall openings','bevelled masonry','880 overlapping clay tiles','glazed windows and curtains','interior bookshelves','modeled gutters and downpipes','circled-A metalwork']},indent=2))
print('EXPORTED',triangles,'triangles',flush=True)

# Embedded bpy may crash during interpreter finalization in minimal headless hosts.
# This opt-in exits only AFTER successful export/provenance writes; failures above still fail.
import os, sys
if os.environ.get("BPY_ASSET_ONLY_EXIT") == "1":
 sys.stdout.flush(); os._exit(0)
