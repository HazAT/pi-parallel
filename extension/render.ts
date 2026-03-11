import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";

function fmtSecs(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type {
  EnrichItem,
  ExtractResult,
  ResearchOutput,
  ResearchResult,
  SearchResult,
} from "./cli.js";

// ── renderCall renderers ─────────────────────────────────────────────────────

export function renderSearchCall(args: any, theme: any): any {
  const query = args.query || "...";
  const preview = query.length > 60 ? `${query.slice(0, 60)}...` : query;
  return new Text(
    theme.fg("muted", "→ ") +
      theme.fg("toolTitle", theme.bold("parallel_search ")) +
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
      theme.fg("toolTitle", theme.bold("parallel_extract ")) +
      theme.fg("accent", urlText),
    0,
    0,
  );
}

export function renderResearchCall(args: any, theme: any): any {
  const topic = args.topic || "...";
  const preview = topic.length > 60 ? `${topic.slice(0, 60)}...` : topic;
  const speed = args.speed || "fast";
  return new Text(
    theme.fg("muted", "→ ") +
      theme.fg("toolTitle", theme.bold("parallel_research ")) +
      theme.fg("accent", `"${preview}"`) +
      theme.fg("dim", ` · ${speed}`),
    0,
    0,
  );
}

export function renderEnrichCall(args: any, theme: any): any {
  const data: any[] = Array.isArray(args.data) ? args.data : [];
  const intent = args.intent || args.instructions || "...";
  const preview = intent.length > 50 ? `${intent.slice(0, 50)}...` : intent;
  return new Text(
    theme.fg("muted", "→ ") +
      theme.fg("toolTitle", theme.bold("parallel_enrich ")) +
      theme.fg("accent", `${data.length} items`) +
      theme.fg("dim", ` · "${preview}"`),
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
  const details = result.details as (SearchResult & { query?: string }) | undefined;

  if (result.isError || !details || details.status !== "ok") {
    const errMsg =
      (details as any)?.error ||
      result.content?.[0]?.text ||
      "unknown error";
    return new Text(
      theme.fg("error", "✗ ") +
        theme.fg("toolTitle", theme.bold("parallel_search")) +
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
          theme.fg("toolTitle", theme.bold("parallel_search")) +
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
    theme.fg("toolTitle", theme.bold("parallel_search")) +
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
  const details = result.details as ExtractResult | undefined;

  if (result.isError || !details || details.status !== "ok") {
    const errMsg =
      result.content?.[0]?.text || "unknown error";
    return new Text(
      theme.fg("error", "✗ ") +
        theme.fg("toolTitle", theme.bold("parallel_extract")) +
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
          theme.fg("toolTitle", theme.bold("parallel_extract")) +
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
    theme.fg("toolTitle", theme.bold("parallel_extract")) +
    theme.fg("muted", ` · ${items.length} URL${items.length !== 1 ? "s" : ""}${titleInfo}`) +
    theme.fg("dim", `${wordInfo}\n(Ctrl+O to expand)`);
  return new Text(text, 0, 0);
}

export function formatResearchContent(output: ResearchOutput): string {
  if (!output) return "";

  let markdown = "";

  if (output.type === "markdown" || typeof output.content === "string") {
    markdown = output.content as string;
  } else if (output.content && typeof output.content === "object") {
    const toTitleCase = (key: string) =>
      key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    for (const [key, value] of Object.entries(output.content)) {
      const heading = toTitleCase(key);
      markdown += `## ${heading}\n\n`;
      if (Array.isArray(value)) {
        markdown += value.map((v) => `- ${v}`).join("\n") + "\n\n";
      } else if (value !== null && typeof value === "object") {
        for (const [k, v] of Object.entries(value as Record<string, any>)) {
          markdown += `**${k}**: ${v}\n`;
        }
        markdown += "\n";
      } else {
        markdown += `${value}\n\n`;
      }
    }
  }

  // Append deduplicated sources
  if (output.basis && output.basis.length > 0) {
    const seenUrls = new Set<string>();
    const sources: string[] = [];
    for (const basis of output.basis) {
      for (const citation of basis.citations ?? []) {
        if (citation.url && !seenUrls.has(citation.url)) {
          seenUrls.add(citation.url);
          sources.push(
            citation.title
              ? `- [${citation.title}](${citation.url})`
              : `- ${citation.url}`,
          );
        }
      }
    }
    if (sources.length > 0) {
      markdown += `## Sources\n\n${sources.join("\n")}\n`;
    }
  }

  return markdown;
}

export function renderResearchResult(
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
): any {
  const details = result.details as
    | (ResearchResult & { status?: string; elapsed?: number; processor?: string })
    | undefined;

  // Streaming/running state
  if (details?.status === "running") {
    const elapsed = details.elapsed ? ` · ${details.elapsed}s` : "";
    const processor = details.processor ? ` · ${details.processor}` : "";
    return new Text(
      theme.fg("warning", "⏳ ") +
        theme.fg("toolTitle", theme.bold("parallel_research")) +
        theme.fg("muted", ` · running${elapsed}${processor}`),
      0,
      0,
    );
  }

  if (result.isError || !details?.output) {
    const errMsg = result.content?.[0]?.text || "unknown error";
    return new Text(
      theme.fg("error", "✗ ") +
        theme.fg("toolTitle", theme.bold("parallel_research")) +
        theme.fg("error", ` · ${errMsg}`),
      0,
      0,
    );
  }

  const output = details.output;
  const sourceCount = (() => {
    const seen = new Set<string>();
    for (const b of output.basis ?? []) {
      for (const c of b.citations ?? []) {
        if (c.url) seen.add(c.url);
      }
    }
    return seen.size;
  })();

  const elapsedStr = details?.elapsed ? fmtSecs(details.elapsed) : null;
  const processorStr = details?.processor ?? null;
  const metaStr = [
    `${sourceCount} source${sourceCount !== 1 ? "s" : ""}`,
    elapsedStr,
    processorStr,
  ].filter(Boolean).join(" · ");

  if (expanded) {
    const container = new Container();
    container.addChild(
      new Text(
        theme.fg("success", "✓ ") +
          theme.fg("toolTitle", theme.bold("parallel_research")) +
          theme.fg("muted", ` · ${metaStr}`),
        0,
        0,
      ),
    );
    container.addChild(new Spacer(1));
    const formattedContent = formatResearchContent(output);
    if (formattedContent) {
      container.addChild(new Markdown(formattedContent, 0, 0, getMarkdownTheme()));
    }
    return container;
  }

  // Collapsed — show summary_overview if present
  const overview =
    typeof output.content === "object" && output.content !== null
      ? (output.content as any).summary_overview
      : typeof output.content === "string"
        ? output.content
        : null;
  const snippet = overview
    ? overview.length > 150
      ? `${overview.slice(0, 150)}…`
      : overview
    : "";

  let text =
    theme.fg("success", "✓ ") +
    theme.fg("toolTitle", theme.bold("parallel_research")) +
    theme.fg("muted", ` · ${metaStr}`);
  if (snippet) {
    text += "\n" + theme.fg("dim", snippet);
  }
  text += "\n" + theme.fg("dim", "(Ctrl+O to expand)");
  return new Text(text, 0, 0);
}

export function renderEnrichResult(
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
): any {
  const details = result.details as
    | { status?: string; elapsed?: number; items?: EnrichItem[] }
    | undefined;

  // Streaming/running state
  if (details?.status === "running") {
    const elapsed = details.elapsed ? ` · ${details.elapsed}s` : "";
    const count =
      Array.isArray((details as any).items) ? ` · ${(details as any).items.length} items` : "";
    return new Text(
      theme.fg("warning", "⏳ ") +
        theme.fg("toolTitle", theme.bold("parallel_enrich")) +
        theme.fg("muted", `${count} · running${elapsed}`),
      0,
      0,
    );
  }

  if (result.isError || !details?.items) {
    const errMsg = result.content?.[0]?.text || "unknown error";
    return new Text(
      theme.fg("error", "✗ ") +
        theme.fg("toolTitle", theme.bold("parallel_enrich")) +
        theme.fg("error", ` · ${errMsg}`),
      0,
      0,
    );
  }

  const items = details.items;
  const enrichElapsedStr = details.elapsed ? fmtSecs(details.elapsed) : null;
  const enrichMeta = [
    `${items.length} item${items.length !== 1 ? "s" : ""} enriched`,
    enrichElapsedStr,
  ].filter(Boolean).join(" · ");

  if (expanded) {
    const container = new Container();
    container.addChild(
      new Text(
        theme.fg("success", "✓ ") +
          theme.fg("toolTitle", theme.bold("parallel_enrich")) +
          theme.fg("muted", ` · ${enrichMeta}`),
        0,
        0,
      ),
    );
    for (const item of items) {
      container.addChild(new Spacer(1));
      const inputParts = Object.entries(item.input ?? {})
        .map(([k, v]) => theme.fg("dim", `${k}: ${v}`))
        .join("  ");
      const outputParts = Object.entries(item.output ?? {})
        .map(([k, v]) => theme.fg("accent", `${k}: ${v}`))
        .join("  ");
      container.addChild(
        new Text(
          theme.fg("muted", "in  ") + inputParts + "\n" + theme.fg("muted", "out ") + outputParts,
          0,
          0,
        ),
      );
    }
    return container;
  }

  // Collapsed — show first 3 rows as input → output
  let text =
    theme.fg("success", "✓ ") +
    theme.fg("toolTitle", theme.bold("parallel_enrich")) +
    theme.fg("muted", ` · ${enrichMeta}`);

  for (const item of items.slice(0, 3)) {
    const inputKey = Object.keys(item.input ?? {})[0];
    const inputVal = inputKey ? item.input[inputKey] : "?";
    const outputKey = Object.keys(item.output ?? {})[0];
    const outputVal = outputKey ? item.output[outputKey] : "?";
    if (inputKey && outputKey) {
      text +=
        "\n  " +
        theme.fg("dim", `${inputKey}: ${inputVal}`) +
        theme.fg("muted", " → ") +
        theme.fg("accent", `${outputKey}: ${outputVal}`);
    }
  }
  if (items.length > 3) {
    text += "\n" + theme.fg("muted", `  … ${items.length - 3} more`);
  }
  text += "\n" + theme.fg("dim", "(Ctrl+O to expand)");
  return new Text(text, 0, 0);
}
