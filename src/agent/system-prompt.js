
let SYSTEM_PROMPT_PATH = "ObAiChat/SystemPrompt.md";
let loadedSystemPrompt = "System prompt unavailable: ObAiChat/SystemPrompt.md has not been loaded yet.";
function buildSystemPromptLoadError(reason) {
  return `System prompt unavailable: ${reason}. Required source: ${SYSTEM_PROMPT_PATH}.`;
}
async function loadSystemPrompt(app) {
  try {
    const raw = await app.vault.adapter.read(SYSTEM_PROMPT_PATH);
    const text = String(raw || "").trim();
    if (text.length === 0) {
      loadedSystemPrompt = buildSystemPromptLoadError("ObAiChat/SystemPrompt.md is empty");
      return loadedSystemPrompt;
    }
    loadedSystemPrompt = text;
    return loadedSystemPrompt;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e || "read failed");
    loadedSystemPrompt = buildSystemPromptLoadError(`failed to read ObAiChat/SystemPrompt.md (${msg})`);
    return loadedSystemPrompt;
  }
}
function buildSystemPrompt() {
  return loadedSystemPrompt;
}
function buildContextMessage(context) {
  const parts = [
    `[Context: Vault "${context.vaultName}" with ${context.fileCount} markdown files.`
  ];
  if (context.activeFile) {
    parts.push(`Active document: ${context.activeFile}.`);
  }
  if (context.selection) {
    const truncated = context.selection.substring(0, 200);
    parts.push(`Selected text: "${truncated}${context.selection.length > 200 ? "..." : ""}".`);
  }
  parts.push("]");
  return parts.join(" ");
}

declareExports({
  loadSystemPrompt,
  buildSystemPrompt,
  buildContextMessage
});

