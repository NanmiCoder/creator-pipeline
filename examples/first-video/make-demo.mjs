#!/usr/bin/env node
// A reproducible visual example for THIS script, not a template generator for arbitrary narration.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {importVoiceover} from '../../skills/web-video-presentation/scripts/import-voiceover.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..');
const [manifest,outArg]=process.argv.slice(2);
if(!manifest||!outArg)throw new Error('Usage: node make-demo.mjs <voiceover.json> <new-demo-directory>');
const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(here,'script.md'))).digest('hex');
if(m.source_text_sha256!==hash||m.segments.length!==6)throw new Error('Synthesize examples/first-video/script.md with the default segmentation first');
const root=path.resolve(outArg),project=path.join(root,'presentation');
if(fs.existsSync(root)&&fs.readdirSync(root).length)throw new Error('Output directory must be new or empty');
fs.mkdirSync(root,{recursive:true});
execFileSync('bash',[path.join(repo,'skills/web-video-presentation/scripts/scaffold.sh'),project,'--theme=creator-dark'],{stdio:'inherit'});
const input=importVoiceover(manifest,project);
const motions=['文案落版→录音进入→两份输入配对','输入汇入声音→配音波形生成→本地克隆落定','展开音轨→按真实 cue 拆分→时间标记落位→字幕与声轨对齐','时间轴进入网页→文字长成卡片→连接传递→主体焦点推进','同一时钟依次推动文案、声音、画面的焦点','收拢网页→演示播放→分出视频→完成落版'];
const yaml=['srt: presentation/'+input.srt,'audio: '+input.audio,'duration: '+input.duration,'chapters:','  - id: pipeline','    title: 从文案到网页视频','    steps:'];
input.cues.forEach((cue,i)=>yaml.push('      - at: '+cue.at,'        vo: '+JSON.stringify(cue.text),'        scene: pipeline','        screen: '+JSON.stringify(['从一段话，开始创作。','把你的声音，留在作品里。','每一句话，都有落点。','让内容，长成画面。','声音向前，画面跟随。','从一段话，到一部作品。'][i]),'        do: '+JSON.stringify(motions[i])));
fs.writeFileSync(path.join(root,'plan.md'),'# Creator Pipeline 实测样片\n\n```timeline\n'+yaml.join('\n')+'\n```\n\n## 全片视觉约定\n主题 creator-dark；无头像，无外置字幕。预览/自动播放/验帧都保留 16:9 外框。无衬线大字、分层声音卡，实际配音振幅展开成时间轴，再进入画面。主体身份跨步保留。时间来自真实音频/SRT。\n\n## 章节画面备注\n### pipeline\n六段 SRT 内有 21 个动作拍，由 beats.ts 使用 cue 边界编排句内动作，使用章内 time 驱动对象转换。句内动作点为编辑决策，不是词级对齐。?review=1&t=0&steps=1 可以逐拍播放。\n');
execFileSync('npm',['run','gen'],{cwd:project,stdio:'inherit'});
const chapter=path.join(project,'src/chapters/01-pipeline');
// Measured amplitude overview of this run's PCM, not stock decoration.
const wav=fs.readFileSync(path.join(project,'public',input.audio));
let pcm;
for(let at=12;at+8<=wav.length;){const size=wav.readUInt32LE(at+4);if(wav.toString('ascii',at,at+4)==='data'){pcm=wav.subarray(at+8,at+8+size);break;}at+=8+size+(size%2);}
if(!pcm)throw new Error('Missing PCM data for waveform');
const frames=pcm.length/2,bins=Array.from({length:96},(_,i)=>{
 let sum=0,n=0;for(let j=Math.floor(i*frames/96);j<Math.floor((i+1)*frames/96);j++){sum+=(pcm.readInt16LE(j*2)/32768)**2;n++;}return Math.sqrt(sum/Math.max(1,n));
});
const peak=Math.max(...bins);
fs.writeFileSync(path.join(chapter,'waveform.ts'),'export const waveformIsIllustrative = false;\nexport const waveform = '+JSON.stringify(bins.map(x=>Math.max(.06,Number((x/(peak||1)).toFixed(4)))))+';\n');
fs.writeFileSync(path.join(project,'src/registry/chapters.ts'),`import type {ChapterDef} from './types';\nimport Pipeline from '../chapters/01-pipeline/chapter';\nimport {narrations} from '../chapters/01-pipeline/narrations';\nexport const CHAPTERS:ChapterDef[]=[{id:'pipeline',title:'Creator Pipeline',narrations,Component:Pipeline}];\n`);
const html=path.join(project,'index.html');fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace('<title>Presentation</title>','<title>Creator Pipeline · 声音与画面</title>'));
execFileSync('npm',['run','check'],{cwd:project,stdio:'inherit'});
execFileSync('npm',['run','build'],{cwd:project,stdio:'inherit'});
console.log(`Demo ready: ${project}. npm run dev, then ?auto=1 or ?review=1&t=<seconds>.`);
