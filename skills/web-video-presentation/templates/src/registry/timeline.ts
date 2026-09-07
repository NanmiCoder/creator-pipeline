/** Replaced entirely by npm run gen from plan.md. No audio is bundled. */
export const TIMELINE_GENERATED: boolean = false;
// Legacy placeholder. The starter uses its explicit chapter.previewTiming instead.
export const TIMELINE: number[] = [];
export const VO_FULL_SRC = "audio/vo-full.mp3";
export const VO_FULL_DURATION = 0;

export interface PartDef {
  id: string;
  /** 区间标签（AutoStartGate / 开发态 HUD 显示）。 */
  label: string;
  /** 绝对起播秒。 */
  start: number;
  /** 绝对停止秒 —— 播到这里自动暂停，录屏可以停了。 */
  end: number;
  /** 本区间第一个全局 step 下标（TIMELINE 的索引）。 */
  firstStep: number;
  /** 本区间最后一个全局 step 下标。 */
  lastStep: number;
}

export const PARTS: Record<string, PartDef> = {
  full: {
    id: "full",
    label: "全片",
    start: 0,
    end: VO_FULL_DURATION,
    firstStep: 0,
    lastStep: TIMELINE.length - 1,
  },
};

/** 从 URL 读 `?part=<id>`；缺省 / 未知 id = 第一个区间。 */
export function readPart(): PartDef {
  const ids = Object.keys(PARTS);
  const first =
    ids.length > 0
      ? PARTS[ids[0]!]!
      : {
          id: "full",
          label: "全片",
          start: 0,
          end: VO_FULL_DURATION,
          firstStep: 0,
          lastStep: Math.max(0, TIMELINE.length - 1),
        };
  if (typeof window === "undefined") return first;
  const q = new URLSearchParams(window.location.search).get("part");
  if (!q) return first;
  const hit = PARTS[q];
  if (!hit) {
    console.warn(`unknown ?part=${q} — falling back to "${first.id}"`);
    return first;
  }
  return hit;
}

/** 把绝对秒格式化成 `m:ss.f`，开发态标注用。 */
export function fmtAbs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
