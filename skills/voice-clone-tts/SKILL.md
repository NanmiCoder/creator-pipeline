---
name: voice-clone-tts
description: 将文案与用户自己的参考录音合成为配音、SRT 和可交接时间轴。默认使用免费的本地 MOSS-TTS-Nano CPU 声音克隆；可选 Qwen3-TTS、Apple Silicon MLX 或 MiniMax。适用于口播配音、声音复刻，以及为网页视频演示准备最终音频和字幕。
---

# 文案与参考声音 → 配音与时间轴

交付 `voiceover.wav`、`voiceover.mp3`、`voiceover.srt`、`voiceover.json`。WAV 是计时主文件，SRT 是原稿短段对应的采样帧时间；这不是字级强制对齐，也不能证明模型读音完全正确。

## 选择后端

默认 **nano**：MOSS-TTS-Nano，CPU 本地推理，无需云账号/API key。需要首次下载模型，仍占用内存、磁盘与计算时间。优先完成一个代表性短段，再扩展全文。

- Apple Silicon 用户可显式选 **mlx**，使用 Qwen3-TTS 0.6B Base 4bit。
- **qwen** 是官方 PyTorch/CUDA 适配器，设备需单独验证；CPU 用户优先 nano。
- 用户指定在线服务时用 **minimax** 与自己的 voice ID。不会因本地失败自动上传录音、切换云服务或使用别人的声音。

各后端使用独立环境；首次运行读 [SETUP.md](references/SETUP.md)。音色来源是用户提供的本人/已获授权录音，没有共享的默认私人音色。

## 执行

先原样保存用户文案为 `script.md`；不擅自改写读法、数字或术语。只有明确的 Markdown 标题不朗读，编号列表保留。产物默认放当前项目的 `voiceover-<主题>/`，先说明位置。

`SKILL_DIR` 表示本 SKILL.md 所在目录。实际定位安装目录，不硬编码某个用户的 `~/.claude` 路径。

```bash
python3 "$SKILL_DIR/scripts/setup.py" --provider nano
# 上一条会输出独立环境 Python 的实际路径；下文以 PY 表示它。
"$PY" "$SKILL_DIR/scripts/run.py" script.md \
  --reference my-voice.mp3 --outdir voiceover-demo
```

参考录音选干净、单人、无音乐的完整 3–30 秒短段。原录音太长时显式截取合适区间，不把全文转写误作短样本转写。Qwen 可额外传 `--reference-text reference.txt`，内容必须对应参考录音；缺省走仅声音嵌入的克隆路径，效果可能不同。nano 不要求参考转写。

声音条目按完整句子/语义短段组织，默认宽度 40，不为短字幕机械切碎句子。过长字幕可换行；需要更细时间时用最终 WAV 与原文做实际对齐，不按字数比例伪造 cue。

同一命令可续跑；缓存包含正文、声音内容哈希、模型/版本及生成参数。每次成功保存一个 WAV，失败段阻止拼接；改稿后重新分段、合成、拼接。不要只手改 SRT 或把旧音频配到新文案上。分步控制见 [PIPELINE.md](references/PIPELINE.md)。

## 验证与交接

1. `run.py` 会自动执行结构验证：全部段就绪，WAV/MP3/SRT 同源，文件哈希一致，字幕单调且不越界。也可单独运行 `verify.py voiceover-demo/voiceover.json`。
2. 检查实际声音，尤其数字、专名、中英混排、首尾、连接处与最长句。本地 ASR 可辅助找漏读/重读；ASR 正确不等于音色相似，不用转写结果覆盖原稿。
3. 修正有问题的段后重建所有最终产物。保留中间件便于局部重跑，不把模型或个人参考音频提交到仓库。
   单句随机生成问题可在完整 run 命令中添加 `--segment-seed 2:3`（第 2 段用 seed 3）；只使该句缓存失效。已选 seed 随该 ID 与正文保存在 segments.json，普通续跑保留，改该句正文才重置；可重复指定多个 ID，或用 `--clear-segment-seeds` 显式清空。不要为了一个错读全篇换 seed，也不要假设同一 seed 适合所有声音。
4. 接 `web-video-presentation` 时，交 `voiceover.json` 和同目录产物；用它的 `import-voiceover.mjs` 验证后导入，从最终 SRT 规划连续场景，再开发 MG。音频完成之后走网页技能的 VO-First 路径。

开发者把 Nano/MLX 的本地试跑、PyTorch/CUDA 的验证边界和已发现限制记在仓库文档中；不要复述没有在当前机器测过的“实时”“零误差”“任意硬件可用”承诺。
