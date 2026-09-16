import { formatClock } from "../export/presets";
import type { ExportPhase } from "../hooks/useExport";
import "./ExportProgress.css";

interface Props {
  phase: ExportPhase;
  ratio: number;
  time: number;
  duration: number;
  error: string | null;
  onCancel(): void;
  onDismiss(): void;
}

export function ExportProgress({
  phase,
  ratio,
  time,
  duration,
  error,
  onCancel,
  onDismiss,
}: Props) {
  if (phase !== "encoding" && phase !== "done" && phase !== "error") return null;
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className="ex-progress" data-no-advance>
      <div className="ex-progress-row">
        <span>{phase === "encoding" ? "正在导出" : phase === "done" ? "已下载" : "导出失败"}</span>
        <span>
          {pct}% · {formatClock(time)} / {formatClock(duration)}
        </span>
      </div>
      <div className="ex-progress-bar" aria-hidden="true">
        <div className="ex-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {phase === "encoding" && (
        <div className="ex-progress-msg">只录 16:9 舞台，进度条在画面外。请保持本标签在前台。</div>
      )}
      {phase === "done" && (
        <div className="ex-progress-msg">MP4 已开始下载。若浏览器拦截，请允许本页下载文件。</div>
      )}
      {phase === "error" && error && <div className="ex-progress-msg">{error}</div>}
      <div className="ex-progress-actions">
        {phase === "encoding" && (
          <button type="button" onClick={onCancel}>取消</button>
        )}
        {(phase === "done" || phase === "error") && (
          <button type="button" onClick={onDismiss}>关闭</button>
        )}
      </div>
    </div>
  );
}
