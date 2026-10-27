async function listFiles(app, input) {
  const folder = ToolHelper.optionalString(input.folder);
  const extension = ToolHelper.optionalString(input.extension);
  let files = app.vault.getFiles();
  if (folder) {
    const normalizedFolder = obsidian.normalizePath(folder);
    files = files.filter(
      (f) => f.path.startsWith(normalizedFolder + "/") || f.path === normalizedFolder
    );
  }
  if (extension) {
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    files = files.filter((f) => f.path.endsWith(ext));
  }
  const entries = files
    .map((f) => ({ path: f.path, size: Number.isFinite(f.stat?.size) ? f.stat.size : 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const capped = entries.slice(0, 100);
  const suffix = entries.length > 100 ? `\n\n(Showing 100 of ${entries.length} files)` : "";
  if (capped.length === 0) {
    return { result: "No files found matching the criteria.", isError: false };
  }
  return {
    result: capped.map((entry) => `- ${entry.path} ${entry.size}`).join("\n") + suffix,
    isError: false
  };
}

const Command = declareNamespace("Command");
Command.export(listFiles);
