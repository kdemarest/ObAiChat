// src/agent/sentLog.ts
class SentLog {
  static async writeLatestSentLog(app, payloadOrBody) {
    try {
      const effectiveApp = app || (typeof window !== "undefined" ? window.app : null);
      if (!effectiveApp?.vault?.adapter) return;

      const raw = payloadOrBody?.bodyJson;
      const bodyObj = payloadOrBody?.bodyObj;
      let textToWrite = "";

      if (typeof raw === "string" && raw.length > 0) {
        textToWrite = JSON.stringify(JSON.parse(raw), null, 4);
      } else if (bodyObj && typeof bodyObj === "object") {
        textToWrite = JSON.stringify(bodyObj, null, 4);
      } else {
        textToWrite = JSON.stringify(payloadOrBody ?? null, null, 2);
      }

      await effectiveApp.vault.adapter.write("gptchat/sent.log", textToWrite);
    } catch {
    }
  }
}

declareExports({
  SentLog
});