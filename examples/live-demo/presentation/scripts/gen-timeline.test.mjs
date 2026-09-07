#!/usr/bin/env node
/**
 * gen-timeline.test.mjs —— gen-timeline.mjs 的 fixture 测试（手写 YAML 子集解析器
 * 必须配测试）。零依赖，直接跑：`node scripts/gen-timeline.test.mjs`。
 * 全过打印 "ok"，任何断言失败非零退出。
 */

import assert from "node:assert/strict";
import {
  PlanError,
  allocPrefixes,
  buildModel,
  countNarrationStrings,
  emitBrief,
  extractSection,
  emitNarrations,
  emitTimelineTs,
  extractChapterNotes,
  extractTimelineBlock,
  parseTimelineYaml,
} from "./gen-timeline.mjs";

let n = 0;
function t(name, fn) {
  n++;
  try {
    fn();
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
  console.log(`✓ ${name}`);
}

/* ────────────── fixtures ────────────── */

const GOOD_BLOCK = `audio: audio/vo-full.mp3        # public/ 下相对路径
duration: 60

parts:
  - id: a
    label: 开场 + 论点
    start: 1.0
    end: 20.5
  - id: b
    start: 40.0
    end: 58.0

chapters:
  - id: hook
    title: 开场钩子
    steps:
      - at: 1.0
        vo: 第一句 / 第二句连着说
        do: 大字标题浮现
      - at: 6.5
        vo: 这里给出数据    # 行尾注释会被剥掉
        do: 数字滚动
      - at: 12.0
        vo: "带 # 号和 1:2 冒号的口播要加引号原样保留"
        do: 高亮条形图
  - id: key-points
    title: 三个论点
    steps:
      - at: 16.0
        vo: 论点一
        do: 卡片一入场
      - at: 18.2
        vo: ""
        do: 静默转场
  - id: outro
    title: 结论
    steps:
      - at: 40.0
        vo: 最后的结论
        do: 全屏收束
`;

const wrap = (body) => "# 计划\n\n```timeline\n" + body + "```\n\n后记\n";

function modelOf(body) {
  const md = wrap(body);
  const block = extractTimelineBlock(md);
  return buildModel(parseTimelineYaml(block.text, block.startLine));
}

/* ────────────── extractTimelineBlock ────────────── */

t("extract：取出唯一 timeline 块", () => {
  const b = extractTimelineBlock(wrap("audio: x\n"));
  assert.equal(b.text, "audio: x");
  assert.equal(b.startLine, 4);
});
t("extract：0 个块报错", () => {
  assert.throws(() => extractTimelineBlock("# 空\n"), PlanError);
});
t("extract：2 个块报错", () => {
  assert.throws(
    () => extractTimelineBlock(wrap("a: 1\n") + wrap("a: 1\n")),
    /2 个/,
  );
});
t("extract：未闭合报错", () => {
  assert.throws(() => extractTimelineBlock("```timeline\naudio: x\n"), /闭合/);
});

/* ────────────── parseTimelineYaml ────────────── */

t("parse：结构 / 注释 / 引号 / 空值", () => {
  const r = parseTimelineYaml(GOOD_BLOCK, 1);
  assert.equal(r.audio, "audio/vo-full.mp3"); // 行尾注释剥掉
  assert.equal(r.duration, "60");
  assert.equal(r.parts.length, 2);
  assert.deepEqual(
    { ...r.parts[0] },
    { id: "a", label: "开场 + 论点", start: "1.0", end: "20.5" },
  );
  assert.equal(r.chapters.length, 3);
  const s = r.chapters[0].steps;
  assert.equal(s[0].vo, "第一句 / 第二句连着说");
  assert.equal(s[1].vo, "这里给出数据");
  assert.equal(s[2].vo, "带 # 号和 1:2 冒号的口播要加引号原样保留");
  assert.equal(r.chapters[1].steps[1].vo, ""); // vo: "" → 空串
});
t("parse：tab 缩进报错", () => {
  assert.throws(() => parseTimelineYaml("chapters:\n\t- id: a\n", 1), /tab/);
});
t("parse：重复 key 报错", () => {
  assert.throws(
    () => parseTimelineYaml("audio: a\naudio: b\n", 1),
    /重复的 key/,
  );
});
t("parse：坏行报错并带行号", () => {
  assert.throws(() => parseTimelineYaml("audio: a\n随便一行\n", 5), /第 6 行/);
});
t("parse：顶层是列表报错", () => {
  assert.throws(() => parseTimelineYaml("- id: a\n", 1), /顶层必须是映射/);
});

/* ────────────── allocPrefixes ────────────── */

t("prefix：单段取前 2 字母、多段取首字母", () => {
  const p = allocPrefixes([
    "deepswe",
    "scores",
    "three-tasks",
    "skills-path",
    "verdict",
    "ban-wave",
    "my-stack",
    "kimi-k3",
    "outro",
  ]);
  assert.equal(p.get("deepswe"), "de");
  assert.equal(p.get("scores"), "sc");
  assert.equal(p.get("three-tasks"), "tt");
  assert.equal(p.get("skills-path"), "sp");
  assert.equal(p.get("kimi-k3"), "kk");
  assert.equal(p.get("outro"), "ou");
});
t("prefix：冲突依次加长", () => {
  const p = allocPrefixes(["verdict", "version", "verse"]);
  assert.equal(p.get("verdict"), "ve");
  assert.equal(p.get("version"), "ver");
  assert.equal(p.get("verse"), "vers");
});
t("prefix：多段冲突加长 + 兜底编号", () => {
  const p = allocPrefixes(["kimi-k3", "kimi-k9"]);
  assert.equal(p.get("kimi-k3"), "kk");
  assert.equal(p.get("kimi-k9"), "kik9");
  const q = allocPrefixes(["ab", "a-b"]); // a-b 的唯一候选 "ab" 已被占 → 兜底追加章号
  assert.equal(q.get("ab"), "ab");
  assert.equal(q.get("a-b"), "ab02");
});

/* ────────────── buildModel：VO happy path ────────────── */

t("model：双区间 firstStep/lastStep + 展平升序", () => {
  const m = modelOf(GOOD_BLOCK);
  assert.deepEqual(m.errors, []);
  assert.equal(m.mode, "vo");
  assert.deepEqual(m.timeline, [1, 6.5, 12, 16, 18.2, 40]);
  assert.equal(m.parts.length, 2);
  assert.deepEqual(
    m.parts.map((p) => [p.id, p.firstStep, p.lastStep]),
    [
      ["a", 0, 4],
      ["b", 5, 5],
    ],
  );
  assert.equal(m.parts[1].label, "b"); // label 缺省 = id
});
t("model：跨 part 边界的步长用 part.end 截断", () => {
  const m = modelOf(GOOD_BLOCK);
  const flat = m.chapters.flatMap((c) => c.steps);
  assert.ok(Math.abs(flat[4].durationSec - (20.5 - 18.2)) < 1e-9); // 区间 a 最后一步
  assert.ok(Math.abs(flat[5].durationSec - (58.0 - 40.0)) < 1e-9); // 区间 b 唯一步
  assert.equal(m.chapters[1].endAbs, 20.5);
});
t("model：省略 parts = 单区间全片（start=第一步 at，end=duration）", () => {
  const m = modelOf(
    "audio: a.mp3\nduration: 30\nchapters:\n  - id: solo\n    title: 单章\n    steps:\n      - at: 2.5\n        vo: 一\n      - at: 9\n        vo: 二\n",
  );
  assert.deepEqual(m.errors, []);
  assert.deepEqual(
    { ...m.parts[0] },
    { id: "full", label: "全片", start: 2.5, end: 30, firstStep: 0, lastStep: 1 },
  );
});

/* ────────────── buildModel：TTS ────────────── */

t("model：TTS（无 at / 无 audio）", () => {
  const m = modelOf(
    "chapters:\n  - id: solo\n    title: 单章\n    steps:\n      - vo: 一\n        do: 画面一\n      - vo: 二\n",
  );
  assert.deepEqual(m.errors, []);
  assert.equal(m.mode, "tts");
  assert.equal(m.chapters[0].steps.length, 2);
});
t("model：TTS 带 parts 报错", () => {
  const m = modelOf(
    "parts:\n  - id: a\n    start: 0\n    end: 1\nchapters:\n  - id: solo\n    title: 单章\n    steps:\n      - vo: 一\n",
  );
  assert.ok(m.errors.some((e) => e.includes("TTS")));
});

/* ────────────── buildModel：负例 ────────────── */

const BAD = (patch) => {
  const m = modelOf(patch);
  assert.ok(m.errors.length > 0, "应该报错但没有");
  return m.errors.join("\n");
};

t("负例：at 乱序", () => {
  const e = BAD(
    "audio: a.mp3\nduration: 30\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 9\n        vo: 一\n      - at: 2\n        vo: 二\n",
  );
  assert.match(e, /严格升序/);
});
t("负例：part.start 不落在任何 at 上", () => {
  const e = BAD(
    "audio: a.mp3\nduration: 30\nparts:\n  - id: a\n    start: 3\n    end: 30\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 2.5\n        vo: 一\n",
  );
  assert.match(e, /没有落在任何 step 的 at 上/);
});
t("负例：step 不被任何 part 覆盖", () => {
  const e = BAD(
    "audio: a.mp3\nduration: 30\nparts:\n  - id: a\n    start: 1\n    end: 5\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 1\n        vo: 一\n      - at: 8\n        vo: 二\n",
  );
  assert.match(e, /不在任何 part 区间内/);
});
t("负例：parts 重叠", () => {
  const e = BAD(
    "audio: a.mp3\nduration: 30\nparts:\n  - id: a\n    start: 1\n    end: 10\n  - id: b\n    start: 5\n    end: 20\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 1\n        vo: 一\n      - at: 5\n        vo: 二\n",
  );
  assert.match(e, /不重叠/);
});
t("负例：end 超 duration / 缺 duration / 混搭 at", () => {
  assert.match(
    BAD(
      "audio: a.mp3\nduration: 10\nparts:\n  - id: a\n    start: 1\n    end: 12\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 1\n        vo: 一\n",
    ),
    /超过 duration/,
  );
  assert.match(
    BAD(
      "audio: a.mp3\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 1\n        vo: 一\n",
    ),
    /duration/,
  );
  assert.match(
    BAD(
      "audio: a.mp3\nduration: 10\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 1\n        vo: 一\n      - vo: 二\n",
    ),
    /每步都要有 at/,
  );
});
t("负例：章 id 重复 / 非法 / 未知字段", () => {
  assert.match(
    BAD(
      "chapters:\n  - id: solo\n    title: 一\n    steps:\n      - vo: x\n  - id: solo\n    title: 二\n    steps:\n      - vo: y\n",
    ),
    /重复/,
  );
  assert.match(
    BAD("chapters:\n  - id: Bad_Id\n    title: 一\n    steps:\n      - vo: x\n"),
    /非法/,
  );
  assert.match(
    BAD(
      "typo: 1\nchapters:\n  - id: solo\n    title: 一\n    steps:\n      - vo: x\n",
    ),
    /未知的顶层字段/,
  );
  assert.match(
    BAD(
      "chapters:\n  - id: solo\n    title: 一\n    steps:\n      - vo: x\n        att: 1\n",
    ),
    /未知字段/,
  );
});
t("负例：duration ≤ 最后一步 at", () => {
  assert.match(
    BAD(
      "audio: a.mp3\nduration: 5\nchapters:\n  - id: solo\n    title: 单\n    steps:\n      - at: 9\n        vo: 一\n",
    ),
    /必须大于最后一步/,
  );
});

/* ────────────── emit / count ────────────── */

t("emit：timeline.ts 关键内容", () => {
  const m = modelOf(GOOD_BLOCK);
  const ts = emitTimelineTs(m);
  assert.match(ts, /TIMELINE_GENERATED: boolean = true/);
  assert.match(ts, /\/\* 01 hook · step 0–2 \*\/ 1, 6\.5, 12,/);
  assert.match(ts, /"a": \{/);
  assert.match(ts, /firstStep: 5,/);
  assert.match(ts, /VO_FULL_SRC = "audio\/vo-full\.mp3"/);
  assert.match(ts, /VO_FULL_DURATION = 60/);
});
t("emit：narrations 转义 + 静默步注释；count 数得对", () => {
  const m = modelOf(GOOD_BLOCK);
  const src = emitNarrations(m, m.chapters[1]);
  assert.match(src, /step 1 · 18\.200s（静默步）/);
  assert.equal(countNarrationStrings(src), 2);
  const src0 = emitNarrations(m, m.chapters[0]);
  assert.ok(src0.includes(JSON.stringify("带 # 号和 1:2 冒号的口播要加引号原样保留")));
  assert.equal(countNarrationStrings(src0), 3);
});
t("emit：BRIEF 头行 / 表格 / 前缀表 / 铁律", () => {
  const m = modelOf(GOOD_BLOCK);
  const px = allocPrefixes(m.chapters.map((c) => c.id));
  const md = emitBrief(m, m.chapters[1], px);
  assert.match(md, /^# 章 02 · key-points —— 三个论点/);
  assert.match(md, /全局 step 3–4 · 绝对 16\.000s → 20\.500s · 共 2 步 · CSS 前缀 `\.kp-`/);
  assert.match(md, /\| 1 \| 18\.200 \| 2\.30s \| （静默） \| 静默转场 \|/);
  assert.match(md, /\| 01 hook \| `\.ho-` \|/);
  assert.match(md, /KeyPoints\.tsx \/ KeyPoints\.css \/ narrations\.ts/);
  assert.match(md, /npm run check 全绿/);
});

t("notes：提取「章节画面备注」的 ### 小节；无备注章缺席", () => {
  const md = [
    "# 某片 · plan",
    "",
    "## 章节画面备注",
    "### hook",
    "- 信息池：某数字 —— 来源：官方页",
    "- 素材：⚠️ 截图待提供",
    "### key-points",
    "",
    "## 术语锁定表",
    "### 不是备注的小节",
    "备注段之外的内容不该被收进去",
  ].join("\n");
  const notes = extractChapterNotes(md);
  assert.equal(notes.get("hook"), "- 信息池：某数字 —— 来源：官方页\n- 素材：⚠️ 截图待提供");
  assert.equal(notes.has("key-points"), false); // 空小节不产生条目
  assert.equal(notes.has("不是备注的小节"), false); // 别的 ## 段下的 ### 不收
});
t("notes：小节名带括号注也按 id 开头匹配", () => {
  const md = [
    "## 章节画面备注（自由文本）",
    "### deepswe（19.466–32.966，5 步，~13.5s）",
    "- 榜单横条群拎出主角",
    "### kimi-k3（277.066–305.685，6 步）",
    "- 全章不挂跑分",
  ].join("\n");
  const notes = extractChapterNotes(md);
  assert.equal(notes.get("deepswe"), "- 榜单横条群拎出主角");
  assert.equal(notes.get("kimi-k3"), "- 全章不挂跑分");
});
t("emit：BRIEF 尾部附画面备注；无备注不加空节", () => {
  const m = modelOf(GOOD_BLOCK);
  const px = allocPrefixes(m.chapters.map((c) => c.id));
  const withNote = emitBrief(m, m.chapters[0], px, "- 信息池：X —— 来源：Y");
  assert.match(withNote, /## 画面备注（plan\.md「章节画面备注 · hook」原文，改备注请回 plan\.md 再重 gen）/);
  assert.match(withNote, /- 信息池：X —— 来源：Y/);
  const without = emitBrief(m, m.chapters[0], px);
  assert.ok(!without.includes("## 画面备注"));
  assert.match(without, /npm run check 全绿 \+ 真实浏览器 .*连续播放 → 汇报\n$/);
});


t("sections: evidence/terms survive H2 extraction and are linked from brief", () => {
 const md = "## 术语锁定表\n| A | B |\n\n## 事实核实记录\n未核实数据\n## 后续\nexclude";
 assert.equal(extractSection(md, "事实核实记录"), "## 事实核实记录\n未核实数据");
 assert.equal(extractSection(md, "missing"), "");
 const m = modelOf(GOOD_BLOCK);
 assert.match(emitBrief(m, m.chapters[0], allocPrefixes(m.chapters.map(c=>c.id))), /registry\/FACTS.md/);
});

console.log(`\nok · ${n} 个测试全过`);
