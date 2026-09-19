#!/usr/bin/env python3
"""Verify the real MP4 from scripts/export-fixture.tsx (requires ffmpeg, ffprobe, numpy).
Checks every visible frame ID and PTS, plus decoded audio correlation at multiple offsets.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path
import numpy as np


def run(*args):
    return subprocess.check_output(args)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video', type=Path)
    parser.add_argument('reference', type=Path)
    parser.add_argument('--seconds', type=float, default=600)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--start', type=float, default=0)
    args = parser.parse_args()
    path = str(args.video.resolve())
    info = json.loads(run('ffprobe','-v','error','-show_streams','-of','json',path))
    video = next(s for s in info['streams'] if s['codec_type']=='video')
    audio = next(s for s in info['streams'] if s['codec_type']=='audio')
    width, height = video['width'], video['height']
    expected = int(np.ceil(args.seconds * 30 - 1e-9))
    crop_width = int(np.floor(320 * width / 1920 / 2)) * 2
    y = int(8 * height / 1080)
    barcode = run('ffmpeg','-v','error','-i',path,'-an','-vf',
        f'crop={crop_width}:2:0:{y},scale=20:1:flags=area,format=gray',
        '-fps_mode','passthrough','-f','rawvideo','-')
    pixels = np.frombuffer(barcode,dtype=np.uint8).reshape(-1,20)
    ids = ((pixels > 127).astype(np.int64) * (1 << np.arange(20))).sum(axis=1)
    assert len(ids) == expected, f'{len(ids)} frames, expected {expected}'
    bad = np.flatnonzero(ids != np.arange(expected))
    assert not len(bad), f'Incorrect, repeated or reordered frames: {bad[:20].tolist()}'
    packets = json.loads(run('ffprobe','-v','error','-select_streams','v','-show_packets',
        '-show_entries','packet=pts_time,duration_time','-of','json',path))['packets']
    pts = np.sort([float(p['pts_time']) for p in packets])
    assert len(pts) == expected
    pts_error = float(np.max(np.abs(pts - np.arange(expected)/30)))
    assert pts_error < 0.00002, f'Incorrect PTS: {pts_error}'
    duration = float(video['duration'])
    assert abs(duration-args.seconds) < 0.0001, (duration,args.seconds)
    windows = sorted(set([0,max(0,args.seconds*.25),max(0,args.seconds*.5),max(0,args.seconds-2)]))
    audio_checks = []
    # Decode with the container edit list applied, exactly as a player should.
    with tempfile.TemporaryDirectory(prefix='export-audio-') as tmp:
        decoded = Path(tmp)/'decoded.f32'; reference=Path(tmp)/'reference.f32'
        for source,dest in [(path,decoded),(str(args.reference.resolve()),reference)]:
            run('ffmpeg','-v','error','-i',source,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le',str(dest))
        x=np.memmap(decoded,dtype=np.float32,mode='r'); y=np.memmap(reference,dtype=np.float32,mode='r')
        for at in windows:
            start=int(at*48000); reference_start=start+round(args.start*48000); size=min(48000,len(y)-reference_start)
            guard=min(4800,start); left=start-guard
            ref=np.asarray(y[reference_start:reference_start+size],dtype=np.float64)
            out=np.asarray(x[left:min(len(x),start+size+4800)],dtype=np.float64)
            n=1 << (len(out)+len(ref)-1).bit_length()
            corr=np.fft.irfft(np.fft.rfft(out,n)*np.conj(np.fft.rfft(ref,n)),n)
            lag=int(np.argmax(corr[:len(out)-len(ref)+1]))
            offset=lag-guard
            matched=out[lag:lag+len(ref)]
            similarity=float(np.dot(ref,matched)/max(1e-12,np.linalg.norm(ref)*np.linalg.norm(matched)))
            assert abs(offset)<=2, f'Audio drift at {at}s: {offset} samples'
            assert similarity>.9, f'Audio content mismatch at {at}s: {similarity}'
            audio_checks.append({'at_seconds':at,'offset_samples':offset,'correlation':similarity})
    report={'file':path,'resolution':[width,height],'video_duration':duration,
        'audio_container_duration':float(audio['duration']),'frames':len(ids),'fps':30,
        'bad_visible_frame_ids':len(bad),'max_pts_error_seconds':pts_error,'audio_checks':audio_checks}
    print(json.dumps(report,indent=2))
    if args.report: args.report.write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__': main()
