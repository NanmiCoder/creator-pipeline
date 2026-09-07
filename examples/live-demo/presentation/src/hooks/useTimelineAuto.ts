import { useEffect, useRef, useState } from "react";

interface Options {
  /** 是否启用（mode === "auto" 且项目已生成 timeline）。 */
  enabled: boolean;
  /** 完整连续口播音频路径（如 `audio/vo-full.mp3`，整段不切）。 */
  src: string;
  /** 每个全局 step 的绝对起始秒（升序，长度 = 全片总 step 数）。来自 timeline.ts。 */
  timeline: number[];
  /** AutoStartGate 起播后翻 true（浏览器需要用户手势才能自动播放）。 */
  autoStarted: boolean;
  /** 跳到第 i 个全局 step（useStepper 提供）。 */
  jumpToGlobal: (i: number) => void;
  /**
   * 绝对起播秒。多区间补拍（成片只有部分区间由网页出画面）时，
   * seek 到区间起点再播，而不是从 0 播。单区间全片传第一步的 at 即可。
   */
  startAt?: number;
  /** 绝对停止秒 —— 播到这里自动暂停（区间放完了，可以停录）。 */
  endAt?: number;
  /** 到达 endAt 时回调一次。 */
  onReachEnd?: () => void;
  /**
   * 静音播放（`?mute=1`）。音频照常解码、`currentTime` 照常推进，
   * 因此时间轴驱动的翻页行为与有声时**完全一致** —— 只是听不见。
   *
   * 这是给自动化验证用的：agent 用 `?auto=1&mute=1` 跑端到端、截关键帧，
   * 不会在用户机器上莫名其妙地放出整段口播。**录制时不要带这个参数**。
   */
  muted?: boolean;
}

/**
 * Auto 模式（录制）的「整段连续音频 + 绝对时间轴」驱动 —— VO-First（真人口播）首选。
 *
 * 不要每步播一段切片（段间有断点、听感割裂，且 ended→next→play 会累积漂移），
 * 而是播放**一条完整口播音频**，用 requestAnimationFrame 读 `audio.currentTime`，
 * 跨过 `timeline` 里某个 step 的绝对起始时刻就翻到那一页。
 *
 * 避免每段 ended→next→play 的累计延迟，画面采样同一音频时钟。
 * 浏览器后台节流、帧率与录屏起点仍可能影响结果，实际录制需验收。
 *
 * ── 区间模式（startAt / endAt）──
 * 补拍场景：成片里只有若干区间由网页 PPT 出画面，中间是已剪好的实拍/录屏。
 * 整条原声 seek 到区间起点播、到区间终点自动停 —— **音频依然一刀未切**，
 * 时间轴全用成片绝对秒，后期不用算任何偏移量。区间定义见 timeline.ts 的 PARTS，
 * 录制时用 `?auto=1&part=<id>` 选区间。
 *
 * 时间轴每帧把 cursor 拉到 `idxAt(currentTime)`，录制中误触翻页会被下一帧纠回。
 */
export function useTimelineAuto({
  enabled,
  src,
  timeline,
  autoStarted,
  jumpToGlobal,
  startAt = 0,
  endAt,
  onReachEnd,
  muted = false,
}: Options) {
  const [time, setTime] = useState(startAt);
  // 用 ref 持最新回调 / 时间轴，避免它们的引用变化重启音频。
  const jumpRef = useRef(jumpToGlobal);
  jumpRef.current = jumpToGlobal;
  const tlRef = useRef(timeline);
  tlRef.current = timeline;
  const endRef = useRef(onReachEnd);
  endRef.current = onReachEnd;

  useEffect(() => {
    if (!enabled || !autoStarted) return;

    const audio = new Audio(src);
    audio.preload = "auto";
    audio.muted = muted;
    let raf = 0;
    let lastIdx = -1;
    let stopped = false;

    // 当前时刻 t 应停在的全局 step：最大的「起始时间 ≤ t」的那个。
    const idxAt = (t: number): number => {
      const tl = tlRef.current;
      let idx = 0;
      for (let i = 0; i < tl.length; i++) {
        if (t + 0.001 >= tl[i]!) idx = i;
        else break;
      }
      return idx;
    };

    const tick = () => {
      if (stopped) return;
      // 区间放完 → 停音频、停 rAF，画面定在最后一步（可以停录了）。
      if (endAt !== undefined && audio.currentTime >= endAt) {
        stopped = true;
        audio.pause();
        setTime(endAt);
        jumpRef.current(idxAt(Math.max(startAt, endAt - 0.001)));
        endRef.current?.();
        return;
      }
      setTime(audio.currentTime);
      const idx = idxAt(audio.currentTime);
      if (idx !== lastIdx) {
        lastIdx = idx;
        jumpRef.current(idx);
      }
      raf = requestAnimationFrame(tick);
    };

    const begin = () => {
      // 先 seek 到区间绝对起点，再起播。metadata 就绪后 seek 才可靠。
      try {
        audio.currentTime = startAt;
      } catch (err) {
        stopped = true;
        console.error("timeline seek failed; playback stopped:", err);
        return;
      }
      audio
        .play()
        .then(() => {
          setTime(startAt);
          lastIdx = idxAt(startAt);
          jumpRef.current(lastIdx); // 起播即对齐到本区间第一步
          raf = requestAnimationFrame(tick);
        })
        .catch((err) => {
          // 自动播放被拦截（AutoStartGate 的手势应已解锁）/ 文件缺失。
          console.warn("timeline audio play failed:", err);
        });
    };

    const onEnded = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      setTime(audio.currentTime);
      jumpRef.current(idxAt(Math.max(startAt, audio.currentTime - 0.001)));
      endRef.current?.();
    };
    audio.addEventListener("ended", onEnded);
    if (audio.readyState >= 1 /* HAVE_METADATA */) begin();
    else audio.addEventListener("loadedmetadata", begin, { once: true });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      audio.removeEventListener("loadedmetadata", begin);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [enabled, autoStarted, src, startAt, endAt, muted]);
  return time;
}
