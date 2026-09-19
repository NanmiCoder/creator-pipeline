import { EXPORT_PRESETS, EXPORT_PRESET_ORDER, formatClock, type ExportPresetId } from "../export/presets";
import type { PartDef } from "../registry/timeline";
import "./ExportModal.css";

interface Props {
  visible: boolean;
  presetId: ExportPresetId;
  partId: string;
  parts: PartDef[];
  duration: number;
  hasAudio: boolean;
  onPreset(id: ExportPresetId): void;
  onPart(id: string): void;
  onCancel(): void;
  onConfirm(): void;
}

export function ExportModal({
  visible,
  presetId,
  partId,
  parts,
  duration,
  hasAudio,
  onPreset,
  onPart,
  onCancel,
  onConfirm,
}: Props) {
  if (!visible) return null;
  const part = parts.find((p) => p.id === partId) ?? parts[0];
  const span = part ? (part.end || duration) - part.start : duration;
  return (
    <div className="ex-modal-backdrop" data-no-advance onClick={onCancel}>
      <div
        className="ex-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ex-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ex-kicker">Export MP4</div>
        <div className="ex-title" id="ex-title">选择导出分辨率</div>
        <div className="ex-presets">
          {EXPORT_PRESET_ORDER.map((id) => {
            const p = EXPORT_PRESETS[id];
            return (
              <button
                key={id}
                type="button"
                className="ex-choice"
                data-on={presetId === id}
                onClick={() => onPreset(id)}
              >
                <span className="ex-choice-label">{p.label}</span>
                <span className="ex-choice-size">{p.width}×{p.height}</span>
              </button>
            );
          })}
        </div>
        {parts.length > 1 && (
          <div className="ex-parts">
            {parts.map((p) => (
              <button
                key={p.id}
                type="button"
                className="ex-part"
                data-on={partId === p.id}
                onClick={() => onPart(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="ex-meta">
          时长 {formatClock(span)} · 30 帧/秒逐帧渲染
          {hasAudio ? " · 叠入口播原声" : " · 当前无配音，导出无声画面"}
        </div>
        <div className="ex-warn">每一帧与配音按同一时间轴生成。导出速度取决于画面复杂度和设备性能，请保持页面打开。</div>
        <div className="ex-actions">
          <button type="button" className="ex-ghost" onClick={onCancel}>取消</button>
          <button type="button" className="ex-primary" onClick={onConfirm}>开始导出</button>
        </div>
      </div>
    </div>
  );
}
