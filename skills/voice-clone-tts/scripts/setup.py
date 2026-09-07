#!/usr/bin/env python3
"""Install one backend in a separate Python 3.12 environment; models download on first synthesis."""
import argparse
import os
import platform
import shutil
import subprocess
from pathlib import Path
from providers import NANO_COMMIT
from user_config import configured_provider


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--provider', choices=['auto', 'local', 'nano', 'mlx', 'qwen', 'minimax'], default='auto')
    p.add_argument('--env', help='Environment directory; default .creator-env/<provider> in this project')
    args = p.parse_args()
    args.provider = configured_provider(args.provider)
    print(f'Backend: {args.provider}', flush=True)
    if not shutil.which('uv'):
        p.error('Install uv first: https://docs.astral.sh/uv/getting-started/installation/')
    if not shutil.which('ffmpeg'):
        p.error('Install FFmpeg first; macOS: brew install ffmpeg; Ubuntu: sudo apt install ffmpeg')
    if args.provider == 'mlx' and (platform.system() != 'Darwin' or platform.machine() != 'arm64'):
        p.error('MLX requires Apple Silicon. Use qwen for the official PyTorch backend.')
    env = Path(args.env or f'.creator-env/{args.provider}').resolve()
    python = env / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        subprocess.run(['uv', 'venv', '--python', '3.12', str(env)], check=True)
    def install(*packages, extra=()):
        subprocess.run(['uv', 'pip', 'install', '--python', str(python), *extra, *packages], check=True)
    if args.provider == 'nano':
        # Linux/Windows use CPU wheels explicitly; avoid downloading the CUDA stack for this CPU backend.
        extra = () if platform.system() == 'Darwin' else ('--index-url', 'https://download.pytorch.org/whl/cpu')
        install('torch==2.7.0', 'torchaudio==2.7.0', extra=extra)
        install('numpy==2.2.6', 'sentencepiece==0.2.1', 'onnxruntime==1.22.1',
                'huggingface-hub==0.36.2', 'soundfile==0.13.1')
        install(f'moss-tts-nano @ git+https://github.com/OpenMOSS/MOSS-TTS-Nano.git@{NANO_COMMIT}',
                extra=('--no-deps',))
    elif args.provider == 'mlx':
        install('mlx-audio==0.5.1')
    elif args.provider == 'qwen':
        install('qwen-tts==0.1.1')
    else:
        print('MiniMax also needs the official mmx CLI and your own speech-capable account.')
    print(f'Python ready: {python}')
    print('MiniMax uses your configured mmx account and registered voice ID.' if args.provider == 'minimax'
          else 'Model weights are public downloads; local inference needs no API key.')


if __name__ == '__main__':
    main()
