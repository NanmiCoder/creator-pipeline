import { useEffect, useState } from 'react';

/** Manual preview clock only. VO and review always use the supplied absolute clock. */
export function useChapterTime(absolute: number | null, chapterStart: number, stepStart: number) {
  const [preview, setPreview] = useState(stepStart);
  useEffect(() => {
    if (absolute !== null) return;
    const origin = performance.now();
    let raf = 0;
    const tick = () => {
      setPreview(stepStart + (performance.now() - origin) / 1000);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [absolute === null, chapterStart, stepStart]);
  return absolute === null ? preview : absolute - chapterStart;
}

/** Review is opt-in, silent, and does not mutate the persisted manual cursor. */
export function useReviewTime(duration: number, defaultEnabled = false) {
  const enabled = defaultEnabled || new URLSearchParams(window.location.search).get('review') === '1';
  const bound = (n: number) => Math.max(0, Math.min(duration, n));
  const [time, setTime] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get('t');
    return bound(raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : 0);
  });
  useEffect(() => {
    if (!enabled) return;
    const seek = (e: Event) => {
      const n: unknown = (e as CustomEvent).detail;
      if (typeof n === 'number' && Number.isFinite(n)) setTime(bound(n));
    };
    window.addEventListener('presentation:seek', seek);
    return () => window.removeEventListener('presentation:seek', seek);
  }, [enabled, duration]);
  return enabled ? time : null;
}
