async function getBacklinks(app, input) {
  const path = ToolHelper.optionalString(input.path);
  const file = ToolHelper.resolveFile(app, path);
  if (!file) {
    return { result: path ? `File not found: ${path}` : "No active document open.", isError: true };
  }
  const allLinks = app.metadataCache.resolvedLinks;
  const backlinks = [];
  for (const [sourcePath, targets] of Object.entries(allLinks)) {
    if (targets[file.path]) {
      backlinks.push(sourcePath);
    }
  }
  if (backlinks.length === 0) {
    return { result: `No backlinks found for ${file.path}.`, isError: false };
  }
  backlinks.sort();
  return {
    result: `${backlinks.length} note(s) link to ${file.path}:\n${backlinks.map((p) => `- ${p}`).join("\n")}`,
    isError: false
  };
}

const Command = declareNamespace("Command");
Command.export(getBacklinks);
