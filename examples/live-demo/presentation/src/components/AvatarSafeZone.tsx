import "./AvatarSafeZone.css";

/** 头像贴哪个角。`null` = 不出镜 / 不预留（默认，TTS 或无头像视频用）。 */
export type AvatarCorner =
  | "top-right"
  | "bottom-left"
  | "top-left"
  | "bottom-right"
  | null;

interface Props {
  /** 头像所在角。出镜叠头像的视频设成对应角，主内容须避让该角约 432×432。 */
  corner: AvatarCorner;
}

/**
 * 出镜视频的「圆形头像安全区」开发辅助层。
 *
 * 录制时把全脸口播视频缩成圆形头像贴在某个角，主内容必须避开该角排布。这里画一个
 * 虚线圆环 + 标注，开发时一眼看到边界在哪；录制态（URL 带 `?auto=1`）**完全隐藏**，
 * 录出来的画面绝对干净 —— 头像由用户在后期叠加，PPT 这一层不留任何痕迹。
 *
 * `corner = null`（默认）→ 不渲染，对不出镜 / TTS 视频零影响。
 *
 * 在 stage-frame 内渲染（与 `.scene` 同级），跟随舞台一起 scale，pointer-events
 * 关闭，点击穿透不影响推进。
 *
 * 安全区 432×432：圆 320 直径 + 四周 56px 呼吸（距边 56）。**每章主内容请勿进入这个角。**
 */
export function AvatarSafeZone({ corner }: Props) {
  if (!corner) return null;
  const isRecording =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("auto") === "1";
  if (isRecording) return null;

  return (
    <div className={`avatar-safe avatar-safe--${corner}`} aria-hidden>
      <div className="avatar-safe-ring">
        <span className="avatar-safe-label">口播头像</span>
        <span className="avatar-safe-sub">Avatar</span>
      </div>
    </div>
  );
}
