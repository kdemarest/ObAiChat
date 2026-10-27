
registerInit("chatgpt_oauth", init_chatgpt_oauth, ["types", "chatgptOAuth"]);
function setChatGPTOAuthService(service) {
  oauthService = service;
}
function clearChatGPTOAuthState() {
}
let chatgptIncomingSeq = 0;
async function appendChatIncomingLogLine(line) {
  const app = typeof window !== "undefined" ? window.app : null;
  if (!app?.vault?.adapter) {
    throw new Error("chatIncoming.log unavailable: vault adapter missing");
  }
  const path = "chatIncoming.log";
  if (typeof app.vault.adapter.append === "function") {
    await app.vault.adapter.append(path, `${line}\n`);
    return;
  }
  const exists = typeof app.vault.adapter.exists === "function" ? await app.vault.adapter.exists(path) : false;
  const prior = exists && typeof app.vault.adapter.read === "function" ? await app.vault.adapter.read(path) : "";
  await app.vault.adapter.write(path, `${prior}${line}\n`);
}
async function logChatGPTOAuthIncomingEvent(eventType, payload, meta) {
  chatgptIncomingSeq += 1;
  const entry = {
    v: 1,
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    provider: "chatgpt-oauth",
    sessionId: meta?.sessionId ?? "default",
    turnId: meta?.turnId ?? "unknown",
    seq: chatgptIncomingSeq,
    eventType,
    call_id: meta?.call_id ?? null,
    payload
  };
  await appendChatIncomingLogLine(JSON.stringify(entry));
}
async function scanChatGPTOAuthWalForReplayMap(sessionId) {
  const app = typeof window !== "undefined" ? window.app : null;
  if (!app?.vault?.adapter) {
    return { totalCalls: 0, totalResults: 0, pairedCount: 0, orphanCount: 0, replayItems: [] };
  }
  const path = "chatIncoming.log";
  if (!(await app.vault.adapter.exists(path))) {
    return { totalCalls: 0, totalResults: 0, pairedCount: 0, orphanCount: 0, replayItems: [] };
  }
  const raw = await app.vault.adapter.read(path);
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const replayById = /* @__PURE__ */ new Map();
  for (const line of lines) {
    let rec = null;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (!rec || rec.provider !== "chatgpt-oauth") {
      continue;
    }
    if (sessionId && rec.sessionId !== sessionId) {
      continue;
    }
    const callId = typeof rec.call_id === "string" ? rec.call_id : null;
    if (!callId) {
      continue;
    }
    const eventType = typeof rec.eventType === "string" ? rec.eventType : "";
    const seq = Number.isFinite(rec.seq) ? rec.seq : Number.MAX_SAFE_INTEGER;
    let slot = replayById.get(callId);
    if (!slot) {
      slot = { call_id: callId, firstSeq: seq, callEventType: null, callPayload: null, resultEventTypes: [], resultPayloads: [] };
      replayById.set(callId, slot);
    }
    if (seq < slot.firstSeq) {
      slot.firstSeq = seq;
    }
    if (!slot.callPayload && (eventType.includes("tool_call") || eventType.includes("function_call") || eventType.includes("tool_use"))) {
      slot.callEventType = eventType;
      slot.callPayload = rec.payload ?? null;
      continue;
    }
    if (eventType.includes("tool_result") || eventType.includes("function_call_output")) {
      slot.resultEventTypes.push(eventType);
      slot.resultPayloads.push(rec.payload ?? null);
    }
  }
  const replayItems = Array.from(replayById.values()).sort((a, b) => a.firstSeq - b.firstSeq || a.call_id.localeCompare(b.call_id));
  let totalCalls = 0;
  let totalResults = 0;
  let pairedCount = 0;
  let orphanCount = 0;
  for (const item of replayItems) {
    const hasCall = !!item.callPayload;
    const hasResult = item.resultPayloads.length > 0;
    if (hasCall) totalCalls += 1;
    if (hasResult) totalResults += item.resultPayloads.length;
    if (hasCall && hasResult) pairedCount += 1;
    if (!hasCall && hasResult) orphanCount += 1;
  }
  return { totalCalls, totalResults, pairedCount, orphanCount, replayItems };
}
async function sendChatGPTOAuthMessage(settings, messages, tools, systemPrompt) {
  const turnId = `chatgpt-oauth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = "default";
  const walReplay = await scanChatGPTOAuthWalForReplayMap(sessionId);
  if (walReplay.orphanCount > 0 || walReplay.pairedCount > 0) {
    await logChatGPTOAuthIncomingEvent("wal.scan", {
      walOrphanCount: walReplay.orphanCount,
      walPairedCount: walReplay.pairedCount,
      walTotalCalls: walReplay.totalCalls,
      walTotalResults: walReplay.totalResults
    }, { sessionId, turnId });
  }
  if (!oauthService) {
    throw new ChatGPTOAuthError(
      "ChatGPT OAuth service is not initialized. Reload the plugin."
    );
  }
  let credential;
  try {
    credential = await oauthService.getUsableCredential();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ChatGPTOAuthError(
      `ChatGPT OAuth session expired and refresh failed. Please reconnect your ChatGPT account in settings. (${msg})`
    );
  }
  if (!credential) {
    throw new ChatGPTOAuthError(
      "ChatGPT OAuth is not connected. Open Settings -> AI Chat -> Connect ChatGPT."
    );
  }
  const model = settings.model || CHATGPT_OAUTH_DEFAULT_MODEL;
  const baseBody = {
    model,
    // Replay the full conversation each turn — Codex's `store:false` mode
    // makes server-side `previous_response_id` chaining unavailable.
    input: buildFullHistoryInput(messages),
    instructions: systemPrompt,
    // Required by the Codex backend; omitting it returns
    // 400 {"detail":"Store must be set to false"}.
    store: false,
    // Match the request shape used by other working Codex-via-OAuth clients
    // (verified against the OpenAI Codex CLI and external references). These
    // fields aren't strictly documented as required, but Codex's response
    // pipeline expects them and at least one is required for reasoning models.
    parallel_tool_calls: true
  };
  if (/^o\d/.test(model) || /^gpt-5/.test(model) || /codex/i.test(model)) {
    baseBody.reasoning = { effort: "medium", summary: "auto" };
    baseBody.include = ["reasoning.encrypted_content"];
  }
  const apiTools = tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
    // Codex backend (and the OpenAI Responses API generally) accepts
    // `strict` on function tools. Setting `false` matches what the
    // official Codex CLI / other working OAuth-Codex clients send and
    // avoids unintended structured-output validation on free-form tools.
    strict: false
  }));
  if (settings.enableWebSearch) {
    apiTools.push({ type: "web_search" });
  }
  if (apiTools.length > 0) {
    baseBody.tools = apiTools;
  }
  const requestBody = { ...baseBody, stream: true };
  const payload = new ChatPayload(requestBody, "chatgpt-oauth", model);
  void SentLog.writeLatestSentLog(null, payload);
  return sendOnce(
    payload,
    credential.accessToken,
    credential.accountId,
    sessionId,
    turnId,
    { charsSent: payload.charCount, bytesSent: payload.byteCount, sentLogBytes: 0 }
  );
}
async function sendOnce(payload, accessToken, accountId, sessionId, turnId, telemetry) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/json",
    "User-Agent": USER_AGENT2,
    originator: ORIGINATOR
  };
  if (accountId) {
    headers["ChatGPT-Account-Id"] = accountId;
  }
  let response;
  try {
    response = await (0, obsidian.requestUrl)({
      url: CODEX_RESPONSES_URL,
      method: "POST",
      headers,
      body: payload.bodyJson,
      throw: false
    });
  } catch (e) {
    const err = asRecord3(e);
    const status = typeof err.status === "number" || typeof err.status === "string" ? String(err.status) : "";
    const message = typeof err.message === "string" ? err.message : String(e);
    const out = new ChatGPTOAuthError(
      `ChatGPT OAuth request failed (${status}): ${message}`
    );
    out.aichatTelemetry = { ...(telemetry || { charsSent: 0, bytesSent: 0, sentLogBytes: 0 }) };
    throw out;
  }
  if (response.status === 401 || response.status === 403) {
    const out = new ChatGPTOAuthError(
      `ChatGPT OAuth session rejected by the server (HTTP ${response.status}). Please reconnect your ChatGPT account in settings.`
    );
    out.aichatTelemetry = { ...(telemetry || { charsSent: 0, bytesSent: 0, sentLogBytes: 0 }) };
    throw out;
  }
  if (response.status < 200 || response.status >= 300) {
    let json;
    try {
      json = asOptionalRecord(response.json);
    } catch {
      json = void 0;
    }
    const detail = json?.detail;
    const detailText = typeof detail === "string" ? detail : getNestedString3(detail, ["message"]);
    const apiMsg = detailText ?? getNestedString3(json, ["error", "message"]) ?? response.text?.slice(0, 300) ?? `HTTP ${response.status}`;
    const err = new ChatGPTOAuthError(
      `ChatGPT OAuth request failed (${response.status}): ${apiMsg}. The Codex backend may not accept the selected model or request format. Try reconnecting, picking a different model, or switching to OpenAI API Key.`
    );
    err.status = response.status;
    err.aichatTelemetry = { ...(telemetry || { charsSent: 0, bytesSent: 0, sentLogBytes: 0 }) };
    throw err;
  }
  const data = await parseResponseBody(response, sessionId, turnId);
  const parsed = fromResponsesOutput2(data);
  const charsSent = Number(telemetry?.charsSent);
  if (!Number.isFinite(charsSent) || charsSent <= 0) {
    throw new ChatGPTOAuthError("ChatGPT OAuth telemetry missing valid charsSent");
  }
  const bytesSent = Number(telemetry?.bytesSent);
  if (!Number.isFinite(bytesSent) || bytesSent <= 0) {
    throw new ChatGPTOAuthError("ChatGPT OAuth telemetry missing valid bytesSent");
  }
  const sentLogBytes = Number(telemetry?.sentLogBytes);
  return {
    ...parsed,
    charsSent,
    bytesSent,
    sentLogBytes: Number.isFinite(sentLogBytes) && sentLogBytes >= 0 ? sentLogBytes : 0
  };
}
async function parseResponseBody(response, sessionId, turnId) {
  let jsonObj;
  try {
    jsonObj = asOptionalRecord(response.json);
  } catch {
    jsonObj = void 0;
  }
  if (jsonObj && (jsonObj.output || jsonObj.id)) {
    return jsonObj;
  }
  const text2 = response.text ?? "";
  if (!text2) {
    throw new ChatGPTOAuthError("ChatGPT OAuth response was empty.");
  }
  const events = parseSSE(text2);
  const itemByIndex = /* @__PURE__ */ new Map();
  let completedResponse = null;
  let failureMessage = null;
  for (const evt of events) {
    const evtType = stringValue2(evt.type) || "event";
    const evtCallId = stringValue2(evt.call_id) || stringValue2(evt.item?.call_id) || stringValue2(evt.item?.id) || null;
    await logChatGPTOAuthIncomingEvent(evtType, evt, { sessionId, turnId, call_id: evtCallId });
    const type = stringValue2(evt.type);
    if (type === "response.output_item.done") {
      const item = asOptionalRecord(evt.item);
      if (item) {
        const key2 = outputKey(evt.output_index) ?? (stringValue2(item.id) || itemByIndex.size);
        itemByIndex.set(key2, item);
      }
    } else if (type === "response.completed") {
      completedResponse = asOptionalRecord(evt.response) ?? {};
    } else if (type === "response.incomplete") {
      completedResponse = asOptionalRecord(evt.response) ?? {};
    } else if (type === "response.failed") {
      failureMessage = getNestedString3(evt.response, ["error", "message"]) ?? "ChatGPT OAuth response failed";
    } else if (type === "error" && typeof evt.message === "string") {
      failureMessage = evt.message;
    }
  }
  if (failureMessage) throw new ChatGPTOAuthError(failureMessage);
  if (completedResponse || itemByIndex.size > 0) {
    const synthesized = {
      ...completedResponse ?? {},
      output: Array.from(itemByIndex.values())
    };
    return synthesized;
  }
  throw new ChatGPTOAuthError(
    "ChatGPT OAuth stream ended without a completed response."
  );
}
function parseSSE(text2) {
  const events = [];
  const blocks = text2.split(/\r?\n\r?\n/);
  for (const block2 of blocks) {
    if (!block2.trim()) continue;
    const lines = block2.split(/\r?\n/);
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      }
    }
    if (dataLines.length === 0) continue;
    const payload = dataLines.join("\n");
    if (payload === "[DONE]") continue;
    try {
      const event2 = JSON.parse(payload);
      if (isRecord3(event2)) events.push(event2);
    } catch {
    }
  }
  return events;
}
function buildFullHistoryInput(messages) {
  const items = [];
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (typeof msg.content === "string") {
      items.push({ type: "message", role, content: msg.content });
      continue;
    }
    for (const block2 of msg.content) {
      if (block2.type === "text" && block2.text) {
        items.push({ type: "message", role, content: block2.text });
      } else if (block2.type === "tool_use" && block2.name && block2.id) {
        items.push({
          type: "function_call",
          call_id: block2.id,
          name: block2.name,
          arguments: JSON.stringify(block2.input ?? {})
        });
      } else if (block2.type === "tool_result" && block2.tool_use_id) {
        const hasMatchingCall = items.some((it) => it?.type === "function_call" && it?.call_id === block2.tool_use_id);
        if (hasMatchingCall) {
          items.push({
            type: "function_call_output",
            call_id: block2.tool_use_id,
            output: block2.content ?? ""
          });
        } else {
          items.push({
            type: "function_call",
            call_id: block2.tool_use_id,
            name: "__orphaned_tool_result__",
            arguments: JSON.stringify({
              cause: "no_matching_function_call",
              source: "history_replay"
            })
          });
          items.push({
            type: "function_call_output",
            call_id: block2.tool_use_id,
            output: block2.content ?? ""
          });
        }
      }
    }
  }
  return items;
}
function fromResponsesOutput2(data) {
  const output = Array.isArray(data.output) ? data.output.filter(isRecord3) : [];
  const content = [];
  let hasToolCalls = false;
  for (const item of output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content.filter(isRecord3)) {
        if (part.type === "output_text" && typeof part.text === "string") {
          content.push({ type: "text", text: part.text });
        }
      }
    } else if (item.type === "function_call") {
      hasToolCalls = true;
      let input = {};
      try {
        const parsed = JSON.parse(typeof item.arguments === "string" ? item.arguments : "{}");
        input = isRecord3(parsed) ? parsed : { _raw: parsed };
      } catch {
        input = { _raw: item.arguments };
      }
      content.push({
        type: "tool_use",
        id: stringValue2(item.call_id) || stringValue2(item.id),
        name: stringValue2(item.name),
        input
      });
    }
  }
  const stopReason = hasToolCalls ? "tool_use" : "end_turn";
  const usage = isRecord3(data.usage) ? data.usage : void 0;
  return {
    content,
    stopReason,
    usage: usage ? { inputTokens: numberValue2(usage.input_tokens), outputTokens: numberValue2(usage.output_tokens) } : void 0
  };
}
function numberValue2(value) {
  return typeof value === "number" ? value : 0;
}
function stringValue2(value) {
  return typeof value === "string" ? value : "";
}
function outputKey(value) {
  return typeof value === "string" || typeof value === "number" ? value : void 0;
}
function getNestedString3(value, path) {
  let current = value;
  for (const key2 of path) {
    if (!isRecord3(current)) return void 0;
    current = current[key2];
  }
  return typeof current === "string" ? current : void 0;
}
function asRecord3(value) {
  return isRecord3(value) ? value : {};
}
function asOptionalRecord(value) {
  return isRecord3(value) ? value : void 0;
}
function isRecord3(value) {
  return typeof value === "object" && value !== null;
}
let CODEX_RESPONSES_URL, ORIGINATOR, USER_AGENT2, oauthService;
function init_chatgpt_oauth() {
  "use strict";
  CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
  ORIGINATOR = "opencode";
  USER_AGENT2 = "OpenAI/JS 4.x gptchat/0.1";
  oauthService = null;
}


declareExports({
  sendChatGPTOAuthMessage,
  setChatGPTOAuthService,
  clearChatGPTOAuthState
});

