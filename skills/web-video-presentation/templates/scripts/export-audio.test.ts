import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sliceAudioBuffer} from '../src/export/audio.ts';

class FakeBuffer {
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
    readonly channels: Float32Array[],
  ) {}
  getChannelData(ch: number) {
    return this.channels[ch]!;
  }
}

class FakeCtx {
  createBuffer(channels: number, length: number, sampleRate: number) {
    const chans = Array.from({length: channels}, () => new Float32Array(length));
    return new FakeBuffer(channels, length, sampleRate, chans);
  }
}

test('slice copies the requested PCM window', () => {
  const samples = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);
  const src = new FakeBuffer(1, 8, 4, [samples]);
  const ctx = new FakeCtx() as unknown as BaseAudioContext;
  const out = sliceAudioBuffer(ctx, src as unknown as AudioBuffer, 0.5, 1.5);
  assert.equal(out.sampleRate, 4);
  assert.deepEqual(Array.from(out.getChannelData(0)), [2, 3, 4, 5]);
});

test('empty window still yields one sample so AAC has a buffer', () => {
  const src = new FakeBuffer(1, 8, 4, [new Float32Array(8)]);
  const ctx = new FakeCtx() as unknown as BaseAudioContext;
  const out = sliceAudioBuffer(ctx, src as unknown as AudioBuffer, 9, 10);
  assert.equal(out.length, 1);
});
