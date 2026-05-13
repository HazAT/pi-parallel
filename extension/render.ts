import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type { ExtractResult, SearchResult } from "./cli.js";

function fmtSecs(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ── renderCall renderers ─────────────────────────────────────────────────────

export function renderSearchCall(args: any, theme: any): any {
  const query = args.query || "...";
  const preview = query.length > 60 ? `${query.slice(0, 60)}...` : query;
  return new Text(
    theme.fg("muted", "→ ") +
      theme.fg("toolTitle", theme.bold("web_search ")) +
      theme.fg("accent", `"${preview}"`),
    0,
    0,
  );
}

export function renderExtractCall(args: any, theme: any): any {
  const urls: string[] = Array.isArray(args.urls)
    ? args.urls
    : args.url
      ? [args.url]
      : [];
  const urlText =
    urls.length === 1
      ? urls[0]
      : `${urls.length} URLs`;
  return new Text(
    theme.fg("muted", "→ ") +
      theme.fg("toolTitle", theme.bold("web_fetch ")) +
      theme.fg("accent", urlText),
    0,
    0,
  );
}

// ── renderResult renderers ───────────────────────────────────────────────────

export function renderSearchResult(
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
): any {
  const details = result.details as (SearchResult & { query?: string; elapsed?: number; maxResults?: number }) | undefined;

  if (details?.status === "running") {
    const elapsed = details.elapsed ? ` · ${fmtSecs(details.elapsed)}` : "";
    const query = details.query ? ` · \"${details.query.length > 40 ? details.query.slice(0, 40) + "…" : details.query}\"` : "";
    return new Text(
      theme.fg("warning", "⏳ ") +
        theme.fg("toolTitle", theme.bold("web_search")) +
        theme.fg("muted", ` · running${elapsed}${query}`),
      0,
      0,
    );
  }

  if (result.isError || !details || details.status !== "ok") {
    const errMsg =
      (details as any)?.error ||
      result.content?.[0]?.text ||
      "unknown error";
    return new Text(
      theme.fg("error", "✗ ") +
        theme.fg("toolTitle", theme.bold("web_search")) +
        theme.fg("error", ` · ${errMsg}`),
      0,
      0,
    );
  }

  const items = details.results ?? [];
  const query = details.query || "";
  const queryText = query ? ` · "${query.length > 40 ? query.slice(0, 40) + "…" : query}"` : "";

  if (expanded) {
    const container = new Container();
    container.addChild(
      new Text(
        theme.fg("success", "✓ ") +
          theme.fg("toolTitle", theme.bold("web_search")) +
          theme.fg("muted", ` · ${items.length} results${queryText}`),
        0,
        0,
      ),
    );
    for (const item of items) {
      container.addChild(new Spacer(1));
      container.addChild(
        new Text(theme.fg("accent", item.title || item.url), 0, 0),
      );
      container.addChild(new Text(theme.fg("muted", item.url), 0, 0));
      if (item.publish_date) {
        container.addChild(
          new Text(theme.fg("dim", `Published: ${item.publish_date}`), 0, 0),
        );
      }
      const excerpt = item.excerpts?.[0] || "";
      if (excerpt) {
        container.addChild(new Markdown(excerpt, 0, 0, getMarkdownTheme()));
      }
    }
    return container;
  }

  // Collapsed
  let text =
    theme.fg("success", "✓ ") +
    theme.fg("toolTitle", theme.bold("web_search")) +
    theme.fg("muted", ` · ${items.length} results${queryText}`);

  for (const item of items.slice(0, 3)) {
    const snippet = (item.excerpts?.[0] || "").replace(/\n/g, " ").trim();
    const snippetPreview =
      snippet.length > 80 ? `${snippet.slice(0, 80)}…` : snippet;
    text +=
      "\n  " +
      theme.fg("accent", item.title || item.url) +
      "\n  " +
      theme.fg("dim", item.url);
    if (snippetPreview) {
      text += "\n  " + theme.fg("dim", snippetPreview);
    }
  }
  if (items.length > 3) {
    text += "\n" + theme.fg("muted", `  … ${items.length - 3} more results`);
  }
  text += "\n" + theme.fg("dim", "(Ctrl+O to expand)");
  return new Text(text, 0, 0);
}

export function renderExtractResult(
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
): any {
  const details = result.details as (ExtractResult & { elapsed?: number; urls?: string[] }) | undefined;

  if (details?.status === "running") {
    const elapsed = details.elapsed ? ` · ${fmtSecs(details.elapsed)}` : "";
    const urlCount = Array.isArray((details as any).urls) ? ` · ${(details as any).urls.length} URL${(details as any).urls.length !== 1 ? "s" : ""}` : "";
    return new Text(
      theme.fg("warning", "⏳ ") +
        theme.fg("toolTitle", theme.bold("web_fetch")) +
        theme.fg("muted", ` · running${elapsed}${urlCount}`),
      0,
      0,
    );
  }

  if (result.isError || !details || details.status !== "ok") {
    const errMsg =
      result.content?.[0]?.text || "unknown error";
    return new Text(
      theme.fg("error", "✗ ") +
        theme.fg("toolTitle", theme.bold("web_fetch")) +
        theme.fg("error", ` · ${errMsg}`),
      0,
      0,
    );
  }

  const items = details.results ?? [];
  const firstTitle = items[0]?.title || items[0]?.url || "";

  if (expanded) {
    const container = new Container();
    container.addChild(
      new Text(
        theme.fg("success", "✓ ") +
          theme.fg("toolTitle", theme.bold("web_fetch")) +
          theme.fg("muted", ` · ${items.length} URL${items.length !== 1 ? "s" : ""}`),
        0,
        0,
      ),
    );
    for (const item of items) {
      container.addChild(new Spacer(1));
      container.addChild(
        new Text(
          theme.fg("accent", item.title || item.url) +
            "\n" +
            theme.fg("muted", item.url),
          0,
          0,
        ),
      );
      const content = (item.excerpts ?? []).join("\n\n");
      if (content) {
        container.addChild(new Markdown(content, 0, 0, getMarkdownTheme()));
      }
    }
    return container;
  }

  // Collapsed
  const totalWords = items.reduce((acc, item) => {
    const text = (item.excerpts ?? []).join(" ");
    return acc + text.split(/\s+/).filter(Boolean).length;
  }, 0);
  const wordInfo = totalWords > 0 ? ` · ~${totalWords.toLocaleString()} words` : "";
  const titleInfo =
    firstTitle.length > 40
      ? ` · "${firstTitle.slice(0, 40)}…"`
      : firstTitle
        ? ` · "${firstTitle}"`
        : "";

  const text =
    theme.fg("success", "✓ ") +
    theme.fg("toolTitle", theme.bold("web_fetch")) +
    theme.fg("muted", ` · ${items.length} URL${items.length !== 1 ? "s" : ""}${titleInfo}`) +
    theme.fg("dim", `${wordInfo}\n(Ctrl+O to expand)`);
  return new Text(text, 0, 0);
}
