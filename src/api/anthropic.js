
registerInit("anthropic", init_anthropic);
async function sendAnthropicMessage(settings, messages, tools, systemPrompt) {
  const model = settings.model || "claude-sonnet-4-6";
  const body = {
    model,
    max_tokens: 16384,
    // System prompt as a content block with cache_control breakpoint.
    // Anthropic caches everything up to the breakpoint across requests.
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" }
      }
    ],
    messages: messages.map(toAnthropicMessage)
  };
  const is46Model = model.includes("4-6") || model.includes("4.6");
  const supportsThinking = model.includes("claude-sonnet-4") || model.includes("claude-opus") || model.includes("claude-sonnet-3-7");
  if (is46Model) {
    body.thinking = { type: "adaptive" };
  } else if (supportsThinking) {
    body.thinking = { type: "enabled", budget_tokens: 8192 };
  }
  if (tools.length > 0 || settings.enableWebSearch) {
    const apiTools = tools.map((t, i, arr) => {
      const tool = {
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema
      };
      if (i === arr.length - 1 && !settings.enableWebSearch) {
        tool.cache_control = { type: "ephemeral" };
      }
      return tool;
    });
    if (settings.enableWebSearch) {
      apiTools.push({
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
        cache_control: { type: "ephemeral" }
      });
    }
    body.tools = apiTools;
  }
  const payload = new ChatPayload(body, "anthropic", model);
  void SentLog.writeLatestSentLog(null, payload);
  const serializedBody = payload.bodyJson;
  const charsSent = payload.charCount;
  const bytesSent = payload.byteCount;
  let response;
  try {
    response = await (0, obsidian.requestUrl)({
      url: ANTHROPIC_API_URL,
      method: "POST",
      headers: {
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: serializedBody,
      throw: false
    });
  } catch (e) {
    const err = asRecord(e);
    const status = typeof err.status === "number" ? err.status : "unknown";
    const apiMsg = getNestedString(err, ["json", "error", "message"]);
    if (apiMsg) {
      const err2 = new Error(`Anthropic API error (${status}): ${apiMsg}`);
      err2.aichatTelemetry = { charsSent, bytesSent, sentLogBytes: 0 };
      throw err2;
    }
    if (e instanceof Error) {
      e.aichatTelemetry = { charsSent, bytesSent, sentLogBytes: 0 };
      throw e;
    }
    const err2 = new Error(String(e));
    err2.aichatTelemetry = { charsSent, bytesSent, sentLogBytes: 0 };
    throw err2;
  }
  if (response.status !== 200) {
    const responseJson = response.json;
    const errorText = getNestedString(responseJson, ["error", "message"]) ?? `HTTP ${response.status}`;
    const err2 = new Error(`Anthropic API error (${response.status}): ${errorText}`);
    err2.aichatTelemetry = { charsSent, bytesSent, sentLogBytes: 0 };
    throw err2;
  }
  const data = parseAnthropicResponse(response.json);
  return {
    content: data.content.map(fromAnthropicBlock).filter((b) => b !== null),
    stopReason: normalizeStopReason(data.stop_reason),
    usage: data.usage ? { inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 } : void 0,
    charsSent,
    bytesSent,
    sentLogBytes: 0
  };
}
function parseAnthropicResponse(value) {
  if (!isRecord(value)) return { content: [] };
  const content = Array.isArray(value.content) ? value.content.filter(isRecord).map(toAnthropicContentBlock) : [];
  const usage = isRecord(value.usage) ? {
    input_tokens: typeof value.usage.input_tokens === "number" ? value.usage.input_tokens : 0,
    output_tokens: typeof value.usage.output_tokens === "number" ? value.usage.output_tokens : 0
  } : void 0;
  return {
    content,
    stop_reason: typeof value.stop_reason === "string" ? value.stop_reason : void 0,
    usage
  };
}
function toAnthropicContentBlock(value) {
  return {
    type: isAnthropicBlockType(value.type) ? value.type : "text",
    text: typeof value.text === "string" ? value.text : void 0,
    thinking: typeof value.thinking === "string" ? value.thinking : void 0,
    id: typeof value.id === "string" ? value.id : void 0,
    name: typeof value.name === "string" ? value.name : void 0,
    input: isRecord(value.input) ? value.input : void 0,
    search_results: Array.isArray(value.search_results) ? value.search_results.filter(isSearchResult) : void 0
  };
}
function isAnthropicBlockType(value) {
  return value === "text" || value === "tool_use" || value === "web_search_tool_result" || value === "server_tool_use" || value === "thinking";
}
function isSearchResult(value) {
  return isRecord(value) && typeof value.title === "string" && typeof value.url === "string" && typeof value.snippet === "string";
}
function normalizeStopReason(value) {
  if (value === "tool_use" || value === "max_tokens" || value === "stop") return value;
  return "end_turn";
}
function getNestedString(value, path) {
  let current = value;
  for (const key2 of path) {
    if (!isRecord(current)) return void 0;
    current = current[key2];
  }
  return typeof current === "string" ? current : void 0;
}
function asRecord(value) {
  return isRecord(value) ? value : {};
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function toAnthropicMessage(msg) {
  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }
  const blocks = msg.content.map((block2) => {
    if (block2.type === "tool_result") {
      return {
        type: "tool_result",
        tool_use_id: block2.tool_use_id,
        content: block2.content,
        is_error: block2.is_error || false
      };
    }
    if (block2.type === "tool_use") {
      return {
        type: "tool_use",
        id: block2.id,
        name: block2.name,
        input: block2.input
      };
    }
    return { type: "text", text: block2.text };
  }).filter((b) => !(b.type === "text" && !b.text));
  return { role: msg.role, content: blocks };
}
function fromAnthropicBlock(block2) {
  if (block2.type === "tool_use") {
    return {
      type: "tool_use",
      id: block2.id,
      name: block2.name,
      input: block2.input
    };
  }
  if (block2.type === "web_search_tool_result" && block2.search_results) {
    const formatted = block2.search_results.map((r2) => `**${r2.title}**
${r2.url}
${r2.snippet}`).join("\n\n");
    return { type: "text", text: formatted };
  }
  if (block2.type === "thinking" || block2.type === "server_tool_use") {
    return null;
  }
  if (!block2.text) {
    return null;
  }
  return { type: "text", text: block2.text };
}
let ANTHROPIC_API_URL;
function init_anthropic() {
  "use strict";
  ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
}


declareExports({
  sendAnthropicMessage
});

