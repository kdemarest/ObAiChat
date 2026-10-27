



registerInit("types", init_types);
let FALLBACK_MODELS = {
  anthropic: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }
  ],
  openai: [
    { value: "gpt-5.3-codex", label: "Codex 5.3" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-4o", label: "GPT-4o" }
  ],
  // Mirrors the bundled `models.json` shipped with the official OpenAI Codex
  // CLI. These are the slugs the Codex backend currently accepts when the
  // request is authenticated with a ChatGPT account. Sorted by Codex CLI
  // priority (lowest first = recommended). Update when upstream changes.
  "chatgpt-oauth": [
    { value: "gpt-5.5", label: "GPT-5.5 (recommended)" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4-Mini" },
    { value: "gpt-5.3-codex", label: "GPT-5.3-Codex" },
    { value: "gpt-5.2", label: "GPT-5.2" }
  ]
};
let modelCache = /* @__PURE__ */ new Map();
function getModelDisplayName(provider, modelId) {
  const cached = modelCache.get(provider);
  const models = cached || FALLBACK_MODELS[provider] || [];
  const match = models.find((m) => m.value === modelId);
  return match?.label || modelId;
}
let ChatSettingTab = class extends obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    new obsidian.Setting(containerEl).setName("Provider").setDesc("Which AI provider to use").addDropdown(
      (dropdown) => dropdown.addOption("anthropic", "Anthropic").addOption("openai", "OpenAI").addOption("chatgpt-oauth", "ChatGPT OAuth").setValue(s.provider).onChange(async (value) => {
        s.provider = value;
        s.model = "";
        this.plugin.reloadApiKeyForProvider();
        if (s.provider === "chatgpt-oauth" && !s.model) {
          s.model = CHATGPT_OAUTH_DEFAULT_MODEL;
        }
        await this.plugin.saveSettings();
        window.setTimeout(() => this.display(), 10);
      })
    );
    if (s.provider === "chatgpt-oauth") {
      this.renderChatGPTOAuthSection(containerEl);
    } else {
      this.renderApiKeySection(containerEl);
    }
    this.renderModelSection(containerEl);
    new obsidian.Setting(containerEl).setName("Web search").setDesc("Allow the model to search the web when it needs current information").addToggle(
      (toggle) => toggle.setValue(s.enableWebSearch).onChange(async (value) => {
        s.enableWebSearch = value;
        await this.plugin.saveSettings();
      })
    );
    new obsidian.Setting(containerEl).setName("Zero keyboard height in VSCode editor").setDesc("When enabled, sets Obsidian's --keyboard-height to 0px for vscode-editor leaves.").addToggle(
      (toggle) => toggle.setValue(!!s.zeroKeyboardHeightInVsCode).onChange(async (value) => {
        s.zeroKeyboardHeightInVsCode = value;
        await this.plugin.saveSettings();
      })
    );
    new obsidian.Setting(containerEl).setName("Max tool iterations").setDesc("Safety limit for the agent loop (default: 20)").addText(
      (text2) => text2.setPlaceholder("20").setValue(String(s.maxIterations)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n > 0 && n <= 100) {
          s.maxIterations = n;
          await this.plugin.saveSettings();
        }
      })
    );
  }
  // ─── API key + test (anthropic / openai) ──────────────────────────────────
  renderApiKeySection(containerEl) {
    const s = this.plugin.settings;
    const apiKeySetting = new obsidian.Setting(containerEl).setName("API key").setDesc(s.apiKey ? "Key saved" : "Enter your API key to get started").addText((text2) => {
      text2.inputEl.type = "password";
      text2.setPlaceholder("Enter your API key").setValue(s.apiKey).onChange(async (value) => {
        const hadKey = !!s.apiKey;
        s.apiKey = value.trim();
        await this.plugin.saveSettings();
        if (!hadKey && s.apiKey) {
          window.setTimeout(() => this.display(), 10);
        }
      });
    });
    if (s.apiKey) {
      apiKeySetting.addButton(
        (button) => button.setButtonText("Test").onClick(async () => {
          button.setButtonText("Testing...");
          button.setDisabled(true);
          try {
            registerInit("client", init_client, ["anthropic", "openai", "chatgpt_oauth"]);
            const response = await sendMessage(
              s,
              [{ role: "user", content: "Say hello in one word." }],
              [],
              "You are a test. Respond with one word."
            );
            const text2 = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
            new obsidian.Notice(`Connected! Response: "${text2}"`);
            apiKeySetting.setDesc("Connection successful");
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            new obsidian.Notice(`Connection failed: ${msg}`);
            apiKeySetting.setDesc(`Failed: ${msg}`);
          } finally {
            button.setButtonText("Test");
            button.setDisabled(false);
          }
        })
      );
    }
  }
  // ─── ChatGPT OAuth ────────────────────────────────────────────────────────
  renderChatGPTOAuthSection(containerEl) {
    const credential = this.plugin.chatgptOAuth.getCredential();
    const explainer = containerEl.createEl("div", {
      cls: "setting-item-description ochatting-oauth-explainer"
    });
    explainer.createSpan({
      text: "Sign in with your ChatGPT account instead of using an OpenAI API key. Requests are routed through the ChatGPT/Codex backend (not "
    });
    explainer.createEl("code", { text: "api.openai.com" });
    explainer.createSpan({
      text: ") and require an active ChatGPT plan with Codex access. The available models mirror the Codex CLI catalog."
    });
    if (credential) {
      const account = credential.accountId ? maskAccountId(credential.accountId) : "(no account id)";
      const expires = new Date(credential.expiresAt).toLocaleString();
      new obsidian.Setting(containerEl).setName("ChatGPT account").setDesc(`Connected \u2014 account ${account}. Token expires ${expires}.`).addButton(
        (button) => button.setButtonText("Disconnect").setWarning().onClick(async () => {
          this.plugin.chatgptOAuth.clearCredential();
          new obsidian.Notice("ChatGPT OAuth disconnected.");
          this.display();
        })
      ).addButton(
        (button) => button.setButtonText("Test").onClick(async () => {
          button.setButtonText("Testing...");
          button.setDisabled(true);
          try {
            registerInit("client", init_client, ["anthropic", "openai", "chatgpt_oauth"]);
            const response = await sendMessage(
              this.plugin.settings,
              [{ role: "user", content: "Say hello in one word." }],
              [],
              "You are a test. Respond with one word."
            );
            const text2 = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
            new obsidian.Notice(`Connected! Response: "${text2 || "(no text)"}"`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            new obsidian.Notice(`Connection test failed: ${msg}`);
          } finally {
            button.setButtonText("Test");
            button.setDisabled(false);
          }
        })
      );
    } else {
      new obsidian.Setting(containerEl).setName("ChatGPT account").setDesc("Not connected. Sign in with ChatGPT to use this provider.").addButton(
        (button) => button.setButtonText("Connect ChatGPT").setCta().onClick(async () => {
          try {
            const auth = await this.plugin.chatgptOAuth.beginDeviceAuthorization();
            const handle = this.plugin.chatgptOAuth.pollDeviceAuthorization(auth);
            const modal = new ChatGPTDeviceLoginModal(this.app, auth, handle, () => {
              this.display();
            });
            modal.open();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            new obsidian.Notice(`Failed to start ChatGPT login: ${msg}`);
          }
        })
      );
    }
  }
  // ─── Model picker ─────────────────────────────────────────────────────────
  renderModelSection(containerEl) {
    const s = this.plugin.settings;
    const cached = modelCache.get(s.provider);
    const models = cached || FALLBACK_MODELS[s.provider] || FALLBACK_MODELS.anthropic;
    const modelSetting = new obsidian.Setting(containerEl).setName("Model").setDesc(cached ? `${cached.length} models from API` : "Using defaults. Click refresh to load from API.").addDropdown((dropdown) => {
      for (const m of models) {
        dropdown.addOption(m.value, m.label);
      }
      dropdown.addOption("__custom__", "Custom...");
      if (s.model && !models.some((m) => m.value === s.model)) {
        dropdown.addOption(s.model, `${s.model} (current)`);
      }
      dropdown.setValue(s.model || models[0]?.value || "");
      dropdown.onChange(async (value) => {
        if (value === "__custom__") {
          s.model = "";
          await this.plugin.saveSettings();
          window.setTimeout(() => this.display(), 10);
        } else {
          s.model = value;
          await this.plugin.saveSettings();
        }
      });
    });
    const canFetchModels = s.provider === "anthropic" && !!s.apiKey || s.provider === "openai" && !!s.apiKey;
    if (canFetchModels) {
      modelSetting.addButton(
        (btn) => btn.setIcon("refresh-cw").setTooltip("Fetch models from API").onClick(async () => {
          btn.setDisabled(true);
          try {
            const fetched = await fetchModelsFromAPI(s.provider, s.apiKey);
            modelCache.set(s.provider, fetched);
            new obsidian.Notice(`Loaded ${fetched.length} models`);
            if (!s.model && fetched.length > 0) {
              s.model = fetched[0].value;
              await this.plugin.saveSettings();
            }
            this.display();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            new obsidian.Notice(`Failed to fetch models: ${msg}`);
          }
        })
      );
    }
    if (!s.model) {
      new obsidian.Setting(containerEl).setName("Custom model ID").setDesc("Enter the full model identifier").addText(
        (text2) => text2.setPlaceholder(
          s.provider === "anthropic" ? "claude-sonnet-4-20250514" : s.provider === "chatgpt-oauth" ? CHATGPT_OAUTH_DEFAULT_MODEL : "gpt-4o"
        ).setValue(s.model).onChange(async (value) => {
          s.model = value.trim();
          await this.plugin.saveSettings();
        })
      );
    }
  }
};
let ChatGPTDeviceLoginModal = class extends obsidian.Modal {
  constructor(app, authorization, handle, onComplete) {
    super(app);
    this.authorization = authorization;
    this.handle = handle;
    this.onComplete = onComplete;
  }
  cancelled = false;
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new obsidian.Setting(contentEl).setName("Connect ChatGPT").setHeading();
    contentEl.createEl("p", {
      text: "1. Open this page in any browser:"
    });
    const linkRow = contentEl.createEl("div", { cls: "ochatting-device-link-row" });
    const link2 = linkRow.createEl("a", {
      text: this.authorization.verificationUri,
      href: this.authorization.verificationUri
    });
    link2.setAttr("target", "_blank");
    link2.setAttr("rel", "noopener");
    contentEl.createEl("p", { text: "2. Enter this code on the page:" });
    const codeRow = contentEl.createEl("div", { cls: "ochatting-device-code-row" });
    codeRow.createEl("code", {
      text: this.authorization.userCode,
      cls: "ochatting-device-code"
    });
    const copyBtn = codeRow.createEl("button", { text: "Copy code" });
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(this.authorization.userCode).then(() => new obsidian.Notice("Code copied.")).catch(() => new obsidian.Notice("Failed to copy code."));
    });
    const status = contentEl.createEl("p", {
      text: "Waiting for authorization. You can return here after signing in.",
      cls: "ochatting-device-status"
    });
    const buttons = contentEl.createEl("div", { cls: "ochatting-device-buttons" });
    const openBtn = buttons.createEl("button", { text: "Open login page" });
    openBtn.classList.add("mod-cta");
    openBtn.addEventListener("click", () => {
      window.open(this.authorization.verificationUri, "_blank");
    });
    const cancelBtn = buttons.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.cancelled = true;
      this.handle.cancel();
      this.close();
    });
    this.handle.promise.then(() => {
      if (this.cancelled) return;
      new obsidian.Notice("ChatGPT connected.");
      this.onComplete();
      this.close();
    }).catch((e) => {
      if (this.cancelled) return;
      const msg = e instanceof Error ? e.message : String(e);
      status.setText(`Login failed: ${msg}`);
      status.removeClass("ochatting-device-status");
      status.addClass("ochatting-device-status-error");
    });
  }
  onClose() {
    if (!this.cancelled) {
      this.handle.cancel();
    }
    this.contentEl.empty();
  }
};
function maskAccountId(accountId) {
  if (accountId.length <= 8) return accountId;
  return `${accountId.slice(0, 4)}\u2026${accountId.slice(-4)}`;
}
async function fetchModelsFromAPI(provider, apiKey) {
  if (provider === "anthropic") {
    return fetchAnthropicModels(apiKey);
  }
  if (provider === "openai") {
    return fetchOpenAIModels(apiKey);
  }
  return FALLBACK_MODELS["chatgpt-oauth"];
}
async function fetchAnthropicModels(apiKey) {
  let response;
  try {
    response = await (0, obsidian.requestUrl)({
      url: "https://api.anthropic.com/v1/models?limit=100",
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
  const models = getModelRecords(response.json).filter((m) => m.type === "model").filter((m) => typeof m.id === "string").map((m) => ({
    value: m.id,
    label: typeof m.display_name === "string" ? m.display_name : m.id
  })).sort((a, b) => {
    const da = a.value.match(/(\d{8})/)?.[1] || "";
    const db = b.value.match(/(\d{8})/)?.[1] || "";
    return db.localeCompare(da) || a.label.localeCompare(b.label);
  });
  return models.length > 0 ? models : FALLBACK_MODELS.anthropic;
}
async function fetchOpenAIModels(apiKey) {
  let response;
  try {
    response = await (0, obsidian.requestUrl)({
      url: "https://api.openai.com/v1/models",
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
  const chatPrefixes = ["gpt-", "o1", "o3", "o4", "chatgpt-", "codex-", "gpt5"];
  const excludePatterns = ["realtime", "audio", "transcri", "search"];
  const models = getModelRecords(response.json).filter((m) => typeof m.id === "string").filter((m) => {
    const id = m.id.toLowerCase();
    return chatPrefixes.some((p) => id.startsWith(p)) && !excludePatterns.some((p) => id.includes(p));
  }).sort(
    (a, b) => numberValue3(b.created) - numberValue3(a.created)
  ).map((m) => ({ value: m.id, label: m.id }));
  return models.length > 0 ? models : FALLBACK_MODELS.openai;
}
function getModelRecords(value) {
  if (!isRecord4(value) || !Array.isArray(value.data)) return [];
  return value.data.filter(isRecord4);
}
function numberValue3(value) {
  return typeof value === "number" ? value : 0;
}
function isRecord4(value) {
  return typeof value === "object" && value !== null;
}

declareExports({
  getModelDisplayName,
  ChatSettingTab
});

