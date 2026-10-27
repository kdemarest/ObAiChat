async function deleteFile(app, input) {
  const path = ToolHelper.requiredString(input.path);
  if (!path) {
    return { result: "'path' parameter is required.", isError: true };
  }
  const file = app.vault.getAbstractFileByPath(obsidian.normalizePath(path));
  if (!file) {
    return { result: `File not found: ${path}`, isError: true };
  }
  await app.fileManager.trashFile(file);
  return { result: `Moved ${path} to trash.`, isError: false };
}

const Command = declareNamespace("Command");
Command.export(deleteFile);
