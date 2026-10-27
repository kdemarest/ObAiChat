function resolveAgentsPath(path, vaultName) {
  if (path.startsWith("/")) {
    const marker = `/${vaultName}/`;
    const idx = path.indexOf(marker);
    if (idx !== -1) {
      return path.substring(idx + marker.length);
    }
    return path.replace(/^\/+/, "");
  }
  return obsidian.normalizePath(path);
}

async function agentsTool(app, input) {
  const rawPath = ToolHelper.requiredString(input.path).trim();
  const configPath = `${app.vault.configDir}/plugins/obaichat/agents-path.txt`;
  const adapter = app.vault.adapter;

  if (rawPath === "-") {
    try {
      await adapter.write(configPath, "");
    } catch {
    }
    return { result: "Cleared AGENTS file configuration. No agents file is active.", isError: false };
  }

  if (rawPath) {
    const resolved = resolveAgentsPath(rawPath, app.vault.getName());
    let content = "";
    try {
      content = await adapter.read(resolved);
    } catch {
      return { result: `Could not read AGENTS file at: ${rawPath}`, isError: true };
    }

    const dir = `${app.vault.configDir}/plugins/obaichat`;
    try {
      if (!await adapter.exists(dir)) {
        await adapter.mkdir(dir);
      }
    } catch {
    }

    await adapter.write(configPath, resolved);
    return {
      result: `Set AGENTS file: ${resolved}\n\n${content}`,
      isError: false
    };
  }

  let configured = "";
  try {
    configured = (await adapter.read(configPath)).trim();
  } catch {
    configured = "";
  }

  if (!configured) {
    return { result: "No AGENTS file configured. Call agents with a path, or agents with '-' to clear.", isError: false };
  }

  try {
    const content = await adapter.read(configured);
    return { result: `AGENTS file: ${configured}\n\n${content}`, isError: false };
  } catch {
    return { result: `Configured AGENTS file could not be read: ${configured}`, isError: true };
  }
}

const Command = declareNamespace("Command");
Command.export(resolveAgentsPath);
Command.export(agentsTool);
