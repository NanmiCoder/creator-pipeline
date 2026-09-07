#!/usr/bin/env python3
"""Check distributable files, local Markdown links and skill layout without model downloads."""
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote

ROOT=Path(__file__).resolve().parents[1]
EXPECTED={'voice-clone-tts','web-video-presentation'}
PUBLIC_DEMO_AUDIO={
    Path('examples/live-demo/presentation/public/audio/voiceover.wav'),
    Path('examples/live-demo/presentation/public/audio/voiceover.mp3'),
}
actual={p.parent.name for p in (ROOT/'skills').glob('*/SKILL.md')}
assert actual==EXPECTED, f'Unexpected skills: {actual}'
for name in EXPECTED:
    text=(ROOT/'skills'/name/'SKILL.md').read_text()
    assert re.match(r'\A---\nname: '+re.escape(name)+r'\ndescription: .+\n---',text), name

try:
    names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).splitlines()
    files=[ROOT/n for n in names]
except subprocess.CalledProcessError:
    files=[p for p in ROOT.rglob('*') if p.is_file() and not any(x in p.parts for x in ('__pycache__','node_modules','.git'))]
errors=[]
private_pattern=re.compile(r'/(?:Users|home)/[A-Za-z0-9_.-]+/')
for p in files:
    if p.suffix in {'.pyc','.wav','.mp3','.m4a','.mp4','.onnx','.safetensors'} and p.relative_to(ROOT) not in PUBLIC_DEMO_AUDIO:
        errors.append(f'Generated/private artifact: {p.relative_to(ROOT)}')
    if p.stat().st_size>5*1024*1024:
        errors.append(f'Large distribution file: {p.relative_to(ROOT)}')
    if p.suffix in {'.md','.py','.json','.mjs','.ts','.tsx','.sh','.yml'}:
        text=p.read_text()
        if private_pattern.search(text):errors.append(f'Private absolute path: {p.relative_to(ROOT)}')
    if p.suffix=='.md':
        for target in re.findall(r'\]\(([^\s)]+)\)',text) + re.findall(r'<img[^>]+src="([^"]+)"',text):
            if ':' in target or target.startswith(('#','<')) or any(c in target for c in '*{}<>'):continue
            path=unquote(target.split('#')[0])
            if path and not (p.parent/path).exists():errors.append(f'Broken link in {p.relative_to(ROOT)}: {target}')
assert not errors, '\n'.join(errors)
print(f'PASS: {len(actual)} skills; {len(files)} distribution files; local links and artifact checks')
