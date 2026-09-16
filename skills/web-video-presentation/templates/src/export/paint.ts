const TIME_EPS = 0.02;

function sceneTime(): number {
  const el = document.querySelector<HTMLElement>(".scene");
  const n = el ? Number(el.dataset.time) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Wait until React committed `data-time`, then two extra frames for layout/paint. */
export async function waitForSceneTime(target: number, timeoutMs = 400): Promise<void> {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    const shown = sceneTime();
    if (Number.isFinite(shown) && Math.abs(shown - target) <= TIME_EPS) {
      await doubleRaf();
      return;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  await doubleRaf();
}
