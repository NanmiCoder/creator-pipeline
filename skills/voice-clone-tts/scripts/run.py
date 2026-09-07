#!/usr/bin/env python3
"""Script + your reference recording -> voiceover.wav, .mp3, .srt and .json."""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('script')
    p.add_argument('--outdir', required=True)
    p.add_argument('--max-chars', type=float, default=40)
    p.add_argument('--min-chars', type=float, default=8)
    args, synthesis_args = p.parse_known_args()
    src = Path(args.script).resolve()
    out = Path(args.outdir).resolve()
    if not src.is_file():
        p.error('Script does not exist')
    out.mkdir(parents=True, exist_ok=True)
    target = out / 'script.md'
    if src != target:
        shutil.copyfile(src, target)
    scripts = Path(__file__).resolve().parent
    def run(name, *extra):
        subprocess.run([sys.executable, str(scripts / name), *map(str, extra)], check=True)
    run('segment.py', target, '-o', out/'segments.json', '--max-chars', args.max_chars, '--min-chars', args.min_chars)
    run('synth.py', out/'segments.json', *synthesis_args)
    run('build.py', out/'segments.json')
    run('verify.py', out/'voiceover.json')
    print(f'Handoff: {out / "voiceover.json"}')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(e.returncode)
