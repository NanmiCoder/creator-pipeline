#!/usr/bin/env python3
"""把自媒体文案切成「章节 → 自然段 → 分段」，产出 segments.json。

一个分段 = 一次 TTS 调用 = 一条 SRT 字幕。三者一一对应，时间轴才能精确。

用法:
    python3 segment.py script.md -o segments.json [--voice VOICE_ID] [--max-chars 20]

输入可以是纯文本，也可以带明确的 Markdown 章节标题（## 标题）。
若文案已由上层做过语义分章，用 `--chapters chapters.json` 传入骨架，
格式: [{"title": "开场钩子", "text": "……"}, ...]
"""

import argparse
import hashlib
import math
import os
import json
import re
import sys
from pathlib import Path

# 句末标点：切分段的第一优先级
SENT_END = "。！？!?…～~"
# 次级标点：句子过长时的切分点
CLAUSE_END = "，、；：,;:—"
# 右侧成对标点，切分时应跟随前文
CLOSERS = '」』】》）)"\'”’…'

# 章节标记
# Only explicit Markdown headings are metadata. Numbered lists are spoken content.
CH_PATTERNS = [re.compile(r"^\s{0,3}#{1,4}\s+(.+?)\s*$")]



def width(s: str) -> float:
    """视觉宽度：中日韩字符算 1，ASCII 算 0.5。让「20 字」对中英混排也合理。"""
    w = 0.0
    for ch in s:
        w += 0.5 if ord(ch) < 0x2E80 else 1.0
    return w


def detect_chapter(line: str):
    """行是章节标题则返回标题文本，否则 None。"""
    stripped = line.strip()
    if not stripped or width(stripped) > 40:
        return None
    for pat in CH_PATTERNS:
        m = pat.match(line)
        if m:
            title = (m.group(1) or "").strip()
            return title or stripped
    return None


def split_sentences(text: str):
    """按句末标点切句，标点保留在句尾，右引号/右括号跟随。"""
    out, buf = [], ""
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        buf += ch
        if ch in SENT_END:
            # 吸收连续的句末标点（如 ！！！ 或 ？！）
            while i + 1 < n and text[i + 1] in SENT_END:
                i += 1
                buf += text[i]
            # 吸收右侧成对标点
            while i + 1 < n and text[i + 1] in CLOSERS:
                i += 1
                buf += text[i]
            if buf.strip():
                out.append(buf.strip())
            buf = ""
        i += 1
    if buf.strip():
        out.append(buf.strip())
    return out


def split_clauses(sentence: str):
    """按次级标点切子句，标点保留在子句尾。"""
    out, buf = [], ""
    for i, ch in enumerate(sentence):
        buf += ch
        if ch in CLAUSE_END:
            nxt = sentence[i + 1] if i + 1 < len(sentence) else ""
            if nxt in CLOSERS:
                continue
            if buf.strip():
                out.append(buf.strip())
            buf = ""
    if buf.strip():
        out.append(buf.strip())
    return out


# 英文单词、数字、版本号（GPT-4o、47.3%、1200ms）视为不可切分的原子
ATOM_RE = re.compile(r"[A-Za-z0-9]+(?:[.\-_/][A-Za-z0-9]+)*%?")


def atomize(text: str):
    """切成不可分割的原子：连续英文/数字算一个，中文与标点各算一个。

    空格附着到前一个原子，避免行首出现孤立空格。
    """
    atoms, i, n = [], 0, len(text)
    while i < n:
        if text[i] == " ":
            if atoms:
                atoms[-1] += " "
            i += 1
            continue
        m = ATOM_RE.match(text, i)
        if m and m.end() > i:
            atoms.append(m.group())
            i = m.end()
        else:
            atoms.append(text[i])
            i += 1
    return atoms


def is_ascii_word(s: str) -> bool:
    return bool(s) and all(ord(c) < 0x2E80 for c in s.strip()) and s.strip().isalnum()


def cut_score(left: str, right_atom: str) -> int:
    """在 left 之后、right_atom 之前断开的质量。中文没有词边界，
    所以只能利用「空格」和「中英交界」这两个天然信号。"""
    if not left:
        return 0
    if left.endswith(" "):
        return 3
    tail, head = left.rstrip()[-1:], right_atom[:1]
    if not tail or not head:
        return 0
    # 中英/中数 交界处断开，通常正好是词的边界
    if (ord(tail) < 0x2E80) != (ord(head) < 0x2E80):
        return 2
    return 0


def hard_wrap(text: str, max_chars: float):
    """兜底：无标点的超长串切分。不切开英文单词/数字，
    并优先在空格或中英交界处断，而不是一味填满到上限。"""
    atoms = atomize(text)
    out, i, n = [], 0, len(atoms)
    while i < n:
        buf, j = "", i
        cands = []  # (score, width, j, text)
        while j < n:
            nxt = buf + atoms[j]
            if buf and width(nxt) > max_chars:
                break
            buf, j = nxt, j + 1
            w = width(buf)
            if j < n and w >= max_chars * 0.5:
                cands.append((cut_score(buf, atoms[j]), w, j, buf))
        if j >= n:  # 剩余部分能一次放下
            if buf.strip():
                out.append(buf.strip())
            break
        if cands:
            cands.sort(key=lambda c: (c[0], c[1]))
            _, _, j, buf = cands[-1]
        elif j == i:  # 单个原子就超宽，强制吃掉它
            buf, j = atoms[i], i + 1
        if buf.strip():
            out.append(buf.strip())
        i = j
    return out or [text.strip()]


def pack_sentence(sentence: str, max_chars: float):
    """把一个句子切成 ≤max_chars 的片段列表。"""
    if width(sentence) <= max_chars:
        return [sentence]

    pieces = []
    for clause in split_clauses(sentence):
        if width(clause) <= max_chars:
            pieces.append(clause)
        else:
            pieces.extend(hard_wrap(clause, max_chars))

    # 贪心合并相邻子句，尽量吃满 max_chars
    merged = []
    for p in pieces:
        if merged and width(merged[-1] + p) <= max_chars:
            merged[-1] += p
        else:
            merged.append(p)
    return merged


def merge_short(items, max_chars: float, min_chars: float):
    """把过短的片段并入相邻片段，避免单独合成时语调突兀。

    items: [(text, boundary)]，boundary 取自该片段之后的停顿级别。
    合并时保留后者的 boundary（因为合并后以后者结尾）。
    """
    if not items:
        return []
    out = list(items)
    changed = True
    while changed and len(out) > 1:
        changed = False
        for i, (text, _b) in enumerate(out):
            if width(text) >= min_chars:
                continue
            # 优先并入前一个（更自然），否则并入后一个
            if i > 0 and width(out[i - 1][0] + text) <= max_chars:
                out[i - 1] = (out[i - 1][0] + text, out[i][1])
                del out[i]
                changed = True
                break
            if i + 1 < len(out) and width(text + out[i + 1][0]) <= max_chars:
                out[i + 1] = (text + out[i + 1][0], out[i + 1][1])
                del out[i]
                changed = True
                break
    return out


def parse_chapters(raw: str):
    """纯文本 → [{"title", "paragraphs": [str]}]。"""
    chapters, cur = [], None
    for line in raw.splitlines():
        title = detect_chapter(line)
        if title is not None:
            cur = {"title": title, "paragraphs": [], "_buf": []}
            chapters.append(cur)
            continue
        if cur is None:
            cur = {"title": "", "paragraphs": [], "_buf": []}
            chapters.append(cur)
        if line.strip():
            cur["_buf"].append(line.strip())
        elif cur["_buf"]:
            cur["paragraphs"].append(" ".join(cur["_buf"]))
            cur["_buf"] = []
    for c in chapters:
        if c["_buf"]:
            c["paragraphs"].append(" ".join(c["_buf"]))
        del c["_buf"]
    return [c for c in chapters if c["paragraphs"]]


def build_segments(chapters, max_chars: float, min_chars: float):
    """章节结构 → 扁平分段列表，每段带其后的停顿级别 boundary。"""
    segments = []
    for ci, ch in enumerate(chapters):
        for pi, para in enumerate(ch["paragraphs"]):
            items = []
            sents = split_sentences(para)
            for si, sent in enumerate(sents):
                pieces = pack_sentence(sent, max_chars)
                for k, piece in enumerate(pieces):
                    # 句内子句之间用 clause，句子结束用 sentence
                    b = "sentence" if k == len(pieces) - 1 else "clause"
                    items.append((piece, b))
            items = merge_short(items, max_chars, min_chars)
            if not items:
                continue
            # 该自然段最后一段的停顿升级为 para / chapter
            is_last_para = pi == len(ch["paragraphs"]) - 1
            tail = "chapter" if is_last_para else "para"
            items[-1] = (items[-1][0], tail)
            for text, boundary in items:
                segments.append({
                    "id": len(segments) + 1,
                    "text": text,
                    "chapter": ci,
                    "chapter_title": ch["title"],
                    "para": pi,
                    "boundary": boundary,
                    "duration_ms": None,
                    "wav": None,
                })
    if segments:
        segments[-1]["boundary"] = "end"
    return segments


def main():
    ap = argparse.ArgumentParser(description="文案切分为 segments.json")
    ap.add_argument("input", help="文案文件（.md/.txt）")
    ap.add_argument("-o", "--out", default="segments.json")
    ap.add_argument("--chapters", help="上层已做好语义分章的 JSON: [{title,text}]")
    ap.add_argument("--voice", default=None, help="音色 ID（默认读 skill config.json）")
    ap.add_argument("--model", default=None)
    ap.add_argument("--max-chars", type=float, default=None, help="单条字幕最大视觉宽度")
    ap.add_argument("--min-chars", type=float, default=None, help="低于此宽度尝试合并")
    args = ap.parse_args()

    cfg_path = Path(__file__).resolve().parent.parent / "config.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}

    voice = args.voice or cfg.get("voice")
    model = args.model or cfg.get("model")
    max_chars = args.max_chars if args.max_chars is not None else cfg.get("max_chars", 40)
    min_chars = args.min_chars if args.min_chars is not None else cfg.get("min_chars", 8)

    if not all(map(math.isfinite, (min_chars, max_chars))) or not 0 < min_chars <= max_chars:
        ap.error("Require 0 < min-chars <= max-chars")

    raw = Path(args.input).read_text(encoding="utf-8")
    source_chapters = parse_chapters(raw)
    if args.chapters:
        data = json.loads(Path(args.chapters).read_text(encoding="utf-8"))
        chapters = []
        for c in data:
            paras = [p.strip() for p in re.split(r"\n\s*\n", c["text"]) if p.strip()]
            paras = [" ".join(p.splitlines()) for p in paras]
            chapters.append({"title": c.get("title", ""), "paragraphs": paras})
        def spoken_content(items):
            return re.sub(r'\s+', '', ''.join(p for c in items for p in c['paragraphs']))
        if spoken_content(chapters) != spoken_content(source_chapters):
            ap.error('Chapter text must preserve the original spoken content and order')
    else:
        chapters = source_chapters

    if not chapters:
        print("错误：未解析到任何正文内容", file=sys.stderr)
        return 1

    segments = build_segments(chapters, max_chars, min_chars)
    if not segments:
        print("错误：切分结果为空", file=sys.stderr)
        return 1

    # Keep approved targeted retries for unchanged segment IDs and text.
    # A different paragraph never inherits another paragraph's seed.
    output = Path(args.out)
    if output.exists():
        try:
            previous = json.loads(output.read_text(encoding='utf-8'))
        except (ValueError, OSError):
            previous = {}
        saved = {(s.get('id'), s.get('text')): s.get('seed_override')
                 for s in previous.get('segments', []) if isinstance(s, dict)}
        for seg in segments:
            seed = saved.get((seg['id'], seg['text']))
            if isinstance(seed, int) and not isinstance(seed, bool) and seed >= 0:
                seg['seed_override'] = seed

    doc = {
        "meta": {
            "voice": voice,
            "model": model,
            "max_chars": max_chars,
            "min_chars": min_chars,
            "sample_rate": cfg.get("sample_rate", 24000),
            "silence_ms": cfg.get("silence_ms", {
                "clause": 80, "sentence": 180, "para": 400, "chapter": 700, "end": 0,
            }),
            "source": os.path.relpath(Path(args.input).resolve(), Path(args.out).parent.resolve()),
            "source_text_sha256": hashlib.sha256(Path(args.input).read_bytes()).hexdigest(),
        },
        "segments": segments,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(
        json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    n_ch = len({s["chapter"] for s in segments})
    chars = sum(len(s["text"]) for s in segments)
    widths = [width(s["text"]) for s in segments]
    over = sum(1 for w in widths if w > max_chars)
    print(f"✓ {args.out}")
    print(f"  章节 {n_ch} · 分段 {len(segments)} · 正文字符 {chars}")
    print(f"  单条宽度 最大 {max(widths):.1f} / 平均 {sum(widths)/len(widths):.1f} "
          f"（上限 {max_chars}，超限 {over} 条）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
