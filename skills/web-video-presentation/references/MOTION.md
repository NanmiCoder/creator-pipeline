# 同一个时钟驱动 MG

VO-First 模式整段 audio.currentTime 驱动 step，也作为 `ChapterStepProps.time` 传入章节（**章内秒**）。
`timing.ts` 的 at/end/cues.at/cues.end 同样是章内秒；CHAPTER_START 是该章绝对起点。
manual 用预览时钟，从当前 step 起点播放；`?review=1&t=绝对秒&mute=1` 固定时间，不发声。
TTS 尚未生成绝对时间轴时，time 只是估算预览，不能作为精确音画验证。精确制作先拿到音频/SRT。

## 无历史依赖的采样

```tsx
import { progress, mix } from '../../motion/sample';
import { timing } from './timing';
import type { ChapterStepProps } from '../../registry/types';

export default function Diagram({step, time = 0}: ChapterStepProps) {
  const revealAt = timing[1]!.cues[0]!.at; // 先核对 cue 原文，避免盲选索引
  const p = progress(time, revealAt, 0.6);
  return <svg viewBox="0 0 1920 1080">
    <g transform={`translate(${mix(300, 1100, p)} 450)`}>
      <rect width="240" height="180" rx="16" fill="var(--surface-2)" />
    </g>
    <path d="M540 540H1100" pathLength={1} strokeDasharray={1}
      strokeDashoffset={1-p} fill="none" stroke="var(--accent)" />
  </svg>;
}
```

由同一个 p 组合位移、比例、遮罩、SVG 描线、数值、翻面角度。多拍动作各自引用对应 cue。
卡片翻面要按角度切换可见面，不能只把背面文字透明化后计入阅读指标；保留对象 key，避免步切换重挂。
SVG ID 用章/镜头前缀防止多图 clipPath 冲突。表格比例由真实数据计算，示意图不要伪造精度。

`progress(t,start,duration,ease)` 返回 0–1，默认 easeOut；匀速路径用 linear；mix 插值；windowOpacity 控制镜头可见区间。
纯函数可在任意时刻重建画面，不需要播放过前面的动作，适合回退、截中帧、补拍。

## CSS、转场与兼容

现有章节只接 step 仍可用。CSS 入场/transition 适合手动点击与轻微装饰，**不会自动随 time seek**。
重要信息的显隐与位移使用采样；同一属性不要同时受 CSS animation 和 time 控制。
跨章默认硬切；需要共享对象交接时，由主线程将其放到共同父场景或共享组件中，明确入口/出口状态。
不要为每种特效引入一个动画库，也不用为一次位移搭时间轴框架。

## 验帧入口

启动服务后打开 `?review=1&t=69.600&mute=1`（使用该项目实际绝对秒）。
review 隐藏开发控件与安全区提示；安全区仍按 App 配置测量。不会修改手动游标。
需要连续采样时，通过所选浏览器工具的页面 JS 接口调用：

```js
window.dispatchEvent(new CustomEvent('presentation:seek', {detail:69.6}));
```

等待至少两个 requestAnimationFrame，再检查 `.scene` 的 data-time/data-step/data-chapter 并截图。
这只冻结采样动画；旧 CSS 章节需单独暂停/seek Web Animations。不要把旧章节的 review 截图误当正确中间帧。
自动播放验证仍走 `?auto=1&mute=1`，按 Space 启动，核对 data-time 确实推进。

## 旧项目迁移

本次更新不会自动改变用户已有 presentation。旧 gen 拒绝 srt/scene/screen、旧 App 不传 time 都是预期版本差异。
先复制到隔离目录。保留旧主题、注册、头像/字幕常量与项目特有 part 逻辑；不要直接覆盖整个 App。

- 更新 gen-timeline.mjs **和** srt-cues.mjs，再在副本运行 gen，核对 timeline/口播数量未变。
- 合并 types.ts 的可选 time、motion/sample.ts、useChapterTime.ts 与 useTimelineAuto 的时间返回值；按新 App 的接线传入章内 time。
- 合并 review 模式与 Stage 的录制缩放；旧章节继续只用 step，其 CSS 动画不会因升级自动变为可 seek。
- 更新 check 的真实 tsc -b 调用。现有项目不必替换依赖；只有实测不兼容才升级并重新构建。
- 验证至少一个旧章节、一个新 MG、part 起止和手动/自动模式后，才替换用户当前工作版本。

仅做新镜头规划时可先交可执行计划并说明升级前置；不得对旧项目运行新字段后，把“生成失败”归咎于用户输入。
