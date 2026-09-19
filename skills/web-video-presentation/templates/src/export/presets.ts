export type ExportPresetId = "1k" | "2k" | "4k";

export interface ExportPreset {
  id: ExportPresetId;
  label: string;
  width: number;
  height: number;
  /** Raster scale from the 1920×1080 stage. */
  scale: number;
}

export const EXPORT_FPS = 30;

export const EXPORT_PRESETS: Record<ExportPresetId, ExportPreset> = {
  "1k": { id: "1k", label: "1K · 1920×1080", width: 1920, height: 1080, scale: 1 },
  "2k": { id: "2k", label: "2K · 2560×1440", width: 2560, height: 1440, scale: 4 / 3 },
  "4k": { id: "4k", label: "4K · 3840×2160", width: 3840, height: 2160, scale: 2 },
};

export const EXPORT_PRESET_ORDER: ExportPresetId[] = ["1k", "2k", "4k"];

export interface FramePlan {
  timestamp: number;
  duration: number;
}

/** Constant memory frame scheduling, including a positive final partial frame. */
export function frameCountFor(start: number, end: number, fps = EXPORT_FPS): number {
  if (![start, end, fps].every(Number.isFinite) || start < 0 || end <= start || fps <= 0) throw new Error("无效的导出区间或帧率");
  return Math.max(1, Math.ceil((end - start) * fps - 1e-9));
}
export function frameAt(index: number, start: number, end: number, fps = EXPORT_FPS): FramePlan {
  const timestamp = start + index / fps;
  return { timestamp, duration: Math.min(1 / fps, end - timestamp) };
}
export function framePlan(start: number, end: number, fps = EXPORT_FPS): FramePlan[] {
  return Array.from({ length: frameCountFor(start, end, fps) }, (_, i) => frameAt(i, start, end, fps));
}

export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
