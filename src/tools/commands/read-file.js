async function readFile(app, input) {
  const path = ToolHelper.requiredString(input.path);
  if (!path) {
    return { result: "'path' parameter is required.", isError: true };
  }
  const file = app.vault.getFileByPath(obsidian.normalizePath(path));
  if (!file) {
    return { result: `File not found: ${path}`, isError: true };
  }
  const content = await app.vault.cachedRead(file);
  return { result: content, isError: false };
}

const Command = declareNamespace("Command");
Command.export(readFile);
