function flushTool(input) {
  const path = ToolHelper.optionalString(input?.path);
  const all = input?.all === true;
  const flushAll = all || !path;
  const mode = flushAll ? "all" : "path";
  return {
    result: JSON.stringify({
      action: "flush",
      mode,
      path: flushAll ? "" : path || ""
    }),
    isError: false
  };
}

const Command = declareNamespace("Command");
Command.export(flushTool);
