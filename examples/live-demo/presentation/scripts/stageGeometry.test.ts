import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stageScale} from '../src/motion/stageGeometry.ts';

test('capture rectangle stays 16:9 and inside visible margins at common viewport sizes',()=>{
  for(const [w,h] of [[1920,1080],[1440,900],[2560,1080],[480,270],[320,568],[240,160]]) {
    const s=stageScale(w!,h!),fw=1920*s,fh=1080*s;
    assert.ok(s>0);
    assert.ok(Math.abs(fw/fh-16/9)<1e-12);
    assert.ok(fw<w! && fh<h!);
    assert.ok((w!-fw)/2>=Math.min(80,w!*.06)-.001);
    assert.ok((h!-fh)/2>=Math.min(100,h!*.1)-.001);
  }
});
