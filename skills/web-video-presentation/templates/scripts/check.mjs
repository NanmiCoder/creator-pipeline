#!/usr/bin/env node
/**
 * check.mjs —— 红线 + 一致性，一条命令（`npm run check`）。任何 FAIL → 退出码 1。
 *
 * 逐项：
 *   1. npx tsc -b
 *   2. TIMELINE 严格升序；Σ narrations.length === TIMELINE.length（timeline 已生成时）
 *   3. 每章 narrations.length === 该章 .tsx 里 `step === N` / `step >= N` 的最大 N+1
 *   4. 章节 .css/.tsx 红线（逐行、剔除注释）：硬编码颜色 / font-family 不走 var() /
 *      vw/vh / setTimeout/setInterval / emoji / 跨章 import
 *   5. CSS 类前缀：每章与 BRIEF.md 分配一致（无 BRIEF 则按多数推断）、章间不冲突
 *   6. 提醒（不算 FAIL）：安全区无法静态检查 → 可用浏览器工具截关键帧确认
 *
 * Node ≥ 18，零第三方依赖。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chaptersRoot = path.join(root, "src/chapters");

/* ────────────── 结果收集 ────────────── */
const results = [];
function add(section, status, msg, details = []) {
  results.push({ section, status, msg, details });
}

/* ────────────── 工具：注释剥离（保行号） ────────────── */

/** JS/TSX：去 // 与 /* *​/ 注释（尊重字符串/模板字面量），注释字符替换为空格。 */
function stripJs(src) {
  let out = "";
  let state = "code"; // code | line | block | s1 | s2 | tpl
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (state === "code") {
      if (c === "/" && n === "/") {
        state = "line";
        out += "  ";
        i++;
      } else if (c === "/" && n === "*") {
        state = "block";
        out += "  ";
        i++;
      } else {
        if (c === "'") state = "s1";
        else if (c === '"') state = "s2";
        else if (c === "`") state = "tpl";
        out += c;
      }
    } else if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      } else out += " ";
    } else if (state === "block") {
      if (c === "*" && n === "/") {
        state = "code";
        out += "  ";
        i++;
      } else out += c === "\n" ? c : " ";
    } else {
      // 字符串态
      if (c === "\\") {
        out += c + (n ?? "");
        i++;
        continue;
      }
      if (
        (state === "s1" && c === "'") ||
        (state === "s2" && c === '"') ||
        (state === "tpl" && c === "`") ||
        (state !== "tpl" && c === "\n") // 未闭合就断行，回 code 防误吞全文件
      )
        state = "code";
      out += c;
    }
  }
  return out;
}

/** CSS：去 /* *​/ 注释，替换为空格（保行号）。 */
function stripCss(src) {
  let out = "";
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (!inBlock && c === "/" && n === "*") {
      inBlock = true;
      out += "  ";
      i++;
    } else if (inBlock && c === "*" && n === "/") {
      inBlock = false;
      out += "  ";
      i++;
    } else if (inBlock) {
      out += c === "\n" ? c : " ";
    } else {
      out += c;
    }
  }
  return out;
}

/** 数 narrations.ts 数组顶层字符串字面量个数。 */
function countNarrationStrings(src) {
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

/* ────────────── 工具：类名提取 ────────────── */

function cssClassTokens(css) {
  const clean = stripCss(css).replace(/url\([^)]*\)/g, "url()");
  const out = new Set();
  // 只看选择器段（{ 之前），避免把属性值里的内容当类名
  for (const m of clean.matchAll(/(^|[}\n])([^{}]*)\{/g)) {
    const sel = m[2];
    for (const cm of sel.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) out.add(cm[1]);
  }
  return out;
}

function tsxClassTokens(tsx) {
  const clean = stripJs(tsx);
  const out = new Set();
  for (const m of clean.matchAll(
    /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g,
  )) {
    let text = m[1] ?? m[2] ?? "";
    if (m[3] !== undefined) {
      // 表达式：抠出其中的字符串字面量内容
      text = [...m[3].matchAll(/["'`]([^"'`]*)["'`]/g)].map((x) => x[1]).join(" ");
    }
    for (let tok of text.split(/\s+/)) {
      tok = tok.trim();
      if (/^[A-Za-z_-][A-Za-z0-9_-]*$/.test(tok)) out.add(tok);
    }
  }
  return out;
}

/* ────────────── 章节发现 ────────────── */

function listDirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}
function listFiles(p, ext) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(ext))
      .map((d) => path.join(p, d.name))
      .sort();
  } catch {
    return [];
  }
}

const chapterDirs = listDirs(chaptersRoot).filter((d) =>
  fs.existsSync(path.join(chaptersRoot, d, "narrations.ts")),
);

/* ══════════ 1. tsc ══════════ */
{
  const r = spawnSync("npx", ["tsc", "-b"], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status === 0) add("tsc", "PASS", "npx tsc -b");
  else
    add(
      "tsc",
      "FAIL",
      "npx tsc -b 报错",
      `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(0, 30),
    );
}

/* ══════════ 2. TIMELINE ══════════ */
const narrCounts = new Map(); // dir → count
for (const d of chapterDirs) {
  const src = fs.readFileSync(path.join(chaptersRoot, d, "narrations.ts"), "utf8");
  const n = countNarrationStrings(src);
  if (n < 0) add("narrations", "FAIL", `${d}: narrations.ts 里解析不到 narrations 数组`);
  narrCounts.set(d, Math.max(0, n));
}
{
  const tlPath = path.join(root, "src/registry/timeline.ts");
  if (!fs.existsSync(tlPath)) {
    add("timeline", "SKIP", "没有 src/registry/timeline.ts —— 跳过时间轴检查");
  } else {
    const src = stripJs(fs.readFileSync(tlPath, "utf8"));
    const genM = /TIMELINE_GENERATED\s*(?::\s*boolean\s*)?=\s*(true|false)/.exec(src);
    const generated = genM ? genM[1] === "true" : true; // 找不到标记按已生成从严处理
    if (!generated) {
      add(
        "timeline",
        "SKIP",
        "timeline.ts 还是模板占位（TIMELINE_GENERATED=false）—— VO-First 请先 npm run gen；TTS 路径忽略",
      );
    } else {
      const am = /TIMELINE\s*:\s*number\[\]\s*=\s*\[([^\]]*)\]/.exec(src);
      if (!am) {
        add("timeline", "FAIL", "timeline.ts 里解析不到 TIMELINE 数组");
      } else {
        const nums = am[1]
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "")
          .map(Number);
        const badNum = nums.findIndex((n) => !Number.isFinite(n));
        let asc = true;
        const details = [];
        for (let i = 1; i < nums.length; i++)
          if (!(nums[i] > nums[i - 1])) {
            asc = false;
            details.push(`TIMELINE[${i}]=${nums[i]} ≤ TIMELINE[${i - 1}]=${nums[i - 1]}`);
          }
        if (badNum !== -1) add("timeline", "FAIL", `TIMELINE[${badNum}] 不是数字`);
        else if (!asc) add("timeline", "FAIL", "TIMELINE 不是严格升序", details);
        else add("timeline", "PASS", `TIMELINE 严格升序（${nums.length} 步）`);

        const sum = [...narrCounts.values()].reduce((a, b) => a + b, 0);
        if (sum === nums.length)
          add("timeline", "PASS", `Σ narrations（${sum}）=== TIMELINE.length（${nums.length}）`);
        else
          add(
            "timeline",
            "FAIL",
            `Σ narrations（${sum}）≠ TIMELINE.length（${nums.length}）`,
            [...narrCounts.entries()].map(([d, n]) => `${d}: ${n} 步`),
          );
      }
    }
  }
}

/* ══════════ 3. 每章 narrations ↔ .tsx step 分支 ══════════ */
for (const d of chapterDirs) {
  const dir = path.join(chaptersRoot, d);
  const tsxFiles = listFiles(dir, ".tsx");
  if (tsxFiles.length === 0) {
    add("steps", "SKIP", `${d}: 还没有 .tsx（未开发）`);
    continue;
  }
  let maxN = -1;
  for (const f of tsxFiles) {
    const clean = stripJs(fs.readFileSync(f, "utf8"));
    for (const m of clean.matchAll(/\bstep\s*(?:===|>=)\s*(\d+)/g))
      maxN = Math.max(maxN, Number(m[1]));
  }
  const n = narrCounts.get(d);
  if (maxN === -1) {
    add("steps", "SKIP", `${d}: .tsx 里没有 step === N / step >= N 字面量，无法静态核对（narrations ${n} 步）`);
  } else if (n === maxN + 1) {
    add("steps", "PASS", `${d}: narrations ${n} 步 === 最大 step 分支 ${maxN}+1`);
  } else {
    add(
      "steps",
      "FAIL",
      `${d}: narrations ${n} 步 ≠ .tsx 最大 step 分支 ${maxN}+1（漏写/多写分支，或 narrations 长度错；注意最后一步也要显式 step === N —— 隐式 else 静态数不出来）`,
    );
  }
}

/* ══════════ 4. 红线扫描 ══════════ */
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F/u;

for (const d of chapterDirs) {
  const dir = path.join(chaptersRoot, d);
  const files = [...listFiles(dir, ".css"), ...listFiles(dir, ".tsx")];
  const hits = [];
  for (const f of files) {
    const isCss = f.endsWith(".css");
    const raw = fs.readFileSync(f, "utf8");
    const clean = isCss ? stripCss(raw) : stripJs(raw);
    const lines = clean.split("\n");
    const base = path.basename(f);
    lines.forEach((line0, idx) => {
      const where = `${base}:${idx + 1}`;
      const line = line0.replace(/url\(#[^)]*\)/g, "url(#)"); // SVG 引用不算颜色
      if (/#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/.test(line) && /#[0-9a-fA-F]{3}/.test(line))
        hits.push(`${where} 硬编码颜色（hex）：${line.trim().slice(0, 80)}`);
      if (/\brgba?\s*\(|\bhsla?\s*\(/.test(line))
        hits.push(`${where} 硬编码颜色（rgb/hsl）：${line.trim().slice(0, 80)}`);
      const fm = isCss
        ? /font-family\s*:\s*([^;}]+)/.exec(line)
        : /fontFamily\s*:\s*['"`]([^'"`]*)['"`]/.exec(line);
      if (fm && !fm[1].trim().startsWith("var("))
        hits.push(`${where} font-family 没走 var(--font-*)：${fm[1].trim().slice(0, 60)}`);
      if (/\d(vw|vh)\b/.test(line))
        hits.push(`${where} 用了 vw/vh（舞台是固定 1920×1080 + transform scale，vw 会算错）`);
      if (/\bset(Timeout|Interval)\s*\(/.test(line))
        hits.push(`${where} 用了定时器（节拍必须由 step + CSS delay 驱动）`);
      if (EMOJI_RE.test(line)) hits.push(`${where} 出现 emoji`);
    });
    if (!isCss) {
      for (const m of clean.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g)) {
        const spec = m[1];
        for (const other of chapterDirs) {
          if (other !== d && spec.includes(`/${other}/`))
            hits.push(`${base} 跨章 import：${spec}（章之间禁止互相依赖）`);
        }
      }
    }
  }
  if (files.length === 0) add("redline", "SKIP", `${d}: 无 .css/.tsx`);
  else if (hits.length === 0) add("redline", "PASS", `${d}: 红线扫描干净（${files.length} 个文件）`);
  else add("redline", "FAIL", `${d}: ${hits.length} 处红线`, hits);
}

/* ══════════ 5. CSS 类前缀 ══════════ */
// 全局允许类：模板基建（src/styles + src/components）定义的类
const globalAllow = new Set();
for (const dir of [path.join(root, "src/styles"), path.join(root, "src/components")]) {
  for (const f of listFiles(dir, ".css"))
    for (const t of cssClassTokens(fs.readFileSync(f, "utf8"))) globalAllow.add(t);
}

const effectivePrefix = new Map(); // dir → prefix
for (const d of chapterDirs) {
  const dir = path.join(chaptersRoot, d);
  const own = new Set();
  for (const f of listFiles(dir, ".css"))
    for (const t of cssClassTokens(fs.readFileSync(f, "utf8"))) own.add(t);
  for (const f of listFiles(dir, ".tsx"))
    for (const t of tsxClassTokens(fs.readFileSync(f, "utf8"))) own.add(t);
  for (const g of globalAllow) own.delete(g);

  let assigned = null;
  const briefPath = path.join(dir, "BRIEF.md");
  if (fs.existsSync(briefPath)) {
    const m = /CSS 前缀 `\.([A-Za-z][A-Za-z0-9-]*)-`/.exec(
      fs.readFileSync(briefPath, "utf8"),
    );
    if (m) assigned = m[1];
  }
  if (!assigned) {
    // 无 BRIEF：按多数票推断前缀（首个 - 之前的段）
    const votes = new Map();
    for (const t of own) {
      const p = t.includes("-") ? t.slice(0, t.indexOf("-")) : t;
      votes.set(p, (votes.get(p) ?? 0) + 1);
    }
    assigned = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  if (own.size === 0) {
    add("prefix", "SKIP", `${d}: 没有本章自有类名`);
    continue;
  }
  if (!assigned) {
    add("prefix", "SKIP", `${d}: 推断不出前缀`);
    continue;
  }
  effectivePrefix.set(d, assigned);
  const bad = [...own].filter((t) => t !== assigned && !t.startsWith(`${assigned}-`));
  if (bad.length === 0)
    add("prefix", "PASS", `${d}: 类名统一走 .${assigned}-（${own.size} 个）`);
  else
    add(
      "prefix",
      "FAIL",
      `${d}: ${bad.length} 个类名不带本章前缀 .${assigned}-`,
      bad.map((t) => `.${t}`),
    );
}
{
  const seen = new Map();
  for (const [d, px] of effectivePrefix) {
    if (seen.has(px))
      add("prefix", "FAIL", `前缀 .${px}- 撞了：${seen.get(px)} 与 ${d}`);
    else seen.set(px, d);
  }
  if (effectivePrefix.size > 0 && ![...results].some((r) => r.section === "prefix" && r.status === "FAIL"))
    add("prefix", "PASS", "章间前缀无冲突");
}

/* ══════════ 输出 ══════════ */
const ICON = { PASS: "✓", FAIL: "✗", SKIP: "–" };
let fails = 0;
for (const r of results) {
  if (r.status === "FAIL") fails++;
  console.log(`${ICON[r.status]} [${r.section}] ${r.msg}`);
  const det = Array.isArray(r.details) ? r.details : [r.details];
  for (const dline of det.slice(0, 20)) if (dline) console.log(`    ${dline}`);
  if (det.length > 20) console.log(`    …（共 ${det.length} 条，截断）`);
}
console.log(
  `\n${fails === 0 ? "✓ 全绿" : `✗ ${fails} 项 FAIL`} · ${results.filter((r) => r.status === "PASS").length} PASS / ${results.filter((r) => r.status === "SKIP").length} SKIP`,
);
console.log(
  "ℹ 安全区（头像圆 / 底部字幕带）无法静态检查 —— 用可用浏览器工具按 1920×1080 舞台 截 2-3 张关键帧逐章确认（几何判据见 references/CRAFT.md）。",
);
process.exit(fails === 0 ? 0 : 1);
