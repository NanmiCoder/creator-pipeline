# 分步运行与可靠交接

run.py 等价于以下步骤，全部脚本都位于本 skill 的 scripts/：

```bash
mkdir -p voiceover-demo
cp script.md voiceover-demo/script.md
"$PY" "$SKILL_DIR/scripts/segment.py" voiceover-demo/script.md -o voiceover-demo/segments.json
"$PY" "$SKILL_DIR/scripts/synth.py" voiceover-demo/segments.json --reference my-voice.mp3
"$PY" "$SKILL_DIR/scripts/build.py" voiceover-demo/segments.json
"$PY" "$SKILL_DIR/scripts/verify.py" voiceover-demo/voiceover.json
```

产物约定：`voiceover.wav` 是统一 24kHz/mono/PCM16 主文件，MP3 是分发副本；SRT 文本来自合成段原文，时间来自写入 PCM 的采样帧。`voiceover.json` 包含 schema_version、duration、total_frames、timing_method、文件哈希、source_text_sha256、段级边界和文本。

段级时轴保证的是“这段合成音频被拼接到哪里”。自动静音修剪基于波形阈值，并非声学对齐模型；不能保证每个首字精确到某一毫秒。最终 MP3 的封装 duration 可含编码 padding；验证的是解码帧数，不要求封装时长与 PCM 文本输出完全相等。

修改分段、暂停、声音或模型后，重跑 synth/build/verify。`build.py` 会先确认每段状态、缓存指纹、文件完整性及哈希；失败时不会用旧段补齐。产物在临时目录完成后替换，manifest 最后写入；消费者必须核对哈希，不能只看文件是否存在。

常用参数：

- 分段：`--max-chars 40 --min-chars 8`；不是固定字数配额。超长英文标识符不拆断。
- 合成：`--provider nano`、`--threads 4`、`--seed 0`、`--force`。默认串行复用一次模型和参考编码，避免多个模型同时占内存。
- Qwen：`--reference-text reference.txt`、`--temperature 0.8`、`--max-tokens 800`。Nano 使用其固定上游采样配置，max-tokens 控制音频帧上限；language 根据输入自动处理。
- 拼接：`--gap-hold 600`、`--no-trim`、`--trim-margin 15`。段间暂停在 segments.json/meta/silence_ms 中。默认出 SRT；纯音频用途可显式 `--no-srt`。

本地模型也会漏字、重复、错误读专名；SRT 文件正确不能替代听审。需要字词级时间时，对最终 WAV 与已确认原文运行实际强制对齐模型，再验证异常时间。不要用原稿字符占比分摊音频秒数。

## 单句重试与持久化

`run.py` 或 `synth.py` 可添加 `--segment-seed 2:3`，仅第 2 段使用新 seed。相同 ID 与正文会继承保存在 segments.json 的选择，普通续跑仍保留；新增其他段覆盖不会撤销之前的选择。需要恢复默认时显式传 `--clear-segment-seeds`。原句文本变化后不继承旧覆盖；换参考或模型仍会使音频缓存失效并需要重新检查。
