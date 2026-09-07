import "./SubtitleSafeZone.css";

/**
 * 底部「烧录字幕安全区」开发辅助层。
 *
 * 适用：成片会在底部烧录字幕（半透明底条 + 白字描边是常见样式）的视频。
 * 网页 PPT 的内容如果落进这条带子，成片上就会被字幕压住。
 *
 * 默认几何（1920×1080 舞台坐标）：**y ≥ 915 全宽**（165px 高），来自真实
 * 烧录字幕的实测保守值 —— 字幕底条常见 y ≈ 930–1005，长句可横跨 x ≈ 260–1660。
 * 项目字幕位置不同时，改 SubtitleSafeZone.css 里的 height。
 *
 * 与 AvatarSafeZone 同样：开发态显示，录制态（`?auto=1`）完全隐藏，
 * 录出来的画面绝对干净。App.tsx 用 SUBTITLE_SAFE 常量开关。
 */
export function SubtitleSafeZone({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  const isRecording =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("auto") === "1";
  if (isRecording) return null;

  return (
    <div className="subtitle-safe" aria-hidden>
      <span className="subtitle-safe-label">成片字幕区 · 勿放内容</span>
    </div>
  );
}
