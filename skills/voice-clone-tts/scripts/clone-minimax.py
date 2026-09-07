#!/usr/bin/env python3
"""Explicit cloud-only registration: upload your recording to MiniMax, return your voice ID."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request
import uuid


def credentials(region=None):
    # Follow the installed mmx CLI: configured API key first. Never mix accounts
    # between upload and clone; MINIMAX_API_KEY is a fallback when no key is saved.
    path = Path(os.environ.get('MMX_CONFIG_DIR', Path.home() / '.mmx')) / 'config.json'
    config = json.loads(path.read_text()) if path.exists() else {}
    key = config.get('api_key') or os.environ.get('MINIMAX_API_KEY')
    region = region or os.environ.get('MINIMAX_REGION') or config.get('region') or 'global'
    if not key:
        raise ValueError('Voice registration needs a MiniMax API key: configure mmx auth login or MINIMAX_API_KEY.')
    if region not in ('cn', 'global'):
        raise ValueError('MiniMax region must be cn or global')
    return key, region


def request_json(url, key, body, content_type):
    req = urllib.request.Request(url, data=body, headers={
        'Authorization': 'Bearer ' + key, 'Content-Type': content_type})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.load(response)
    except urllib.error.HTTPError as e:
        # Never include request headers, credentials or a raw response in errors.
        raise RuntimeError(f'MiniMax HTTP {e.code}; check account permissions and region') from None
    status = result.get('base_resp', {})
    if status.get('status_code') != 0:
        raise RuntimeError(f"MiniMax status {status.get('status_code')}: {status.get('status_msg', '')}")
    return result


def audio_info(path):
    path = Path(path)
    if not path.is_file() or path.suffix.lower() not in ('.mp3', '.m4a', '.wav'):
        raise ValueError('Supply an existing MP3, M4A or WAV recording')
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration', '-of', 'csv=p=0', str(path)], text=True))
    if path.stat().st_size > 20 * 1024 * 1024:
        raise ValueError('Recording exceeds 20 MB')
    return path, duration


def upload(host, key, path, purpose):
    boundary = 'creator-' + uuid.uuid4().hex
    head = (f'--{boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\n{purpose}\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="reference{path.suffix.lower()}"\r\n'
            'Content-Type: application/octet-stream\r\n\r\n').encode()
    body = head + path.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
    result = request_json(host + '/v1/files/upload', key, body, 'multipart/form-data; boundary=' + boundary)
    return int(result['file']['file_id'])


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('reference')
    p.add_argument('voice_id')
    p.add_argument('--region', choices=['cn', 'global'])
    p.add_argument('--prompt-audio', help='Optional matching prompt clip shorter than 8 seconds')
    p.add_argument('--prompt-text', help='UTF-8 transcript file matching --prompt-audio exactly')
    p.add_argument('--denoise', action='store_true')
    p.add_argument('--out', help='Optional local voice receipt JSON; never contains credentials')
    args = p.parse_args()
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]', args.voice_id):
        p.error('Voice ID: 8–256 characters, starts with a letter, ends with a letter/digit')
    if bool(args.prompt_audio) != bool(args.prompt_text):
        p.error('--prompt-audio and --prompt-text must be supplied together')
    reference, duration = audio_info(args.reference)
    if not 10 <= duration <= 300:
        p.error('MiniMax reference must be 10–300 seconds')
    prompt = None
    if args.prompt_audio:
        prompt, seconds = audio_info(args.prompt_audio)
        transcript = Path(args.prompt_text).read_text(encoding='utf-8').strip()
        if not 0 < seconds < 8 or not transcript:
            p.error('Prompt must be shorter than 8 seconds with a non-empty matching transcript')
    key, region = credentials(args.region)
    host = 'https://api.minimaxi.com' if region == 'cn' else 'https://api.minimax.io'
    print(f'Uploading {duration:.2f}s reference to MiniMax ({region}).', flush=True)
    payload = {'file_id': upload(host, key, reference, 'voice_clone'), 'voice_id': args.voice_id,
               'need_volume_normalization': True, 'need_noise_reduction': args.denoise}
    if prompt:
        payload['clone_prompt'] = {'prompt_audio': upload(host, key, prompt, 'prompt_audio'), 'prompt_text': transcript}
    request_json(host + '/v1/voice_clone', key, json.dumps(payload).encode(), 'application/json')
    if args.out:
        receipt = {'provider': 'minimax', 'voice': args.voice_id, 'region': region,
                   'reference_sha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
                   'reference_duration': duration, 'denoise': args.denoise,
                   'prompt_sha256': hashlib.sha256(prompt.read_bytes()).hexdigest() if prompt else None}
        dest = Path(args.out); dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(f'Registered voice: {args.voice_id}. Use --provider minimax --voice {args.voice_id}.')


if __name__ == '__main__':
    main()
