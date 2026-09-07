# 环境与后端

需要 Python 3.12、[uv](https://docs.astral.sh/uv/getting-started/installation/)、FFmpeg。Node/npm 用于安装 skills、网页端和 MiniMax 的 mmx。Windows 建议先使用 WSL2；本项目的实机验证环境是 Apple Silicon macOS，不能据此保证所有 Windows/Linux 驱动组合。

```bash
# macOS 示例；已有依赖可跳过
brew install uv ffmpeg
python3 "$SKILL_DIR/scripts/setup.py"
```

setup 与 run 缺省读取个人偏好；未配置时使用 MiniMax。显式 `--provider local` 时，Apple Silicon 选 Qwen MLX，其他平台选 Qwen PyTorch。CPU 执行 Qwen 可能较慢，先做短样；Nano 必须明确 `--provider nano` 才使用。

setup 为每个后端建立独立 `.creator-env/<provider>/`；使用它打印的 Python 路径执行 run.py。可用 `--env <目录>` 指定位置。它不会修改系统 Python，也不在安装 skill 时自动下载模型。

| 后端 | 默认模型/执行方式 | 输入与使用边界 |
|---|---|---|
| nano | MOSS-TTS-Nano-100M ONNX，CPU 4 线程 | 显式选择，参考 MP3/WAV；无需参考文本。代码和权重固定 revision；实际完整入口含 PyTorch 音频预处理 |
| mlx | Qwen3-TTS 0.6B Base 4bit，MLX | Apple Silicon 本地选项；本机实际合成测试。额外参考转写可走 ICL；无转写使用 speaker embedding |
| qwen | Qwen3-TTS 0.6B Base，官方 PyTorch | 其他平台本地选项；`--device auto/cpu/cuda:0`；未在 CUDA 实机测试。没有强制安装 FlashAttention；有显卡也先测短段 |
| minimax | mmx + speech-2.8-hd | 用户自己的服务账号和音色。默认路线，可能计费；本项目不包含额度 |

切换后端时分别运行 `setup.py --provider mlx/qwen/nano/minimax`，使用对应 Python。Nano 的固定依赖与 Qwen/MLX 的 Transformers 版本不应混装。Nano CPU 在 Linux/Windows 使用 CPU PyTorch wheel，避免自动下载 CUDA 依赖。

本地后端首次推理下载公开模型；MiniMax 不需要本地 TTS 权重。Nano 默认目录为 `~/.cache/creator-pipeline/models/`，可设置 `CREATOR_MODEL_DIR`；HF 缓存与网络行为遵循 huggingface-hub。支持提前下载后使用本地目录；`--model` 自定义模型需自行保证模型类型兼容。模型缓存齐全后可用 `HF_HUB_OFFLINE=1` 检验离线运行。不要把“本地推理”理解为首次安装完全不联网。

Qwen 只能使用 Base 模型做参考音色克隆。CustomVoice 是预置音色，不是相同接口。MLX 量化模型是社区转换，不属于本项目重新训练的模型。

## MiniMax 默认路径

安装和配置 [官方 mmx CLI](https://github.com/MiniMax-AI/cli)，使用你自己的 API 凭据。套餐名称和多模态额度会变化，是否有可用 speech/clone 权限以账号实际情况和官方文档为准；不能把 Coding Plan 的有无当作唯一判断。

已有音色先保存个人偏好，再运行：

```bash
python3 "$SKILL_DIR/scripts/configure.py" --provider minimax --voice YOUR_VOICE_ID
"$PY" "$SKILL_DIR/scripts/run.py" script.md --outdir voiceover-demo
```

个人偏好保存在 `~/.config/creator-pipeline/voice.json`，与安装目录分开，不含 API key。可用 `CREATOR_TTS_CONFIG` 指定位置。后端优先级为命令行、`CREATOR_TTS_PROVIDER`、个人配置、MiniMax 默认；音色优先级为 `--voice`、`MINIMAX_VOICE_ID`、个人配置。

首次登记自己的录音：下面命令会上传录音到 MiniMax。参考文件须为 MP3/M4A/WAV，10–300 秒且不超过 20 MB；建议先截取 10–30 秒干净完整片段。

```bash
python3 "$SKILL_DIR/scripts/clone-minimax.py" my-voice.mp3 MyVoiceName01
python3 "$SKILL_DIR/scripts/configure.py" --provider minimax --voice MyVoiceName01
```

可附加 `--prompt-audio prompt.wav --prompt-text prompt.txt`：prompt 必须不足 8 秒且转写精确匹配，脚本先检查输入再上传。已有试验用 12.05 秒参考与 4.05 秒匹配 prompt 成功登记并实际合成。默认保留原声，不降噪；确有噪声时显式 `--denoise`。`--out receipt.json` 可保存本地登记凭据，不含 API key。

克隆脚本与已检查的 mmx 版本保持一致：优先读取 `~/.mmx/config.json`（或 `MMX_CONFIG_DIR`）中的 API key，无配置 key 时用 `MINIMAX_API_KEY`。一次上传与登记始终使用同一 key、同一 API 域名。区域优先级为 `--region`、`MINIMAX_REGION`、mmx 配置、global；`cn` 对应国内 API。语音合成使用 mmx 自身的认证，请先完成 `mmx auth login`，不要依赖另一个账号的环境变量。套餐名称不证明 speech/clone 权限。

参考限制、prompt 与音色保留策略见 [MiniMax 官方复刻接口](https://platform.minimax.io/docs/api-reference/voice-cloning-clone)。登记后及时合成并检查，不能把音色 ID 当永久可用的保证。

## 无云账号：显式免费本地路线

```bash
python3 "$SKILL_DIR/scripts/setup.py" --provider local
# PY 改为这次 setup 输出的 Python 路径
"$PY" "$SKILL_DIR/scripts/run.py" script.md --provider local \
  --reference my-voice.mp3 --reference-text reference.txt --outdir voiceover-local
```

Qwen 优先提供与参考短段精确对应的文本，启用完整 ICL。想以后都用本地时运行 `configure.py --provider local`，setup 与 run 都会遵循它。缺依赖或额度时给出错误，不静默改用其他供应商。
