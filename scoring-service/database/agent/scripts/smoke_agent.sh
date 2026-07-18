#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${AGENT_PORT:-8787}"
HOST="${AGENT_HOST:-127.0.0.1}"
BASE_URL="http://${HOST}:${PORT}"

cd "$ROOT_DIR"

AGENT_USE_LLM="${AGENT_USE_LLM:-0}" node agent/api/server.mjs > /tmp/xiqu-agent-smoke.log 2>&1 &
PID="$!"
cleanup() {
  kill "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS "${BASE_URL}/api/agent/health" >/tmp/xiqu-agent-health.json 2>/dev/null; then
    break
  fi
  sleep 0.2
done

printf '\n==> health\n'
cat /tmp/xiqu-agent-health.json

printf '\n\n==> ask\n'
curl -fsS -X POST "${BASE_URL}/api/agent/ask" \
  -H 'Content-Type: application/json' \
  -d '{"question":"京剧和昆曲有什么区别？"}'
printf '\n'
