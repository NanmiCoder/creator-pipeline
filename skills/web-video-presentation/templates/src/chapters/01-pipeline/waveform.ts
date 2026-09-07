export const voiceModelLabel = "MINIMAX";
// Deterministic illustration; no recording or biometric data is bundled.
export const waveformIsIllustrative = true;
export const waveform = Array.from({length:96}, (_, i) =>
  .10 + .78 * Math.abs(Math.sin(i * .73) * Math.cos(i * .19))
);
