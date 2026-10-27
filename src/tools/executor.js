

async function executeTool(app, toolName, input, onAskUser, onMultiStepEvent) {
  try {
    switch (toolName) {
      case "edit_file":
        return await Command.editDocument(app, input);
      case "overwrite":
        return await Command.overwriteFile(app, input);
      case "insert":
        return await Command.insertFile(app, input);
      case "search_vault":
        return await Command.searchVault(app, input);
      case "search_read":
        return await Command.searchRead(app, input, "full");
      case "snippets":
        return await Command.snippets(app, input);
      case "frontmatter":
        return await Command.frontmatter(app, input);
      case "read_file":
        return await Command.readFile(app, input);
      case "flush":
        return Command.flushTool(input);
      case "talk":
        return Command.talk(input);
      case "talkAndEndTurn":
        return Command.talkAndEndTurn(input);
      case "create_file":
        return await Command.createFile(app, input);
      case "list_files":
        return await Command.listFiles(app, input);
      case "biggest":
        return await Command.biggest(app, input);
      case "rename_file":
        return await Command.renameFile(app, input);
      case "delete_file":
        return await Command.deleteFile(app, input);
      case "get_properties":
        return await Command.getProperties(app, input);
      case "set_properties":
        return await Command.setProperties(app, input);
      case "get_backlinks":
        return await Command.getBacklinks(app, input);
      case "get_current_datetime":
        return Command.getCurrentDatetime();
      case "open_document":
        return await Command.openDocument(app, input);
      case "agents":
        return await Command.agentsTool(app, input);
      case "revert_edit":
        return await Command.revertEdit(app, input);
      default:
        return { result: `Tool ${toolName} failed: unknown tool`, isError: true };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: `Tool ${toolName} failed: execution_error (${msg})`, isError: true };
  }
}

function toPolicy(value) {
  const p = typeof value === "string" ? value : "stop";
  if (p === "continue" || p === "retry_once" || p === "retry_next_candidate") return p;
  return "stop";
}

function inferChanged(tool, input, result) {
  if (result?.isError) return false;
  return tool === "edit_file" || tool === "create_file" || tool === "rename_file" || tool === "delete_file" || tool === "set_properties" || tool === "revert_edit";
}

function inferNoProgressSignal(tool, input, result) {
  if (inferChanged(tool, input, result)) return "progress";
  if (tool === "edit_file" || tool === "create_file" || tool === "rename_file" || tool === "delete_file" || tool === "set_properties" || tool === "revert_edit") {
    return "stalled";
  }
  return "neutral";
}

async function runStepOnce(app, step, onAskUser, onMultiStepEvent) {
  const timeoutMs = ToolHelper.clampNumber(step.timeoutMs, 2e4, 100, 9e4);
  const stepTool = ToolHelper.requiredString(step.tool);
  const stepInput = isRecordArg(step.input) ? step.input : {};

  if (!stepTool) {
    return { result: "Step missing tool name.", isError: true };
  }
  if (typeof onMultiStepEvent === "function") {
    try {
      onMultiStepEvent({ type: "tool_call", tool: stepTool, input: stepInput });
    } catch {
    }
  }

  const stepPromise = executeTool(app, stepTool, stepInput, onAskUser, onMultiStepEvent);
  const timeoutPromise = new Promise((resolve) => {
    window.setTimeout(() => resolve({ result: `Step timed out after ${timeoutMs}ms.`, isError: true }), timeoutMs);
  });

  const settled = await Promise.race([stepPromise, timeoutPromise]);

  if (typeof onMultiStepEvent === "function") {
    try {
      onMultiStepEvent({ type: "tool_result", tool: stepTool, input: stepInput, result: settled });
    } catch {
    }
  }

  return settled;
}

async function runStepWithPolicy(app, step, onAskUser, onMultiStepEvent) {
  const policy = toPolicy(step.onError);
  const stepTool = ToolHelper.requiredString(step.tool);
  const baseInput = isRecordArg(step.input) ? step.input : {};

  if (policy === "retry_next_candidate" && stepTool === "edit_file") {
    const findCandidates = Command.normalizeFindCandidates(baseInput.find);
    if (findCandidates.length > 1) {
      let lastError = null;
      for (let i = 0; i < findCandidates.length; i++) {
        const candidate = findCandidates[i];
        const stepWithSingle = {
          ...step,
          input: {
            ...baseInput,
            find: candidate
          }
        };
        const attemptResult = await runStepOnce(app, stepWithSingle, onAskUser, onMultiStepEvent);
        if (!attemptResult?.isError) {
          return { result: attemptResult, attempts: i + 1, policyApplied: "retry_next_candidate" };
        }
        if (attemptResult.needsUserInput) {
          return {
            result: attemptResult,
            attempts: i + 1,
            policyApplied: "needs_user_input",
            needsUserInput: true
          };
        }
        lastError = attemptResult;
      }
      return {
        result: lastError || { result: "Unknown step failure.", isError: true },
        attempts: findCandidates.length,
        policyApplied: "retry_next_candidate"
      };
    }
  }

  const result = await runStepOnce(app, step, onAskUser, onMultiStepEvent);

  if (!result?.isError) {
    return { result, attempts: 1, policyApplied: "none" };
  }

  if (result.needsUserInput) {
    return { result, attempts: 1, policyApplied: "needs_user_input", needsUserInput: true };
  }

  if (policy === "retry_once") {
    const retry = await runStepOnce(app, step, onAskUser, onMultiStepEvent);
    return { result: retry, attempts: 2, policyApplied: "retry_once" };
  }

  return { result, attempts: 1, policyApplied: policy === "continue" ? "continue" : "stop" };
}

async function evaluateStopNode(app, node, stepResults, hadToolErrors) {
  if (!isRecordArg(node)) return { ok: false, details: [{ criterion: "invalid", ok: false }] };

  if (Array.isArray(node.all)) {
    const allDetails = [];
    for (const child of node.all) {
      const evaled = await evaluateStopNode(app, child, stepResults, hadToolErrors);
      allDetails.push(...evaled.details);
      if (!evaled.ok) return { ok: false, details: allDetails };
    }
    return { ok: true, details: allDetails };
  }

  if (Array.isArray(node.any)) {
    const anyDetails = [];
    let anyOk = false;
    for (const child of node.any) {
      const evaled = await evaluateStopNode(app, child, stepResults, hadToolErrors);
      anyDetails.push(...evaled.details);
      if (evaled.ok) anyOk = true;
    }
    return { ok: anyOk, details: anyDetails };
  }

  const type = ToolHelper.requiredString(node.type);
  if (!type) return { ok: false, details: [{ criterion: "missing_type", ok: false }] };

  if (type === "no_tool_errors") {
    return { ok: !hadToolErrors, details: [{ criterion: "no_tool_errors", ok: !hadToolErrors }] };
  }

  if (type === "file_contains" || type === "file_not_contains") {
    const path = ToolHelper.requiredString(node.path);
    const text = ToolHelper.requiredString(node.text);
    const file = path ? app.vault.getFileByPath(obsidian.normalizePath(path)) : null;
    let hasText = false;
    if (file && text) {
      try {
        const raw = await app.vault.cachedRead(file);
        hasText = raw.includes(text);
      } catch {
        hasText = false;
      }
    }
    const ok = type === "file_contains" ? hasText : !hasText;
    return { ok, details: [{ criterion: type, ok }] };
  }

  if (type === "tool_result_contains" || type === "tool_result_not_contains") {
    const stepId = ToolHelper.requiredString(node.stepId || node.id);
    const text = ToolHelper.requiredString(node.text);
    const step = stepResults.get(stepId);
    const hay = step ? String(step.resultText || "") : "";
    const hasText = text ? hay.includes(text) : false;
    const ok = type === "tool_result_contains" ? hasText : !hasText;
    return { ok, details: [{ criterion: type, ok }] };
  }

  return { ok: false, details: [{ criterion: type, ok: false }] };
}

async function evaluateStopWhen(app, stopWhen, stepResults, hadToolErrors) {
  if (!isRecordArg(stopWhen)) return { ok: false, details: [] };
  return await evaluateStopNode(app, stopWhen, stepResults, hadToolErrors);
}

declareExports({
  executeTool,
  runStepOnce,
  runStepWithPolicy,
  evaluateStopWhen,
  inferChanged,
  inferNoProgressSignal
});


