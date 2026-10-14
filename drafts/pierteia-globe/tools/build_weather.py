"""Deterministic spherical weather art for the globe, not a climate simulation.
3D noise is sampled on a sphere: no longitudinal seam or latitude-stretched
noise near the poles. Fronts and vortices are transient decorative systems,
not new geography or gazetteer claims. Needs NumPy/Pillow/SciPy.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter
OUT=Path(__file__).resolve().parents[1]/'assets'
W,H=4096,2048
v,u=np.mgrid[:H,:W].astype('float32');u/=W-1;v/=H-1
lon=(u-.5)*2*np.pi;lat=(.5-v)*np.pi
X=np.cos(lat)*np.sin(lon);Y=np.sin(lat);Z=np.cos(lat)*np.cos(lon)
rng=np.random.default_rng(347890)
# A periodic lattice supports any sample direction. Endpoint texels coincide.
lattice=rng.random((72,72,72),dtype=np.float32)
def spherical_noise(frequency,offset=0):
 return map_coordinates(lattice,[(X*frequency+23+offset)%72,(Y*frequency+31+offset*.7)%72,(Z*frequency+17-offset*.4)%72],order=3,mode='grid-wrap',prefilter=True)
n0=spherical_noise(4.1);n1=spherical_noise(13.2,5);n2=spherical_noise(42,11);n3=spherical_noise(116,19)
# Irregular edges and internal texture, not equal-sized isolated speckles.
warp=(n0-.5)*.017+(n1-.5)*.005
field=np.zeros((H,W),dtype='float32')
def wrapped_du(center):return (u-center+.5)%1-.5
# lon, lat, length, slope, thickness, bend, phase; unrelated to country borders.
fronts=[(.45,.28,.11,-.34,.024,.038,.3),(.32,.65,.09,.65,.022,.022,2.1),(.78,.14,.08,.30,.017,.031,1.1),(.86,.72,.13,-.60,.029,.020,3.0),(.07,.46,.095,-1.3,.025,.020,1.8)]
for cx,cy,length,slope,width,bend,phase in fronts:
 du=wrapped_du(cx);line=cy+slope*du+bend*np.sin(du*21+phase)
 dv=v-line+warp;envelope=np.exp(-(du/length)**4)
 core=np.exp(-(dv/(width*(.7+n1*.8)))**2)*envelope
 tail=np.exp(-((dv-width*1.3)/(width*2.0))**2)*envelope*.26
 field=np.maximum(field,core*.87+tail)
# Oceanic spiral systems: connected comma-shaped bands instead of sprinkled dots.
for cx,cy,radius,spin in [(.51,.60,.10,1),(.94,.32,.080,-1)]:
 du=wrapped_du(cx)*np.cos((.5-cy)*np.pi)*2;dv=v-cy
 r=np.hypot(du,dv);angle=np.arctan2(dv,du)
 phase=angle*spin+np.log(np.maximum(r,.006)/radius)*3.25+(n1-.5)*.90
 spiral=np.exp(-(np.sin(phase*.5)*1.9)**2)
 annulus=np.exp(-((r-radius*.52)/(radius*.49))**2)
 eye=1-np.exp(-(r/.009)**2)
 body=(spiral*.73+.20)*annulus*eye*(.55+.45*(.5+.5*np.cos(angle+.8)))
 field=np.maximum(field,body)
# A few broad broken decks, bounded by low-frequency weather, not everywhere.
deck=np.clip((n0-.57)*4.8,0,1)*np.clip((n1-.40)*2,0,1)*.53
field=np.maximum(field,deck)
structure=np.clip(.58+(n1-.5)*.64+(n2-.5)*.48+(n3-.5)*.17,.05,1)
alpha=np.clip((field*structure-.10)*1.75,0,.90)
# High cloud follows the same large systems but forms thin diffuse streaks.
cirrus=np.clip(field-.10,0,.8)*np.clip((n1*.62+n2*.30+n3*.08-.50)*2.4,0,.32)
cirrus=gaussian_filter(cirrus,1.1)
# Clouds may cross the poles, but each pole itself has a single value.
for a in [alpha,cirrus]:
 a[:, -1]=a[:,0]
 for row in [0,-1]:a[row,:]=a[row,:].mean()

def save(name,a):
 rgba=np.zeros((H,W,4),dtype='uint8');rgba[:,:,:3]=255;rgba[:,:,3]=(a*255).astype('uint8');Image.fromarray(rgba,'RGBA').save(OUT/name)
save('clouds.png',alpha);save('cirrus.png',cirrus)
# A flat diagnostic preview is for offline inspection only, not the rendered globe.
preview=np.empty((H,W,3),dtype='float32');preview[:]=[13,35, 65];preview=preview*(1-alpha[...,None])+np.array([239,243,241])*alpha[...,None]
Image.fromarray(preview.astype('uint8')).resize((1200,600)).save(OUT/'weather-preview.jpg',quality=91)
meta={'revision':3,'size':[W,H],'seed':347890,'model':'spherical 3D noise + connected fronts and spiral systems; artistic weather, not simulated climate','seamContinuous':True,'coverageAbove10Percent':round(float(np.mean(alpha>.1)),4),'meanOpacity':round(float(alpha.mean()),4),'layers':['clouds.png','cirrus.png']}
(OUT/'weather-provenance.json').write_text(json.dumps(meta,indent=2));print(meta,flush=True)
