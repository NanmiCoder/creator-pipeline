import {progress, mix, windowOpacity} from '../../motion/sample';
import './chapter.css';
import {CHAPTER_START, timing} from './timing';
const allCues = timing.flatMap(s => s.cues);
const cue = (id: string) => {
  const c = allCues.find(c => c.id === id);
  if (!c) throw new Error(`Missing source cue ${id}`);
  return CHAPTER_START + c.at;
};
const cues = Object.fromEntries(['29','30','31','32','34','35','36','37'].map(id => [id, cue(id)]));

// Source: 383 final recording SRT cues 28–37, 57.733–79.266. Mechanism illustration.
export default function NewChain({time = 0}: {time?:number; step:number}) {
  const t=time+CHAPTER_START;
  const enter=progress(t,cues["30"]!,.65);
  const crack=progress(t,cues["32"]!,.6);
  const expand=progress(t,cues["34"]!,.7);
  const open=progress(t,cues["35"]!,.75);
  const flow=progress(t,cues["36"]!,1.25);
  const finish=progress(t,cues["37"]!,.35);
  const linkX=mix(940,770,expand), linkY=mix(565,540,expand);
  return <div className="nc-world">
    <h1 className="nc-heading">{t<cues["30"]!?'一次误删，怎样发生':t<cues["32"]!?'原本，只是一个链接':t<cues["34"]!?'Windows 引号解析错了':t<cues["35"]!?'删除目标，扩大了':t<cues["37"]!?'最高权限，直接放行':'全程没有拦截'}</h1>
    <svg className="nc-diagram" viewBox="0 0 1920 1080" aria-label="符号链接因引号解析错误扩大为 G 盘根目录，最高权限放行的机制示意">
      <g opacity={1-enter}>
        <path className="nc-wire" d="M330 630H690L840 480H1150" pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress(t,cues["29"]!,1.15)}/>
        <circle cx="330" cy="630" r="22" className="nc-dot"/>
        <rect x="690" y="560" width="110" height="110" rx="20" className="nc-block" transform="rotate(-12 745 615)"/>
        <path className="nc-cross" d="M1060 440l80 80m0-80-80 80"/>
      </g>
      <g opacity={enter}>
        <path className="nc-route" d="M470 555 C640 555 700 555 865 555" pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress(t,cues["31"]!,.8)}/>
        <g transform={`translate(270 455) rotate(${-5+5*enter})`} opacity={1-expand*.68}>
          <path className="nc-folder-side" d="M0 30L25 5h150l30 25v140l-25 25H0z"/>
          <path className="nc-folder" d="M0 30h72l22 22h110v143H0z"/>
          <path className="nc-link" d="M76 101l15-15a20 20 0 0 1 28 28l-14 14 M101 108l-15 15a20 20 0 0 1-28-28l14-14"/>
        </g>
        <text x="270" y="720" className="nc-label" opacity={1-expand*.68}>符号链接</text>
        <g transform={`translate(${linkX} ${linkY}) scale(${mix(.48,1.32,expand)})`}>
          <rect x="-136" y="-145" width="280" height="290" rx="24" className="nc-target"/>
          <text x="0" y="-35" className="nc-drive" textAnchor="middle">G:</text>
          {Array.from({length:12},(_,i)=><rect key={i} x={-95+(i%4)*50} y={10+Math.floor(i/4)*33} width="36" height="21" rx="4" className="nc-file" style={{opacity:1-finish*.8}}/>) }
          <rect x="-146" y="-155" width="300" height="310" rx="28" className="nc-selection" pathLength={1} strokeDasharray={1} strokeDashoffset={1-expand}/>
        </g>
        <text x="770" y="785" textAnchor="middle" className="nc-label" opacity={expand}>整个 G 盘根目录</text>
        <g opacity={windowOpacity(t,cues["32"]!,cues["34"]!,.2)}>
          <text x={660-50*crack} y={465-40*crack} className="nc-quote">“</text>
          <text x={830+70*crack} y={610+90*crack} className="nc-quote" transform={`rotate(${30*crack} 850 560)`}>”</text>
          <path d="M755 470l-20 45 40 38-25 48" className="nc-cross" pathLength={1} strokeDasharray={1} strokeDashoffset={1-crack}/>
        </g>
        <g opacity={progress(t,cues["35"]!,.4)}>
          <path d="M1000 555H1530" className="nc-route"/>
          <path d="M1190 365v380M1220 365v380" className="nc-post"/>
          <g transform={`rotate(${-88*open} 1205 555)`}><rect x="1193" y="545" width="220" height="20" rx="5" className="nc-barrier"/></g>
          <circle cx="1205" cy="555" r="15" className="nc-pivot"/>
          <circle cx={mix(990,1515,flow)} cy="555" r="16" className="nc-packet" opacity={t<cues["37"]!?1:0}/>
          <text x="1210" y="810" textAnchor="middle" className="nc-label" opacity={progress(t,cues["36"]!,.2)}>Full access</text>
        </g>
      </g>
    </svg>
    <div className="nc-no" style={{opacity:finish}}><strong>0</strong><span>次拦截</span></div>
    <p className="nc-note">机制示意</p>
  </div>;
}
