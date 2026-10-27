const ToolHelper = declareNamespace("ToolHelper");

const parseExtensionTokens = ToolHelper.export(function parseExtensionTokens(value) {
  const tokens = [];
  if (typeof value === "string") {
    for (const raw of value.split(/[;,\s]+/)) {
      const t = raw.trim();
      if (t) tokens.push(t);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "string") continue;
      const t = item.trim();
      if (t) tokens.push(t);
    }
  }

  const normalized = [];
  for (const token of tokens) {
    let t = token.toLowerCase();
    if (t.startsWith("*")) t = t.slice(1);
    if (!t.startsWith(".")) t = `.${t}`;
    if (t === ".") continue;
    normalized.push(t);
  }
  return Array.from(new Set(normalized));
});

const getPathExtension = ToolHelper.export(function getPathExtension(path) {
  const idx = path.lastIndexOf(".");
  if (idx === -1) return "";
  const slashIdx = path.lastIndexOf("/");
  if (slashIdx > idx) return "";
  return path.substring(idx).toLowerCase();
});

const BINARY_EXTENSION_BLACKLIST = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".tiff", ".heic", ".avif",
  ".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg",
  ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v",
  ".zip", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar", ".tar",
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
  ".sqlite", ".db", ".dylib", ".so", ".dll", ".exe", ".bin", ".wasm",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".psd", ".ai", ".sketch", ".fig",
  ".class", ".jar", ".pyc", ".pyo", ".o", ".a"
]);

const DEFAULT_BINARY_EXTENSION_BLACKLIST = ToolHelper.export(function DEFAULT_BINARY_EXTENSION_BLACKLIST() {
  return BINARY_EXTENSION_BLACKLIST;
});

const fileMatchesExtensionPolicy = ToolHelper.export(function fileMatchesExtensionPolicy(path, includeExts, excludeExts, allTextFiles) {
  const ext = ToolHelper.getPathExtension(path);

  if (excludeExts.has(ext)) return false;

  if (includeExts.size > 0) {
    return includeExts.has(ext);
  }

  if (!allTextFiles) {
    return ext === "";
  }

  return !ToolHelper.DEFAULT_BINARY_EXTENSION_BLACKLIST().has(ext);
});
