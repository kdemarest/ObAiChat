async function renameFile(app, input) {
  const path = ToolHelper.requiredString(input.path);
  const newPath = ToolHelper.requiredString(input.new_path);
  if (!path || !newPath) {
    return { result: "Both 'path' and 'new_path' parameters are required.", isError: true };
  }
  const file = app.vault.getAbstractFileByPath(obsidian.normalizePath(path));
  if (!file) {
    return { result: `File not found: ${path}`, isError: true };
  }
  const normalizedNew = obsidian.normalizePath(newPath);
  if (app.vault.getAbstractFileByPath(normalizedNew)) {
    return { result: `A file already exists at: ${normalizedNew}`, isError: true };
  }
  await ToolHelper.ensureParentFolder(app, normalizedNew);
  await app.fileManager.renameFile(file, normalizedNew);
  return { result: `Renamed ${path} to ${normalizedNew}.`, isError: false };
}

const Command = declareNamespace("Command");
Command.export(renameFile);
