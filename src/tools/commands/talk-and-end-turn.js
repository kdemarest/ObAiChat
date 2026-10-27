function talkAndEndTurn(input) {
  const text = ToolHelper.requiredString(input.text);
  if (!text) {
    return { result: "'text' parameter is required.", isError: true };
  }
  const feedbackText = ToolHelper.optionalString(input.feedback) || "";
  return { result: text, isError: false, endTurn: true, feedback: feedbackText };
}

const Command = declareNamespace("Command");
Command.export(talkAndEndTurn);
