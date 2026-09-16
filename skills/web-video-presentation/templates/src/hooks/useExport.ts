import { useCallback, useMemo, useRef, useState } from "react";
import { ExportCanceledError, requestTabCapture, stopStream } from "../export/capture";
import { encodePresentation } from "../export/encode";
import { EXPORT_FPS, EXPORT_PRESETS, type ExportPresetId } from "../export/presets";
import type { PartDef } from "../registry/timeline";

export type ExportPhase = "idle" | "picking" | "encoding" | "done" | "error";

export interface ExportState {
  phase: ExportPhase;
  presetId: ExportPresetId;
  partId: string;
  ratio: number;
  time: number;
  error: string | null;
  /** True after capture is cropped and 1x playback should run. */
  armed: boolean;
}

export interface UseExportOptions {
  enabled: boolean;
  parts: PartDef[];
  currentPart: PartDef;
  duration: number;
  audioUrl: string | null;
  seek: (time: number) => void;
}

const idle: ExportState = {
  phase: "idle",
  presetId: "1k",
  partId: "full",
  ratio: 0,
  time: 0,
  error: null,
  armed: false,
};

export function useExport({
  enabled,
  parts,
  currentPart,
  duration,
  audioUrl,
  seek,
}: UseExportOptions) {
  const [state, setState] = useState<ExportState>(idle);
  const abortRef = useRef<AbortController | null>(null);
  const encoding = state.phase === "encoding";

  const selectedPart = useMemo(() => {
    return parts.find((p) => p.id === state.partId) ?? currentPart;
  }, [parts, state.partId, currentPart]);

  const openPicker = useCallback(() => {
    if (!enabled || encoding) return;
    setState({
      phase: "picking",
      presetId: "1k",
      partId: currentPart.id,
      ratio: 0,
      time: currentPart.start,
      error: null,
      armed: false,
    });
  }, [enabled, encoding, currentPart]);

  const closePicker = useCallback(() => {
    setState((s) => (s.phase === "picking" ? idle : s));
  }, []);

  const setPreset = useCallback((presetId: ExportPresetId) => {
    setState((s) => ({ ...s, presetId }));
  }, []);

  const setPartId = useCallback((partId: string) => {
    setState((s) => ({ ...s, partId }));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async () => {
    if (!enabled) return;
    const preset = EXPORT_PRESETS[state.presetId];
    const part = parts.find((p) => p.id === state.partId) ?? currentPart;
    let stream: MediaStream | null = null;
    try {
      stream = await requestTabCapture();
    } catch (err) {
      if (err instanceof ExportCanceledError) {
        setState(idle);
        return;
      }
      const message = err instanceof Error ? err.message : "无法开始捕获";
      setState({ ...idle, phase: "error", error: message });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const stopOnAbort = () => stopStream(stream);
    controller.signal.addEventListener("abort", stopOnAbort, { once: true });
    setState({
      phase: "encoding",
      presetId: preset.id,
      partId: part.id,
      ratio: 0,
      time: part.start,
      error: null,
      armed: false,
    });
    try {
      await encodePresentation({
        preset,
        range: { start: part.start, end: part.end || duration, partId: part.id },
        audioUrl,
        stream,
        seek,
        onArmed: () => setState((s) => (s.phase === "encoding" ? { ...s, armed: true } : s)),
        signal: controller.signal,
        onProgress: (ratio, time) => {
          setState((s) =>
            s.phase === "encoding" ? { ...s, ratio, time } : s,
          );
        },
      });
      setState((s) => ({ ...s, phase: "done", ratio: 1, armed: false }));
    } catch (err) {
      stopStream(stream);
      if (err instanceof ExportCanceledError || controller.signal.aborted) {
        setState(idle);
        return;
      }
      const message = err instanceof Error ? err.message : "导出失败";
      setState((s) => ({ ...s, phase: "error", error: message, armed: false }));
    } finally {
      abortRef.current = null;
    }
  }, [enabled, state.presetId, state.partId, parts, currentPart, duration, audioUrl, seek]);

  const dismiss = useCallback(() => setState(idle), []);

  const frameCount = Math.max(
    1,
    Math.round(((selectedPart.end || duration) - selectedPart.start) * EXPORT_FPS),
  );

  return {
    ...state,
    enabled,
    encoding,
    selectedPart,
    frameCount,
    openPicker,
    closePicker,
    setPreset,
    setPartId,
    start,
    cancel,
    dismiss,
  };
}
