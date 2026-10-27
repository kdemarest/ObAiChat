async function biggest(app, input) {
  const includeExts = new Set(ToolHelper.parseExtensionTokens(input.extensions));
  if (includeExts.size === 0) {
    return {
      result: "Please provide one or more extensions in extensions (e.g. '.js,.md').",
      isError: true
    };
  }

  const files = app.vault.getFiles();
  const matches = [];

  for (const file of files) {
    const ext = ToolHelper.getPathExtension(file.path);
    if (!includeExts.has(ext)) continue;
    const size = Number.isFinite(file.stat?.size) ? file.stat.size : 0;
    matches.push({ path: file.path, size });
  }

  matches.sort((a, b) => {
    if (b.size !== a.size) return b.size - a.size;
    return a.path.localeCompare(b.path);
  });

  const top = matches.slice(0, 20);

  if (top.length === 0) {
    return {
      result: `No files found for extensions: ${Array.from(includeExts).join(",")}`,
      isError: false
    };
  }

  return {
    result: [
      `Top ${top.length} biggest files for extensions: ${Array.from(includeExts).join(",")}`,
      ...top.map((entry) => `- ${entry.path} ${entry.size}`),
      "",
      `Matched ${matches.length} file(s) total.`
    ].join("\n"),
    isError: false
  };
}

const Command = declareNamespace("Command");
Command.export(biggest);
