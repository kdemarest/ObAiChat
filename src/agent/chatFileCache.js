function isRecordCfc(value) {
  return typeof value === "object" && value !== null;
}

class ChatFileCache {
  constructor() {
    this.entriesByPath = new Map();
    this.invalidatedPaths = new Set();
  }

  has(path) {
    return this.entriesByPath.has(path);
  }

  get(path) {
    return this.entriesByPath.get(path) || null;
  }

  set(path, entry) {
    if (!path) return;
    const normalizedPath = obsidian.normalizePath(String(path).trim());
    if (!normalizedPath) return;
    this.entriesByPath.set(normalizedPath, entry || null);
    this.invalidatedPaths.delete(normalizedPath);
  }

  remove(path) {
    if (!path) return false;
    const normalizedPath = obsidian.normalizePath(String(path).trim());
    if (!normalizedPath) return false;
    this.invalidatedPaths.add(normalizedPath);
    return this.entriesByPath.delete(normalizedPath);
  }

  clear() {
    this.entriesByPath.clear();
    this.invalidatedPaths.clear();
  }

  clearInvalidations() {
    this.invalidatedPaths.clear();
  }

  listPaths() {
    return Array.from(this.entriesByPath.keys());
  }

  truncateUtf8ToBytes(value, maxBytes) {
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

  buildSystemMessagesFromEntries(entries, options = {}) {
    const truncateBytes = typeof options.truncateBytes === "number" ? options.truncateBytes : 0;
    const list = Array.isArray(entries) ? entries : [];
    if (list.length === 0) return [];
    const out = [];
    for (const entry of list) {
      if (!isRecordCfc(entry)) continue;
      const filename = typeof entry.filename === "string" ? entry.filename.trim() : "";
      if (!filename) continue;
      const rawContent = typeof entry.content === "string" ? entry.content : "";
      const content = truncateBytes > 0
        ? this.truncateUtf8ToBytes(rawContent, truncateBytes)
        : rawContent;
      const escapedPath = filename.replace(/"/g, "&quot;");
      out.push({
        type: "message",
        role: "developer",
        content: [
          {
            type: "input_text",
            text: `<cached_file path="${escapedPath}">\n${content}\n</cached_file>`
          }
        ]
      });
    }
    return out;
  }


  isReadFileElidedPayload(content) {
    if (typeof content !== "string" || !content) return false;
    try {
      const parsed = JSON.parse(content);
      return isRecordCfc(parsed) && parsed.type === "read_file_elided";
    } catch {
      return false;
    }
  }

  extractWrappedReadFilePath(content) {
    const text = typeof content === "string" ? content : "";
    if (!text.startsWith("[read_file]")) return "";
    const match = text.match(/^path:\s*(.+)$/m);
    return match && typeof match[1] === "string" ? match[1].trim() : "";
  }

  extractWrappedReadFileContent(content) {
    const text = typeof content === "string" ? content : "";
    if (!text.startsWith("[read_file]")) return "";
    const splitAt = text.indexOf("\n\n");
    if (splitAt === -1) return "";
    return text.slice(splitAt + 2);
  }

  async buildEntriesForRequest(messages, maxAgeTurns = 0, app = null) {
    const entries = [];
    const invalidated = this.invalidatedPaths;
    for (const [path, value] of this.entriesByPath.entries()) {
      if (invalidated.has(path)) continue;
      if (!isRecordCfc(value)) continue;
      const filename = typeof path === "string" ? obsidian.normalizePath(path.trim()) : "";
      if (!filename) continue;
      if (!app || !app.vault || typeof app.vault.getAbstractFileByPath !== "function" || typeof app.vault.cachedRead !== "function") continue;
      try {
        let content = typeof value.payload === "string" ? value.payload : "";
        if (!content) {
          const file = app.vault.getAbstractFileByPath(filename);
          if (!(file instanceof obsidian.TFile)) continue;
          content = String(await app.vault.cachedRead(file) || "");
        }
        entries.push({ filename, content });
      } catch {
      }
    }
    return entries;
  }

  buildCurrentPathSet(messages, maxAgeTurns = 0) {
    const out = new Set();
    const invalidated = this.invalidatedPaths;
    for (const [path, value] of this.entriesByPath.entries()) {
      if (!path || !isRecordCfc(value)) continue;
      const normalizedPath = obsidian.normalizePath(path);
      if (invalidated.has(normalizedPath)) continue;
      out.add(normalizedPath);
    }
    return out;
  }

  async applyExternalMutationInvalidationGuard(app, onRemoveEntry) {
    let scanned = 0;
    let invalidated = 0;
    for (const [path, value] of this.entriesByPath.entries()) {
      if (!path || !isRecordCfc(value)) continue;
      scanned += 1;
      const normalizedPath = obsidian.normalizePath(path);
      const observedMtimeMs = typeof value.observedMtimeMs === "number" ? value.observedMtimeMs : NaN;
      const observedSize = typeof value.observedSize === "number" ? value.observedSize : NaN;
      try {
        const stat = await app.vault.adapter.stat(normalizedPath);
        const currentMtimeMs = typeof stat?.mtime === "number" ? stat.mtime : NaN;
        const currentSize = typeof stat?.size === "number" ? stat.size : NaN;
        if (Number.isFinite(observedMtimeMs) && Number.isFinite(observedSize) && Number.isFinite(currentMtimeMs) && Number.isFinite(currentSize)) {
          if (observedMtimeMs !== currentMtimeMs || observedSize !== currentSize) {
            if (typeof onRemoveEntry === "function") {
              onRemoveEntry(normalizedPath, "external_mutation");
            }
            invalidated += 1;
          }
        } else {
          this.entriesByPath.set(normalizedPath, {
            ...value,
            observedMtimeMs: Number.isFinite(currentMtimeMs) ? currentMtimeMs : null,
            observedSize: Number.isFinite(currentSize) ? currentSize : null
          });
        }
      } catch {
        if (typeof onRemoveEntry === "function") {
          onRemoveEntry(normalizedPath, "external_mutation");
        }
        invalidated += 1;
      }
    }
    return { scanned, invalidated };
  }

  async refreshPath(app, path, userTurnIndex) {
    const normalized = typeof path === "string" ? obsidian.normalizePath(path.trim()) : "";
    if (!normalized) return false;
    try {
      const file = app.vault.getFileByPath(normalized);
      if (!file) return false;
      const raw = await app.vault.cachedRead(file);
      const stat = await app.vault.adapter.stat(normalized);
      const observedMtimeMs = typeof stat?.mtime === "number" ? stat.mtime : null;
      const observedSize = typeof stat?.size === "number" ? stat.size : null;
      this.entriesByPath.set(normalized, {
        payload: String(raw || ""),
        lastSeenTurn: userTurnIndex,
        observedMtimeMs,
        observedSize
      });
      this.invalidatedPaths.delete(normalized);
      return true;
    } catch {
      return false;
    }
  }

  resolveEditToolPath(app, stepInput, getActiveFilePath) {
    if (isRecordCfc(stepInput) && typeof stepInput.path === "string" && stepInput.path.trim()) {
      return obsidian.normalizePath(stepInput.path.trim());
    }
    return typeof getActiveFilePath === "function" ? String(getActiveFilePath(app) || "") : "";
  }

  withEditPrecondition(app, stepInput, getActiveFilePath) {
    if (!isRecordCfc(stepInput)) return stepInput;
    const targetPath = this.resolveEditToolPath(app, stepInput, getActiveFilePath);
    if (!targetPath) return stepInput;
    if (this.invalidatedPaths.has(targetPath)) return stepInput;

    const cacheEntry = this.entriesByPath.get(targetPath);
    if (!isRecordCfc(cacheEntry)) return stepInput;

    const observedMtimeMs = typeof cacheEntry.observedMtimeMs === "number" ? cacheEntry.observedMtimeMs : NaN;
    const observedSize = typeof cacheEntry.observedSize === "number" ? cacheEntry.observedSize : NaN;
    if (!Number.isFinite(observedMtimeMs) || !Number.isFinite(observedSize)) return stepInput;

    return {
      ...stepInput,
      __cfc_precondition: {
        path: targetPath,
        observedMtimeMs,
        observedSize
      }
    };
  }
}

declareExports({
  ChatFileCache
});