import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progress, mix, indexAt, linear, windowOpacity} from '../src/motion/sample.ts';
test('seek and reverse have no accumulated state; no result before cue', () => {
 const times=[8,3,5,3,8];
 assert.deepEqual(times.map(t=>progress(t,4,2,linear)),[1,0,.5,0,1]);
 assert.equal(mix(100,400,progress(5,4,2,linear)),250);
 assert.equal(progress(1,2,0),0);
 assert.equal(progress(2,2,0),1);
 assert.equal(windowOpacity(3,4,8),0);
});
test('step boundaries do not reveal next result early', () => {
 assert.equal(indexAt(9.999,[0,10,20]),0);
 assert.equal(indexAt(10,[0,10,20]),1);
 assert.equal(indexAt(25,[0,10,20]),2);
});
