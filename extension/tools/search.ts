import { Type, type Static } from "@sinclair/typebox";
import {
  parallelRequest,
  type ParallelResultItem,
  type ParallelUsageItem,
  type ParallelWarning,
  type SearchResponse,
} from "../api.js";
import { truncateToolOutput } from "../output.js";
import { renderSearchCall, renderSearchResult } from "../render.js";
import { requireApiKey } from "../config.js";

const SearchParams = Type.Object({
  query: Type.String({
    description: "A self-contained description of what to find on the web. Include the key topic, desired facts, and any source or freshness preferences.",
    minLength: 1,
    maxLength: 5000,
  }),
  searchQueries: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 200 }), {
    description: "Optional concise keyword queries (2-3 is best). Use diverse terms and angles rather than full sentences.",
    minItems: 1,
    maxItems: 5,
  })),
  maxResults: Type.Optional(Type.Integer({
    description: "Maximum number of results. Defaults to 10.",
    minimum: 1,
    maximum: 20,
  })),
  afterDate: Type.Optional(Type.String({
    description: "Only include content published on or after this date (YYYY-MM-DD).",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  })),
});

export type SearchInput = Static<typeof SearchParams>;

type SearchResultSummary = Pick<ParallelResultItem, "url" | "title" | "publish_date">;
type WarningSummary = Pick<ParallelWarning, "type" | "message">;

export type SearchDetails =
  | {
      status: "running";
      query: string;
      startedAt: number;
    }
  | {
      status: "success";
      query: string;
      durationMs: number;
      searchId: string;
      sessionId: string;
      results: SearchResultSummary[];
      warnings: WarningSummary[];
      usage: ParallelUsageItem[];
    };

export const searchTool = {
  name: "web_search",
  label: "Web Search",
  description: "Search the public web with Parallel's Search API. Returns ranked pages with titles, URLs, publication dates, and LLM-optimized excerpts. Use this to discover sources or find current information. For a known public webpage, use web_fetch instead. Output is limited to 50KB or 2,000 lines.",
  promptSnippet: "Search the public web for current information and relevant sources",
  promptGuidelines: [
    "Use web_search to discover pages, verify current facts, or locate documentation.",
    "Use web_search searchQueries for 2-3 concise keyword variants when a topic benefits from multiple angles.",
    "Use web_fetch after web_search when the full content of a promising result is needed.",
    "Do not use web_search for a URL already provided by the user; use web_fetch for public webpages or curl for raw/API/local URLs.",
  ],
  parameters: SearchParams,

  async execute(
    _toolCallId: string,
    params: SearchInput,
    signal: AbortSignal | undefined,
    onUpdate: ((update: { content: Array<{ type: "text"; text: string }>; details: SearchDetails }) => void) | undefined,
    ctx: { model?: { id: string } },
  ) {
    const apiKey = await requireApiKey();
    const startedAt = Date.now();
    onUpdate?.({
      content: [{ type: "text", text: `Searching the web for: ${params.query}` }],
      details: { status: "running", query: params.query, startedAt },
    });

    const advancedSettings: Record<string, unknown> = {
      max_results: params.maxResults ?? 10,
    };
    if (params.afterDate) {
      advancedSettings.source_policy = { after_date: params.afterDate };
    }

    const response = await parallelRequest<SearchResponse>(
      "/search",
      {
        objective: params.query,
        search_queries: params.searchQueries ?? [params.query],
        mode: "basic",
        max_chars_total: 40_000,
        client_model: ctx.model?.id,
        advanced_settings: advancedSettings,
      },
      signal,
      apiKey,
    );
    assertSearchResponse(response);

    const warnings = response.warnings ?? [];
    return {
      content: [{ type: "text" as const, text: truncateToolOutput(formatSearchResponse(params.query, response)) }],
      details: {
        status: "success" as const,
        query: params.query,
        durationMs: Date.now() - startedAt,
        searchId: response.search_id,
        sessionId: response.session_id,
        results: response.results.slice(0, 20).map(summarizeResult),
        warnings: warnings.slice(0, 50).map(summarizeWarning),
        usage: (response.usage ?? []).slice(0, 50).map((item) => ({
          name: compactField(item.name, 200),
          count: item.count,
        })),
      } satisfies SearchDetails,
    };
  },

  renderCall: renderSearchCall,
  renderResult: renderSearchResult,
};

function formatSearchResponse(query: string, response: SearchResponse): string {
  const sections = response.results.map((result, index) => {
    const lines = [
      `${index + 1}. ${result.title || "Untitled page"}`,
      `URL: ${result.url}`,
    ];
    if (result.publish_date) lines.push(`Published: ${result.publish_date}`);
    if (result.excerpts.length > 0) lines.push(result.excerpts.join("\n\n"));
    return lines.join("\n");
  });

  let output = `Found ${response.results.length} result${response.results.length === 1 ? "" : "s"} for: ${query}`;
  if (response.warnings?.length) {
    output += `\n\nWarnings:\n${response.warnings.map((warning) => `- ${warning.message}`).join("\n")}`;
  }
  if (sections.length > 0) output += `\n\n${sections.join("\n\n---\n\n")}`;
  return output;
}

function summarizeResult(item: ParallelResultItem): SearchResultSummary {
  return {
    url: compactField(item.url, 2_048),
    title: item.title ? compactField(item.title, 500) : item.title,
    publish_date: item.publish_date ? compactField(item.publish_date, 100) : item.publish_date,
  };
}

function summarizeWarning(warning: ParallelWarning): WarningSummary {
  return {
    type: compactField(warning.type, 100),
    message: compactField(warning.message, 1_000),
  };
}

function compactField(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function assertSearchResponse(response: SearchResponse): void {
  if (
    typeof response.search_id !== "string" ||
    typeof response.session_id !== "string" ||
    !Array.isArray(response.results) ||
    !response.results.every(isResultItem) ||
    !isWarnings(response.warnings) ||
    !isUsage(response.usage)
  ) {
    throw new Error("Parallel Search API returned an unexpected response shape.");
  }
}

function isResultItem(value: unknown): value is ParallelResultItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ParallelResultItem>;
  return (
    typeof item.url === "string" &&
    isNullableString(item.title) &&
    isNullableString(item.publish_date) &&
    Array.isArray(item.excerpts) &&
    item.excerpts.every((excerpt) => typeof excerpt === "string")
  );
}

function isWarnings(value: unknown): value is ParallelWarning[] | null | undefined {
  return value == null || (Array.isArray(value) && value.every((warning) =>
    Boolean(warning) && typeof warning === "object" && typeof (warning as ParallelWarning).message === "string"));
}

function isUsage(value: unknown): value is ParallelUsageItem[] | null | undefined {
  return value == null || (Array.isArray(value) && value.every((item) =>
    Boolean(item) && typeof item === "object" &&
    typeof (item as ParallelUsageItem).name === "string" &&
    typeof (item as ParallelUsageItem).count === "number"));
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === "string";
}
