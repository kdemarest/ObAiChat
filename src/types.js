registerInit("types", init_types);

const DEFAULT_SETTINGS = {
  provider: "anthropic",
  apiKey: "",
  model: "claude-sonnet-4-6",
  maxIterations: 20,
  enableWebSearch: true,
  zeroKeyboardHeightInVsCode: false
};

const CHATGPT_OAUTH_DEFAULT_MODEL = "gpt-5.5";

function init_types() {
  "use strict";
}

declareExports({
  DEFAULT_SETTINGS,
  CHATGPT_OAUTH_DEFAULT_MODEL
});
