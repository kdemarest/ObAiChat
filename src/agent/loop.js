registerInit("client", init_client, ["anthropic", "openai", "chatgpt_oauth"]);
registerInit("openai", init_openai);
registerInit("chatgpt_oauth", init_chatgpt_oauth, ["types", "chatgptOAuth"]);

const MAX_CONVERSATION_LENGTH = 40;
const KEEP_RECENT = 30;

// src/agent/loop.ts
let AgentLoop = class {
  messages = [];
  app;
  settings;
  includer;
  aborted = false;
  cfc = new ChatFileCache();
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.includer = new Includer(app);
    void loadSystemPrompt(app);
  }
  cfcRemoveEntry(entryName, reason, callbacks = null) {
    const rawName = typeof entryName === "string" ? entryName.trim() : "";
    if (!rawName) return false;

    const reasonText = typeof reason === "string" ? reason.trim() : "";
    if (!reasonText) {
      throw new Error("cfcRemoveEntry requires a non-empty reason");
    }

    const normalizedName = obsidian.normalizePath(rawName);
    const existed = this.cfc.remove(normalizedName);

    if (callbacks && typeof callbacks.onResponse === "function") {
      callbacks.onResponse(`\\-&nbsp;${normalizedName}`);
    }
    return existed;
  }

  cfcRemoveAll(reason, callbacks = null) {
    const reasonText = typeof reason === "string" ? reason.trim() : "";
    if (!reasonText) {
      throw new Error("cfcRemoveAll requires a non-empty reason");
    }

    const names = this.cfc.listPaths();
    for (const name of names) {
      this.cfcRemoveEntry(name, reasonText, callbacks);
    }
    this.cfc.clearInvalidations();
  }

  clearCfc(reason = "other", callbacks = null) {
    this.cfcRemoveAll(reason, callbacks);
    let reasonText = "for an internal reset";
    if (reason === "flush") {
      reasonText = "by a flush command";
    } else if (reason === "auto") {
      reasonText = "automatically due to cache policy";
    } else if (typeof reason === "string" && reason.trim().length > 0 && reason !== "other") {
      reasonText = `by something else (${reason.trim()})`;
    }
    if (callbacks && typeof callbacks.onResponse === "function") {
      callbacks.onResponse(`CFC cleared ${reasonText}.`);
    }
  }

  onTurnEnd(reason, callbacks = null, options = {}) {
    if (reason) {
      this.cfcRemoveAll(reason, callbacks);
    }
    if (options?.clearOpenAIState === true && this.settings.provider === "openai") {
      clearOpenAIState();
    }
  }
  /** Abort a running loop (e.g. user navigates away) */
  abort() {
    this.aborted = true;
    if (this.settings.provider === "openai") {
      clearOpenAIState();
    }
  }
  /** Clear conversation history */
  clear() {
    this.messages = [];
    this.aborted = false;
    this.clearCfc("clear");
    clearOpenAIState();
    clearChatGPTOAuthState();
  }
  /** Export API messages for persistence */
  exportMessages() {
    return this.messages;
  }
  /** Restore API messages from persistence */
  importMessages(messages) {
    this.messages = messages;
  }
  /** Export the full conversation as a readable markdown transcript */
  exportTranscript() {
    const systemPrompt = buildSystemPrompt();
    const parts = [
      `# AI Chat Transcript`,
      ``,
      `**Date:** ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `**Provider:** ${this.settings.provider}`,
      `**Model:** ${this.settings.model}`,
      ``,
      `## System Prompt`,
      ``,
      "```",
      systemPrompt,
      "```",
      ``,
      `## Conversation`,
      ``
    ];
    for (const msg of this.messages) {
      if (typeof msg.content === "string") {
        parts.push(`### ${msg.role === "user" ? "User" : "Assistant"}`);
        parts.push(``);
        parts.push(msg.content);
        parts.push(``);
      } else {
        for (const block2 of msg.content) {
          if (block2.type === "text" && block2.text) {
            parts.push(`### Assistant`);
            parts.push(``);
            parts.push(block2.text);
            parts.push(``);
          } else if (block2.type === "tool_use") {
            parts.push(`### Tool Call: \`${block2.name}\``);
            parts.push(``);
            parts.push("```json");
            parts.push(JSON.stringify(block2.input, null, 2));
            parts.push("```");
            parts.push(``);
          } else if (block2.type === "tool_result") {
            parts.push(`### Tool Result ${block2.is_error ? "(ERROR)" : ""}`);
            parts.push(``);
            parts.push("```");
            parts.push(block2.content || "(empty)");
            parts.push("```");
            parts.push(``);
          }
        }
      }
    }
    return parts.join("\n");
  }
  /** Run one user turn through the agentic loop */
  async run(userMessage, callbacks, selection) {
    this.aborted = false;
    await EfficiencyLog.trim(this.app);
    if (this.settings.provider === "openai" && hasOpenAIPendingToolContinuation(this.messages)) {
      const reconnectReason = describeOpenAIPendingContinuation(this.messages);
      clearOpenAIState();
      callbacks.onResponse(`AiChat reconnecting to OpenAI: ${reconnectReason}`);
    }
    const context = buildContext(this.app);
    const contextPrefix = buildContextMessage(context);
    const agentsContext = await this.includer.loadAgentsContext();
    const invalidationGuardStats = await this.cfc.applyExternalMutationInvalidationGuard(
      this.app,
      (entryName, reason) => this.cfcRemoveEntry(entryName, reason, callbacks)
    );
    if (invalidationGuardStats && typeof invalidationGuardStats.invalidated === "number" && invalidationGuardStats.invalidated > 0) {
      callbacks.onResponse(`CFC invalidation guard removed ${invalidationGuardStats.invalidated} entr${invalidationGuardStats.invalidated === 1 ? "y" : "ies"}.`);
    }
    let fullMessage;
    if (selection) {
      const selectionParts = [
        contextPrefix,
        "",
        `[Selection scope: The user has selected text in ${selection.filePath}. Work only within this selection. When using edit_file, use find_replace with text from within this selection. Do not modify text outside the selection.]`,
        "",
        `Selected text:`,
        `> ${selection.text}`,
        "",
        userMessage
      ];
      fullMessage = selectionParts.join("\n");
    } else {
      const normalParts = [contextPrefix, "", userMessage];
      fullMessage = normalParts.join("\n");
    }
    this.messages.push({ role: "user", content: fullMessage });
    this.pruneHistory();
    const currentUserTurnIndex = this.messages.reduce((count, msg) => {
      return count + (msg?.role === "user" && typeof msg?.content === "string" ? 1 : 0);
    }, 0);
    const baseSystemPrompt = await loadSystemPrompt(this.app);
    const systemPrompt = agentsContext ? `${baseSystemPrompt}\n\n${agentsContext}` : baseSystemPrompt;
    debugLog(this.app, "USER_MESSAGE", { userMessage, hasSelection: !!selection });
    const maxIterations = this.settings.maxIterations || 20;
    for (let i = 0; i < maxIterations; i++) {
      if (this.aborted) return;
      callbacks.onThinking();
      const cfcFilenames = this.cfc.listPaths().map((entryPath) => {
        const parts = entryPath.split(/[\\/]/);
        return parts[parts.length - 1] || entryPath;
      }).filter((name) => !!name).sort((a, b) => a.localeCompare(b));
      const cfcInline = cfcFilenames.length > 0 ? cfcFilenames.join(", ") : "(empty)";
      let response;
      try {
        response = await sendMessage(
          this.settings,
          this.messages,
          TOOL_DEFINITIONS,
          systemPrompt,
          this.cfc,
          this.app
        );
        const exactCharsSent = Number(response?.charsSent);
        if (!Number.isFinite(exactCharsSent) || exactCharsSent <= 0) {
          throw new Error("AI response telemetry missing valid charsSent");
        }
        const exactBytesSent = Number(response?.bytesSent);
        if (!Number.isFinite(exactBytesSent) || exactBytesSent <= 0) {
          throw new Error("AI response telemetry missing valid bytesSent");
        }
        const bytesSentForTelemetry = exactBytesSent;
        callbacks.onResponse(`CFC: ${cfcInline}`);
        if (this.settings.provider === "openai") {
          const inputTokens = typeof response?.usage?.inputTokens === "number" ? response.usage.inputTokens : 0;
          const outputTokens = typeof response?.usage?.outputTokens === "number" ? response.usage.outputTokens : 0;
          const totalTokens = typeof response?.usage?.totalTokens === "number" ? response.usage.totalTokens : (inputTokens + outputTokens);
          callbacks.onResponse(`${inputTokens}+${outputTokens}=${totalTokens}`);
          const recoveryNotes = consumeOpenAIRecoveryNotes();
          for (const note of recoveryNotes) {
            callbacks.onResponse(note);
          }
        }
      } catch (e) {
        if (this.settings.provider === "openai") {
          const recoveryNotes = consumeOpenAIRecoveryNotes();
          for (const note of recoveryNotes) {
            callbacks.onResponse(note);
          }
        }
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        const stack = e instanceof Error ? (e.stack || `${e.name}: ${e.message}`) : String(e);
        const telemetry = isRecord6(e?.aichatTelemetry) ? e.aichatTelemetry : null;
        const technical = telemetry
          ? `${msg}\nTelemetry: ${JSON.stringify(telemetry)}\nStack:\n${stack}`
          : `${msg}\nStack:\n${stack}`;
        debugLog(this.app, "API_ERROR", {
          error: msg,
          technical,
          telemetry,
          model: this.settings.model,
          provider: this.settings.provider
        });
        routeAichatRuntimeError(technical, "agent.run.api_error");
        this.onTurnEnd("api_error", callbacks, { clearOpenAIState: true });
        callbacks.onError(technical);
        return;
      }
      debugLog(this.app, "API_RESPONSE", { stopReason: response.stopReason, contentTypes: response.content.map((b) => b.type), usage: response.usage });
      if (this.aborted) return;
      const toolCalls = [];
      const textParts = [];
      for (const block2 of response.content) {
        if (block2.type === "text" && block2.text) {
          textParts.push(block2.text);
        } else if (block2.type === "tool_use") {
          toolCalls.push(block2);
        }
      }
      if (textParts.length > 0 && toolCalls.length > 0) {
        callbacks.onResponse(textParts.join(""));
      }
      this.messages.push({ role: "assistant", content: response.content });
      this.pruneHistory();
      if (toolCalls.length === 0) {
        if (textParts.length > 0) {
          callbacks.onResponse(textParts.join(""));
        }
        this.onTurnEnd("turn_completed_without_tool_calls", callbacks);
        return;
      }
      const resultBlocks = [];
      let stopAfterEndTurn = false;
      const chainPolicy = buildCommandChainExecutionPolicy(toolCalls);
      const chainObserve = {
        startedAt: Date.now(),
        stepsExecuted: 0,
        consecutiveNoChange: 0,
        sawNoProgressEligibleStep: false,
        hadToolErrors: false,
        firstExecutionStopReason: "",
        firstErrorCause: ""
      };
      const chainStepResults = /* @__PURE__ */ new Map();
      let stopAfterExecutionPolicy = false;
      let executionStopReason = "";

      for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
          const tc = toolCalls[toolIndex];
          if (this.aborted) return;

          if (Date.now() - chainObserve.startedAt >= chainPolicy.overallTimeoutMs) {
            stopAfterExecutionPolicy = true;
            executionStopReason = "blocked_on_error";
            const elapsedMs = Date.now() - chainObserve.startedAt;
            if (!chainObserve.firstErrorCause) {
              chainObserve.firstErrorCause = `command-chain overall timeout after ${elapsedMs}ms (limit ${chainPolicy.overallTimeoutMs}ms) while preparing ${tc.name}`;
            }
            const timeoutResult = {
              result: `Skipped due to command-chain stop: blocked_on_error (overall timeout ${chainPolicy.overallTimeoutMs}ms reached).`,
              isError: true
            };
            let sawBlockingError = false;
            for (let j = toolIndex; j < toolCalls.length; j++) {
              const skippedTc = toolCalls[j];
              const isSnippetsAlwaysNonError = skippedTc.name === "snippets";
              const isNonFatalToolOutcome = isSnippetsAlwaysNonError;
              const skippedIsEndTurn = skippedTc.name === "talkAndEndTurn" || skippedTc.name === "endturn";
              if (!skippedIsEndTurn) {
                callbacks.onToolResult(skippedTc.name, timeoutResult);
              }
              resultBlocks.push({
                type: "tool_result",
                tool_use_id: skippedTc.id,
                content: timeoutResult.result,
                is_error: !isNonFatalToolOutcome
              });
              if (!isNonFatalToolOutcome) {
                sawBlockingError = true;
              }
            }
            if (sawBlockingError) {
              chainObserve.hadToolErrors = true;
              if (!chainObserve.firstExecutionStopReason) chainObserve.firstExecutionStopReason = "blocked_on_error";
              if (!chainObserve.firstErrorCause) {
                chainObserve.firstErrorCause = `command-chain overall timeout after ${elapsedMs}ms (limit ${chainPolicy.overallTimeoutMs}ms) while preparing ${tc.name}`;
              }
            }
            break;
          }

          const split = splitTopLevelToolInput(tc.input, toolIndex);
          let stepInput = split.input;
          if (tc.name === "edit_file") {
            stepInput = this.cfc.withEditPrecondition(this.app, stepInput, getActiveFilePath);
          }
          const cfcPathsBeforeTool = this.cfc.buildCurrentPathSet(this.messages, CHAT_STREAM_CACHE_MAX_AGE_TURNS);
          if (tc.name === "read_file") {
            const requestedPath = isRecord6(stepInput) && typeof stepInput.path === "string" ? obsidian.normalizePath(stepInput.path) : "";
            if (requestedPath && cfcPathsBeforeTool.has(requestedPath)) {
              emitCfcMissNotice(callbacks, "read_file", [requestedPath]);
            }
          }
          const stepMeta = split.step;
          const isTalkTool = tc.name === "talk" || tc.name === "talkAndEndTurn";
          const isEndTurnTool = tc.name === "talkAndEndTurn" || tc.name === "endturn";
          const toolInputSummary = EfficiencyLog.summarizeToolInput(tc.name, stepInput);
          void EfficiencyLog.append(this.app, {
            type: "tool_call",
            phase: "run",
            scope: "top",
            tool: tc.name,
            ...toolInputSummary
          });

          if (!isTalkTool && !isEndTurnTool) {
            callbacks.onToolCall(tc.name, stepInput);
          }

          const policyRunResult = await executeTopLevelToolWithPolicy(
            this.app,
            tc.name,
            stepInput,
            stepMeta,
            callbacks.onAskUser,
            (event) => {
              if (!event || typeof event !== "object") return;
              const toolName = typeof event.tool === "string" ? event.tool : "";
              if (!toolName) return;
              const nestedName = `M ${toolName}`;
              if (event.type === "tool_call") {
                const nestedInput = event.input || {};
                const nestedInputSummary = EfficiencyLog.summarizeToolInput(toolName, nestedInput);
                void EfficiencyLog.append(this.app, {
                  type: "tool_call",
                  phase: "run",
                  scope: "nested",
                  tool: toolName,
                  ...nestedInputSummary
                });
                if (toolName !== "talk" && toolName !== "talkAndEndTurn" && toolName !== "endturn") {
                  callbacks.onToolCall(nestedName, nestedInput);
                }
              } else if (event.type === "tool_result") {
                const nestedResult = event.result || { result: "", isError: false };
                const nestedResultSummary = EfficiencyLog.summarizeToolResult(toolName, {}, nestedResult);
                void EfficiencyLog.append(this.app, {
                  type: "tool_result",
                  phase: "run",
                  scope: "nested",
                  tool: toolName,
                  ...nestedResultSummary
                });
                if ((toolName === "talk" || toolName === "talkAndEndTurn") && !nestedResult.isError) {
                  const nestedText = typeof nestedResult.result === "string" ? nestedResult.result : String(nestedResult.result || "");
                  callbacks.onResponse(
                    toolName === "talkAndEndTurn" ? ensureTalkAndEndTurnPrefix(nestedText) : ensureTalkPrefix(nestedText)
                  );
                } else if (toolName !== "talkAndEndTurn" && toolName !== "endturn") {
                  if ((toolName === "read_file" || toolName === "search_read") && !nestedResult.isError && typeof nestedResult.result === "string") {
                    const nestedPathFromInput = isRecord6(nestedInput) && typeof nestedInput.path === "string" ? nestedInput.path : "";
                    const nestedPathFromResult = isRecord6(nestedResult) && typeof nestedResult.path === "string" ? nestedResult.path : "";
                    const nestedPath = nestedPathFromInput || nestedPathFromResult;
                    const nestedBytes = new TextEncoder().encode(nestedResult.result).length;
                    callbacks.onToolResult(nestedName, {
                      ...nestedResult,
                      result: JSON.stringify({
                        type: `${toolName}_cached`,
                        path: nestedPath,
                        bytes: nestedBytes,
                        cfcUpdated: true,
                        message: `${toolName} content omitted from tool_result. Look in Chat File Cache (CFC) for fetched file content.`
                      })
                    });
                  } else {
                    callbacks.onToolResult(nestedName, nestedResult);
                  }
                }
              }
            }
          );

          const result = policyRunResult.result || { result: "Unknown step failure.", isError: true };

          if (!result.isError && tc.name === "search_read") {
            const entryPaths = extractSearchReadEntryPaths(result);
            const missed = [];
            for (const path of entryPaths) {
              if (cfcPathsBeforeTool.has(path)) missed.push(path);
            }
            emitCfcMissNotice(callbacks, "search_read", missed);
          }

          if (tc.name === "flush" && !result.isError) {
            const flushTargetPath = isRecord6(stepInput) && typeof stepInput.path === "string" ? stepInput.path : "";
            const flushAll = isRecord6(stepInput) && stepInput.all === true;
            const flushStats = await flushReadPayloadsFromHistory(this.messages, {
              path: flushTargetPath,
              all: flushAll
            });
            if (flushStats.mode === "all") {
              this.clearCfc("flush", callbacks);
            } else if (flushStats.path) {
              this.cfcRemoveEntry(flushStats.path, "flush", callbacks);
            }
            result.result = JSON.stringify({
              action: "flush",
              ...flushStats
            }, null, 2);
          }

          if (!result.isError) {
            if (tc.name === "rename_file") {
              const oldPath = isRecord6(stepInput) && typeof stepInput.path === "string" ? stepInput.path : "";
              const newPath = isRecord6(stepInput) && typeof stepInput.new_path === "string" ? stepInput.new_path : "";
              if (oldPath) {
                this.cfcRemoveEntry(oldPath, "rename_file", callbacks);
              }
              if (newPath) {
                await this.cfc.refreshPath(this.app, newPath, currentUserTurnIndex);
              }
            } else if (tc.name === "delete_file") {
              const deletedPath = isRecord6(stepInput) && typeof stepInput.path === "string" ? stepInput.path : "";
              if (deletedPath) {
                this.cfcRemoveEntry(deletedPath, "delete_file", callbacks);
              }
            } else {
              const seeded = seedCfcFromToolResult(this.cfc, tc.name, stepInput, result, currentUserTurnIndex);
              if (!seeded) {
                const refreshPaths = collectCacheRefreshPaths(this.app, tc.name, stepInput, result);
                for (const cachePath of refreshPaths) {
                  await this.cfc.refreshPath(this.app, cachePath, currentUserTurnIndex);
                }
              }
            }
          }

          const toolResultSummary = EfficiencyLog.summarizeToolResult(tc.name, stepInput, result);
          void EfficiencyLog.append(this.app, {
            type: "tool_result",
            phase: "run",
            scope: "top",
            tool: tc.name,
            ...toolResultSummary
          });

          let cfcOnlyToolResultText = "";
          if (!result.isError && (tc.name === "read_file" || tc.name === "search_read") && typeof result.result === "string") {
            cfcOnlyToolResultText = await buildCfcOnlyReadToolResult(tc.name, stepInput, result, callbacks);
          }

          if (isTalkTool && !result.isError) {
            const talkText = typeof result.result === "string" ? result.result : String(result.result || "");
            callbacks.onResponse(
              tc.name === "talkAndEndTurn" ? ensureTalkAndEndTurnPrefix(talkText) : ensureTalkPrefix(talkText)
            );
          } else if (!isEndTurnTool) {
            if (cfcOnlyToolResultText) {
              callbacks.onToolResult(tc.name, {
                ...result,
                result: cfcOnlyToolResultText
              });
            } else {
              callbacks.onToolResult(tc.name, result);
            }
          }

          let toolResultContent = cfcOnlyToolResultText || result.result;
          if (policyRunResult.attempts > 1) {
            const baseText = typeof toolResultContent === "string" ? toolResultContent : JSON.stringify(toolResultContent);
            toolResultContent = `[policy: ${policyRunResult.policyApplied}; attempts: ${policyRunResult.attempts}]\n${baseText}`;
          }
          resultBlocks.push({
            type: "tool_result",
            tool_use_id: tc.id,
            content: toolResultContent,
            is_error: result.isError
          });

          chainStepResults.set(stepMeta.id, {
            resultText: typeof result.result === "string" ? result.result : JSON.stringify(result.result),
            ok: !result.isError,
            changed: inferCommandChainChanged(tc.name, stepInput, result)
          });

          const noProgressSignal = inferCommandChainNoProgressSignal(tc.name, stepInput, result);
          chainObserve.stepsExecuted += 1;
          if (noProgressSignal === "progress") {
            chainObserve.sawNoProgressEligibleStep = true;
            chainObserve.consecutiveNoChange = 0;
          } else if (noProgressSignal === "stalled") {
            chainObserve.sawNoProgressEligibleStep = true;
            chainObserve.consecutiveNoChange += 1;
          }
          if (result.isError) {
            chainObserve.hadToolErrors = true;
          }

          if (!result.isError && isEndTurnTool) {
            stopAfterEndTurn = true;
          }

          if (result.isError) {
            stopAfterExecutionPolicy = true;
            executionStopReason = "blocked_on_error";
            if (!chainObserve.firstExecutionStopReason) chainObserve.firstExecutionStopReason = "blocked_on_error";
          }

          const computedExecutionStop = shouldStopCommandChainForExecutionPolicy(chainPolicy, chainObserve, result.isError);
          if (computedExecutionStop && !chainObserve.firstExecutionStopReason) {
            chainObserve.firstExecutionStopReason = computedExecutionStop;
          }
          const effectiveExecutionStop = computedExecutionStop === "max_steps_reached" || computedExecutionStop === "no_progress" ? "" : computedExecutionStop;
          if (!stopAfterExecutionPolicy && effectiveExecutionStop) {
            stopAfterExecutionPolicy = true;
            executionStopReason = effectiveExecutionStop;
          }

          if (stopAfterEndTurn || stopAfterExecutionPolicy) {
            if (!stopAfterEndTurn && stopAfterExecutionPolicy && toolIndex < toolCalls.length - 1) {
              const computedReason = executionStopReason || "blocked_on_error";
              const computedCause = computedReason === "blocked_on_error"
                ? (
                  chainObserve.firstErrorCause
                    || (
                      Date.now() - chainObserve.startedAt >= chainPolicy.overallTimeoutMs
                        ? `command-chain overall timeout after ${Date.now() - chainObserve.startedAt}ms (limit ${chainPolicy.overallTimeoutMs}ms)`
                        : "command-chain stopped due to a prior error"
                    )
                )
                : "";
              for (let j = toolIndex + 1; j < toolCalls.length; j++) {
                const skippedTc = toolCalls[j];
                const skippedResult = buildSkippedCommandChainToolResult(computedReason, computedReason !== "criteria_met", computedCause);
                const skippedIsEndTurn = skippedTc.name === "talkAndEndTurn" || skippedTc.name === "endturn";
                if (!skippedIsEndTurn) {
                  callbacks.onToolResult(skippedTc.name, skippedResult);
                }
                resultBlocks.push({
                  type: "tool_result",
                  tool_use_id: skippedTc.id,
                  content: skippedResult.result,
                  is_error: computedReason !== "criteria_met"
                });
              }
            }
            break;
          }
        }
      debugLog(this.app, "COMMAND_CHAIN_EXECUTION_POLICY", {
        goal: chainPolicy.goal,
        policy: chainPolicy,
        observed: {
          stepsExecuted: chainObserve.stepsExecuted,
          consecutiveNoChange: chainObserve.consecutiveNoChange,
          hadToolErrors: chainObserve.hadToolErrors,
          firstExecutionStopReason: chainObserve.firstExecutionStopReason || "none",
          enforcedStop: stopAfterExecutionPolicy,
          enforcedStopReason: executionStopReason || "none"
        }
      });
      this.messages.push({ role: "user", content: resultBlocks });
      this.pruneHistory();
      if (stopAfterEndTurn) {
        this.onTurnEnd("turn_closed_after_talkAndEndTurn", callbacks, { clearOpenAIState: true });
        return;
      }
      if (stopAfterExecutionPolicy) {
        callbacks.onResponse("Stopped on error");
      }
    }
    this.onTurnEnd("max_iterations_reached", callbacks, { clearOpenAIState: true });
    callbacks.onError(
      `Reached maximum iterations (${maxIterations}). The task may be too complex for a single conversation turn.`
    );
  }

  /** Drop oldest messages when conversation gets too long, keeping recent context */
  pruneHistory() {
    if (this.messages.length > MAX_CONVERSATION_LENGTH) {
      this.messages = this.messages.slice(-KEEP_RECENT);
    }
  }
};

declareExports({
  AgentLoop
});
