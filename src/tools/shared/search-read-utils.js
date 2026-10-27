const ToolHelper = declareNamespace("ToolHelper");

const normalizeComparablePath = ToolHelper.export(function normalizeComparablePath(path) {
  return String(path || "").replace(/\\+/g, "/").replace(/^\/+/, "");
});

const basenameOfPath = ToolHelper.export(function basenameOfPath(path) {
  const normalized = ToolHelper.normalizeComparablePath(path);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.substring(slash + 1);
});

const toSearchReadExtract = ToolHelper.export(function toSearchReadExtract(value) {
  const raw = ToolHelper.requiredString(value).toLowerCase();
  if (raw === "snippet" || raw === "frontmatter") return raw;
  return "full";
});

const toSearchReadMatchMode = ToolHelper.export(function toSearchReadMatchMode(value) {
  const raw = ToolHelper.requiredString(value).toLowerCase();
  if (raw === "first" || raw === "best" || raw === "exact" || raw === "all") return raw;
  return "";
});

const truncateUtf8 = ToolHelper.export(function truncateUtf8(text, maxBytes) {
  const s = String(text || "");
  const bytes = new TextEncoder().encode(s);
  if (bytes.length <= maxBytes) {
    return { text: s, truncated: false, bytes: bytes.length };
  }
  const slice = bytes.slice(0, Math.max(0, maxBytes));
  let decoded = "";
  try {
    decoded = new TextDecoder().decode(slice);
  } catch {
    decoded = s.slice(0, Math.max(0, maxBytes));
  }
  return { text: decoded, truncated: true, bytes: bytes.length };
});

const buildSnippetExtract = ToolHelper.export(function buildSnippetExtract(content, queryLower, maxLen = 260) {
  const raw = String(content || "");
  if (!raw) return { text: "", lineStart: 1, lineEnd: 1 };
  const lower = raw.toLowerCase();
  const idx = queryLower ? lower.indexOf(queryLower) : -1;
  const center = idx >= 0 ? idx : 0;
  const start = Math.max(0, center - Math.floor(maxLen / 2));
  const end = Math.min(raw.length, start + maxLen);
  const text = raw.substring(start, end).replace(/\n/g, " ");
  const before = raw.substring(0, start);
  const within = raw.substring(start, end);
  const lineStart = before.split("\n").length;
  const lineEnd = lineStart + within.split("\n").length - 1;
  return { text, lineStart, lineEnd };
});

const buildSearchReadStatus = ToolHelper.export(function buildSearchReadStatus(code, message, extra) {
  const payload = {
    status: { code, message },
    ...extra
  };
  return { result: JSON.stringify(payload, null, 2), isError: false };
});

const computeBestScore = ToolHelper.export(function computeBestScore(matchMeta, queryLower, queryComparableLower) {
  const pathComparable = ToolHelper.normalizeComparablePath(matchMeta.path);
  const pathLower = pathComparable.toLowerCase();
  const baseLower = ToolHelper.basenameOfPath(pathComparable).toLowerCase();

  if (pathLower === queryComparableLower) return 0;
  if (baseLower === queryLower) return 1;
  if (baseLower.startsWith(queryLower)) return 2;

  if (matchMeta.pathHit) return 3;
  if (typeof matchMeta.contentIndex === "number" && matchMeta.contentIndex >= 0) return 4 + Math.min(matchMeta.contentIndex, 1e6) / 1e6;

  return 9;
});

const buildSearchReadError = ToolHelper.export(function buildSearchReadError(code, message, extra) {
  const payload = {
    error: { code, message },
    ...extra
  };
  return { result: JSON.stringify(payload, null, 2), isError: true };
});
