# 声音克隆的选择依据

核对日期：2026-09-07。目标是让“用户给自己的 MP3 与新文案”先在普通电脑上完成最小闭环，再增加质量/设备选项。优先级依次是：能合法分发的依赖与权重、真实可安装、中文参考音色克隆、实测资源、恢复成本；热度与参数量不代替验证。

## 当前选择

当前默认 **MiniMax speech-2.8-hd**。同一参考录音、三段未参与克隆的原声文案、两轮生成后，声音本人试听三段均选择 MiniMax。两个声纹编码器对 MiniMax 与 Qwen 的结果接近且局部排序不同，不能宣称 MiniMax 普遍更像。见[完整对照与限制](VALIDATION.md#三家音色对照与-minimax-默认)。

免费本地路线通过 `--provider local` 显式选择：Apple Silicon 用 Qwen MLX，其他平台用 Qwen PyTorch。Nano 保留为显式 CPU 选项。不因失败静默切换服务。

| 方案 | 判断 | 依据 |
|---|---|---|
| **MOSS-TTS-Nano 100M ONNX** | 显式 CPU 选项 | 2026 年 4 月发布；支持参考音频克隆，无需转写；代码和所选 ONNX 权重为 Apache-2.0。本机安装和实际 CPU 合成通过 |
| **Qwen3-TTS 0.6B Base / MLX 4bit** | Apple Silicon 本地选项 | Base 提供声音克隆。实际六句中文测试通过；无参考文本使用 speaker embedding，有匹配转写可用完整 ICL 路径 |
| **Qwen3-TTS 0.6B Base / PyTorch** | 其他平台本地选项 | 官方 API 适配器，设备和实际速度尚未在 CUDA 实机验证；不能把 MLX 的结果移植成 CUDA 承诺 |
| **MiniMax mmx** | 默认云端路线 | 使用自己的凭据、音色和额度；已实际克隆、合成并完成三家对照。首次登记显式上传，run 不自动上传录音 |

来源：[MOSS 官方代码](https://github.com/OpenMOSS/MOSS-TTS-Nano)、[Nano ONNX 模型卡](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX)、[Tokenizer 模型卡](https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX)、[Qwen 官方代码](https://github.com/QwenLM/Qwen3-TTS)、[Qwen Base 模型卡](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base)、[MLX Audio](https://github.com/Blaizzy/mlx-audio)、[MLX 模型卡](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-0.6B-Base-4bit)、[MiniMax CLI](https://github.com/MiniMax-AI/cli)。

## 为什么没有把更多模型塞进首版

| 候选 | 本轮取舍 |
|---|---|
| [F5-TTS](https://github.com/SWivid/F5-TTS) | 代码 MIT，但官方预训练权重是 CC-BY-NC；不作为未限定商业用途的默认选择 |
| [X-Voice 0.4B](https://github.com/sunnyxrxrx/X-Voice) | 小模型与多语言值得关注，但权重为 CC-BY-NC；本轮未安装实测 |
| [PilotTTS](https://github.com/AMAPVOICE/PilotTTS) | 多组件依赖使首轮安装更复杂，尚未做前向实测；先不扩大支持面 |
| [ZipVoice](https://github.com/k2-fsa/ZipVoice) | 具备 CPU 部署路线的后续候选；首版已有跑通的 CPU 后端，不为增加名单再维护一套接口 |

这些判断是针对本项目的默认安装目标，不是模型质量排行榜。开源代码许可与模型许可分开看；参数少也不代表峰值内存低。

## 固定版本与实际依赖

| 项目 | 当前固定值 |
|---|---|
| Nano 源码 | `8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb` |
| Nano ONNX 权重 | `f52645cb467506d8e18e746ddd59482685b74e58` |
| Nano Tokenizer ONNX | `ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae` |
| Qwen Base 官方权重 | `5d83992436eae1d760afd27aff78a71d676296fc` |
| Qwen Base MLX 4bit 权重 | `0d6bb6fe33f92d47a507e23b9148940e8366ab5b` |
| MLX Audio / qwen-tts | `0.5.1` / `0.1.1` |

完整 Nano 高层 Python 入口仍导入 torch/torchaudio，尽管模型推理会话使用 ONNX Runtime CPU。我们的安装采用固定源码与必要依赖，不照抄“全流程无需 PyTorch”的表述。[固定入口源码](https://github.com/OpenMOSS/MOSS-TTS-Nano/blob/8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb/onnx_tts_runtime.py)

Nano、MLX、Qwen 使用隔离环境，避免不同 Transformers 版本互相污染。Nano 默认单进程顺序合成，一批只加载一次模型和参考编码；并发启动多个本地模型往往先增加内存压力。缓存包含正文、参考录音内容哈希、模型 revision、软件版本与参数。

Nano 使用当前上游固定采样配置与语言处理；`--temperature` 和 `--language` 不会覆写它的内部采样逻辑。它的重试主要使用 `--seed` 或单句 `--segment-seed`。Qwen/MLX 的对应参数会传入生成器。

## 声音、时间、视觉是三种不同的验收

1. WAV 能打开、峰值正常、没有缺段，只证明结构基本有效。
2. 用本地 ASR 对照原稿能发现部分漏读与错读，但 ASR 自己也会出错；不能凭转写一致宣称音色相似或自然度更高。
3. SRT 由拼接后的真实采样帧产生，包含我们明确加上的段间停顿。它不是估算字数得到的时间，也不是字级强制对齐。更细粒度字幕需要独立对齐，并重新验收。
4. 网页必须使用最终音频的同一时钟。帧截图检查构图，连续播放检查动作与转场，两项都要做。

免费指无需推理 API 费用；首次下载、磁盘、内存与电力仍有成本。软件和模型升级会影响表现；更换版本后重跑代表性文案与故障恢复测试。
