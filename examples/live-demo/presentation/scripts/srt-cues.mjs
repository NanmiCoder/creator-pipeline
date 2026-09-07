import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Preserve text and original cue ID; normalize CRLF/BOM and sort by time. */
export function parseSrt(text) {
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
  const stamp = '(\\d{2,}):(\\d{2}):(\\d{2})[,.](\\d{3})';
  const re = new RegExp(`^${stamp}\\s*-->\\s*${stamp}(?:\\s+.*)?$`);
  const seconds = (m, i) => {
    if (+m[i + 1] >= 60 || +m[i + 2] >= 60) throw new Error('SRT 分/秒必须小于 60');
    return +m[i] * 3600 + +m[i + 1] * 60 + +m[i + 2] + +m[i + 3] / 1000;
  };
  return blocks.map((block, index) => {
    const lines = block.split('\n');
    const j = lines.findIndex(l => l.includes('-->'));
    const m = j >= 0 ? re.exec(lines[j].trim()) : null;
    if (!m) throw new Error(`SRT 块 ${index + 1} 时间格式错误`);
    const at = seconds(m, 1), end = seconds(m, 5);
    if (end <= at) throw new Error(`SRT 块 ${index + 1} 结束不晚于开始`);
    const body = lines.slice(j + 1).join('\n').trim();
    if (!body) throw new Error(`SRT 块 ${index + 1} 缺正文`);
    return { id: j ? lines[0].trim() : String(index + 1), at, end, text: body };
  }).sort((a, b) => a.at - b.at || a.end - b.end);
}

export function attachCues(model, cues) {
  const warnings = [];
  for (const ch of model.chapters) for (const [i, s] of ch.steps.entries()) {
    s.cues = cues.filter(c => c.at >= s.at - 0.035 && c.at < s.end - 0.035);
    if (!cues.some(c => Math.abs(c.at - s.at) <= 0.035))
      warnings.push(`${ch.id} step ${i}: at=${s.at} 不在 SRT cue 起点；检查是否有意的静默/转场`);
    const normalize = str => str.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
    if (s.vo && normalize(s.vo) !== normalize(s.cues.map(c => c.text).join('')))
      warnings.push(`${ch.id} step ${i}: vo 与此时间段 SRT 不同；核对版本/跨界 cue/字幕纠错`);
  }
  return warnings;
}

export function emitTiming(ch) {
  const relative = n => +(n - ch.startAbs).toFixed(3);
  const steps = ch.steps.map(s => ({
    at: relative(s.at), end: relative(s.end), scene: s.scene || ch.id,
    screen: s.screen || '',
    cues: (s.cues || []).map(c => ({...c, at: relative(c.at), end: relative(c.end)})),
  }));
  return `// AUTO-GENERATED: all times below are chapter-relative seconds.\nexport const CHAPTER_START = ${ch.startAbs};\nexport const timing = ${JSON.stringify(steps, null, 2)};\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { console.error('用法: node scripts/srt-cues.mjs <file.srt>'); process.exit(1); }
  try { console.log(JSON.stringify(parseSrt(fs.readFileSync(process.argv[2], 'utf8')), null, 2)); }
  catch(e) { console.error(e.message); process.exit(1); }
}
