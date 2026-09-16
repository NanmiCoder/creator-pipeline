import "./styles/fonts.css"; // Google Fonts for built-in themes
import "./styles/base.css";
import "./styles/tokens.css"; // active theme — MUST load AFTER base so theme :root overrides base defaults (hero-num / motion / radius personality knobs). See THEMES.md
import "./styles/animations.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AutoStartGate } from "./components/AutoStartGate";
import { AutoToggle } from "./components/AutoToggle";
import { AvatarSafeZone, type AvatarCorner } from "./components/AvatarSafeZone";
import { ExportButton } from "./components/ExportButton";
import { ExportModal } from "./components/ExportModal";
import { ExportProgress } from "./components/ExportProgress";
import { ProgressBar } from "./components/ProgressBar";
import { PreviewNotice } from "./components/PreviewNotice";
import { Stage } from "./components/Stage";
import { SubtitleSafeZone } from "./components/SubtitleSafeZone";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useAutoMode } from "./hooks/useAutoMode";
import { useChapterTime, useReviewTime } from "./hooks/useChapterTime";
import { useExport } from "./hooks/useExport";
import { indexAt } from "./motion/sample";
import { useStepper } from "./hooks/useStepper";
import { useTimelineAuto } from "./hooks/useTimelineAuto";
import { useSilentPreview } from "./hooks/useSilentPreview";
import { CHAPTERS } from "./registry/chapters";
import {
  PARTS,
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
  // Generated VO always takes precedence over the optional silent starter.
  const voFirst = TIMELINE_GENERATED && TIMELINE.length > 0;
  const preview = !voFirst && CHAPTERS.length === 1 ? CHAPTERS[0]!.previewTiming : undefined;
  const timeline = preview ? preview.map(cue => cue.at) : TIMELINE;
  const duration = preview ? preview[preview.length - 1]!.end : VO_FULL_DURATION;
  const query = new URLSearchParams(window.location.search);
  const defaultReview = !!preview && !['auto', 'audio', 'manual', 'review'].some(key => query.has(key));
  const reviewTime = useReviewTime(duration, defaultReview);
  const [exportTime, setExportTime] = useState<number | null>(null);
  const parts = useMemo(() => Object.values(PARTS), []);
  const part = useMemo(() => readPart(), []);
  const jumpToGlobal = stepper.jumpToGlobal;
  const seekExport = useCallback((t: number) => {
    setExportTime(t);
    if (timeline.length > 0) jumpToGlobal(indexAt(t, timeline));
  }, [jumpToGlobal, timeline]);
  const exporter = useExport({
    enabled: voFirst,
    parts,
    currentPart: part,
    duration,
    audioUrl: voFirst ? `${import.meta.env.BASE_URL}${VO_FULL_SRC}` : null,
    seek: seekExport,
  });
  useEffect(() => {
    if (!exporter.encoding || exporter.armed) setExportTime(null);
    document.documentElement.dataset.exporting = exporter.encoding ? "1" : "";
    return () => { delete document.documentElement.dataset.exporting; };
  }, [exporter.encoding, exporter.armed]);
  const clockTime = exporter.armed ? null : (exportTime ?? reviewTime);
  const offsets = CHAPTERS.map((_, i) => CHAPTERS.slice(0, i).reduce((n, c) => n + c.narrations.length, 0));
  const clockIndex = clockTime !== null ? indexAt(clockTime, timeline) : stepper.globalIndex;
  const chapterIndex = clockTime !== null ? indexAt(clockIndex, offsets) : stepper.cursor.chapter;
  const step = clockTime !== null ? clockIndex - offsets[chapterIndex]! : stepper.cursor.step;
  const ch = CHAPTERS[chapterIndex]!;
  const Cmp = ch.Component;
  const stepText = ch.narrations[step] ?? "";

  const { mode, cycleMode, autoStarted, setAutoStarted } = useAutoMode();
  const muted = useMemo(() => readMuted(), []);
  const live = !exporter.encoding && reviewTime === null;
  const exportLive = exporter.armed;

  // VO-First 的 auto 交给 useTimelineAuto —— 每步切片播放退化为 manual
  // （切片有段间断点 + ended→next→play 的累积漂移）。TTS 项目 auto 不受影响。
  const playerMode = preview || !live || (mode === "auto" && voFirst) ? "manual" : mode;

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
    enabled: voFirst && ((mode === "auto" && live) || exportLive),
    src: `${import.meta.env.BASE_URL}${VO_FULL_SRC}`,
    timeline: TIMELINE,
    autoStarted: autoStarted || exportLive,
    jumpToGlobal: stepper.jumpToGlobal,
    startAt: exportLive ? exporter.selectedPart.start : part.start,
    endAt: exportLive ? exporter.selectedPart.end : part.end,
    muted: muted || exporter.encoding,
  });

  const previewTime = useSilentPreview(!!preview && mode === "auto" && live, autoStarted, timeline, duration, stepper.jumpToGlobal);
  const chapterStart = voFirst || preview ? timeline[offsets[chapterIndex]!]! : 0;
  const stepStart = voFirst || preview ? timeline[offsets[chapterIndex]! + step]! - chapterStart
    : ch.narrations.slice(0, step).reduce((n, text) => n + estimateMs(text) / 1000, 0);
  const time = useChapterTime(
    exportTime ?? reviewTime ?? ((mode === "auto" && live) || exportLive ? (voFirst ? audioTime : preview ? previewTime : null) : null),
    chapterStart,
    stepStart,
  );
  const chromeHidden = exporter.encoding;

  return (
    <>
      {preview && !chromeHidden && <PreviewNotice />}
      <Stage onAdvance={chromeHidden ? () => undefined : stepper.next} quiet={chromeHidden}>
        <div key={ch.id} className="scene" data-time={(time + chapterStart).toFixed(3)} data-step={step} data-chapter={ch.id}>
          <Cmp step={step} time={time} stepReview={!chromeHidden && reviewTime !== null && (defaultReview || query.get('steps') === '1')} />
        </div>
        {!chromeHidden && reviewTime === null && <AvatarSafeZone corner={AVATAR_CORNER} />}
        {!chromeHidden && reviewTime === null && <SubtitleSafeZone enabled={SUBTITLE_SAFE} />}
      </Stage>
      {reviewTime === null && !chromeHidden && <>
      <ProgressBar
        chapters={CHAPTERS}
        cursor={stepper.cursor}
        onJumpChapter={stepper.jumpToChapter}
      />
      <AutoToggle mode={mode} onCycle={cycleMode} />
      <AutoStartGate
        visible={mode === "auto" && !autoStarted && exporter.phase === "idle"}
        onStart={() => setAutoStarted(true)}
        label={
          preview ? "播放模板演示（无声）" : voFirst
            ? muted
              ? `${part.label}（静音验证）`
              : part.label
            : undefined
        }
        hint={
          preview ? "演示 21 个动作拍 · 接入真实音频与 SRT 后，自动由声音驱动画面" : voFirst
            ? `起播 ${part.start.toFixed(3)}s → 停止 ${part.end.toFixed(3)}s（成片绝对时间）· 切区间 ?part=<id>${
                muted ? " · 当前静音（?mute=1），录制请去掉该参数" : ""
              }`
            : undefined
        }
      />
      </>}
      {!chromeHidden && (
        <ExportButton
          disabled={!exporter.enabled}
          title={exporter.enabled ? "导出 MP4" : "先导入配音与 SRT"}
          onClick={exporter.openPicker}
        />
      )}
      <ExportModal
        visible={exporter.phase === "picking"}
        presetId={exporter.presetId}
        partId={exporter.partId}
        parts={parts}
        duration={duration}
        hasAudio={voFirst}
        onPreset={exporter.setPreset}
        onPart={exporter.setPartId}
        onCancel={exporter.closePicker}
        onConfirm={() => void exporter.start()}
      />
      <ExportProgress
        phase={exporter.phase}
        ratio={exporter.ratio}
        time={exporter.time}
        duration={(exporter.selectedPart.end || duration) - exporter.selectedPart.start}
        error={exporter.error}
        onCancel={exporter.cancel}
        onDismiss={exporter.dismiss}
      />
    </>
  );
}
