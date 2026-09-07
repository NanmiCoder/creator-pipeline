import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSrt, attachCues, emitTiming} from './srt-cues.mjs';
import {buildModel,parseTimelineYaml} from './gen-timeline.mjs';

test('CRLF/BOM and unordered IDs preserve text, sort exact milliseconds', () => {
 const cues = parseSrt('\uFEFF9\r\n00:00:02,100 --> 00:00:03,000\r\n后句\r\n\r\n20\r\n00:00:01,050 --> 00:00:02,000\r\n前句');
 assert.deepEqual(cues.map(c=>[c.id,c.at,c.text]), [['20',1.05,'前句'],['9',2.1,'后句']]);
});
test('reject malformed, reverse and invalid minute timecodes', () => {
 for(const s of ['x','1\n00:00:02,000 --> 00:00:01,000\nx','1\n00:60:00,000 --> 01:01:00,000\nx']) assert.throws(()=>parseSrt(s));
});
test('new fields, cross-part lengths, cue ownership and relative output', () => {
 const m = buildModel(parseTimelineYaml(`audio: audio/vo.mp3\nsrt: final.srt\nduration: 20\nparts:\n  - id: a\n    start: 10\n    end: 12\n  - id: b\n    start: 18\n    end: 20\nchapters:\n  - id: case\n    title: 案例\n    steps:\n      - at: 10\n        vo: 前句\n        scene: flow\n        screen: 主体\n        do: A变成B\n      - at: 18\n        vo: 后句\n        do: 停住`));
 assert.deepEqual(m.errors,[]);
 const cues=[{id:'1',at:10,end:11,text:'前句'},{id:'2',at:18,end:19,text:'后句'}];
 assert.deepEqual(attachCues(m,cues),[]);
 assert.equal(m.chapters[0].steps[0].end,12);
 assert.equal(m.chapters[0].steps[1].cues.length,1);
 assert.match(emitTiming(m.chapters[0]), /"at": 8/);
 assert.match(emitTiming(m.chapters[0]), /"scene": "flow"/);
 cues[1].text='错误版本';
 assert.match(attachCues(m,cues).join(), /vo 与此时间段 SRT 不同/);
});
test('negative absolute time fails',()=>{
 const m=buildModel(parseTimelineYaml('audio: x\nduration: 2\nchapters:\n  - id: x\n    title: X\n    steps:\n      - at: -1\n        vo: x\n        do: x'));
 assert.match(m.errors.join(),/负数/);
});
