# v11 reference surfaces and photographic lighting

- `wood_color.jpg`, `wood_roughness.jpg`, `brick_base_gray.jpg`, `brick_normal.jpg`, `brick_roughness.jpg`: MaterialX project / Academy Software Foundation and its contributors, Apache-2.0. See the included MaterialX-LICENSE.txt. These derivatives were resized to fit 1024 pixels and JPEG re-encoded; no claim of photogrammetric origin. Each upstream commit and source checksum is in manifest.json.
- `forest_slope_512.hdr`: **Forest Slope**, Andreas Mischok, HDRI Haven / Poly Haven, **CC0**. Source: https://polyhaven.com/a/forest_slope ; license: https://polyhaven.com/license . Linear-radiance 2×2 downsample from the 1K file obtained from the pinned pmndrs/drei-assets mirror recorded in manifest.json. Used for illumination and reflection only, not as scene backdrop.
- Material UV scale here is an authored calibration, not a measured upstream capture dimension. Brick reference is mapped to 2.08 m per repeat; check joints against the metre-scale geometry. Wood UVs on the Blender model follow its existing unwrap.

RGBELoader is the Three r170 addon under the existing vendor/THREE-LICENSE.txt. No other renderer/framework has been upgraded.

Reproduction: `python tools/rebuild-study-assets.py` requires authenticated `gh`, Node.js and Pillow 12.3.0. It reads pinned URLs and verifies upstream and derivative SHA-256, rather than fetching whichever release is newest. The HDR conversion script reads the original 1K source without overwriting it.
