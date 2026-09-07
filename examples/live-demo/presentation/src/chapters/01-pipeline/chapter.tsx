import {useReducedMotion} from '../../hooks/useReducedMotion';
import type {ChapterStepProps} from '../../registry/types';
import {progress,mix,easeInOut} from '../../motion/sample';
import {timing} from './timing';
import {waveform,waveformIsIllustrative,voiceModelLabel} from './waveform';
import {beats} from './beats';
import {StepReview} from './StepReview';
import './chapter.css';

const duration=timing[5]!.end;
const clock=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toFixed(2).padStart(5,'0')}`;
const pose=(x:number,y:number,s=1,r=0)=>`translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
const headings=[['从一段话，','开始创作。'],['克隆声音，','留住你的表达。'],['每一句话，','落在同一条时间轴。'],['让文字成形，','让关系流动。'],['声音走到哪里，','画面推进到哪里。'],['一部作品，','两种打开方式。']];
function Wave({fill=1}:{fill?:number}) {
 return <svg className="pi-wave" viewBox="0 0 640 160" aria-label={waveformIsIllustrative?"示意波形（未生成配音）":"实际配音振幅概览"}>{waveform.map((v,i)=><rect key={i} x={i*6.65} y={80-v*68} width="3.7" height={Math.max(4,v*136)} rx="1.8" className={i/96<=fill?'pi-ink':'pi-dim'}/>)}</svg>;
}

export default function Pipeline({step,time=0,stepReview=false}:ChapterStepProps) {
 // Manual click mode holds at this cue until the next click; its preview clock can keep advancing.
 time=Math.min(time,timing[Math.min(step,5)]!.end-.001);
 const reduced=useReducedMotion();
 const p=(i:number,delay=0)=>reduced?(time>=beats[i]!.at+delay?1:0):progress(time,beats[i]!.at+delay,beats[i]!.duration,easeInOut);
 const intro=p(0),record=p(1),pair=p(2),merge=p(3),synth=p(4),local=p(5),expand=p(6),split=p(7),stamp=p(8),align=p(9),web=p(10),cards=p(11),connect=p(12),focus=p(13),follow=p(14),focusVoice=p(15),focusFrame=p(16),deliver=step===5?p(17):0,play=p(18),video=p(19),end=p(20);
 const index=Math.min(step,5),titleIn=reduced?1:progress(time,timing[index]!.at,.38);
 const activeBeat=beats.reduce((n,b,i)=>time>=b.at?i:n,0);
 const headingY=mix(300,180,merge),headingS=mix(1,.66,merge);
 const voiceX=mix(mix(1260,1230,pair),448,merge),voiceY=mix(mix(565,535,record),382,merge);
 const voiceScale=mix(.76,1.42,merge);
 const trackX=mix(210,mix(420,144,deliver),web),trackY=mix(mix(447,370,align),mix(852,835,deliver),web),trackScale=mix(1,mix(.72,.54,deliver),web);
 const screenX=mix(395,180,deliver),screenY=mix(308,355,deliver),screenS=mix(mix(1,1.12,follow),.90,deliver);
 const playhead=1370*Math.min(time/duration,1);
 const picked=follow>.5?(focusFrame>.5?2:focusVoice>.5?1:0):1;
 const focusWeights=[follow*(1-focusVoice),mix(focus,focusVoice,follow)*(1-focusFrame),focusFrame];
 return <>
 <div className="pi-root" data-motion-time={time.toFixed(3)} data-beat={activeBeat} data-beat-label={beats[activeBeat]!.label}>
  <div className="pi-glow"/>
  <div className="pi-masthead"><span className="pi-mark"><i/><i/><i/></span><b>Creator Pipeline</b><span>WORDS INTO MOTION</span></div>
  <div className="pi-count"><b>{String(index+1).padStart(2,'0')}</b><span>/ 06</span></div>
  <div className="pi-heading" style={{transform:pose(108,headingY+(1-titleIn)*22,headingS),opacity:titleIn}}>
   <span className="pi-kicker">{['SCRIPT & REFERENCE','YOUR VOICE, CLONED','ONE SHARED TIMELINE','WORDS BECOME OBJECTS','VOICE DRIVES THE SCENE','READY TO PLAY'][index]}</span>
   <h1>{headings[index]![0]}{step===0?<br/>:' '}<em>{headings[index]![1]}</em></h1>
  </div>
  <svg className="pi-pairing" viewBox="0 0 1920 1080" style={{opacity:pair*(1-merge)}}><path d="M1050 630C1100 700 1175 765 1260 715" pathLength="1" strokeDasharray="1" strokeDashoffset={1-pair}/><circle cx="1170" cy="735" r={27*pair}/><path d="M1158 735h24m-12-12v24"/></svg>
  <div className="pi-document" data-motion-object="document" style={{transform:pose(mix(mix(886,750,pair),777,merge),mix(304,464,merge)+mix(55,0,intro),mix(1,.22,merge),mix(-8,4,merge)),opacity:intro*(1-merge)}}>
   <div className="pi-document-top"><span>文案</span><span>MD</span></div><div className="pi-typesample">Aa<span>字</span></div>
   <div className="pi-script">先准备一份文案，<br/><strong>再放入自己的录音。</strong></div>
   <div className="pi-document-foot">script.md<span>01</span></div>
  </div>
  <div className="pi-voice" data-motion-object="voice" style={{transform:pose(voiceX,voiceY+mix(110,0,record),voiceScale,mix(8,0,pair)),opacity:record*(1-expand)}}>
   <div className="pi-voice-top"><div className="pi-voice-symbol"><i/><i/><i/><i/></div><div><small>{merge>.5?'克隆配音':'参考录音'}</small><h2>你的声音</h2></div><span className="pi-status-dot"/></div>
   <Wave fill={merge>.5?synth:1}/>
   <div className="pi-voice-foot"><span>{merge>.5?voiceModelLabel:'REFERENCE AUDIO'}</span><span>{merge>.5?clock(duration):'YOUR VOICE'}</span></div>
   <div className="pi-local-seal" style={{opacity:local,transform:pose(mix(40,0,local),0,mix(.7,1,local))}}><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 6"/></svg>音色就绪</div>
  </div>
  <div className="pi-browser" data-motion-object="browser" style={{opacity:web,transform:pose(screenX,mix(365,screenY,web),screenS)}}>
   <div className="pi-browser-bar"><span className="pi-dots"><i/><i/><i/></span><span>Creator Pipeline</span><span>16:9</span></div>
   <div className="pi-canvas">
    <svg className="pi-connections" viewBox="0 0 1120 480" style={{opacity:connect}}>
     <path d="M320 228C365 228 365 228 400 228M680 228H780" pathLength="1" strokeDasharray="1" strokeDashoffset={1-connect}/>
     <path className="pi-packet" d="M0-7h14v14H0z" transform={`translate(${mix(320,780,connect)} 228) rotate(45)`}/>
    </svg>
    {['文案','声音','画面'].map((label,i)=>{
     const grow=reduced?cards:progress(time,beats[11]!.at+i*beats[11]!.duration*.14,beats[11]!.duration*.70,easeInOut);
     const f=focusWeights[i]!,baseX=60+i*350,xx=mix(baseX,[45,410,790][i]!,focus*(1-follow));
     const selected=step>=4&&picked===i;
     return <div key={label} className={`pi-object pi-object-${i} ${selected?'pi-object-selected':''}`} data-motion-object={`content-${i}`} style={{transform:pose(xx,mix(115,95,f),mix(1,1.12,f),mix(0,i===0?-4:i===2?4:0,focus*(1-follow))),opacity:web}}>
      <div className="pi-object-surface" style={{opacity:grow,transform:`scale(${mix(.82,1,grow)})`}}/>
      <span className="pi-object-index" style={{opacity:grow}}>0{i+1}</span>
      <h2 style={{transform:`translateY(${mix(68,0,grow)}px)`}}>{label}</h2>
      <div className="pi-object-art" style={{opacity:grow,transform:`translateY(${mix(40,0,grow)}px)`}}>
       {i===0?<><span className="pi-type-large">Aa</span><span className="pi-object-sub">让想法被看见</span></>:i===1?<Wave fill={step>=4?mix(.35,1,focusVoice):1}/>:<div className="pi-mini-deck"><i style={{transform:`translate(${mix(-10,9,focusFrame)}px,${mix(14,0,focusFrame)}px) rotate(${mix(-8,0,focusFrame)}deg)`}}/><b><svg viewBox="0 0 50 50"><path d="M17 10L39 25 17 40Z"/></svg></b></div>}
      </div>
      <div className="pi-object-underline" style={{transform:`scaleX(${selected?1:0})`}}/>
     </div>;
    })}
    <div className="pi-scene-clock" style={{opacity:follow*(1-deliver)}}><span>同一时钟</span><b>{clock(time)}</b><span className="pi-mini-pips">{[0,1,2].map(i=><i key={i} className={picked>=i?'pi-active':''}/>)}</span></div>
    <div className="pi-ready" style={{opacity:play}}><span>自动播放</span><svg viewBox="0 0 50 50"><path d="M17 10L39 25 17 40Z"/></svg><span>网页演示</span></div>
   </div>
  </div>
  <div className="pi-timeline" data-motion-object="timeline" style={{opacity:expand*(1-end*.30),transform:pose(trackX,trackY,trackScale)}}>
   <div className="pi-timeline-head" style={{marginBottom:mix(70,18,web)}}><span>{align>.5?'声音 + 字幕':'配音音轨'}</span><b>{clock(time)}<i> / {clock(duration)}</i></b></div>
   <svg viewBox={`0 0 1500 ${mix(390,160,web)}`} style={{height:mix(390,160,web)}} className="pi-tracks" aria-label={waveformIsIllustrative?"六段演示时间区间":"实际 SRT 的六个声音与字幕片段"}>
    <text x="0" y={mix(108,42,web)} className="pi-track-label">VO</text><text x="0" y={mix(302,122,web)} className="pi-track-label" opacity={align}>SRT</text>
    <g transform="translate(100 0)">
    {timing.map((cue,i)=>{
     const x=cue.at/duration*1370,w=(cue.end-cue.at)/duration*1370,gap=split*12;
     const dy=(i%2===0?-23:23)*split*(1-align)*(1-web),stagger=reduced?stamp:progress(time,beats[8]!.at+i*beats[8]!.duration*.1,beats[8]!.duration*.5);
     return <g key={i} data-cue={i+1} transform={`translate(${x} ${dy})`}>
      <rect y={mix(45,10,web)} x={gap/2} width={w-gap} height={mix(118,48,web)} rx={mix(0,10,split)} className="pi-audio-clip"/>
      {Array.from({length:Math.floor(w/9)-1},(_,j)=>{
       const v=waveform[Math.min(95,Math.floor((x+j*9)/1370*96))]!;
       return <path key={j} d={`M${8+j*9} ${mix(104,34,web)-v*mix(45,18,web)}v${v*mix(90,36,web)}`} className="pi-clip-bar"/>;
      })}
      <path d={`M${gap/2} 32v-19h${w-gap}v19`} className="pi-bracket" opacity={stagger*(1-web)}/>
      <text x={w/2} y="-4" textAnchor="middle" className="pi-cue-time" opacity={stagger*(1-web)}>{clock(cue.at)}</text>
      <path d={`M${w/2} ${mix(167,62,web)}v${mix(0,mix(68,20,web),align)}`} className="pi-tether" opacity={align}/>
      <g transform={`translate(0 ${mix(365,mix(250,90,web),align)})`} opacity={align}>
       <rect x={gap/2} width={w-gap} height={mix(76,48,web)} rx="9" className="pi-cue-clip"/>
       <text x={w/2} y={mix(48,31,web)} textAnchor="middle" className="pi-cue-number">{['准备输入','声音克隆','时间戳','生成画面','声画同步','交付'][i]}</text>
      </g>
     </g>;
    })}
    <g opacity={align}><path d={`M${playhead} ${mix(28,0,web)}v${mix(315,145,web)}`} className="pi-playhead"/><path d={`M${playhead-9} ${mix(26,0,web)}h18l-9 13Z`} className="pi-ink"/></g>
    </g>
   </svg>
  </div>
  <div className="pi-video" data-motion-object="video" style={{opacity:video,transform:pose(mix(1040,1315,video),mix(425,399,video),mix(.58,1,video),mix(-9,0,video))}}>
   <div className="pi-video-top"><span>VIDEO</span><span>MP4</span></div><svg className="pi-video-play" viewBox="0 0 100 100"><path d="M32 19L79 50 32 81Z"/></svg><b>让作品<br/>开始播放。</b><div className="pi-filmholes">{Array.from({length:7},(_,i)=><i key={i}/>)}</div>
  </div>
  <div className="pi-finish" style={{opacity:end,transform:pose(1320,854+mix(25,0,end))}}><i/>网页 / 视频</div>
  <div className="pi-footer"><span>文案</span><i/><span className={step>=1?'pi-active':''}>声音</span><i/><span className={step>=2?'pi-active':''}>时间轴</span><i/><span className={step>=3?'pi-active':''}>画面</span><span className="pi-footer-note">CREATE WITH YOUR OWN VOICE</span></div>
 </div><StepReview enabled={stepReview}/>
 </>;
}
