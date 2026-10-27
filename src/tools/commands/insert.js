function findFrontmatterEnd(content) {
  if (!content.startsWith("---")) return -1;
  const secondDash = content.indexOf("---", 3);
  if (secondDash === -1) return -1;
  return secondDash + 3;
}

async function insertFile(app, input) {
  const position = ToolHelper.requiredString(input.position);
  const path = ToolHelper.optionalString(input.path);

  if (!path) {
    return { result: "'path' parameter is required.", isError: true };
  }

  if (position !== "beginning" && position !== "end" && position !== "after_frontmatter") {
    return { result: `Unknown position: ${position}`, isError: true };
  }

  const file = ToolHelper.resolveFile(app, path);
  if (!file) {
    return { result: `File not found: ${path}`, isError: true };
  }

  const cfcPreconditionError = await ToolHelper.validateCfcEditPrecondition(app, file, input);
  if (cfcPreconditionError) {
    return cfcPreconditionError;
  }

  const beforeContent = await app.vault.cachedRead(file);
  await app.vault.process(file, (data) => {
    switch (position) {
      case "beginning":
        return "\n" + data;
      case "end":
        return data + "\n";
      case "after_frontmatter": {
        const fmEnd = findFrontmatterEnd(data);
        if (fmEnd === -1) return "\n" + data;
        return data.substring(0, fmEnd) + "\n" + data.substring(fmEnd);
      }
      default:
        return data;
    }
  });
  const afterContent = await app.vault.cachedRead(file);
  await ToolHelper.recordEditJournal(app, {
    filePath: file.path,
    operation: "insert",
    beforeContent,
    afterContent
  });

  return { result: `Inserted at ${position} of ${file.path}.`, isError: false };
}

const Command = declareNamespace("Command");
Command.export(insertFile);
