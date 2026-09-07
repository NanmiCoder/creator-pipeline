# 跑通第一支网页演示

这里有六句公开文案、连续 SVG 场景，以及一个组装脚本。你提供自己的参考录音，脚本使用**实际生成的六条 SRT**填入动画时间，无固定假时间戳。不附带任何私人声音。

从仓库根目录执行，先安装 uv、FFmpeg、Node.js/npm：

```bash
python3 skills/voice-clone-tts/scripts/setup.py --provider nano
# 将 PY 设为 setup 输出的 Python 路径，例如当前项目的路径：
PY="$PWD/.creator-env/nano/bin/python"
"$PY" skills/voice-clone-tts/scripts/run.py examples/first-video/script.md \
  --reference /path/to/my-voice.mp3 --outdir voiceover-first
```

先检查声音。如果只有第 2 段需要重试，可为它指定新 seed，其他五段继续使用缓存：

```bash
"$PY" skills/voice-clone-tts/scripts/run.py examples/first-video/script.md \
  --reference /path/to/my-voice.mp3 --outdir voiceover-first --segment-seed 2:3
```

`2:3` 是“第 2 段使用 seed 3”，并不保证这个 seed 对所有声音有效。选择保存在 segments.json，普通续跑不会撤销；相同 ID 的正文变化后才不再继承。可重复传入多个 `--segment-seed`，用 `--clear-segment-seeds` 显式清空所有覆盖。改稿、换参考或换模型后重新检查。不要为了转写匹配而改掉原稿。

然后组装网页，目标目录必须是新的空目录：

```bash
node examples/first-video/make-demo.mjs \
  voiceover-first/voiceover.json ./first-video-demo
cd first-video-demo/presentation
npm run dev -- --host 127.0.0.1
```

打开终端里的地址，点右下角 MANUAL 切换 AUTO 后播放。支持 `?auto=1` 自动模式；浏览器首次有声播放可能需要点击。验帧用 `?review=1&t=15&mute=1`；正式录制去掉 review/mute。

该 helper 只组装这份固定六句样例，会核对源稿哈希与段数。制作自己的内容时由 Agent 按 web skill 规划 `plan.md` 与场景，使用 `import-voiceover.mjs` 导入最终配音，再实现和验证动画。它不是一个可以把任意文章自动套进六张卡片的通用生成器。

Apple Silicon 可另建 `--provider mlx` 环境，再在 run 命令中显式加 `--provider mlx`。所有音频和模型都在本机；本例不自动调用在线服务或发布网页。
