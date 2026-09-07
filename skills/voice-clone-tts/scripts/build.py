#!/usr/bin/env python3
"""Build a PCM master, MP3, segment-level SRT and a hash-bound handoff manifest."""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path
from common import checked_segments, digest, trim_bounds, write_json


def timestamp(seconds):
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('segments')
    p.add_argument('-o', '--out', help='Output basename, default voiceover beside segments.json')
    p.add_argument('--no-srt', action='store_true')
    p.add_argument('--srt', action='store_true', help='Compatibility flag; SRT is already enabled by default')
    p.add_argument('--no-trim', action='store_true')
    p.add_argument('--gap-hold', type=float, default=600, help='Subtitle hold across gaps, milliseconds')
    p.add_argument('--trim-db', type=float, default=-45)
    p.add_argument('--trim-margin', type=float, default=15)
    args = p.parse_args()
    if args.gap_hold < 0 or args.trim_margin < 0 or args.trim_db >= 0:
        p.error('Invalid trim or gap parameters')
    sp = Path(args.segments).resolve()
    doc = json.loads(sp.read_text(encoding='utf-8'))
    prepared = checked_segments(doc, sp.parent)  # All validation precedes replacing deliverables.
    base = Path(args.out).resolve() if args.out else sp.parent / 'voiceover'
    base.parent.mkdir(parents=True, exist_ok=True)
    rate = prepared[0][1]['sample_rate']
    cursor, entries = 0, []
    with tempfile.TemporaryDirectory(prefix='build-', dir=base.parent) as td:
        td = Path(td)
        master, mp3, srt = [td / (base.name + ext) for ext in ('.wav', '.mp3', '.srt')]
        with wave.open(str(master), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(rate)
            for i, (seg, info, raw) in enumerate(prepared):
                first, last = (0, info['frames']) if args.no_trim else trim_bounds(raw, rate, args.trim_db, args.trim_margin)
                raw = raw[first * 2:last * 2]
                frames = len(raw) // 2
                start = cursor
                out.writeframes(raw)
                cursor += frames
                entries.append({'id': seg['id'], 'text': seg['text'], 'chapter': seg['chapter'],
                    'chapter_title': seg.get('chapter_title', ''), 'start_frame': start, 'end_frame': cursor,
                    'start': start / rate, 'end': cursor / rate})
                if i < len(prepared) - 1:
                    gap_ms = float(doc['meta'].get('silence_ms', {}).get(seg.get('boundary', 'sentence'), 180))
                    if not 0 <= gap_ms <= 10000:
                        raise ValueError('Segment pause must be 0–10000 ms')
                    gap = round(gap_ms * rate / 1000)
                    out.writeframes(b'\0' * gap * 2)
                    cursor += gap
        for i, entry in enumerate(entries):
            next_start = entries[i + 1]['start'] if i + 1 < len(entries) else cursor / rate
            entry['subtitle_end'] = next_start if (next_start-entry['end'])*1000 <= args.gap_hold else entry['end']
        subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(master), '-c:a', 'libmp3lame',
                        '-b:a', '128k', '-y', str(mp3)], check=True)
        # MP3 container duration can include encoder padding. Verify its decoded samples instead.
        decoded = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(mp3), '-f', 's16le',
            '-ac', '1', '-ar', str(rate), '-'], check=True, capture_output=True).stdout
        decoded_frames = len(decoded) // 2
        if abs(decoded_frames - cursor) > 1:
            raise ValueError(f'MP3 decoded duration mismatch: {decoded_frames} vs {cursor} frames')
        if not args.no_srt:
            srt.write_text('\n\n'.join(f"{i}\n{timestamp(e['start'])} --> {timestamp(e['subtitle_end'])}\n{e['text']}"
                for i, e in enumerate(entries, 1)) + '\n', encoding='utf-8')
        files = [master, mp3] + ([] if args.no_srt else [srt])
        manifest = {'schema_version': 1, 'timing_method': 'segment_frames', 'audio': master.name,
            'mp3': mp3.name, 'srt': None if args.no_srt else srt.name, 'sample_rate': rate,
            'total_frames': cursor, 'duration': cursor / rate, 'mp3_decoded_frames': decoded_frames,
            'source_text_sha256': doc['meta'].get('source_text_sha256'),
            'source_file': os.path.relpath(Path(doc['meta']['source']) if Path(doc['meta']['source']).is_absolute()
                else sp.parent / doc['meta']['source'], base.parent),
            'segments_sha256': digest(sp), 'segments_file': os.path.relpath(sp, base.parent),
            'provider': doc['meta']['synthesis']['provider'], 'model': doc['meta']['synthesis']['model'],
            'files': {f.name: digest(f) for f in files}, 'segments': entries}
        # Consumers must verify hashes; manifest is replaced last as the commit record.
        for f in files:
            os.replace(f, base.parent / f.name)
        write_json(base.with_suffix('.json'), manifest)
    print(f'Built {base.name}: {len(entries)} segments, {cursor / rate:.3f}s; timing=segment_frames')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)
