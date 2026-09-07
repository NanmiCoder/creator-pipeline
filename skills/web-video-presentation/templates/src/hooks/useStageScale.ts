import { useEffect, useState } from "react";
import { stageScale } from "../motion/stageGeometry";

/**
 * Compute the scale needed to fit a 1920x1080 stage inside the current
 * viewport, leaving `marginX` / `marginY` of breathing room around it
 * (so absolutely-positioned UI like the progress bar isn't cropped).
 */
export function useStageScale(
  baseW = 1920,
  baseH = 1080,
  marginX = 80,
  marginY = 100,
) {
  const measure = () => stageScale(window.innerWidth, window.innerHeight, baseW, baseH, marginX, marginY);
  const [scale, setScale] = useState(measure);

  useEffect(() => {
    function update() {
      setScale(stageScale(window.innerWidth, window.innerHeight, baseW, baseH, marginX, marginY));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [baseW, baseH, marginX, marginY]);

  return scale;
}
