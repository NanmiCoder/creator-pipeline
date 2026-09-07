import './PreviewNotice.css';

/** Outside the recording frame; this starter contains no synthesized voice. */
export function PreviewNotice() {
  return <aside className="preview-notice" data-no-advance>
    <span>模板演示 · 无声<span className="preview-detail"> · 波形与时间区间为示意</span></span>
    <a href="?review=1&t=0&steps=1">逐拍</a>
    <a href="?auto=1">自动播放</a>
  </aside>;
}
