
registerInit("chatgptOAuth", init_chatgptOAuth);
let ISSUER, CLIENT_ID, DEVICE_VERIFICATION_URI, DEVICE_REDIRECT_URI, POLL_MARGIN_MS, USER_AGENT, ChatGPTOAuthError, sleep, base64UrlDecode, parseJwtClaims, extractAccountIdFromClaims, extractAccountId, describeError, ChatGPTOAuthService;
function init_chatgptOAuth() {
  "use strict";
  ISSUER = "https://auth.openai.com";
  CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
  DEVICE_VERIFICATION_URI = `${ISSUER}/codex/device`;
  DEVICE_REDIRECT_URI = `${ISSUER}/deviceauth/callback`;
  POLL_MARGIN_MS = 3e3;
  USER_AGENT = "ObAiChat/chatgpt-oauth";
  ChatGPTOAuthError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ChatGPTOAuthError";
    }
  };
  sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  base64UrlDecode = (input) => {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - padded.length % 4);
    return atob(padded + padding);
  };
  parseJwtClaims = (token) => {
    const parts = token.split(".");
    if (parts.length !== 3) return void 0;
    try {
      return JSON.parse(base64UrlDecode(parts[1]));
    } catch {
      return void 0;
    }
  };
  extractAccountIdFromClaims = (claims) => {
    return claims.chatgpt_account_id || claims["https://api.openai.com/auth"]?.chatgpt_account_id || claims.organizations?.[0]?.id;
  };
  extractAccountId = (tokens) => {
    if (tokens.id_token) {
      const claims = parseJwtClaims(tokens.id_token);
      if (claims) {
        const accountId = extractAccountIdFromClaims(claims);
        if (accountId) return accountId;
      }
    }
    const accessClaims = parseJwtClaims(tokens.access_token);
    return accessClaims ? extractAccountIdFromClaims(accessClaims) : void 0;
  };
  describeError = (response) => {
    if (typeof response.text === "string" && response.text.trim()) {
      return ` — ${response.text.trim().slice(0, 300)}`;
    }
    if (response.json && typeof response.json === "object") {
      try {
        return ` — ${JSON.stringify(response.json)}`;
      } catch {
        return "";
      }
    }
    return "";
  };
  ChatGPTOAuthService = class {
    constructor(store) {
      this.store = store;
    }
    /** Synchronous read of the stored credential (whether or not it's expired). */
    getCredential() {
      return this.store.get();
    }
    /** Wipe the stored credential. */
    clearCredential() {
      this.store.clear();
    }
    /**
     * Start the device authorization flow.
     * Returns the user-facing code + verification URL the user must visit.
     */
    async beginDeviceAuthorization() {
      const response = await (0, obsidian.requestUrl)({
        url: `${ISSUER}/api/accounts/deviceauth/usercode`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT
        },
        body: JSON.stringify({ client_id: CLIENT_ID }),
        throw: false
      });
      if (response.status < 200 || response.status >= 300) {
        throw new ChatGPTOAuthError(
          `Failed to start ChatGPT device authorization: HTTP ${response.status}${describeError(response)}`
        );
      }
      const data = response.json;
      if (!data?.device_auth_id || !data?.user_code) {
        throw new ChatGPTOAuthError("Device authorization response was missing required fields.");
      }
      const intervalSec = Math.max(parseInt(String(data.interval ?? "5"), 10) || 5, 1);
      return {
        deviceAuthId: data.device_auth_id,
        userCode: data.user_code,
        verificationUri: DEVICE_VERIFICATION_URI,
        intervalMs: intervalSec * 1e3
      };
    }
    /**
     * Poll for completion of a device authorization. Resolves with the stored
     * credential when the user finishes authorizing, or rejects on cancel /
     * unrecoverable error. Use `cancel()` from the returned handle to stop.
     */
    pollDeviceAuthorization(authorization) {
      let cancelled = false;
      const cancel = () => {
        cancelled = true;
      };
      const promise = (async () => {
        while (true) {
          if (cancelled) {
            throw new ChatGPTOAuthError("ChatGPT login was cancelled.");
          }
          const response = await (0, obsidian.requestUrl)({
            url: `${ISSUER}/api/accounts/deviceauth/token`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": USER_AGENT
            },
            body: JSON.stringify({
              device_auth_id: authorization.deviceAuthId,
              user_code: authorization.userCode
            }),
            throw: false
          });
          if (response.status >= 200 && response.status < 300) {
            const data = response.json;
            if (typeof data.authorization_code !== "string" || typeof data.code_verifier !== "string") {
              throw new ChatGPTOAuthError("Device authorization returned an invalid token payload.");
            }
            const credential = await this.exchangeAuthorizationCode({
              code: data.authorization_code,
              codeVerifier: data.code_verifier,
              redirectUri: DEVICE_REDIRECT_URI
            });
            this.store.set(credential);
            return credential;
          }
          if (response.status !== 403 && response.status !== 404) {
            throw new ChatGPTOAuthError(
              `Device authorization polling failed: HTTP ${response.status}${describeError(response)}`
            );
          }
          await sleep(authorization.intervalMs + POLL_MARGIN_MS);
        }
      })();
      return { promise, cancel };
    }
    /**
     * Refresh an expiring credential. Stores the new credential on success.
     */
    async refreshCredential(credential) {
      const response = await (0, obsidian.requestUrl)({
        url: `${ISSUER}/oauth/token`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credential.refreshToken,
          client_id: CLIENT_ID
        }).toString(),
        throw: false
      });
      if (response.status < 200 || response.status >= 300) {
        throw new ChatGPTOAuthError(
          `ChatGPT token refresh failed: HTTP ${response.status}${describeError(response)}`
        );
      }
      const data = response.json;
      const next2 = this.toCredential(data, credential.accountId);
      this.store.set(next2);
      return next2;
    }
    /**
     * Return a credential that is guaranteed to be currently valid, refreshing
     * if necessary. Returns null if there's no stored credential at all.
     * Throws if a refresh is needed but fails.
     */
    async getUsableCredential() {
      const current = this.store.get();
      if (!current) return null;
      if (!this.store.isExpired(current)) return current;
      return this.refreshCredential(current);
    }
    /** Exchange an authorization code (from device flow) for tokens. */
    async exchangeAuthorizationCode(input) {
      const response = await (0, obsidian.requestUrl)({
        url: `${ISSUER}/oauth/token`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: input.code,
          redirect_uri: input.redirectUri,
          client_id: CLIENT_ID,
          code_verifier: input.codeVerifier
        }).toString(),
        throw: false
      });
      if (response.status < 200 || response.status >= 300) {
        throw new ChatGPTOAuthError(
          `ChatGPT token exchange failed: HTTP ${response.status}${describeError(response)}`
        );
      }
      return this.toCredential(response.json);
    }
    toCredential(tokens, fallbackAccountId) {
      const now = Date.now();
      const accountId = extractAccountId(tokens) ?? fallbackAccountId;
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: now + (tokens.expires_in ?? 3600) * 1e3,
        updatedAt: now,
        ...tokens.id_token ? { idToken: tokens.id_token } : {},
        ...accountId ? { accountId } : {}
      };
    }
  };
  declareExports({
    ChatGPTOAuthService,
    ChatGPTOAuthError
  });
}


