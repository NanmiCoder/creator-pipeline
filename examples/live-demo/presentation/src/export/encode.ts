import { ALL_FORMATS, AudioBufferSink, AudioBufferSource, CanvasSource, Input, Mp4OutputFormat, Output, Quality, StreamTarget, UrlSource } from "mediabunny";
import { audioWindow } from "./audio";
import { createRasterizer } from "./raster";
import { waitForSceneTime } from "./paint";
import { EXPORT_FPS, frameCountFor, frameAt, type ExportPreset } from "./presets";
import { checkExportSupport } from "./support";

export interface EncodeRange { start: number; end: number; partId: string; }
export interface EncodeOptions {
  preset: ExportPreset;
  range: EncodeRange;
  audioUrl: string | null;
  seek: (time: number) => void;
  signal: AbortSignal;
  onProgress: (ratio: number, time: number) => void;
}

/** Offline frames and audio use the same zero point. Wall time never enters the media timeline. */
export async function encodePresentation(opts: EncodeOptions) {
  const { signal, range, preset } = opts;
  const count = frameCountFor(range.start, range.end);
  const support = await checkExportSupport(preset);
  if (!support.ok) throw new Error(support.reason);
  signal.throwIfAborted();
  const dir = await navigator.storage.getDirectory();
  const name = `presentation-${crypto.randomUUID()}.mp4`;
  const handle = await dir.getFileHandle(name, { create: true });
  let output: Output | undefined;
  let input: Input | undefined;
  let raster: Awaited<ReturnType<typeof createRasterizer>> | undefined;
  let audioIterator: ReturnType<AudioBufferSink["buffers"]> | undefined;
  const remove = () => dir.removeEntry(name).catch(() => undefined);
  const stopInput = () => input?.dispose();
  signal.addEventListener("abort", stopInput, { once: true });
  try {
    raster = await createRasterizer(preset, signal);
    output = new Output({
      format: new Mp4OutputFormat({ fastStart: "fragmented", minimumFragmentDuration: 2 }),
      target: new StreamTarget(await handle.createWritable(), { chunked: true, chunkSize: 1024 * 1024 }),
    });
    const video = new CanvasSource(raster.canvas, {
      codec: "avc", quality: new Quality("high"), latencyMode: "quality",
      hardwareAcceleration: "prefer-hardware", keyFrameInterval: 2,
    });
    // Do not snap the final partial frame's duration to a full frame.
    output.addVideoTrack(video);
    let audio: AudioBufferSource | undefined;
    if (opts.audioUrl) {
      input = new Input({ formats: ALL_FORMATS, source: new UrlSource(opts.audioUrl, { maxCacheSize: 8 * 1024 * 1024, getRetryDelay: () => null }) });
      const track = await input.getPrimaryAudioTrack();
      if (!track || !(await track.canDecode())) throw new Error("配音无法解码");
      const duration = await track.computeDuration();
      if (duration + 1 / 1000 < range.end) throw new Error("配音长度不足，无法覆盖导出区间");
      // The pinned FFmpeg AAC-LC encoder has exactly 1024 priming samples.
      // A negative start writes an MP4 edit list; do not guess native encoder delay per platform.
      audio = new AudioBufferSource({ codec: "aac", quality: new Quality("high") }, { startTimestamp: -1024 / await track.getSampleRate() });
      output.addAudioTrack(audio);
      audioIterator = new AudioBufferSink(track).buffers(range.start, range.end);
    }
    await output.start();
    let nextAudio = await audioIterator?.next();
    let audioSamples = 0;
    let sampleRate = 0;
    const addAudioUntil = async (until: number) => {
      while (nextAudio && !nextAudio.done && nextAudio.value.timestamp < until) {
        signal.throwIfAborted();
        const { buffer, timestamp } = nextAudio.value;
        sampleRate ||= buffer.sampleRate;
        if (sampleRate !== buffer.sampleRate) throw new Error("配音采样率在区间内变化");
        const { from, to } = audioWindow(timestamp, buffer.length, sampleRate, range.start, range.end, audioSamples);
        if (to > from) {
          const slice = new AudioBuffer({ length: to - from, numberOfChannels: buffer.numberOfChannels, sampleRate });
          for (let c = 0; c < buffer.numberOfChannels; c++) slice.copyToChannel(buffer.getChannelData(c).subarray(from, to), c);
          await audio!.add(slice);
          audioSamples += to - from;
        }
        nextAudio = await audioIterator!.next();
      }
    };
    const timings = { seekMs: 0, rasterMs: 0, videoMs: 0, audioMs: 0 };
    for (let i = 0; i < count; i++) {
      signal.throwIfAborted();
      const frame = frameAt(i, range.start, range.end);
      const t0 = performance.now();
      opts.seek(frame.timestamp);
      await waitForSceneTime(frame.timestamp, signal);
      const t1 = performance.now();
      await raster.draw(frame.timestamp);
      const t2 = performance.now();
      await video.add(i / EXPORT_FPS, frame.duration);
      const t3 = performance.now();
      await addAudioUntil(frame.timestamp + frame.duration);
      timings.seekMs += t1 - t0; timings.rasterMs += t2 - t1;
      timings.videoMs += t3 - t2; timings.audioMs += performance.now() - t3;
      if (i % 10 === 0 || i === count - 1) opts.onProgress((i + 1) / count, frame.timestamp + frame.duration - range.start);
    }
    await addAudioUntil(range.end);
    if (audio && Math.abs(audioSamples - (Math.round(range.end * sampleRate) - Math.round(range.start * sampleRate))) > 1) {
      throw new Error("配音采样不完整，导出已停止");
    }
    signal.throwIfAborted();
    video.close(); audio?.close();
    await output.finalize();
    signal.throwIfAborted();
    const file = await handle.getFile();
    if (!file.size) throw new Error("导出文件为空");
    return { file, dispose: remove, frames: count, audioSamples, sampleRate, timings };
  } catch (error) {
    await output?.cancel().catch(() => undefined);
    await remove();
    throw error;
  } finally {
    signal.removeEventListener("abort", stopInput);
    await audioIterator?.return(undefined).catch(() => undefined);
    input?.dispose(); raster?.dispose();
  }
}
