## AI Chat Topics / Hotspots

Purpose: fast map of where to edit first for common aichat tasks.

## 1) Prompt and instruction stack
- What this controls: system prompt composition, instruction layering, runtime prompt assembly.
- Primary files:
  - ObAiChat/SystemPrompt.md
  - ObAiChat/src/agent/system-prompt.js
  - ObAiChat/src/agent/context.js
- Secondary files:
  - ObAiChat/AGENTS.md
  - ObAiChat/src/agent/loop.js
- Typical changes:
  - Prompt wording and policy tweaks.
  - Context injection order and inclusion rules.

## 2) Chat loop and turn execution
- What this controls: request/response cycle, tool-call progression, stop/error behavior.
- Primary files:
  - ObAiChat/src/agent/loop.js
- Secondary files:
  - ObAiChat/src/agent/context.js
  - ObAiChat/src/tools/executor.js
- Typical changes:
  - Turn flow, retries, sequencing, and termination behavior.

## 3) Tool execution contracts
- What this controls: validation, normalization, execution behavior of tool inputs.
- Primary files:
  - ObAiChat/src/tools/executor.js
  - ObAiChat/src/tools/registry.js
- Secondary files:
  - ObAiChat/src/types.js
  - ObAiChat/SPEC.md
- Typical changes:
  - Input schema behavior, matching modes, safety checks.

## 4) Tool-result display labels and info boxes
- What this controls: how tool results are summarized in chat UI (headings, file labels, status text).
- Primary files:
  - ObAiChat/src/ui/chat-view.js
- Secondary files:
  - ObAiChat/src/tools/executor.js
  - ObAiChat/SPEC.md
- Typical changes:
  - Heading text, source-file labels, compact result formatting.

## 5) Provider routing and API client behavior
- What this controls: model-provider selection and request handling.
- Primary files:
  - ObAiChat/src/api/client.js
  - ObAiChat/src/api/openai.js
  - ObAiChat/src/api/anthropic.js
  - ObAiChat/src/api/chatgpt-oauth.js
- Secondary files:
  - ObAiChat/src/settings.js
- Typical changes:
  - Provider-specific request formats and response handling.

## 6) OAuth and credential storage
- What this controls: auth flow and persistent token handling.
- Primary files:
  - ObAiChat/src/auth/chatgptOAuth.js
  - ObAiChat/src/auth/chatgptOAuthStore.js
- Secondary files:
  - ObAiChat/src/api/chatgpt-oauth.js
  - ObAiChat/src/settings.js
- Typical changes:
  - Login flow details, token refresh, storage interactions.

## 7) Plugin startup and lifecycle wiring
- What this controls: initialization, registration, teardown.
- Primary files:
  - ObAiChat/src/main.js
- Secondary files:
  - ObAiChat/src/settings.js
  - ObAiChat/src/tools/registry.js
- Typical changes:
  - Startup ordering, command/view registration, reload behavior.

## 8) Settings and user-facing configuration
- What this controls: plugin options, model/provider settings, feature toggles.
- Primary files:
  - ObAiChat/src/settings.js
- Secondary files:
  - ObAiChat/src/main.js
  - ObAiChat/src/api/client.js
- Typical changes:
  - New settings, defaults, migration behavior.

## 9) Architecture and behavioral truth docs
- What this controls: intended architecture and required behavior definitions.
- Primary files:
  - ObAiChat/ARCH.md
  - ObAiChat/SPEC.md
- Typical changes:
  - ARCH for architecture rationale/structure.
  - SPEC Implemented updates for completed behavior changes.

## 10) Runtime-error handoff and diagnostics
- What this controls: latest runtime failure artifact handling and triage context.
- Primary files:
  - _lastErr.log (vault root)
- Secondary files:
  - ObAiChat/conflicts-report.md
  - efficiency.log
- Typical changes:
  - Error triage workflow and logging conventions (doc/process).

## 11) Prompt-policy and project instructions
- What this controls: project-specific AI behavior constraints.
- Primary files:
  - ObAiChat/AGENTS.md
- Secondary files:
  - ObAiChat/SystemPrompt.md
  - ObAiChat/leanDesign.md
- Typical changes:
  - Guardrails, workflow directives, and scope boundaries.

## 12) Cross-cutting type and contract definitions
- What this controls: shared shapes and internal typed contracts.
- Primary files:
  - ObAiChat/src/types.js
- Secondary files:
  - ObAiChat/src/tools/executor.js
  - ObAiChat/src/api/client.js
- Typical changes:
  - Add or tighten contract definitions to support new behavior.

## Fast “where to start” cheatsheet
- Change chat tool-result heading text:
  - ObAiChat/src/ui/chat-view.js
- Change search/snippet behavior:
  - Start: ObAiChat/src/tools/executor.js
  - Then: ObAiChat/src/ui/chat-view.js (display)
- Change provider/model behavior:
  - Start: ObAiChat/src/api/client.js + provider file
  - Then: ObAiChat/src/settings.js if setting exposure is needed
- Change startup wiring:
  - Start: ObAiChat/src/main.js
  - Then: ObAiChat/src/settings.js or registry wiring as needed

## Logs

- ObAiChat/start.log - plugin startup lifecycle trace (including init registration/execution logs and pre-start runtime errors).

- ObAiChat/lastErr.log - latest post-start runtime error snapshot.

- ObAiChat/build.log - contains aichat build failures

- ObAiChat/smoke.log - contains aichat post-build smoke test failures

- ObAiChat/sent.log - the latest outbound chat payload, including messages and tool calls.

- chatIncoming.log (vault root) - inbound chat stream response/event payloads.

- efficiency.log (vault root) - recent chat stream traffic, including tool use and response and text messages. Meant to help assess the efficiency of the chat bot vs token use.
