## Overview

The file SPEC.md is a major-feature snapshot of aichat. This file is intentionally terse for fast orientation by experienced developers.

Do not note every little thing you implement here.

## Runtime Architecture

- Single Obsidian plugin runtime: ChatPlugin + persistent AgentLoop + Svelte chat view.
- Build model is brace-wrapped globals with declareExports/registerInit/runRegisteredInits.
- No runtime coupling to sibling projects.

## Turn Engine

- User turn -> context/system prompt assembly -> provider call -> tool-use loop -> stop.
- Supports tool chaining, per-step policy/timeouts, parity stop handling, and abort.
- talkAndEndTurn is a hard turn boundary.

## Providers

- Anthropic Messages adapter.
- OpenAI Responses adapter (stateless full-history replay).
- ChatGPT OAuth Codex adapter (SSE parsing + full-history replay).
- Provider routing with bounded retry on rate-limit signatures.

## Tooling Surface

- Vault/file ops: read, search, edit, create, rename, delete, open, list.
- Metadata ops: get/set frontmatter properties, backlinks.
- Session/control ops: agents, ask_user, talk, talkAndEndTurn, flush, revert_edit.
- Search variants are intentionally split: search_read (full), snippets, frontmatter.

## Chat File Cache (CFC)

- Maintains authoritative per-file content for prompt injection.
- read_file and search_read(full) are CFC-backed; full payloads are omitted from chat tool_result when cached.
- CFC entry removal is centralized through cfcRemoveEntry(entryName, reason).
- CFC full clear is centralized through cfcRemoveAll(reason), which removes entries via cfcRemoveEntry.
- reason is required for both removal APIs.
- CFC file content must not be trimmed.

## Edit Safety + Recovery

- edit_file supports replace_all/find_replace/insert with normalized fallback options.
- CFC-aware edit precondition guard blocks edits when file changed since cached snapshot.
- Assistant edits are journaled (append-only) and revertable via revert_edit.

## Persistence + Diagnostics

- Conversation state persisted (chat-state.json).
- Request snapshot persisted (ObAiChat/sent.log).
- Inbound provider events persisted (chatIncoming.log WAL-style).
- Startup/runtime/error telemetry: ObAiChat/start.log, ObAiChat/lastErr.log, efficiency.log.

## Build/Operational Constraints

- assembled-plugin.js is generated output and must not be edited.
- Use Obsidian APIs (mobile-safe), not Node/Electron runtime APIs.
- Secrets remain in Obsidian SecretStorage only.