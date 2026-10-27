function previewMatchText(value, max = 140) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildForgivingWhitespaceRegex(candidate) {
  const text = String(candidate || "");
  const whitespacePattern = /(?:\s|&nbsp;)+/ig;
  let pattern = "";
  let lastIndex = 0;
  let match = whitespacePattern.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      pattern += escapeRegex(text.slice(lastIndex, match.index));
    }
    pattern += "(?:\\s|&nbsp;)+";
    lastIndex = whitespacePattern.lastIndex;
    match = whitespacePattern.exec(text);
  }
  if (lastIndex < text.length) {
    pattern += escapeRegex(text.slice(lastIndex));
  }
  return new RegExp(pattern, "i");
}

function pickAnchorToken(candidate) {
  const words = String(candidate || "").toLowerCase().split(/[^a-z0-9_./-]+/).filter((w) => w.length >= 4);
  if (words.length === 0) return "";
  words.sort((a, b) => b.length - a.length);
  return words[0];
}

function nearestSnippetHints(data, candidates, maxHints = 3) {
  const out = [];
  const lower = data.toLowerCase();
  for (const candidate of candidates) {
    if (out.length >= maxHints) break;
    const token = pickAnchorToken(candidate);
    if (!token) continue;
    const idx = lower.indexOf(token);
    if (idx === -1) continue;
    const start = Math.max(0, idx - 50);
    const end = Math.min(data.length, idx + token.length + 50);
    const snippet = data.substring(start, end).replace(/\n/g, " ");
    out.push(`- token "${token}": ...${previewMatchText(snippet, 120)}...`);
  }
  return out;
}

function normalizeFindCandidates(findInput) {
  if (Array.isArray(findInput)) {
    return findInput.filter((v) => typeof v === "string" && v.length > 0);
  }
  if (typeof findInput === "string" && findInput.length > 0) return [findInput];
  return [];
}

async function editDocument(app, input) {
  const operation = ToolHelper.requiredString(input.operation);
  const content = ToolHelper.requiredString(input.content);
  const findCandidates = normalizeFindCandidates(input.find);
  const forgiveWhitespace = input.forgiveWhitespace !== false;
  const includeNearMatches = input.includeNearMatches === true;
  const path = ToolHelper.optionalString(input.path);
  if (!path) {
    return { result: "'path' parameter is required.", isError: true };
  }
  const file = ToolHelper.resolveFile(app, path);
  if (!file) {
    return { result: `File not found: ${path}`, isError: true };
  }
  const cfcPreconditionError = await ToolHelper.validateCfcEditPrecondition(app, file, input);
  if (cfcPreconditionError) {
    return cfcPreconditionError;
  }
  switch (operation) {
    case "find_replace": {
      if (findCandidates.length === 0) {
        return { result: "'find' parameter is required for find_replace (string or string[]).", isError: true };
      }

      const beforeContent = await app.vault.cachedRead(file);
      let resultMsg = "";
      let found = false;
      let matchText = "";
      let matchMode = "exact";
      let matchedCandidateIndex = -1;

      await app.vault.process(file, (data) => {
        let idx = -1;

        for (let i = 0; i < findCandidates.length; i++) {
          const candidate = findCandidates[i];
          const exactIdx = data.indexOf(candidate);
          if (exactIdx !== -1) {
            idx = exactIdx;
            matchText = candidate;
            matchMode = "exact";
            matchedCandidateIndex = i;
            break;
          }
        }

        if (idx === -1 && forgiveWhitespace) {
          for (let i = 0; i < findCandidates.length; i++) {
            const candidate = findCandidates[i];
            const regex = buildForgivingWhitespaceRegex(candidate);
            const match = data.match(regex);
            if (match && match.index !== void 0) {
              idx = match.index;
              matchText = match[0];
              matchMode = "normalized";
              matchedCandidateIndex = i;
              break;
            }
          }
        }

        if (idx === -1) {
          found = false;
          return data;
        }

        found = true;

        if (matchMode === "exact") {
          const secondIdx = data.indexOf(matchText, idx + matchText.length);
          if (secondIdx !== -1) {
            resultMsg = "[Note: Multiple matches found, replacing first occurrence.]\n";
          }
        } else {
          const regex = buildForgivingWhitespaceRegex(findCandidates[matchedCandidateIndex]);
          const all = data.match(new RegExp(regex.source, "ig")) || [];
          if (all.length > 1) {
            resultMsg = "[Note: Multiple whitespace-forgiving matches found, replacing first occurrence.]\n";
          }
          resultMsg += "[Note: Used whitespace-forgiving fallback match (\\s and &nbsp; are treated as whitespace).]\n";
        }

        return data.substring(0, idx) + content + data.substring(idx + matchText.length);
      });

      if (!found) {
        const previews = findCandidates.slice(0, 6).map((c, i) => `  ${i + 1}. (${c.length} chars) \"${previewMatchText(c)}\"`);
        const hints = includeNearMatches ? nearestSnippetHints(await app.vault.cachedRead(file), findCandidates) : [];
        const hintBlock = hints.length > 0 ? `\nNearby hints:\n${hints.join("\n")}` : "";
        return {
          result: `Could not find the specified text in ${file.path}. Attempted ${findCandidates.length} candidate(s):\n${previews.join("\n")}\nMatching is exact, with optional whitespace-forgiving fallback (all whitespace and &nbsp; treated equivalently).${hintBlock}`,
          isError: true
        };
      }

      const afterContent = await app.vault.cachedRead(file);
      await ToolHelper.recordEditJournal(app, {
        filePath: file.path,
        operation: "find_replace",
        beforeContent,
        afterContent
      });
      const matchInfo = `(match: candidate ${matchedCandidateIndex + 1}, mode: ${matchMode})`;
      return { result: `${resultMsg}Successfully replaced text in ${file.path} ${matchInfo}.`, isError: false };
    }
    default:
      return { result: `Unknown operation: ${operation}`, isError: true };
  }
}

const Command = declareNamespace("Command");
Command.export(normalizeFindCandidates);
Command.export(editDocument);
