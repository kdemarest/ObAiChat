## Overview
The file ARCH.md contains an overview of top level, critical architecture of aichat.

Runtime is a single Obsidian plugin class (ChatPlugin) with a persistent AgentLoop and a mounted Svelte chat view (ObsidianChatView/ChatContainer).

## Module/runtime model
- `_preamble.js` defines a global symbol bus via declareExports() and init orchestration via registerInit()/runRegisteredInits().
- Source modules communicate through exported globals (not import graphs at runtime).
- onload runs ordered init units, migration, settings/auth setup, AgentLoop creation, history restore, then UI/commands registration.

## Core runtime objects
- ChatPlugin: lifecycle, settings/secrets, view activation, command/ribbon wiring, chat history persistence.
- AgentLoop: conversation state (`messages`), tool loop orchestration, abort/clear, transcript export, CFC management.
- ObsidianChatView + ChatContainer: UI rendering, input state, tool-call/result visualization, ask_user pause/resume bridge.

## Turn pipeline
1. UI submits user text (+ optional selection scope).
2. AgentLoop builds contextualized user message and system prompt (SystemPrompt.md + optional AGENTS-expanded context).
3. Provider client sendMessage routes to anthropic/openai/chatgpt-oauth adapter.
4. Response blocks are split into text + tool_use.
5. Tool calls execute through executeTool dispatcher (with per-step policy/timeouts/parity stop logic).
6. tool_result blocks are appended to conversation and loop continues until end_turn, talkAndEndTurn/endturn, parity stop, abort, or maxIterations.

## Provider adapters
- `api/client.js`: provider switch + retry on rate-limit signatures.
- `api/openai.js`: Responses API adapter, full-history replay encoding, WAL/event logging to chatIncoming.log, chain-recovery notes.
- `api/anthropic.js`: Messages API adapter, Anthropic block mapping, optional web search tool.
- `api/chatgpt-oauth.js`: Codex backend SSE adapter, full-history replay, OAuth credential usage.
- `auth/chatgptOAuth*.js`: device flow, refresh flow, SecretStorage-backed credential store.

## Tool subsystem
- `tools/registry.js`: JSON-schema tool catalog sent to models.
- `tools/executor.js`: name→implementation dispatch + shared step-policy helpers.
- `tools/commands/*`: vault operations, search/read variants, metadata ops, AGENTS config, journaling/revert, talk/control tools.
- `tools/shared/*`: arg normalization, path/ext filtering, search-read utilities, hashing, edit preconditions, edit journal.

## State and persistence
- Plugin settings in Obsidian plugin data + per-provider API keys in SecretStorage.
- OAuth credential in SecretStorage.
- Conversation persistence: `chat-state.json` (UI history + agent messages).
- Runtime artifacts: `ObAiChat/sent.log`, `chatIncoming.log`, `ObAiChat/start.log`, `ObAiChat/lastErr.log`, `efficiency.log`, edit journal (`ObAiChat/.journal/edits.ndjson`).
- CFC (Chat File Cache) is maintained in-loop from successful reads/mutations and injected into provider requests as system-context payload.