## Lean send design (chat history de-bloat)

## Goals
- Keep request payloads small and stable.
- Never replay large tool outputs in later turns.
- Still let the assistant access files when needed.
- Preserve undo/revert ability for assistant-made edits.

## Core idea
Send only a compact conversation transcript plus references to local artifacts.

Replace large tool results with stubs:
- tool: read_file
- target: ObAiChat/sentFirst.log
- bytes: 82198
- sha256: <hash>
- summary: "log file with prior payload stats"

Store full tool outputs locally in an artifact store keyed by hash. Do not inject full content into future chat history.

## Message packing rules
1) Keep full text for normal user/assistant chat messages.
2) For tool results:
   - If small (<= N chars), inline.
   - If large (> N chars), replace with stub.
3) Always keep tool call intent (tool name + args) in history.
4) Keep a rolling token budget; trim oldest low-value turns first.

Current implementation note: successful read_file tool results over 32KB are elided before the first model send of each user turn (threshold = 32768 bytes).

## Local artifact store
- Path: ObAiChat/.artifacts/
- Key: sha256(content)
- Metadata index: artifact hash -> bytes, mime/type, createdAt, source tool, source path
- Dedup by hash (same content stored once)

## File-change capture pipeline (source of truth)
- inotify is signal-only: append touched file paths to ObAiChat/.journal/touches.ndjson.
- Never write final edit journal entries directly from inotify events.
- Before every AI send: drain touches, dedupe paths, reconcile actual file content, and append diff journal entries for real changes.
- After every AI send sequence: run the same reconciliation again to catch changes that happened during tool execution.
- If watcher overflow/staleness is detected, trigger a scoped full rescan and reconcile by hashes/content.

## Rolling baseline state for diffing
- Keep per-file rolling baseline at last-journaled state (hash + text snapshot for tracked text files).
- Reconcile by diffing baseline -> current content.
- On successful journal append, advance baseline to current.
- Journal remains diff-only; baseline snapshots are working state, not historical undo records.

## Failure handling and edge cases
- Overflow: if watcher reports queue overflow, mark watcher state degraded and force immediate scoped full rescan + reconcile before next send.
- Stale watcher: if heartbeat is stale/missing, do not trust touches alone; run a scoped hash rescan during pre-send reconciliation.
- Rename/move: record as explicit journal metadata (fromPath -> toPath) plus content diff if content also changed.
- Delete/create: record tombstone/create journal entries with hashes and empty-content side as needed for inverse diff apply.
- Patch apply failure: do not silently continue; mark conflict, keep file unchanged, and return actionable error with expected vs current hash.
- Idempotency: reconciliation must avoid duplicate journal entries for the same beforeHash -> afterHash transition.

## On-demand retrieval flow
When the assistant needs full content:
1) Assistant asks for file/content in the current turn.
2) Runtime fetches from vault or artifact store.
3) Inject only for this turn (or chunk if very large).
4) Do not persist injected full content in subsequent history; persist only a new stub + summary.

Complex case example (large file):
- Send stub first.
- If assistant requests detail, send chunk 1/k with range markers.
- Assistant can request specific next chunk or section.

## Edit/change journal (for revert)
Keep a local append-only journal of file diffs for all relevant edits (assistant tool edits and user/manual edits):
- timestamp
- file path
- before hash
- after hash
- diff patch (the only undo artifact)

Journal write policy:
- Journal entries are appended only by reconciliation (pre-send and post-send), never directly by tool operations or watcher events.

Revert command behavior:
- "revert last change to <file>" resolves from journal.
- Apply inverse diff patch locally.
- Send assistant a short revert result (no full file dump unless requested).

## Context policy for modified files
Recently modified files may be important context. Use "dirty pin" TTL:
- Pin lightweight summaries (not full text) for M turns after edit.
- Example summary: file path, changed sections, intent.
- If assistant needs exact text later, fetch on-demand.

Suggested default: M = 6 turns.

## Safety + correctness
- Never drop user-authored chat text.
- Never hide that a tool call occurred.
- Preserve enough metadata so assistant can ask for missing content precisely.
- Include hash/bytes so assistant can detect when content changed.
- Diffs are the one and only artifact used for change journaling and undo.
- Journal coverage is file-change based (not tool-call based), so assistant and user/manual edits are both captured.
- inotify is signal-only; reconciler over actual file content/hashes is authoritative.
- Policy: do not use .sh scripts to modify aichat source files; shell-script-based source edits are forbidden.

## Remaining implementation plan
Phase 2: watcher-assisted diff journal + revert command surface.
1) Add touches queue (inotify signal-only) at ObAiChat/.journal/touches.ndjson.
2) Implement pre-send and post-send reconciliation that drains touches, verifies hashes, diffs baseline -> current, and appends journal entries.
3) Revert command: revert last change to <file> and revert by journal entry id using inverse diff apply.
4) Verify across assistant edits and user/manual edits on the same file, including "manual edit is last change" cases.

Phase 3: broaden stubbing + artifact store.
5) Extend size-based stubbing beyond read_file where appropriate.
6) Add local artifact store + hash index.

Phase 4: payload control.
7) Add token-budget pruner with priority rules.
8) Add on-demand chunk injection path.

## Success metrics
- Median charsSent drops significantly after first heavy tool call.
- No repeated replay of the same large payload.
- Revert actions succeed without requiring old full payloads in chat history.

## Completed checkpoints (verified)
- Repeated successful read_file payloads with identical path+sha256 are deduped in history: newest stays inline, older duplicates become compact stubs with path/bytes/sha256.
- Successful read_file tool results over 32768 bytes are replaced with a structured elision payload (includes path/bytes/sha256 and explicit refetch instruction), preventing large content replay in later sends.
