
// The plugin was aichat until 2026-10-27; the key keeps that name so a saved ChatGPT login survives the rename.
let OAUTH_SECRET_KEY = "aichat-chatgpt-oauth";
let LEGACY_OAUTH_SECRET_KEY = "obsidian-chatting-chatgpt-oauth";
let EXPIRY_BUFFER_MS = 3e4;
let ChatGPTOAuthStore = class {
  constructor(app) {
    this.app = app;
  }
  /** Read the stored credential. Returns null if absent or malformed. */
  get() {
    let raw = null;
    try {
      raw = this.app.secretStorage.getSecret(OAUTH_SECRET_KEY) ?? this.app.secretStorage.getSecret(LEGACY_OAUTH_SECRET_KEY) ?? null;
    } catch {
      return null;
    }
    if (!raw) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string" || typeof parsed.expiresAt !== "number" || typeof parsed.updatedAt !== "number") {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      updatedAt: parsed.updatedAt,
      ...typeof parsed.accountId === "string" ? { accountId: parsed.accountId } : {},
      ...typeof parsed.idToken === "string" ? { idToken: parsed.idToken } : {}
    };
  }
  /** Write the credential. */
  set(credential) {
    try {
      this.app.secretStorage.setSecret(OAUTH_SECRET_KEY, JSON.stringify(credential));
    } catch {
    }
  }
  /** Erase the credential. SecretStorage has no delete API, so we overwrite with empty. */
  clear() {
    try {
      this.app.secretStorage.setSecret(OAUTH_SECRET_KEY, "");
    } catch {
    }
  }
  /** True if the access token has already expired (or expires within ~30s). */
  isExpired(credential) {
    return credential.expiresAt <= Date.now() + EXPIRY_BUFFER_MS;
  }
};

declareExports({
  ChatGPTOAuthStore
});

