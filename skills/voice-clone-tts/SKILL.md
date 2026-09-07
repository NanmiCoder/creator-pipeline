---
name: voice-clone-tts
description: 将文案与用户自己的参考录音合成为配音、SRT 和可交接时间轴。默认使用 MiniMax 与用户自己的音色；可显式选择免费本地 Qwen3-TTS（Apple Silicon 用 MLX）或 Nano CPU。适用于口播配音、声音复刻，以及为网页视频演示准备最终音频和字幕。
---

# 文案与参考声音 → 配音与时间轴

交付 `voiceover.wav`、`voiceover.mp3`、`voiceover.srt`、`voiceover.json`。WAV 是计时主文件，SRT 是原稿短段对应的采样帧时间；这不是字级强制对齐，也不能证明模型读音完全正确。

## 选择后端

默认 **MiniMax speech-2.8-hd**，使用用户自己的服务账号和已登记音色，可能消耗在线额度。优先完成一个代表性短段，经用户听审后扩展全文。用户明确选择的后端优先于默认值。

- `auto` 读取个人偏好；没有配置时选择 **minimax**。setup 与 run 使用同一逻辑。用 `configure.py` 保存偏好到技能目录外，升级不会覆盖个人音色。
- 免费本地路线显式用 `--provider local`：Apple Silicon 选择 **mlx**（Qwen3-TTS 0.6B Base 4bit），其他平台选择 **qwen**（官方 PyTorch，自动使用可用 CUDA，否则 CPU）。本地推理不需要 API key，首次需要下载模型并占用计算资源。
- **nano** 仅供用户显式选择较轻的 CPU 路线，不因 Qwen 缺依赖或运行失败自动降级。优先保证声音质量，不能把小模型的成功运行当作默认选择依据。
- MiniMax 缺账号或音色时给出配置入口；不自动使用共享音色。首次上传克隆录音需要处于用户授权的在线克隆任务中；已有授权直接执行，不反复确认。不因本地失败自动切换云服务。

各后端使用独立环境；首次运行读 [SETUP.md](references/SETUP.md)。音色来源是用户提供的本人/已获授权录音，没有共享的默认私人音色。

## 执行

先原样保存用户文案为 `script.md`；不擅自改写读法、数字或术语。只有明确的 Markdown 标题不朗读，编号列表保留。产物默认放当前项目的 `voiceover-<主题>/`，先说明位置。

`SKILL_DIR` 表示本 SKILL.md 所在目录。实际定位安装目录，不硬编码某个用户的 `~/.claude` 路径。

```bash
python3 "$SKILL_DIR/scripts/setup.py"
# 上一条会输出独立环境 Python 的实际路径；下文以 PY 表示它。
python3 "$SKILL_DIR/scripts/configure.py" --provider minimax --voice YOUR_VOICE_ID
"$PY" "$SKILL_DIR/scripts/run.py" script.md \
  --outdir voiceover-demo
```

没有 MiniMax 音色时，先按 [SETUP.md](references/SETUP.md) 登记。参考录音选干净、单人、无音乐的完整短段：MiniMax 要求 10–300 秒，通常先选 10–30 秒；本地 Qwen/Nano 通常选 3–30 秒。原录音太长时显式截取，不把全文转写误作短样本转写。Qwen 优先提供精确匹配的 `--reference-text reference.txt`，启用完整 ICL；缺省仅声音嵌入，效果可能不同。Nano 不要求参考转写。

声音条目按完整句子/语义短段组织，默认宽度 40，不为短字幕机械切碎句子。过长字幕可换行；需要更细时间时用最终 WAV 与原文做实际对齐，不按字数比例伪造 cue。

同一命令可续跑；缓存包含正文、声音内容哈希、模型/版本及生成参数。每次成功保存一个 WAV，失败段阻止拼接；改稿后重新分段、合成、拼接。不要只手改 SRT 或把旧音频配到新文案上。分步控制见 [PIPELINE.md](references/PIPELINE.md)。

## 验证与交接

1. `run.py` 会自动执行结构验证：全部段就绪，WAV/MP3/SRT 同源，文件哈希一致，字幕单调且不越界。也可单独运行 `verify.py voiceover-demo/voiceover.json`。
2. 检查实际声音，尤其数字、专名、中英混排、首尾、连接处与最长句。本地 ASR 可辅助找漏读/重读；ASR 正确不等于音色相似，不用转写结果覆盖原稿。
3. 修正有问题的段后重建所有最终产物。保留中间件便于局部重跑，不把模型或个人参考音频提交到仓库。
   本地模型的单句随机生成问题可用 `--segment-seed 2:3`（第 2 段用 seed 3），只使该句缓存失效。选择随该 ID 与正文持久保存，可重复指定，或用 `--clear-segment-seeds` 清空。MiniMax CLI 不提供可控 seed；修改 seed 不能保证复现或改善在线语音。`--force` 会重新请求所有段，并可能产生费用。
4. 接 `web-video-presentation` 时，交 `voiceover.json` 和同目录产物；用它的 `import-voiceover.mjs` 验证后导入，从最终 SRT 规划连续场景，再开发 MG。音频完成之后走网页技能的 VO-First 路径。

比较供应商时按 [VOICE-REVIEW.md](references/VOICE-REVIEW.md) 使用同参考、同文案和未参与克隆的原声片段；用户听感、内容正确性与声纹模型分数分别记录，不把单个余弦分数当作音色相似百分比。开发者保留验证边界，不复述未经实测的“实时”“零误差”“任意硬件可用”承诺。
