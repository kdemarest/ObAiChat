const fs = require("fs");
const path = require("path");
const vm = require("vm");

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("smoke mock usage: node smokeMock.js <bundle-path>");
}

const source = fs.readFileSync(inputPath, "utf8");

class MockElement {
  addClass() {}
  removeClass() {}
  setText() {}
  setAttr() {}
  empty() {}
  createEl() { return new MockElement(); }
  createSpan() { return new MockElement(); }
  appendChild() { return new MockElement(); }
}

class MockPlugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
  }
  addSettingTab() {}
  registerView() {}
  addRibbonIcon() {}
  addCommand() {}
  registerEvent() {}
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
}

class MockItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.app = leaf?.app || null;
    this.contentEl = new MockElement();
  }
}

class MockPluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = new MockElement();
  }
}

class MockModal {
  constructor(app) {
    this.app = app;
    this.contentEl = new MockElement();
  }
  open() {}
  close() {}
}

class MockMenu {
  addItem(cb) {
    const item = {
      setTitle() { return item; },
      setIcon() { return item; },
      onClick() { return item; }
    };
    if (typeof cb === "function") cb(item);
    return item;
  }
  showAtMouseEvent() {}
}

class MockSetting {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }
  setName() { return this; }
  setDesc() { return this; }
  setHeading() { return this; }
  addDropdown(cb) {
    const dd = {
      addOption() { return dd; },
      setValue() { return dd; },
      onChange() { return dd; }
    };
    if (typeof cb === "function") cb(dd);
    return this;
  }
  addText(cb) {
    const text = {
      inputEl: {},
      setPlaceholder() { return text; },
      setValue() { return text; },
      onChange() { return text; }
    };
    if (typeof cb === "function") cb(text);
    return this;
  }
  addButton(cb) {
    const button = {
      setButtonText() { return button; },
      setDisabled() { return button; },
      setWarning() { return button; },
      setCta() { return button; },
      setIcon() { return button; },
      setTooltip() { return button; },
      onClick() { return button; }
    };
    if (typeof cb === "function") cb(button);
    return this;
  }
  addToggle(cb) {
    const toggle = {
      setValue() { return toggle; },
      onChange() { return toggle; }
    };
    if (typeof cb === "function") cb(toggle);
    return this;
  }
}

class MockNotice {
  constructor(message) {
    this.message = message;
  }
}

class MockTFile {}
class MockMarkdownView {
  setMode() {}
}

const MockMarkdownRenderer = {
  render: async (_app, markdown, el) => {
    if (el && typeof el.setText === "function") {
      el.setText(String(markdown || ""));
    }
  }
};

const mockObsidian = {
  Plugin: MockPlugin,
  ItemView: MockItemView,
  PluginSettingTab: MockPluginSettingTab,
  Modal: MockModal,
  Menu: MockMenu,
  Setting: MockSetting,
  Notice: MockNotice,
  TFile: MockTFile,
  MarkdownView: MockMarkdownView,
  MarkdownRenderer: MockMarkdownRenderer,
  requestUrl: async () => ({ status: 200, json: {}, text: "" }),
  normalizePath: (p) => String(p || "")
};


const usedSymbols = Array.from(new Set(Array.from(source.matchAll(/\bobsidian\.([A-Za-z_][A-Za-z0-9_]*)/g)).map((m) => m[1]))).sort();
const missingSymbols = usedSymbols.filter((name) => !(name in mockObsidian));
if (missingSymbols.length > 0) {
  throw new Error(`smoke mock incomplete: missing obsidian symbols: ${missingSymbols.join(", ")}`);
}

const sandbox = {
  console,
  module: { exports: {} },
  exports: {},
  require: (id) => {
    if (id === "obsidian") return mockObsidian;
    return require(id);
  },
  setTimeout,
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => {},
  queueMicrotask,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
  btoa: (s) => Buffer.from(String(s), "binary").toString("base64")
};

sandbox.window = {
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  clearTimeout,
  addEventListener: () => {},
  removeEventListener: () => {}
};

sandbox.globalThis = sandbox;

try {
  vm.runInNewContext(source, sandbox, {
    filename: path.basename(inputPath),
    timeout: 5000
  });
} catch (err) {
  const msg = err && err.stack ? err.stack : String(err);
  throw new Error(`smoke eval failed for ${inputPath}: ${msg}`);
}

const PluginClass = sandbox.module.exports;
if (typeof PluginClass !== "function") {
  throw new Error("smoke failed: module.exports is not a plugin class/function");
}

const mockApp = {
  vault: {
    adapter: null,
    configDir: ".obsidian",
    getName: () => "smoke",
    getMarkdownFiles: () => [],
    getFiles: () => [],
    getFileByPath: () => null,
    getFolderByPath: () => null
  },
  workspace: {
    getActiveFile: () => null,
    on: () => ({})
  },
  secretStorage: {
    getSecret: () => "",
    setSecret: () => {}
  }
};

try {
  const instance = new PluginClass(mockApp, { id: "gptchat", name: "GPT Chat" });
  if (!instance || typeof instance !== "object") {
    throw new Error("constructor did not return a plugin instance");
  }
} catch (err) {
  const msg = err && err.stack ? err.stack : String(err);
  throw new Error(`smoke construct failed for ${inputPath}: ${msg}`);
}

console.log(`Smoke passed: ${inputPath}`);
