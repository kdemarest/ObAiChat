## AI Chat Topics / Hotspots

Purpose: fast map of where to edit first for common aichat tasks.

## 1) Prompt and instruction stack
- What this controls: system prompt composition, instruction layering, runtime prompt assembly.
- Primary files:
  - gptchat/SystemPrompt.md
  - gptchat/src/agent/system-prompt.js
  - gptchat/src/agent/context.js
- Secondary files:
  - gptchat/AGENTS.md
  - gptchat/src/agent/loop.js
- Typical changes:
  - Prompt wording and policy tweaks.
  - Context injection order and inclusion rules.

## 2) Chat loop and turn execution
- What this controls: request/response cycle, tool-call progression, stop/error behavior.
- Primary files:
  - gptchat/src/agent/loop.js
- Secondary files:
  - gptchat/src/agent/context.js
  - gptchat/src/tools/executor.js
- Typical changes:
  - Turn flow, retries, sequencing, and termination behavior.

## 3) Tool execution contracts
- What this controls: validation, normalization, execution behavior of tool inputs.
- Primary files:
  - gptchat/src/tools/executor.js
  - gptchat/src/tools/registry.js
- Secondary files:
  - gptchat/src/types.js
  - gptchat/SPEC.md
- Typical changes:
  - Input schema behavior, matching modes, safety checks.

## 4) Tool-result display labels and info boxes
- What this controls: how tool results are summarized in chat UI (headings, file labels, status text).
- Primary files:
  - gptchat/src/ui/chat-view.js
- Secondary files:
  - gptchat/src/tools/executor.js
  - gptchat/SPEC.md
- Typical changes:
  - Heading text, source-file labels, compact result formatting.

## 5) Provider routing and API client behavior
- What this controls: model-provider selection and request handling.
- Primary files:
  - gptchat/src/api/client.js
  - gptchat/src/api/openai.js
  - gptchat/src/api/anthropic.js
  - gptchat/src/api/chatgpt-oauth.js
- Secondary files:
  - gptchat/src/settings.js
- Typical changes:
  - Provider-specific request formats and response handling.

## 6) OAuth and credential storage
- What this controls: auth flow and persistent token handling.
- Primary files:
  - gptchat/src/auth/chatgptOAuth.js
  - gptchat/src/auth/chatgptOAuthStore.js
- Secondary files:
  - gptchat/src/api/chatgpt-oauth.js
  - gptchat/src/settings.js
- Typical changes:
  - Login flow details, token refresh, storage interactions.

## 7) Plugin startup and lifecycle wiring
- What this controls: initialization, registration, teardown.
- Primary files:
  - gptchat/src/main.js
- Secondary files:
  - gptchat/src/settings.js
  - gptchat/src/tools/registry.js
- Typical changes:
  - Startup ordering, command/view registration, reload behavior.

## 8) Settings and user-facing configuration
- What this controls: plugin options, model/provider settings, feature toggles.
- Primary files:
  - gptchat/src/settings.js
- Secondary files:
  - gptchat/src/main.js
  - gptchat/src/api/client.js
- Typical changes:
  - New settings, defaults, migration behavior.

## 9) Architecture and behavioral truth docs
- What this controls: intended architecture and required behavior definitions.
- Primary files:
  - gptchat/ARCH.md
  - gptchat/SPEC.md
- Typical changes:
  - ARCH for architecture rationale/structure.
  - SPEC Implemented updates for completed behavior changes.

## 10) Runtime-error handoff and diagnostics
- What this controls: latest runtime failure artifact handling and triage context.
- Primary files:
  - _lastErr.log (vault root)
- Secondary files:
  - gptchat/conflicts-report.md
  - efficiency.log
- Typical changes:
  - Error triage workflow and logging conventions (doc/process).

## 11) Prompt-policy and project instructions
- What this controls: project-specific AI behavior constraints.
- Primary files:
  - gptchat/AGENTS.md
- Secondary files:
  - gptchat/SystemPrompt.md
  - gptchat/leanDesign.md
- Typical changes:
  - Guardrails, workflow directives, and scope boundaries.

## 12) Cross-cutting type and contract definitions
- What this controls: shared shapes and internal typed contracts.
- Primary files:
  - gptchat/src/types.js
- Secondary files:
  - gptchat/src/tools/executor.js
  - gptchat/src/api/client.js
- Typical changes:
  - Add or tighten contract definitions to support new behavior.

## Fast “where to start” cheatsheet
- Change chat tool-result heading text:
  - gptchat/src/ui/chat-view.js
- Change search/snippet behavior:
  - Start: gptchat/src/tools/executor.js
  - Then: gptchat/src/ui/chat-view.js (display)
- Change provider/model behavior:
  - Start: gptchat/src/api/client.js + provider file
  - Then: gptchat/src/settings.js if setting exposure is needed
- Change startup wiring:
  - Start: gptchat/src/main.js
  - Then: gptchat/src/settings.js or registry wiring as needed

## Logs

- gptchat/start.log - plugin startup lifecycle trace (including init registration/execution logs and pre-start runtime errors).

- gptchat/lastErr.log - latest post-start runtime error snapshot.

- gptchat/build.log - contains aichat build failures

- gptchat/smoke.log - contains aichat post-build smoke test failures

- gptchat/sent.log - the latest outbound chat payload, including messages and tool calls.

- chatIncoming.log (vault root) - inbound chat stream response/event payloads.

- efficiency.log (vault root) - recent chat stream traffic, including tool use and response and text messages. Meant to help assess the efficiency of the chat bot vs token use.
