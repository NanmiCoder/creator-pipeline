#!/usr/bin/env node
// Import the verified voice-clone-tts handoff. Does not invent a visual plan.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseSrt} from '../templates/scripts/srt-cues.mjs';

function pcmInfo(file) {
  const b=fs.readFileSync(file);
  if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')throw new Error('Expected PCM WAV master');
  let format,channels,rate,align,bits,dataBytes;
  for(let offset=12;offset+8<=b.length;) {
    const id=b.toString('ascii',offset,offset+4),size=b.readUInt32LE(offset+4),start=offset+8;
    if(start+size>b.length)throw new Error('Truncated WAV');
    if(id==='fmt '&&size>=16){format=b.readUInt16LE(start);channels=b.readUInt16LE(start+2);rate=b.readUInt32LE(start+4);align=b.readUInt16LE(start+12);bits=b.readUInt16LE(start+14);}
    if(id==='data')dataBytes=size;
    offset=start+size+(size%2);
  }
  if(format!==1||channels!==1||bits!==16||align!==2||!rate||!dataBytes||dataBytes%align)throw new Error('Invalid mono PCM16 master');
  return {rate,frames:dataBytes/align};
}

export function importVoiceover(manifestPath, presentationPath) {
  const file = path.resolve(manifestPath), root = path.dirname(file), project = path.resolve(presentationPath);
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  if (m.schema_version !== 1 || m.timing_method !== 'segment_frames' || !m.srt || !Number.isFinite(m.duration) || m.duration <= 0 ||
      !Array.isArray(m.segments) || !m.segments.length || !Number.isSafeInteger(m.total_frames) || !Number.isSafeInteger(m.sample_rate))
    throw new Error('Expected voiceover.json schema 1 with SRT and positive duration');
  for (const name of [m.audio, m.mp3, m.srt]) {
    if (typeof name !== 'string' || path.basename(name) !== name || !m.files?.[name] || hash(path.join(root, name)) !== m.files[name])
      throw new Error(`Missing, changed or unsafe artifact: ${name}`);
  }
  if (hash(path.resolve(root, m.segments_file)) !== m.segments_sha256)
    throw new Error('Segments changed after build; regenerate the handoff first');
  if (hash(path.resolve(root, m.source_file)) !== m.source_text_sha256)
    throw new Error('Source script changed after build; regenerate the handoff first');
  const pcm=pcmInfo(path.join(root,m.audio));
  if(pcm.rate!==m.sample_rate||pcm.frames!==m.total_frames||Math.abs(pcm.frames/pcm.rate-m.duration)>1e-9)
    throw new Error('Manifest duration differs from PCM audio');
  if(m.segments.some(s=>!['start','end','subtitle_end'].every(k=>Number.isFinite(s[k])) ||
      !Number.isSafeInteger(s.start_frame)||!Number.isSafeInteger(s.end_frame)||s.start_frame<0||s.end_frame<=s.start_frame||
      s.end_frame>pcm.frames||Math.abs(s.start-s.start_frame/pcm.rate)>1e-9||Math.abs(s.end-s.end_frame/pcm.rate)>1e-9||
      s.subtitle_end<s.end||s.subtitle_end>m.duration+.00051))throw new Error('Invalid segment frame/time data');
  const cues = parseSrt(fs.readFileSync(path.join(root, m.srt), 'utf8'));
  if (cues.length !== m.segments.length || cues.some((c, i) => c.text !== m.segments[i].text ||
      Math.abs(c.at-m.segments[i].start)>.00051 || Math.abs(c.end-m.segments[i].subtitle_end)>.00051 ||
      c.end>m.duration+.00051 || (i>0 && c.at<cues[i-1].end)))
    throw new Error('SRT does not match the PCM timeline');
  if(Math.abs(cues.at(-1).end-m.duration)>.00051)throw new Error('Last cue differs from PCM duration');
  if (!fs.existsSync(path.join(project, 'src/registry'))) throw new Error('Scaffold the presentation first');
  const audioDir = path.join(project, 'public/audio');
  fs.mkdirSync(audioDir, {recursive:true});
  for (const name of [m.audio, m.mp3, m.srt]) fs.copyFileSync(path.join(root, name), path.join(audioDir, name));
  const input = {schema_version:1, audio:`audio/${m.audio}`, srt:`public/audio/${m.srt}`, duration:m.duration,
    timing_method:m.timing_method, source_text_sha256:m.source_text_sha256, files:m.files, cues};
  fs.writeFileSync(path.join(project, 'voiceover-input.json'), JSON.stringify(input,null,2)+'\n');
  return input;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (process.argv.length !== 4) {console.error('Usage: node import-voiceover.mjs <voiceover.json> <presentation-dir>');process.exit(1);}
  try { const r=importVoiceover(process.argv[2],process.argv[3]); console.log(`Imported ${r.cues.length} cues, ${r.duration.toFixed(3)}s. Plan scenes from voiceover-input.json.`); }
  catch(e) { console.error(e.message); process.exit(1); }
}
