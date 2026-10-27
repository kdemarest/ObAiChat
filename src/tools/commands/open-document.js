async function openDocument(app, input) {
  const path = ToolHelper.requiredString(input.path);
  if (!path) {
    return { result: "'path' parameter is required.", isError: true };
  }
  const file = app.vault.getFileByPath(obsidian.normalizePath(path));
  if (!file) {
    return { result: `File not found: ${path}`, isError: true };
  }
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  return { result: `Opened ${file.path}.`, isError: false };
}

const Command = declareNamespace("Command");
Command.export(openDocument);
