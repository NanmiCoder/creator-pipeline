#!/usr/bin/env python3
"""Save your personal provider/voice outside the skill; no upload or synthesis."""
import argparse
import json
import os
from pathlib import Path
import tempfile
from user_config import PROVIDERS, FIELDS, config_path, load_config


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--provider', choices=PROVIDERS)
    p.add_argument('--voice', help='Your registered MiniMax voice ID; never a shared preset')
    p.add_argument('--reference', help='Your local 3–30 second MP3/WAV reference clip')
    p.add_argument('--reference-text', help='Transcript matching your reference clip')
    args = p.parse_args()
    data = load_config()
    for key in FIELDS:
        value = getattr(args, key)
        if value is not None:
            if key in ('reference', 'reference_text'):
                path = Path(value).resolve()
                if not path.is_file():
                    p.error(f'{key} must be an existing file')
                value = str(path)
                if key == 'reference' and value != data.get('reference') and args.reference_text is None:
                    data.pop('reference_text', None)
            if not value.strip():
                p.error(f'{key} cannot be empty')
            data[key] = value
    if not data:
        p.error('Supply at least one preference')
    path = config_path(); path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as f:
        json.dump(data, f, ensure_ascii=False, indent=2); f.write('\n')
        temporary = f.name
    try:
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
    print(f'Personal voice preferences saved: {path}')


if __name__ == '__main__':
    main()
