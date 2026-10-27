const ToolHelper = declareNamespace("ToolHelper");

const EDIT_JOURNAL_PATH = ToolHelper.export(function EDIT_JOURNAL_PATH() {
  return "ObAiChat/.journal/edits.ndjson";
});

async function ensureAdapterFolder(adapter, folderPath) {
  const normalized = obsidian.normalizePath(folderPath);
  if (!normalized) return;
  if (await adapter.exists(normalized)) return;
  const slash = normalized.lastIndexOf("/");
  const parent = slash === -1 ? "" : normalized.substring(0, slash);
  if (parent) {
    await ensureAdapterFolder(adapter, parent);
  }
  try {
    await adapter.mkdir(normalized);
  } catch {
  }
}

function newJournalEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseNdjson(raw) {
  const lines = String(raw || "").split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") out.push(parsed);
    } catch {
    }
  }
  return out;
}

const readEditJournalEntries = ToolHelper.export(async function readEditJournalEntries(app) {
  try {
    const raw = await app.vault.adapter.read(ToolHelper.EDIT_JOURNAL_PATH());
    return parseNdjson(raw);
  } catch {
    return [];
  }
});

async function appendEditJournalEntry(app, entry) {
  const adapter = app.vault.adapter;
  await ensureAdapterFolder(adapter, "ObAiChat/.journal");
  const line = JSON.stringify(entry) + "\n";
  try {
    await adapter.append(ToolHelper.EDIT_JOURNAL_PATH(), line);
    return;
  } catch {
  }
  let existing = "";
  try {
    existing = await adapter.read(ToolHelper.EDIT_JOURNAL_PATH());
  } catch {
    existing = "";
  }
  await adapter.write(ToolHelper.EDIT_JOURNAL_PATH(), existing + line);
}

const recordEditJournal = ToolHelper.export(async function recordEditJournal(app, params) {
  const beforeHash = await ToolHelper.sha256Hex(params.beforeContent);
  const afterHash = await ToolHelper.sha256Hex(params.afterContent);
  const entry = {
    id: newJournalEntryId(),
    timestamp: new Date().toISOString(),
    filePath: params.filePath,
    operation: params.operation,
    beforeHash,
    afterHash,
    inverseOp: {
      operation: "replace_all",
      content: String(params.beforeContent || "")
    }
  };
  if (params.meta && typeof params.meta === "object") {
    entry.meta = params.meta;
  }
  await appendEditJournalEntry(app, entry);
  return entry;
});
