// gptchat/util.ts
function clampSafeNumber(value, fallback, min, max) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}

declareExports({
  clampSafeNumber
});
