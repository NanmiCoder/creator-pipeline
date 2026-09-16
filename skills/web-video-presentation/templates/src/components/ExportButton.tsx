import "./ExportButton.css";

interface Props {
  disabled?: boolean;
  title?: string;
  onClick(): void;
}

export function ExportButton({ disabled, title, onClick }: Props) {
  return (
    <div className="ex-btn-wrap" data-no-advance>
      <button
        type="button"
        className="ex-btn"
        disabled={disabled}
        title={title ?? "导出 MP4"}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <span className="ex-btn-dot" />
        导出
      </button>
    </div>
  );
}
