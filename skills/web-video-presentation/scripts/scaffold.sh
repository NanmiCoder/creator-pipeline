#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# scaffold.sh —— 一键脚手架，创建一个 video-presentation 项目。
#
# 用法：
#   bash scripts/scaffold.sh <target-dir> [--theme=<id>]
#   bash scripts/scaffold.sh --list-themes
#
# 例子：
#   bash <path-to-web-video-presentation>/scripts/scaffold.sh ./presentation
#   bash <path-to-web-video-presentation>/scripts/scaffold.sh ./talk --theme=paper-press
#   bash <path-to-web-video-presentation>/scripts/scaffold.sh --list-themes
#
# 跑完后：VO-First 项目在项目上一级写 plan.md → npm run gen → 代表性样片 → 开发各章
# （每章读自己的 BRIEF.md + references/CRAFT.md）→ npm run check。
# 卡壳时翻 references/EXAMPLES/ 找完整章节 anchor。
#
# 之后切换颜色/字体 token（仍需复查构图和字体尺度）：
#   cp <path-to-web-video-presentation>/themes/<id>/tokens.css \
#      <project>/src/styles/tokens.css
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$SKILL_DIR/templates"
THEMES_DIR="$SKILL_DIR/themes"
DEFAULT_THEME="creator-dark"

list_themes() {
  echo "可用主题（来自 ${THEMES_DIR}）:"
  echo
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    local meta="$dir/theme.json"
    [[ -f "$meta" ]] || continue
    # 没有 jq，简单 grep + sed 提字段
    local id name desc
    id=$(grep -E '"id"' "$meta" | head -n1 | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
    name=$(grep -E '"nameZh"' "$meta" | head -n1 | sed -E 's/.*"nameZh":[[:space:]]*"([^"]+)".*/\1/')
    desc=$(grep -E '"descriptionZh"' "$meta" | head -n1 | sed -E 's/.*"descriptionZh":[[:space:]]*"([^"]+)".*/\1/')
    printf "  • %-18s %s\n      %s\n\n" "$id" "$name" "$desc"
  done
  echo "用 --theme=<id> 选定一个。默认：${DEFAULT_THEME}。"
}

# ── 解析参数 ──
TARGET=""
THEME="$DEFAULT_THEME"
for arg in "$@"; do
  case "$arg" in
    --list-themes)
      list_themes
      exit 0
      ;;
    --theme=*)
      THEME="${arg#--theme=}"
      ;;
    --*)
      echo "✗ 未知参数: $arg" >&2
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$arg"; fi
      ;;
  esac
done

TARGET="${TARGET:-presentation}"
THEME_DIR="$THEMES_DIR/$THEME"
THEME_TOKENS="$THEME_DIR/tokens.css"

if [[ ! -d "$THEME_DIR" || ! -f "$THEME_TOKENS" ]]; then
  echo "✗ 找不到主题 '${THEME}'。可用主题：" >&2
  echo >&2
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    echo "    • $(basename "$dir")" >&2
  done
  exit 1
fi

if [[ -d "$TARGET" && -n "$(ls -A "$TARGET" 2>/dev/null || true)" ]]; then
  echo "✗ 目标目录 '${TARGET}' 已存在且非空，已中止。" >&2
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "✗ 需要 npm，但在 PATH 里没找到。" >&2
  exit 1
fi

echo "▸ 创建演示项目：${TARGET}（锁定依赖，主题 ${THEME}）"
mkdir -p "$TARGET/public/audio"
cp -R "$TEMPLATES/." "$TARGET/"
cp "$THEME_TOKENS" "$TARGET/src/styles/tokens.css"
printf '%s\n' "$THEME" > "$TARGET/.theme"
cd "$TARGET"
npm ci --no-audit --no-fund
npm run check
cat <<EOF

完成。项目：$TARGET
  npm run dev     # 启动预览，以终端显示的端口为准
  npm run gen     # 默认读 ../plan.md；生成 timeline / BRIEF / timing
  npm run check   # 工程检查；还需 真实浏览器 视觉与播放验收
  npm run build   # 静态产物 dist/

开发入口：$SKILL_DIR/references/CRAFT.md
连续 MG：$SKILL_DIR/references/MOTION.md
验帧：?review=1&t=<绝对秒>&mute=1（VO-First 采样动画）
录制：?auto=1；自动验证加 &mute=1。
先做代表性样片，按计划替换 01-example 并同步注册章节。
EOF
