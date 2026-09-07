import "./styles/fonts.css"; // Google Fonts for built-in themes
import "./styles/base.css";
import "./styles/tokens.css"; // active theme — MUST load AFTER base so theme :root overrides base defaults (hero-num / motion / radius personality knobs). See THEMES.md
import "./styles/animations.css";

import { useCallback, useMemo } from "react";
import { AutoStartGate } from "./components/AutoStartGate";
import { AutoToggle } from "./components/AutoToggle";
import { AvatarSafeZone, type AvatarCorner } from "./components/AvatarSafeZone";
import { ProgressBar } from "./components/ProgressBar";
import { Stage } from "./components/Stage";
import { SubtitleSafeZone } from "./components/SubtitleSafeZone";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useAutoMode } from "./hooks/useAutoMode";
import { useChapterTime, useReviewTime } from "./hooks/useChapterTime";
import { indexAt } from "./motion/sample";
import { useStepper } from "./hooks/useStepper";
import { useTimelineAuto } from "./hooks/useTimelineAuto";
import { CHAPTERS } from "./registry/chapters";
import {
  readPart,
  TIMELINE,
  TIMELINE_GENERATED,
  VO_FULL_SRC,
  VO_FULL_DURATION,
} from "./registry/timeline";

/**
 * 头像安全区：出镜叠真人头像的视频，设成头像所在角（"top-right" / "bottom-left"
 * / "top-left" / "bottom-right"）—— 开发态在该角画虚线圆环提示，主内容须避让该角
 * 约 432×432；录制态（`?auto=1`）圆环自动隐藏，画面干净。**不出镜 / TTS 视频留 `null`**。
 */
const AVATAR_CORNER: AvatarCorner = null;

/**
 * 底部字幕安全区：成片会烧录字幕的视频设 true —— 开发态画出底部字幕带
 * （默认 y ≥ 915 全宽，见 SubtitleSafeZone.css），录制态自动隐藏。
 */
const SUBTITLE_SAFE = false;

/**
 * 静音验证开关 —— URL 带 `?mute=1` 时音频静音播放。
 *
 * 音频照常解码、`currentTime` 照常推进、`ended` 照常触发，所以翻页行为与
 * 有声时完全一致，只是听不见。给自动化验证用（agent 跑 `?auto=1&mute=1`
 * 截关键帧，不会在用户机器上突然放出整段口播）。
 *
 * **录制时不要带这个参数** —— 起播蒙层会显示「静音」提醒防止误录。
 */
function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  const v = new URLSearchParams(window.location.search).get("mute");
  return v === "1" || v === "true";
}

/**
 * Estimate spoken duration of a Chinese narration string. Native pace
 * ≈ 4 char/s → 250ms per char. Used as Auto-mode fallback ONLY when the
 * audio file is missing / fails / the narration is empty. When audio plays
 * normally, this value is unused — auto-advance fires on `audio.ended`.
 */
function estimateMs(text: string): number {
  if (!text) return 1500;
  return Math.max(1500, text.length * 250);
}

export default function App() {
  const stepper = useStepper(CHAPTERS);
  const reviewTime = useReviewTime(VO_FULL_DURATION);
  const offsets = CHAPTERS.map((_, i) => CHAPTERS.slice(0, i).reduce((n, c) => n + c.narrations.length, 0));
  const reviewIndex = reviewTime !== null ? indexAt(reviewTime, TIMELINE) : stepper.globalIndex;
  const chapterIndex = reviewTime !== null ? indexAt(reviewIndex, offsets) : stepper.cursor.chapter;
  const step = reviewTime !== null ? reviewIndex - offsets[chapterIndex]! : stepper.cursor.step;
  const ch = CHAPTERS[chapterIndex]!;
  const Cmp = ch.Component;
  const stepText = ch.narrations[step] ?? "";

  const { mode, cycleMode, autoStarted, setAutoStarted } = useAutoMode();

  // VO-First：`npm run gen` 生成 timeline.ts 后（TIMELINE_GENERATED=true），
  // auto 模式自动切到「整段原声 + 绝对时间轴」驱动。TTS / 未生成 → 走每步切片。
  const voFirst = TIMELINE_GENERATED && TIMELINE.length > 0;

  // 录制区间（`?part=<id>`）。单区间全片时就是默认 part；多区间补拍时
  // 在 plan.md 的 parts 里声明，gen 写进 timeline.ts 的 PARTS。
  const part = useMemo(() => readPart(), []);
  const muted = useMemo(() => readMuted(), []);

  // VO-First 的 auto 交给 useTimelineAuto —— 每步切片播放退化为 manual
  // （切片有段间断点 + ended→next→play 的累积漂移）。TTS 项目 auto 不受影响。
  const playerMode = reviewTime !== null || (mode === "auto" && voFirst) ? "manual" : mode;

  // Audio path follows the convention: /audio/<chapter-id>/<step+1>.mp3
  // (1-indexed file names match what `extract-narrations.ts` outputs.)
  // Empty narration → no audio src, Auto mode falls back to estimate.
  const audioSrc =
    playerMode === "manual" || stepText === ""
      ? null
      : `${import.meta.env.BASE_URL}audio/${ch.id}/${stepper.cursor.step + 1}.mp3`;

  const onAutoAdvance = useCallback(() => stepper.next(), [stepper]);

  useAudioPlayer({
    src: audioSrc,
    mode: playerMode,
    trailMs: 200,
    estimateFallbackMs: estimateMs(stepText),
    onAutoAdvance,
    autoStarted,
    muted,
  });

  const audioTime = useTimelineAuto({
    enabled: mode === "auto" && voFirst && reviewTime === null,
    src: `${import.meta.env.BASE_URL}${VO_FULL_SRC}`,
    timeline: TIMELINE,
    autoStarted,
    jumpToGlobal: stepper.jumpToGlobal,
    startAt: part.start,
    endAt: part.end,
    muted,
  });

  const chapterStart = voFirst ? TIMELINE[offsets[chapterIndex]!]! : 0;
  const stepStart = voFirst ? TIMELINE[offsets[chapterIndex]! + step]! - chapterStart
    : ch.narrations.slice(0, step).reduce((n, text) => n + estimateMs(text) / 1000, 0);
  const time = useChapterTime(reviewTime ?? (mode === "auto" && voFirst ? audioTime : null), chapterStart, stepStart);

  return (
    <>
      <Stage onAdvance={stepper.next}>
        <div key={ch.id} className="scene" data-time={(time + chapterStart).toFixed(3)} data-step={step} data-chapter={ch.id}>
          <Cmp step={step} time={time} />
        </div>
        {reviewTime === null && <AvatarSafeZone corner={AVATAR_CORNER} />}
        {reviewTime === null && <SubtitleSafeZone enabled={SUBTITLE_SAFE} />}
      </Stage>
      {reviewTime === null && <>
      <ProgressBar
        chapters={CHAPTERS}
        cursor={stepper.cursor}
        onJumpChapter={stepper.jumpToChapter}
      />
      <AutoToggle mode={mode} onCycle={cycleMode} />
      <AutoStartGate
        visible={mode === "auto" && !autoStarted}
        onStart={() => setAutoStarted(true)}
        label={
          voFirst
            ? muted
              ? `${part.label}（静音验证）`
              : part.label
            : undefined
        }
        hint={
          voFirst
            ? `起播 ${part.start.toFixed(3)}s → 停止 ${part.end.toFixed(3)}s（成片绝对时间）· 切区间 ?part=<id>${
                muted ? " · 当前静音（?mute=1），录制请去掉该参数" : ""
              }`
            : undefined
        }
      />
      </>}
    </>
  );
}
