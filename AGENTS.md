{#include ../SharedProjects.md}

## Coding philosophy
Follow **fail-fast, YAGNI, and single-source-of-truth** principles.

Prefer one clean, authoritative implementation over defensive compatibility code. Runtime failure is preferable to silently masking incorrect assumptions or misuse.

## Coding Rules
You are absolutely required to follow these rules:

* **One code path per responsibility.** Never retain duplicate, legacy, fallback, compatibility, or shim implementations.
* **Fail fast and loudly.** Do not catch, suppress, repair, default around, or otherwise mask programmer errors or invalid state unless explicitly requested.
* **Assume required objects exist.** If the architecture requires an object/class/component to exist, use it directly. Do not add speculative null/missing-object fallbacks.
* **Remove things completely.** When a feature or API is removed, delete its implementation, toggles, wrappers, compatibility paths, and dead code. Do not preserve a way to resurrect it.
* **Refactor completely.** When responsibility moves into a class or module, all related initialization, state, and operations move with it. Do not leave procedural wrappers such as `initFoo`, `openFoo`, or `fooGetState`.
* **Do not add unrequested functionality.** No speculative features, options, configurability, compatibility layers, or defensive abstractions.
* **Preserve architectural clarity over backward compatibility.** Existing internal callers should be updated to the new architecture rather than accommodated through adapters or shims.
* All runtime errors must be caught or handled in one single place that logs them to lastErr.log
* Keep code Android-compatible with Obsidian mobile.
* Use Obsidian APIs, not Node/Electron APIs.

## Build Structure
The build.sh
- Encapsulates each .js file in braces
- Concatenates into assembled-plugin.js
- Runs syntax checks and a smoke test
- Copies the result to .obsidian/plugins/gptchat/main.js, a file you can never see.

As a programmer, you should:

* Declare all module exports using declareExports(), unless necessary for obsidian startup or linkage.
* Use these exported globals instead of making require() statements.