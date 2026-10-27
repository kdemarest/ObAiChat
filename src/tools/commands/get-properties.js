async function getProperties(app, input) {
  const path = ToolHelper.optionalString(input.path);
  const file = ToolHelper.resolveFile(app, path);
  if (!file) {
    return { result: path ? `File not found: ${path}` : "No active document open.", isError: true };
  }
  const cache = app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter;
  if (!frontmatter) {
    return { result: `No frontmatter properties found in ${file.path}.`, isError: false };
  }
  const clean = { ...frontmatter };
  delete clean.position;
  return { result: JSON.stringify(clean, null, 2), isError: false };
}

const Command = declareNamespace("Command");
Command.export(getProperties);
