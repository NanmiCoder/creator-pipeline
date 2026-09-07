import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {beats} from './beats';

/** A silent, opt-in review controller. It owns the review clock only; autoplay keeps its audio clock. */
export function StepReview() {
 const [index,setIndex]=useState(-1),[playing,setPlaying]=useState(false);
 const cursor=useRef(-1),clock=useRef(0),raf=useRef(0);
 const enabled=new URLSearchParams(location.search).get('steps')==='1'&&new URLSearchParams(location.search).get('review')==='1';
 function go(n:number){
  const target=Math.max(0,Math.min(beats.length-1,n)),beat=beats[target]!;
  const from=target===cursor.current+1?clock.current:beat.at;
  const to=beat.at+beat.duration;
  cursor.current=target;setIndex(target);cancelAnimationFrame(raf.current);
  const seek=(t:number)=>{clock.current=t;window.dispatchEvent(new CustomEvent('presentation:seek',{detail:t}));};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){seek(to);setPlaying(false);return;}
  const origin=performance.now();setPlaying(true);
  function tick(now:number){const t=Math.min(to,from+(now-origin)/1000);seek(t);if(t<to)raf.current=requestAnimationFrame(tick);else setPlaying(false);}
  raf.current=requestAnimationFrame(tick);
 }
 useEffect(()=>{
  if(!enabled)return;
  const key=(e:KeyboardEvent)=>{
   if((e.target as HTMLElement).closest('input,select,button,a'))return;
   if(['ArrowRight','ArrowLeft',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();go(cursor.current+(e.key==='ArrowLeft'?-1:1));}
  };
  window.addEventListener('keydown',key,true);
  return ()=>{cancelAnimationFrame(raf.current);window.removeEventListener('keydown',key,true);};
 },[enabled]);
 if(!enabled)return null;
 return createPortal(<nav className="pi-review" data-no-advance aria-label="逐步演示">
  <button onClick={()=>go(cursor.current-1)} disabled={index<=0} aria-label="上一个动作">←</button>
  <div className="pi-review-label"><span>{index<0?'逐步演示':`${String(index+1).padStart(2,'0')} / ${beats.length}`}</span><b>{index<0?'点击下一步，看画面如何推进':beats[index]!.label}</b></div>
  <button onClick={()=>go(cursor.current+1)} disabled={index===beats.length-1} aria-label="下一个动作">{playing?'推进中':'下一步'} →</button>
  <button className="pi-review-reset" onClick={()=>{cancelAnimationFrame(raf.current);cursor.current=-1;clock.current=0;setIndex(-1);setPlaying(false);window.dispatchEvent(new CustomEvent('presentation:seek',{detail:0}));}}>重播</button>
 </nav>,document.body);
}
