
registerInit("openai", init_openai);
function clearOpenAIState() {
  previousResponseId = null;
}
function noteOpenAIRecoveryAttempt(note) {
  if (!note) return;
  openaiRecoveryNotes.push(String(note));
}
function consumeOpenAIRecoveryNotes() {
  const out = openaiRecoveryNotes.slice();
  openaiRecoveryNotes.length = 0;
  return out;
}
let openAIIncomingSeq = 0;
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
async function logOpenAIIncomingEvent(eventType, payload, meta) {
  openAIIncomingSeq += 1;
  const entry = {
    v: 1,
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    provider: "openai",
    sessionId: meta?.sessionId ?? "default",
    turnId: meta?.turnId ?? "unknown",
    seq: openAIIncomingSeq,
    eventType,
    call_id: meta?.call_id ?? null,
    payload
  };
  await appendChatIncomingLogLine(JSON.stringify(entry));
}
async function logOpenAIInboundResponse(data, meta) {
  const output = Array.isArray(data.output) ? data.output.filter(isRecord2) : [];
  for (const item of output) {
    const type = stringValue2(item.type) || "output_item";
    const callId = typeof item.call_id === "string" ? item.call_id : null;
    await logOpenAIIncomingEvent(`response.${type}`, item, { ...meta, call_id: callId });
  }
}
async function scanOpenAIWalForReplayMap(sessionId) {
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
    if (!rec || rec.provider !== "openai") {
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
    if (!slot.callPayload && (eventType.includes("function_call") || eventType.includes("tool_call"))) {
      slot.callEventType = eventType;
      slot.callPayload = rec.payload ?? null;
      continue;
    }
    if (eventType.includes("function_call_output") || eventType.includes("tool_result")) {
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
async function sendOpenAIMessage(settings, messages, tools, systemPrompt, chatFileCache, app = null) {
  return sendOpenAIMessageAttempt(settings, messages, tools, systemPrompt, chatFileCache, true, app);
}
async function sendOpenAIMessageAttempt(settings, messages, tools, systemPrompt, chatFileCache, allowChainResetRetry, app = null) {
  const turnId = `openai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = "default";
  const walReplay = await scanOpenAIWalForReplayMap(sessionId);
  if (walReplay.orphanCount > 0 || walReplay.pairedCount > 0) {
    noteOpenAIRecoveryAttempt(`WAL scan: ${walReplay.pairedCount} paired call_id group${walReplay.pairedCount === 1 ? "" : "s"}, ${walReplay.orphanCount} orphan tool_result group${walReplay.orphanCount === 1 ? "" : "s"}.`);
    await logOpenAIIncomingEvent("wal.scan", {
      walOrphanCount: walReplay.orphanCount,
      walPairedCount: walReplay.pairedCount,
      walTotalCalls: walReplay.totalCalls,
      walTotalResults: walReplay.totalResults
    }, { sessionId, turnId });
  }
  const baseUrl = DEFAULT_OPENAI_URL;
  const model = settings.model || "gpt-5.3-codex";
  const input = await buildCurrentTurnInput(messages, systemPrompt, chatFileCache, app);
  const body = {
    model,
    instructions: systemPrompt,
    input
  };
  delete body.previous_response_id;
  delete body.previousResponseId;

  if (/^o\d/.test(model) || /^gpt-5/.test(model)) {
    body.reasoning = { effort: "medium" };
  }
  const apiTools = tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.inputSchema
  }));
  if (settings.enableWebSearch) {
    apiTools.push({ type: "web_search_preview" });
  }
  if (apiTools.length > 0) {
    body.tools = apiTools;
  }

  const payload = new ChatPayload(body, "openai", model);
  void SentLog.writeLatestSentLog(app, payload);
  const serializedBody = payload.bodyJson;
  const charsSent = payload.charCount;
  const bytesSent = payload.byteCount;
  let response;
  try {
    response = await (0, obsidian.requestUrl)({
      url: `${baseUrl}/v1/responses`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: serializedBody,
      throw: false
    });
  } catch (e) {
    const err = asRecord2(e);
    const status = typeof err.status === "number" || typeof err.status === "string" ? String(err.status) : "";
    const message = typeof err.message === "string" ? err.message : String(e);
    const apiMsg = getNestedString2(err, ["json", "error", "message"]);
    const combined = `${apiMsg || ""} ${message || ""}`.trim();
    if (allowChainResetRetry && shouldResetOpenAIChain(status, combined)) {
      noteOpenAIRecoveryAttempt(`OpenAI retry attempt: reset response chain after ${status || "unknown"} chain-desync error.`);
      previousResponseId = null;
      return sendOpenAIMessageAttempt(settings, messages, tools, systemPrompt, chatFileCache, false, app);
    }
    if (apiMsg) {
      const err2 = new Error(`OpenAI API error (${status || "unknown"}): ${apiMsg}`);
      err2.aichatTelemetry = { charsSent, bytesSent };
      throw err2;
    }
    const err2 = new Error(`OpenAI request failed (${status}): ${message}`);
    err2.aichatTelemetry = { charsSent, bytesSent };
    throw err2;
  }
  if (response.status !== 200) {
    const errorBody = getNestedString2(response.json, ["error", "message"]) ?? `HTTP ${response.status}`;
    if (allowChainResetRetry && shouldResetOpenAIChain(String(response.status), errorBody)) {
      noteOpenAIRecoveryAttempt(`OpenAI retry attempt: reset response chain after ${response.status} chain-desync error.`);
      previousResponseId = null;
      return sendOpenAIMessageAttempt(settings, messages, tools, systemPrompt, chatFileCache, false, app);
    }
    const err2 = new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    err2.aichatTelemetry = { charsSent, bytesSent };
    throw err2;
  }
  const data = asRecord2(response.json);
  await logOpenAIInboundResponse(data, { sessionId, turnId });
  previousResponseId = null;
  const parsed = fromResponsesOutput(data);
  return { ...parsed, charsSent, bytesSent };
}
function shouldResetOpenAIChain(status, message) {
  const s = String(status || "").trim();
  const m = String(message || "").toLowerCase();
  const statusSuggestsChainIssue = s === "400" || s === "404" || s === "409" || s === "410";
  if (!statusSuggestsChainIssue) return false;

  const hasPreviousIdIssue = m.includes("previous_response_id") || m.includes("response id") && (m.includes("invalid") || m.includes("not found") || m.includes("expired"));
  const hasToolChainIssue = m.includes("function_call_output") || m.includes("tool call") && m.includes("call_id") || m.includes("tool output") && m.includes("function call");

  return hasPreviousIdIssue || hasToolChainIssue;
}
async function buildCurrentTurnInput(messages, systemPrompt, chatFileCache, app = null) {
  const items = [];
  const replayItems = [];

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (typeof msg.content === "string") {
      const text2 = msg.content;
      if (text2) {
        replayItems.push({
          type: "message",
          role,
          content: text2
        });
      }
      continue;
    }
    for (const block2 of msg.content) {
      if (block2.type === "text" && block2.text) {
        replayItems.push({
          type: "message",
          role,
          content: block2.text
        });
      } else if (block2.type === "tool_use" && block2.name && block2.id) {
        replayItems.push({
          type: "function_call",
          call_id: block2.id,
          name: block2.name,
          arguments: JSON.stringify(block2.input ?? {})
        });
      } else if (block2.type === "tool_result" && block2.tool_use_id) {
        const hasMatchingCall = replayItems.some((it) => it?.type === "function_call" && it?.call_id === block2.tool_use_id);
        if (hasMatchingCall) {
          replayItems.push({
            type: "function_call_output",
            call_id: block2.tool_use_id,
            output: block2.content || ""
          });
        } else {
          replayItems.push({
            type: "function_call",
            call_id: block2.tool_use_id,
            name: "__orphaned_tool_result__",
            arguments: JSON.stringify({
              cause: "no_matching_function_call",
              source: "history_replay"
            })
          });
          replayItems.push({
            type: "function_call_output",
            call_id: block2.tool_use_id,
            output: block2.content || ""
          });
        }
      }
    }
  }

  const cfcEntries = await chatFileCache.buildEntriesForRequest(messages, 0, app);
  const cfcSystemMessages = chatFileCache.buildSystemMessagesFromEntries(cfcEntries);
  if (cfcSystemMessages.length > 0) {
    for (const cfcMessage of cfcSystemMessages) {
      items.push(cfcMessage);
    }
  } else {
    items.push({
      type: "message",
      role: "system",
      content: "Chat File Cache (CFC):\n(empty)"
    });
  }

  items.push(...replayItems);
  return items;
}
function fromResponsesOutput(data) {
  const output = Array.isArray(data.output) ? data.output.filter(isRecord2) : [];
  const content = [];
  let hasToolCalls = false;
  for (const item of output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content.filter(isRecord2)) {
        if (part.type === "output_text" && typeof part.text === "string") {
          content.push({ type: "text", text: part.text });
        }
      }
    } else if (item.type === "function_call") {
      hasToolCalls = true;
      let input = {};
      try {
        const parsed = JSON.parse(typeof item.arguments === "string" ? item.arguments : "{}");
        input = isRecord2(parsed) ? parsed : { _raw: parsed };
      } catch {
        input = { _raw: item.arguments };
      }
      content.push({
        type: "tool_use",
        id: stringValue(item.call_id) || stringValue(item.id),
        name: stringValue(item.name),
        input
      });
    }
  }
  const stopReason = hasToolCalls ? "tool_use" : "end_turn";
  const usage = isRecord2(data.usage) ? data.usage : void 0;
  const inputTokens = usage ? numberValue(usage.input_tokens) : 0;
  const outputTokens = usage ? numberValue(usage.output_tokens) : 0;
  const totalTokens = usage
    ? (typeof usage.total_tokens === "number" ? numberValue(usage.total_tokens) : inputTokens + outputTokens)
    : 0;
  return {
    content,
    stopReason,
    usage: usage ? { inputTokens, outputTokens, totalTokens } : void 0
  };
}
function numberValue(value) {
  return typeof value === "number" ? value : 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : "";
}
function getNestedString2(value, path) {
  let current = value;
  for (const key2 of path) {
    if (!isRecord2(current)) return void 0;
    current = current[key2];
  }
  return typeof current === "string" ? current : void 0;
}
function asRecord2(value) {
  return isRecord2(value) ? value : {};
}
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
let DEFAULT_OPENAI_URL, previousResponseId, openaiRecoveryNotes;
function init_openai() {
  "use strict";
  DEFAULT_OPENAI_URL = "https://api.openai.com";
  previousResponseId = null;
  openaiRecoveryNotes = [];
}


declareExports({
  sendOpenAIMessage,
  clearOpenAIState,
  consumeOpenAIRecoveryNotes
});

