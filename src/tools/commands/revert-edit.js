async function revertEdit(app, input) {
  const requestedPath = ToolHelper.optionalString(input.path);
  const normalizedPath = requestedPath ? obsidian.normalizePath(requestedPath) : "";
  const entryId = ToolHelper.optionalString(input.entryId);
  if (!normalizedPath && !entryId) {
    return { result: "Provide either 'path' (revert last change for file) or 'entryId' (revert by journal id).", isError: true };
  }

  const entries = await ToolHelper.readEditJournalEntries(app);
  if (entries.length === 0) {
    return { result: `No journal entries found at ${ToolHelper.EDIT_JOURNAL_PATH()}.`, isError: true };
  }

  let target = null;
  if (entryId) {
    target = entries.find((e) => typeof e?.id === "string" && e.id === entryId) || null;
    if (!target) {
      return { result: `Journal entry not found: ${entryId}.`, isError: true };
    }
  } else {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (typeof e?.filePath === "string" && obsidian.normalizePath(e.filePath) === normalizedPath) {
        target = e;
        break;
      }
    }
    if (!target) {
      return { result: `No journal entries found for ${normalizedPath}.`, isError: true };
    }
  }

  if (!target.inverseOp || target.inverseOp.operation !== "replace_all" || typeof target.inverseOp.content !== "string") {
    return { result: `Journal entry ${target.id || "(unknown)"} cannot be reverted: unsupported inverse operation.`, isError: true };
  }

  const filePath = typeof target.filePath === "string" ? obsidian.normalizePath(target.filePath) : normalizedPath;
  const file = app.vault.getFileByPath(filePath);
  if (!file) {
    return { result: `File not found for journal entry: ${filePath}`, isError: true };
  }

  const beforeContent = await app.vault.cachedRead(file);
  await app.vault.modify(file, target.inverseOp.content);
  const afterContent = await app.vault.cachedRead(file);

  const revertEntry = await ToolHelper.recordEditJournal(app, {
    filePath: file.path,
    operation: "revert",
    beforeContent,
    afterContent,
    meta: {
      revertedEntryId: target.id || "",
      mode: entryId ? "by_id" : "by_last_path"
    }
  });

  const restoredHash = await ToolHelper.sha256Hex(afterContent);
  const expectedHash = typeof target.beforeHash === "string" ? target.beforeHash : "";
  const hashNote = expectedHash && restoredHash === expectedHash ? "exact prior hash restored" : "content restored (hash mismatch or unavailable)";

  return {
    result: `Reverted ${file.path} using journal entry ${target.id || "(unknown)"}. ${hashNote}. New journal entry: ${revertEntry.id}.`,
    isError: false
  };
}

const Command = declareNamespace("Command");
Command.export(revertEdit);
