#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {parseSrt} from './srt-cues.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=JSON.parse(fs.readFileSync(path.join(root,'voiceover-input.json'),'utf8'));
assert.equal(input.audio,'audio/voiceover.wav');
assert.equal(input.srt,'public/audio/voiceover.srt');
for(const name of ['voiceover.wav','voiceover.mp3','voiceover.srt']){
 const data=fs.readFileSync(path.join(root,'public/audio',name));
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),input.files[name],`${name} differs from the imported voiceover; import matching media and timeline together`);
}
const wav=fs.readFileSync(path.join(root,'public',input.audio));
assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
let rate,alignment,frames;
for(let at=12;at+8<=wav.length;){
 const size=wav.readUInt32LE(at+4),id=wav.toString('ascii',at,at+4);
 assert(at+8+size<=wav.length,'Truncated WAV chunk');
 if(id==='fmt '){assert.equal(wav.readUInt16LE(at+8),1);assert.equal(wav.readUInt16LE(at+10),1);rate=wav.readUInt32LE(at+12);alignment=wav.readUInt16LE(at+20);assert.equal(wav.readUInt16LE(at+22),16);}
 if(id==='data'){assert(alignment,'WAV format must precede PCM data');frames=size/alignment;}
 at+=8+size+(size%2);
}
assert.equal(rate,24000);assert(Number.isInteger(frames)&&frames>0);
assert(Math.abs(frames/rate-input.duration)<1/rate,'PCM duration differs from voiceover timeline');
const cues=parseSrt(fs.readFileSync(path.join(root,input.srt),'utf8'));
assert.deepEqual(cues,input.cues,'SRT cues differ from imported voiceover');
assert(cues.at(-1).end<=input.duration+.001,'SRT exceeds the final audio');
console.log(`PASS: bundled narration, PCM duration and ${cues.length} SRT cues match voiceover-input.json`);
