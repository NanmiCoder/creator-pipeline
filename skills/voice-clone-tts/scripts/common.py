"""Shared file and audio contracts. Core pipeline uses only the Python standard library."""
import array
import hashlib
import json
import os
import subprocess
import wave
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp, path)


def fingerprint(seg, meta):
    key = {'text': seg['text'], 'synthesis': meta['synthesis']}
    if 'seed_override' in seg:
        key['seed_override'] = seg['seed_override']
    return hashlib.sha256(json.dumps(key, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def wav_info(path, require_signal=True):
    try:
        with wave.open(str(path), 'rb') as w:
            channels, width, rate, frames = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            raw = w.readframes(frames)
    except (wave.Error, EOFError) as e:
        raise ValueError(f'Invalid WAV: {path}') from e
    if channels != 1 or width != 2 or rate <= 0 or frames == 0 or len(raw) != frames * channels * width:
        raise ValueError(f'Invalid or truncated mono PCM16 WAV: {path}')
    if require_signal and not any(raw):
        raise ValueError(f'Silent output: {path}')
    return {'sample_rate': rate, 'frames': frames, 'duration': frames / rate}, raw


def normalize_audio(source, dest, sample_rate=24000):
    subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(source), '-vn', '-ac', '1',
                    '-ar', str(sample_rate), '-c:a', 'pcm_s16le', '-y', str(dest)], check=True)
    return wav_info(dest)[0]


def checked_segments(doc, base):
    """Never combine stale audio after a text, reference, model or setting change."""
    segments = doc.get('segments', [])
    if not segments or 'synthesis' not in doc.get('meta', {}):
        raise ValueError('No synthesized segments. Run synth.py first.')
    source = Path(doc['meta']['source'])
    if not source.is_absolute():
        source = Path(base) / source
    if digest(source) != doc['meta'].get('source_text_sha256'):
        raise ValueError('Source script changed since segmentation. Run the full pipeline again.')
    ids = [s['id'] for s in segments]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate segment ids')
    result = []
    for seg in segments:
        if seg.get('status') != 'ready' or seg.get('fingerprint') != fingerprint(seg, doc['meta']):
            raise ValueError(f"Segment {seg['id']} is missing or stale. Run synth.py again.")
        path = Path(seg['wav'])
        if not path.is_absolute():
            path = Path(base) / path
        info, raw = wav_info(path)
        if digest(path) != seg.get('audio_sha256'):
            raise ValueError(f"Segment {seg['id']} audio has changed. Re-synthesize it.")
        result.append((seg, info, raw))
    rates = {info['sample_rate'] for _, info, _ in result}
    if len(rates) != 1:
        raise ValueError('Segment sample rates differ')
    return result


def trim_bounds(raw, rate, db=-45, margin_ms=15):
    samples = array.array('h', raw)
    if os.sys.byteorder != 'little':
        samples.byteswap()
    peak = max(map(abs, samples), default=0)
    if not peak:
        raise ValueError('Silent output')
    threshold = peak * 10 ** (db / 20)
    first = next(i for i, x in enumerate(samples) if abs(x) > threshold)
    last = len(samples) - next(i for i, x in enumerate(reversed(samples)) if abs(x) > threshold)
    margin = round(rate * margin_ms / 1000)
    return max(0, first - margin), min(len(samples), last + margin)
