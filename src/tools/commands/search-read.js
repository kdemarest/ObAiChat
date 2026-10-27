async function searchRead(app, input, extractMode = "full") {
  const queryRaw = ToolHelper.requiredString(input.query);
  const query = queryRaw.toLowerCase();
  if (!query) {
    return { result: "'query' parameter is required.", isError: true };
  }

  const searchContent = input.searchContent === true;
  const maxBytesRaw = typeof input.maxBytes === "number" ? input.maxBytes : 1e5;
  const maxBytes = Math.max(1, Math.min(maxBytesRaw, 5e6));
  const allTextFiles = input.allTextFiles !== false;
  const pathContains = requiredString(input.pathContains).toLowerCase();
  const maxMatchesScanned = ToolHelper.clampNumber(input.maxMatchesScanned, 500, 1, 5e3);

  const explicitMatchMode = ToolHelper.toSearchReadMatchMode(input.match);
  if (input.match !== void 0 && !explicitMatchMode) {
    return ToolHelper.buildSearchReadError("invalid_args", "Unknown match mode. Use first|best|exact|all.", { query: queryRaw });
  }
  const mode = explicitMatchMode || "first";

  const requireUnique = input.requireUnique === true;
  const extract = ToolHelper.toSearchReadExtract(extractMode);
  const maxMatchesDefault = mode === "all" ? 20 : 1;
  const maxMatches = ToolHelper.clampNumber(input.maxMatches, maxMatchesDefault, 1, 200);
  const maxBytesPerFileRaw = typeof input.maxBytesPerFile === "number" ? input.maxBytesPerFile : 1e6;
  const maxBytesPerFile = Math.max(64, Math.min(maxBytesPerFileRaw, 5e6));

  const includeExts = new Set(ToolHelper.parseExtensionTokens(input.extensions));
  const excludeExts = new Set(ToolHelper.parseExtensionTokens(input.excludeExtensions));

  const files = app.vault.getFiles().slice().sort((a, b) => a.path.localeCompare(b.path));
  const matches = [];
  let matchCount = 0;
  let exceededMatchCap = false;

  let skippedByExtension = 0;
  let skippedBySize = 0;
  let skippedUnreadable = 0;

  const queryComparableLower = ToolHelper.normalizeComparablePath(queryRaw).toLowerCase();

  for (const file of files) {
    if (!ToolHelper.fileMatchesExtensionPolicy(file.path, includeExts, excludeExts, allTextFiles)) {
      skippedByExtension++;
      continue;
    }

    const pathComparable = ToolHelper.normalizeComparablePath(file.path);
    const pathLower = pathComparable.toLowerCase();

    let matched = false;
    let pathHit = false;
    let contentIndex = -1;

    if (explicitMatchMode === "exact") {
      const exactCaseSensitive = pathComparable === ToolHelper.normalizeComparablePath(queryRaw);
      const exactCaseInsensitive = pathLower === queryComparableLower;
      matched = exactCaseSensitive || exactCaseInsensitive;
      pathHit = matched;
    } else {
      if (pathLower.includes(query)) {
        matched = true;
        pathHit = true;
      } else if (searchContent) {
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
        const idx = content.toLowerCase().indexOf(query);
        if (idx !== -1) {
          matched = true;
          contentIndex = idx;
        }
      }
    }

    if (!matched) continue;
    if (pathContains && !file.path.toLowerCase().includes(pathContains)) continue;

    matchCount += 1;
    if (matches.length < maxMatchesScanned) {
      matches.push({ path: file.path, pathHit, contentIndex });
    } else {
      exceededMatchCap = true;
    }
  }

  if (matchCount === 0) {
    return ToolHelper.buildSearchReadStatus("no_match", `No matches found for query '${queryRaw}'.`, {
      query: queryRaw,
      match: mode,
      extract,
      requireUnique,
      totalMatches: 0,
      limits: { maxMatches, maxBytesPerFile }
    });
  }

  if (exceededMatchCap) {
    return ToolHelper.buildSearchReadStatus("too_many_matches_scanned", `search_read matched ${matchCount} files, exceeding maxMatchesScanned=${maxMatchesScanned}. Refine query/pathContains or increase maxMatchesScanned.`, {
      query: queryRaw,
      totalMatches: matchCount,
      maxMatchesScanned
    });
  }

  if (requireUnique && matchCount !== 1) {
    return ToolHelper.buildSearchReadStatus("not_unique", `requireUnique=true requires exactly 1 match, found ${matchCount}.`, {
      query: queryRaw,
      totalMatches: matchCount,
      candidates: matches.slice(0, 20).map((m) => m.path)
    });
  }

  let selectedMetas = [];
  if (mode === "all") {
    selectedMetas = matches.slice(0, maxMatches);
  } else if (mode === "first") {
    selectedMetas = matches.length > 0 ? [matches[0]] : [];
  } else if (mode === "exact") {
    selectedMetas = matches.slice(0, maxMatches);
  } else if (mode === "best") {
    const sorted = matches.slice().sort((a, b) => {
      const sa = ToolHelper.computeBestScore(a, query, queryComparableLower);
      const sb = ToolHelper.computeBestScore(b, query, queryComparableLower);
      if (sa !== sb) return sa - sb;
      return a.path.localeCompare(b.path);
    });
    selectedMetas = sorted.slice(0, maxMatches);
  } else {
    return ToolHelper.buildSearchReadError("invalid_args", `Unknown match mode: ${mode}. Use first|best|exact|all.`, { query: queryRaw });
  }

  const selectedEntries = [];
  const candidates = [];
  let anyTruncated = false;

  for (const meta of selectedMetas) {
    if (!meta || typeof meta.path !== "string") continue;
    const selectedPath = meta.path;
    candidates.push(selectedPath);
    const file = app.vault.getFileByPath(obsidian.normalizePath(selectedPath));
    if (!file) {
      selectedEntries.push({
        path: selectedPath,
        error: { code: "read_failed", message: "matched file no longer exists" }
      });
      continue;
    }

    let content = "";
    try {
      content = await app.vault.cachedRead(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      selectedEntries.push({
        path: selectedPath,
        error: { code: "read_failed", message: msg }
      });
      continue;
    }

    if (extract === "frontmatter") {
      const cache = app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter ? { ...cache.frontmatter } : null;
      if (frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, "position")) {
        delete frontmatter.position;
      }
      const text = JSON.stringify(frontmatter, null, 2);
      const trimmed = ToolHelper.truncateUtf8(text, maxBytesPerFile);
      selectedEntries.push({
        path: selectedPath,
        bytes: trimmed.bytes,
        sha256: await ToolHelper.sha256Hex(trimmed.text),
        truncated: trimmed.truncated,
        content: {
          frontmatter,
          raw: trimmed.text
        }
      });
      if (trimmed.truncated) anyTruncated = true;
      continue;
    }

    if (extract === "snippet") {
      const snippet = ToolHelper.buildSnippetExtract(content, query);
      const trimmed = ToolHelper.truncateUtf8(snippet.text, maxBytesPerFile);
      selectedEntries.push({
        path: selectedPath,
        bytes: trimmed.bytes,
        sha256: await ToolHelper.sha256Hex(trimmed.text),
        truncated: trimmed.truncated,
        content: {
          snippet: trimmed.text,
          lineStart: snippet.lineStart,
          lineEnd: snippet.lineEnd
        }
      });
      if (trimmed.truncated) anyTruncated = true;
      continue;
    }

    const trimmed = ToolHelper.truncateUtf8(content, maxBytesPerFile);
    selectedEntries.push({
      path: selectedPath,
      bytes: trimmed.bytes,
      sha256: await ToolHelper.sha256Hex(trimmed.text),
      truncated: trimmed.truncated,
      content: trimmed.text
    });
    if (trimmed.truncated) anyTruncated = true;
  }

  const payload = {
    query: queryRaw,
    match: explicitMatchMode || "first",
    extract,
    requireUnique,
    totalMatches: matchCount,
    selectedCount: selectedEntries.length,
    truncated: anyTruncated,
    limits: {
      maxMatches,
      maxBytesPerFile
    },
    entries: selectedEntries,
    candidates: candidates.slice(0, 20),
    filters: {
      includeExt: includeExts.size > 0 ? Array.from(includeExts) : "all_text_files",
      excludeExt: excludeExts.size > 0 ? Array.from(excludeExts) : [],
      maxBytes,
      pathContains,
      skippedByExtension,
      skippedBySize,
      skippedUnreadable
    }
  };

  return { result: JSON.stringify(payload, null, 2), isError: false, path: selectedEntries.length === 1 ? selectedEntries[0].path : "" };
}

const Command = declareNamespace("Command");
Command.export(searchRead);
