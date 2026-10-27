#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="${1:-$ROOT_DIR/src/ui/chat-view.js}"
OUT_DIR="${2:-$ROOT_DIR/src/ui/svelte}"

if [[ ! -f "$SOURCE" ]]; then
  echo "Source file not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
find "$OUT_DIR" -maxdepth 1 -type f -name 'svelte-*' -delete

python3 - "$SOURCE" "$OUT_DIR" <<'PY'
import os
import re
import sys

source_path = sys.argv[1]
out_dir = sys.argv[2]

with open(source_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

pattern = re.compile(r"^//\s*node_modules/svelte/(.+?)\s*$")
blocks = []
current_rel = None
current_lines = []

for line in lines:
    m = pattern.match(line)
    if m:
        if current_rel is not None:
            blocks.append((current_rel, "".join(current_lines).rstrip("\n") + "\n"))
        current_rel = m.group(1)
        current_lines = [line]
    elif current_rel is not None:
        current_lines.append(line)

if current_rel is not None:
    blocks.append((current_rel, "".join(current_lines).rstrip("\n") + "\n"))

for idx, (rel, content) in enumerate(blocks):
    safe_rel = rel.strip().replace("\\", "/")
    safe_rel = safe_rel.replace("/", "_")
    filename = f"svelte-{idx:02d}-{safe_rel}"
    out_path = os.path.join(out_dir, filename)
    with open(out_path, "w", encoding="utf-8") as out:
        out.write(content)

print(f"Wrote {len(blocks)} files to {out_dir}")
PY
