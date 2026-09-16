export class ExportCanceledError extends Error {
  constructor(message = "已取消导出") {
    super(message);
    this.name = "ExportCanceledError";
  }
}

type RestrictableTrack = MediaStreamTrack & {
  restrictTo?: (target: unknown) => Promise<void>;
  cropTo?: (target: unknown) => Promise<void>;
};

function captureGlobals() {
  const w = window as unknown as {
    RestrictionTarget?: { fromElement(el: Element): Promise<unknown> };
    CropTarget?: { fromElement(el: Element): Promise<unknown> };
  };
  return w;
}

export function canCaptureTab(): boolean {
  return typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/**
 * Must run in the same user-gesture turn as the export click.
 * Chrome still shows a picker; hint current tab.
 */
export async function requestTabCapture(): Promise<MediaStream> {
  if (!canCaptureTab()) {
    throw new Error("当前浏览器不支持标签页捕获。请用最新版 Chrome 或 Edge。");
  }
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: 30,
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "exclude",
      systemAudio: "exclude",
    } as DisplayMediaStreamOptions);
  } catch (err) {
    if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) {
      throw new ExportCanceledError("未选择当前标签页");
    }
    throw err;
  }
}

/** Visible 16:9 rectangle only — chrome, guides and letterbox stay outside. */
export function captureTarget(): HTMLElement {
  const fitter = document.querySelector<HTMLElement>(".stage-fitter");
  if (!fitter) throw new Error("找不到舞台 .stage-fitter");
  return fitter;
}

export async function restrictToStage(track: MediaStreamTrack, el: HTMLElement): Promise<void> {
  const { RestrictionTarget, CropTarget } = captureGlobals();
  const t = track as RestrictableTrack;
  if (RestrictionTarget && t.restrictTo) {
    await t.restrictTo(await RestrictionTarget.fromElement(el));
    return;
  }
  if (CropTarget && t.cropTo) {
    await t.cropTo(await CropTarget.fromElement(el));
    return;
  }
  throw new Error("无法裁切到 16:9 舞台。请用最新 Chrome / Edge，共享时选「当前标签页」。");
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
