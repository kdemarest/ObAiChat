async function createFile(app, input) {
  const path = obsidian.normalizePath(ToolHelper.requiredString(input.path));
  const hasContent = typeof input.content === "string";
  const content = hasContent ? input.content : "";
  if (!path) {
    return { result: "'path' parameter is required.", isError: true };
  }
  if (!hasContent) {
    return { result: "'content' parameter is required.", isError: true };
  }
  if (app.vault.getFileByPath(path)) {
    return { result: `File already exists: ${path}. Use edit_file to modify it.`, isError: true };
  }
  await ToolHelper.ensureParentFolder(app, path);
  await app.vault.create(path, content);
  return { result: `Created ${path}.`, isError: false };
}

const Command = declareNamespace("Command");
Command.export(createFile);
