const ToolHelper = declareNamespace("ToolHelper");

const optionalString = ToolHelper.export(function optionalString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
});

const requiredString = ToolHelper.export(function requiredString(value) {
  return typeof value === "string" ? value : "";
});

const isRecord = ToolHelper.export(function isRecord(value) {
  return typeof value === "object" && value !== null;
});

const requiredRecord = ToolHelper.export(function requiredRecord(value) {
  return ToolHelper.isRecord(value) ? value : null;
});

const clampNumber = ToolHelper.export(function clampNumber(value, fallback, min, max) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
});
