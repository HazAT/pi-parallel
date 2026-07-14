const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2_000;
const TRUNCATION_NOTICE = "\n[Output truncated to 50KB / 2000 lines.]";

export function truncateToolOutput(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= MAX_OUTPUT_LINES && Buffer.byteLength(text, "utf8") <= MAX_OUTPUT_BYTES) {
    return text;
  }

  const byteBudget = MAX_OUTPUT_BYTES - Buffer.byteLength(TRUNCATION_NOTICE, "utf8");
  const kept: string[] = [];
  let bytes = 0;

  for (const line of lines.slice(0, MAX_OUTPUT_LINES - 1)) {
    const separatorBytes = kept.length === 0 ? 0 : 1;
    const available = byteBudget - bytes - separatorBytes;
    if (available <= 0) break;

    if (Buffer.byteLength(line, "utf8") <= available) {
      kept.push(line);
      bytes += separatorBytes + Buffer.byteLength(line, "utf8");
      continue;
    }

    let end = line.length;
    while (end > 0 && Buffer.byteLength(line.slice(0, end), "utf8") > available) end--;
    if (end > 0) kept.push(line.slice(0, end));
    break;
  }

  return `${kept.join("\n")}${TRUNCATION_NOTICE}`;
}
