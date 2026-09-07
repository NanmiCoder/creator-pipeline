<p align="center"><img src="assets/hero.svg" alt="Creator Pipeline — 从一段话，到一部作品" width="100%"></p>

<p align="center">
  <a href="https://github.com/NanmiCoder/creator-pipeline/actions/workflows/check.yml"><img src="https://github.com/NanmiCoder/creator-pipeline/actions/workflows/check.yml/badge.svg" alt="Checks"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-171714.svg" alt="MIT license"></a>
  <a href="https://github.com/vercel-labs/skills"><img src="https://img.shields.io/badge/install-npx%20skills-E65332.svg" alt="Install with npx skills"></a>
</p>

<p align="center"><b>文案 + 你的声音 → 配音与 SRT → 会自动播放的网页 PPT</b><br>
中文 · <a href="README.en.md">English</a></p>

Creator Pipeline 是一组可以配合使用的 AI Agent skills。先用自己的录音在本地克隆配音，得到真实音频时间轴；再让 Agent 把内容做成卡片、图解与连续 MG 场景，让画面跟着声音展开。

默认配音路线无需 MiniMax 账号或 API key，CPU 也能运行。已有云端音色的用户可以显式选择 MiniMax。**安装的是可执行脚本、模板与制作方法；模型在首次使用配音功能时下载。**

## 安装两个 skills

```bash
npx skills add NanmiCoder/creator-pipeline \
  --skill voice-clone-tts \
  --skill web-video-presentation
```

安装器会让你选择 Agent 和安装范围。想先看看内容：

```bash
npx skills add NanmiCoder/creator-pipeline --list
```

支持 Vercel [skills CLI](https://github.com/vercel-labs/skills) 的 `skills/<name>/SKILL.md` 目录发现方式，无需另装本项目的 npm 包。已实测 Codex 与 Claude Code 的项目级复制安装。

## 给 Agent 的第一条任务

准备 `script.md` 和一段干净、单人、无配乐的本人录音 `my-voice.mp3`，参考片段建议 3–30 秒。然后发送：

> 使用 voice-clone-tts 和 web-video-presentation。文案在 script.md，参考声音在 my-voice.mp3。先用默认本地后端制作代表性配音样片，检查读音；再生成完整 WAV、MP3、SRT。基于最终时间轴制作 16:9 自动播放网页演示：少放整段文字，用连续图解、卡片状态变化和 MG 解释内容。完成后运行校验，并在浏览器实际播放、检查转场，交付运行方式。

本地配音需要 Python 3.12、[uv](https://docs.astral.sh/uv/getting-started/installation/) 和 FFmpeg；网页需要 Node.js/npm。skill 内的 `setup.py` 会创建独立 Python 环境。完整命令见 [配音环境](skills/voice-clone-tts/references/SETUP.md)；想直接跑固定样例，见 [first-video](examples/first-video/README.md)。

## 两个 skills，各有清楚的交付

| Skill | 输入 | 输出 |
|---|---|---|
| [voice-clone-tts](skills/voice-clone-tts/SKILL.md) | 文案 + 本人/已授权参考录音 | WAV、MP3、SRT、可验证的 `voiceover.json` |
| [web-video-presentation](skills/web-video-presentation/SKILL.md) | 最终配音、SRT 与内容素材 | Vite + React + TypeScript 网页演示，可自动播放、点击推进与录屏 |

音频先定下来，画面才有可靠的节奏。`voiceover.json` 连接两步：导入时核验音频采样帧、字幕和文件哈希，改稿或缺段后不会继续拼接旧结果。SRT 按实际合成段的采样帧计时，**属于句段级时间轴，不是字级强制对齐**。

网页中的 step 表示口播焦点，scene 表示连续空间。几个句子可以共用一个场景：卡片转成窗口，连线显示关系，游标推进时间；每句口播无需重新换一张文字页。

<p><img src="assets/demo.png" alt="真实样例截图：文案和配音卡片连续变成网页演示，右侧出现声画同频的动态场景" width="100%"></p>

<sub>截图来自仓库内六句文案的真实运行结果。示意波形用于表现配音阶段，不是测量图。个人参考录音与克隆后的声音不随仓库分发。</sub>

输出是 **HTML 网页演示，不是 `.pptx`**。导出 MP4 需要按 [录制说明](skills/web-video-presentation/references/RECORDING.md) 完成录制；安装 skills 不会自动替你生成或上传视频。

## 免费本地优先，后端可以选

| 后端 | 适合谁 | 本项目验证状态 |
|---|---|---|
| **Nano · 默认** | 没有独立显卡，希望先在 CPU 上跑通 | MOSS-TTS-Nano 100M ONNX，macOS CPU 实际合成与全流程验证 |
| **Qwen MLX** | Apple Silicon Mac 用户 | Qwen3-TTS 0.6B Base 4bit，实际完成同稿六句配音 |
| **Qwen PyTorch** | 希望使用 CUDA 的用户 | 提供官方模型适配器，尚未做 CUDA 实机验证 |
| **MiniMax** | 已有在线服务与自己的音色 | 可选，CLI 参数与模拟调用已检查；未调用付费接口验证 |

本地模型代码和权重分别遵循上游许可。Nano、Qwen Base 及所选 MLX 权重的公开许可、固定版本与取舍见 [TTS 选型](docs/TTS-BACKENDS.md)。MiniMax 的权限和费用以账号实际额度为准，不按套餐名字推断。

“免费本地”仍然需要首次联网下载、磁盘与运行内存。我们的 Nano 短样本在这台 Mac 上进程峰值约 **3.5–3.9 GiB**，不能据此承诺所有低配电脑都可用。完整 Nano Python 入口仍用到 PyTorch 音频预处理，ONNX 并不意味着整个依赖链都没有 PyTorch。

## 做过什么验证

- **真实配音与交接**：同一份六句文案分别通过 Nano 和 Qwen MLX 生成，再由实际 WAV/SRT 驱动网页演示。
- **内容核对**：Nano 首轮出现局部 ASR 转写偏差，保留失败记录并只重试对应句子；不把“能播放”当作“读对了”。
- **故障恢复**：改一段、换参考、损坏缓存、真实进程中断、搬迁目录，都做过独立前向测试；导入器会拒绝损坏或过期清单。
- **网页质量**：真实 TypeScript 检查、时间轴校验、构建与浏览器播放；文案密度、构图和动作含义仍需要视觉审查。

数字、范围、失败与修复记录见 [验证报告](docs/VALIDATION.md)。目前没有跨机器速度基准、盲听音色相似度评分或大样本返工率结论。

## 开发与贡献

```text
skills/
  voice-clone-tts/          # 本地/云配音适配器、缓存、SRT 和验证
  web-video-presentation/   # 场景制作方法、主题、网页运行时与导入器
examples/first-video/       # 不含私人声音的可复现端到端样例
tests/                     # 无需模型或云账号的故障与交接测试
docs/                      # 模型取舍、实测结果与验证边界
```

```bash
python3 -m unittest discover -s tests -v
python3 scripts/check-package.py
```

欢迎带着复现文案、后端版本和脱敏日志提交 issue；不要附上密钥、未授权的录音或模型权重。对于新后端，优先补齐输入契约、许可、真实短样本和失败恢复证据。

## 致谢与许可

项目代码使用 [MIT](LICENSE)。网页技能基于 [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) 的 Web Video Presentation 持续改进，保留原许可；配音运行依赖 OpenMOSS、Qwen、MLX Audio 等开源项目。第三方代码、模型与字体不因被本项目使用而变更许可，见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
