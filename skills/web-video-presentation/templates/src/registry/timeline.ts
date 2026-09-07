/**
 * VO-First 绝对时间轴 —— 由 `npm run gen`（scripts/gen-timeline.mjs）从 plan.md
 * 的 ```timeline 块生成，**整文件覆写**。手改会在下次 gen 时丢失：改 plan.md 再生成。
 *
 * 机制（为什么是整段音频而不是每步切片）：
 *   录制态（?auto=1）播放**一条完整口播原声** VO_FULL_SRC（一刀不切），每帧读
 *   audio.currentTime，跨过 TIMELINE 里某个 step 的绝对起始秒就翻到那一步。
 *   切片方案有段间断点、听感割裂，且 ended→next→play 会累积漂移；整段方案
 *   音频 100% 连贯，翻页死锁在 SRT 绝对时间点上，零漂移。
 *
 * 多区间（补拍）：成片里只有部分区间由网页出画面时，在 plan.md 里声明 parts，
 *   录制时 URL 加 `?part=<id>` —— 整段音频 seek 到区间 start 起播，到 end 自动
 *   暂停（可以停录了）。音频依然一刀未切，后期按成片绝对秒直接对位。
 *
 * ⚠️ TIMELINE.length 必须 === 所有章节 narrations.length 之和（`npm run check` 会验）。
 *
 * 下面是【模板占位示例】：单区间全片、3 步，对应 01-example 章。
 * TIMELINE_GENERATED = false 表示尚未从 plan.md 生成 —— App 的 auto 模式
 * 会继续用「每步一个 mp3 切片」的老路径（TTS 项目用的就是它，无需理会本文件）。
 */

/** false = 模板占位（TTS 路径不用管）。npm run gen 后翻 true，auto 切到整段原声驱动。 */
export const TIMELINE_GENERATED: boolean = false;

/** 每个全局 step 的绝对起始秒（升序，长度 = 全片总 step 数）。 */
export const TIMELINE: number[] = [
  /* 01 example · step 0–2 */ 0, 4, 8,
];

/** 整段口播音频（public/ 下相对路径，原片音轨一字节不改）。 */
export const VO_FULL_SRC = "audio/vo-full.mp3";
/** ffprobe 实测整段时长（秒）。 */
export const VO_FULL_DURATION = 12;

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
    end: 12,
    firstStep: 0,
    lastStep: 2,
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
