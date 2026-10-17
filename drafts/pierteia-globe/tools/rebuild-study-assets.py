"""Rebuild the v11 derivatives from pinned sources (gh, Node, Pillow required).
Run manually; does not upgrade dependency versions or download whole libraries.
"""
import base64, hashlib, io, json, pathlib, subprocess, tempfile
from urllib.parse import quote, urlparse
from PIL import Image
root = pathlib.Path(__file__).resolve().parents[1]
folder = root / 'assets/study'
manifest = json.loads((folder / 'manifest.json').read_text())
def api(path):
    return json.loads(subprocess.check_output(['gh', 'api', path]))
for asset in manifest['assets']:
    parts = urlparse(asset['source']).path.strip('/').split('/')
    assert parts[2] == 'blob'
    repo, ref, path = '/'.join(parts[:2]), parts[3], '/'.join(parts[4:])
    content = api(f'repos/{repo}/contents/{quote(path)}?ref={ref}')
    if not content.get('content'):
        content = api(f"repos/{repo}/git/blobs/{content['sha']}")
    data = base64.b64decode(content['content'])
    assert hashlib.sha256(data).hexdigest() == asset['upstreamSHA256']
    if asset['file'].endswith('.jpg'):
        image = Image.open(io.BytesIO(data)).convert('RGB')
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, 'JPEG', quality=94, subsampling=0)
        output = buffer.getvalue()
    else:
        with tempfile.TemporaryDirectory() as temp:
            source = pathlib.Path(temp) / 'source.hdr'
            result = pathlib.Path(temp) / 'result.hdr'
            source.write_bytes(data)
            subprocess.run(['node', str(root / 'tools/downsample-study-hdr.mjs'), str(source), str(result)], check=True)
            output = result.read_bytes()
    assert hashlib.sha256(output).hexdigest() == asset['sha256'], 'Derivative differs; check Pillow version rather than silently overwriting the manifest'
    (folder / asset['file']).write_bytes(output)
    print('Rebuilt:', asset['file'])
