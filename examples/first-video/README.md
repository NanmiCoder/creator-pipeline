# 跑通第一支网页演示

这里有六句公开文案、连续声音与画面场景，以及一个组装脚本。你提供自己的参考录音，脚本使用**实际生成的六条 SRT**填入动画时间，并从最终 PCM 提取振幅概览。不附带任何私人声音。

从仓库根目录执行，先安装 uv、FFmpeg、Node.js/npm：

```bash
python3 skills/voice-clone-tts/scripts/setup.py
# 将 PY 设为 setup 输出的 Python 路径，例如Apple Silicon 当前项目的路径（其他平台是 qwen）：
PY="$PWD/.creator-env/mlx/bin/python"
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

打开终端里的地址，按 M 切换播放模式，或直接用 `?auto=1`；点击起播蒙层或按 Space 开始。验帧用 `?review=1&t=15&mute=1`；正式录制去掉 review/mute。所有模式均保留 16:9 外框，在录屏软件中沿角标框选画面内容。验收使用用户指定或本机可用的浏览器 skill。

新增 `?review=1&t=0&steps=1` 逐步演示入口：点“下一步”或按右箭头 / Space 播放一个动作后停住，左箭头回退，“重播”从头开始。它是静音的动作审阅，控制条在 16:9 画面外；极矮窗口（高度不超过 250px）隐藏控制条，可用键盘或增高窗口继续。完整有声播放仍用 `?auto=1`。

六段 SRT 内设计了 **21 个动作拍**：输入配对 → 声音展开 → 音轨拆分与对齐 → 文字长成卡片 → 关系连接与焦点推进 → 网页与视频交付。动作谱在 [beats.ts](beats.ts)，这些句内时刻属于编辑编排，不是词级对齐结果。

视觉方向：深色创作工作台，沿用本系列技术演示的无衬线大字与黄绿强调色。主体从双输入构图移到声音近景、全宽音轨、网页关系图，再收成交付构图；统一采用薄边高光与软投影，避免等宽线框排成一行。React、CSS 和原生 SVG 驱动，固定 1920×1080 画面按比例缩放；减弱动态偏好下，主要位移即时落位，时钟信息仍然更新。模型输出与真实录制是独立于这个概念画面的交付，不把模拟窗口当实测截图。

该 helper 只组装这份固定六句样例，会核对源稿哈希与段数。制作自己的内容时由 Agent 按 web skill 规划 `plan.md` 与场景，使用 `import-voiceover.mjs` 导入最终配音，再实现和验证动画。它不是一个可以把任意文章自动套进六张卡片的通用生成器。

Qwen3-TTS 是默认模型；setup 与 run 自动选择同一平台后端。Nano 需单独建立 `--provider nano` 环境，并在 run 中显式指定。所有音频和模型都在本机；本例不自动调用在线服务或发布网页。
