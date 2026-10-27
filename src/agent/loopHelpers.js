// src/agent/loopHelpers.ts
let MAX_CONVERSATION_LENGTH = 50;
let KEEP_RECENT = 40;
let DEBUG = true;
let CHAT_STREAM_CACHE_MAX_AGE_TURNS = 0;

function debugLog(app, label, data) {
  if (!DEBUG) return;
  try {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const entry = `\n--- ${label} [${timestamp}] ---\n${JSON.stringify(data, null, 2)}\n`;
    void app.vault.adapter.append(`${app.vault.configDir}/plugins/gptchat/debug.log`, entry);
  } catch {
  }
}

function ensureTalkPrefix(text) {
  const raw = String(text || "");
  if (/^\s*talk\s*:/i.test(raw)) return raw;
  return `Talk: ${raw}`;
}

function ensureTalkAndEndTurnPrefix(text) {
  const raw = String(text || "");
  if (/^\s*talkandendturn\s*:/i.test(raw)) return raw;
  return `TalkAndEndTurn: ${raw}`;
}

function isRecord6(value) {
  return typeof value === "object" && value !== null;
}

function truncateUtf8ToBytes(value, maxBytes) {
  const raw = String(value || "");
  if (maxBytes <= 0 || raw.length === 0) return "";
  const enc = new TextEncoder();
  if (enc.encode(raw).length <= maxBytes) return raw;
  let out = raw;
  while (out.length > 0 && enc.encode(out).length > maxBytes) {
    out = out.slice(0, Math.max(0, out.length - 1));
  }
  return out;
}

function buildCfcSystemMessageText(filename, content) {
  return ["Chat File Cache (CFC):", `filename: ${filename}`, "content:", content].join("\n").trim();
}

function buildCfcSystemMessagesFromEntries(entries, options = {}) {
  const truncateBytes = typeof options.truncateBytes === "number" ? options.truncateBytes : 0;
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return [];
  const out = [];
  for (const entry of list) {
    if (!isRecord6(entry)) continue;
    const filename = typeof entry.filename === "string" ? entry.filename.trim() : "";
    if (!filename) continue;
    const rawContent = typeof entry.content === "string" ? entry.content : "";
    const content = truncateBytes > 0 ? truncateUtf8ToBytes(rawContent, truncateBytes) : rawContent;
    out.push({ type: "message", role: "system", content: buildCfcSystemMessageText(filename, content) });
  }
  return out;
}

function parseCfcSystemMessageContent(text) {
  const raw = String(text || "");
  const prefix = "Chat File Cache (CFC):\nfilename: ";
  const marker = "\ncontent:\n";
  if (!raw.startsWith(prefix)) return null;
  const markerIdx = raw.indexOf(marker, prefix.length);
  if (markerIdx === -1) return null;
  const filename = raw.substring(prefix.length, markerIdx).trim();
  if (!filename) return null;
  const content = raw.substring(markerIdx + marker.length);
  return { filename, content };
}

function isCfcMessageContent(text) {
  return parseCfcSystemMessageContent(text) !== null;
}

async function hashTextSha256(content, filepath = "", callbacks = null) {
  const text = String(content || "");
  if (callbacks && typeof callbacks.onResponse === "function" && filepath) {
    // callbacks.onResponse("Hash on " + filepath);
  }
  try {
    if (globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(text);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
  }
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function isRecord7(value) {
  return typeof value === "object" && value !== null;
}

function isSearchReadFullExtract(stepInput, parsedResult) {
  const extractFromInput = isRecord6(stepInput) && typeof stepInput.extract === "string" ? stepInput.extract : "";
  if (extractFromInput.length > 0) return extractFromInput === "full";
  const extractFromResult = isRecord6(parsedResult) && typeof parsedResult.extract === "string" ? parsedResult.extract : "";
  if (extractFromResult.length > 0) return extractFromResult === "full";
  return true;
}

async function buildCfcOnlyReadToolResult(toolName, stepInput, result, callbacks = null) {
  const resultText = typeof result?.result === "string" ? result.result : "";
  const pathFromInput = isRecord6(stepInput) && typeof stepInput.path === "string" ? stepInput.path : "";
  const pathFromResult = isRecord6(result) && typeof result.path === "string" ? result.path : "";
  const path = pathFromInput || pathFromResult;
  const bytes = new TextEncoder().encode(resultText).length;
  const sha256 = await hashTextSha256(resultText, path, callbacks);

  if (toolName === "read_file") {
    return JSON.stringify({
      type: "read_file_cached",
      path,
      bytes,
      sha256,
      cfcUpdated: true,
      message: "read_file content omitted from tool_result. Look in Chat File Cache (CFC) for the fetched file content."
    });
  }

  let parsed = null;
  try {
    parsed = JSON.parse(resultText);
  } catch {
    parsed = null;
  }

  if (toolName === "search_read" && !isSearchReadFullExtract(stepInput, parsed)) {
    return null;
  }

  const selectors = Array.isArray(parsed?.entries)
    ? parsed.entries
        .map((entry, entryIndex) => {
          if (!isRecord7(entry) || typeof entry.path !== "string") return "";
          const contentMeta = isRecord7(entry.content) ? entry.content : null;
          const selector = {
            entryIndex,
            path: entry.path,
            bytes: typeof entry.bytes === "number" ? entry.bytes : null,
            sha256: typeof entry.sha256 === "string" ? entry.sha256 : "",
            truncated: entry.truncated === true,
            cfcLocator: {
              filename: entry.path,
              authority: "CFC"
            }
          };
          if (contentMeta && typeof contentMeta.lineStart === "number" && typeof contentMeta.lineEnd === "number") {
            selector.snippetSelector = {
              lineStart: contentMeta.lineStart,
              lineEnd: contentMeta.lineEnd,
              preview: typeof contentMeta.snippet === "string" ? contentMeta.snippet : ""
            };
          }
          return selector;
        })
        .filter((s) => !!s && typeof s.path === "string" && s.path.length > 0)
    : [];

  return JSON.stringify({
    type: "search_read_cached",
    path,
    query: isRecord6(parsed) && typeof parsed.query === "string" ? parsed.query : isRecord6(stepInput) && typeof stepInput.query === "string" ? stepInput.query : "",
    match: isRecord6(parsed) && typeof parsed.match === "string" ? parsed.match : isRecord6(stepInput) && typeof stepInput.match === "string" ? stepInput.match : "",
    extract: isRecord6(parsed) && typeof parsed.extract === "string" ? parsed.extract : isRecord6(stepInput) && typeof stepInput.extract === "string" ? stepInput.extract : "",
    totalMatches: isRecord6(parsed) && typeof parsed.totalMatches === "number" ? parsed.totalMatches : null,
    selectedCount: isRecord6(parsed) && typeof parsed.selectedCount === "number" ? parsed.selectedCount : selectors.length,
    selectors,
    entryPaths: selectors.map((s) => s.path),
    bytes,
    sha256,
    cfcUpdated: true,
    message: "search_read(full) content omitted from tool_result. CFC contains full-file content; snippet/frontmatter modes remain in tool_result only. Use selectors for path/line metadata."
  });
}

function buildReadFileDedupeStub(path, bytes, sha256) {
  return [
    "[read_file deduped]",
    `path: ${path}`,
    `bytes: ${bytes}`,
    `sha256: ${sha256}`,
    "summary: duplicate payload elided; newest identical read_file result is kept inline"
  ].join("\n");
}

function buildReadFileTooLargeStub(path, bytes, sha256) {
  return JSON.stringify({
    type: "read_file_elided",
    path,
    bytes,
    sha256,
    message: `this file is ${bytes} bytes long. If you need it issue a new read_file command.`,
    refetch_instruction: "issue a new read_file command"
  });
}

function isReadFileElidedPayload(content) {
  if (typeof content !== "string" || !content) return false;
  try {
    const parsed = JSON.parse(content);
    return isRecord7(parsed) && parsed.type === "read_file_elided";
  } catch {
    return false;
  }
}

function extractWrappedReadFilePath(content) {
  const text = typeof content === "string" ? content : "";
  if (!text.startsWith("[read_file]")) return "";
  const match = text.match(/^path:\s*(.+)$/m);
  return match && typeof match[1] === "string" ? match[1].trim() : "";
}

function extractWrappedReadFileContent(content) {
  const text = typeof content === "string" ? content : "";
  if (!text.startsWith("[read_file]")) return "";
  const splitAt = text.indexOf("\n\n");
  if (splitAt === -1) return "";
  return text.slice(splitAt + 2);
}

function addCachePath(out, path) {
  const raw = typeof path === "string" ? path.trim() : "";
  if (!raw) return;
  out.add(obsidian.normalizePath(raw));
}

function extractSearchReadEntryPaths(result) {
  const out = /* @__PURE__ */ new Set();
  const raw = isRecord6(result) && typeof result.result === "string" ? result.result : "";
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord7(parsed)) return out;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    for (const entry of entries) {
      if (!isRecord7(entry) || typeof entry.path !== "string") continue;
      addCachePath(out, entry.path);
    }
  } catch {
  }
  return out;
}

function emitCfcMissNotice(callbacks, toolName, paths) {
  const unique = Array.from(new Set((Array.isArray(paths) ? paths : []).filter((p) => typeof p === "string" && p.length > 0))).sort((a, b) => a.localeCompare(b));
  if (unique.length === 0) return;
}

function buildReadFileFlushedStub(path, bytes, sha256) {
  return JSON.stringify({
    type: "read_file_elided",
    reason: "manual_flush",
    path,
    bytes,
    sha256,
    message: `payload flushed from history for ${path || "(unknown path)"}. If needed, issue a new read_file command.`,
    refetch_instruction: "issue a new read_file command"
  });
}

function getActiveFilePath(app) {
  try {
    const file = app.workspace.getActiveFile();
    return file?.path ? obsidian.normalizePath(file.path) : "";
  } catch {
    return "";
  }
}

function inferCommandChainChanged(tool, input, result) {
  if (result?.isError) return false;
  return tool === "edit_file" || tool === "create_file" || tool === "rename_file" || tool === "delete_file" || tool === "set_properties" || tool === "revert_edit";
}

function inferCommandChainNoProgressSignal(tool, input, result) {
  if (inferCommandChainChanged(tool, input, result)) return "progress";
  if (tool === "edit_file" || tool === "create_file" || tool === "rename_file" || tool === "delete_file" || tool === "set_properties" || tool === "revert_edit") {
    return "stalled";
  }
  return "neutral";
}

function requiredChainString(value) {
  return typeof value === "string" ? value : "";
}

function pickChainEnvelope(toolCalls) {
  const first = Array.isArray(toolCalls) && toolCalls.length > 0 ? toolCalls[0] : null;
  const rawInput = isRecord6(first?.input) ? first.input : {};
  if (isRecord6(rawInput.command_chain)) return rawInput.command_chain;
  return {};
}

function buildCommandChainExecutionPolicy(toolCalls) {
  const envelope = pickChainEnvelope(toolCalls);
  const stepsPlanned = Array.isArray(toolCalls) ? toolCalls.length : 0;
  return {
    goal: requiredChainString(envelope.goal) || "command-chain-execution-policy",
    maxSteps: 20,
    noProgressLimit: 2,
    overallTimeoutMs: 240000,
    maxStepsDisabled: true,
    stepsPlanned
  };
}

function splitTopLevelToolInput(rawInput, stepIndex) {
  const source = isRecord6(rawInput) ? rawInput : {};
  const base = { ...source };
  const stepSource = isRecord6(source.step) ? source.step : {};

  const stepId = requiredChainString(stepSource.id || source.id) || `step-${stepIndex + 1}`;
  const timeoutMs = 60000;

  delete base.step;
  delete base.id;
  delete base.onError;
  delete base.timeoutMs;
  delete base.command_chain;
  delete base.goal;
  delete base.maxSteps;
  delete base.noProgressLimit;
  delete base.overallTimeoutMs;
  delete base.stopWhen;

  return {
    input: base,
    step: {
      id: stepId,
      timeoutMs
    }
  };
}

function buildSkippedCommandChainToolResult(reason, isError = true, cause) {
  const detail = typeof cause === "string" && cause.trim().length > 0 ? ` Skipping command due to error: ${cause}` : "";
  return {
    result: `Skipped due to command-chain stop: ${reason}.${detail}`,
    reason,
    cause,
    isError
  };
}

async function executeTopLevelToolOnceWithTimeout(app, toolName, input, onAskUser, onMultiStepEvent, timeoutMs) {
  const toolPromise = executeTool(app, toolName, input, onAskUser, onMultiStepEvent);
  const timeoutPromise = new Promise((resolve) => {
    window.setTimeout(() => resolve({ result: `Tool ${toolName} failed: timeout after ${timeoutMs}ms`, isError: true }), timeoutMs);
  });
  return await Promise.race([toolPromise, timeoutPromise]);
}

async function executeTopLevelToolWithPolicy(app, toolName, stepInput, stepMeta, onAskUser, onMultiStepEvent) {
  const result = await executeTopLevelToolOnceWithTimeout(app, toolName, stepInput, onAskUser, onMultiStepEvent, stepMeta.timeoutMs);
  return {
    result,
    attempts: 1,
    policyApplied: "stop"
  };
}

function shouldStopCommandChainForExecutionPolicy(policy, observe, lastResultIsError) {
  if (Date.now() - observe.startedAt >= policy.overallTimeoutMs) {
    return "blocked_on_error";
  }
  if (lastResultIsError || observe.hadToolErrors) {
    return "blocked_on_error";
  }
  if (observe.sawNoProgressEligibleStep && observe.consecutiveNoChange >= policy.noProgressLimit) {
    return "no_progress";
  }
  return "";
}

declareExports({
  MAX_CONVERSATION_LENGTH,
  KEEP_RECENT,
  DEBUG,
  CHAT_STREAM_CACHE_MAX_AGE_TURNS,
  debugLog,
  ensureTalkPrefix,
  ensureTalkAndEndTurnPrefix,
  isRecord6,
  truncateUtf8ToBytes,
  buildCfcSystemMessageText,
  buildCfcSystemMessagesFromEntries,
  parseCfcSystemMessageContent,
  isCfcMessageContent,
  hashTextSha256,
  buildCfcOnlyReadToolResult,
  isRecord7,
  isSearchReadFullExtract,
  buildReadFileDedupeStub,
  buildReadFileTooLargeStub,
  isReadFileElidedPayload,
  extractWrappedReadFilePath,
  extractWrappedReadFileContent,
  addCachePath,
  extractSearchReadEntryPaths,
  emitCfcMissNotice,
  buildReadFileFlushedStub,
  getActiveFilePath,
  inferCommandChainChanged,
  inferCommandChainNoProgressSignal,
  requiredChainString,
  pickChainEnvelope,
  buildCommandChainExecutionPolicy,
  splitTopLevelToolInput,
  buildSkippedCommandChainToolResult,
  executeTopLevelToolOnceWithTimeout,
  executeTopLevelToolWithPolicy,
  shouldStopCommandChainForExecutionPolicy
});


function extractSearchReadPaths(stepInput, result) {
  const out = /* @__PURE__ */ new Set();
  if (isRecord6(stepInput) && typeof stepInput.path === "string") {
    addCachePath(out, stepInput.path);
  }
  if (isRecord6(result) && typeof result.path === "string") {
    addCachePath(out, result.path);
  }
  const raw = isRecord6(result) && typeof result.result === "string" ? result.result : "";
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord7(parsed)) return out;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    for (const entry of entries) {
      if (!isRecord7(entry)) continue;
      if (typeof entry.path === "string") addCachePath(out, entry.path);
    }
  } catch {
  }
  return out;
}

function collectCacheRefreshPaths(app, toolName, stepInput, result) {
  const out = /* @__PURE__ */ new Set();
  if (toolName === "search_read") {
    let parsed = null;
    try {
      const resultText = typeof result?.result === "string" ? result.result : "";
      parsed = resultText.length > 0 ? JSON.parse(resultText) : null;
    } catch {
      parsed = null;
    }
    if (isSearchReadFullExtract(stepInput, parsed)) {
      const searchReadPaths = extractSearchReadPaths(stepInput, result);
      for (const path of searchReadPaths) out.add(path);
    }
    return out;
  }
  if (toolName === "read_file" || toolName === "create_file") {
    if (isRecord6(stepInput) && typeof stepInput.path === "string") addCachePath(out, stepInput.path);
    return out;
  }
  if (toolName === "edit_file" || toolName === "set_properties" || toolName === "get_properties" || toolName === "get_backlinks" || toolName === "open_document") {
    if (isRecord6(stepInput) && typeof stepInput.path === "string") {
      addCachePath(out, stepInput.path);
    } else {
      addCachePath(out, getActiveFilePath(app));
    }
    return out;
  }
  if (toolName === "revert_edit") {
    if (isRecord6(stepInput) && typeof stepInput.path === "string") {
      addCachePath(out, stepInput.path);
    }
    if (out.size === 0) {
      const text = isRecord6(result) && typeof result.result === "string" ? result.result : "";
      const m = text.match(/^Reverted\s+(.+?)\s+using\s+journal\s+entry\b/);
      if (m && typeof m[1] === "string") {
        addCachePath(out, m[1]);
      }
    }
    if (out.size === 0) addCachePath(out, getActiveFilePath(app));
    return out;
  }
  return out;
}

function seedCfcFromToolResult(cfc, toolName, stepInput, result, userTurnIndex) {
  if (!cfc || result?.isError) return false;

  if (toolName === "read_file") {
    const path = isRecord6(stepInput) && typeof stepInput.path === "string" ? stepInput.path : isRecord6(result) && typeof result.path === "string" ? result.path : "";
    const payload = typeof result.result === "string" ? result.result : "";
    if (!path || !payload) return false;
    cfc.set(path, {
      payload,
      lastSeenTurn: userTurnIndex,
      observedMtimeMs: null,
      observedSize: null
    });
    return true;
  }

  if (toolName === "create_file") {
    const path = isRecord6(stepInput) && typeof stepInput.path === "string" ? stepInput.path : "";
    const payload = isRecord6(stepInput) && typeof stepInput.content === "string" ? stepInput.content : "";
    if (!path) return false;
    cfc.set(path, {
      payload,
      lastSeenTurn: userTurnIndex,
      observedMtimeMs: null,
      observedSize: null
    });
    return true;
  }

  if (toolName === "search_read") {
    let parsed = null;
    try {
      const resultText = typeof result?.result === "string" ? result.result : "";
      parsed = resultText.length > 0 ? JSON.parse(resultText) : null;
    } catch {
      parsed = null;
    }
    if (!isSearchReadFullExtract(stepInput, parsed) || !isRecord6(parsed)) return false;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    let seeded = 0;
    for (const entry of entries) {
      if (!isRecord6(entry)) continue;
      const path = typeof entry.path === "string" ? entry.path : "";
      const payload = typeof entry.content === "string" ? entry.content : "";
      if (!path || !payload) continue;
      cfc.set(path, {
        payload,
        lastSeenTurn: userTurnIndex,
        observedMtimeMs: null,
        observedSize: null
      });
      seeded += 1;
    }
    return seeded > 0;
  }

  return false;
}

async function flushReadPayloadsFromHistory(messages, options) {
  const normalizedTarget = typeof options?.path === "string" ? options.path.trim() : "";
  const flushAll = options?.all === true || !normalizedTarget;
  const targetLower = normalizedTarget.toLowerCase();

  let scanned = 0;
  let flushed = 0;
  for (let mi = 0; mi < messages.length; mi++) {
    const msg = messages[mi];
    const blocks = Array.isArray(msg?.content) ? msg.content : null;
    if (!blocks) continue;
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      if (!isRecord7(block) || block.type !== "tool_result" || block.is_error) continue;
      const content = typeof block.content === "string" ? block.content : "";
      if (!content || isReadFileElidedPayload(content)) continue;
      const path = extractWrappedReadFilePath(content);
      if (!path) continue;
      scanned += 1;
      if (!flushAll && path.toLowerCase() !== targetLower) continue;
      const bytes = new TextEncoder().encode(content).length;
      const sha256 = await hashTextSha256(content);
      block.content = buildReadFileFlushedStub(path, bytes, sha256);
      flushed += 1;
    }
  }

  return {
    scanned,
    flushed,
    mode: flushAll ? "all" : "path",
    path: flushAll ? "" : normalizedTarget
  };
}

function isClosedEndTurnBoundary(messages, lastUserMessage) {
  if (!lastUserMessage || lastUserMessage.role !== "user" || !Array.isArray(lastUserMessage.content)) return false;
  const toolResults = lastUserMessage.content.filter((b) => isRecord7(b) && b.type === "tool_result");
  if (toolResults.length === 0) return false;
  const prev = messages[messages.length - 2];
  if (!prev || prev.role !== "assistant" || !Array.isArray(prev.content)) return false;
  const toolNameById = new Map();
  for (const b of prev.content) {
    if (!isRecord7(b) || b.type !== "tool_use") continue;
    const id = typeof b.id === "string" ? b.id : "";
    const name = typeof b.name === "string" ? b.name : "";
    if (id && name) {
      toolNameById.set(id, name);
    }
  }
  if (toolNameById.size === 0) return false;
  let hasTurnBoundary = false;
  for (const result of toolResults) {
    const toolUseId = typeof result.tool_use_id === "string" ? result.tool_use_id : "";
    const toolName = toolUseId ? toolNameById.get(toolUseId) || "" : "";
    if (!toolName) return false;
    if (toolName === "talkAndEndTurn" || toolName === "endturn") {
      hasTurnBoundary = true;
      continue;
    }
    if (toolName !== "talk") {
      return false;
    }
  }
  return hasTurnBoundary;
}

function hasOpenAIPendingToolContinuation(messages) {
  const last = messages[messages.length - 1];
  if (!last || !Array.isArray(last.content)) return false;
  if (last.role === "user") {
    if (isClosedEndTurnBoundary(messages, last)) {
      return false;
    }
    return last.content.some((b) => isRecord7(b) && b.type === "tool_result");
  }
  if (last.role === "assistant") {
    return last.content.some((b) => isRecord7(b) && b.type === "tool_use");
  }
  return false;
}

function describeOpenAIPendingContinuation(messages) {
  const last = messages[messages.length - 1];
  if (!last || !Array.isArray(last.content)) {
    return "pending continuation boundary detected";
  }

  if (last.role === "assistant") {
    const pendingTools = last.content.filter((b) => isRecord7(b) && b.type === "tool_use").map((b) => typeof b.name === "string" ? b.name : "").filter((name) => name.length > 0);
    if (pendingTools.length > 0) {
      const label = pendingTools.slice(0, 3).join(", ");
      const suffix = pendingTools.length > 3 ? ` (+${pendingTools.length - 3} more)` : "";
      return `previous assistant turn ended with pending tool call(s): ${label}${suffix}`;
    }
  }

  if (last.role === "user") {
    if (isClosedEndTurnBoundary(messages, last)) {
      return "turn boundary is already closed";
    }
    const pendingResults = last.content.filter((b) => isRecord7(b) && b.type === "tool_result");
    if (pendingResults.length > 0) {
      const prev = messages[messages.length - 2];
      const toolNameById = new Map();
      if (prev && prev.role === "assistant" && Array.isArray(prev.content)) {
        for (const b of prev.content) {
          if (!isRecord7(b) || b.type !== "tool_use") continue;
          const id = typeof b.id === "string" ? b.id : "";
          const name = typeof b.name === "string" ? b.name : "";
          if (id && name) toolNameById.set(id, name);
        }
      }
      const pendingNames = [];
      for (const result of pendingResults) {
        const toolUseId = typeof result.tool_use_id === "string" ? result.tool_use_id : "";
        const toolName = toolUseId ? toolNameById.get(toolUseId) || "" : "";
        if (toolName) pendingNames.push(toolName);
      }
      if (pendingNames.length > 0) {
        const label = pendingNames.slice(0, 3).join(", ");
        const suffix = pendingNames.length > 3 ? ` (+${pendingNames.length - 3} more)` : "";
        return `previous user tool result block(s) (${pendingResults.length}) were awaiting assistant continuation for tool(s): ${label}${suffix}`;
      }
      return `previous user tool result block(s) (${pendingResults.length}) were awaiting assistant continuation`;
    }
  }

  return "pending continuation boundary detected";
}



declareExports({
  extractSearchReadPaths,
  collectCacheRefreshPaths,
  seedCfcFromToolResult,
  flushReadPayloadsFromHistory,
  isClosedEndTurnBoundary,
  hasOpenAIPendingToolContinuation,
  describeOpenAIPendingContinuation
});
