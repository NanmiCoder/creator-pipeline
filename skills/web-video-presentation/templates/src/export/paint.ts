/** A missing/stale React commit is an error, never permission to encode the previous frame. */
export async function waitForSceneTime(target: number, signal: AbortSignal, timeoutMs = 5000): Promise<void> {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    signal.throwIfAborted();
    const value = document.querySelector<HTMLElement>(".scene")?.dataset.time;
    if (value !== undefined && Math.abs(Number(value) - target) <= 0.0006) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error(`画面未就绪（${target.toFixed(3)}s），导出已停止`);
}
