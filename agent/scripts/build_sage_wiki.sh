#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Capture variables explicitly provided by the caller before loading .env.
# This lets commands like `SAGE_WIKI_BATCH=images bash ...` override defaults in .env.
ENV_OVERRIDE_VARS=(
  SAGE_WIKI_DIR
  SAGE_WIKI_SOURCE_DIR
  SAGE_WIKI_BATCH
  SAGE_WIKI_SEARCH_QUERY
  SAGE_WIKI_ASK_QUERY
  SAGE_WIKI_SKIP_QUERY
  SAGE_WIKI_SKIP_SEARCH
  SAGE_WIKI_SKIP_DOCTOR
  SAGE_WIKI_SKIP_COMPILE
  SAGE_WIKI_ESTIMATE_ONLY
  SAGE_WIKI_COMPILE_VERBOSE
  SAGE_WIKI_HTTP_TIMEOUT_SECONDS
  SAGE_WIKI_EMBED_TIMEOUT_SECONDS
  NVIDIA_BASE_URL
  NVIDIA_MODEL
  NVIDIA_VISION_MODEL
  NVIDIA_RATE_LIMIT
  NVIDIA_TEMPERATURE
  NVIDIA_TOP_P
  NVIDIA_EMBED_PROVIDER
  NVIDIA_EMBED_MODEL
)

for env_var in "${ENV_OVERRIDE_VARS[@]}"; do
  if eval "[[ \${${env_var}+x} ]]"; then
    eval "__SAGE_WIKI_OVERRIDE_${env_var}="\${${env_var}}""
    eval "__SAGE_WIKI_HAS_OVERRIDE_${env_var}=1"
  fi
done

restore_env_overrides() {
  local env_var
  for env_var in "${ENV_OVERRIDE_VARS[@]}"; do
    if eval "[[ \${__SAGE_WIKI_HAS_OVERRIDE_${env_var}:-0} == 1 ]]"; then
      eval "export ${env_var}="\${__SAGE_WIKI_OVERRIDE_${env_var}}""
    fi
  done
}

WIKI_DIR="${SAGE_WIKI_DIR:-$ROOT_DIR/wiki/xiqu-knowledge}"
SOURCE_DIR="${SAGE_WIKI_SOURCE_DIR:-$ROOT_DIR/2026大创项目（戏曲智能体）}"
SYNC_BATCH="${SAGE_WIKI_BATCH:-docs}"
SEARCH_QUERY="${SAGE_WIKI_SEARCH_QUERY:-京剧 昆曲 区别}"
ASK_QUERY="${SAGE_WIKI_ASK_QUERY:-京剧四大名旦是谁？}"
SKIP_QUERY="${SAGE_WIKI_SKIP_QUERY:-0}"
SKIP_SEARCH="${SAGE_WIKI_SKIP_SEARCH:-0}"
SKIP_DOCTOR="${SAGE_WIKI_SKIP_DOCTOR:-0}"
SKIP_COMPILE="${SAGE_WIKI_SKIP_COMPILE:-0}"
ESTIMATE_ONLY="${SAGE_WIKI_ESTIMATE_ONLY:-0}"
COMPILE_VERBOSE="${SAGE_WIKI_COMPILE_VERBOSE:--v}"

if command -v go >/dev/null 2>&1; then
  GO_BIN_DIR="$(go env GOBIN 2>/dev/null || true)"
  if [[ -z "$GO_BIN_DIR" ]]; then
    GO_PATH_DIR="$(go env GOPATH 2>/dev/null || true)"
    if [[ -n "$GO_PATH_DIR" ]]; then
      GO_BIN_DIR="$GO_PATH_DIR/bin"
    fi
  fi
  if [[ -n "${GO_BIN_DIR:-}" ]]; then
    export PATH="$GO_BIN_DIR:$PATH"
  fi
fi

resolve_path_from_root() {
  local path_value="$1"
  if [[ "$path_value" = /* ]]; then
    printf '%s\n' "$path_value"
  else
    printf '%s\n' "$ROOT_DIR/$path_value"
  fi
}

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

log() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$*"
}

warn() {
  printf '\n\033[1;33mWARN: %s\033[0m\n' "$*" >&2
}

fail() {
  printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2
  exit 1
}

sync_source_dir() {
  local src_dir="$1"
  local raw_dir="$2"
  local batch="$3"

  if [[ ! -d "$src_dir" ]]; then
    warn "未找到原始资料目录：$src_dir。跳过资料同步。"
    return 0
  fi

  local src_name
  src_name="$(basename "$src_dir")"
  log "同步原始资料 batch=${batch}：$src_dir -> $raw_dir/$src_name"
  SRC_DIR="$src_dir" RAW_DIR="$raw_dir" SAGE_WIKI_BATCH="$batch" python3 - <<'PY'
from pathlib import Path
import os
import shutil

src = Path(os.environ['SRC_DIR'])
raw = Path(os.environ['RAW_DIR'])
dst = raw / src.name
batch_raw = os.environ.get('SAGE_WIKI_BATCH', 'docs').strip().lower()
selected = {part.strip() for part in batch_raw.replace('+', ',').split(',') if part.strip()}
if not selected:
    selected = {'docs'}

valid_modes = {'docs', 'images', 'all'}
unknown = selected - valid_modes
if unknown:
    raise SystemExit(f'unknown SAGE_WIKI_BATCH mode(s): {sorted(unknown)}; valid: docs, images, docs,images, all')

doc_exts = {
    '.md', '.markdown', '.txt', '.pdf', '.docx', '.doc', '.rtf',
    '.csv', '.tsv', '.xlsx', '.xls', '.pptx', '.ppt', '.json', '.yaml', '.yml'
}
image_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif'}
video_exts = {'.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.flv', '.wmv'}
ignore_names = {'.DS_Store'}

if 'all' in selected:
    allowed_exts = doc_exts | image_exts
else:
    allowed_exts = set()
    if 'docs' in selected:
        allowed_exts |= doc_exts
    if 'images' in selected:
        allowed_exts |= image_exts

# Keep raw deterministic for the selected batch. Videos are intentionally excluded.
if dst.exists():
    shutil.rmtree(dst)
dst.mkdir(parents=True, exist_ok=True)

copied = 0
skipped_video = 0
skipped_other = 0
for p in src.rglob('*'):
    if any(part in ignore_names for part in p.parts):
        continue
    if p.is_dir():
        continue
    ext = p.suffix.lower()
    if ext in video_exts:
        skipped_video += 1
        continue
    if ext not in allowed_exts:
        skipped_other += 1
        continue
    rel = p.relative_to(src)
    out = dst / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, out)
    copied += 1

print(f'synced source files: {copied}')
print(f'skipped videos: {skipped_video}')
print(f'skipped unsupported/other files: {skipped_other}')
print(f'raw target total files: {sum(1 for p in dst.rglob("*") if p.is_file())}')
PY
}

batch_includes_images() {
  local batch=",${1//+/,},"
  [[ "$batch" == *,images,* || "$batch" == *,all,* ]]
}

print_raw_file_preview() {
  log "本次 raw 文件清单预览"
  python3 - <<'INNERPY'
from pathlib import Path
root = Path('raw')
files = sorted([p for p in root.rglob('*') if p.is_file()]) if root.exists() else []
print(f'  Total files: {len(files)}')
for i, p in enumerate(files[:80], 1):
    print(f'  {i:03d}. {p}')
if len(files) > 80:
    print(f'  ... and {len(files) - 80} more')
INNERPY
}

print_config_summary() {
  log "当前模型配置"
  printf '  Provider: openai-compatible\n'
  printf '  Base URL: %s\n' "${NVIDIA_BASE_URL:-<unset>}"
  printf '  Active model: %s\n' "${NVIDIA_MODEL:-<unset>}"
  if [[ -n "${NVIDIA_TEXT_MODEL:-}" ]]; then
    printf '  Text model: %s\n' "${NVIDIA_TEXT_MODEL}"
  fi
  if [[ -n "${NVIDIA_VISION_MODEL:-}" ]]; then
    printf '  Vision model: %s\n' "${NVIDIA_VISION_MODEL}"
  fi
  printf '  Source batch: %s\n' "${SYNC_BATCH:-docs}"
  printf '  Compile verbose: %s\n' "${COMPILE_VERBOSE:-<none>}"
  printf '  LLM timeout: %s seconds\n' "${SAGE_WIKI_HTTP_TIMEOUT_SECONDS:-120}"
  printf '  Embedding timeout: %s seconds\n' "${SAGE_WIKI_EMBED_TIMEOUT_SECONDS:-120}"
  if [[ -f config.yaml ]] && grep -A5 '^embed:' config.yaml | grep -q 'provider: auto'; then
    printf '  Embedding: auto / BM25-only fallback\n'
  else
    printf '  Embedding provider: %s\n' "${NVIDIA_EMBED_PROVIDER:-<unset>}"
    printf '  Embedding model: %s\n' "${NVIDIA_EMBED_MODEL:-<unset>}"
  fi
  if [[ -n "${NVIDIA_API_KEY:-}" ]]; then
    printf '  API Key: %s\n' '<set, hidden>'
  else
    printf '  API Key: %s\n' '<unset>'
  fi
}

if ! command -v sage-wiki >/dev/null 2>&1; then
  if [[ "${SAGE_WIKI_AUTO_INSTALL:-0}" == "1" ]]; then
    command -v go >/dev/null 2>&1 || fail "未找到 go，无法自动安装 sage-wiki。请先安装 Go。"
    log "未找到 sage-wiki，开始自动安装"
    go install github.com/xoai/sage-wiki/cmd/sage-wiki@latest
    command -v sage-wiki >/dev/null 2>&1 || fail "sage-wiki 安装后仍不可用，请确认 GOPATH/bin 或 GOBIN 已加入 PATH。"
  else
    fail "未找到 sage-wiki 命令。请先执行：go install github.com/xoai/sage-wiki/cmd/sage-wiki@latest；或设置 SAGE_WIKI_AUTO_INSTALL=1 让脚本自动安装。"
  fi
fi

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/wiki/xiqu-knowledge/.env"
restore_env_overrides

WIKI_DIR="$(resolve_path_from_root "${SAGE_WIKI_DIR:-wiki/xiqu-knowledge}")"
SOURCE_DIR="$(resolve_path_from_root "${SAGE_WIKI_SOURCE_DIR:-2026大创项目（戏曲智能体）}")"
SYNC_BATCH="${SAGE_WIKI_BATCH:-$SYNC_BATCH}"

log "使用知识库目录：$WIKI_DIR"
mkdir -p "$WIKI_DIR/raw" "$WIKI_DIR/notes" "$WIKI_DIR/scripts"

SAGE_WIKI_LOCK_DIR="$WIKI_DIR/.sage-build.lock"
if ! mkdir "$SAGE_WIKI_LOCK_DIR" 2>/dev/null; then
  fail "检测到另一个 sage-wiki 构建正在运行：$SAGE_WIKI_LOCK_DIR。请等待它结束，或确认没有进程后删除该锁目录。"
fi
trap 'rm -rf "$SAGE_WIKI_LOCK_DIR"' EXIT INT TERM

sync_source_dir "$SOURCE_DIR" "$WIKI_DIR/raw" "$SYNC_BATCH"
cd "$WIKI_DIR"

if [[ -f config.yaml ]] && grep -q 'NVIDIA_' config.yaml; then
  [[ -n "${NVIDIA_BASE_URL:-}" ]] || fail "缺少 NVIDIA_BASE_URL。请在 .env 中配置，例如：https://integrate.api.nvidia.com/v1"
  [[ -n "${NVIDIA_API_KEY:-}" ]] || fail "缺少 NVIDIA_API_KEY。请在 .env 中配置，不要提交真实 key。"
  [[ -n "${NVIDIA_MODEL:-}" ]] || fail "缺少 NVIDIA_MODEL。请在 .env 中配置，例如：deepseek-ai/deepseek-v4-pro"
  export NVIDIA_TEXT_MODEL="${NVIDIA_MODEL}"
  if batch_includes_images "$SYNC_BATCH"; then
    if [[ -n "${NVIDIA_VISION_MODEL:-}" ]]; then
      export NVIDIA_MODEL="${NVIDIA_VISION_MODEL}"
    else
      warn "当前批次包含图片，但未配置 NVIDIA_VISION_MODEL。若 NVIDIA_MODEL 不支持多模态，图片总结会失败。"
    fi
  fi
  export NVIDIA_RATE_LIMIT="${NVIDIA_RATE_LIMIT:-30}"
  export NVIDIA_TEMPERATURE="${NVIDIA_TEMPERATURE:-0.2}"
  export NVIDIA_TOP_P="${NVIDIA_TOP_P:-0.7}"

  if ! grep -A5 '^embed:' config.yaml | grep -q 'provider: auto'; then
    [[ -n "${NVIDIA_EMBED_MODEL:-}" ]] || fail "当前 config.yaml 启用了显式 embedding provider，缺少 NVIDIA_EMBED_MODEL。若不想配置 embedding，请使用 embed.provider: auto。"
    export NVIDIA_EMBED_PROVIDER="${NVIDIA_EMBED_PROVIDER:-openai}"
  fi
fi

print_config_summary

if [[ ! -f config.yaml ]]; then
  log "未发现 config.yaml，初始化 sage-wiki 项目"
  sage-wiki init
elif [[ ! -f .sage/wiki.db ]]; then
  log "发现 config.yaml 但缺少 .sage/wiki.db，初始化数据库并保留现有配置"
  tmp_config="$(mktemp)"
  cp config.yaml "$tmp_config"
  sage-wiki init
  cp "$tmp_config" config.yaml
  rm -f "$tmp_config"
else
  log "发现已有 config.yaml 和 .sage/wiki.db，跳过 init"
fi

if ! find raw -type f ! -name '.gitkeep' -print -quit | grep -q .; then
  warn "raw/ 下还没有资料。脚本会继续执行检查，但 compile/search/query 很可能没有有效结果。"
  warn "请把 Markdown、PDF、docx、xlsx、pptx、csv、图片等资料放入：$WIKI_DIR/raw/"
fi

print_raw_file_preview

if [[ "$SKIP_DOCTOR" != "1" ]]; then
  log "运行 sage-wiki doctor"
  sage-wiki doctor
else
  warn "已跳过 doctor（SAGE_WIKI_SKIP_DOCTOR=1）"
fi

if [[ "$ESTIMATE_ONLY" == "1" ]]; then
  log "只预估编译成本：sage-wiki compile --estimate"
  sage-wiki compile --estimate
  exit 0
fi

if [[ "$SKIP_COMPILE" != "1" ]]; then
  log "编译知识库：sage-wiki compile（standard 模式，避免 batch upload 404）"
  if [[ -n "${COMPILE_VERBOSE:-}" ]]; then
    sage-wiki compile $COMPILE_VERBOSE
  else
    sage-wiki compile
  fi
else
  warn "已跳过 compile（SAGE_WIKI_SKIP_COMPILE=1）"
fi

log "查看知识库状态"
sage-wiki status || warn "sage-wiki status 未成功，请根据上方输出排查。"

if [[ "$SKIP_SEARCH" != "1" ]]; then
  log "搜索冒烟：$SEARCH_QUERY"
  search_output="$(sage-wiki search "$SEARCH_QUERY" 2>&1)" || {
    printf '%s
' "$search_output"
    warn "search 未成功，请检查是否已有资料、索引和模型/embedding 配置。"
    search_output=""
  }
  if [[ -n "$search_output" ]]; then
    printf '%s
' "$search_output"
    if grep -q '^No results found\.$' <<<"$search_output"; then
      warn "当前未配置 embedding，BM25 对中文自然问句分词较弱；请用空格分隔关键词，或配置 embedding provider。"
    fi
  fi
else
  warn "已跳过 search（SAGE_WIKI_SKIP_SEARCH=1）"
fi

if [[ "$SKIP_QUERY" != "1" ]]; then
  log "问答冒烟：$ASK_QUERY"
  sage-wiki query "$ASK_QUERY" || warn "query 未成功，请检查模型 key、config.yaml 和已编译内容。"
else
  warn "已跳过 query（SAGE_WIKI_SKIP_QUERY=1）"
fi

log "sage-wiki 构建流程完成"
