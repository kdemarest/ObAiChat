function getCurrentDatetime() {
  const now = new Date();
  const iso = now.toISOString();
  const local = now.toLocaleString(void 0, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  });
  const dateOnly = now.toISOString().split("T")[0];
  return {
    result: `Local: ${local}\nISO: ${iso}\nDate: ${dateOnly}`,
    isError: false
  };
}

const Command = declareNamespace("Command");
Command.export(getCurrentDatetime);
