import "./AutoStartGate.css";

interface Props {
  visible: boolean;
  onStart(): void;
  /** kicker 文案 —— VO-First 传当前录制区间的 label（`?part=<id>`）。 */
  label?: string;
  /** 副标题 —— VO-First 传起播/停止的绝对时间提示；缺省用通用说明。 */
  hint?: string;
}

/**
 * Full-screen overlay shown ONCE when `?auto=1` is loaded. Browsers block
 * audio playback until the page receives a user gesture, so we show this
 * gate and let the user press Space (or click) to release auto playback.
 *
 * VO-First 多区间录制时，gate 显示当前区间与起播/停止秒 —— 按 SPACE 前先
 * 确认区间对不对（`?part=<id>` 切换）。这一下 SPACE 只解锁起播、不翻页
 * （useStepper 里有 `.auto-gate` 守卫），开场第一步不会被跳过。
 *
 * After the user starts, the gate is hidden for the rest of the session.
 */
export function AutoStartGate({ visible, onStart, label, hint }: Props) {
  if (!visible) return null;
  return (
    <div
      className="auto-gate"
      data-no-advance
      onClick={onStart}
      role="button"
      tabIndex={0}
    >
      <div className="auto-gate-card">
        <div className="auto-gate-kicker">{label ?? "AUTO PLAYBACK"}</div>
        <div className="auto-gate-title">按 SPACE 开始录制</div>
        <div className="auto-gate-sub">
          {hint ?? "音频自动播放并推进画面。"}
          <br />
          按 <kbd>M</kbd> 随时切换播放模式。
        </div>
      </div>
    </div>
  );
}
