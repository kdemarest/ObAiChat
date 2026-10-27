registerInit("client", init_client, ["anthropic", "openai", "chatgpt_oauth"]);

function summarizeTelemetryPayload(value) {
  if (value === null) return "null";
  if (value === void 0) return "undefined";
  if (Array.isArray(value)) return `array(len=${value.length})`;
  if (typeof value === "object") {
    try {
      const keys = Object.keys(value);
      return `object(keys=${keys.join(",") || "(none)"})`;
    } catch {
      return "object(uninspectable)";
    }
  }
  return `${typeof value}(${String(value)})`;
}

function readAichatTelemetry(value, context = "unknown") {
  if (typeof value !== "object" || value === null) {
    throw new Error(`AI response telemetry missing object payload (${context}); got ${summarizeTelemetryPayload(value)}`);
  }
  const charsSent = value.charsSent;
  if (typeof charsSent !== "number" || !Number.isFinite(charsSent) || charsSent <= 0) {
    throw new Error(`AI response telemetry missing valid charsSent (${context}); got ${summarizeTelemetryPayload(charsSent)}`);
  }
  const bytesSent = value.bytesSent;
  if (typeof bytesSent !== "number" || !Number.isFinite(bytesSent) || bytesSent <= 0) {
    throw new Error(`AI response telemetry missing valid bytesSent (${context}); got ${summarizeTelemetryPayload(bytesSent)}`);
  }
  return { charsSent, bytesSent };
}

function rethrowWithTelemetryDiagnostics(error, telemetryPayload, context, diagnosticsCause = null) {
  const baseError = error instanceof Error ? error : new Error(String(error));
  const baseStack = baseError.stack || `${baseError.name}: ${baseError.message}`;
  const payloadSummary = summarizeTelemetryPayload(telemetryPayload);
  const diagnosticsMessage = diagnosticsCause instanceof Error
    ? diagnosticsCause.message
    : String(diagnosticsCause || "(none)");

  const loud = new Error(
    [
      `AI response telemetry validation failed in ${context}.`,
      `telemetryPayload=${payloadSummary}`,
      `originalError=${baseError.name}: ${baseError.message}`,
      `telemetryValidationError=${diagnosticsMessage}`,
      `originalStack:\n${baseStack}`
    ].join("\n")
  );
  loud.name = "AichatTelemetryError";
  loud.aichatTelemetry = { charsSent: 0, bytesSent: 0 };
  loud.cause = baseError;
  throw loud;
}

function applyAichatTelemetry(target, totals) {
  target.charsSent = totals.charsSent;
  target.bytesSent = totals.bytesSent;
}

async function sendMessage(settings, messages, tools, systemPrompt, chatFileCache, app = null) {
  const doSend = () => {
    if (settings.provider === "anthropic") {
      return sendAnthropicMessage(settings, messages, tools, systemPrompt, chatFileCache);
    }
    if (settings.provider === "chatgpt-oauth") {
      return sendChatGPTOAuthMessage(settings, messages, tools, systemPrompt, chatFileCache);
    }
    return sendOpenAIMessage(settings, messages, tools, systemPrompt, chatFileCache, app);
  };

  const totals = { charsSent: 0, bytesSent: 0 };
  const runAttempt = async () => {
    const response = await doSend();
    const t = readAichatTelemetry(response, "sendMessage.runAttempt.response");
    totals.charsSent += t.charsSent;
    totals.bytesSent += t.bytesSent;
    applyAichatTelemetry(response, totals);
    return response;
  };

  try {
    return await runAttempt();
  } catch (e) {
    let first;
    try {
      first = readAichatTelemetry(e?.aichatTelemetry, "sendMessage.firstCatch.errorTelemetry");
    } catch (telemetryErr) {
      rethrowWithTelemetryDiagnostics(e, e?.aichatTelemetry, "sendMessage.firstCatch", telemetryErr);
    }
    totals.charsSent += first.charsSent;
    totals.bytesSent += first.bytesSent;

    if (isRateLimitError(e)) {
      const retryAfter = extractRetryAfter(e);
      const delay = retryAfter ? retryAfter * 1e3 : 5e3;
      await sleep2(Math.min(delay, 3e4));
      try {
        return await runAttempt();
      } catch (retryError) {
        let retryTelemetry;
        try {
          retryTelemetry = readAichatTelemetry(retryError?.aichatTelemetry, "sendMessage.retryCatch.errorTelemetry");
        } catch (retryTelemetryErr) {
          rethrowWithTelemetryDiagnostics(retryError, retryError?.aichatTelemetry, "sendMessage.retryCatch", retryTelemetryErr);
        }
        totals.charsSent += retryTelemetry.charsSent;
        totals.bytesSent += retryTelemetry.bytesSent;
        if (retryError instanceof Error) {
          retryError.aichatTelemetry = { ...totals };
          throw retryError;
        }
        const wrapped = new Error(String(retryError));
        wrapped.aichatTelemetry = { ...totals };
        throw wrapped;
      }
    }

    if (e instanceof Error) {
      e.aichatTelemetry = { ...totals };
      throw e;
    }
    const wrapped = new Error(String(e));
    wrapped.aichatTelemetry = { ...totals };
    throw wrapped;
  }
}
function isRateLimitError(e) {
  if (e instanceof Error) {
    return e.message.includes("429") || e.message.toLowerCase().includes("rate limit");
  }
  return false;
}
function extractRetryAfter(e) {
  if (e instanceof Error) {
    const match = e.message.match(/retry.after[:\s]*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}
function sleep2(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function init_client() {
  "use strict";
}

declareExports({
  sendMessage
});
