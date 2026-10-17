"""Directional grain upgrade for runtime wood; original, deterministic PBR maps."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
out=Path(__file__).resolve().parents[1]/'assets/world';out.mkdir(exist_ok=True)
n=1024;rng=np.random.default_rng(801);y,x=np.mgrid[0:n,0:n].astype(np.float32)/n
noise=rng.normal(size=(n,n)).astype(np.float32)
soft=gaussian_filter(noise,(24,3),mode='wrap');soft/=soft.std()
# Longitudinal fibers, gentle slow warp; no isotropic "fingerprint" rings.
phase=x*160+np.sin(y*6.283)*.28+np.sin(y*12.566+x*19)*.12
fibers=np.sin(phase*6.283)+.3*np.sin(phase*17.1)
v=soft*3+fibers*2.6+noise*.6
rgb=np.array([155,121, 86])[None,None,:]+v[:,:,None]*np.array([1,.83,.64])
Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(out/'oak-color.jpg',quality=94,subsampling=0)
h=soft*.08+fibers*.07+noise*.015;dx=np.roll(h,-1,1)-np.roll(h,1,1);dy=np.roll(h,-1,0)-np.roll(h,1,0)
a=np.stack([-dx,dy,np.ones_like(dx)],2);a/=np.linalg.norm(a,axis=2,keepdims=True)
Image.fromarray(np.uint8((a*.5+.5)*255)).save(out/'oak-normal.jpg',quality=95,subsampling=0)
Image.fromarray(np.uint8(np.clip(187+soft*7+fibers*4,0,255))).save(out/'oak-rough.jpg',quality=94)
