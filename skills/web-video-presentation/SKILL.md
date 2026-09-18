---
name: web-video-presentation
description: 将口播稿、文章或已有音频与 SRT 制作为可自动播放的 16:9 网页视频演示（Vite + React + TypeScript）。用连续视觉场景、证据画面、卡片状态变化与 MG 动画解释内容；支持点击推进、整段原声驱动、按绝对时间验帧，以及预览页一键导出 1K/2K/4K MP4。适用于 B 站、YouTube、视频号口播配画面与产品演示。
---

# Web Video Presentation

> 技能版本 **2.6.1**（同步自 `manifest.json`）。开始任务时先向用户报出版本号 —— skills CLI 不提供更新提示，用户只能靠这个判断手上是哪一版、要不要重装。

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
- 同一 Step 可以包含多个动作拍：按口播中的动作、转折、结果继续推进，动作谱记录各拍起点、时长和可见落点；详细方法见 [CRAFT](references/CRAFT.md#step-内的动作节奏)。不把一段较长口播只做成一次入场后长时间定格。
- 每个镜头写清：主体、起态→动作→终态、上屏短语、对应 cue、与前后镜头如何接。关键因果/对比需要被演出来；一句“做高级 MG”不能开工。
- 核实要展示的事实与素材。缺证据时用明确标注的机制示意或省去该项；不得把模拟 UI 当实测截图。

**先出一个有代表性的 15–30 秒样片**，优先选最难的解释/对比段，连同入口与出口一起验证，形成可复用的构图、字体、物体尺度和运动语言。不要只挑容易做漂亮的标题。已获用户授权时自主过关继续；风格需要用户拍板时给可播放样片和具体差异再问，不设置固定的主题/并行度/anchor 四连问。真正影响口径的事实冲突单独澄清。

## 2. 搭台，复用可靠部分

```bash
bash <skill>/scripts/scaffold.sh ./presentation
cd presentation
npm run dev   # 立即体验默认模板；准备好 ../plan.md 后再 npm run gen
```

- **默认模板就是 `01-pipeline` 的完整连续场景**：creator-dark 主题、6 段口播、21 个动作拍，含对象配对/汇合、波形拆轨、时间戳落位、卡片生成、关系传递、焦点推进和交付转场。首页直接逐拍交互，`?auto=1` 无声连播；用法与替换路径见 [STARTER.md](templates/STARTER.md)。主题可用 `--theme=<id>` 改选。
- **分清两层，写法相反，不要混为一谈**：
  - **内容层 —— 必须重写**：六段文案、21 拍的具体编排、`01-pipeline` 的镜头与素材都属于这个演示自己的内容，按你的口播重写，不照搬、不当固定配额。默认示意波形/时间不能作为实测证据。
  - **视觉语言层 —— 必须继承**：对象身份与交接方式、卡片质感、焦点推进手法、句内动作密度、转场质量。新章节和模板看不出同源，就是没做完。
  - 边界拿不准时按 [CRAFT 的镜头选择表](references/CRAFT.md) 判断：**手法**（怎么让关系可见）继承，**题材**（这次讲什么、用什么素材）重写。
- **`01-pipeline/` 保留作视觉参照，不要删目录**。同步 `src/registry/chapters.ts` 注册新章节、移除 `previewTiming` 就行 —— **移除的是注册，不是这份实现**。它是唯一的同源参照物，删了就没有第二份可对照。具体怎么继承见 [STARTER.md](templates/STARTER.md)（**不是**通读 `chapter.tsx` 手抄）。
- **旧项目先查版本**：旧 gen 不认识 srt/scene/screen，旧 App 也不传 time；按 [MOTION 的旧项目迁移](references/MOTION.md#旧项目迁移) 在副本中升级后再用新字段。
- `gen` 默认读 `../plan.md`；生成 timeline、章节 narrations、BRIEF。有 `srt:` 时同时生成准确 cue 数据 `timing.ts`，不再每章重复抄时间。
- `narrations.ts` 已存在会保留；改 step 数需同步文件或备份后重新生成。别假设重跑 gen 会覆盖它。
- 在 `App.tsx` 设置 `AVATAR_CORNER` 与 `SUBTITLE_SAFE`，并把配置写到计划的全片约定中。
- 优先复用 `src/motion/` 的时间采样函数与原生 SVG/CSS；复杂形变确有收益时再引入库。共享组件放 `src/components/`，不要从其他章节导入。
- **卡片质感走共享原语，不要重画**：`src/styles/base.css` 已有 `.card` 原语（`--surface-2` / `--bw-1 solid var(--rule)` / `--r-card` / `--card-shadow`），由 `App.tsx` 全局导入 —— **任何章节直接可用，不需要 import，也不受「章节 CSS 有前缀」「不跨章 import」两条约定约束**（`check.mjs` 的前缀检查与跨章检查都不扫描 `src/components` 与 base 原语）。新章节的卡片复用它加主题 token。
- **用 token，不要用像素值**：各主题 `--r-card` 从 4px 到 32px 不等，写死 `border-radius:16px` 换主题就破。反复出现的卡片再由主线程抽象进 `src/components/`。`01-pipeline` 自己尚未接上 `.card`（硬编码 16px），属历史遗留，**不要照抄它的字面值**。

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
2. 按 [EVALUATION.md](references/EVALUATION.md) 使用用户指定或本机可用的真实浏览器 skill（如 ego-browser、agent-browser 或其他浏览器工具），不绑定平台或品牌。查看每种镜头起/中/末帧和转场；新时钟镜头可用 `?review=1&t=<绝对秒>&mute=1` 精确复现。
3. `?auto=1&mute=1` 按 part 连续播放，确认声音时钟推进、cue 落点、无黑场/错位/截断。静态验帧不能代替播放。
4. 复查上屏事实、缺失素材与安全区。修最小镜头，再复查它的相邻转场。
5. 交付可运行目录、播放链接和实测证据。用户看片去掉 `mute=1`。预览页右上角 **导出** 可选 1K / 2K / 4K，编码时保持标签打开；滤镜失真或旧浏览器再按 [RECORDING.md](references/RECORDING.md) 用录屏软件。没有量过的速度/返工改善不要写成结论。

## 保留的工程底线

固定 1920×1080 舞台，用 transform 适配视口，章节不用 vw/vh；颜色与字体用主题 token；章节 CSS 有前缀；无跨章 import。step 与口播条目数一致。整段原声由 audio.currentTime 驱动；章节不用独立计时器制造第二条时间轴。术语、数据口径和真实素材来源统一。

**Manual、Auto 与 Review 都保留舞台外边距和 16:9 框选边界**。画面区域为直角矩形，边框、角标和控制条在画面外；切换播放模式不得改变矩形大小。截图/录制按 `.stage-frame` 的真实边界裁取，不为得到满屏截图而清零外边距。

[EXAMPLES](references/EXAMPLES/) 中的旧文字/清单案例只作结构参考；新项目默认以脚手架的连续场景示例、[真实 SRT MG 示例](references/EXAMPLES/continuous-scene/)和代表性样片为起点。
