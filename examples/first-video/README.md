# 跑通第一支网页演示

这里有六句公开文案、连续声音与画面场景，以及一个组装脚本。你提供自己的参考录音，脚本使用**实际生成的六条 SRT**填入动画时间，并从最终 PCM 提取振幅概览。不附带任何私人声音。

从仓库根目录执行，先安装 uv、FFmpeg、Node.js/npm：

先按 [SETUP](../../skills/voice-clone-tts/references/SETUP.md) 配置 mmx，并登记自己的 MiniMax 音色：

```bash
python3 skills/voice-clone-tts/scripts/configure.py --provider minimax --voice YOUR_VOICE_ID
python3 skills/voice-clone-tts/scripts/setup.py
# PY 使用 setup 输出的实际路径；macOS/Linux 当前项目的缺省路径如下：
PY="$PWD/.creator-env/minimax/bin/python"
"$PY" skills/voice-clone-tts/scripts/run.py examples/first-video/script.md \
  --outdir voiceover-first
```

先检查声音、术语和句间停顿。MiniMax 不提供可控 seed；`--force` 会重新请求所有段，可能产生费用。免费本地方案在 setup 和 run 都添加 `--provider local`，并在 run 传 `--reference /path/to/my-voice.mp3 --reference-text /path/to/reference.txt`，使用对应环境 Python。本地单句重试与缓存见 [PIPELINE](../../skills/voice-clone-tts/references/PIPELINE.md)。

然后组装网页，目标目录必须是新的空目录：

```bash
node examples/first-video/make-demo.mjs \
  voiceover-first/voiceover.json ./first-video-demo
cd first-video-demo/presentation
npm run dev -- --host 127.0.0.1
```

打开终端里的地址，按 M 切换播放模式，或直接用 `?auto=1`；点击起播蒙层或按 Space 开始。验帧用 `?review=1&t=15&mute=1`；正式录制去掉 review/mute。所有模式均保留 16:9 外框，在录屏软件中沿角标框选画面内容。验收使用用户指定或本机可用的浏览器 skill。

新增 `?review=1&t=0&steps=1` 逐步演示入口：点“下一步”或按右箭头 / Space 播放一个动作后停住，左箭头回退，“重播”从头开始。它是静音的动作审阅，控制条在 16:9 画面外；极矮窗口（高度不超过 250px）隐藏控制条，可用键盘或增高窗口继续。完整有声播放仍用 `?auto=1`。

六段 SRT 内设计了 **21 个动作拍**：输入配对 → 声音展开 → 音轨拆分与对齐 → 文字长成卡片 → 关系连接与焦点推进 → 网页与视频交付。动作谱在 [beats.ts](../../skills/web-video-presentation/templates/src/chapters/01-pipeline/beats.ts)，这些句内时刻属于编辑编排，不是词级对齐结果。

视觉方向：深色创作工作台，沿用本系列技术演示的无衬线大字与黄绿强调色。主体从双输入构图移到声音近景、全宽音轨、网页关系图，再收成交付构图；统一采用薄边高光与软投影，避免等宽线框排成一行。React、CSS 和原生 SVG 驱动，固定 1920×1080 画面按比例缩放；减弱动态偏好下，主要位移即时落位，时钟信息仍然更新。模型输出与真实录制是独立于这个概念画面的交付，不把模拟窗口当实测截图。

该 helper 只组装这份固定六句样例，会核对源稿哈希与段数。制作自己的内容时由 Agent 按 web skill 规划 `plan.md` 与场景，使用 `import-voiceover.mjs` 导入最终配音，再实现和验证动画。它不是一个可以把任意文章自动套进六张卡片的通用生成器。

MiniMax 是默认后端，使用个人配置中的音色；免费 Qwen 通过 `--provider local` 选择，Nano 通过 `--provider nano` 选择。实际 Demo 的模型标签来自配音 manifest，波形来自实际 PCM。组装脚本不合成音频，也不发布网页。

默认脚手架已内置本例的场景、动作谱和 Step 控制条，源码统一维护在 [01-pipeline](../../skills/web-video-presentation/templates/src/chapters/01-pipeline/)。单独体验无需配音，见 [STARTER](../../skills/web-video-presentation/templates/STARTER.md)。此处的 `make-demo.mjs` 在同一模板上接入真实音频、SRT 和 PCM 波形，不再复制另一套动画实现。
