async function frontmatter(app, input) {
  return await Command.searchRead(app, input, "frontmatter");
}

const Command = declareNamespace("Command");
Command.export(frontmatter);
