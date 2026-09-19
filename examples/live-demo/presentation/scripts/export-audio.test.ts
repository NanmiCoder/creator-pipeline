import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioWindow } from '../src/export/audio.ts';

for (const sampleRate of [24000, 44100, 48000]) {
  test(`10 minute fractional trim is sample-exact at ${sampleRate} Hz`, () => {
    const start = 3.576, end = start + 600.017;
    let consumed = 0;
    const chunk = 997;
    for (let offset = Math.floor(start * sampleRate / chunk) * chunk; offset < end * sampleRate; offset += chunk) {
      const { from, to } = audioWindow(offset / sampleRate, chunk, sampleRate, start, end, consumed);
      if (to > from) consumed += to - from;
    }
    assert.equal(consumed, Math.round(end * sampleRate) - Math.round(start * sampleRate));
  });
}
test('a gap cannot shift all later speech earlier', () => {
  assert.throws(() => audioWindow(1, 1024, 48000, 0, 10, 0), /时间缺口/);
});
test('overlap does not duplicate samples', () => {
  assert.deepEqual(audioWindow(0, 1024, 48000, 0, 10, 512), {from:512,to:1024});
});
