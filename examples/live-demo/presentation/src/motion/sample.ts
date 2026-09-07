/** Pure time sampling: seeking backward and replaying have identical results. */
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const linear = (p: number) => p;
export const easeOut = (p: number) => 1 - (1 - p) ** 3;
export const easeInOut = (p: number) => p * p * (3 - 2 * p);
export function progress(time: number, start: number, duration: number, ease = easeOut) {
  if (duration <= 0) return time >= start ? 1 : 0;
  return ease(clamp01((time - start) / duration));
}
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export function windowOpacity(time: number, start: number, end: number, fade = 0.3) {
  return progress(time, start, fade) * (1 - progress(time, end, fade));
}
export function indexAt(time: number, starts: readonly number[]) {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1]! <= time) i++;
  return i;
}
