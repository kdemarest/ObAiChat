
function buildContext(app) {
  const activeFile = app.workspace.getActiveFile();
  let activeFileContent = null;
  let selection = null;
  const editor = app.workspace.activeEditor?.editor;
  if (editor) {
    const sel = editor.getSelection();
    if (sel && sel.length > 0) {
      selection = sel;
    }
  }
  return {
    activeFile: activeFile?.path ?? null,
    activeFileContent,
    // Populated lazily by the loop if needed
    selection,
    vaultName: app.vault.getName(),
    fileCount: app.vault.getMarkdownFiles().length
  };
}

declareExports({
  buildContext
});

