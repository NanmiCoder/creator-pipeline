# Creator Pipeline 实测样片

```timeline
srt: presentation/public/audio/voiceover.srt
audio: audio/voiceover.wav
duration: 25.06779166666667
chapters:
  - id: pipeline
    title: 从文案到网页视频
    steps:
      - at: 0
        vo: "先准备一份文案，再放入一段自己的录音。"
        scene: pipeline
        screen: "从一段话，开始创作。"
        do: "文案落版→录音进入→两份输入配对"
      - at: 3.576
        vo: "克隆自己的声音，让每一段配音都保留熟悉的表达。"
        scene: pipeline
        screen: "把你的声音，留在作品里。"
        do: "输入汇入声音→配音波形生成→音色克隆落定"
      - at: 7.494
        vo: "每段音频都有对应的时间戳，字幕和声音来自同一条时间轴。"
        scene: pipeline
        screen: "每一句话，都有落点。"
        do: "展开音轨→按真实 cue 拆分→时间标记落位→字幕与声轨对齐"
      - at: 12.578
        vo: "接下来，让文字变成卡片，让卡片之间的关系动起来。"
        scene: pipeline
        screen: "让内容，长成画面。"
        do: "时间轴进入网页→文字长成卡片→连接传递→主体焦点推进"
      - at: 17.289
        vo: "播放时，声音走到哪里，画面就推进到哪里。"
        scene: pipeline
        screen: "声音向前，画面跟随。"
        do: "同一时钟依次推动文案、声音、画面的焦点"
      - at: 20.812
        vo: "最后得到可以自动播放的网页演示，也可以录制成视频。"
        scene: pipeline
        screen: "从一段话，到一部作品。"
        do: "收拢网页→演示播放→分出视频→完成落版"
```

## 全片视觉约定
主题 creator-dark；无头像，无外置字幕。预览/自动播放/验帧都保留 16:9 外框。无衬线大字、分层声音卡，实际配音振幅展开成时间轴，再进入画面。主体身份跨步保留。时间来自真实音频/SRT。

## 章节画面备注
### pipeline
六段 SRT 内有 21 个动作拍，由 beats.ts 使用 cue 边界编排句内动作，使用章内 time 驱动对象转换。句内动作点为编辑决策，不是词级对齐。?review=1&t=0&steps=1 可以逐拍播放。
