#!/usr/bin/env python3
"""Check a completed handoff; this verifies timing/files, not spoken pronunciation or speaker identity."""
import argparse
import json
import math
import re
from pathlib import Path
from common import digest, wav_info


def timecode(t):
    h, m, s, ms = map(int, re.split('[:,]', t))
    if m >= 60 or s >= 60:
        raise ValueError('Invalid SRT time')
    return h * 3600 + m * 60 + s + ms / 1000


def verify(path):
    path = Path(path).resolve()
    doc = json.loads(path.read_text(encoding='utf-8'))
    if doc.get('schema_version') != 1 or doc.get('timing_method') != 'segment_frames':
        raise ValueError('Unsupported manifest schema')
    for name in [doc['audio'], doc['mp3']] + ([doc['srt']] if doc.get('srt') else []):
        if not isinstance(name,str) or name not in doc['files']:
            raise ValueError('Manifest must hash all deliverables')
    for name, sha in doc['files'].items():
        if Path(name).name != name or digest(path.parent / name) != sha:
            raise ValueError(f'Changed or unsafe artifact: {name}')
    info, _ = wav_info(path.parent / doc['audio'])
    if info['frames'] != doc['total_frames'] or info['sample_rate'] != doc['sample_rate']:
        raise ValueError('PCM duration mismatch')
    if not math.isclose(doc['duration'], info['duration'], abs_tol=1e-9):
        raise ValueError('Manifest duration mismatch')
    segments = doc['segments']
    if not segments:
        raise ValueError('No cues')
    for s in segments:
        if not all(isinstance(s.get(k),(int,float)) and math.isfinite(s[k]) for k in ['start','end','subtitle_end']):
            raise ValueError('Non-finite segment time')
        if not 0 <= s['start'] < s['end'] <= s['subtitle_end'] <= doc['duration']+.00051:
            raise ValueError('Invalid segment bounds')
        if abs(s['start']-s['start_frame']/info['sample_rate'])>1e-9 or abs(s['end']-s['end_frame']/info['sample_rate'])>1e-9:
            raise ValueError('Segment differs from sample frames')
    if digest(path.parent / doc['segments_file']) != doc['segments_sha256']:
        raise ValueError('Segments changed since build; regenerate audio and rebuild')
    if digest(path.parent / doc['source_file']) != doc['source_text_sha256']:
        raise ValueError('Source script changed since build; regenerate the handoff')
    if doc.get('srt'):
        blocks = (path.parent / doc['srt']).read_text(encoding='utf-8-sig').strip().split('\n\n')
        if len(blocks) != len(segments):
            raise ValueError('Cue count mismatch')
        previous = 0
        for i, (block, seg) in enumerate(zip(blocks, segments), 1):
            lines = block.splitlines()
            a, b = map(timecode, lines[1].split(' --> '))
            if lines[0] != str(i) or '\n'.join(lines[2:]) != seg['text']:
                raise ValueError('Cue text or order mismatch')
            if not previous <= a < b <= doc['duration'] + .00051:
                raise ValueError('Overlapping or out-of-range cue')
            if abs(a - seg['start']) > .00051 or abs(b - seg['subtitle_end']) > .00051:
                raise ValueError('Cue differs from PCM timeline')
            previous = b
        if abs(previous-doc['duration'])>.00051:
            raise ValueError('Last cue differs from PCM duration')
    return {'status': 'pass', 'segments': len(segments), 'duration': doc['duration'], 'timing_method': doc['timing_method']}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest')
    args = p.parse_args()
    try:
        print(json.dumps(verify(args.manifest)))
    except (ValueError, KeyError, OSError) as e:
        p.exit(1, f'Error: {e}\n')
