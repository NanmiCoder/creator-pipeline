import {test} from 'node:test';
import assert from 'node:assert/strict';
import {framePlan, formatClock, EXPORT_PRESETS} from '../src/export/presets.ts';

test('1k/2k/4k map to 1080p / 1440p / 2160p from a 1920 stage', () => {
  assert.equal(EXPORT_PRESETS['1k'].width, 1920);
  assert.equal(EXPORT_PRESETS['2k'].height, 1440);
  assert.equal(EXPORT_PRESETS['4k'].width, 3840);
  assert.equal(EXPORT_PRESETS['4k'].scale, 2);
});

test('frame plan covers the voiced interval without dropping the last sample', () => {
  const frames = framePlan(0, 1, 30);
  assert.equal(frames.length, 30);
  assert.equal(frames[0]!.timestamp, 0);
  assert.ok(Math.abs(frames[29]!.timestamp + frames[29]!.duration - 1) < 1e-9);
});

test('partial part uses absolute start and still fills end', () => {
  const frames = framePlan(3.576, 7.494, 30);
  assert.equal(frames[0]!.timestamp, 3.576);
  const last = frames[frames.length - 1]!;
  assert.equal(last.timestamp + last.duration, 7.494);
});

test('clock label is m:ss.t', () => {
  assert.equal(formatClock(0), '0:00.0');
  assert.equal(formatClock(25.0678), '0:25.1');
  assert.equal(formatClock(75), '1:15.0');
});
