"""Build a flat Playgama upload ZIP from the runtime files only."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
output = root / 'dist' / f'catdoku-{version}.zip'
output.parent.mkdir(exist_ok=True)
files = ['index.html', 'game.js', 'levels.js', 'style.css', 'playgama-bridge-config.json']
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
print(output)
print(f'SHA-256 {sha256(output.read_bytes()).hexdigest()}')
