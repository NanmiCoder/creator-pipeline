<p align="center"><img src="assets/hero.svg" alt="Creator Pipeline — Script to voice to motion" width="100%"></p>

<p align="center"><b>Your script. Your voice. A presentation that moves with it.</b><br>
<a href="README.md">中文</a> · English</p>

Creator Pipeline combines two AI Agent skills: clone narration from your own reference recording, produce audio and an SRT timeline, then build an autoplaying web presentation with continuous diagrams, cards and motion graphics.

The default model is **Qwen3-TTS**: MLX on Apple Silicon, official PyTorch on other platforms, without a cloud account or API key. MiniMax is an explicit optional backend. Installing the skills installs instructions, scripts and templates; model weights download when you first use the local voice backend.

## Install

```bash
npx skills add NanmiCoder/creator-pipeline \
  --skill voice-clone-tts \
  --skill web-video-presentation
```

Uses the [Vercel skills CLI](https://github.com/vercel-labs/skills) and its standard `skills/<name>/SKILL.md` layout. Codex and Claude Code project-level copy installations have been tested.

## Try it

Prepare a script and a clean 3–30 second recording of your own or an authorized voice. Ask your Agent:

> Use voice-clone-tts and web-video-presentation. Read script.md and use my-voice.mp3 as the voice reference. Start with a local narration sample and check pronunciation, then generate the full WAV, MP3 and SRT. Build a 16:9 autoplaying web presentation from the final timeline, using continuous diagrams and purposeful motion instead of dense text. Run the checks and play it in a real browser before handing it over.

Voice generation requires Python 3.12, uv and FFmpeg. The skill's setup script creates a separate environment for each backend. The web presentation requires Node.js/npm. See [setup](skills/voice-clone-tts/references/SETUP.md) and the runnable [first-video example](examples/first-video/README.md). Production instructions and the sample currently focus on Chinese narration.

| Skill | Produces |
|---|---|
| [voice-clone-tts](skills/voice-clone-tts/SKILL.md) | WAV, MP3, SRT and a verified `voiceover.json` handoff |
| [web-video-presentation](skills/web-video-presentation/SKILL.md) | A Vite + React + TypeScript presentation, driven by the final audio clock |

<img src="assets/demo.png" alt="Actual example: script and narration cards transform into a web presentation" width="100%">

SRT timing comes from actual PCM sample frames for each synthesized segment. It is segment-level timing, not word-level forced alignment. Structural checks cannot prove correct pronunciation or voice similarity.

The output is an **HTML presentation, not a `.pptx` file**. MP4 output requires the separate [recording workflow](skills/web-video-presentation/references/RECORDING.md).

Preview, autoplay and frame review keep the same framed **16:9 capture area**, with guides outside the content. Browser QA uses the user's chosen or locally available browser skill—Ego, agent-browser or another real browser tool. No specific browser product is required.

## Backends and evidence

- **MLX, Apple Silicon default:** Qwen3-TTS 0.6B Base 4bit on Apple Silicon. Tested on the same six-sentence script.
- **Qwen PyTorch, default on other platforms:** official Base model adapter supplied; CUDA hardware execution has not been tested.
- **Nano, explicit option:** MOSS-TTS-Nano 100M ONNX on CPU. Tested on Apple Silicon macOS, including actual synthesis, interruption recovery and audio-to-web handoff. The full Python entry point still uses PyTorch for audio preprocessing.
- **MiniMax:** optional, potentially paid. CLI flags and a mocked speech call were checked; no live paid synthesis or registration was tested.

One Nano first pass produced ASR discrepancies. Targeted seed overrides allow retrying only an affected sentence while keeping the other cached segments. We keep these failures in the evaluation rather than claiming perfect audio from a valid WAV file.

See [validation](docs/VALIDATION.md), [backend selection](docs/TTS-BACKENDS.md) and [third-party notices](THIRD_PARTY_NOTICES.md) for measured results, pinned versions, licenses and limitations. Initial downloads, disk space and RAM are still required. There is no cross-device speed guarantee or blinded voice-similarity score.

## Development

```bash
python3 -m unittest discover -s tests -v
python3 scripts/check-package.py
```

Please include reproducible, sanitized examples when reporting bugs. Keep API keys, private voice recordings and model weights out of the repository.

MIT licensed. The web skill builds on [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills), with its license retained. OpenMOSS, Qwen, MLX Audio and other upstream projects retain their respective code and model licenses.
