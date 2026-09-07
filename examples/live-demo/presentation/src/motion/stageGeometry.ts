/** Preview, autoplay and frame review share one capture rectangle. */
export function stageScale(width: number, height: number, baseW=1920, baseH=1080, marginX=80, marginY=100) {
  const padX=Math.min(marginX, width*.06);
  const padY=Math.min(marginY, height*.1);
  return Math.max(0, Math.min((width-padX*2)/baseW, (height-padY*2)/baseH));
}
