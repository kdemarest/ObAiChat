async function overwriteFile(app, input) {
  const content = ToolHelper.requiredString(input.content);
  const path = ToolHelper.optionalString(input.path);

  if (!path) {
    return { result: "'path' parameter is required.", isError: true };
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
  await app.vault.modify(file, content);
  const afterContent = await app.vault.cachedRead(file);
  await ToolHelper.recordEditJournal(app, {
    filePath: file.path,
    operation: "overwrite",
    beforeContent,
    afterContent
  });

  return { result: `Overwrote all content in ${file.path}.`, isError: false };
}

const Command = declareNamespace("Command");
Command.export(overwriteFile);
