## CFC Refactor Plan

## New file
- Create ObAiChat/src/agent/chatFileCache.js.
- Add class ChatFileCache as the single authority for all CFC state and behavior.
- Export ChatFileCache via declareExports and register in ObAiChat/GLOBALS.md.

## What moves into ChatFileCache
From ObAiChat/src/agent/loop.js and ObAiChat/src/api/openai.js, move all CFC logic into ChatFileCache methods, including:
- storage state (map + invalidated paths)
- add/update/remove/clear entries
- external-mutation invalidation checks
- refresh from tool outcomes (read/create/edit/rename/delete/search_read full)
- edit precondition generation/injection
- request payload entry generation
- CFC-to-system-message rendering for API input
- sent.log CFC sanitization/truncation helpers
- any CFC parse/format helpers

## One-instance flow (no other CFC passing)
- AgentLoop constructor creates one ChatFileCache instance.
- AgentLoop passes only that instance downward.
- Remove cfcPayload objects entirely (no section, no entries object passed around).
- Replace with signatures like:
  - sendMessage(settings, messages, tools, systemPrompt, chatFileCache)
  - sendOpenAIMessage(..., chatFileCache)
- OpenAI adapter asks chatFileCache for the system messages to inject.

## AgentLoop changes
File: ObAiChat/src/agent/loop.js
- Delete in-file CFC helpers and CFC state fields.
- Replace with this.cfc (ChatFileCache instance).
- Route all current CFC touchpoints through this.cfc:
  - on read/search_read success
  - on edit/rename/delete/flush/clear/api_error/end_turn invalidations
  - on request build (for sent.log + provider send)
- Keep loop orchestration behavior unchanged.

## API layer changes
Files:
- ObAiChat/src/api/client.js
- ObAiChat/src/api/openai.js
- ObAiChat/src/api/anthropic.js
- ObAiChat/src/api/chatgpt-oauth.js

Changes:
- Thread chatFileCache instance through client/provider call chain.
- OpenAI uses chatFileCache-provided CFC system messages directly.
- Remove any leftover CFC aggregation/splitting/regex parsing logic from adapters.

## Cleanup + docs
- Remove dead CFC helpers left in loop/openai.
- Update ObAiChat/SPEC.md and ObAiChat/TOPICS.md to state: CFC is class-owned and passed only by ChatFileCache instance.
- Optional: add a short forbidden-patterns note in AGENTS.md (no CFC payload structs/strings outside ChatFileCache).