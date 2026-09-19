let aacReady: Promise<void> | undefined;
export function prepareAacEncoder() {
  return aacReady ??= import("@mediabunny/aac-encoder").then(m => { m.registerAacEncoder(); });
}
import { canEncodeAudio, canEncodeVideo, Quality } from "mediabunny";
import type { ExportPreset } from "./presets";

export type ExportSupport =
  | { ok: true }
  | { ok: false; reason: string };

export async function checkExportSupport(preset: ExportPreset): Promise<ExportSupport> {
  if (typeof navigator.storage?.getDirectory !== "function") {
    return { ok: false, reason: "导出需要浏览器临时文件存储。请用最新版 Chrome / Edge 并通过 HTTPS 或 localhost 打开。" };
  }
  if (!("VideoEncoder" in globalThis)) {
    return { ok: false, reason: "当前浏览器不支持 WebCodecs。请用最新版 Chrome 或 Edge。" };
  }
  await prepareAacEncoder();
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
