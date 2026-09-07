#!/usr/bin/env python3
"""Clone locally by default; cache audio by all inputs, and checkpoint each successful segment."""
import argparse
import importlib.metadata
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path
from common import digest, fingerprint, normalize_audio, wav_info, write_json
from providers import BACKENDS, MODELS, REVISIONS, NANO_COMMIT, NANO_TOKENIZER_REVISION, auto_provider


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('segments')
    p.add_argument('--provider', choices=['auto', *BACKENDS], default='auto')
    p.add_argument('--reference', help='Your reference MP3/WAV; local backends keep it on this computer')
    p.add_argument('--reference-text', help='Optional UTF-8 transcript file matching the reference clip')
    p.add_argument('--voice', help='MiniMax voice ID, required only for the cloud backend')
    p.add_argument('--model', help='Model ID or local model directory')
    p.add_argument('--language', default='Chinese')
    p.add_argument('--device', default='auto', help='qwen: auto, cpu or cuda:0')
    p.add_argument('--temperature', type=float, default=.8)
    p.add_argument('--max-tokens', type=int, default=800)
    p.add_argument('--seed', type=int, default=0)
    p.add_argument('--segment-seed', action='append', default=[], metavar='ID:SEED',
                   help='Override one segment seed; repeat this option for targeted retries')
    p.add_argument('--clear-segment-seeds', action='store_true',
                   help='Explicitly clear saved per-segment seeds before applying new overrides')
    p.add_argument('--threads', type=int, default=4, help='Nano CPU threads')
    p.add_argument('--force', action='store_true')
    args = p.parse_args()
    if not shutil.which('ffmpeg'):
        p.error('ffmpeg is required. See references/SETUP.md.')
    provider = auto_provider() if args.provider == 'auto' else args.provider
    if provider == 'minimax':
        if not args.voice or not shutil.which('mmx'):
            p.error('MiniMax requires mmx and --voice YOUR_VOICE_ID. No local voice is uploaded automatically.')
    elif not args.reference or not Path(args.reference).is_file():
        p.error('Local cloning requires --reference your-recording.mp3')
    if args.max_tokens <= 0 or args.threads <= 0 or not 0 < args.temperature <= 2:
        p.error('max-tokens must be positive; temperature must be in (0, 2]')
    sp = Path(args.segments).resolve()
    doc = json.loads(sp.read_text(encoding='utf-8'))
    if not doc.get('segments'):
        p.error('No segments')
    overrides = {}
    for value in args.segment_seed:
        try:
            ident, seed = map(int, value.split(':'))
        except ValueError:
            p.error('segment-seed must be ID:INTEGER')
        if ident not in {s['id'] for s in doc['segments']} or seed < 0:
            p.error('segment-seed requires an existing segment ID and a nonnegative seed')
        overrides[ident] = seed
    out = sp.parent / 'wav'
    out.mkdir(exist_ok=True)
    ref_text = Path(args.reference_text).read_text(encoding='utf-8').strip() if args.reference_text else None
    if args.reference_text and not ref_text:
        p.error('Reference transcript is empty')
    package = {'nano': 'moss-tts-nano', 'mlx': 'mlx-audio', 'qwen': 'qwen-tts', 'minimax': None}[provider]
    try:
        version = importlib.metadata.version(package) if package else 'mmx'
    except importlib.metadata.PackageNotFoundError:
        p.error(f'{package} is not installed in this Python environment. Run setup.py --provider {provider}.')
    settings = dict(provider=provider, model=args.model or MODELS[provider], language=args.language,
        device=args.device, temperature=args.temperature, max_tokens=args.max_tokens, seed=args.seed,
        voice=args.voice if provider == 'minimax' else None, sample_rate=24000,
        reference_sha256=digest(args.reference) if provider != 'minimax' else None,
        reference_text=ref_text, runtime_version=version, adapter_version=1, threads=args.threads,
        model_revision=REVISIONS.get(provider) if not args.model or args.model == MODELS[provider] else 'custom',
        nano_source=NANO_COMMIT if provider == 'nano' else None,
        tokenizer_revision=NANO_TOKENIZER_REVISION if provider == 'nano' else None)
    if args.model and Path(args.model).is_dir():
        settings['local_model_files'] = {str(f.relative_to(args.model)): digest(f)
            for f in sorted(Path(args.model).rglob('*')) if f.is_file() and f.suffix in
            ('.json', '.safetensors', '.onnx', '.data', '.bin', '.pt', '.model')}
    doc['meta']['synthesis'] = settings
    pending = []
    for seg in doc['segments']:
        if args.clear_segment_seeds:
            seg.pop('seed_override', None)
        if seg['id'] in overrides:
            seg['seed_override'] = overrides[seg['id']]
        fp = fingerprint(seg, doc['meta'])
        dst = out / f"{seg['id']:04d}_{fp[:20]}.wav"
        marker = dst.with_suffix('.json')
        cached = False
        if not args.force and dst.exists() and marker.exists():
            try:
                record = json.loads(marker.read_text())
                info, _ = wav_info(dst)
                cached = record.get('fingerprint') == fp and record.get('sha256') == digest(dst)
            except (ValueError, OSError, EOFError):
                pass
        seg.update(fingerprint=fp, status='ready' if cached else 'pending',
            wav=str(dst.relative_to(sp.parent)) if cached else None,
            audio_sha256=digest(dst) if cached else None)
        if cached:
            seg['duration_ms'] = info['duration'] * 1000
        else:
            pending.append((seg, dst, marker))
    # Clear stale references before loading a model or starting a paid request.
    write_json(sp, doc)
    if not pending:
        print(f"{len(doc['segments'])}/{len(doc['segments'])} ready (cache); no model loaded")
        return 0
    print(f"Backend: {provider}; {len(pending)} pending. First use downloads public model weights.", flush=True)
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix='voice-clone-', dir=sp.parent) as td:
        td = Path(td)
        ref = td / 'reference.wav'
        if provider != 'minimax':
            info = normalize_audio(args.reference, ref)
            if not 3 <= info['duration'] <= 30:
                p.error('Use a clean 3–30 second reference clip. Trim it explicitly first; transcript must match.')
        backend = BACKENDS[provider](settings, ref, ref_text)
        for seg, dst, marker in pending:
            native, normalized = td / 'native.wav', td / 'normalized.wav'
            try:
                backend.generate(seg['text'], native, seg.get('seed_override', args.seed + seg['id']))
                info = normalize_audio(native, normalized)
                if info['duration'] >= args.max_tokens / 12.5 - .5 and provider in ('mlx', 'qwen'):
                    raise ValueError('Generation reached the duration cap; inspect/retry instead of publishing truncated speech')
                os.replace(normalized, dst)
                sha = digest(dst)
                write_json(marker, {'fingerprint': seg['fingerprint'], 'sha256': sha})
                seg.update(status='ready', wav=str(dst.relative_to(sp.parent)), audio_sha256=sha,
                           duration_ms=info['duration'] * 1000)
                write_json(sp, doc)
                print(f"  {seg['id']}: {info['duration']:.3f}s", flush=True)
            except Exception:
                seg.update(status='failed', wav=None, audio_sha256=None)
                write_json(sp, doc)
                raise
    print(f"{len(doc['segments'])}/{len(doc['segments'])} ready; {time.perf_counter()-started:.1f}s elapsed")
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, RuntimeError) as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)
