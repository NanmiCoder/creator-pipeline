import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadBlob, exportFilename } from "../export/download";
import { EXPORT_PRESETS, frameCountFor, type ExportPresetId } from "../export/presets";
import type { PartDef } from "../registry/timeline";

export type ExportPhase = "idle" | "picking" | "encoding" | "done" | "error";

export interface ExportState {
  phase: ExportPhase;
  presetId: ExportPresetId;
  partId: string;
  ratio: number;
  time: number;
  error: string | null;
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
  useEffect(() => () => abortRef.current?.abort(), []);
  const encoding = state.phase === "encoding";
  const busyRef = useRef(false);

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
    if (!enabled || busyRef.current) return;
    busyRef.current = true;
    const preset = EXPORT_PRESETS[state.presetId];
    const part = parts.find((p) => p.id === state.partId) ?? currentPart;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      phase: "encoding",
      presetId: preset.id,
      partId: part.id,
      ratio: 0,
      time: 0,
      error: null,
    });
    try {
      const { encodePresentation } = await import("../export/encode");
      const result = await encodePresentation({
        preset,
        range: { start: part.start, end: part.end || duration, partId: part.id },
        audioUrl,
        seek,
        signal: controller.signal,
        onProgress: (ratio, time) => {
          setState((s) =>
            s.phase === "encoding" ? { ...s, ratio, time } : s,
          );
        },
      });
      downloadBlob(result.file, exportFilename(preset.id, part.id));
      // The Blob URL must outlive the download's handoff to the browser.
      window.setTimeout(() => { void result.dispose(); }, 60_000);
      setState((s) => ({ ...s, phase: "done", ratio: 1 }));
    } catch (err) {
      if (controller.signal.aborted) {
        setState(idle);
        return;
      }
      const message = err instanceof Error ? err.message : "导出失败";
      setState((s) => ({ ...s, phase: "error", error: message }));
    } finally {
      abortRef.current = null;
      busyRef.current = false;
    }
  }, [enabled, state.presetId, state.partId, parts, currentPart, duration, audioUrl, seek]);

  const dismiss = useCallback(() => setState(idle), []);

  const frameCount = duration > selectedPart.start
    ? frameCountFor(selectedPart.start, selectedPart.end || duration)
    : 0;

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
