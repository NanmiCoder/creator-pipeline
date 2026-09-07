#!/usr/bin/env node
/**
 * gen-timeline.mjs —— 把 plan.md 的 ```timeline 块变成项目代码。
 *
 * 产出：
 *   1. src/registry/timeline.ts               （VO-First：整文件覆写）
 *   2. src/chapters/<NN>-<id>/narrations.ts   （已存在则跳过 —— 保留现有内容；VO 须核对原稿）
 *   3. src/chapters/<NN>-<id>/BRIEF.md        （每次覆写 —— 并行章节 agent 的任务卡）
 *   4. src/registry/chapters.ts 未注册的章节 → 打印提醒（不自动改，避免覆盖手工代码）
 *
 * 用法：
 *   npm run gen                       # 读 <项目根>/../plan.md（用户工作目录里）
 *   npm run gen -- path/to/plan.md    # 显式指定
 *
 * 两条路径（按 timeline 块字段自动识别）：
 *   VO-First：audio + duration + 每步 at        → 三件全出
 *   TTS：无 at、无 audio/duration               → 跳过 timeline.ts，只出 narrations + BRIEF
 *
 * 任何校验失败：全部列出 → 退出码 1 → **一个文件都不写**。
 *
 * Node ≥ 18，零第三方依赖。YAML 解析器为手写子集，只支持本格式用到的语法：
 *   两层「列表 of 映射」+ 标量；`#` 注释（引号内的 # 不算注释；vo 文本里要带
 *   " #" 时请加引号）；空格缩进（禁 tab）。
 */

import fs from "node:fs";
import { parseSrt, attachCues, emitTiming } from "./srt-cues.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class PlanError extends Error {}

/* ────────────────────────────── 1. 取块 ────────────────────────────── */

/** 从 plan.md 里取出唯一的 ```timeline fenced block。0 个或多个都报错。 */
export function extractTimelineBlock(md) {
  const lines = md.split("\n");
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (cur === null) {
      if (/^```timeline\s*$/.test(l)) cur = { startLine: i + 2, body: [] };
    } else if (/^```\s*$/.test(l)) {
      blocks.push(cur);
      cur = null;
    } else {
      cur.body.push(l);
    }
  }
  if (cur) throw new PlanError("```timeline 块没有闭合的 ```");
  if (blocks.length === 0)
    throw new PlanError("找不到 ```timeline 块（plan.md 必须有且仅有一个）");
  if (blocks.length > 1)
    throw new PlanError(
      `发现 ${blocks.length} 个 \`\`\`timeline 块（必须有且仅有一个）`,
    );
  return { text: blocks[0].body.join("\n"), startLine: blocks[0].startLine };
}

/**
 * 提取「## 章节画面备注」下的 `### <章 id>` 小节 → Map<id, text>。
 * 备注是章节 agent 的发挥起点（信息池 / 素材 / 口径警示），gen 把它原样
 * 附进对应章 BRIEF.md 尾部 —— 否则并行章节 agent（只读 BRIEF）拿不到。
 */
export function extractChapterNotes(md) {
  const notes = new Map();
  const lines = md.split("\n");
  let inSection = false;
  let curId = null;
  let buf = [];
  const flush = () => {
    if (curId !== null) {
      const text = buf.join("\n").trim();
      if (text) notes.set(curId, text);
    }
    curId = null;
    buf = [];
  };
  for (const l of lines) {
    const h2 = /^##\s+(.*)$/.exec(l);
    if (h2 && !/^###/.test(l)) {
      flush();
      inSection = /画面备注|章节备注/.test(h2[1]);
      continue;
    }
    if (!inSection) continue;
    const h3 = /^###\s+(.+?)\s*$/.exec(l);
    if (h3) {
      flush();
      // 小节名 = 章 id 开头即可 —— 人写 plan 时习惯在 id 后带注（如
      // `### deepswe（19.5–33.0，5 步）`），只取开头的 id 段做 key。
      const idHead = /^([a-z][a-z0-9-]*)/.exec(h3[1].trim());
      curId = idHead ? idHead[1] : h3[1].trim();
      continue;
    }
    if (curId !== null) buf.push(l);
  }
  flush();
  return notes;
}

/** Extract a named H2 section without interpreting its Markdown content. */
export function extractSection(md, title) {
  const lines = md.split("\n");
  const start = lines.findIndex(l => l.startsWith(`## ${title}`));
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  return lines.slice(start, end).join("\n").trim();
}

/* ─────────────────────── 2. YAML 子集解析器（手写） ─────────────────────── */

/** 去掉行尾 `#` 注释。引号内的 # 保留（简单单行引号状态机）。 */
function stripComment(raw) {
  let out = "";
  let q = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q) {
      out += c;
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      out += c;
      continue;
    }
    if (c === "#" && (i === 0 || raw[i - 1] === " " || raw[i - 1] === "\t"))
      break;
    out += c;
  }
  return out.replace(/[ \t]+$/, "");
}

function unquote(v) {
  const s = v.trim();
  if (
    s.length >= 2 &&
    ((s[0] === '"' && s[s.length - 1] === '"') ||
      (s[0] === "'" && s[s.length - 1] === "'"))
  ) {
    const body = s.slice(1, -1);
    if (s[0] === '"') return body.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    return body.replace(/''/g, "'");
  }
  return s;
}

/**
 * 解析 timeline 块（YAML 子集）→ 普通 JS 对象/数组/字符串。
 * baseLine = 块内第一行在 plan.md 里的行号（报错定位用）。
 */
export function parseTimelineYaml(text, baseLine = 1) {
  // 2.1 逐行 tokenize（跳过空行/纯注释行；禁 tab 缩进）
  const toks = [];
  const rawLines = text.split("\n");
  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNo = baseLine + idx;
    const raw = rawLines[idx];
    if (/^\s*$/.test(raw)) continue;
    if (/^ *\t/.test(raw))
      throw new PlanError(`第 ${lineNo} 行：缩进包含 tab，请用空格`);
    const stripped = stripComment(raw);
    if (/^\s*$/.test(stripped)) continue;
    const indent = /^ */.exec(stripped)[0].length;
    let body = stripped.slice(indent);
    // 2.2 展开列表项：`- key: v` → 独立的 `-` 标记 + 深一层的 `key: v`
    if (body === "-") {
      toks.push({ indent, item: true, text: "", lineNo });
    } else if (body.startsWith("- ")) {
      const rest = body.slice(2).replace(/^ +/, "");
      const off = body.length - rest.length;
      toks.push({ indent, item: true, text: "", lineNo });
      toks.push({ indent: indent + off, item: false, text: rest, lineNo });
    } else {
      toks.push({ indent, item: false, text: body, lineNo });
    }
  }
  if (toks.length === 0) throw new PlanError("```timeline 块是空的");

  // 2.3 递归下降
  let i = 0;

  function parseSeq(indent) {
    const arr = [];
    while (i < toks.length && toks[i].indent === indent && toks[i].item) {
      const marker = toks[i];
      i++;
      if (i < toks.length && toks[i].indent > indent && !toks[i].item) {
        arr.push(parseMap(toks[i].indent));
      } else {
        throw new PlanError(
          `第 ${marker.lineNo} 行：列表项必须是 \`- key: value\` 映射`,
        );
      }
    }
    return arr;
  }

  function parseMap(indent) {
    const obj = {};
    const lines = {};
    while (i < toks.length && toks[i].indent === indent && !toks[i].item) {
      const t = toks[i];
      const m = /^([A-Za-z_][\w-]*)\s*:(?:\s+(.*))?$/.exec(t.text);
      if (!m)
        throw new PlanError(
          `第 ${t.lineNo} 行：解析不了（期待 \`key: value\`）：${t.text}`,
        );
      const key = m[1];
      if (Object.prototype.hasOwnProperty.call(obj, key))
        throw new PlanError(`第 ${t.lineNo} 行：重复的 key \`${key}\``);
      const val = m[2];
      lines[key] = t.lineNo;
      i++;
      if (val !== undefined && val.trim() !== "") {
        obj[key] = unquote(val);
      } else if (i < toks.length && toks[i].indent > indent) {
        obj[key] = toks[i].item ? parseSeq(toks[i].indent) : parseMap(toks[i].indent);
      } else {
        obj[key] = "";
      }
    }
    Object.defineProperty(obj, "__lines", { value: lines, enumerable: false });
    return obj;
  }

  if (toks[0].item)
    throw new PlanError(
      `第 ${toks[0].lineNo} 行：顶层必须是映射（audio/duration/parts/chapters），不能直接是列表`,
    );
  const root = parseMap(toks[0].indent);
  if (i < toks.length)
    throw new PlanError(
      `第 ${toks[i].lineNo} 行：缩进对不上，这一行没法归属到任何结构`,
    );
  return root;
}

/* ─────────────────────── 3. CSS 前缀分配 ─────────────────────── */

/**
 * 章 id → CSS 类名前缀：单段取前 2 字母；多段取各段首字母（skills-path → sp）；
 * 冲突时依次加长；仍冲突则兜底追加章号。
 */
export function allocPrefixes(ids) {
  const taken = new Set();
  const out = new Map();
  ids.forEach((id, idx) => {
    const segs = id.split("-").filter(Boolean);
    const cands = [];
    if (segs.length <= 1) {
      const s = segs[0] ?? id;
      if (s.length < 2) cands.push(s);
      for (let k = 2; k <= s.length; k++) cands.push(s.slice(0, k));
    } else {
      const maxLen = Math.max(...segs.map((s) => s.length));
      for (let k = 1; k <= maxLen; k++) {
        const c = segs.map((s) => s.slice(0, Math.min(k, s.length))).join("");
        if (cands[cands.length - 1] !== c) cands.push(c);
      }
    }
    let px = cands.find((c) => c && !taken.has(c));
    if (!px) px = `${cands[cands.length - 1] ?? id}${String(idx + 1).padStart(2, "0")}`;
    taken.add(px);
    out.set(id, px);
  });
  return out;
}

/* ─────────────────────── 4. 语义校验 + 建模 ─────────────────────── */

const EPS = 1e-6;
const TOP_KEYS = new Set(["audio", "duration", "parts", "chapters", "srt"]);
const PART_KEYS = new Set(["id", "label", "start", "end"]);
const CH_KEYS = new Set(["id", "title", "steps"]);
const STEP_KEYS = new Set(["at", "vo", "do", "scene", "screen"]);

function pascal(id) {
  return id
    .split("-")
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
}

function lineOf(obj, key) {
  return obj && obj.__lines && obj.__lines[key] ? `（第 ${obj.__lines[key]} 行）` : "";
}

/**
 * raw（parseTimelineYaml 的输出）→ model 或 { errors }。
 * model = { mode: "vo"|"tts", audio, duration, parts, chapters, timeline }
 */
export function buildModel(raw) {
  const errors = [];
  const err = (msg) => errors.push(msg);

  for (const k of Object.keys(raw))
    if (!TOP_KEYS.has(k)) err(`未知的顶层字段 \`${k}\`${lineOf(raw, k)}（只认 audio/duration/parts/chapters/srt）`);
  if ("parts" in raw && !Array.isArray(raw.parts))
    err(`parts 必须是列表（\`- id: …\` 项）${lineOf(raw, "parts")}`);

  const num = (v, what, where) => {
    if (typeof v !== "string" || v.trim() === "" || !Number.isFinite(Number(v))) {
      err(`${what} 必须是数字，拿到 \`${v}\`${where}`);
      return NaN;
    }
    return Number(v);
  };

  // ── chapters / steps 结构 ──
  const chaptersRaw = raw.chapters;
  if (!Array.isArray(chaptersRaw) || chaptersRaw.length === 0) {
    err("chapters 必须是非空列表");
    return { errors };
  }

  const chapters = [];
  const seenIds = new Set();
  let globalIdx = 0;
  let atCount = 0;
  let stepCount = 0;

  chaptersRaw.forEach((chRaw, ci) => {
    for (const k of Object.keys(chRaw))
      if (!CH_KEYS.has(k)) err(`chapters[${ci}] 未知字段 \`${k}\`${lineOf(chRaw, k)}（只认 id/title/steps）`);
    const id = typeof chRaw.id === "string" ? chRaw.id : "";
    if (!/^[a-z][a-z0-9-]*$/.test(id))
      err(`chapters[${ci}] 的 id \`${id}\` 非法（小写字母开头，只能 [a-z0-9-]，会成为目录名和 CSS 前缀）`);
    if (seenIds.has(id)) err(`章 id \`${id}\` 重复`);
    seenIds.add(id);
    const title = typeof chRaw.title === "string" ? chRaw.title.trim() : "";
    if (!title) err(`章 \`${id || `#${ci + 1}`}\` 缺 title`);
    const stepsRaw = chRaw.steps;
    const steps = [];
    if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
      err(`章 \`${id || `#${ci + 1}`}\` 的 steps 必须是非空列表`);
    } else {
      stepsRaw.forEach((sRaw, si) => {
        for (const k of Object.keys(sRaw))
          if (!STEP_KEYS.has(k)) err(`章 \`${id}\` step[${si}] 未知字段 \`${k}\`${lineOf(sRaw, k)}（只认 at/vo/do/scene/screen）`);
        if (!("vo" in sRaw)) err(`章 \`${id}\` step[${si}] 缺 vo（静默步请写 vo: ""）`);
        let at;
        if ("at" in sRaw) {
          at = num(sRaw.at, `章 \`${id}\` step[${si}] 的 at`, lineOf(sRaw, "at"));
          atCount++;
        }
        steps.push({
          at,
          vo: typeof sRaw.vo === "string" ? sRaw.vo : "",
          do: typeof sRaw.do === "string" ? sRaw.do : "",
          scene: typeof sRaw.scene === "string" ? sRaw.scene : "",
          screen: typeof sRaw.screen === "string" ? sRaw.screen : "",
          globalIndex: globalIdx++,
        });
        stepCount++;
      });
    }
    const nn = String(ci + 1).padStart(2, "0");
    chapters.push({ nn, id, title, dir: `${nn}-${id}`, comp: pascal(id), steps });
  });

  // ── 模式判定 ──
  const srt = typeof raw.srt === "string" ? raw.srt.trim() : "";
  if ("srt" in raw && !srt) err("srt 路径不能为空");
  const hasAudio = "audio" in raw;
  const hasDuration = "duration" in raw;
  let mode;
  if (hasAudio || hasDuration || atCount > 0) {
    mode = "vo";
    if (!hasAudio) err("VO-First 需要 audio 字段（public/ 下的整段口播路径）");
    if (!hasDuration) err("VO-First 需要 duration 字段（ffprobe 实测整段秒数）");
    if (atCount < stepCount)
      err(`VO-First 模式下每步都要有 at（现在 ${stepCount} 步只有 ${atCount} 个 at）；纯 TTS 请去掉 audio/duration 和所有 at`);
  } else {
    mode = "tts";
    if ("srt" in raw) err("srt 需要 VO-First 的 audio/duration/at");
    if (Array.isArray(raw.parts) && raw.parts.length > 0)
      err("TTS 路径（无 at / 无 audio）不支持 parts —— parts 需要绝对时间");
  }

  const audio = typeof raw.audio === "string" ? raw.audio.trim() : "";
  if (mode === "vo" && hasAudio && !audio) err("audio 不能为空");
  const duration = hasDuration ? num(raw.duration, "duration", lineOf(raw, "duration")) : NaN;

  if (errors.length) return { errors };

  // ── TTS 到此为止 ──
  if (mode === "tts") return { errors, mode, chapters };

  // ── VO：at 升序 + parts 几何 ──
  const flat = chapters.flatMap((c) => c.steps);
  const timeline = flat.map((s) => s.at);
  if (timeline.some(t => t < 0)) err("at 不得为负数");
  for (let g = 1; g < timeline.length; g++) {
    if (!(timeline[g] > timeline[g - 1] + EPS))
      err(`at 必须全局严格升序：第 ${g} 个 step 的 at=${timeline[g]} ≤ 前一个的 ${timeline[g - 1]}`);
  }
  if (!(duration > timeline[timeline.length - 1]))
    err(`duration=${duration} 必须大于最后一步的 at=${timeline[timeline.length - 1]}`);
  if (errors.length) return { errors };

  let parts;
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) {
    parts = [
      {
        id: "full",
        label: "全片",
        start: timeline[0],
        end: duration,
        firstStep: 0,
        lastStep: timeline.length - 1,
      },
    ];
  } else {
    parts = raw.parts.map((pRaw, pi) => {
      for (const k of Object.keys(pRaw))
        if (!PART_KEYS.has(k)) err(`parts[${pi}] 未知字段 \`${k}\`${lineOf(pRaw, k)}（只认 id/label/start/end）`);
      const id = typeof pRaw.id === "string" ? pRaw.id.trim() : "";
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err(`parts[${pi}] 的 id \`${id}\` 非法（会进 URL ?part=）`);
      return {
        id,
        label: typeof pRaw.label === "string" && pRaw.label.trim() ? pRaw.label.trim() : id,
        start: num(pRaw.start, `parts[${pi}].start`, lineOf(pRaw, "start")),
        end: num(pRaw.end, `parts[${pi}].end`, lineOf(pRaw, "end")),
        firstStep: -1,
        lastStep: -1,
      };
    });
    const pids = new Set();
    for (const p of parts) {
      if (pids.has(p.id)) err(`part id \`${p.id}\` 重复`);
      pids.add(p.id);
    }
    if (errors.length) return { errors };

    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      if (!(p.end > p.start)) err(`part \`${p.id}\`：end=${p.end} 必须大于 start=${p.start}`);
      if (p.end > duration + EPS) err(`part \`${p.id}\`：end=${p.end} 超过 duration=${duration}`);
      if (pi > 0 && !(p.start >= parts[pi - 1].end - EPS))
        err(`parts 必须按时间升序且不重叠：\`${p.id}\`.start=${p.start} 落在上一区间 \`${parts[pi - 1].id}\` 结束（${parts[pi - 1].end}）之前`);
      const first = timeline.findIndex((t) => Math.abs(t - p.start) < EPS);
      if (first === -1) {
        err(`part \`${p.id}\`：start=${p.start} 没有落在任何 step 的 at 上（end 不用对齐 at，start 必须）`);
        continue;
      }
      p.firstStep = first;
      let last = first;
      while (last + 1 < timeline.length && timeline[last + 1] < p.end - EPS) last++;
      p.lastStep = last;
    }
    if (!errors.length) {
      // 每个 step 必须恰好被一个 part 覆盖，否则自动录制会静默跳过它
      flat.forEach((s, g) => {
        const inside = parts.some((p) => p.start - EPS <= s.at && s.at < p.end - EPS);
        if (!inside)
          err(`全局 step ${g}（at=${s.at}）不在任何 part 区间内 —— 录制时它永远不会出现；调整 parts 边界或删掉这一步`);
      });
    }
  }
  if (errors.length) return { errors };

  // ── 每章的全局范围 / 每步时长（跨 part 边界时用 part.end 截断） ──
  const partOf = (g) =>
    parts.find((p) => p.firstStep <= g && g <= p.lastStep);
  flat.forEach((s, g) => {
    const p = partOf(g);
    const nxt = g + 1 < flat.length ? flat[g + 1] : null;
    s.end = nxt && partOf(g + 1) === p ? nxt.at : p.end;
    s.durationSec = s.end - s.at;
  });
  for (const ch of chapters) {
    ch.firstGlobal = ch.steps[0].globalIndex;
    ch.lastGlobal = ch.steps[ch.steps.length - 1].globalIndex;
    ch.startAbs = ch.steps[0].at;
    ch.endAbs = ch.steps[ch.steps.length - 1].end;
  }

  return { errors, mode, audio, duration, parts, chapters, timeline, srt };
}

/* ─────────────────────── 5. 代码/文档 生成 ─────────────────────── */

const nstr = (n) => String(n);

export function emitTimelineTs(model) {
  const rows = model.chapters
    .map(
      (ch) =>
        `  /* ${ch.nn} ${ch.id} · step ${ch.firstGlobal}–${ch.lastGlobal} */ ${ch.steps
          .map((s) => nstr(s.at))
          .join(", ")},`,
    )
    .join("\n");
  const partRows = model.parts
    .map(
      (p) => `  ${JSON.stringify(p.id)}: {
    id: ${JSON.stringify(p.id)},
    label: ${JSON.stringify(p.label)},
    start: ${nstr(p.start)},
    end: ${nstr(p.end)},
    firstStep: ${p.firstStep},
    lastStep: ${p.lastStep},
  },`,
    )
    .join("\n");

  return `/**
 * VO-First 绝对时间轴 —— AUTO-GENERATED by scripts/gen-timeline.mjs，别手改。
 * 数据源：plan.md 的 \`\`\`timeline 块。要改：改 plan.md → \`npm run gen\`。
 *
 * 机制：录制态（?auto=1）播放整段原声 VO_FULL_SRC（一刀不切），每帧读
 * audio.currentTime，跨过 TIMELINE 某步的绝对起始秒就翻页 —— 零割裂、零漂移。
 * 多区间（补拍）：\`?part=<id>\` 选区间，整段音频 seek 到 start、播到 end 自动停。
 *
 * ⚠️ TIMELINE.length（${model.timeline.length}）必须 === 所有章节 narrations.length 之和（\`npm run check\` 会验）。
 */

/** true = 已由 plan.md 生成，App 的 auto 模式走整段原声驱动。 */
export const TIMELINE_GENERATED: boolean = true;

/** 每个全局 step 的绝对起始秒（升序，长度 = 全片总 step 数）。 */
export const TIMELINE: number[] = [
${rows}
];

/** 整段口播音频（public/ 下相对路径，原片音轨一字节不改）。 */
export const VO_FULL_SRC = ${JSON.stringify(model.audio)};
/** ffprobe 实测整段时长（秒）。 */
export const VO_FULL_DURATION = ${nstr(model.duration)};

export interface PartDef {
  id: string;
  /** 区间标签（AutoStartGate / 开发态 HUD 显示）。 */
  label: string;
  /** 绝对起播秒。 */
  start: number;
  /** 绝对停止秒 —— 播到这里自动暂停，录屏可以停了。 */
  end: number;
  /** 本区间第一个全局 step 下标（TIMELINE 的索引）。 */
  firstStep: number;
  /** 本区间最后一个全局 step 下标。 */
  lastStep: number;
}

export const PARTS: Record<string, PartDef> = {
${partRows}
};

/** 从 URL 读 \`?part=<id>\`；缺省 / 未知 id = 第一个区间。 */
export function readPart(): PartDef {
  const ids = Object.keys(PARTS);
  const first =
    ids.length > 0
      ? PARTS[ids[0]!]!
      : {
          id: "full",
          label: "全片",
          start: 0,
          end: VO_FULL_DURATION,
          firstStep: 0,
          lastStep: Math.max(0, TIMELINE.length - 1),
        };
  if (typeof window === "undefined") return first;
  const q = new URLSearchParams(window.location.search).get("part");
  if (!q) return first;
  const hit = PARTS[q];
  if (!hit) {
    console.warn(\`unknown ?part=\${q} — falling back to "\${first.id}"\`);
    return first;
  }
  return hit;
}

/** 把绝对秒格式化成 \`m:ss.f\`，开发态标注用。 */
export function fmtAbs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return \`\${m}:\${s.toFixed(1).padStart(4, "0")}\`;
}
`;
}

export function emitNarrations(model, ch) {
  const body = ch.steps
    .map((s, i) => {
      const tag =
        model.mode === "vo"
          ? `  // step ${i} · ${s.at.toFixed(3)}s${s.vo === "" ? "（静默步）" : ""}`
          : `  // step ${i}${s.vo === "" ? "（静默步）" : ""}`;
      return `${tag}\n  ${JSON.stringify(s.vo)},`;
    })
    .join("\n");
  return `import type { Narration } from "../../registry/types";

/**
 * 章 ${ch.nn} ${ch.id} 每步口播 —— 由 gen-timeline.mjs 从 plan.md 生成一次。
 * 长度 === 本章 step 数（\`npm run check\` 会校验）。VO 原文锁定；TTS 可改稿；
 * 增删条目必须回 plan.md 改，再 \`npm run gen\`（本文件已存在时 gen 不覆盖）。
 */
export const narrations: Narration[] = [
${body}
];
`;
}

const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

export function emitBrief(model, ch, prefixes, note = "") {
  const px = prefixes.get(ch.id);
  const vo = model.mode === "vo";
  const head = vo
    ? `全局 step ${ch.firstGlobal}–${ch.lastGlobal} · 绝对 ${ch.startAbs.toFixed(3)}s → ${ch.endAbs.toFixed(3)}s · 共 ${ch.steps.length} 步 · CSS 前缀 \`.${px}-\``
    : `全局 step ${ch.steps[0].globalIndex}–${ch.steps[ch.steps.length - 1].globalIndex} · 共 ${ch.steps.length} 步 · CSS 前缀 \`.${px}-\``;

  const tableHead = vo
    ? `| step | 绝对起点 | 时长 | 口播（vo） | 画面（do） |\n|---|---|---|---|---|`
    : `| step | 口播（vo） | 画面（do） |\n|---|---|---|`;
  const tableRows = ch.steps
    .map((s, i) => {
      const voCell = s.vo === "" ? "（静默）" : esc(s.vo);
      const doCell = s.do === "" ? "—" : esc(s.do);
      return vo
        ? `| ${i} | ${s.at.toFixed(3)} | ${s.durationSec.toFixed(2)}s | ${voCell} | ${doCell} |`
        : `| ${i} | ${voCell} | ${doCell} |`;
    })
    .join("\n");

  const prefixRows = model.chapters
    .map((c) => `| ${c.nn} ${c.id}${c.id === ch.id ? "（本章）" : ""} | \`.${prefixes.get(c.id)}-\` |`)
    .join("\n");

  const delayRule = vo
    ? "- 颜色/字体家族只用 token；固定 px 禁 vw；无定时器；重要 MG 用 timing.ts + 音频时钟采样；CSS 入场只作局部补充。信息落点跟 cue，留阅读停顿"
    : "- 颜色/字体家族只用 token；固定 px 禁 vw；无定时器；先合成样段定节奏；无 SRT 的 time 只作预览估时，动画不可越过真实音频边界";

  return `# 章 ${ch.nn} · ${ch.id} —— ${ch.title}

${head}

> 本卡由 \`npm run gen\` 从 plan.md 生成（每次覆写，别在这里累积手工笔记）。

${tableHead}
${tableRows}

## 前缀分配表（全项目，勿撞）

| 章 | CSS 前缀 |
|---|---|
${prefixRows}

## 事实与术语

先读 [全片核实记录](../../registry/FACTS.md)，核对本章相关条目。未核实/推断状态必须保留；不得只看画面创意猜数据。

## 镜头契约

| step | 连续场景 | 上屏短语 |
|---|---|---|
${ch.steps.map((s, i) => `| ${i} | ${esc(s.scene || ch.id)} | ${esc(s.screen || "见画面备注；先提炼，不复制口播")} |`).join("\n")}

## 铁律（全文见 skill references/CRAFT.md，先读它再动工）

- 文件只写 ${ch.dir}/ 下三件：${ch.comp}.tsx / ${ch.comp}.css / narrations.ts（已生成；VO 原文锁定，TTS 可改稿；长度不许变）
${delayRule}
- 安全区（若 App 配置了）：右上头像圆 + 底部字幕带几何判据见 CRAFT.md
- 同一 scene 跨 step 保留主体；do 写起态→动作→终态；屏幕短语见下表，不复述 vo
- timing.ts 时间均为章内秒；cue 原文来自 SRT（若提供），不要按字数估时
- 完工 = npm run check 全绿 + Ego Browser 起/中/末帧与相邻转场 + 连续播放 → 汇报
${note ? `
## 画面备注（plan.md「章节画面备注 · ${ch.id}」原文，改备注请回 plan.md 再重 gen）

${note}
` : ""}`;
}

/* ─────────────────────── 6. 落盘 + 提醒 ─────────────────────── */

/** 数 narrations.ts 里数组顶层的字符串字面量个数（跳过注释）。 */
export function countNarrationStrings(src) {
  // 定位 `narrations … = [` 里赋值号后的那个 `[`（跳过类型注解 Narration[] 的方括号）
  const m = /\bconst\s+narrations\b[^=]*=/.exec(src);
  if (!m) return -1;
  const start = src.indexOf("[", m.index + m[0].length);
  if (start === -1) return -1;
  let depth = 0;
  let count = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) break;
    } else if (c === '"' || c === "'" || c === "`") {
      if (depth === 1) count++;
      const q = c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") i++;
        i++;
      }
    }
  }
  return count;
}

function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(scriptPath), "..");
  const planPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(projectRoot, "../plan.md");

  if (!fs.existsSync(planPath)) {
    console.error(`✗ 找不到 plan：${planPath}`);
    console.error("  用法：npm run gen [-- path/to/plan.md]（默认读项目上一级的 plan.md）");
    process.exit(1);
  }

  let model;
  let notes = new Map();
  let facts = "";
  try {
    const md = fs.readFileSync(planPath, "utf8");
    const block = extractTimelineBlock(md);
    const raw = parseTimelineYaml(block.text, block.startLine);
    model = buildModel(raw);
    notes = extractChapterNotes(md);
    const shared = extractSection(md, "全片视觉约定");
    facts = [extractSection(md, "术语锁定表"), extractSection(md, "事实核实记录")].filter(Boolean).join("\n\n");
    if (shared) for (const ch of model.chapters || []) notes.set(ch.id, `${shared}\n\n${notes.get(ch.id) || ""}`);
  } catch (e) {
    if (e instanceof PlanError) {
      console.error(`✗ plan 解析失败（${planPath}）：`);
      console.error(`  ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
  if (model.errors.length) {
    console.error(`✗ plan 校验未过（${model.errors.length} 处），一个文件都没写：`);
    for (const m of model.errors) console.error(`  • ${m}`);
    process.exit(1);
  }

  const cueWarnings = [];
  if (model.mode === "vo" && model.srt) {
    try {
      const cues = parseSrt(fs.readFileSync(path.resolve(path.dirname(planPath), model.srt), "utf8"));
      cueWarnings.push(...attachCues(model, cues));
    } catch (e) {
      console.error(`✗ SRT 读取失败，一个文件都没写：${e.message}`);
      process.exit(1);
    }
  }
  const prefixes = allocPrefixes(model.chapters.map((c) => c.id));

  // 先全部构造，再落盘（构造期任何异常都不会留半成品）
  const writes = [{file: path.join(projectRoot, "src/registry/FACTS.md"), content: `# 全片事实与术语\n\n来源：${planPath}。由 gen 生成，不在这里手改。\n\n${facts || "计划未提供事实/术语记录。不能据此宣称已核实；开发时回查用户素材并补充 plan。"}\n`}];
  const skips = [];
  const warns = [...cueWarnings];
  if (model.mode === "vo") {
    writes.push({
      file: path.join(projectRoot, "src/registry/timeline.ts"),
      content: emitTimelineTs(model),
    });
  }
  for (const ch of model.chapters) {
    const dir = path.join(projectRoot, "src/chapters", ch.dir);
    const narrPath = path.join(dir, "narrations.ts");
    if (model.mode === "vo") writes.push({file: path.join(dir, "timing.ts"), content: emitTiming(ch)});
    if (fs.existsSync(narrPath)) {
      skips.push(narrPath);
      const n = countNarrationStrings(fs.readFileSync(narrPath, "utf8"));
      if (n !== ch.steps.length)
        warns.push(
          `章 ${ch.dir} 的 narrations.ts 已存在但长度 ${n} ≠ plan 的 ${ch.steps.length} —— npm run check 会 FAIL，请手动对齐（或删掉该文件重跑 gen）`,
        );
    } else {
      writes.push({ file: narrPath, content: emitNarrations(model, ch) });
    }
    writes.push({
      file: path.join(dir, "BRIEF.md"),
      content: emitBrief(model, ch, prefixes, notes.get(ch.id) ?? ""),
    });
  }

  if (model.mode === "vo") {
    const audioPath = path.join(projectRoot, "public", model.audio);
    if (!fs.existsSync(audioPath))
      warns.push(
        `public/${model.audio} 不存在 —— 把整段口播拷进来（原件先另存备份），否则 ?auto=1 起播 404`,
      );
  }

  for (const w of writes) {
    fs.mkdirSync(path.dirname(w.file), { recursive: true });
    fs.writeFileSync(w.file, w.content);
  }

  const rel = (p) => path.relative(projectRoot, p);
  console.log(`✓ ${model.mode === "vo" ? "VO-First" : "TTS"} · ${model.chapters.length} 章 / ${model.chapters.reduce((s, c) => s + c.steps.length, 0)} 步${model.mode === "vo" ? ` · ${model.parts.length} 个录制区间` : "（无 at/audio → 跳过 timeline.ts，音频走 extract-narrations 流程）"}`);
  for (const w of writes) console.log(`  写入 ${rel(w.file)}`);
  for (const s of skips) console.log(`  跳过 ${rel(s)}（已存在，保留现有内容；VO 须核对原稿）`);
  for (const w of warns) console.log(`  ⚠ ${w}`);

  console.log("\nCSS 前缀分配（已写进各章 BRIEF.md）：");
  for (const ch of model.chapters) console.log(`  ${ch.nn} ${ch.id} → .${prefixes.get(ch.id)}-`);

  // chapters.ts 注册检查（只提醒，不自动改）
  const regPath = path.join(projectRoot, "src/registry/chapters.ts");
  const regSrc = fs.existsSync(regPath) ? fs.readFileSync(regPath, "utf8") : "";
  const unregistered = model.chapters.filter(
    (ch) => !new RegExp(`id:\\s*["']${ch.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(regSrc),
  );
  if (unregistered.length) {
    console.log("\n▸ 以下章节还没在 src/registry/chapters.ts 注册（不自动改，请手动加）：");
    for (const ch of unregistered) {
      console.log(`  import ${ch.comp} from "../chapters/${ch.dir}/${ch.comp}";`);
      console.log(`  import { narrations as ${ch.comp[0].toLowerCase() + ch.comp.slice(1)}Narrations } from "../chapters/${ch.dir}/narrations";`);
      console.log(`  { id: "${ch.id}", title: ${JSON.stringify(ch.title)}, narrations: ${ch.comp[0].toLowerCase() + ch.comp.slice(1)}Narrations, Component: ${ch.comp} },`);
    }
  }

  console.log("\n⚠ 章节结构变更后记得 bump src/hooks/useStepper.ts 的 STORAGE_KEY（…-vN → vN+1）。");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
