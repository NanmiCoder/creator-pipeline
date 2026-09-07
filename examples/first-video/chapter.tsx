import type {ChapterStepProps} from '../../registry/types';
import {progress, mix} from '../../motion/sample';
import {timing} from './timing';
import './chapter.css';

export default function Pipeline({step,time=0}:ChapterStepProps) {
  const at=(n:number)=>timing[n]!.at;
  const turn=progress(time,at(3),.8), finish=step===5?progress(time,at(5),.7):0;
  const connect=progress(time,at(2)+.15,.8);
  const cursor=progress(time,at(4),timing[4]!.end-at(4),x=>x);
  const heads=['一份文案，一段声音。','让你的声音，留在本地。','时间戳，把声音接起来。','让内容，长成画面。','声音走到哪里，画面就到哪里。','从一段话，到一部作品。'];
  return <div className="pi-root">
    <div className="pi-eyebrow">CREATOR PIPELINE</div>
    <h1 className="pi-title">{heads[Math.min(step,5)]}</h1>
    <svg className="pi-diagram" viewBox="0 0 1920 1080" aria-label="文案和录音变成配音、时间戳与网页演示">
      <g transform={`translate(${mix(170,130,turn)} ${mix(350,410,turn)}) scale(${mix(1,.82,turn)})`}>
        <rect width="400" height="320" rx="18" className="pi-paper"/>
        <text x="38" y="68" className="pi-label">文案</text>
        {[0,1,2].map(i=><path key={i} d={`M40 ${118+i*42} H${i===2?246:348}`} className="pi-line"/>) }
        <circle cx="346" cy="262" r="20" className="pi-accent"/>
      </g>
      <g transform={`translate(${mix(760,130,turn)} ${mix(350,710,turn)}) scale(${mix(1,.68,turn)})`}>
        <rect width="400" height="320" rx="18" className="pi-paper"/>
        <text x="38" y="68" className="pi-label">{step===0?'参考录音':'克隆配音'}</text>
        {Array.from({length:21},(_,i)=>{
          const h=20+(Math.sin(i*1.7+time*(step===1?4:0))*.5+.5)*100;
          return <rect key={i} x={40+i*15} y={194-h/2} width="6" height={h} rx="3" className="pi-accent"/>;
        })}
      </g>
      <g opacity={progress(time,at(2),.55)*(1-turn)} transform="translate(1350 350)">
        <rect width="400" height="320" rx="18" className="pi-paper"/>
        <text x="38" y="68" className="pi-label">时间戳</text>
        <text x="38" y="158" className="pi-time">{at(0).toFixed(2)}s → {at(1).toFixed(2)}s</text>
        <text x="38" y="212" className="pi-time">{at(1).toFixed(2)}s → {at(2).toFixed(2)}s</text>
        <text x="38" y="266" className="pi-time">SRT + WAV</text>
      </g>
      <path d="M572 510 H756 M1162 510 H1344" pathLength="1" strokeDasharray="1"
        strokeDashoffset={1-connect} opacity={1-turn} className="pi-wire"/>
      <path d="M460 530 H640 V720 H780 M405 820 H580 Q640 820 640 760 V720"
        opacity={turn} className="pi-wire"/>
      <g opacity={turn} transform={`translate(${mix(710,760,finish)} ${mix(300,330,finish)}) scale(${mix(1,.78,finish)})`}>
        <rect width="1060" height="590" rx="20" className="pi-screen"/>
        <path d="M0 60H1060" className="pi-line"/>
        <circle cx="30" cy="30" r="7" className="pi-accent"/>
        <text x="74" y="42" className="pi-window-title">WEB PRESENTATION</text>
        <text x="70" y="196" className="pi-screen-title">声画同频</text>
        {[0,1,2].map(i=>{
          const lift=progress(time,at(3)+i*.2,.5);
          return <g key={i} transform={`translate(${70+i*304} ${mix(310,280,lift)})`} opacity={lift}>
            <rect width="260" height="188" rx="12" className="pi-mini"/>
            <circle cx="54" cy="64" r={20+i*8} className="pi-accent"/>
            <path d="M32 126 H194 M32 150H145" className="pi-line"/>
          </g>;
        })}
        <path d="M70 528H982" className="pi-line"/>
        <path d={`M70 528H${70+912*cursor}`} className="pi-wire"/>
        <circle cx={70+912*cursor} cy="528" r="12" className="pi-accent"/>
      </g>
      <g opacity={finish} transform={`translate(${mix(1650,1630,finish)} 650)`}>
        <rect width="220" height="220" rx="18" className="pi-paper"/>
        <path d="M80 50L148 94 80 138Z" className="pi-accent"/>
        <text x="48" y="186" className="pi-label">MP4</text>
      </g>
      <text x="170" y="785" opacity={step===1?1:0} className="pi-local">本地克隆 · 无需云端密钥</text>
    </svg>
  </div>;
}
