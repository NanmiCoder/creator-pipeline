import {useEffect, useRef, useState} from 'react';
import {indexAt} from '../motion/sample';

/** Explicit no-media starter only. Never a fallback for failed real audio. */
export function useSilentPreview(enabled: boolean, started: boolean, timeline: number[], duration: number, jump: (index: number) => void) {
  const [time, setTime] = useState(0);
  const latest = useRef({timeline, jump});
  latest.current = {timeline, jump};
  useEffect(() => {
    if (!enabled) return;
    setTime(0);
    latest.current.jump(0);
    if (!started) return;
    const origin = performance.now();
    let raf = 0, previous = -1;
    const tick = () => {
      const t = Math.min(duration, (performance.now() - origin) / 1000);
      setTime(t);
      const index = indexAt(t, latest.current.timeline);
      if (index !== previous) { latest.current.jump(index); previous = index; }
      if (t < duration) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [enabled, started, duration]);
  return enabled && !started ? 0 : time;
}
