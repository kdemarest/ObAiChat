function talk(input) {
  const text = ToolHelper.requiredString(input.text);
  if (!text) {
    return { result: "'text' parameter is required.", isError: true };
  }
  return { result: text, isError: false };
}

const Command = declareNamespace("Command");
Command.export(talk);
