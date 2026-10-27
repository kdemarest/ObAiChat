function createVanillaChatContainer(target, props) {
  const state = {
    displayModel: props?.model || "",
    agentsStatus: props?.agentsStatus || "ObAiChat",
    inputEnabled: true,
    placeholder: "Ask anything...",
    selection: null,
    askUserResolve: null,
    nextId: 0,
    messages: []
  };

  const dom = buildShell(target);
  renderHeader();
  renderInputState();

  dom.clearBtn.addEventListener("click", () => props?.onClear?.());
  dom.sendBtn.addEventListener("click", () => handleSend());
  dom.stopBtn.addEventListener("click", () => props?.onStop?.());
  dom.textarea.addEventListener("keydown", (e) => handleKeydown(e));
  dom.textarea.addEventListener("input", () => autoGrow());

  function buildShell(host) {
    host.empty();
    host.addClass("ochatting-view-container");

    const root = document.createElement("div");
    root.className = "ochatting-container";

    const header = document.createElement("div");
    header.className = "ochatting-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "ochatting-header-left";

    const title = document.createElement("span");
    title.className = "ochatting-header-title";
    title.textContent = "Chat";

    const model = document.createElement("span");
    model.className = "ochatting-header-model";

    headerLeft.appendChild(title);
    headerLeft.appendChild(model);

    const clearBtn = document.createElement("button");
    clearBtn.className = "ochatting-clear-btn";
    clearBtn.textContent = "Clear";

    header.appendChild(headerLeft);
    header.appendChild(clearBtn);

    const messagesEl = document.createElement("div");
    messagesEl.className = "ochatting-messages";

    const selectionWrap = document.createElement("div");

    const inputBar = document.createElement("div");
    inputBar.className = "ochatting-input-bar";

    const textarea = document.createElement("textarea");
    textarea.className = "ochatting-input";
    textarea.rows = 1;

    const sendBtn = document.createElement("button");
    sendBtn.className = "ochatting-send-btn";
    sendBtn.textContent = "↑";
    sendBtn.setAttribute("aria-label", "Send message");

    const stopBtn = document.createElement("button");
    stopBtn.className = "ochatting-send-btn ochatting-stop-btn";
    stopBtn.textContent = "■";
    stopBtn.setAttribute("aria-label", "Stop generation");

    inputBar.appendChild(textarea);
    inputBar.appendChild(sendBtn);
    inputBar.appendChild(stopBtn);

    root.appendChild(header);
    root.appendChild(messagesEl);
    root.appendChild(selectionWrap);
    root.appendChild(inputBar);

    host.appendChild(root);

    return {
      root,
      model,
      clearBtn,
      messagesEl,
      selectionWrap,
      inputBar,
      textarea,
      sendBtn,
      stopBtn
    };
  }

  function renderHeader() {
    const model = state.displayModel || "No model";
    const agents = state.agentsStatus || "ObAiChat";
    dom.model.textContent = `${model} • ${agents}`;
  }

  function renderInputState() {
    dom.textarea.disabled = !state.inputEnabled;
    dom.textarea.placeholder = state.placeholder;
    dom.sendBtn.style.display = state.inputEnabled ? "inline-flex" : "none";
    dom.stopBtn.style.display = state.inputEnabled ? "none" : "inline-flex";
  }

  function renderSelectionPill() {
    dom.selectionWrap.empty();
    const sel = state.selection;
    if (!sel) return;

    const pill = document.createElement("div");
    pill.className = "ochatting-selection-pill";

    const content = document.createElement("div");
    content.className = "ochatting-selection-content";

    const label = document.createElement("span");
    label.className = "ochatting-selection-label";
    label.textContent = `Selection from ${(sel.filePath || "").split("/").pop() || ""}`;

    const preview = document.createElement("span");
    preview.className = "ochatting-selection-preview";
    const p = String(sel.text || "").substring(0, 80);
    preview.textContent = `${p}${String(sel.text || "").length > 80 ? "..." : ""}`;

    const dismiss = document.createElement("button");
    dismiss.className = "ochatting-selection-dismiss";
    dismiss.setAttribute("aria-label", "Remove selection");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", () => {
      state.selection = null;
      renderSelectionPill();
    });

    content.appendChild(label);
    content.appendChild(preview);
    pill.appendChild(content);
    pill.appendChild(dismiss);
    dom.selectionWrap.appendChild(pill);
  }

  function enqueueMessage(message) {
    state.messages.push(message);
    const el = renderMessage(message);
    dom.messagesEl.appendChild(el);
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      dom.messagesEl.scrollTop = dom.messagesEl.scrollHeight;
    });
  }

  function renderMarkdown(node, text) {
    node.empty();
    obsidian.MarkdownRenderer.render(props.app, text, node, "", props.component);
  }

  function renderMessage(msg) {
    if (msg.type === "user") {
      const wrap = document.createElement("div");
      wrap.className = "ochatting-msg ochatting-user-msg";
      const content = document.createElement("div");
      content.className = "ochatting-msg-content";
      content.textContent = msg.text || "";
      wrap.appendChild(content);
      msg._el = wrap;
      return wrap;
    }

    if (msg.type === "assistant") {
      const wrap = document.createElement("div");
      wrap.className = "ochatting-msg ochatting-assistant-msg";
      const content = document.createElement("div");
      content.className = "ochatting-msg-content";
      wrap.appendChild(content);
      renderMarkdown(content, msg.text || "");
      msg._el = wrap;
      return wrap;
    }

    if (msg.type === "tool-call") {
      const wrap = document.createElement("div");
      wrap.className = "ochatting-tool-call";
      const status = document.createElement("div");
      status.className = "ochatting-tool-status";
      const name = document.createElement("span");
      name.className = "ochatting-tool-name";
      name.textContent = formatToolName(msg.toolName || "", msg.toolInput || {}, null);
      status.textContent = "⏳ ";
      status.appendChild(name);

      const details = document.createElement("details");
      details.className = "ochatting-tool-details";
      const summary = document.createElement("summary");
      summary.textContent = "Parameters";
      const pre = document.createElement("pre");
      pre.className = "ochatting-tool-json";
      pre.textContent = JSON.stringify(msg.toolInput || {}, null, 2);

      details.appendChild(summary);
      details.appendChild(pre);
      wrap.appendChild(status);
      wrap.appendChild(details);
      msg._el = wrap;
      return wrap;
    }

    if (msg.type === "tool-result") {
      return renderToolResultMessage(msg);
    }

    if (msg.type === "error") {
      const wrap = document.createElement("div");
      wrap.className = "ochatting-msg ochatting-error-msg";
      const content = document.createElement("div");
      content.className = "ochatting-msg-content";
      content.textContent = msg.text || "";
      wrap.appendChild(content);
      msg._el = wrap;
      return wrap;
    }

    const thinking = document.createElement("div");
    thinking.className = "ochatting-thinking";
    thinking.textContent = "…";
    msg._el = thinking;
    return thinking;
  }

  function renderToolResultMessage(msg) {
    const wrap = document.createElement("div");
    wrap.className = "ochatting-tool-call";

    const status = document.createElement("div");
    status.className = "ochatting-tool-status";

    const icon = document.createElement("span");
    const isError = !!msg.toolResult?.isError;
    icon.className = isError ? "ochatting-tool-error" : "ochatting-tool-success";
    icon.textContent = isError ? "✘" : "✔";

    const name = document.createElement("span");
    name.className = "ochatting-tool-name";
    name.textContent = formatToolName(msg.toolName || "", msg.toolInput || {}, msg.toolResult || null);

    status.appendChild(icon);
    status.appendChild(name);

    const details = document.createElement("details");
    details.className = "ochatting-tool-details";
    const summary = document.createElement("summary");
    summary.textContent = isError ? "Error" : "Result";

    const pre = document.createElement("pre");
    pre.className = "ochatting-tool-json";
    pre.textContent = truncate(String(msg.toolResult?.result || ""), 2000);

    details.appendChild(summary);
    details.appendChild(pre);

    wrap.appendChild(status);
    wrap.appendChild(details);
    msg._el = wrap;
    return wrap;
  }

  function findById(id) {
    return state.messages.find((m) => m.id === id);
  }

  function rerenderMessage(msg) {
    if (!msg || !msg._el || !msg._el.parentNode) return;
    const prevEl = msg._el;
    const parent = prevEl.parentNode;
    const next = renderMessage(msg);
    parent.replaceChild(next, prevEl);
    msg._el = next;
    scrollToBottom();
  }

  function handleSend() {
    const text = String(dom.textarea.value || "").trim();
    if (!text) return;

    dom.textarea.value = "";
    resetHeight();

    if (state.askUserResolve) {
      addUserMessage(text);
      const resolve = state.askUserResolve;
      state.askUserResolve = null;
      resolve(text);
      return;
    }

    const currentSelection = state.selection;
    state.selection = null;
    renderSelectionPill();
    props?.onSend?.(text, currentSelection);
  }

  function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoGrow() {
    dom.textarea.style.height = "auto";
    dom.textarea.style.height = `${Math.min(dom.textarea.scrollHeight, 300)}px`;
  }

  function resetHeight() {
    dom.textarea.style.height = "auto";
  }

  function shortName(path) {
    const p = String(path || "");
    if (!p) return "";
    const parts = p.split("/");
    if (parts.length <= 2) return p;
    return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }

  function shortText(value, max) {
    const s = String(value || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  }

  function extractSearchReadPaths(result) {
    const out = [];
    if (result && typeof result.path === "string" && result.path) out.push(result.path);
    const raw = result && typeof result.result === "string" ? result.result : "";
    if (!raw) return Array.from(new Set(out));
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) {
        for (const entry of parsed.entries) {
          if (entry && typeof entry.path === "string" && entry.path) out.push(entry.path);
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

  function formatToolName(name, input, result) {
    const rawTool = String(name || "");
    const multiPrefix = rawTool.startsWith("M ") ? "M " : "";
    const tool = multiPrefix ? rawTool.slice(2).trim() : rawTool;
    const path = typeof input?.path === "string" ? input.path : "";
    const withPrefix = (label) => multiPrefix ? `${multiPrefix}${label}` : label;

    switch (tool) {
      case "create_file":
        return withPrefix(path ? `create ${shortName(path)}` : "create file");
      case "read_file":
        return withPrefix(path ? `read ${shortName(path)}` : "read file");
      case "read_document":
        return withPrefix(path ? `read doc ${shortName(path)}` : "read doc (no path)");
      case "search_read": {
        const paths = extractSearchReadPaths(result);
        if (paths.length === 0) return withPrefix("search_read");
        return withPrefix(`search_read ${paths.map((p) => shortName(p)).join(", ")}`);
      }
      case "snippets": {
        const paths = extractSearchReadPaths(result);
        if (paths.length === 0) return withPrefix("snippets docs: (none)");
        return withPrefix(`snippets docs: ${paths.map((p) => shortName(p)).join(", ")}`);
      }
      case "edit_file": {
        const op = typeof input?.operation === "string" ? input.operation.replace(/_/g, " ") : "edit";
        return withPrefix(path ? `${op} ${shortName(path)}` : `${op} doc (no path)`);
      }
      case "rename_file": {
        const from = typeof input?.path === "string" ? shortName(input.path) : "";
        const to = typeof input?.new_path === "string" ? shortName(input.new_path) : "";
        if (from && to) return withPrefix(`rename ${from} → ${to}`);
        return withPrefix("rename file");
      }
      case "delete_file":
        return withPrefix(path ? `delete ${shortName(path)}` : "delete file");
      case "open_document":
        return withPrefix(path ? `open ${shortName(path)}` : "open document");
      case "search_vault": {
        const q = typeof input?.query === "string" ? shortText(input.query, 28) : "";
        const total = extractSearchVaultTotalMatches(result);
        if (q) return withPrefix(total === null ? `search "${q}"` : `search "${q}" (${total} found)`);
        return withPrefix(total === null ? "search vault" : `search vault (${total} found)`);
      }
      case "list_files":
        return withPrefix(input?.extension ? `list *.${String(input.extension).replace(/^\./, "")}` : "list files");
      case "get_properties":
        return withPrefix(path ? `get props ${shortName(path)}` : "get props active doc");
      case "set_properties":
        return withPrefix(path ? `set props ${shortName(path)}` : "set props active doc");
      case "get_backlinks":
        return withPrefix(path ? `backlinks ${shortName(path)}` : "backlinks active doc");
      case "agents": {
        const p = typeof input?.path === "string" ? shortText(input.path, 32) : "";
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

  function addUserMessage(text) {
    const msg = { id: state.nextId++, type: "user", text: String(text || "") };
    enqueueMessage(msg);
  }

  function addAssistantMessage(text) {
    const msg = { id: state.nextId++, type: "assistant", text: String(text || "") };
    enqueueMessage(msg);
  }

  function addToolCall(name, input) {
    const msg = {
      id: state.nextId++,
      type: "tool-call",
      toolName: name,
      toolInput: input || {}
    };
    enqueueMessage(msg);
    return msg.id;
  }

  function updateToolResult(msgId, name, result) {
    const msg = findById(msgId);
    if (!msg) return;
    try {
      msg.type = "tool-result";
      msg.toolName = name;
      msg.toolResult = result;
      rerenderMessage(msg);
    } catch (err) {
      console.error("[ObAiChat] Failed to render tool result", err);
      const detail = err && typeof err.message === "string" ? err.message : String(err || "unknown error");
      addError(`Tool UI render error: ${detail}`);
    }
  }

  function showThinking() {
    if (state.messages.some((m) => m.type === "thinking")) return;
    const msg = { id: state.nextId++, type: "thinking" };
    enqueueMessage(msg);
  }

  function hideThinking() {
    const idx = state.messages.findIndex((m) => m.type === "thinking");
    if (idx < 0) return;
    const [msg] = state.messages.splice(idx, 1);
    msg?._el?.remove();
  }

  function addError(text) {
    const msg = { id: state.nextId++, type: "error", text: String(text || "") };
    enqueueMessage(msg);
  }

  function showAskUser(question) {
    addAssistantMessage(question);
    state.placeholder = "Type your answer...";
    state.inputEnabled = true;
    renderInputState();
    focus();
    return new Promise((resolve) => {
      state.askUserResolve = resolve;
    });
  }

  function setInputEnabled(enabled) {
    state.inputEnabled = !!enabled;
    state.placeholder = enabled ? "Ask anything..." : "Waiting for response...";
    renderInputState();
    if (enabled) focus();
  }

  function clearMessages() {
    state.messages = [];
    state.selection = null;
    state.askUserResolve = null;
    dom.messagesEl.empty();
    renderSelectionPill();
  }

  function focus() {
    requestAnimationFrame(() => dom.textarea.focus());
  }

  function setModel(name) {
    state.displayModel = name || "";
    renderHeader();
  }

  function setAgentsStatus(status) {
    state.agentsStatus = status || "ObAiChat";
    renderHeader();
  }

  function setSelection(sel) {
    state.selection = sel || null;
    renderSelectionPill();
  }

  function getSelection() {
    return state.selection;
  }

  function clearSelection() {
    state.selection = null;
    renderSelectionPill();
  }

  function destroy() {
    state.messages = [];
    target.empty();
  }

  return {
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
    clearSelection,
    destroy
  };
}

declareExports({
  createVanillaChatContainer
});
