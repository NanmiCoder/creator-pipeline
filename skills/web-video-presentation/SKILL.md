---
name: web-video-presentation
description: 将口播稿、文章或已有音频与 SRT 制作为可录屏的 16:9 网页视频演示（Vite + React + TypeScript）。用连续视觉场景、证据画面、卡片状态变化与 MG 动画解释内容；支持点击推进、整段原声驱动、分段录制和按绝对时间验帧。适用于 B 站、YouTube、视频号口播配画面与产品演示。
---

# Web Video Presentation

声音讲细节，画面让观众看见关系与变化。**先设计“什么东西发生了什么”，再排文字。**
高级感来自清楚的主次、可信的素材、连贯的空间与精确的运动；动画数量、卡片数量和代码量不等于质量。

## 先读哪份

| 工作 | 读 |
|---|---|
| 规划、SRT、事实 | [PLAN-FORMAT.md](references/PLAN-FORMAT.md) |
| 构图、镜头、MG、章节开发 | [CRAFT.md](references/CRAFT.md) |
| 音频时钟、可寻址动画 | [MOTION.md](references/MOTION.md) |
| 浏览器验收、对照实验 | [EVALUATION.md](references/EVALUATION.md) |
| 录制交付 | [RECORDING.md](references/RECORDING.md) |

## 配音技能交接

只有文案与参考录音时，先用已安装的 `voice-clone-tts` 生成最终 WAV、SRT 和 voiceover.json。不要在网页章节开发后才重新生成声音。

```bash
node <本技能目录>/scripts/import-voiceover.mjs <voiceover.json> <presentation目录>
```

导入器验证文件、PCM时长和字幕，复制到 public/audio 并生成 voiceover-input.json。按其中 cues 组织镜头；同一 scene 可以跨多个 cue/step，导入器不会替你编造视觉方案。plan.md 的 srt 路径相对于计划文件，audio 路径相对于 public/。时长使用清单中 WAV 的准确时长。

## 1. 用真实节奏规划

- **VO-First**：已有录音与 SRT，用最终版本；排序按时间，不按字幕序号。原声保持完整，复制到 `presentation/public/audio/`，原件不改。
- **TTS**：只有文章，保留 `article.md`，按 [SCRIPT-STYLE.md](references/SCRIPT-STYLE.md) 写 `script.md`。先做少量配音定节奏；整段合成后再锁定精确动画，别等所有动画做完才发现音频装不下。合成方式见 [AUDIO.md](references/AUDIO.md)。
- 先检查用户的历史项目、截图、品牌素材和偏好。主题只是起点，动态读取 `themes/*/theme.json`；用户让你选就说明选择并推进。新主题见 [THEMES.md](references/THEMES.md)。
- 写一份 `plan.md`，与 `presentation/` 同级。`timeline` 管时间与原文；章节备注管镜头、证据与共享视觉约定。生成的 BRIEF 和验收结果不是第二份手工计划。
- **step 是口播焦点变化，scene 是连续画面空间**。同一对象的变化可跨多个 step 保留。换话题、换地点或需要强调时才切镜头；不要每句换一屏。
- 每个镜头写清：主体、起态→动作→终态、上屏短语、对应 cue、与前后镜头如何接。关键因果/对比需要被演出来；一句“做高级 MG”不能开工。
- 核实要展示的事实与素材。缺证据时用明确标注的机制示意或省去该项；不得把模拟 UI 当实测截图。

**先出一个有代表性的 15–30 秒样片**，优先选最难的解释/对比段，连同入口与出口一起验证，形成可复用的构图、字体、物体尺度和运动语言。不要只挑容易做漂亮的标题。已获用户授权时自主过关继续；风格需要用户拍板时给可播放样片和具体差异再问，不设置固定的主题/并行度/anchor 四连问。真正影响口径的事实冲突单独澄清。

## 2. 搭台，复用可靠部分

```bash
bash <skill>/scripts/scaffold.sh ./presentation --theme=<id>
cd presentation
npm run gen
```

- 删除示例前先准备实际章节，并同步 `src/registry/chapters.ts` 注册，避免空列表崩溃。
- **旧项目先查版本**：旧 gen 不认识 srt/scene/screen，旧 App 也不传 time；按 [MOTION 的旧项目迁移](references/MOTION.md#旧项目迁移) 在副本中升级后再用新字段。
- `gen` 默认读 `../plan.md`；生成 timeline、章节 narrations、BRIEF。有 `srt:` 时同时生成准确 cue 数据 `timing.ts`，不再每章重复抄时间。
- `narrations.ts` 已存在会保留；改 step 数需同步文件或备份后重新生成。别假设重跑 gen 会覆盖它。
- 在 `App.tsx` 设置 `AVATAR_CORNER` 与 `SUBTITLE_SAFE`，并把配置写到计划的全片约定中。
- 优先复用 `src/motion/` 的时间采样函数与原生 SVG/CSS；复杂形变确有收益时再引入库。共享组件放 `src/components/`，不要从其他章节导入。

## 3. 按镜头完成章节

每章输入 = BRIEF（含生成的 FACTS.md 链接）+ CRAFT + 当前主题 token；使用时间采样时再读 MOTION。

1. 先搭主视觉与最终可读状态，检查安全区、手机缩小后的可辨认性、来源对应关系。
2. 再接 cue 与动作，保持主体连续；卡片承担比较、容器、翻面揭晓、排序等明确职责。
3. 检查起态、动作中点、信息落点、下一镜头入口。只有最后一帧漂亮不算完成。

按用户授权及可用工具决定是否并行；并行时先冻结共享组件/主题/接口，一章一个 agent，仅写本章目录。主线程负责共享代码和注册。**token 统一不能兜底构图与动作风格，样片才是契约。** 若无子代理就顺序完成，流程不依赖多代理。

设计目标（诊断线，不是机械配额）：

- 一屏通常 1 个主命题、2–4 个必要标签，先尝试 40 个中文等效字符以内。引文/代码/证据图可例外，提供局部聚焦与阅读时间；不要靠缩字、裁证据、删口径达标。
- 解释型章节应由对象、图解、真实素材承担主要时间；连续三个镜头都只是标题+文字卡时重新检查镜头选择。
- 每个重要动作都能回答“它帮助理解了什么”。入场、扫光、背景呼吸不算机制演示。
- 丰富来自对象变化、数据对比、局部放大、连接/断开、翻面、遮罩交接与适时硬切的组合。结论可以安静停住，不必全片一直动。

## 4. 验收后交付

1. `npm run check`：真实 TypeScript 项目检查、时间轴/步数/红线。SKIP 不等于该项已验证。
2. 按 [EVALUATION.md](references/EVALUATION.md) 遵循用户浏览器偏好，优先用可用的 **ego-browser** 看每种镜头的起/中/末帧和转场；新时钟镜头可用 `?review=1&t=<绝对秒>&mute=1` 精确复现。
3. `?auto=1&mute=1` 按 part 连续播放，确认声音时钟推进、cue 落点、无黑场/错位/截断。静态验帧不能代替播放。
4. 复查上屏事实、缺失素材与安全区。修最小镜头，再复查它的相邻转场。
5. 交付可运行目录、播放链接、录制方式和实测证据。用户录制链接去掉 `mute=1` 和 `review=1`。没有量过的速度/返工改善不要写成结论。

## 保留的工程底线

固定 1920×1080 舞台，用 transform 适配视口，章节不用 vw/vh；颜色与字体用主题 token；章节 CSS 有前缀；无跨章 import。step 与口播条目数一致。整段原声由 audio.currentTime 驱动；章节不用独立计时器制造第二条时间轴。术语、数据口径和真实素材来源统一。

[EXAMPLES](references/EXAMPLES/) 中的旧文字/清单案例只作结构参考；新项目默认以脚手架的连续场景示例、[真实 SRT MG 示例](references/EXAMPLES/continuous-scene/)和代表性样片为起点。
