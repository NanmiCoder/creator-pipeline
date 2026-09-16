/** Slice `[start, end]` seconds out of a decoded buffer. Empty range yields 1 silent sample. */
export function sliceAudioBuffer(
  ctx: BaseAudioContext,
  source: AudioBuffer,
  start: number,
  end: number,
): AudioBuffer {
  const sr = source.sampleRate;
  const from = Math.max(0, Math.min(source.length, Math.floor(start * sr)));
  const to = Math.max(from, Math.min(source.length, Math.ceil(end * sr)));
  const length = Math.max(1, to - from);
  const out = ctx.createBuffer(source.numberOfChannels, length, sr);
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    out.getChannelData(ch).set(source.getChannelData(ch).subarray(from, from + length));
  }
  return out;
}

export async function decodeAudio(url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`音频读取失败（${res.status}）`);
  const raw = await res.arrayBuffer();
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(raw.slice(0));
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
