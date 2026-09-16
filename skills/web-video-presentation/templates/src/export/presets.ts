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

/** Inclusive range `[start, end]` snapped to `fps`, last frame fills the remainder. */
export function framePlan(start: number, end: number, fps = EXPORT_FPS): FramePlan[] {
  const lo = Math.max(0, start);
  const hi = Math.max(lo, end);
  const span = hi - lo;
  const count = Math.max(1, Math.round(span * fps));
  const frames: FramePlan[] = [];
  for (let i = 0; i < count; i++) {
    const timestamp = lo + i / fps;
    const next = i === count - 1 ? hi : lo + (i + 1) / fps;
    frames.push({ timestamp, duration: next - timestamp });
  }
  return frames;
}

export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
