import array
import copy
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'skills/voice-clone-tts/scripts'
sys.path.insert(0, str(SCRIPTS))
from common import checked_segments, digest, fingerprint, trim_bounds, wav_info, write_json
from segment import parse_chapters, build_segments, hard_wrap
from verify import verify
from providers import MiniMax


class VoiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.doc = {'meta': {'synthesis': {'provider':'test', 'model':'fixture', 'reference_sha256':'a'},
                            'silence_ms': {'sentence':180}}, 'segments': []}
        source=self.root/'script.md';source.write_text('文案变成声音。声音带动画面。')
        self.doc['meta'].update(source=str(source),source_text_sha256=digest(source))
        for i, text in enumerate(['文案变成声音。', '声音带动画面。'], 1):
            wav = self.root / f'{i}.wav'
            samples = array.array('h', [round(8000*math.sin(n*.1)) for n in range(24000)])
            with wave.open(str(wav),'wb') as w:
                w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(samples.tobytes())
            seg = {'id':i,'text':text,'chapter':0,'boundary':'sentence','status':'ready','wav':wav.name,'audio_sha256':digest(wav)}
            seg['fingerprint'] = fingerprint(seg, self.doc['meta'])
            self.doc['segments'].append(seg)
        self.sp = self.root/'segments.json'
        write_json(self.sp,self.doc)

    def tearDown(self):
        self.tmp.cleanup()

    def test_changed_reference_and_parameters_invalidate_cache(self):
        seg = self.doc['segments'][0]
        before = fingerprint(seg,self.doc['meta'])
        for key,value in [('reference_sha256','b'),('model','new'),('provider','other'),('temperature',.9)]:
            m = copy.deepcopy(self.doc['meta']);m['synthesis'][key]=value
            self.assertNotEqual(before,fingerprint(seg,m))

    def test_changed_script_cannot_build_old_audio(self):
        self.doc['segments'][0]['text']='已经改稿。'
        with self.assertRaisesRegex(ValueError,'stale'):
            checked_segments(self.doc,self.root)

    def test_targeted_seed_only_invalidates_its_segment(self):
        before=[fingerprint(s,self.doc['meta']) for s in self.doc['segments']]
        self.doc['segments'][1]['seed_override']=3
        after=[fingerprint(s,self.doc['meta']) for s in self.doc['segments']]
        self.assertEqual(before[0],after[0]);self.assertNotEqual(before[1],after[1])

    def test_resegmentation_keeps_approved_seed_for_unchanged_text(self):
        source=self.root/'script.md';source.write_text('保留这一句话。\n\n这是另一句话。')
        command=[sys.executable,str(SCRIPTS/'segment.py'),str(source),'-o',str(self.sp),'--min-chars','1']
        subprocess.run(command,check=True,capture_output=True)
        doc=json.loads(self.sp.read_text());doc['segments'][1]['seed_override']=77;write_json(self.sp,doc)
        subprocess.run(command,check=True,capture_output=True)
        self.assertEqual(json.loads(self.sp.read_text())['segments'][1]['seed_override'],77)
        source.write_text('保留这一句话。\n\n第二句话已改稿。')
        subprocess.run(command,check=True,capture_output=True)
        self.assertNotIn('seed_override',json.loads(self.sp.read_text())['segments'][1])

    def test_cloud_speech_contract_keeps_text_as_one_argument(self):
        settings={'voice':'UserVoice01','model':'speech-2.8-hd','sample_rate':24000}
        with patch('providers.subprocess.run') as run:
            MiniMax(settings,None,None).generate('Say $HOME; `test`',self.root/'out.wav',0)
        command=run.call_args.args[0]
        self.assertEqual(command[command.index('--text')+1],'Say $HOME; `test`')
        self.assertEqual(command[command.index('--voice')+1],'UserVoice01')
        self.assertEqual(command[command.index('--format')+1],'wav')
        self.assertNotIn('shell',run.call_args.kwargs)

    def test_chapter_override_cannot_replace_the_script(self):
        chapters=self.root/'chapters.json';chapters.write_text('[{"title":"章节","text":"另一个故事。"}]')
        r=subprocess.run([sys.executable,str(SCRIPTS/'segment.py'),str(self.root/'script.md'),
                          '--chapters',str(chapters),'-o',str(self.root/'new.json')],capture_output=True)
        self.assertNotEqual(r.returncode,0)
        self.assertFalse((self.root/'new.json').exists())

    def test_changed_source_file_cannot_reuse_old_segments(self):
        (self.root/'script.md').write_text('这是一份新文案。')
        with self.assertRaisesRegex(ValueError,'Source script changed'):
            checked_segments(self.doc,self.root)

    def test_modified_wave_rejected_even_with_same_filename(self):
        (self.root/'1.wav').write_bytes((self.root/'2.wav').read_bytes()[:-2])
        with self.assertRaises(ValueError):checked_segments(self.doc,self.root)

    def test_numbered_content_is_not_dropped_as_heading(self):
        ch=parse_chapters('## 标题\n1. 先录音\n2. 再生成字幕\n\n保留正文。')
        text=''.join(s['text'] for s in build_segments(ch,40,8))
        self.assertIn('1. 先录音',text);self.assertIn('2. 再生成字幕',text)
        self.assertNotIn('标题',text)

    def test_english_line_break_keeps_word_boundary(self):
        self.assertEqual(parse_chapters('Hello\nworld.')[0]['paragraphs'],['Hello world.'])

    def test_long_technical_atoms_are_not_split(self):
        text='使用 Qwen3-TTS-12Hz-0.6B 生成声音。'
        self.assertIn('Qwen3-TTS-12Hz-0.6B',''.join(hard_wrap(text,8)))

    def test_relative_audio_always_resolves_from_manifest(self):
        previous=Path.cwd()
        try:
            os.chdir('/')
            self.assertEqual(len(checked_segments(self.doc,self.root)),2)
        finally:os.chdir(previous)

    def test_build_and_import_exact_pcm_duration(self):
        r=subprocess.run([sys.executable,str(SCRIPTS/'build.py'),str(self.sp),'--no-trim'],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stderr)
        result=verify(self.root/'voiceover.json')
        self.assertEqual(result['duration'],2.18)
        self.assertEqual(result['segments'],2)
        project=self.root/'presentation';(project/'src/registry').mkdir(parents=True)
        cmd=['node',str(SCRIPTS.parents[1]/'web-video-presentation/scripts/import-voiceover.mjs'),str(self.root/'voiceover.json'),str(project)]
        r=subprocess.run(cmd,capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertTrue((project/'public/audio/voiceover.wav').exists())
        manifest=self.root/'voiceover.json'
        original=json.loads(manifest.read_text())
        for mutate in [lambda d:d.update(duration=d['duration']*2),
                       lambda d:d.update(timing_method='estimated_from_characters'),
                       lambda d:d['segments'][0].pop('start')]:
            broken=copy.deepcopy(original);mutate(broken);write_json(manifest,broken)
            self.assertNotEqual(subprocess.run(cmd,capture_output=True).returncode,0)
        write_json(manifest,original)
        self.doc['segments'][0]['text']='修改后不能误用旧产物'
        write_json(self.sp,self.doc)
        with self.assertRaisesRegex(ValueError,'changed'):verify(self.root/'voiceover.json')
        self.assertNotEqual(subprocess.run(cmd,capture_output=True).returncode,0)

    def test_failed_segment_preserves_previous_deliverables(self):
        target=self.root/'voiceover.wav';target.write_bytes(b'previous good delivery')
        self.doc['segments'][1]['status']='failed';write_json(self.sp,self.doc)
        r=subprocess.run([sys.executable,str(SCRIPTS/'build.py'),str(self.sp)],capture_output=True)
        self.assertNotEqual(r.returncode,0)
        self.assertEqual(target.read_bytes(),b'previous good delivery')

    def test_silent_wav_is_not_a_successful_voiceover(self):
        p=self.root/'silent.wav'
        with wave.open(str(p),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(b'\0'*48000)
        with self.assertRaisesRegex(ValueError,'Silent'):wav_info(p)


if __name__=='__main__':unittest.main()
