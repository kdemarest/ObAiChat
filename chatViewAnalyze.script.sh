const fs = require("fs");
const path = require("path");

function byteLen(text) {
  return Buffer.byteLength(text, "utf8");
}

function resolveTargetFile() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "ObAiChat/src/ui/chat-view.js"),
    path.join(cwd, "src/ui/chat-view.js"),
    path.join(__dirname, "src/ui/chat-view.js")
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    "Could not find chat-view.js. Tried: \n" + candidates.map((c) => `- ${c}`).join("\n")
  );
}

function countMatches(text, regex) {
  const m = text.match(regex);
  return m ? m.length : 0;
}

function findEvalUsage(text) {
  const evalCount = countMatches(text, /\beval\s*\(/g);
  const newFunctionCount = countMatches(text, /\bnew\s+Function\s*\(/g);
  return { evalCount, newFunctionCount };
}

function collectDeclaredFunctions(text) {
  const out = new Set();

  const patterns = [
    /function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/g,
    /\bclass\s+([A-Za-z_$][\w$]*)\b/g
  ];

  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      if (m[1]) out.add(m[1]);
    }
  }

  return Array.from(out);
}

function referenceCount(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "g");
  return countMatches(text, re);
}

function analyzeUsage(text) {
  const declared = collectDeclaredFunctions(text);
  const usage = declared.map((name) => ({ name, refs: referenceCount(text, name) }));

  // refs===1 means only declaration token appears once in whole file (rough candidate)
  const maybeUnused = usage.filter((u) => u.refs <= 1).sort((a, b) => a.refs - b.refs || a.name.localeCompare(b.name));

  // low-reference can still be valid, but helps eyeballing
  const lowRefs = usage.filter((u) => u.refs <= 3).sort((a, b) => a.refs - b.refs || a.name.localeCompare(b.name));

  return { declaredCount: declared.length, usage, maybeUnused, lowRefs };
}

function topLargestLines(text, count = 12) {
  const lines = text.split("\n");
  const withSizes = lines.map((line, idx) => ({
    line: idx + 1,
    bytes: byteLen(line),
    preview: line.slice(0, 140)
  }));

  return withSizes.sort((a, b) => b.bytes - a.bytes).slice(0, count);
}

function printReport(filePath, text) {
  const size = byteLen(text);
  const kb = (size / 1024).toFixed(1);
  const { evalCount, newFunctionCount } = findEvalUsage(text);
  const usage = analyzeUsage(text);
  const biggest = topLargestLines(text, 10);

  console.log("=== chatView analysis ===");
  console.log(`File: ${filePath}`);
  console.log(`Size: ${size} bytes (${kb} KB)`);
  console.log("");

  console.log("[1] Dynamic code checks");
  console.log(`- eval(...): ${evalCount}`);
  console.log(`- new Function(...): ${newFunctionCount}`);
  console.log("");

  console.log("[2] Symbol usage (rough static scan)");
  console.log(`- Declared symbols found: ${usage.declaredCount}`);
  console.log(`- Maybe unused (refs <= 1): ${usage.maybeUnused.length}`);
  if (usage.maybeUnused.length > 0) {
    console.log("  Candidates:");
    for (const item of usage.maybeUnused.slice(0, 80)) {
      console.log(`  - ${item.name} (refs=${item.refs})`);
    }
    if (usage.maybeUnused.length > 80) {
      console.log(`  ... and ${usage.maybeUnused.length - 80} more`);
    }
  }
  console.log("");

  console.log("- Low-reference symbols (refs <= 3):");
  for (const item of usage.lowRefs.slice(0, 80)) {
    console.log(`  - ${item.name} (refs=${item.refs})`);
  }
  if (usage.lowRefs.length > 80) {
    console.log(`  ... and ${usage.lowRefs.length - 80} more`);
  }
  console.log("");

  console.log("[3] Longest lines (helpful for chunking)");
  for (const row of biggest) {
    console.log(`- line ${row.line}: ${row.bytes} bytes | ${row.preview}`);
  }

  console.log("");
  console.log("Note: this is a rough scan. Generated Svelte runtime often has many low-ref helpers that are still required.");
}

function main() {
  try {
    const filePath = resolveTargetFile();
    const text = fs.readFileSync(filePath, "utf8");
    printReport(filePath, text);
  } catch (err) {
    console.error("Analysis failed:");
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}

main();
