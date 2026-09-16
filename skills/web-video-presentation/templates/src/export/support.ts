import { canEncodeAudio, canEncodeVideo, Quality } from "mediabunny";
import type { ExportPreset } from "./presets";

export type ExportSupport =
  | { ok: true }
  | { ok: false; reason: string };

export async function checkExportSupport(preset: ExportPreset): Promise<ExportSupport> {
  if (typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    return { ok: false, reason: "当前浏览器不支持标签页捕获。请用最新版 Chrome 或 Edge。" };
  }
  if (!("VideoEncoder" in globalThis) || !("AudioEncoder" in globalThis)) {
    return { ok: false, reason: "当前浏览器不支持 WebCodecs。请用最新版 Chrome 或 Edge。" };
  }
  const quality = new Quality("high");
  const video = await canEncodeVideo("avc", {
    width: preset.width,
    height: preset.height,
    quality,
  });
  if (!video) {
    return {
      ok: false,
      reason: `无法编码 ${preset.width}×${preset.height} H.264。请换 Chrome / Edge，或改选更低分辨率。`,
    };
  }
  const audio = await canEncodeAudio("aac", { quality });
  if (!audio) {
    return { ok: false, reason: "无法编码 AAC 音轨。请用最新版 Chrome 或 Edge。" };
  }
  return { ok: true };
}
