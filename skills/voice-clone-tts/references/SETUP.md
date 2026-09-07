# 环境与后端

需要 Python 3.12、[uv](https://docs.astral.sh/uv/getting-started/installation/)、FFmpeg。Node/npm 仅用于安装 skills、网页端和可选 mmx。Windows 建议先使用 WSL2；本项目的实机验证环境是 Apple Silicon macOS，不能据此保证所有 Windows/Linux 驱动组合。

```bash
# macOS 示例；已有依赖可跳过
brew install uv ffmpeg
python3 "$SKILL_DIR/scripts/setup.py"
```

setup 缺省使用 Qwen3-TTS：Apple Silicon 选 mlx，其他平台选 qwen。CPU 执行 Qwen 可能较慢，先做短样；Nano 必须明确 `--provider nano` 才使用。

setup 为每个后端建立独立 `.creator-env/<provider>/`；使用它打印的 Python 路径执行 run.py。可用 `--env <目录>` 指定位置。它不会修改系统 Python，也不在安装 skill 时自动下载模型。

| 后端 | 默认模型/执行方式 | 输入与使用边界 |
|---|---|---|
| nano | MOSS-TTS-Nano-100M ONNX，CPU 4 线程 | 显式选择，参考 MP3/WAV；无需参考文本。代码和权重固定 revision；实际完整入口含 PyTorch 音频预处理 |
| mlx | Qwen3-TTS 0.6B Base 4bit，MLX | Apple Silicon 默认；本机实际合成测试。额外参考转写可走 ICL；无转写使用 speaker embedding |
| qwen | Qwen3-TTS 0.6B Base，官方 PyTorch | 其他平台默认；`--device auto/cpu/cuda:0`；未在 CUDA 实机测试。没有强制安装 FlashAttention；有显卡也先测短段 |
| minimax | mmx + speech-2.8-hd | 用户自己的服务账号和音色。显式选择，可能计费；本项目不包含额度 |

切换后端时分别运行 `setup.py --provider mlx/qwen/nano/minimax`，使用对应 Python。Nano 的固定依赖与 Qwen/MLX 的 Transformers 版本不应混装。Nano CPU 在 Linux/Windows 使用 CPU PyTorch wheel，避免自动下载 CUDA 依赖。

首次推理下载公开模型。Nano 默认目录为 `~/.cache/creator-pipeline/models/`，可设置 `CREATOR_MODEL_DIR`；HF 缓存与网络行为遵循 huggingface-hub。支持提前下载后使用本地目录；`--model` 自定义模型需自行保证模型类型兼容。模型缓存齐全后可用 `HF_HUB_OFFLINE=1` 检验离线运行。不要把“本地推理”理解为首次安装完全不联网。

Qwen 只能使用 Base 模型做参考音色克隆。CustomVoice 是预置音色，不是相同接口。MLX 量化模型是社区转换，不属于本项目重新训练的模型。

## MiniMax 可选路径

安装和配置 [官方 mmx CLI](https://github.com/MiniMax-AI/cli)，使用你自己的 API 凭据。套餐名称和多模态额度会变化，是否有可用 speech/clone 权限以账号实际情况和官方文档为准；不能把 Coding Plan 的有无当作唯一判断。

已有音色直接运行：

```bash
"$PY" "$SKILL_DIR/scripts/run.py" script.md --provider minimax \
  --voice YOUR_VOICE_ID --outdir voiceover-cloud
```

首次登记自己的录音：显式执行下面命令会上传到 MiniMax。确保 mmx 和 `MINIMAX_API_KEY` 使用同一账号、同一区域；`--region cn` 对应国内 API，默认 global。

```bash
python3 "$SKILL_DIR/scripts/clone-minimax.py" my-voice.mp3 MyVoiceName01 --region cn
```

该命令需要环境变量 `MINIMAX_API_KEY`，不保存 key，也不自动花费一次试听调用。参考音频需符合服务的长度/大小要求；音色可用性与保留策略见 [官方复刻接口](https://platform.minimax.io/docs/api-reference/voice-cloning-clone)。本轮仅测试 MiniMax 调用契约，不声称在线账号调用已经验证。
