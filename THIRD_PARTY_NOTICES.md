# Third-party notices

The web presentation skill and its original themes/templates derive from [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills/tree/main/skills/web-video-presentation), under MIT. The original copyright and permission notice is preserved in `skills/web-video-presentation/LICENSE`. Creator Pipeline adds the revised motion workflow, shared audio clock, SRT tooling, validation and voiceover handoff.

Voice pipeline code derives from the maintainer's voice-clone-tts skill and has been revised for public, provider-independent use. No personal voice ID or recording is distributed.

Model weights and inference libraries are downloaded separately and retain their own licenses. This repository's MIT license does not relicense model weights, dependencies, fonts or generated voices.

| Optional component | Upstream |
|---|---|
| MOSS-TTS-Nano and ONNX models | [OpenMOSS](https://github.com/OpenMOSS/MOSS-TTS-Nano), Apache-2.0 |
| Qwen3-TTS and Base models | [QwenLM](https://github.com/QwenLM/Qwen3-TTS), Apache-2.0 |
| MLX Audio conversion/runtime | [Blaizzy/mlx-audio](https://github.com/Blaizzy/mlx-audio), MIT; converted model card terms also apply |
| MiniMax CLI | [MiniMax-AI/cli](https://github.com/MiniMax-AI/cli), upstream license and service terms |
| Vercel Skills CLI | [vercel-labs/skills](https://github.com/vercel-labs/skills), external installer |

Presentation themes reference Google Fonts through CSS. The font files are not vendored; fonts fall back to available local fonts if those requests fail. For fully offline rendering, provision appropriate licensed fonts and remove external imports in the generated project.
