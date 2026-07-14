import { getMarkdownTheme, keyHint, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type { ExtractDetails } from "./tools/extract.js";
import type { SearchDetails } from "./tools/search.js";

interface RenderContext {
  isError?: boolean;
  lastComponent?: unknown;
}

interface ToolResultLike {
  content?: Array<{ type: string; text?: string }>;
  details?: unknown;
}

export function renderSearchCall(args: Record<string, unknown>, theme: Theme, context: RenderContext): Text {
  const query = compact(String(args.query || "…"), 72);
  const suffix = typeof args.maxResults === "number" ? theme.fg("dim", ` · ${args.maxResults} max`) : "";
  return updateText(
    context,
    theme.fg("toolTitle", theme.bold("web_search")) + " " + theme.fg("accent", `“${query}”`) + suffix,
  );
}

export function renderExtractCall(args: Record<string, unknown>, theme: Theme, context: RenderContext): Text {
  const urls = Array.isArray(args.url) ? args.url.filter((url): url is string => typeof url === "string") : typeof args.url === "string" ? [args.url] : [];
  const target = urls.length === 1 ? compact(urls[0], 76) : `${urls.length || "…"} webpages`;
  return updateText(
    context,
    theme.fg("toolTitle", theme.bold("web_fetch")) + " " + theme.fg("accent", target),
  );
}

export function renderSearchResult(
  result: ToolResultLike,
  options: { expanded: boolean; isPartial?: boolean },
  theme: Theme,
  context: RenderContext,
) {
  const details = result.details as SearchDetails | undefined;
  if (context.isError) return renderError(result, theme, context);
  if (options.isPartial || details?.status === "running") {
    const query = details?.status === "running" ? ` · “${compact(details.query, 48)}”` : "";
    return updateText(context, theme.fg("warning", "Searching") + theme.fg("muted", query));
  }
  if (!details || details.status !== "success") return renderFallback(result, theme, context);

  const duration = formatDuration(details.durationMs);
  const warningText = details.warnings.length > 0 ? theme.fg("warning", ` · ${details.warnings.length} warning${details.warnings.length === 1 ? "" : "s"}`) : "";
  const heading =
    theme.fg("success", "Found ") +
    theme.fg("text", `${details.results.length} result${details.results.length === 1 ? "" : "s"}`) +
    theme.fg("dim", ` · ${duration}`) +
    warningText;

  if (!options.expanded) {
    let text = heading;
    for (const item of details.results.slice(0, 3)) {
      text += `\n${theme.fg("accent", compact(item.title || item.url, 88))}`;
      text += `\n${theme.fg("dim", compact(item.url, 100))}`;
    }
    if (details.results.length > 3) text += `\n${theme.fg("muted", `… ${details.results.length - 3} more`)}`;
    if (details.results.length > 0 || details.warnings.length > 0) {
      text += `\n${theme.fg("dim", keyHint("app.tools.expand", "to expand"))}`;
    }
    return updateText(context, text);
  }

  const container = new Container();
  container.addChild(new Text(heading, 0, 0));
  const content = resultText(result);
  if (content) {
    container.addChild(new Spacer(1));
    container.addChild(new Markdown(content, 0, 0, getMarkdownTheme()));
  }
  return container;
}

export function renderExtractResult(
  result: ToolResultLike,
  options: { expanded: boolean; isPartial?: boolean },
  theme: Theme,
  context: RenderContext,
) {
  const details = result.details as ExtractDetails | undefined;
  if (context.isError) return renderError(result, theme, context);
  if (options.isPartial || details?.status === "running") {
    const count = details?.status === "running" ? details.urls.length : 0;
    const target = count > 0 ? ` · ${count} webpage${count === 1 ? "" : "s"}` : "";
    return updateText(context, theme.fg("warning", "Fetching") + theme.fg("muted", target));
  }
  if (!details) return renderFallback(result, theme, context);

  const duration = formatDuration(details.durationMs);
  const success = details.results.length;
  const failures = details.errors.length;
  const statusColor = failures > 0 ? "warning" : "success";
  let heading = theme.fg(statusColor, failures > 0 ? "Fetched with errors " : "Fetched ");
  heading += theme.fg("text", `${success} webpage${success === 1 ? "" : "s"}`);
  heading += theme.fg("dim", ` · ${duration}`);
  if (failures > 0) heading += theme.fg("error", ` · ${failures} failed`);
  if (details.warnings.length > 0) heading += theme.fg("warning", ` · ${details.warnings.length} warning${details.warnings.length === 1 ? "" : "s"}`);

  if (!options.expanded) {
    let text = heading;
    for (const item of details.results.slice(0, 3)) {
      text += `\n${theme.fg("accent", compact(item.title || item.url, 88))}`;
      text += `\n${theme.fg("dim", compact(item.url, 100))}`;
    }
    for (const error of details.errors.slice(0, 2)) {
      text += `\n${theme.fg("error", compact(`${error.url} — ${error.error_type}`, 100))}`;
    }
    if (success > 0 || failures > 0 || details.warnings.length > 0) {
      text += `\n${theme.fg("dim", keyHint("app.tools.expand", "to expand"))}`;
    }
    return updateText(context, text);
  }

  const container = new Container();
  container.addChild(new Text(heading, 0, 0));
  const content = resultText(result);
  if (content) {
    container.addChild(new Spacer(1));
    container.addChild(new Markdown(content, 0, 0, getMarkdownTheme()));
  }
  return container;
}

function renderError(result: ToolResultLike, theme: Theme, context: RenderContext): Text {
  const message = compact(resultText(result) || "Parallel request failed.", 500);
  return updateText(context, theme.fg("error", `Error: ${message}`));
}

function renderFallback(result: ToolResultLike, theme: Theme, context: RenderContext): Text {
  return updateText(context, theme.fg("muted", resultText(result)));
}

function resultText(result: ToolResultLike): string {
  return (result.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

function updateText(context: RenderContext, content: string): Text {
  const text = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
  text.setText(content);
  return text;
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > maxLength ? `${oneLine.slice(0, Math.max(0, maxLength - 1))}…` : oneLine;
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  const seconds = Math.round(milliseconds / 100) / 10;
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
