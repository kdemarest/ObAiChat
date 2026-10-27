
registerInit("types", init_types);

registerInit("chatgptOAuth", init_chatgptOAuth);
registerInit("chatgpt_oauth", init_chatgpt_oauth, ["types", "chatgptOAuth"]);
let PLUGIN_ID = "obaichat";
let LEGACY_PLUGIN_ID = "obsidian-chatting";
let LEGACY_RELEASE_ASSETS = /* @__PURE__ */ new Set(["main.js", "manifest.json", "styles.css"]);
let SECRET_PROVIDERS = ["anthropic", "openai", "chatgpt-oauth"];
let CHATGPT_OAUTH_SECRET_KEY = `${PLUGIN_ID}-chatgpt-oauth`;
let LEGACY_CHATGPT_OAUTH_SECRET_KEY = `${LEGACY_PLUGIN_ID}-chatgpt-oauth`;
let ChatPlugin = class extends obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
  /** Shared agent loop that persists across view open/close cycles */
  agent;
  /** ChatGPT OAuth service (used by the chatgpt-oauth provider). */
  chatgptOAuth;
  /** Chat messages for replaying into the UI when the view reopens */
  chatHistory = [];
  runtimeErrorHandlersInstalled = false;
  constructor(app, manifest) {
    console.log("[ObAiChat] plugin constructor:enter");
    super(app, manifest);
    void this.appendStartupLogLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ObAiChat constructor after super`);
  }
  installRuntimeErrorHandlers() {
    if (this.runtimeErrorHandlersInstalled) return;
    this.runtimeErrorHandlersInstalled = true;
    try {
      window.addEventListener("error", (event) => {
        const err = event?.error;
        const text = err instanceof Error ? err.stack || err.message : event?.message || String(err || "unknown error");
        routeAichatRuntimeError(text, "window.error");
      });
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event?.reason;
        const text = reason instanceof Error ? reason.stack || reason.message : String(reason || "unhandled rejection");
        routeAichatRuntimeError(text, "window.unhandledrejection");
      });
    } catch {
    }
  }
  async appendStartupLogLine(line) {
    try {
      if (typeof appendStartupLogLine === "function") {
        await appendStartupLogLine(line);
        return;
      }
      const adapter = this.app?.vault?.adapter;
      if (!adapter) return;
      const path = "ObAiChat/start.log";
      if (typeof adapter.append === "function") {
        await adapter.append(path, `${line}\n`);
        return;
      }
      const prior = await adapter.exists(path) ? await adapter.read(path) : "";
      await adapter.write(path, `${prior}${line}\n`);
    } catch {
    }
  }
  async compactChatIncomingLogAtStartup() {
    try {
      const adapter = this.app?.vault?.adapter;
      if (!adapter) return;
      const path = "chatIncoming.log";
      if (!(await adapter.exists(path))) return;
      const raw = await adapter.read(path);
      const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
      if (lines.length <= 1e3) return;
      const compacted = `${lines.slice(-1e3).join("\n")}\n`;
      await adapter.write(path, compacted);
    } catch {
    }
  }
  async onload() {
    this.installRuntimeErrorHandlers();
    setAichatStartupComplete(false);
    const startupTs = (/* @__PURE__ */ new Date()).toISOString();
    await this.appendStartupLogLine(`[${startupTs}] ObAiChat onload start`);
    await this.compactChatIncomingLogAtStartup();
    const logStartupStep = async (step) => {
      await this.appendStartupLogLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] startup step | ${step}`);
    };
    try {
    await logStartupStep("inits:start");
    runRegisteredInits();
    await logStartupStep("inits:ok");
    await logStartupStep("migrateLegacyPluginData:start");
    await this.migrateLegacyPluginData();
    await logStartupStep("migrateLegacyPluginData:ok");
    await logStartupStep("loadSettings:start");
    await this.loadSettings();
    this.applyKeyboardHeightSetting();
    await logStartupStep("loadSettings:ok");
    await logStartupStep("oauth:init:start");
    const oauthStore = new ChatGPTOAuthStore(this.app);
    this.chatgptOAuth = new ChatGPTOAuthService(oauthStore);
    setChatGPTOAuthService(this.chatgptOAuth);
    await logStartupStep("oauth:init:ok");
    await logStartupStep("agent:init:start");
    this.agent = new AgentLoop(this.app, this.settings);
    await logStartupStep("agent:init:ok");
    await logStartupStep("chatHistory:load:start");
    await this.loadChatHistory();
    await logStartupStep("chatHistory:load:ok");
    await logStartupStep("ui:register:start");
    this.addSettingTab(new ChatSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ObsidianChatView(leaf, this));
    this.addRibbonIcon("message-circle", "Open AI Chat", (evt) => {
      if (evt.type === "contextmenu" || evt.button === 2) {
        const menu = new obsidian.Menu();
        menu.addItem(
          (item) => item.setTitle("Open chat").setIcon("message-circle").onClick(() => void this.openChat())
        );
        menu.addItem(
          (item) => item.setTitle("Chat about active note").setIcon("file-text").onClick(() => void this.chatAboutActiveNote())
        );
        menu.addItem(
          (item) => item.setTitle("Copy transcript").setIcon("clipboard").onClick(() => this.shareTranscript())
        );
        menu.showAtMouseEvent(evt);
      } else {
        void this.openChat();
      }
    });
    this.addCommand({
      id: "open-chat",
      name: "Open chat",
      callback: () => void this.openChat()
    });
    this.addCommand({
      id: "copy-transcript",
      name: "Copy conversation transcript to clipboard",
      callback: () => this.shareTranscript()
    });
    this.addCommand({
      id: "clear-chat",
      name: "Clear conversation",
      callback: () => this.clearChat()
    });
    this.addCommand({
      id: "chat-about-note",
      name: "Chat about this note",
      editorCallback: (editor, ctx) => {
        void this.openChatWithMessage(`Summarize this note: ${ctx.file?.path ?? "the active document"}`);
      }
    });
    this.addCommand({
      id: "send-selection",
      name: "Send selection to Chat",
      editorCheckCallback: (checking, editor, ctx) => {
        const sel = editor.getSelection();
        if (!sel || sel.length === 0) return false;
        if (checking) return true;
        const scope = { text: sel, filePath: ctx.file?.path ?? "" };
        void this.openChatWithSelection(scope);
        return true;
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof obsidian.TFile)) return;
        menu.addItem(
          (item) => item.setTitle("Find").setIcon("search").onClick(() => void this.searchCurrentFile(file))
        );
        if (file.extension === "md") {
          menu.addItem(
            (item) => item.setTitle("Chat about this note").setIcon("message-circle").onClick(() => void this.openChatWithMessage(`Tell me about ${file.path}`))
          );
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, info) => {
        const sel = editor.getSelection();
        if (sel && sel.length > 0) {
          menu.addItem(
            (item) => item.setTitle("Send selection to Chat").setIcon("message-circle").onClick(() => {
              const scope = { text: sel, filePath: info.file?.path ?? "" };
              void this.openChatWithSelection(scope);
            })
          );
        }
      })
    );
    await logStartupStep("ui:register:ok");
    await this.appendStartupLogLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ObAiChat onload success`);
    setAichatStartupComplete(true);
  } catch (error) {
    let text = "";
    if (error instanceof Error) {
      text = error.stack ? `${error.message} | ${error.stack}` : error.message;
    } else {
      text = String(error);
    }
    await this.appendStartupLogLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ObAiChat onload error | ${text}`);
    routeAichatRuntimeError(text, "onload");
    throw error;
  }
  }
  onunload() {
    void this.saveChatHistory();
  }
  // ─── Chat operations ────────────────────────────────────────────────
  /**
   * True if the active provider is configured enough to send a message.
   * - anthropic / openai: an API key is set.
   * - chatgpt-oauth: a credential is present in SecretStorage.
   */
  isProviderConfigured() {
    if (this.settings.provider === "chatgpt-oauth") {
      return !!this.chatgptOAuth?.getCredential();
    }
    return !!this.settings.apiKey;
  }
  notConfiguredMessage() {
    if (this.settings.provider === "chatgpt-oauth") {
      return "Connect your ChatGPT account in AI Chat settings.";
    }
    return "Please configure your API key in AI Chat settings.";
  }
  async openChat() {
    if (!this.isProviderConfigured()) {
      new obsidian.Notice(this.notConfiguredMessage());
      return;
    }
    await this.activateView();
  }
  /** Open chat and immediately send a message */
  async openChatWithMessage(message) {
    if (!this.isProviderConfigured()) {
      new obsidian.Notice(this.notConfiguredMessage());
      return;
    }
    await this.activateView();
    const view = this.getChatView();
    if (view) {
      window.setTimeout(() => view.sendMessage(message), 100);
    }
  }
  /** Open chat with a selection scope (shows pill, user types their own question) */
  async openChatWithSelection(selection) {
    if (!this.isProviderConfigured()) {
      new obsidian.Notice(this.notConfiguredMessage());
      return;
    }
    await this.activateView();
    const view = this.getChatView();
    if (view) {
      window.setTimeout(() => {
        view.setSelection(selection);
        view.focus();
      }, 100);
    }
  }
  async chatAboutActiveNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new obsidian.Notice("No active note.");
      return;
    }
    await this.openChatWithMessage(`Tell me about ${file.path}`);
  }
  async searchCurrentFile(file) {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.path !== file.path) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
    const activeLeaf = this.app.workspace.getMostRecentLeaf() || this.app.workspace.activeLeaf;
    const view = activeLeaf?.view;
    if (view instanceof obsidian.MarkdownView) {
      try {
        view.setMode?.("source");
      } catch {
      }
    }
    const editor = view?.editor || this.app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
    if (editor && typeof editor.exec === "function") {
      editor.exec("find");
      return;
    }
    const opened = this.app.commands.executeCommandById("editor:open-search");
    if (opened) return;
    new obsidian.Notice("Find is available only in editable text files.");
  }
  /** Open or reveal the chat view in the right sidebar (both desktop and mobile). */
  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CHAT);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
      await workspace.revealLeaf(leaf);
    }
  }
  /** Get the active ObsidianChatView using proper instanceof check (deferred view safe) */
  getChatView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT);
    for (const leaf of leaves) {
      if (leaf.view instanceof ObsidianChatView) {
        return leaf.view;
      }
    }
    return null;
  }
  shareTranscript() {
    const view = this.getChatView();
    if (!view) {
      new obsidian.Notice("No active conversation.");
      return;
    }
    const transcript = view.getTranscript();
    if (!transcript || transcript.endsWith("## Conversation\n\n")) {
      new obsidian.Notice("Conversation is empty.");
      return;
    }
    navigator.clipboard.writeText(transcript).then(() => {
      new obsidian.Notice("Transcript copied to clipboard.");
    }).catch(() => {
      new obsidian.Notice("Failed to copy transcript.");
    });
  }
  clearChat() {
    const view = this.getChatView();
    if (view) {
      view.clearConversation();
      new obsidian.Notice("Conversation cleared.");
    } else {
      new obsidian.Notice("No active conversation.");
    }
  }
  // ─── Chat history persistence ─────────────────────────────────────────
  async saveChatHistory() {
    try {
      await this.ensureFolder(this.pluginDataDir);
      const state2 = {
        chatHistory: this.chatHistory.slice(-100),
        // Cap at 100 UI messages
        agentMessages: this.agent.exportMessages().slice(-80)
        // Cap at 80 API messages
      };
      await this.app.vault.adapter.write(
        this.chatStatePath,
        JSON.stringify(state2)
      );
    } catch {
    }
  }
  async loadChatHistory() {
    try {
      const raw = await this.readFirstExisting([
        this.chatStatePath,
        this.legacyChatStatePath
      ]);
      const state2 = JSON.parse(raw);
      if (!isPersistedChatState(state2)) return;
      if (Array.isArray(state2.chatHistory)) {
        this.chatHistory = state2.chatHistory;
      }
      if (Array.isArray(state2.agentMessages)) {
        this.agent.importMessages(state2.agentMessages);
      }
    } catch {
    }
  }
  // ─── Settings persistence ────────────────────────────────────────────
  async loadSettings() {
    const saved = normalizeSettings(await this.loadData());
    this.settings = { ...DEFAULT_SETTINGS, ...saved };
    if (!this.settings.model) {
      this.settings.model = DEFAULT_SETTINGS.model;
    }
    if (this.settings.provider === "chatgpt-oauth") {
      const migrated = migrateChatGPTOAuthModelSlug(this.settings.model);
      if (migrated !== this.settings.model) {
        this.settings.model = migrated;
        this.saveData({ ...this.settings, apiKey: "" }).catch(() => {
        });
      }
    }
    this.settings.apiKey = this.loadApiKey(this.settings.provider);
  }
  async saveSettings() {
    this.saveApiKey(this.settings.provider, this.settings.apiKey || "");
    const toSave = { ...this.settings, apiKey: "" };
    await this.saveData(toSave);
    this.applyKeyboardHeightSetting();
    this.getChatView()?.updateModel(
      getModelDisplayName(this.settings.provider, this.settings.model)
    );
  }
  /** Load the correct API key when provider changes */
  reloadApiKeyForProvider() {
    this.settings.apiKey = this.loadApiKey(this.settings.provider);
  }
  applyKeyboardHeightSetting() {
    const root = document.documentElement;
    const className = "obaichat-zero-kb-height-vscode";
    if (this.settings.zeroKeyboardHeightInVsCode) {
      root.classList.add(className);
      return;
    }
    root.classList.remove(className);
  }
  loadApiKey(provider) {
    try {
      return this.app.secretStorage.getSecret(`${PLUGIN_ID}-api-key-${provider}`) || this.app.secretStorage.getSecret(`${LEGACY_PLUGIN_ID}-api-key-${provider}`) || "";
    } catch {
      return "";
    }
  }
  saveApiKey(provider, key2) {
    try {
      this.app.secretStorage.setSecret(`${PLUGIN_ID}-api-key-${provider}`, key2);
    } catch {
    }
  }
  async readFirstExisting(paths) {
    let lastError;
    for (const path of paths) {
      try {
        return await this.app.vault.adapter.read(path);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }
  async migrateLegacyPluginData() {
    await this.migrateLegacyDataFiles();
    this.migrateLegacySecrets();
  }
  async migrateLegacyDataFiles() {
    const adapter = this.app.vault.adapter;
    try {
      if (!await adapter.exists(this.legacyPluginDataDir)) return;
      await this.ensureFolder(this.pluginDataDir);
      await this.copyLegacyPluginDataDir(this.legacyPluginDataDir, this.pluginDataDir, true);
      await adapter.rmdir(this.legacyPluginDataDir, true);
    } catch {
    }
  }
  async copyLegacyPluginDataDir(fromDir, toDir, isRoot) {
    const adapter = this.app.vault.adapter;
    const listed = await adapter.list(fromDir);
    for (const folder of listed.folders) {
      const name = folder.split("/").pop();
      if (!name) continue;
      const target = `${toDir}/${name}`;
      await this.ensureFolder(target);
      await this.copyLegacyPluginDataDir(folder, target, false);
    }
    for (const file of listed.files) {
      const name = file.split("/").pop();
      if (!name) continue;
      if (isRoot && LEGACY_RELEASE_ASSETS.has(name)) continue;
      const target = `${toDir}/${name}`;
      if (!await adapter.exists(target)) {
        await adapter.writeBinary(target, await adapter.readBinary(file));
      }
    }
  }
  async ensureFolder(path) {
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(path)) return;
    const parent = path.split("/").slice(0, -1).join("/");
    if (parent) await this.ensureFolder(parent);
    try {
      await adapter.mkdir(path);
    } catch {
    }
  }
  migrateLegacySecrets() {
    for (const provider of SECRET_PROVIDERS) {
      this.migrateSecret(
        `${PLUGIN_ID}-api-key-${provider}`,
        `${LEGACY_PLUGIN_ID}-api-key-${provider}`
      );
    }
    this.migrateSecret(CHATGPT_OAUTH_SECRET_KEY, LEGACY_CHATGPT_OAUTH_SECRET_KEY);
  }
  migrateSecret(currentKey, legacyKey) {
    try {
      const currentValue = this.app.secretStorage.getSecret(currentKey);
      const legacyValue = this.app.secretStorage.getSecret(legacyKey);
      if (legacyValue && !currentValue) {
        this.app.secretStorage.setSecret(currentKey, legacyValue);
      }
      if (legacyValue) {
        this.app.secretStorage.setSecret(legacyKey, "");
      }
    } catch {
    }
  }
  get pluginDataDir() {
    return `${this.app.vault.configDir}/plugins/${PLUGIN_ID}`;
  }
  get legacyPluginDataDir() {
    return `${this.app.vault.configDir}/plugins/${LEGACY_PLUGIN_ID}`;
  }
  get chatStatePath() {
    return `${this.pluginDataDir}/chat-state.json`;
  }
  get legacyChatStatePath() {
    return `${this.legacyPluginDataDir}/chat-state.json`;
  }
};
function isPersistedChatState(value) {
  return typeof value === "object" && value !== null;
}
function normalizeSettings(value) {
  if (!isRecord6(value)) return {};
  const settings = {};
  if (isProvider(value.provider)) settings.provider = value.provider;
  if (typeof value.apiKey === "string") settings.apiKey = value.apiKey;
  if (typeof value.model === "string") settings.model = value.model;
  if (typeof value.maxIterations === "number") settings.maxIterations = value.maxIterations;
  if (typeof value.enableWebSearch === "boolean") settings.enableWebSearch = value.enableWebSearch;
  if (typeof value.zeroKeyboardHeightInVsCode === "boolean") settings.zeroKeyboardHeightInVsCode = value.zeroKeyboardHeightInVsCode;
  return settings;
}
function isProvider(value) {
  return value === "anthropic" || value === "openai" || value === "chatgpt-oauth";
}
function isRecord6(value) {
  return typeof value === "object" && value !== null;
}
let KNOWN_GOOD_OAUTH_SLUGS = /* @__PURE__ */ new Set([
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.2"
]);
function migrateChatGPTOAuthModelSlug(slug) {
  if (!slug) return CHATGPT_OAUTH_DEFAULT_MODEL;
  if (KNOWN_GOOD_OAUTH_SLUGS.has(slug)) return slug;
  const dashVersion = slug.match(/^gpt-(5)-(\d+)(.*)$/);
  if (dashVersion) {
    const candidate = `gpt-${dashVersion[1]}.${dashVersion[2]}${dashVersion[3]}`;
    if (KNOWN_GOOD_OAUTH_SLUGS.has(candidate)) return candidate;
  }
  return CHATGPT_OAUTH_DEFAULT_MODEL;
}

/* nosourcemap */


// Obsidian loads this CommonJS export as the plugin entrypoint; without it, the plugin won't register.
module.exports = ChatPlugin;
