import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { audioWindow } from '../src/export/audio.ts';
import { frameAt, frameCountFor } from '../src/export/presets.ts';

const compiled = ts.transpileModule(readFileSync(new URL('../src/export/encode.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ failAt = -1, cancelAt = -1 } = {}) {
  let time = -1, pending = false, removed = 0, finalized = false, canceled = false;
  const frames: {timestamp:number; duration:number; scene:number}[] = [];
  const controller = new AbortController();
  const mods: Record<string, unknown> = {
    mediabunny: {
      CanvasSource: class {
        async add(timestamp: number, duration: number) {
          assert.equal(pending, false, 'must await encoding backpressure'); pending = true;
          await Promise.resolve();
          frames.push({timestamp, duration, scene: time}); pending = false;
          if (frames.length === cancelAt) controller.abort();
        }
        close() {}
      },
      Output: class {
        addVideoTrack() {} async start() {} async finalize() {finalized=true}
        async cancel() {canceled=true}
      },
      Mp4OutputFormat: class {}, StreamTarget: class {}, Quality: class {},
    },
    './audio': {audioWindow},
    './raster': {createRasterizer: async () => ({canvas:{},draw:async () => {
      if(frames.length===failAt) throw new Error('raster failed');
    },dispose(){}})},
    './paint': {waitForSceneTime:async (target:number) => { assert.equal(time,target) }},
    './presets': {EXPORT_FPS:30,frameAt,frameCountFor},
    './support': {checkExportSupport:async()=>({ok:true})},
  };
  const exports: Record<string, Function> = {};
  vm.runInNewContext(compiled, {
    exports, require:(n:string)=>mods[n], performance, crypto,
    navigator:{storage:{getDirectory:async()=>({
      getFileHandle:async()=>({createWritable:async()=>({}),getFile:async()=>({size:100})}),
      removeEntry:async()=>{removed++},
    })}},
  });
  const run = (start:number,end:number)=>exports.encodePresentation!({preset:{},range:{start,end,partId:'full'},audioUrl:null,
    seek:(t:number)=>{time=t},signal:controller.signal,onProgress(){}});
  return { run, frames, status:()=>({removed,finalized,canceled}) };
}

test('10 minutes: all 18,000 frames have exact media timestamps, independent of encoder delays', async()=>{
  const h=harness(); const out=await h.run(0,600);
  assert.equal(h.frames.length,18000);
  for (let i=0;i<h.frames.length;i++) {
    assert.equal(h.frames[i]!.timestamp,i/30);
    assert.equal(h.frames[i]!.scene,i/30);
    assert.ok(h.frames[i]!.duration>0);
  }
  assert.equal(out.frames,18000);assert.equal(h.status().finalized,true);
  await out.dispose();assert.equal(h.status().removed,1);
});
test('nonzero fractional range rebases video to zero and retains positive tail',async()=>{
  const h=harness(); await h.run(3.576,7.494);
  assert.equal(h.frames[0]!.timestamp,0);assert.equal(h.frames[0]!.scene,3.576);
  const last=h.frames.at(-1)!;
  assert.ok(Math.abs(last.timestamp+last.duration-(7.494-3.576))<1e-10);
});
test('cancel stops without finalizing and removes the temporary file',async()=>{
  const h=harness({cancelAt:10});await assert.rejects(h.run(0,600));
  assert.equal(h.frames.length,10);assert.deepEqual(h.status(),{removed:1,finalized:false,canceled:true});
});
test('render failure cannot silently repeat the previous frame or produce a success',async()=>{
  const h=harness({failAt:7});await assert.rejects(h.run(0,600),/raster failed/);
  assert.equal(h.frames.length,7);assert.deepEqual(h.status(),{removed:1,finalized:false,canceled:true});
});
