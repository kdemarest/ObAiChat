// node_modules/svelte/src/internal/disclose-version.js
if (typeof window !== "undefined") {
  ((window.__svelte ??= {}).v ??= /* @__PURE__ */ new Set()).add(PUBLIC_VERSION);
}

// src/ui/ChatContainer.svelte
var import_obsidian6 = require("obsidian");
var root_2 = from_html(`<div class="ochatting-msg ochatting-user-msg svelte-hkdyy7"><div class="ochatting-msg-content svelte-hkdyy7"> </div></div>`);
var root_3 = from_html(`<div class="ochatting-msg ochatting-assistant-msg svelte-hkdyy7"><div class="ochatting-msg-content svelte-hkdyy7"></div></div>`);
var root_4 = from_html(`<div class="ochatting-tool-call svelte-hkdyy7"><div class="ochatting-tool-status svelte-hkdyy7"><span class="ochatting-spinner svelte-hkdyy7"></span> <span class="ochatting-tool-name svelte-hkdyy7"> </span></div> <details class="ochatting-tool-details svelte-hkdyy7"><summary class="svelte-hkdyy7">Parameters</summary> <pre class="ochatting-tool-json svelte-hkdyy7"> </pre></details></div>`);
var root_5 = from_html(`<div class="ochatting-tool-call svelte-hkdyy7"><div class="ochatting-tool-status svelte-hkdyy7"><span> </span> <span class="ochatting-tool-name svelte-hkdyy7"> </span></div> <details class="ochatting-tool-details svelte-hkdyy7"><summary class="svelte-hkdyy7"> </summary> <pre class="ochatting-tool-json svelte-hkdyy7"> </pre></details></div>`);
var root_6 = from_html(`<div class="ochatting-msg ochatting-error-msg svelte-hkdyy7"><div class="ochatting-msg-content svelte-hkdyy7"> </div></div>`);
var root_7 = from_html(`<div class="ochatting-thinking svelte-hkdyy7"><span class="ochatting-dot svelte-hkdyy7"></span> <span class="ochatting-dot svelte-hkdyy7"></span> <span class="ochatting-dot svelte-hkdyy7"></span></div>`);
var root_8 = from_html(`<div class="ochatting-selection-pill svelte-hkdyy7"><div class="ochatting-selection-content svelte-hkdyy7"><span class="ochatting-selection-label svelte-hkdyy7"> </span> <span class="ochatting-selection-preview svelte-hkdyy7"> </span></div> <button class="ochatting-selection-dismiss svelte-hkdyy7" aria-label="Remove selection"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-hkdyy7"><line x1="18" y1="6" x2="6" y2="18" class="svelte-hkdyy7"></line><line x1="6" y1="6" x2="18" y2="18" class="svelte-hkdyy7"></line></svg></button></div>`);
var root_9 = from_html(`<button class="ochatting-send-btn svelte-hkdyy7" aria-label="Send message"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svelte-hkdyy7"><line x1="12" y1="19" x2="12" y2="5" class="svelte-hkdyy7"></line><polyline points="5 12 12 5 19 12" class="svelte-hkdyy7"></polyline></svg></button>`);
var root_10 = from_html(`<button class="ochatting-send-btn ochatting-stop-btn svelte-hkdyy7" aria-label="Stop generation"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="svelte-hkdyy7"><rect x="4" y="4" width="16" height="16" rx="2" class="svelte-hkdyy7"></rect></svg></button>`);
var root = from_html(`<div class="ochatting-container svelte-hkdyy7"><div class="ochatting-header svelte-hkdyy7"><div class="ochatting-header-left svelte-hkdyy7"><span class="ochatting-header-title svelte-hkdyy7">Chat</span> <span class="ochatting-header-model svelte-hkdyy7"> </span></div> <button class="ochatting-clear-btn svelte-hkdyy7">Clear</button></div> <div class="ochatting-messages svelte-hkdyy7"></div> <!> <div class="ochatting-input-bar svelte-hkdyy7"><textarea class="ochatting-input svelte-hkdyy7" rows="1"></textarea> <!></div></div>`);
var $$css = {
  hash: "svelte-hkdyy7",
  code: "\n  /* \u2500\u2500\u2500 Container \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-container.svelte-hkdyy7 {display:flex;flex-direction:column;height:100%;overflow:hidden;}\n\n  /* \u2500\u2500\u2500 Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-header.svelte-hkdyy7 {display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--background-modifier-border);flex-shrink:0;}.ochatting-header-left.svelte-hkdyy7 {display:flex;align-items:baseline;gap:8px;}.ochatting-header-title.svelte-hkdyy7 {font-weight:var(--font-weight-bold, 600);font-size:var(--font-ui-medium);color:var(--text-normal);}.ochatting-header-model.svelte-hkdyy7 {font-size:var(--font-ui-smaller);color:var(--text-muted);}.ochatting-clear-btn.svelte-hkdyy7 {font-size:var(--font-ui-smaller);color:var(--text-muted);background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:var(--radius-s);}.ochatting-clear-btn.svelte-hkdyy7:hover {background:var(--background-modifier-hover);color:var(--text-normal);}\n\n  /* \u2500\u2500\u2500 Messages \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-messages.svelte-hkdyy7 {flex:1 1 0;overflow-y:auto;overscroll-behavior:contain;padding:12px;display:flex;flex-direction:column;gap:8px;-webkit-user-select:text;user-select:text;}.ochatting-msg.svelte-hkdyy7 {max-width:90%;padding:8px 12px;border-radius:var(--radius-m);line-height:1.5;word-wrap:break-word;-webkit-user-select:text;user-select:text;}.ochatting-user-msg.svelte-hkdyy7 {align-self:flex-end;background:var(--interactive-accent);color:var(--text-on-accent);border-bottom-right-radius:var(--radius-s);}.ochatting-assistant-msg.svelte-hkdyy7 {align-self:flex-start;background:var(--background-secondary);color:var(--text-normal);border-bottom-left-radius:var(--radius-s);}.ochatting-assistant-msg.svelte-hkdyy7 p:first-child {margin-top:0;}.ochatting-assistant-msg.svelte-hkdyy7 p:last-child {margin-bottom:0;}.ochatting-error-msg.svelte-hkdyy7 {align-self:flex-start;background:var(--background-secondary);color:var(--text-error);border-left:3px solid var(--text-error);font-size:var(--font-ui-smaller);max-width:90%;}\n\n  /* \u2500\u2500\u2500 Tool Calls \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-tool-call.svelte-hkdyy7 {align-self:flex-start;padding:6px 10px;background:var(--background-secondary-alt);border-radius:var(--radius-s);font-size:var(--font-ui-smaller);color:var(--text-muted);max-width:90%;}.ochatting-tool-status.svelte-hkdyy7 {display:flex;align-items:center;gap:6px;}.ochatting-tool-name.svelte-hkdyy7 {font-weight:500;}.ochatting-tool-success.svelte-hkdyy7 {color:var(--text-success);}.ochatting-tool-error.svelte-hkdyy7 {color:var(--text-error);}.ochatting-tool-details.svelte-hkdyy7 {margin-top:4px;}.ochatting-tool-details.svelte-hkdyy7 summary:where(.svelte-hkdyy7) {cursor:pointer;color:var(--text-faint);font-size:var(--font-ui-smaller);}.ochatting-tool-json.svelte-hkdyy7 {margin:4px 0 0;padding:6px 8px;background:var(--background-primary);border-radius:var(--radius-s);font-size:11px;max-height:150px;overflow:auto;white-space:pre-wrap;word-break:break-all;}\n\n  /* \u2500\u2500\u2500 Spinner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-spinner.svelte-hkdyy7 {display:inline-block;width:12px;height:12px;border:2px solid var(--text-faint);border-top-color:var(--interactive-accent);border-radius:50%;\n    animation: svelte-hkdyy7-ochatting-spin 0.6s linear infinite;}\n\n  @keyframes svelte-hkdyy7-ochatting-spin {\n    to { transform: rotate(360deg); }\n  }\n\n  /* \u2500\u2500\u2500 Thinking Dots \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-thinking.svelte-hkdyy7 {align-self:flex-start;display:flex;gap:4px;padding:8px 12px;}.ochatting-dot.svelte-hkdyy7 {width:8px;height:8px;background:var(--text-faint);border-radius:50%;\n    animation: svelte-hkdyy7-ochatting-pulse 1.4s ease-in-out infinite;}.ochatting-dot.svelte-hkdyy7:nth-child(2) {animation-delay:0.2s;}.ochatting-dot.svelte-hkdyy7:nth-child(3) {animation-delay:0.4s;}\n\n  @keyframes svelte-hkdyy7-ochatting-pulse {\n    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }\n    40% { opacity: 1; transform: scale(1); }\n  }\n\n  /* \u2500\u2500\u2500 Input Bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-input-bar.svelte-hkdyy7 {display:flex;align-items:flex-end;gap:8px;padding:8px 12px;padding-bottom:calc(8px + env(safe-area-inset-bottom, 0px));border-top:1px solid var(--background-modifier-border);background:transparent;flex-shrink:0;}.ochatting-input.svelte-hkdyy7 {flex:1;resize:none;border:1.5px solid var(--background-modifier-border-hover, var(--background-modifier-border));border-radius:20px;padding:8px 16px;font-size:var(--font-ui-medium);font-family:var(--font-interface);background-color:var(--background-secondary);color:var(--text-normal);line-height:1.4;max-height:300px;overflow-y:auto;box-shadow:none;}.ochatting-input.svelte-hkdyy7:focus {outline:none;border-color:var(--interactive-accent);box-shadow:none;}.ochatting-input.svelte-hkdyy7:disabled {opacity:0.5;}.ochatting-send-btn.svelte-hkdyy7 {width:34px;height:34px;min-width:34px;min-height:34px;padding:0;border:none;border-radius:50%;background-color:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;flex-shrink:0;box-shadow:none;display:flex;align-items:center;justify-content:center;margin-bottom:1px;}.ochatting-send-btn.svelte-hkdyy7:hover {background-color:var(--interactive-accent-hover);}.ochatting-send-btn.svelte-hkdyy7:disabled {opacity:0.4;cursor:not-allowed;}.ochatting-stop-btn.svelte-hkdyy7 {background-color:var(--text-error);}.ochatting-stop-btn.svelte-hkdyy7:hover {background-color:var(--text-error);opacity:0.85;}\n\n  /* \u2500\u2500\u2500 Selection Pill \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */.ochatting-selection-pill.svelte-hkdyy7 {display:flex;align-items:center;gap:8px;margin:8px 8px 0;padding:6px 10px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:var(--radius-m);flex-shrink:0;}.ochatting-selection-content.svelte-hkdyy7 {flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}.ochatting-selection-label.svelte-hkdyy7 {font-size:var(--font-ui-smaller);color:var(--text-muted);font-weight:500;}.ochatting-selection-preview.svelte-hkdyy7 {font-size:var(--font-ui-smaller);color:var(--text-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.ochatting-selection-dismiss.svelte-hkdyy7 {flex-shrink:0;width:20px;height:20px;padding:0;border:none;border-radius:50%;background:var(--background-modifier-hover);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;}.ochatting-selection-dismiss.svelte-hkdyy7:hover {background:var(--background-modifier-border);color:var(--text-normal);}\n\n  /* \u2500\u2500\u2500 Responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n  @media (max-width: 768px) {.ochatting-msg.svelte-hkdyy7 {max-width:95%;}.ochatting-input-bar.svelte-hkdyy7 {gap:10px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom, 0px));}.ochatting-input.svelte-hkdyy7 {font-size:16px; /* Prevents iOS zoom on focus */padding:10px 16px;border-radius:22px;}.ochatting-send-btn.svelte-hkdyy7 {width:36px;height:36px;min-width:36px;min-height:36px;}\n  }"
};
function ChatContainer($$anchor, $$props) {
  push($$props, true);
  append_styles($$anchor, $$css);
  let displayModel = state("");
  let agentsStatus = state("aichat");
  let messages = state(proxy([]));
  let inputText = state("");
  let inputEnabled = state(true);
  let placeholder = state("Ask anything...");
  let messagesEl = state(void 0);
  let textareaEl = state(void 0);
  let nextId = 0;
  let selection = state(null);
  let askUserResolve = state(null);
  user_effect(() => {
    set(displayModel, $$props.model, true);
  });
  user_effect(() => {
    set(agentsStatus, $$props.agentsStatus || "gptchat", true);
  });
  user_effect(() => {
    get2(messages).length;
    if (get2(messagesEl)) {
      requestAnimationFrame(() => {
        get2(messagesEl).scrollTop = get2(messagesEl).scrollHeight;
      });
    }
  });
  function addUserMessage(text2) {
    get2(messages).push({ id: nextId++, type: "user", text: text2 });
  }
  function addAssistantMessage(text2) {
    get2(messages).push({ id: nextId++, type: "assistant", text: text2 });
  }
  function addToolCall(name, input) {
    const id = nextId++;
    get2(messages).push({ id, type: "tool-call", toolName: name, toolInput: input });
    return id;
  }
  function updateToolResult(msgId, name, result) {
    const msg = get2(messages).find((m) => m.id === msgId);
    if (msg) {
      msg.type = "tool-result";
      msg.toolName = name;
      msg.toolResult = result;
    }
  }
  function showThinking() {
    if (!get2(messages).some((m) => m.type === "thinking")) {
      get2(messages).push({ id: nextId++, type: "thinking" });
    }
  }
  function hideThinking() {
    const idx = get2(messages).findIndex((m) => m.type === "thinking");
    if (idx !== -1) get2(messages).splice(idx, 1);
  }
  function addError(text2) {
    get2(messages).push({ id: nextId++, type: "error", text: text2 });
  }
  function showAskUser(question) {
    addAssistantMessage(question);
    set(placeholder, "Type your answer...");
    set(inputEnabled, true);
    get2(textareaEl)?.focus();
    return new Promise((resolve) => {
      set(askUserResolve, resolve, true);
    });
  }
  function setInputEnabled(enabled) {
    set(inputEnabled, enabled, true);
    set(placeholder, enabled ? "Ask anything..." : "Waiting for response...", true);
    if (enabled) {
      requestAnimationFrame(() => {
        get2(textareaEl)?.focus();
      });
    }
  }
  function clearMessages() {
    set(messages, [], true);
    set(selection, null);
    hideThinking();
  }
  function focus() {
    get2(textareaEl)?.focus();
  }
  function setModel(name) {
    set(displayModel, name, true);
  }
  function setAgentsStatus(status) {
    set(agentsStatus, status || "gptchat", true);
  }
  function setSelection(sel) {
    set(selection, sel, true);
  }
  function getSelection() {
    return get2(selection);
  }
  function clearSelection() {
    set(selection, null);
  }
  function handleSend() {
    const text2 = get2(inputText).trim();
    if (!text2) return;
    set(inputText, "");
    resetHeight();
    if (get2(askUserResolve)) {
      addUserMessage(text2);
      const resolve = get2(askUserResolve);
      set(askUserResolve, null);
      resolve(text2);
      return;
    }
    const currentSelection = get2(selection);
    set(selection, null);
    $$props.onSend(text2, currentSelection);
  }
  function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
  function autoGrow() {
    if (!get2(textareaEl)) return;
    get2(textareaEl).style.height = "auto";
    get2(textareaEl).style.height = Math.min(get2(textareaEl).scrollHeight, 300) + "px";
  }
  function resetHeight() {
    if (!get2(textareaEl)) return;
    get2(textareaEl).style.height = "auto";
  }
  function renderMarkdown(node, text2) {
    node.empty();
    import_obsidian6.MarkdownRenderer.render($$props.app, text2, node, "", $$props.component);
  }
  function markdown(node, text2) {
    renderMarkdown(node, text2);
    return {
      update(newText) {
        renderMarkdown(node, newText);
      }
    };
  }
  function shortName(path) {
    const p = String(path || "");
    if (!p) return "";
    const parts = p.split("/");
    if (parts.length <= 2) return p;
    return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  function shortText(value, max = 28) {
    const s = String(value || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  }
  function extractSearchReadPaths(result) {
    const out = [];
    if (result && typeof result.path === "string" && result.path) {
      out.push(result.path);
    }
    const raw = result && typeof result.result === "string" ? result.result : "";
    if (!raw) return Array.from(new Set(out));
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) {
        for (const entry of parsed.entries) {
          if (entry && typeof entry.path === "string" && entry.path) {
            out.push(entry.path);
          }
        }
      }
    } catch {
    }
    return Array.from(new Set(out));
  }
  function extractSearchVaultTotalMatches(result) {
    const raw = result && typeof result.result === "string" ? result.result : "";
    if (!raw) return null;
    const explicit = raw.match(/total matches:\s*(\d+)/i);
    if (explicit) {
      const value = Number.parseInt(explicit[1], 10);
      return Number.isFinite(value) ? value : null;
    }
    const legacy = raw.match(/^Found\s+(\d+)\s+result\(s\)/i);
    if (legacy) {
      const value = Number.parseInt(legacy[1], 10);
      return Number.isFinite(value) ? value : null;
    }
    return null;
  }
  function formatToolName(name, input = {}, result = null) {
    const rawTool = String(name || "");
    const multiPrefix = rawTool.startsWith("M ") ? "M " : "";
    const tool = multiPrefix ? rawTool.slice(2).trim() : rawTool;
    const path = typeof input.path === "string" ? input.path : "";
    const withPrefix = (label) => multiPrefix ? `${multiPrefix}${label}` : label;

    switch (tool) {
      case "create_file":
        return withPrefix(path ? `create ${shortName(path)}` : "create file");
      case "read_file":
        return withPrefix(path ? `read ${shortName(path)}` : "read file");
      case "read_document":
        return withPrefix(path ? `read doc ${shortName(path)}` : "read active doc");
      case "search_read": {
        const paths = extractSearchReadPaths(result);
        if (paths.length === 0) return withPrefix("search_read");
        return withPrefix(`search_read ${paths.map((p) => shortName(p)).join(", ")}`);
      }
      case "edit_file": {
        const op = typeof input.operation === "string" ? input.operation.replace(/_/g, " ") : "edit";
        return withPrefix(path ? `${op} ${shortName(path)}` : `${op} active doc`);
      }
      case "rename_file": {
        const from = typeof input.path === "string" ? shortName(input.path) : "";
        const to = typeof input.new_path === "string" ? shortName(input.new_path) : "";
        if (from && to) return withPrefix(`rename ${from} → ${to}`);
        return withPrefix("rename file");
      }
      case "delete_file":
        return withPrefix(path ? `delete ${shortName(path)}` : "delete file");
      case "open_document":
        return withPrefix(path ? `open ${shortName(path)}` : "open document");
      case "search_vault": {
        const q = typeof input.query === "string" ? shortText(input.query) : "";
        const total = extractSearchVaultTotalMatches(result);
        if (q) {
          return withPrefix(total === null ? `search "${q}"` : `search "${q}" (${total} found)`);
        }
        return withPrefix(total === null ? "search vault" : `search vault (${total} found)`);
      }
      case "list_files":
        return withPrefix(input.extension ? `list *.${String(input.extension).replace(/^\./, "")}` : "list files");
      case "get_properties":
        return withPrefix(path ? `get props ${shortName(path)}` : "get props active doc");
      case "set_properties":
        return withPrefix(path ? `set props ${shortName(path)}` : "set props active doc");
      case "get_backlinks":
        return withPrefix(path ? `backlinks ${shortName(path)}` : "backlinks active doc");
      case "run_shell": {
        const action = typeof input.action === "string" ? input.action : "run";
        const cmd = typeof input.command === "string" ? shortText(input.command, 24) : "";
        return withPrefix(cmd ? `shell ${action}: ${cmd}` : `shell ${action}`);
      }
      case "agents": {
        const p = typeof input.path === "string" ? shortText(input.path, 32) : "";
        return withPrefix(p ? `agents ${p}` : "agents status");
      }
      default:
        return withPrefix(tool.replace(/_/g, " "));
    }
  }
  function truncate(str, max) {
    if (str.length <= max) return str;
    return str.substring(0, max) + "\n... (truncated)";
  }
  var $$exports = {
    addUserMessage,
    addAssistantMessage,
    addToolCall,
    updateToolResult,
    showThinking,
    hideThinking,
    addError,
    showAskUser,
    setInputEnabled,
    clearMessages,
    focus,
    setModel,
    setAgentsStatus,
    setSelection,
    getSelection,
    clearSelection
  };
  var div = root();
  var div_1 = child(div);
  var div_2 = child(div_1);
  var span = sibling(child(div_2), 2);
  var text_1 = child(span, true);
  reset(span);
  reset(div_2);
  var button = sibling(div_2, 2);
  reset(div_1);
  var div_3 = sibling(div_1, 2);
  each(div_3, 21, () => get2(messages), (msg) => msg.id, ($$anchor2, msg) => {
    var fragment = comment();
    var node_1 = first_child(fragment);
    {
      var consequent = ($$anchor3) => {
        var div_4 = root_2();
        var div_5 = child(div_4);
        var text_2 = child(div_5, true);
        reset(div_5);
        reset(div_4);
        template_effect(() => set_text(text_2, get2(msg).text));
        append($$anchor3, div_4);
      };
      var consequent_1 = ($$anchor3) => {
        var div_6 = root_3();
        var div_7 = child(div_6);
        action(div_7, ($$node, $$action_arg) => markdown?.($$node, $$action_arg), () => get2(msg).text ?? "");
        reset(div_6);
        append($$anchor3, div_6);
      };
      var consequent_2 = ($$anchor3) => {
        var div_8 = root_4();
        var div_9 = child(div_8);
        var span_1 = sibling(child(div_9), 2);
        var text_3 = child(span_1, true);
        reset(span_1);
        reset(div_9);
        var details = sibling(div_9, 2);
        var pre = sibling(child(details), 2);
        var text_4 = child(pre, true);
        reset(pre);
        reset(details);
        reset(div_8);
        template_effect(
          ($0, $1) => {
            set_text(text_3, $0);
            set_text(text_4, $1);
          },
          [
            () => formatToolName(get2(msg).toolName ?? "", get2(msg).toolInput ?? {}, get2(msg).toolResult ?? null),
            () => JSON.stringify(get2(msg).toolInput, null, 2)
          ]
        );
        append($$anchor3, div_8);
      };
      var consequent_3 = ($$anchor3) => {
        var div_10 = root_5();
        var div_11 = child(div_10);
        var span_2 = child(div_11);
        var text_5 = child(span_2, true);
        reset(span_2);
        var span_3 = sibling(span_2, 2);
        var text_6 = child(span_3, true);
        reset(span_3);
        reset(div_11);
        var details_1 = sibling(div_11, 2);
        var summary = child(details_1);
        var text_7 = child(summary, true);
        reset(summary);
        var pre_1 = sibling(summary, 2);
        var text_8 = child(pre_1, true);
        reset(pre_1);
        reset(details_1);
        reset(div_10);
        template_effect(
          ($0, $1) => {
            set_class(span_2, 1, clsx2(get2(msg).toolResult?.isError ? "ochatting-tool-error" : "ochatting-tool-success"), "svelte-hkdyy7");
            set_text(text_5, get2(msg).toolResult?.isError ? "\u2718" : "\u2714");
            set_text(text_6, $0);
            set_text(text_7, get2(msg).toolResult?.isError ? "Error" : "Result");
            set_text(text_8, $1);
          },
          [
            () => formatToolName(get2(msg).toolName ?? "", get2(msg).toolInput ?? {}, get2(msg).toolResult ?? null),
            () => truncate(get2(msg).toolResult?.result ?? "", 2e3)
          ]
        );
        append($$anchor3, div_10);
      };
      var consequent_4 = ($$anchor3) => {
        var div_12 = root_6();
        var div_13 = child(div_12);
        var text_9 = child(div_13, true);
        reset(div_13);
        reset(div_12);
        template_effect(() => set_text(text_9, get2(msg).text));
        append($$anchor3, div_12);
      };
      var consequent_5 = ($$anchor3) => {
        var div_14 = root_7();
        append($$anchor3, div_14);
      };
      if_block(node_1, ($$render) => {
        if (get2(msg).type === "user") $$render(consequent);
        else if (get2(msg).type === "assistant") $$render(consequent_1, 1);
        else if (get2(msg).type === "tool-call") $$render(consequent_2, 2);
        else if (get2(msg).type === "tool-result") $$render(consequent_3, 3);
        else if (get2(msg).type === "error") $$render(consequent_4, 4);
        else if (get2(msg).type === "thinking") $$render(consequent_5, 5);
      });
    }
    append($$anchor2, fragment);
  });
  reset(div_3);
  bind_this(div_3, ($$value) => set(messagesEl, $$value), () => get2(messagesEl));
  var node_2 = sibling(div_3, 2);
  {
    var consequent_6 = ($$anchor2) => {
      var div_15 = root_8();
      var div_16 = child(div_15);
      var span_4 = child(div_16);
      var text_10 = child(span_4);
      reset(span_4);
      var span_5 = sibling(span_4, 2);
      var text_11 = child(span_5);
      reset(span_5);
      reset(div_16);
      var button_1 = sibling(div_16, 2);
      reset(div_15);
      template_effect(
        ($0, $1) => {
          set_text(text_10, `Selection from ${$0 ?? ""}`);
          set_text(text_11, `${$1 ?? ""}${get2(selection).text.length > 80 ? "..." : ""}`);
        },
        [
          () => get2(selection).filePath.split("/").pop(),
          () => get2(selection).text.substring(0, 80)
        ]
      );
      delegated("click", button_1, () => set(selection, null));
      append($$anchor2, div_15);
    };
    if_block(node_2, ($$render) => {
      if (get2(selection)) $$render(consequent_6);
    });
  }
  var div_17 = sibling(node_2, 2);
  var textarea = child(div_17);
  remove_textarea_child(textarea);
  bind_this(textarea, ($$value) => set(textareaEl, $$value), () => get2(textareaEl));
  var node_3 = sibling(textarea, 2);
  {
    var consequent_7 = ($$anchor2) => {
      var button_2 = root_9();
      delegated("click", button_2, handleSend);
      append($$anchor2, button_2);
    };
    var alternate = ($$anchor2) => {
      var button_3 = root_10();
      delegated("click", button_3, function(...$$args) {
        $$props.onStop?.apply(this, $$args);
      });
      append($$anchor2, button_3);
    };
    if_block(node_3, ($$render) => {
      if (get2(inputEnabled)) $$render(consequent_7);
      else $$render(alternate, -1);
    });
  }
  reset(div_17);
  reset(div);
  template_effect(() => {
    const model = get2(displayModel) || "No model";
    const agents = get2(agentsStatus) || "aichat";
    set_text(text_1, `${model} • ${agents}`);
    set_attribute2(textarea, "placeholder", get2(placeholder));
    textarea.disabled = !get2(inputEnabled);
  });
  delegated("click", button, function(...$$args) {
    $$props.onClear?.apply(this, $$args);
  });
  delegated("keydown", textarea, handleKeydown);
  delegated("input", textarea, autoGrow);
  bind_value(textarea, () => get2(inputText), ($$value) => set(inputText, $$value));
  append($$anchor, div);
  return pop($$exports);
}
delegate(["click", "keydown", "input"]);

//__AI_SPLIT_SEGMENT_END__ 000010
//__AI_SPLIT_SEGMENT_START__ 000011
// src/ui/chat-view.ts
var VIEW_TYPE_CHAT = "gptchat-view";
var ObsidianChatView = class extends import_obsidian7.ItemView {
  plugin;
  chatContainer;
  running = false;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CHAT;
  }
  getDisplayText() {
    return "AI Chat";
  }
  getIcon() {
    return "message-circle";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("ochatting-view-container");
    this.chatContainer = mount(
      ChatContainer,
      {
        target: container,
        props: {
          app: this.app,
          component: this,
          provider: this.plugin.settings.provider,
          model: getModelDisplayName(this.plugin.settings.provider, this.plugin.settings.model),
          agentsStatus: await this.getAgentsStatusLabel(),
          onSend: (text2, selection) => {
            void this.handleUserMessage(text2, selection);
          },
          onClear: () => this.handleClear(),
          onStop: () => this.handleStop()
        }
      }
    );
    for (const msg of this.plugin.chatHistory) {
      switch (msg.type) {
        case "user":
          this.chatContainer.addUserMessage(msg.text);
          break;
        case "assistant":
          this.chatContainer.addAssistantMessage(msg.text);
          break;
        case "tool-result":
          if (msg.toolName && msg.toolResult) {
            const id = this.chatContainer.addToolCall(msg.toolName, msg.toolInput || {});
            this.chatContainer.updateToolResult(id, msg.toolName, msg.toolResult);
          }
          break;
        case "error":
          this.chatContainer.addError(msg.text);
          break;
      }
    }
    this.chatContainer.focus();
  }
  async onClose() {
    this.plugin.agent.abort();
    if (this.chatContainer) {
      await unmount(this.chatContainer);
      this.chatContainer = void 0;
    }
  }
  async getAgentsStatusLabel() {
    const configPath = `${this.app.vault.configDir}/plugins/gptchat/agents-path.txt`;
    let configuredPath = "";
    try {
      configuredPath = (await this.app.vault.adapter.read(configPath)).trim();
    } catch {
      configuredPath = "";
    }
    if (!configuredPath) return "aichat";

    const normalized = (0, import_obsidian7.normalizePath)(configuredPath);
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
    if (parts.length === 1) return "root";
    return "aichat";
  }
  async refreshAgentsStatus() {
    const status = await this.getAgentsStatusLabel();
    this.chatContainer?.setAgentsStatus(status);
  }
  /** Export the full transcript for debugging */
  getTranscript() {
    return this.plugin.agent.exportTranscript();
  }
  /** Programmatically send a message */
  sendMessage(text2) {
    void this.handleUserMessage(text2, this.chatContainer?.getSelection() ?? null);
  }
  /** Set the selection scope and show the pill */
  setSelection(selection) {
    this.chatContainer?.setSelection(selection);
  }
  /** Focus the input */
  focus() {
    this.chatContainer?.focus();
  }
  /** Update the model display name in the header */
  updateModel(name) {
    this.chatContainer?.setModel(name);
  }
  /** Clear conversation */
  clearConversation() {
    this.handleClear();
  }
  async handleUserMessage(text2, selection) {
    if (this.running) {
      new import_obsidian7.Notice("Please wait for the current response to complete.");
      return;
    }
    const chat = this.chatContainer;
    const history = this.plugin.chatHistory;
    this.running = true;
    chat.addUserMessage(text2);
    history.push({ type: "user", text: text2 });
    chat.setInputEnabled(false);
    const toolCallIds = /* @__PURE__ */ new Map();
    try {
      await this.plugin.agent.run(text2, {
        onThinking: () => {
          chat.showThinking();
        },
        onToolCall: (name, input) => {
          chat.hideThinking();
          
          const msgId = chat.addToolCall(name, input);
          toolCallIds.set(`latest-${name}`, msgId);
        },
        onToolResult: (name, result) => {
          const msgId = toolCallIds.get(`latest-${name}`);
          if (msgId !== void 0) {
            chat.updateToolResult(msgId, name, result);
          }
          history.push({ type: "tool-result", toolName: name, toolInput: {}, toolResult: result });
          if (name === "agents") {
            void this.refreshAgentsStatus();
          }
        },
        onResponse: (text3) => {
          chat.hideThinking();
          chat.addAssistantMessage(text3);
          history.push({ type: "assistant", text: text3 });
        },
        onAskUser: async (question) => {
          chat.hideThinking();
          chat.setInputEnabled(true);
          const answer = await chat.showAskUser(question);
          chat.setInputEnabled(false);
          return answer;
        },
        onError: (error) => {
          chat.hideThinking();
          chat.addError(error);
          history.push({ type: "error", text: error });
        }
      }, selection);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      chat.addError(`Unexpected error: ${msg}`);
      history.push({ type: "error", text: `Unexpected error: ${msg}` });
    } finally {
      this.running = false;
      chat.setInputEnabled(true);
      chat.focus();
      void this.plugin.saveChatHistory();
    }
  }
  handleStop() {
    this.plugin.agent.abort();
    this.running = false;
    const chat = this.chatContainer;
    if (chat) {
      chat.hideThinking();
      chat.setInputEnabled(true);
      chat.focus();
    }
    void this.plugin.saveChatHistory();
  }
  handleClear() {
    this.plugin.agent.abort();
    this.plugin.agent.clear();
    this.plugin.chatHistory = [];
    this.chatContainer?.clearMessages();
    this.running = false;
    this.chatContainer?.setInputEnabled(true);
    void this.plugin.saveChatHistory();
  }
};

//__AI_SPLIT_SEGMENT_END__ 000011
