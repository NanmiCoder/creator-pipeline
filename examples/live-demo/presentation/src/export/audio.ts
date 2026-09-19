/** Sample-exact intersections across decoded packets; never round each chunk duration independently. */
export function audioWindow(timestamp: number, length: number, sampleRate: number, start: number, end: number, consumed: number) {
  const first = Math.round(start * sampleRate);
  const last = Math.round(end * sampleRate);
  const packet = Math.round(timestamp * sampleRate);
  if (packet > first + consumed + 1) throw new Error("配音存在时间缺口，导出已停止");
  return { from: Math.max(0, first + consumed - packet), to: Math.min(length, last - packet) };
}
