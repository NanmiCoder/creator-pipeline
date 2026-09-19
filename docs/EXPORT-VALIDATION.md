# MP4 export regression (2026-09-19)

The export engine now renders deterministic scene times and waits for each frame to be encoded. Real-time tab capture is no longer the export path. Both the skill scaffold and the versioned demo use the same engine.

The in-page export path was introduced by commit `84d9dc3`. Later commits `b0089bd` (documentation/screenshots) and `a7c28d9` (default scaffold cards) did not fix its timing model.

## Why the old output drifted

- `Output.start()` started the live video source before fetching, decoding and encoding the voiceover. The video recorded the preparation wait while the audio began at zero.
- Playback, capture sampling and the stop timer had separate clocks. Playback readiness and completion were not acknowledged by the exporter.
- The live video source sampled old frames and dropped frames under encoding pressure. Asking for 30 fps did not guarantee 30 distinct rendered frames per second.
- Native AAC on the tested macOS browser inserted 2,112 samples (44 ms at 48 kHz) without usable priming compensation.
- The whole PCM track and MP4 accumulated in memory, amplifying long-duration pressure.

## Implementation

- Sample the scene at `part.start + frameIndex / 30`; encode at `frameIndex / 30`. Use a positive partial last frame rather than rounding away the tail.
- Synchronously commit React state and fail on stale scene timestamps. Rasterize the unscaled 1920×1080 stage to the chosen pixel dimensions. There is no wall-clock playback during export.
- Embed original CSS, needed font Unicode subsets and readable assets in SVG foreignObject snapshots. Original CSS text preserves variable-based font shorthands. Missing resources stop the export. The image is decoded before encoding.
- Use `CanvasSource` in quality mode and await encoding backpressure. Slow rendering changes elapsed export time, not the media timeline.
- Decode audio incrementally, crop using integer sample boundaries, and interleave audio with video. The pinned FFmpeg AAC extension has 1,024 priming samples; a negative source timestamp produces the MP4 edit list that compensates them. This is not a hard-coded guess for a native encoder.
- Write fragmented MP4 chunks to OPFS instead of `BufferTarget`. Cancel/failure closes encoders and removes the temporary file. Successful downloads release it after the browser handoff.

AAC packets can pad the tail, so the audio container duration can be slightly longer than the visual range. Synchronization is checked using the **decoded waveform**, not equal-looking duration labels.

## Reproduce the long test

Requirements: Node 22+, FFmpeg/ffprobe, Python with NumPy, and a current Chromium browser. Browser automation here uses Ego Lite.

From `examples/live-demo/presentation`:

```sh
npm ci
npm run test:export:prepare -- 600
npm run dev -- --host 127.0.0.1
```

The preparation script repeats the bundled public narration for 600 seconds and adds an audio marker every ten seconds. It creates an ignored local WAV; it does not change the original voiceover. The test harness reuses the actual Pipeline component, with a binary frame number and a matching flash marker. Every frame is independently rendered; this is not a short MP4 concatenated 24 times.

Create one Ego Lite TaskSpace, open the printed Vite URL with `?review=1`, and run this **bounded** browser evaluation:

```js
await page.evaluate(() => {
  import('/scripts/export-fixture.tsx')
    .then(m => m.runFixture(600, '2k')) // also test '4k'
    .catch(console.error);
});
```

Inspect `window.exportQA.status`, `.time` and `.error` in later rounds; do not hold one automation evaluation open for the entire render. Once `status === 'done'`, `window.exportQA.result.file` is the actual MP4 File. Arm an Ego Lite download event, create a Blob URL and download that file, save it locally, then call `window.exportQA.result.dispose()`.

Do not edit/reload the page during the test. Use a Vite server with HMR disabled if concurrently working on source code. A second browser page can run the other resolution.

Verify the actual exported file:

```sh
python3 scripts/verify-export.py /path/to/fixture-600s-2k.mp4 \
  public/audio/export-fixture.wav --seconds 600 --report /path/to/report.json
```

The verifier:

1. Decodes **all** video frames and reads their visible binary IDs. Requires IDs `0…17999` without duplicates, omissions or reordering.
2. Checks every video packet PTS against the fixed 30 fps timeline and verifies the visual duration.
3. Decodes AAC with its MP4 edit list applied, then correlates it against the reference waveform at the beginning, quarter, midpoint and end. Allows at most two samples of error at 48 kHz, and requires correlation above 0.9.

Also exercise the ordinary **导出** button, cancellation, fractional/nonzero ranges, unavailable assets and stale scene errors. The frame marker fixture is a regression tool, not part of exported customer presentations.

## Results

Tested on macOS with Chromium 152 (Ego Lite), using the bundled Pipeline scene and narration. Local MP4s and machine-readable reports are stored in the ignored `.export-validation/` directory.

| Test | Actual video | Frame verification | Decoded audio |
| --- | --- | --- | --- |
| 10 minutes, 4K | 3840×2160, 600.000 s, 18,000 frames | All IDs correct; maximum PTS error 0.334 µs | 0-sample offset at 0, 150, 300 and 598 s |
| 10 minutes, 1440p | 2560×1440, 600.000 s, 18,000 frames | All IDs correct; maximum PTS error 0.334 µs | 0-sample offset at 0, 150, 300 and 598 s |
| 60 seconds, 4K | 3840×2160, 60.000 s, 1,800 frames | All IDs correct; maximum PTS error 0.334 µs | 0-sample offset at all four checkpoints |
| Fractional range 3.576–7.494 s | 2560×1440, 3.918003 s, 118 frames | All IDs correct; maximum PTS error 0.334 µs | 0-sample offset at all four checkpoints |
| Production UI, full demo | 1920×1080, 25.067795 s, 753 frames | Exported through the actual button; browser playback and visual frame inspected | 0-sample offset at 0, 6, 12 and 23 s |

The 10-minute 4K file is 242,889,114 bytes; the 1440p file is 152,571,572 bytes. Each contains 28,800,000 input audio samples at 48 kHz. Waveform correlations are ≥0.99986. Each AAC container track is 600.021333 seconds because of packet padding; the decoded content remains aligned through the final checkpoint. These results apply to the tested fixture and environment, not every possible presentation or browser.

Additional checks:

- Cancellation through the actual UI returns to preview and removes the in-progress temporary file.
- Native browser and exported demo frames were visually compared. The new font-subset optimization changed only 42 color channels out of 8,294,400 in the checked 1920×1080 frame compared with embedding every font subset.
- Demo: 24 automated tests, seven project checks and production build passed.
- A fresh project made by the actual scaffold script: 24 tests and production build passed; five project checks passed and the missing-timeline check was intentionally skipped.
- Repository Python suite: 23 tests passed. Distribution validation passed using a temporary Git index, without staging the working tree.

The long renders ran concurrently. Export speed depends on scene complexity and machine load; offline export may take longer than the video itself. Streaming avoids retaining the complete decoded audio and complete MP4 in JavaScript memory.

## Scope

Validated content is deterministic HTML, CSS, inline SVG and static readable assets, as used by this repository's demo. Live video/iframes and autonomous CSS/Web Animations are rejected. Animated images, WebGL and unusual compositor effects need a separate native rendering/recording workflow and visual acceptance. This is not a promise of arbitrary webpage pixel equivalence or unlimited duration; browser storage capacity and runtime stability still apply.

## Primary references

- [Remotion renderFrames](https://www.remotion.dev/docs/renderer/render-frames): frame-oriented rendering and subsequent media assembly.
- [Mediabunny writing media](https://mediabunny.dev/guide/writing-media-files): explicit timestamps, streaming targets and backpressure.
- [Mediabunny AAC extension](https://mediabunny.dev/guide/extensions/aac-encoder): software AAC-LC encoder based on FFmpeg.
- [Apple AAC priming](https://developer.apple.com/documentation/quicktime-file-format/the_timing_and_synchronization_problem): why encoder delay must be compensated.
- [Upstream native AAC issue](https://github.com/Vanilagy/mediabunny/issues/444): missing native encoder delay information.
