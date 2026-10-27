const AGENTS_CONTEXT_MAX_CHARS = 120000;


class Includer {
  constructor(app, options = {}) {
    this.app = app;
    this.maxChars = typeof options.maxChars === "number" && options.maxChars > 0
      ? options.maxChars
      : AGENTS_CONTEXT_MAX_CHARS;
  }

  static async loadAgentsContext(app) {
    const includer = new Includer(app);
    return await includer.loadAgentsContext();
  }

  normalizeHeadingLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  parseIncludeSpec(spec) {
    const raw = String(spec || "").trim();
    if (!raw) return { path: "", heading: "" };
    const hashIdx = raw.indexOf("#");
    if (hashIdx === -1) return { path: raw, heading: "" };
    return {
      path: raw.substring(0, hashIdx).trim(),
      heading: raw.substring(hashIdx + 1).trim()
    };
  }

  resolveIncludePath(targetPath, fromPath, vaultName) {
    let p = String(targetPath || "").trim();
    if (!p) return "";
    if (p.startsWith("/")) {
      const marker = `/${vaultName}/`;
      const idx = p.indexOf(marker);
      if (idx !== -1) {
        p = p.substring(idx + marker.length);
      } else {
        p = p.replace(/^\/+/, "");
      }
      return obsidian.normalizePath(p);
    }
    const from = obsidian.normalizePath(fromPath || "");
    const slash = from.lastIndexOf("/");
    const baseDir = slash === -1 ? "" : from.substring(0, slash);
    return obsidian.normalizePath(baseDir ? `${baseDir}/${p}` : p);
  }

  extractMarkdownHeadingSection(content, headingLabel) {
    const target = this.normalizeHeadingLabel(headingLabel);
    if (!target) return null;
    const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
    let start = -1;
    let level = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (!m) continue;
      if (this.normalizeHeadingLabel(m[2]) === target) {
        start = i;
        level = m[1].length;
        break;
      }
    }
    if (start === -1) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+/);
      if (!m) continue;
      if (m[1].length <= level) {
        end = i;
        break;
      }
    }
    return lines.slice(start, end).join("\n");
  }

  async expandIncludes(content, fromPath, stack) {
    const adapter = this.app.vault.adapter;
    const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    for (const line of lines) {
      const m = line.match(/^\s*\{#(?:include|incude)\s+(.+?)\}\s*$/i);
      if (!m) {
        out.push(line);
        continue;
      }

      const parsed = this.parseIncludeSpec(m[1]);
      const includePath = this.resolveIncludePath(parsed.path, fromPath, this.app.vault.getName());
      if (!includePath) {
        out.push("[AGENTS include error: missing include path]");
        continue;
      }
      if (stack.includes(includePath)) {
        out.push(`[AGENTS include skipped: recursive include ${includePath}]`);
        continue;
      }

      let included = "";
      try {
        included = await adapter.read(includePath);
      } catch {
        out.push(`[AGENTS include error: could not read ${includePath}]`);
        continue;
      }

      if (parsed.heading) {
        const section = this.extractMarkdownHeadingSection(included, parsed.heading);
        if (!section) {
          out.push(`[AGENTS include error: heading not found in ${includePath}: ${parsed.heading}]`);
          continue;
        }
        included = section;
      }

      const nested = await this.expandIncludes(included, includePath, [...stack, includePath]);
      out.push(nested);
    }
    return out.join("\n");
  }

  async loadAgentsContext() {
    const adapter = this.app.vault.adapter;
    const pathFile = `${this.app.vault.configDir}/plugins/obaichat/agents-path.txt`;
    let configuredPath = "";
    try {
      configuredPath = (await adapter.read(pathFile)).trim();
    } catch {
      configuredPath = "";
    }
    if (!configuredPath) return "";

    try {
      const content = await adapter.read(configuredPath);
      if (!content || content.trim().length === 0) return "";

      let expanded = await this.expandIncludes(content, configuredPath, [configuredPath]);
      if (expanded.length > this.maxChars) {
        expanded = `${expanded.slice(0, this.maxChars)}\n[AGENTS include note: content truncated to ${this.maxChars} chars]`;
      }
      return [
        `[Project instructions loaded from ${configuredPath}]`,
        expanded,
        `[End project instructions]`
      ].join("\n");
    } catch {
      return "";
    }
  }
}

declareExports({
  Includer
});
