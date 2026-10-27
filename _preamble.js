

"use strict";
const obsidian = require("obsidian");

let __registeredInitCalls = [];
let __initRuntimeLog = [];
let __pendingInitEntries = [];
let __registeredInitsFlushed = false;
let __seenInitFns = /* @__PURE__ */ new Set();
let __ranInitFns = /* @__PURE__ */ new Set();
let __initEntryByName = /* @__PURE__ */ new Map();
let __aichatStartupComplete = false;
let AICHAT_STARTUP_LOG_PATH = "ObAiChat/start.log";
let AICHAT_RUNTIME_ERROR_LOG_PATH = "ObAiChat/lastErr.log";
let AICHAT_SCROLL_DEBUG_LOG_PATH = "ObAiChat/scrollDebug.log";
let __vsCodeBottomMarginSmokeTargetStyles = /* @__PURE__ */ new WeakMap();
let __vsCodeBottomMarginSmokeHostStyles = /* @__PURE__ */ new WeakMap();
let __vsCodeBottomMarginSmokeChildStyles = /* @__PURE__ */ new WeakMap();
let __lastVsCodeScrollDebugSignature = "";
let __monacoDirectChildrenLogScheduled = false;
let __monacoDirectChildrenLogged = false;


async function appendStartupLogLine(line) {
  try {
    const app = typeof window !== "undefined" ? window.app : null;
    const adapter = app?.vault?.adapter;
    if (!adapter) return;
    if (typeof adapter.append === "function") {
      await adapter.append(AICHAT_STARTUP_LOG_PATH, `${line}\n`);
      return;
    }
    const exists = typeof adapter.exists === "function" ? await adapter.exists(AICHAT_STARTUP_LOG_PATH) : false;
    const prior = exists && typeof adapter.read === "function" ? await adapter.read(AICHAT_STARTUP_LOG_PATH) : "";
    await adapter.write(AICHAT_STARTUP_LOG_PATH, `${prior}${line}\n`);
  } catch {
  }
}

async function appendScrollDebugLogLine(line) {
  try {
    const app = typeof window !== "undefined" ? window.app : null;
    const adapter = app?.vault?.adapter;
    if (!adapter) return;
    if (typeof adapter.append === "function") {
      await adapter.append(AICHAT_SCROLL_DEBUG_LOG_PATH, `${line}\n`);
      return;
    }
    const exists = typeof adapter.exists === "function" ? await adapter.exists(AICHAT_SCROLL_DEBUG_LOG_PATH) : false;
    const prior = exists && typeof adapter.read === "function" ? await adapter.read(AICHAT_SCROLL_DEBUG_LOG_PATH) : "";
    await adapter.write(AICHAT_SCROLL_DEBUG_LOG_PATH, `${prior}${line}\n`);
  } catch {
  }
}

async function resetScrollDebugLog() {
  try {
    const app = typeof window !== "undefined" ? window.app : null;
    const adapter = app?.vault?.adapter;
    if (!adapter || typeof adapter.write !== "function") return;
    await adapter.write(AICHAT_SCROLL_DEBUG_LOG_PATH, `[${(/* @__PURE__ */ new Date()).toISOString()}] scroll debug reset\n`);
  } catch {
  }
}

function setAichatStartupComplete(value = true) {
  __aichatStartupComplete = value === true;
}

async function writeLatestRuntimeError(line) {
  try {
    const app = typeof window !== "undefined" ? window.app : null;
    const adapter = app?.vault?.adapter;
    if (!adapter) return;
    await adapter.write(AICHAT_RUNTIME_ERROR_LOG_PATH, `${line}\n`);
  } catch {
  }
}

function formatRuntimeErrorLine(message, context = "runtime") {
  const text = typeof message === "string" ? message : String(message || "unknown error");
  return `[${(/* @__PURE__ */ new Date()).toISOString()}] ${context} | ${text}`;
}

function routeAichatRuntimeError(message, context = "runtime") {
  const line = formatRuntimeErrorLine(message, context);
  if (__aichatStartupComplete) {
    void writeLatestRuntimeError(line);
  } else {
    void appendStartupLogLine(line);
  }
}

function __logInit(message) {
  const line = `[init] ${message}`;
  __initRuntimeLog.push(line);
  void appendStartupLogLine(line);
  try {
    console.log(line);
  } catch {
  }
}

function __normalizeInitName(rawName, initFn) {
  const explicit = typeof rawName === "string" ? rawName.trim() : "";
  if (explicit) return explicit;
  const inferred = typeof initFn?.name === "string" ? initFn.name.trim() : "";
  return inferred || "(anonymous init)";
}

function __normalizeInitDeps(rawDeps, selfName) {
  if (!Array.isArray(rawDeps)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const dep of rawDeps) {
    if (typeof dep !== "string") continue;
    const name = dep.trim();
    if (!name || name === selfName || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function __normalizeInitRegistration(a, b, c) {
  let initFn = null;
  let name = "";
  let deps = [];

  if (typeof a === "function") {
    initFn = a;
  } else if (typeof a === "string" && typeof b === "function") {
    initFn = b;
    name = a;
    deps = c;
  }

  if (typeof initFn !== "function") return null;
  const normalizedName = __normalizeInitName(name, initFn);
  return {
    initFn,
    name: normalizedName,
    deps: __normalizeInitDeps(deps, normalizedName)
  };
}

function __indexInitEntry(entry) {
  if (!entry?.name || entry.name === "(anonymous init)") return;
  const existing = __initEntryByName.get(entry.name);
  if (!existing) {
    __initEntryByName.set(entry.name, entry);
    return;
  }
  if (existing.initFn !== entry.initFn) {
    throw new Error(`registerInit duplicate name "${entry.name}" for different init functions.`);
  }
}

function __runInitEntry(entry, stack) {
  if (!entry || typeof entry.initFn !== "function") return;
  if (__ranInitFns.has(entry.initFn)) return;

  const name = entry.name || __normalizeInitName("", entry.initFn);
  if (stack.includes(name)) {
    const cycle = [...stack, name].join(" -> ");
    throw new Error(`registerInit dependency cycle detected: ${cycle}`);
  }

  const nextStack = [...stack, name];
  for (const depName of entry.deps) {
    const depEntry = __initEntryByName.get(depName);
    if (!depEntry) {
      throw new Error(`registerInit dependency "${depName}" for "${name}" was not registered.`);
    }
    __runInitEntry(depEntry, nextStack);
  }

  const depSuffix = entry.deps.length > 0 ? ` deps=[${entry.deps.join(", ")}]` : "";
  __logInit(`before unit \"${name}\"${depSuffix}`);
  __ranInitFns.add(entry.initFn);
  try {
    __logInit(`during unit \"${name}\" (invoking)`);
    entry.initFn();
    __logInit(`after unit \"${name}\" (ok)`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    __logInit(`after unit \"${name}\" (error: ${msg})`);
    throw error;
  }
}

function __orderInitEntries(entries) {
  const ordered = [];
  const temp = /* @__PURE__ */ new Set();
  const done = /* @__PURE__ */ new Set();

  function visit(entry, stack) {
    if (!entry || typeof entry.initFn !== "function") return;
    const fn = entry.initFn;
    if (done.has(fn)) return;
    if (temp.has(fn)) {
      const name = entry.name || __normalizeInitName("", fn);
      const cycle = [...stack, name].join(" -> ");
      throw new Error(`registerInit dependency cycle detected: ${cycle}`);
    }

    const name = entry.name || __normalizeInitName("", fn);
    temp.add(fn);
    const nextStack = [...stack, name];
    for (const depName of entry.deps) {
      const depEntry = __initEntryByName.get(depName);
      if (!depEntry) {
        throw new Error(`registerInit dependency "${depName}" for "${name}" was not registered.`);
      }
      visit(depEntry, nextStack);
    }
    temp.delete(fn);
    done.add(fn);
    ordered.push(entry);
  }

  for (const entry of entries) {
    visit(entry, []);
  }

  return ordered;
}

function registerInit(a, b, c) {
  const entry = __normalizeInitRegistration(a, b, c);
  if (!entry) return;
  if (__seenInitFns.has(entry.initFn)) return;

  __seenInitFns.add(entry.initFn);
  __indexInitEntry(entry);

  const depSuffix = entry.deps.length > 0 ? ` deps=[${entry.deps.join(", ")}]` : "";
  const callLabel = `${entry.name}${depSuffix}`;
  __registeredInitCalls.push(callLabel);
  __logInit(`registered ${callLabel}`);

  if (__registeredInitsFlushed) {
    __logInit(`flush already complete; running immediately ${entry.name}`);
    return __runInitEntry(entry, []);
  }
  __pendingInitEntries.push(entry);
}

function runRegisteredInits() {
  if (__registeredInitsFlushed) return;
  __registeredInitsFlushed = true;
  const entries = __pendingInitEntries.slice();
  __pendingInitEntries.length = 0;
  __logInit(`runRegisteredInits start pending=${entries.length}`);
  const ordered = __orderInitEntries(entries);
  __logInit(`runRegisteredInits ordered=${ordered.map((e) => e.name).join(", ")}`);
  for (const entry of ordered) {
    __runInitEntry(entry, []);
  }
  __logInit("runRegisteredInits done");
}

function __findVsCodeEditorPaneTarget() {
  if (typeof document === "undefined") return null;
  const selectors = [
    ".monaco-editor .overflow-guard"
  ];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return { element, selector };
    }
  }
  return null;
}

function __findVsCodeScrollHost(element) {
  let node = element?.parentElement || null;
  while (node) {
    if (node.classList?.contains("view-content")) return node;
    node = node.parentElement;
  }
  return null;
}

function __describeElementForScrollDebug(element) {
  if (!element) return "(null)";
  const tag = String(element.tagName || "?").toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.isArray(element.className?.split?.(" "))
    ? element.className.split(" ").map((x) => x.trim()).filter(Boolean).slice(0, 3).join(".")
    : "";
  const classPart = classes ? `.${classes}` : "";
  return `${tag}${id}${classPart}`;
}

function __logMonacoDirectDivChildren(target) {
  // logging disabled temporarily
}

function __collectVsCodeScrollAncestors(element) {
  if (!element || typeof window === "undefined" || typeof window.getComputedStyle !== "function") return [];
  const rows = [];
  let node = element;
  let depth = 0;

  while (node && depth < 14) {
    const style = window.getComputedStyle(node);
    const overflowY = style?.overflowY || "";
    const overflow = style?.overflow || "";
    const scrollHeight = Number(node.scrollHeight || 0);
    const clientHeight = Number(node.clientHeight || 0);
    const delta = scrollHeight - clientHeight;
    const allowsScroll = /auto|scroll|overlay/.test(`${overflowY} ${overflow}`);
    const hasVerticalOverflow = delta > 1;

    rows.push({
      depth,
      element: node,
      label: __describeElementForScrollDebug(node),
      overflowY,
      overflow,
      scrollHeight,
      clientHeight,
      delta,
      allowsScroll,
      hasVerticalOverflow
    });

    node = node.parentElement;
    depth += 1;
  }

  const scrolling = document.scrollingElement;
  if (scrolling && rows.every((x) => x.element !== scrolling)) {
    const style = window.getComputedStyle(scrolling);
    const overflowY = style?.overflowY || "";
    const overflow = style?.overflow || "";
    const scrollHeight = Number(scrolling.scrollHeight || 0);
    const clientHeight = Number(scrolling.clientHeight || 0);
    const delta = scrollHeight - clientHeight;
    const allowsScroll = /auto|scroll|overlay/.test(`${overflowY} ${overflow}`);
    const hasVerticalOverflow = delta > 1;
    rows.push({
      depth: rows.length,
      element: scrolling,
      label: __describeElementForScrollDebug(scrolling),
      overflowY,
      overflow,
      scrollHeight,
      clientHeight,
      delta,
      allowsScroll,
      hasVerticalOverflow
    });
  }

  return rows;
}

function __logVsCodeScrollDebug(target, phaseLabel) {
  // logging disabled temporarily
}

function __rememberVsCodeSmokeTargetStyles(element) {
  if (!element || __vsCodeBottomMarginSmokeTargetStyles.has(element)) return;
  __vsCodeBottomMarginSmokeTargetStyles.set(element, {
    marginBottom: element.style.marginBottom,
    overflowY: element.style.getPropertyValue("overflow-y"),
    overflowYPriority: element.style.getPropertyPriority("overflow-y")
  });
}

function __restoreVsCodeSmokeTargetStyles(element) {
  if (!element) return;
  const prior = __vsCodeBottomMarginSmokeTargetStyles.get(element);
  if (prior) {
    element.style.marginBottom = prior.marginBottom || "";
    element.style.setProperty("overflow-y", prior.overflowY || "", prior.overflowYPriority || "");
    __vsCodeBottomMarginSmokeTargetStyles.delete(element);
    return;
  }
  element.style.marginBottom = "";
  element.style.removeProperty("overflow-y");
}

function __rememberVsCodeSmokeHostStyles(element) {
  if (!element || __vsCodeBottomMarginSmokeHostStyles.has(element)) return;
  __vsCodeBottomMarginSmokeHostStyles.set(element, {
    overflowY: element.style.getPropertyValue("overflow-y"),
    overflowYPriority: element.style.getPropertyPriority("overflow-y")
  });
}

function __restoreVsCodeSmokeHostStyles(element) {
  if (!element) return;
  const prior = __vsCodeBottomMarginSmokeHostStyles.get(element);
  if (prior) {
    element.style.setProperty("overflow-y", prior.overflowY || "", prior.overflowYPriority || "");
    __vsCodeBottomMarginSmokeHostStyles.delete(element);
    return;
  }
  element.style.removeProperty("overflow-y");
}

function __rememberVsCodeSmokeChildStyles(children) {
  for (const child of children || []) {
    if (!child || __vsCodeBottomMarginSmokeChildStyles.has(child)) continue;
    __vsCodeBottomMarginSmokeChildStyles.set(child, {
      marginBottom: child.style.marginBottom
    });
  }
}

function __restoreVsCodeSmokeChildStyles(children) {
  for (const child of children || []) {
    if (!child) continue;
    const prior = __vsCodeBottomMarginSmokeChildStyles.get(child);
    if (prior) {
      child.style.marginBottom = prior.marginBottom || "";
      __vsCodeBottomMarginSmokeChildStyles.delete(child);
      continue;
    }
    child.style.marginBottom = "";
  }
}

function stopVsCodeBottomMarginSmokeTest() {
  const handle = globalThis.__vsCodeBottomMarginSmokeTestHandle;
  if (handle) {
    clearInterval(handle);
    globalThis.__vsCodeBottomMarginSmokeTestHandle = null;
  }

  const childLogTimeout = globalThis.__vsCodeMonacoChildLogTimeoutHandle;
  if (childLogTimeout) {
    clearTimeout(childLogTimeout);
    globalThis.__vsCodeMonacoChildLogTimeoutHandle = null;
  }
  __monacoDirectChildrenLogScheduled = false;

  const target = __findVsCodeEditorPaneTarget();
  if (target?.element) {
    const children = Array.from(target.element.children || []);
    __restoreVsCodeSmokeChildStyles(children);
    __restoreVsCodeSmokeTargetStyles(target.element);
    const host = __findVsCodeScrollHost(target.element);
    if (host) __restoreVsCodeSmokeHostStyles(host);
  }

  // console logging disabled temporarily
}

function startVsCodeBottomMarginSmokeTest() {
  stopVsCodeBottomMarginSmokeTest();
  __lastVsCodeScrollDebugSignature = "";
  __monacoDirectChildrenLogged = false;
  __monacoDirectChildrenLogScheduled = false;
  void resetScrollDebugLog();
  let on = false;

  const safeSetInterval = typeof window !== "undefined" && typeof window.setInterval === "function" ? window.setInterval.bind(window) : null;
  const safeSetTimeout = typeof window !== "undefined" && typeof window.setTimeout === "function" ? window.setTimeout.bind(window) : null;
  if (!safeSetInterval) return;

  const handle = safeSetInterval(() => {
    const target = __findVsCodeEditorPaneTarget();
    if (!target?.element) {
      return;
    }

    if (!__monacoDirectChildrenLogged && !__monacoDirectChildrenLogScheduled && safeSetTimeout) {
      __monacoDirectChildrenLogScheduled = true;
      globalThis.__vsCodeMonacoChildLogTimeoutHandle = safeSetTimeout(() => {
        const currentTarget = __findVsCodeEditorPaneTarget();
        if (currentTarget?.element) {
          __logMonacoDirectDivChildren(currentTarget);
        } else {
          // logging disabled temporarily
        }
        __monacoDirectChildrenLogged = true;
        __monacoDirectChildrenLogScheduled = false;
        globalThis.__vsCodeMonacoChildLogTimeoutHandle = null;
      }, 5000);
    }

    __rememberVsCodeSmokeTargetStyles(target.element);
    target.element.style.setProperty("overflow-y", "hidden", "important");

    const host = __findVsCodeScrollHost(target.element);
    if (host) {
      __rememberVsCodeSmokeHostStyles(host);
      host.style.setProperty("overflow-y", "hidden", "important");
    }

    on = !on;
    // target.element.style.marginBottom = on ? "180px" : "0px";

    const children = Array.from(target.element.children || []);
    __rememberVsCodeSmokeChildStyles(children);
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (!child) continue;
      // child.style.marginBottom = on ? `${20 + i * 25}px` : "0px";
    }

    // logging disabled temporarily
  }, 1000);

  globalThis.__vsCodeBottomMarginSmokeTestHandle = handle;
  globalThis.__stopVsCodeBottomMarginSmokeTest = stopVsCodeBottomMarginSmokeTest;
}

// startVsCodeBottomMarginSmokeTest();




function declareExports(symbols) {
  if (!symbols || typeof symbols !== "object") {
    throw new Error("declareExports expected an object map of exports.");
  }

  for (const [symbolName, symbol] of Object.entries(symbols)) {
    globalThis[symbolName] = symbol;
  }
}

function declareNamespace(namespaceName) {
  const name = String(namespaceName || "").trim();
  if (!name) {
    throw new Error("declareNamespace expected a non-empty namespace name.");
  }

  const existing = globalThis[name];

  // Fail hard if the symbol already exists but is not a namespace object.
  if (existing !== undefined && (typeof existing !== "object" || existing === null)) {
    throw new Error(`declareNamespace collision: global "${name}" already exists and is not an object.`);
  }

  const ns = existing || {};
  if (existing === undefined) {
    globalThis[name] = ns;
  }

  // Keep one reserved member: export.
  if (ns.export !== undefined && typeof ns.export !== "function") {
    throw new Error(`declareNamespace collision: "${name}.export" already exists and is not a function.`);
  }

  ns.__name = name;

  ns.export = function(symbol) {
    if (typeof symbol !== "function") {
      throw new Error("namespace.export expected a named function or class.");
    }
    const symbolName = String(symbol.name || "").trim();
    if (!symbolName) {
      throw new Error("namespace.export expected a named function or class.");
    }
    ns[symbolName] = symbol;
    return symbol;
  };

  return ns;
}



declareExports({
  obsidian,
  appendStartupLogLine,
  setAichatStartupComplete,
  routeAichatRuntimeError,
  registerInit,
  runRegisteredInits,
  startVsCodeBottomMarginSmokeTest,
  stopVsCodeBottomMarginSmokeTest,
  declareExports,
  declareNamespace
});
