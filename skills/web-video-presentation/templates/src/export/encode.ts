import {
  AudioBufferSource,
  BufferTarget,
  MediaStreamVideoTrackSource,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import { decodeAudio, sliceAudioBuffer } from "./audio";
import { captureTarget, ExportCanceledError, restrictToStage, stopStream } from "./capture";
import { downloadBlob, exportFilename } from "./download";
import { waitForSceneTime } from "./paint";
import type { ExportPreset } from "./presets";
import { checkExportSupport } from "./support";

export { ExportCanceledError } from "./capture";

export interface EncodeRange {
  start: number;
  end: number;
  partId: string;
}

export interface EncodeOptions {
  preset: ExportPreset;
  range: EncodeRange;
  audioUrl: string | null;
  stream: MediaStream;
  seek: (time: number) => void;
  onArmed: () => void;
  signal: AbortSignal;
  onProgress: (ratio: number, time: number) => void;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new ExportCanceledError();
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ExportCanceledError());
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new ExportCanceledError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitPaint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function encodePresentation(opts: EncodeOptions): Promise<void> {
  const support = await checkExportSupport(opts.preset);
  if (!support.ok) throw new Error(support.reason);
  throwIfAborted(opts.signal);

  const track = opts.stream.getVideoTracks()[0];
  if (!track) throw new Error("没有捕获到画面轨道");
  const surface = track.getSettings().displaySurface;
  if (surface && surface !== "browser") {
    stopStream(opts.stream);
    throw new Error("请选择「当前标签页」，不要选整个屏幕或窗口。");
  }

  await waitPaint();
  throwIfAborted(opts.signal);
  const stage = captureTarget();
  if ("fonts" in document) await document.fonts.ready.catch(() => undefined);
  await restrictToStage(track, stage);
  await waitPaint();

  opts.seek(opts.range.start);
  await waitForSceneTime(opts.range.start);
  throwIfAborted(opts.signal);

  const quality = new Quality("high");
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });
  const video = new MediaStreamVideoTrackSource(
    track,
    {
      codec: "avc",
      quality,
      latencyMode: "realtime",
      hardwareAcceleration: "prefer-hardware",
      contentHint: "detail",
      sizeChangeBehavior: "cover",
      transform: {
        width: opts.preset.width,
        height: opts.preset.height,
        fit: "cover",
        alpha: "discard",
      },
    },
    { frameRate: 30, timestampBase: "zero" },
  );
  output.addVideoTrack(video, { frameRate: 30 });

  let audio: AudioBufferSource | null = null;
  if (opts.audioUrl) {
    audio = new AudioBufferSource({ codec: "aac", quality });
    output.addAudioTrack(audio);
  }

  let videoError: unknown = null;
  const fail = video.errorPromise.then(
    () => undefined,
    (err: unknown) => {
      videoError = err instanceof Error ? err : new Error("画面编码失败");
    },
  );

  await output.start();
  try {
    if (audio && opts.audioUrl) {
      const full = await decodeAudio(opts.audioUrl);
      throwIfAborted(opts.signal);
      const ctx = new OfflineAudioContext(full.numberOfChannels, 1, full.sampleRate);
      await audio.add(sliceAudioBuffer(ctx, full, opts.range.start, opts.range.end));
    }

    opts.seek(opts.range.start);
    await waitForSceneTime(opts.range.start);
    throwIfAborted(opts.signal);
    opts.onArmed();

    const span = Math.max(0.05, opts.range.end - opts.range.start);
    const t0 = performance.now();
    while (!opts.signal.aborted) {
      if (videoError) throw videoError;
      const elapsed = (performance.now() - t0) / 1000;
      opts.onProgress(Math.min(1, elapsed / span), opts.range.start + Math.min(span, elapsed));
      if (elapsed >= span) break;
      await Promise.race([sleep(80, opts.signal), fail]);
    }
    if (videoError) throw videoError;

    video.close();
    audio?.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  } finally {
    stopStream(opts.stream);
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("导出完成但没有得到文件");
  const blob = new Blob([new Uint8Array(buffer)], { type: "video/mp4" });
  if (blob.size < 64 * 1024) throw new Error("导出文件过小，画面轨道可能为空。请重试并选择当前标签页。");
  downloadBlob(blob, exportFilename(opts.preset.id, opts.range.partId));
}
