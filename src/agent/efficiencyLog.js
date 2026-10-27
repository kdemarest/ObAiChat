class EfficiencyLog {
  static safeJsonLength(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  static get PATH() {
    return "gptchat/efficiency.log";
  }

  static get MAX_BYTES() {
    return 32768;
  }

  static get TRIM_TO_BYTES() {
    return 28672;
  }

  static summarizeToolInput(toolName, input) {
    const summary = {
      inputChars: EfficiencyLog.safeJsonLength(input)
    };
    if (!isRecord6(input)) return summary;

    if (typeof input.path === "string" && input.path) {
      summary.path = input.path;
    }
    if (typeof input.new_path === "string" && input.new_path) {
      summary.newPath = input.new_path;
    }
    if (typeof input.content === "string") {
      summary.contentChars = input.content.length;
    }
    if (typeof input.query === "string") {
      summary.queryChars = input.query.length;
      summary.query = input.query;
    }
    if (typeof input.match === "string") {
      summary.match = input.match;
    }
    if (typeof input.extract === "string") {
      summary.extract = input.extract;
    }
    if (Array.isArray(input.commands)) {
      summary.commandCount = input.commands.length;
    }
    if (typeof input.command === "string") {
      summary.commandChars = input.command.length;
    }
    if (toolName === "flush") {
      summary.flushAll = input.all === true;
    }

    return summary;
  }

  static summarizeToolResult(toolName, stepInput, result) {
    const summary = {
      isError: !!result?.isError
    };
    const resultText = typeof result?.result === "string" ? result.result : JSON.stringify(result?.result ?? "");
    summary.resultChars = typeof resultText === "string" ? resultText.length : 0;

    if (toolName === "read_file" || toolName === "search_read" || toolName === "snippets") {
      const path = isRecord6(stepInput) && typeof stepInput.path === "string" ? stepInput.path : "";
      if (path) summary.path = path;
      summary.readBytes = typeof resultText === "string" ? new TextEncoder().encode(resultText).length : 0;
    }

    if (toolName === "edit_file" || toolName === "create_file") {
      const contentChars = isRecord6(stepInput) && typeof stepInput.content === "string" ? stepInput.content.length : 0;
      summary.writeChars = contentChars;
    }

    if (toolName === "rename_file") {
      if (isRecord6(stepInput) && typeof stepInput.path === "string") summary.path = stepInput.path;
      if (isRecord6(stepInput) && typeof stepInput.new_path === "string") summary.newPath = stepInput.new_path;
    }

    return summary;
  }

  static tailByUtf8Bytes(text, maxBytes) {
    const raw = String(text || "");
    if (maxBytes <= 0 || !raw) return "";
    let out = raw;
    while (out && new TextEncoder().encode(out).length > maxBytes) {
      out = out.slice(Math.ceil(out.length * 0.5));
    }
    return out;
  }

  static async trim(app) {
    try {
      const adapter = app.vault.adapter;
      const raw = await adapter.read(EfficiencyLog.PATH);
      const bytes = new TextEncoder().encode(raw).length;
      if (bytes <= EfficiencyLog.MAX_BYTES) return;

      let trimmed = EfficiencyLog.tailByUtf8Bytes(raw, EfficiencyLog.TRIM_TO_BYTES);
      const firstNewline = trimmed.indexOf("\n");
      if (firstNewline >= 0 && firstNewline < trimmed.length - 1) {
        trimmed = trimmed.slice(firstNewline + 1);
      }
      await adapter.write(EfficiencyLog.PATH, trimmed);
    } catch {
    }
  }

  static async append(app, entry) {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        ...entry
      };
      await app.vault.adapter.append(EfficiencyLog.PATH, `${JSON.stringify(payload)}\n`);
    } catch {
    }
  }

  static init() {
    "use strict";
  }
}

registerInit("efficiency", EfficiencyLog.init);

declareExports({
  EfficiencyLog
});

