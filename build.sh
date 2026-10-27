#!/usr/bin/env bash
set -euo pipefail

if [[ "$(basename "$PWD")" != "ObAiChat" ]]; then
  echo "Run this from inside ObAiChat/ (cd ObAiChat && bash build.sh)." >&2
  exit 1
fi

OUTPUT="${AICHAT_BUILD_OUTPUT:-assembled-plugin.js}"
PLUGIN_MAIN="${AICHAT_PLUGIN_MAIN:-../.obsidian/plugins/obaichat/main.js}"
BUILD_LOG="${AICHAT_BUILD_LOG:-build.log}"

: > "$BUILD_LOG"
exec > >(tee -a "$BUILD_LOG") 2>&1
echo "Writing build output to $BUILD_LOG"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node not found in PATH." >&2
  exit 1
fi

mapfile -t FILES < <(
  find . -type f -name "*.js" \
    ! -name "$(basename "$OUTPUT")" \
    ! -name "*.template.js" \
    ! -name "*.script.sh" \
    | sed 's|^\./||' \
    | sort
)

if (( ${#FILES[@]} == 0 )); then
  echo "No .js files found under ObAiChat/." >&2
  exit 1
fi

: > "$OUTPUT"
for path in "${FILES[@]}"; do
  {
    echo "{"
    echo "// $path"
    cat "$path"
    echo
    echo "}"
    echo
  } >> "$OUTPUT"
done

if node --check "$OUTPUT"; then
  echo "Fast syntax check passed."

  SMOKE_SCRIPT="${AICHAT_SMOKE_SCRIPT:-./smoke.sh}"
  if [[ ! -f "$SMOKE_SCRIPT" ]]; then
    echo "Build failed: smoke script not found at $SMOKE_SCRIPT" >&2
    exit 1
  fi
  bash "$SMOKE_SCRIPT" "$OUTPUT"

  # the plugin's folder in the vault, made if new (a fresh phone), with its manifest and styles
  mkdir -p "$(dirname "$PLUGIN_MAIN")"
  cp "$OUTPUT" "$PLUGIN_MAIN"
  cp manifest.json styles.css "$(dirname "$PLUGIN_MAIN")/"
  echo "Smoke test passed."
  echo "Build complete (alphabetical recursive concat): $OUTPUT"
  echo "Committed plugin bundle to: $PLUGIN_MAIN"
  exit 0
fi

echo "Build failed: syntax check failed for concatenated output." >&2
exit 1
