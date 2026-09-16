export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportFilename(presetId: string, partId: string): string {
  const part = partId && partId !== "full" ? `-${partId}` : "";
  return `presentation-${presetId}${part}.mp4`;
}
