class ChatPayload {
  constructor(bodyObj, provider = "", model = "") {
    this.bodyObj = bodyObj;
    this.bodyJson = JSON.stringify(bodyObj ?? {});
    this.provider = String(provider || "");
    this.model = String(model || "");
  }

  get charCount() {
    return this.bodyJson.length;
  }

  get byteCount() {
    try {
      return new TextEncoder().encode(this.bodyJson).length;
    } catch {
      return 0;
    }
  }
}

declareExports({
  ChatPayload
});
