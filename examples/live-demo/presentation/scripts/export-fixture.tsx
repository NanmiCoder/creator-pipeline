/** Browser-only regression harness. Served by Vite for QA; never imported by the app. */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Pipeline from '../src/chapters/01-pipeline/chapter';
import { TIMELINE, VO_FULL_DURATION } from '../src/registry/timeline';
import { indexAt } from '../src/motion/sample';
import { encodePresentation } from '../src/export/encode';
import { EXPORT_PRESETS, type ExportPresetId } from '../src/export/presets';

export async function runFixture(seconds = 600, presetId: ExportPresetId = '2k', start = 0) {
  document.querySelector('#root')?.remove();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const controller = new AbortController();
  const qa = { frames: 0, time: 0, started: performance.now(), status: 'running', error: '', controller, elapsedMs: 0, result: null as Awaited<ReturnType<typeof encodePresentation>> | null };
  Object.assign(window, { exportQA: qa });
  const seek = (absolute: number) => {
    const local = absolute % VO_FULL_DURATION;
    const frame = Math.round((absolute - start) * 30);
    flushSync(() => root.render(<div className="stage-frame" style={{transform:'scale(.5)',transformOrigin:'top left'}}>
      <div className="scene" data-time={absolute.toFixed(6)} data-chapter="pipeline-fixture">
        <Pipeline step={indexAt(local, TIMELINE)} time={local}/>
        <div style={{position:'absolute',left:0,top:0,display:'flex',zIndex:100}}>
          {Array.from({length:20},(_,bit)=><div key={bit} style={{width:16,height:16,background:frame & (1<<bit)?'#fff':'#000'}}/>)}
        </div>
        <div style={{position:'absolute',left:0,bottom:0,width:64,height:64,background:frame%300<3?'#fff':'#000',zIndex:100}}/>
      </div>
    </div>));
  };
  try {
    qa.result = await encodePresentation({preset:EXPORT_PRESETS[presetId],range:{start,end:start+seconds,partId:'fixture'},audioUrl:'/audio/export-fixture.wav',signal:controller.signal,seek,onProgress:(_,time)=>{qa.time=time;qa.frames=Math.round(time*30)}});
    qa.elapsedMs=performance.now()-qa.started;
    qa.status='done';
  } catch(e) {qa.elapsedMs=performance.now()-qa.started;qa.error=String(e);qa.status='error';throw e;}
}
