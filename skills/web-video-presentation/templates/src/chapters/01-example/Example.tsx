import type { ChapterStepProps } from '../../registry/types';
import './Example.css';

/** One persistent workspace: assemble → route → return. Replace with your real objects. */
export default function ExampleChapter({ step }: ChapterStepProps) {
  if (step === 0 || step === 1 || step === 2) return (
    <div className="ex-world" data-phase={step}>
      <h1 className="ex-title">{['把任务拆开', '让信息流动', '把结果带回来'][step]}</h1>
      <svg className="ex-network" viewBox="0 0 1600 600" aria-hidden="true">
        {[170, 400, 630].map(x => <path key={x} d={`M${x} 260 C${x} 390 1150 390 1150 260`} pathLength={1} />)}
      </svg>
      <div className="ex-objects">
        {['任务', '工具', '上下文'].map((label, i) => (
          <div className="ex-piece" key={label} style={{left: 130 + i * 240, transform: `translateY(${step === 0 ? i * 32 : 0}px)`}}>
            <svg viewBox="0 0 80 80" aria-hidden="true">
              {i === 0 ? <path d="M18 12h30l14 14v42H18z M48 12v16h14 M29 40h22 M29 51h16" />
                : i === 1 ? <path d="M20 18h40v44H20z M30 6v12 M50 6v12 M30 62v12 M50 62v12 M6 30h14 M60 30h14 M6 50h14 M60 50h14" />
                : <><ellipse cx="40" cy="19" rx="25" ry="10"/><path d="M15 19v40c0 14 50 14 50 0V19 M15 38c0 14 50 14 50 0"/></>}
            </svg>
            <span>{label}</span>
          </div>
        ))}
        <div className="ex-result">
          <svg viewBox="0 0 140 140" aria-hidden="true"><path d="M30 72l27 27 56-59" pathLength={1}/></svg>
          <span>{step === 2 ? '完成' : '结果'}</span>
        </div>
      </div>
    </div>
  );
  return null;
}
