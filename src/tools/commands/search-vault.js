function countSubstringOccurrences(haystack, needle) {
  const source = String(haystack || "");
  const term = String(needle || "");
  if (!source || !term) return 0;
  let count = 0;
  let idx = 0;
  while (idx <= source.length - term.length) {
    const found = source.indexOf(term, idx);
    if (found === -1) break;
    count += 1;
    idx = found + term.length;
  }
  return count;
}

async function searchVault(app, input) {
  const query = ToolHelper.requiredString(input.query).toLowerCase();
  const searchContent = input.searchContent;
  const limit = Math.min(input.limit || 10, 50);
  const maxBytesRaw = typeof input.maxBytes === "number" ? input.maxBytes : 1e5;
  const maxBytes = Math.max(1, Math.min(maxBytesRaw, 5e6));
  const allTextFiles = input.allTextFiles !== false;

  const includeExts = new Set(ToolHelper.parseExtensionTokens(input.extensions));
  const excludeExts = new Set(ToolHelper.parseExtensionTokens(input.excludeExtensions));

  const files = app.vault.getFiles();
  const results = [];
  let totalMatches = 0;

  let skippedByExtension = 0;
  let skippedBySize = 0;
  let skippedUnreadable = 0;

  for (const file of files) {
    if (results.length >= limit) break;

    if (!ToolHelper.fileMatchesExtensionPolicy(file.path, includeExts, excludeExts, allTextFiles)) {
      skippedByExtension++;
      continue;
    }

    if (file.path.toLowerCase().includes(query)) {
      const pathMatches = countSubstringOccurrences(file.path.toLowerCase(), query);
      totalMatches += pathMatches > 0 ? pathMatches : 1;
      results.push(`- ${file.path}`);
      continue;
    }

    if (searchContent) {
      const fileSize = typeof file.stat?.size === "number" ? file.stat.size : 0;
      if (fileSize > maxBytes) {
        skippedBySize++;
        continue;
      }

      let content = "";
      try {
        content = await app.vault.cachedRead(file);
      } catch {
        skippedUnreadable++;
        continue;
      }

      const lowerContent = content.toLowerCase();
      const idx = lowerContent.indexOf(query);
      if (idx !== -1) {
        const matchCountInFile = countSubstringOccurrences(lowerContent, query);
        totalMatches += matchCountInFile;
        const start = Math.max(0, idx - 50);
        const end = Math.min(content.length, idx + query.length + 50);
        const snippet = content.substring(start, end).replace(/\n/g, " ");
        results.push(`- ${file.path}: ...${snippet}...`);
      }
    }
  }

  const policySummary = `Filters: includeExt=${includeExts.size > 0 ? Array.from(includeExts).join(",") : "(all text files)"}, excludeExt=${excludeExts.size > 0 ? Array.from(excludeExts).join(",") : "(none)"}, maxBytes=${maxBytes}. Skipped: extension=${skippedByExtension}, size=${skippedBySize}, unreadable=${skippedUnreadable}.`;

  if (results.length === 0) {
    return { result: `No results found for "${query}" (total matches: 0).\n${policySummary}`, isError: false };
  }
  return {
    result: `Found ${results.length} result(s) (total matches: ${totalMatches}):\n${results.join("\n")}\n\n${policySummary}`,
    isError: false
  };
}

const Command = declareNamespace("Command");
Command.export(searchVault);
