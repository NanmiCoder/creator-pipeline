(() => {
  const root = document.querySelector('.scene');
  const stage = document.querySelector('.stage-frame');
  if (!root || !stage) throw new Error('Missing .scene / .stage-frame');
  const box = stage.getBoundingClientRect(), scale = box.width / 1920;
  const leaves = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, text = node.textContent.trim();
    if (!text || !node.parentElement) continue;
    let opacity = 1, hidden = false;
    for (let p = node.parentElement; p && p !== stage; p = p.parentElement) {
      const s = getComputedStyle(p);
      opacity *= +s.opacity;
      if (s.display === 'none' || s.visibility === 'hidden') hidden = true;
      if (s.backfaceVisibility === 'hidden') {
        let m = new DOMMatrix();
        for (let a = p; a && a !== stage; a = a.parentElement) {
          const tr = getComputedStyle(a).transform;
          if (tr !== 'none') m = new DOMMatrix(tr).multiply(m);
        }
        if (m.m33 < 0) hidden = true;
      }
    }
    if (hidden || opacity < .06) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width || !r.height || r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) continue;
    const x=(r.left-box.left)/scale, y=(r.top-box.top)/scale, w=r.width/scale, h=r.height/scale;
    leaves.push({text,chars:[...text.replace(/\s/g,'')].length,x,y,w,h,
      font:+parseFloat(getComputedStyle(node.parentElement).fontSize).toFixed(1),opacity:+opacity.toFixed(3)});
  }
  return {time:root.getAttribute('data-time'),step:root.getAttribute('data-step'),
    stage:{width:box.width,height:box.height,scale},chars:leaves.reduce((n,l)=>n+l.chars,0),
    subtitleIntrusions:leaves.filter(l=>l.y+l.h>915),
    // Conservative 432px square for a top-right avatar; customize for actual project config.
    avatarIntrusions:leaves.filter(l=>l.x+l.w>1488 && l.y<432),
    leaves};
})()
