const ToolHelper = declareNamespace("ToolHelper");

const resolveFile = ToolHelper.export(function resolveFile(app, path) {
  if (path) {
    return app.vault.getFileByPath(obsidian.normalizePath(path));
  }
  return app.workspace.getActiveFile();
});

const validateCfcEditPrecondition = ToolHelper.export(async function validateCfcEditPrecondition(app, file, input) {
  const pre = ToolHelper.requiredRecord(input?.__cfc_precondition);
  if (!pre) return null;

  const expectedPathRaw = ToolHelper.optionalString(pre.path);
  const expectedPath = expectedPathRaw ? obsidian.normalizePath(expectedPathRaw) : file.path;
  const expectedMtimeMs = typeof pre.observedMtimeMs === "number" ? pre.observedMtimeMs : NaN;
  const expectedSize = typeof pre.observedSize === "number" ? pre.observedSize : NaN;

  if (expectedPath !== file.path) {
    return {
      result: `Blocked edit_file for ${file.path}: CFC snapshot precondition mismatch (${expectedPath}). Re-read the file before editing.`,
      isError: true
    };
  }

  let stat = null;
  try {
    stat = await app.vault.adapter.stat(file.path);
  } catch {
    stat = null;
  }
  const currentMtimeMs = typeof stat?.mtime === "number" ? stat.mtime : NaN;
  const currentSize = typeof stat?.size === "number" ? stat.size : NaN;

  if (!Number.isFinite(expectedMtimeMs) || !Number.isFinite(expectedSize) || !Number.isFinite(currentMtimeMs) || !Number.isFinite(currentSize)) {
    return {
      result: `Blocked edit_file for ${file.path}: unable to validate CFC snapshot precondition. Re-read the file before editing.`,
      isError: true
    };
  }

  if (expectedMtimeMs !== currentMtimeMs || expectedSize !== currentSize) {
    return {
      result: `Blocked edit_file for ${file.path}: file changed since CFC snapshot (expected mtime=${expectedMtimeMs}, size=${expectedSize}; current mtime=${currentMtimeMs}, size=${currentSize}). Re-read the file and retry.`,
      isError: true
    };
  }

  return null;
});

const ensureParentFolder = ToolHelper.export(async function ensureParentFolder(app, filePath) {
  const parentPath = filePath.substring(0, filePath.lastIndexOf("/"));
  if (parentPath && !app.vault.getFolderByPath(parentPath)) {
    await app.vault.createFolder(parentPath);
  }
});
