#!/usr/bin/env bash
set -euo pipefail

if [[ "$(basename "$PWD")" != "ObAiChat" ]]; then
  echo "Run this from inside ObAiChat/ (cd ObAiChat && bash smoke.sh)." >&2
  exit 1
fi

INPUT="${1:-${AICHAT_SMOKE_INPUT:-assembled-plugin.js}}"
SMOKE_LOG="${AICHAT_SMOKE_LOG:-smoke.log}"

mkdir -p "$(dirname "$SMOKE_LOG")" 2>/dev/null || true
exec > >(tee -a "$SMOKE_LOG") 2>&1

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] smoke start input=$INPUT"

if [[ ! -f "$INPUT" ]]; then
  echo "Smoke failed: bundle not found: $INPUT" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Smoke failed: node not found in PATH." >&2
  exit 1
fi

node test/obsidianMock.template.js "$INPUT"



echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] smoke done input=$INPUT"
