## Bundle global contract

This file, GLOBALS.md, tracks symbols intentionally shared across brace-wrapped build segments.

## Preamble/runtime globals

- __registeredInitCalls
- __initRuntimeLog
- appendStartupLogLine
- setAichatStartupComplete
- routeAichatRuntimeError
- registerInit
- runRegisteredInits
- declareExports

## Types/settings globals

- DEFAULT_SETTINGS
- CHATGPT_OAUTH_DEFAULT_MODEL
- getModelDisplayName
- ChatSettingTab

## Provider/client globals

- sendAnthropicMessage
- sendOpenAIMessage
- clearOpenAIState
- consumeOpenAIRecoveryNotes
- sendChatGPTOAuthMessage
- setChatGPTOAuthService
- clearChatGPTOAuthState
- sendMessage
- ChatGPTOAuthService
- ChatGPTOAuthError
- ChatGPTOAuthStore

## Agent/view globals

- buildContext
- loadSystemPrompt
- buildSystemPrompt
- buildContextMessage
- ChatFileCache
- AgentLoop
- VIEW_TYPE_CHAT
- ObsidianChatView
- createVanillaChatContainer

## Agent/efficiency globals

- EfficiencyLog

## Tool registry/executor globals

- TOOL_DEFINITIONS
- executeTool
- runStepOnce
- runStepWithPolicy
- evaluateStopWhen
- inferChanged
- inferNoProgressSignal

## Tool command namespace

- Command (namespace object)
  - agentsTool
  - resolveAgentsPath
  - askUser
  - createFile
  - deleteFile
  - editDocument
  - normalizeFindCandidates
  - flushTool
  - frontmatter
  - getBacklinks
  - getCurrentDatetime
  - getProperties
  - listFiles
  - openDocument
  - readFile
  - renameFile
  - revertEdit
  - searchRead
  - searchVault
  - setProperties
  - snippets
  - talkAndEndTurn
  - talk

## Shared helper globals

- optionalString
- requiredString
- isRecord
- requiredRecord
- clampNumber
- EDIT_JOURNAL_PATH
- readEditJournalEntries
- recordEditJournal
- parseExtensionTokens
- getPathExtension
- DEFAULT_BINARY_EXTENSION_BLACKLIST
- fileMatchesExtensionPolicy
- resolveFile
- validateCfcEditPrecondition
- ensureParentFolder
- sha256Hex
- normalizeComparablePath
- basenameOfPath
- toSearchReadExtract
- toSearchReadMatchMode
- truncateUtf8
- buildSnippetExtract
- buildSearchReadError
- buildSearchReadStatus
- computeBestScore

## Historical files

- migration_GLOBALS.md and migration_rmap.md are preserved snapshots from pre-contract tracking.
