#!/usr/bin/env python3
"""Explicit cloud-only voice registration. Uploads the supplied recording to MiniMax."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request


def read_json_output(text):
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch == '{':
            try:
                value, _ = decoder.raw_decode(text[i:])
                if isinstance(value, dict) and 'file_id' in value:
                    return value
            except ValueError:
                pass
    raise ValueError('mmx upload did not return a file_id')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('reference')
    p.add_argument('voice_id')
    p.add_argument('--region', choices=['cn','global'], default='global')
    p.add_argument('--denoise', action='store_true')
    args=p.parse_args()
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]',args.voice_id):
        p.error('Voice ID: 8–256 characters, starts with a letter, ends with a letter/digit')
    key=os.environ.get('MINIMAX_API_KEY')
    if not key:
        p.error('Set MINIMAX_API_KEY for this explicit cloud registration; key is never saved to the project')
    host='https://api.minimaxi.com' if args.region=='cn' else 'https://api.minimax.io'
    with tempfile.TemporaryDirectory(prefix='minimax-clone-') as td:
        audio=Path(td)/'reference.mp3'
        subprocess.run(['ffmpeg','-v','error','-nostdin','-i',args.reference,'-vn','-ac','1','-ar','32000','-b:a','128k',str(audio)],check=True)
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(audio)],text=True))
        if not 10<=duration<=300 or audio.stat().st_size>20*1024*1024:
            p.error('MiniMax clone requires a 10–300 second recording no larger than 20 MB')
        print(f'Uploading {duration:.1f}s to MiniMax ({args.region}).',flush=True)
        result=subprocess.run(['mmx','file','upload','--file',str(audio),'--purpose','voice_clone',
            '--output','json','--non-interactive'],check=True,text=True,capture_output=True)
        file_id=read_json_output(result.stdout)['file_id']
        payload={'file_id':int(file_id),'voice_id':args.voice_id,'need_volume_normalization':True,
                 'need_noise_reduction':args.denoise}
        req=urllib.request.Request(host+'/v1/voice_clone',data=json.dumps(payload).encode(),
            headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=120) as response:
            data=json.load(response)
        status=data.get('base_resp',{})
        if status.get('status_code')!=0:
            raise RuntimeError(f"MiniMax clone failed: {status.get('status_code')} {status.get('status_msg','')}")
        print(f'Registered voice: {args.voice_id}. Use --provider minimax --voice {args.voice_id}.')


if __name__=='__main__':
    main()
