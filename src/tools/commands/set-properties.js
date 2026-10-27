async function setProperties(app, input) {
  const props = ToolHelper.requiredRecord(input.properties);
  if (!props) {
    return { result: "'properties' parameter must be an object.", isError: true };
  }
  const path = ToolHelper.optionalString(input.path);
  const file = ToolHelper.resolveFile(app, path);
  if (!file) {
    return { result: path ? `File not found: ${path}` : "No active document open.", isError: true };
  }
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    for (const [key, value] of Object.entries(props)) {
      if (value === null) {
        delete frontmatter[key];
      } else {
        frontmatter[key] = value;
      }
    }
  });
  const setKeys = Object.entries(props).filter(([, v]) => v !== null).map(([k]) => k);
  const removedKeys = Object.entries(props).filter(([, v]) => v === null).map(([k]) => k);
  const parts = [];
  if (setKeys.length > 0) parts.push(`Set: ${setKeys.join(", ")}`);
  if (removedKeys.length > 0) parts.push(`Removed: ${removedKeys.join(", ")}`);
  return { result: `Updated properties in ${file.path}. ${parts.join(". ")}.`, isError: false };
}

const Command = declareNamespace("Command");
Command.export(setProperties);
