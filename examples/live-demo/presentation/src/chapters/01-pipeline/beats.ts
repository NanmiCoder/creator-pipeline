import {timing} from './timing';
// Editorial action beats INSIDE the original SRT cues, not word-alignment timestamps.
const score:[number,number,string][]=[
 [0,0,'文案落入画面'],[0,.33,'参考录音进入'],[0,.66,'两份输入配对'],
 [1,0,'输入汇入声音'],[1,.23,'配音波形生成'],[1,.60,'音色克隆落定'],
 [2,0,'展开完整音轨'],[2,.22,'按真实 cue 拆分'],[2,.44,'时间戳逐个落位'],[2,.70,'字幕与声音对齐'],
 [3,0,'时间轴进入网页'],[3,.20,'文字长成卡片'],[3,.43,'连接与传递关系'],[3,.70,'推进主体焦点'],
 [4,0,'声音带动画面'],[4,.29,'焦点推进到声音'],[4,.59,'焦点推进到画面'],
 [5,0,'收拢网页作品'],[5,.24,'演示播放状态'],[5,.51,'分出视频交付'],[5,.75,'完成落版'],
];
export const beats=score.map(([step,fraction,label],i)=>{
 const cue=timing[step]!,at=cue.at+(cue.end-cue.at)*fraction;
 const next=score[i+1];
 const end=next?timing[next[0]]!.at+(timing[next[0]]!.end-timing[next[0]]!.at)*next[1]:cue.end;
 return {step,at,duration:Math.min(.92,(end-at)*.70),label};
});
