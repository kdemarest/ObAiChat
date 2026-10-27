## Progress note
- Step 1 seam is in place in gptchat/src/ui/chat-view.js via a UI adapter that supports both engines.
- Vanilla container is active behind settings.uiEngine = "vanilla" and keeps the same ChatContainer-style method surface.
- Fixed a vanilla regression where tool-call rows could fail to transition to tool-result rows (causing stuck pending indicator and blocked interaction state). Root cause was rerenderMessage replacing against a mutated msg._el reference.
- Added a defensive try/catch in updateToolResult so a row render exception degrades to an in-chat error message instead of leaving the UI interaction state stuck.
- Build + smoke test had already passed before this fix; next validation should specifically re-test read_file/read_document tool calls and Result expansion/tap behavior on mobile.


## UI Migration Plan: Replace compiled Svelte chat-view with vanilla JS

## Goal
Rebuild the current chat UI behavior without Svelte runtime overhead, while preserving existing plugin behavior and keeping changes localized.

## Non-goals
- No redesign of chat UX.
- No provider/tool contract changes.
- No changes to AgentLoop behavior.

## Success criteria
- Chat feature behavior is functionally equivalent to current implementation.
- ObsidianChatView external behavior remains the same.
- ChatContainer public methods stay compatible:
  - addUserMessage
  - addAssistantMessage
  - addToolCall
  - updateToolResult
  - showThinking
  - hideThinking
  - addError
  - showAskUser
  - setInputEnabled
  - clearMessages
  - focus
  - setModel
  - setAgentsStatus
  - setSelection
  - getSelection
  - clearSelection

## Svelte usage audit (captured from current code)
- Single integration point: gptchat/src/ui/chat-view.js.
- ObsidianChatView uses Svelte mount/unmount directly:
  - onOpen: mount(ChatContainer, { target, props })
  - onClose: await unmount(chatContainer)
- ChatContainer is compiled output (from a .svelte source) embedded in chat-view.js.
- Runtime behavior currently provided via compiled Svelte internals:
  - reactive state updates for messages/input/header/selection
  - keyed list rendering for chat messages
  - conditional rendering per message type + send/stop button
  - delegated DOM events (click/input/keydown)
  - textarea value binding + auto-grow trigger
  - component-local CSS injection via append_styles (the giant inline CSS string)
- Obsidian-specific rendering integration inside component:
  - assistant text rendered through obsidian.MarkdownRenderer.render(...)
- Current view/API coupling that must remain unchanged:
  - ChatContainer method surface used by ObsidianChatView (all methods listed above)
  - callback props: onSend, onClear, onStop
  - header model + agents status updates
  - ask_user promise-resume behavior
- Build/runtime observation:
  - the huge size is mostly bundled Svelte runtime + compiled templates/CSS in one file
  - no eval/new Function usage found

## Plan coverage matrix (Svelte feature → vanilla replacement)
- mount/unmount lifecycle → createChatContainer(...)/destroy() called from ObsidianChatView onOpen/onClose.
- Reactive state → plain JS state object + explicit render/update helpers.
- Keyed each/if rendering → imperative renderMessage(msg) + updateToolResult(msgId) + toggle helpers.
- Event delegation/bindings → direct addEventListener on known nodes.
- append_styles CSS injection → move equivalent rules to styles.css (preferred) or one-time injected style block.
- Markdown action directive → keep explicit MarkdownRenderer.render path.
- Placeholder/input enable toggles → explicit setInputEnabled() DOM updates.
- Scroll/focus scheduling → keep requestAnimationFrame behavior.

## Dual-engine A/B setup (recommended for testing)
- Add a UI engine setting: svelte | vanilla.
- Keep one shared ChatContainer-compatible interface so ObsidianChatView wiring stays stable.
- Implement two adapters behind that interface:
  - Svelte adapter
  - Vanilla adapter
- In ObsidianChatView, select adapter by setting at onOpen time.
- Add a command to toggle engine and reopen/reload the chat view for quick A/B validation.
- Keep behavior callbacks identical across both adapters:
  - onSend
  - onClear
  - onStop
- Keep identical method surface in both adapters:
  - addUserMessage, addAssistantMessage, addToolCall, updateToolResult
  - showThinking, hideThinking, addError, showAskUser
  - setInputEnabled, clearMessages, focus
  - setModel, setAgentsStatus, setSelection, getSelection, clearSelection

Implementation note:
- Runtime toggle is ideal for A/B testing speed.
- Strict “Svelte does not execute when off” requires build-time exclusion of Svelte code from the loaded bundle.

## Recommended file structure
- gptchat/src/ui/chat-view.js
  - ObsidianChatView only (thin lifecycle + loop wiring)
- gptchat/src/ui/chat-container-vanilla.js
  - DOM construction + message rendering + input/selection interactions
- gptchat/src/ui/tool-result-formatters.js
  - formatToolName, path extraction helpers, truncation helpers
- gptchat/src/ui/dom-utils.js
  - small helpers (createEl, append, empty, safe text)

If minimizing file count is preferred, chat-container-vanilla.js can temporarily include formatters/utilities and split later.

## Next step (current)
Run focused parity validation in vanilla mode for tool lifecycle + mobile interactions: confirm read_file/read_document rows reliably transition from pending to result, Result details are tappable for every command after file reads, and swipe-right back navigation remains responsive. Then continue parity checks for ask_user promise flow, selection pill behavior, and input enable/placeholder transitions.

## Migration strategy (low risk)
### Step 1: Introduce vanilla container behind same API
- Build createChatContainer(target, props) returning the same methods used today.
- Keep methods and callback signatures identical.
- Keep current view wiring untouched except mount/unmount replacement.

### Step 2: Port core rendering paths
- User message bubble
- Assistant markdown bubble
- Tool call row (pending)
- Tool result row (success/error)
- Error row
- Thinking row

### Step 3: Port interaction behavior
- Enter to send; Shift+Enter newline
- Auto-grow textarea
- Stop button when input disabled
- Selection pill with dismiss
- Clear button

### Step 4: Port async and focus behavior
- ask_user flow promise handling
- input placeholder/state transitions
- scroll-to-bottom after message changes
- focus recovery after turn completion

### Step 5: Switch ObsidianChatView mount path
- Replace Svelte mount/unmount with create/destroy calls.
- Keep history replay logic unchanged.
- Keep agent callbacks unchanged.

### Step 6: Cleanup
- Remove compiled Svelte block from src/ui/chat-view.js.
- Keep exports unchanged:
  - VIEW_TYPE_CHAT
  - ObsidianChatView
- Ensure no change to build entry wiring.

## Behavior parity checklist
- onOpen restores chat history exactly as before.
- onToolCall and onToolResult pairing remains stable.
- ask_user prompt accepts one answer and resumes loop.
- clear behavior still shows the same post-clear assistant note.
- agents status refresh still updates header label.
- markdown rendering still uses Obsidian MarkdownRenderer.

## Risks and mitigations
- Risk: subtle ordering differences for thinking/tool rows.
  - Mitigation: preserve callback order and test with multi-tool turns.
- Risk: mobile focus/keyboard regressions.
  - Mitigation: keep requestAnimationFrame focus timing.
- Risk: result formatting drift.
  - Mitigation: move current formatter logic mostly as-is first.

## Effort estimate
- Functional parity: 1–2 days
- Polish + parity fixes: 1 day
- Final cleanup + docs: 0.5 day

Total: roughly 3–3.5 days.

## Suggested implementation order
1. Add chat-container-vanilla.js with same method API.
2. Wire ObsidianChatView to new container.
3. Port formatter helpers exactly.
4. Validate parity with a smoke script + manual test turns.
5. Delete Svelte compiled block and re-run build/smoke.

## Validation script ideas
- Open view, send simple user message, verify assistant response.
- Trigger at least 2 tool calls in one turn and verify call/result pairing.
- Trigger ask_user and verify pause/resume.
- Clear chat and confirm CFC clear message + history reset.
- Abort during generation and verify input re-enabled.

## Notes
- We do not need SSR/hydration/transition machinery for this plugin UI.
- Keeping the same ChatContainer API is the key to low-risk replacement.
