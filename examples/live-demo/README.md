# 在线有声 Demo 的源码

[播放演示](https://nanmicoder.github.io/creator-pipeline/) · [逐拍查看](https://nanmicoder.github.io/creator-pipeline/?review=1&t=0&steps=1)

[Vercel 备用入口](https://creator-pipeline-alpha.vercel.app/)

这里是线上演示的完整工程：六段 MiniMax 示例配音、真实 SRT、21 拍连续动画和固定 16:9 舞台。源码、计划、锁定依赖、成品音频与字幕一起进入 Git；换电脑或全新 clone 后即可运行，无需 MiniMax 账号，也不用重新克隆声音。

## 本地运行

使用 Node.js 22 LTS，从仓库根目录执行：

```bash
cd examples/live-demo/presentation
npm ci
npm run dev
```

打开终端显示的地址，点击页面开始有声播放。

- `/` 或 `?auto=1`：完整有声演示。
- `?review=1&t=0&steps=1`：逐拍前进、回退、重播。
- `?review=1&t=16`：查看指定秒的画面。
- `?manual=1`：按六段口播手动推进。

## 修改哪里

| 想改的内容 | 文件 |
|---|---|
| 构图、卡片、转场与 MG | [chapter.tsx](presentation/src/chapters/01-pipeline/chapter.tsx)、[chapter.css](presentation/src/chapters/01-pipeline/chapter.css) |
| 每段内部的动作拍 | [beats.ts](presentation/src/chapters/01-pipeline/beats.ts) |
| 口播与场景计划 | [plan.md](plan.md) |
| 成品音频与字幕 | [public/audio](presentation/public/audio) |
| 页面入口、播放模式 | [App.tsx](presentation/src/App.tsx)、[useAutoMode.ts](presentation/src/hooks/useAutoMode.ts) |
| Vercel 构建设置 | [vercel.json](presentation/vercel.json) |

只改画面不需要重新生成配音。改口播时，先用 `voice-clone-tts` 生成自己的音频/SRT，调用仓库的 `skills/web-video-presentation/scripts/import-voiceover.mjs` 导入本工程；同步 plan、narrations 和真实波形，再运行 `npm run gen`。不要只改字幕或手填估计时长。

`npm run gen` 从上一级 plan 生成 timeline、timing 和 BRIEF，保留已有 narrations。`voiceover-input.json` 记录当前音频与字幕的哈希；`npm run check` 会核对打包媒体、实际 PCM 时长、SRT 和 TypeScript。改稿后须把相关产物一起提交。

```bash
npm run check
npm test
npm run build
```

提交前还要实际播放修改部分与相邻转场，检查逐拍控制和 16:9 外框。CI 会在独立环境安装并构建这份 Demo。

## GitHub Pages 主入口

当前 Pages 从 `gh-pages` 分支的根目录发布，地址为 <https://nanmicoder.github.io/creator-pipeline/>。`main` 保存可编辑的源码；`gh-pages` 保存部署用的 HTML、压缩 JS/CSS、示例音频与字幕。部署分支包含这些构建产物是正常的，`main` 中的 `dist/`、`node_modules/`、`.vercel/` 和本机配置继续由 `.gitignore` 排除。

目前修改或 push `main` 不会自动更新 Pages。更新 Pages 时须从源码重新构建，并把发布目录更新到 `gh-pages`；仅执行下面的 Vercel 命令也不会更新 Pages。

当前 Pages 发布包有两项与普通 Vercel 构建不同的处理：资源前缀为 `/creator-pipeline/`，并移除了 Google Fonts 的远程导入。它们目前尚未编码为主分支的专用构建命令；下次更新 Pages 时需要保留这两项处理，不能直接复制默认 `npm run build` 的产物，否则会导致资源路径错误或恢复远程字体请求。

## 更新 Vercel 备用站

先安装并登录 Vercel CLI。首次在 `presentation/` 中关联自己的项目：

```bash
vercel link
npm run deploy
```

`deploy` 会检查、构建，将 dist 打包为静态 Build Output，然后执行 `vercel deploy --prebuilt --prod`。本机已有的项目关联继续指向原来的 `creator-pipeline` 项目，正式网址保持不变。其他贡献者应关联自己的项目。链接信息在 `.vercel/` 中，未提交 Git。

提交 Git 与 Vercel 部署是两个独立操作，目前没有配置主分支 push 后自动部署 Vercel。更新备用站时运行上述 deploy 命令即可。

本次实测使用 Vercel CLI 59.1.3 + Node 22。若 Node 26 出现代理相关的 `invalid onError method`，切回 Node 22 再执行；目录提供 `.nvmrc`，使用 nvm 的用户可运行 `nvm use`。

## 与技能模板的关系

`skills/web-video-presentation/templates/` 是安装技能时交付的通用起点；这里是使用技能做出的可独立编辑成品。Demo 不依赖仓库外的源码、个人目录或 symlink。调整 Demo 不会自动覆盖通用模板；确认可复用的改进再同步回模板并分别验证。

已公开的 25 秒成品配音随本 Demo 提供，用于复现演示。原始参考录音、私人音色 ID、API key、模型权重、node_modules 和部署缓存不进入 Git。技能安装仍只安装 `skills/` 下的两个技能。
