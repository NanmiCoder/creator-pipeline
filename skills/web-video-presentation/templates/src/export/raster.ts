import type { ExportPreset } from "./presets";

const XMLNS = "http://www.w3.org/1999/xhtml";
const escapeXml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

/** Keep original CSS text: CSSOM serialization loses some var()-based font shorthands. */
export async function createRasterizer(preset: ExportPreset, signal: AbortSignal) {
  const assets = new Map<string, Promise<string>>();
  const asset = (url: string): Promise<string> => {
    if (url.startsWith("data:") || url.startsWith("#")) return Promise.resolve(url);
    const absolute = new URL(url, document.baseURI).href;
    if (!assets.has(absolute)) assets.set(absolute, (async () => {
      const res = await fetch(absolute, { signal });
      if (!res.ok) throw new Error(`无法读取导出素材：${absolute} (${res.status})`);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })());
    return assets.get(absolute)!;
  };
  const embedUrls = async (css: string, base: string) => {
    const matches = [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)];
    const replacements = await Promise.all(matches.map(async (m) => {
      const url = m[2]!;
      return url.startsWith("#") || url.startsWith("data:") ? m[0] : `url("${await asset(new URL(url, base).href)}")`;
    }));
    let i = 0;
    return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, () => replacements[i++]!);
  };
  const fonts = new Set<string>();
  // Include digits and all ASCII up front; timed counters then need no font refresh.
  const codePoints = new Set(Array.from({ length: 128 }, (_, i) => i));
  const cssFiles = new Map<string, Promise<string>>();
  const cssFile = (url: string) => {
    if (!cssFiles.has(url)) cssFiles.set(url, fetch(url, { signal }).then(async res => {
      if (!res.ok) throw new Error(`无法读取导出样式：${url}`);
      return res.text();
    }));
    return cssFiles.get(url)!;
  };
  let css = "", chapter: string | undefined;
  const readCss = async (text: string, base: string, ancestors = new Set<string>()): Promise<string> => {
    const imports = [...text.matchAll(/@import\s+(?:url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|['"]([^'"]+)['"])[^;]*;/g)];
    for (const m of imports) {
      const url = new URL(m[1] ?? m[2]!, base).href;
      if (ancestors.has(url)) throw new Error("CSS 循环导入");
      // Google Fonts imports for unused themes need not be embedded.
      const families = new URL(url).searchParams.getAll("family").map(s => s.split(":")[0]!.toLowerCase());
      let nested = "";
      if (!families.length || families.some(f => fonts.has(f))) {
        nested = await readCss(await cssFile(url), url, new Set([...ancestors, url]));
      }
      text = text.replace(m[0], nested);
    }
    text = text.replace(/@font-face\s*\{[^}]*\}/g, rule => {
      const family = /font-family\s*:\s*([^;]+)/.exec(rule)?.[1]?.replace(/['"]/g, "").trim().toLowerCase();
      if (!family || !fonts.has(family)) return "";
      const unicode = /unicode-range\s*:\s*([^;]+)/i.exec(rule)?.[1];
      if (unicode) {
        const ranges = [...unicode.matchAll(/U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/gi)];
        const needed = ranges.some(m => {
          const lo = parseInt(m[1]!.replaceAll("?", "0"), 16);
          const hi = parseInt(m[2] ?? m[1]!.replaceAll("?", "F"), 16);
          return [...codePoints].some(cp => cp >= lo && cp <= hi);
        });
        if (ranges.length && !needed) return "";
      }
      return rule;
    });
    // Deduplicate variable font files shared by several requested weights.
    const faces = new Map<string, { rule: string; weights: number[] }>();
    text = text.replace(/@font-face\s*\{[^}]*\}/g, rule => {
      const weight = /font-weight:\s*(\d+)\s*;/.exec(rule);
      if (!weight) return rule;
      const key = rule.replace(weight[0], "font-weight: __WEIGHT__; ");
      const entry = faces.get(key);
      if (entry) entry.weights.push(Number(weight[1]));
      else faces.set(key, { rule, weights: [Number(weight[1])] });
      return "";
    });
    for (const { rule, weights } of faces.values()) {
      const lo = Math.min(...weights), hi = Math.max(...weights);
      text += rule.replace(/font-weight:\s*\d+\s*;/, `font-weight: ${lo === hi ? lo : `${lo} ${hi}`};`);
    }
    return embedUrls(text, base);
  };
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("无法创建导出画布");

  return {
    canvas,
    async draw(time: number) {
      signal.throwIfAborted();
      const stage = document.querySelector<HTMLElement>(".stage-frame");
      if (!stage) throw new Error("找不到 16:9 舞台");
      const currentChapter = stage.querySelector<HTMLElement>(".scene")?.dataset.chapter ?? "";
      let newGlyphs = false;
      for (const ch of stage.textContent ?? "") {
        const cp = ch.codePointAt(0)!;
        if (!codePoints.has(cp)) { codePoints.add(cp); newGlyphs = true; }
      }
      if (chapter !== currentChapter || newGlyphs) {
        await document.fonts.ready;
        for (const el of [stage, ...stage.querySelectorAll("*")]) {
          for (const pseudo of [null, "::before", "::after"]) {
            const style = getComputedStyle(el, pseudo);
            for (const f of style.fontFamily.split(",")) fonts.add(f.replace(/['"]/g, "").trim().toLowerCase());
            if (pseudo) for (const char of style.content) codePoints.add(char.codePointAt(0)!);
          }
        }
        css = (await Promise.all([...document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]')].map(async el => {
          if (el instanceof HTMLStyleElement) return readCss(el.textContent ?? "", document.baseURI);
          return readCss(await cssFile(el.href), el.href);
        }))).join("\n");
        chapter = currentChapter;
      }
      // Autonomous playback cannot be allowed to sneak a wall clock into an offline frame.
      if (stage.querySelector("video, iframe, object, embed")) {
        throw new Error("逐帧导出暂不支持内嵌视频、iframe 或插件。请将这些片段单独导出后合成。");
      }
      if (stage.getAnimations({ subtree: true }).length) {
        throw new Error("舞台含独立 CSS/Web Animation，请先将动画改为由章节 time 驱动，再导出。");
      }
      const clone = stage.cloneNode(true) as HTMLElement;
      clone.style.transform = "none";
      clone.style.position = "relative";
      clone.style.margin = "0";
      clone.style.boxShadow = "none";
      const computed = getComputedStyle(stage);
      // The image document has no page body from which to inherit typography.
      for (const key of ["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "word-spacing", "text-align", "text-transform", "direction", "text-rendering", "-webkit-font-smoothing"]) {
        clone.style.setProperty(key, computed.getPropertyValue(key));
      }
      for (const key of computed) if (key.startsWith("--")) clone.style.setProperty(key, computed.getPropertyValue(key));
      const originals = [...stage.querySelectorAll("img, canvas")];
      const copies = [...clone.querySelectorAll("img, canvas")];
      await Promise.all(originals.map(async (node, i) => {
        const copy = copies[i]!;
        if (node instanceof HTMLImageElement) {
          const img = copy as HTMLImageElement;
          img.removeAttribute("srcset");
          img.removeAttribute("loading");
          img.src = await asset(node.currentSrc || node.src);
        } else if (node instanceof HTMLCanvasElement) {
          const img = document.createElement("img");
          img.setAttribute("style", node.getAttribute("style") ?? "");
          img.className = node.className;
          img.width = node.width; img.height = node.height;
          img.src = node.toDataURL();
          copy.replaceWith(img);
        }
      }));
      // Inline SVG image references and inline CSS backgrounds also need self-contained URLs.
      for (const img of clone.querySelectorAll("svg image")) {
        const href = img.getAttribute("href") ?? img.getAttribute("xlink:href");
        if (href) { img.removeAttribute("xlink:href"); img.setAttribute("href", await asset(href)); }
      }
      for (const el of clone.querySelectorAll<HTMLElement>("[style]")) {
        if (el.style.cssText.includes("url(")) el.style.cssText = await embedUrls(el.style.cssText, document.baseURI);
      }
      const html = new XMLSerializer().serializeToString(clone);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${preset.width}" height="${preset.height}" viewBox="0 0 1920 1080"><foreignObject width="1920" height="1080"><div xmlns="${XMLNS}"><style>${escapeXml(css)}</style>${html}</div></foreignObject></svg>`;
      const image = new Image();
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await image.decode();
      signal.throwIfAborted();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      canvas.dataset.time = String(time);
    },
    dispose() { assets.clear(); cssFiles.clear(); canvas.width = canvas.height = 0; css = ""; },
  };
}
