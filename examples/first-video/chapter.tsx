import {useReducedMotion} from '../../hooks/useReducedMotion';
import type {ChapterStepProps} from '../../registry/types';
import {progress, mix, linear} from '../../motion/sample';
import {timing} from './timing';
import {waveform} from './waveform';
import './chapter.css';

const titles=[['从一段话，','开始创作。'],['把你的声音，','留在作品里。'],['每一句话，','都有落点。'],['让内容，','长成画面。'],['声音向前，','画面跟随。'],['从一段话，','到一部作品。']];
const captions=['一份文案 · 一段录音','Qwen3-TTS · 本地声音克隆','声音与字幕，共用一条时间轴','文字成形，关系展开','同一时钟，推进同一场景','网页演示 · 视频录制'];
const duration=timing[5]!.end;
const clock=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toFixed(2).padStart(5,'0')}`;
const place=(x:number,y:number,s=1,r=0)=>`translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;

function Wave({fill=1}: {fill?:number}) {
  return <svg viewBox="0 0 640 160" className="pi-wave" aria-label="配音的实际振幅概览">
    {waveform.map((v,i)=><rect key={i} x={i*6.65} y={80-v*68} width="3.7" height={Math.max(4,v*136)} rx="1.8"
      className={i/waveform.length<=fill?'pi-wave-lit':'pi-wave-dim'}/>)}
  </svg>;
}

export default function Pipeline({step,time=0}:ChapterStepProps) {
  const reduced=useReducedMotion();
  const at=(n:number)=>timing[n]!.at;
  const phase=(n:number,d=.85)=>reduced?(step>=n?1:0):progress(time,at(n),d);
  const intro=reduced?1:progress(time,0,.85),voice=phase(1),cues=phase(2),scene=phase(3),done=step===5?phase(5):0;
  const index=Math.min(step,5),p=reduced?0:progress(time,at(4),timing[4]!.end-at(4),linear);
  const screenX=mix(755,790,done),screenY=mix(238,242,done),screenS=mix(1,.89,done);
  const tickX=58+764*Math.min(time/duration,1);
  const voiceX=mix(mix(1190,910,voice),108,scene),voiceY=mix(mix(548,324,voice),744,scene);
  const voiceS=mix(mix(.75,1,voice),.61,scene);
  return <div className="pi-root">
    <div className="pi-light"/>
    <div className="pi-masthead"><span className="pi-mark"><i/><i/><i/></span><b>Creator Pipeline</b><span className="pi-edition">WORDS INTO MOTION</span></div>
    <div className="pi-count"><b>{String(index+1).padStart(2,'0')}</b><span>/ 06</span></div>
    <div className="pi-heading" style={{opacity:intro,transform:`translateY(${mix(26,0,intro)}px)`}}>
      <div className="pi-kicker">{['SCRIPT & VOICE','YOUR VOICE','THE TIMELINE','MOTION DESIGN','IN SYNC','READY TO PLAY'][index]}</div>
      <h1>{titles[index]![0]}<br/><em>{titles[index]![1]}</em></h1>
      <p>{captions[index]}</p>
      <div className="pi-section-line"><span/>{String(index+1).padStart(2,'0')}</div>
    </div>
    <div className="pi-document" style={{transform:place(mix(950,900,voice)+mix(60,0,intro),mix(244,226,voice),mix(1,.78,voice),mix(-9,-13,voice)),opacity:intro*(1-scene)*(1-cues*.8)}}>
      <div className="pi-document-top"><span>文案</span><span className="pi-filetype">MD</span></div>
      <div className="pi-typesample">Aa<span>字</span></div>
      <div className="pi-script">先准备一份文案，<br/><strong>再放入自己的录音。</strong></div>
      <div className="pi-document-foot"><span>script.md</span><span>01</span></div>
    </div>
    <div className="pi-voice" style={{transform:place(voiceX,voiceY+mix(70,0,intro),voiceS,mix(7,0,voice)),opacity:intro}}>
      <div className="pi-voice-top"><div className="pi-voice-symbol"><span/><span/><span/><span/></div><div><small>{step===0?'参考录音':'克隆配音'}</small><h2>你的声音</h2></div><span className="pi-local-dot"/></div>
      <Wave fill={step===1?progress(time,at(1),2.6,linear):1}/>
      <div className="pi-voice-foot"><span>{step===0?'REFERENCE AUDIO':'QWEN3-TTS'}</span><span>{step>=2?clock(duration):'VOICE CLONE'}</span></div>
    </div>
    <div className="pi-screen" style={{opacity:scene,transform:place(screenX,mix(275,screenY,scene),screenS)}}>
      <div className="pi-screen-bar"><span className="pi-window-dots"><i/><i/><i/></span><span>Creator Pipeline</span><span className="pi-screen-ratio">16:9</span></div>
      <div className="pi-screen-content">
        <div className="pi-preview-label">从想法，到画面</div>
        <h2>让想法<br/><em>被看见。</em></h2>
        <svg className="pi-sculpture" viewBox="0 0 470 390" aria-label="一条声音曲线展开成连续画面">
          {Array.from({length:18},(_,i)=>{
            const reveal=reduced?1:progress(time,at(3)+i*.035,.8),r=56+i*7.1;
            return <ellipse key={i} cx={246+Math.sin(i*.3)*20*p} cy="201" rx={r*reveal} ry={r*.68}
              transform={`rotate(${-40+i*4.4+p*26} 246 201)`} className={i%5===0?'pi-sculpture-bright':'pi-sculpture-line'}/>;
          })}
          <path d="M226 182L261 201 226 221Z" className="pi-wave-lit"/>
        </svg>
        <div className="pi-screen-caption"><svg className="pi-small-arrow" viewBox="0 0 24 24"><path d="M5 19L19 5M6 5h13v13"/></svg><span>声音 · 节奏 · 画面</span></div>
      </div>
    </div>
    <div className="pi-timeline" style={{opacity:cues,transform:place(mix(876,screenX+52*screenS,scene),mix(792,screenY+542*screenS,scene),mix(1,screenS,scene))}}>
      <div className="pi-timeline-head"><span>{scene>.5?'声画时间轴':'SRT 时间轴'}</span><span>{clock(Math.min(time,duration))}<i> / {clock(duration)}</i></span></div>
      <svg viewBox="0 0 880 130" className="pi-tracks" aria-label="来自 SRT 的六个语音片段">
        <text x="0" y="32" className="pi-track-label">VO</text><text x="0" y="91" className="pi-track-label">SRT</text>
        {timing.map((cue,i)=>{
          const x=58+cue.at/duration*764,w=(cue.end-cue.at)/duration*764-4;
          return <g key={i} opacity={reduced?1:progress(time,at(2)+i*.07,.45)}>
            <rect x={x} y="9" width={w} height="37" rx="5" className="pi-audio-clip"/>
            {Array.from({length:Math.max(2,Math.floor(w/8))},(_,j)=><path key={j} d={`M${x+7+j*8} ${27-3-waveform[(i*14+j)%96]!*9}v${6+waveform[(i*14+j)%96]!*18}`} className="pi-clip-bar"/>)}
            <rect x={x} y="65" width={w} height="37" rx="5" className="pi-cue-clip"/>
            <text x={x+11} y="89" className="pi-cue-number">{String(i+1).padStart(2,'0')}</text>
          </g>;
        })}
        <g opacity={step>=2?1:0}><path d={`M${tickX} 0v114`} className="pi-playhead"/><path d={`M${tickX-6} 0h12l-6 8z`} className="pi-wave-lit"/></g>
      </svg>
    </div>
    <div className="pi-export" style={{opacity:done,transform:place(mix(1620,1630,done),mix(730,746,done),mix(.86,1,done))}}>
      <div className="pi-export-icon"><svg viewBox="0 0 64 64"><path d="M24 15L49 32 24 49Z"/></svg></div>
      <b>PLAY.</b><span>网页 / 视频</span>
    </div>
    <div className="pi-footer"><span>文案</span><i/><span className={step>=1?'pi-active':''}>声音</span><i/><span className={step>=2?'pi-active':''}>时间轴</span><i/><span className={step>=3?'pi-active':''}>画面</span><div className="pi-footer-note">CREATE WITH YOUR OWN VOICE</div></div>
  </div>;
}
