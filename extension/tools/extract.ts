import { Type, type Static } from "@sinclair/typebox";
import {
  parallelRequest,
  type ExtractError,
  type ExtractResponse,
  type ExtractResultItem,
  type ParallelUsageItem,
  type ParallelWarning,
} from "../api.js";
import { truncateToolOutput } from "../output.js";
import { renderExtractCall, renderExtractResult } from "../render.js";
import { requireApiKey } from "../config.js";

const ExtractParams = Type.Object({
  url: Type.Any({
    description: "A public webpage URL or an array of up to 20 public webpage URLs. Use curl instead for raw files, API endpoints, JSON feeds, or localhost.",
  }),
  objective: Type.Optional(Type.String({
    description: "What information to prioritize. Omit to retrieve general page content.",
    minLength: 1,
    maxLength: 5000,
  })),
});

export type ExtractInput = Static<typeof ExtractParams>;

type ExtractResultSummary = Pick<ExtractResultItem, "url" | "title" | "publish_date">;
type ExtractErrorSummary = Pick<ExtractError, "url" | "error_type" | "http_status_code">;
type WarningSummary = Pick<ParallelWarning, "type" | "message">;

export type ExtractDetails =
  | {
      status: "running";
      urls: string[];
      objective?: string;
      startedAt: number;
    }
  | {
      status: "success" | "partial";
      durationMs: number;
      extractId: string;
      sessionId: string;
      results: ExtractResultSummary[];
      errors: ExtractErrorSummary[];
      warnings: WarningSummary[];
      usage: ParallelUsageItem[];
    };

export const extractTool = {
  name: "web_fetch",
  label: "Web Fetch",
  description: "Fetch one or more known public webpages with Parallel's Extract API and return clean, LLM-optimized markdown. Handles JavaScript-rendered pages and PDFs. Use an objective to focus the returned excerpts. Do not use for raw files, APIs, JSON feeds, or localhost; fetch those directly with curl. Output is limited to 50KB or 2,000 lines.",
  promptSnippet: "Fetch clean markdown from one or more known public webpage URLs",
  promptGuidelines: [
    "Use web_fetch for a specific public webpage URL, including JavaScript-heavy pages and PDFs.",
    "Use web_fetch objective when only a particular topic or section of the page is relevant.",
    "Use web_fetch with an array to fetch up to 20 related webpages in one request.",
    "Do not use web_fetch for raw files, API endpoints, JSON feeds, or localhost; use curl or bash for those.",
    "Do not use web_fetch for discovery; use web_search when no URL is known yet.",
  ],
  parameters: ExtractParams,

  async execute(
    _toolCallId: string,
    params: ExtractInput,
    signal: AbortSignal | undefined,
    onUpdate: ((update: { content: Array<{ type: "text"; text: string }>; details: ExtractDetails }) => void) | undefined,
    ctx: { model?: { id: string } },
  ) {
    const apiKey = await requireApiKey();
    const urls = normalizeUrls(params.url);
    const startedAt = Date.now();
    onUpdate?.({
      content: [{ type: "text", text: `Fetching ${urls.length} webpage${urls.length === 1 ? "" : "s"}.` }],
      details: { status: "running", urls, objective: params.objective, startedAt },
    });

    const response = await parallelRequest<ExtractResponse>(
      "/extract",
      {
        urls,
        objective: params.objective,
        max_chars_total: 40_000,
        client_model: ctx.model?.id,
      },
      signal,
      apiKey,
    );
    assertExtractResponse(response);

    const errors = response.errors ?? [];
    if (response.results.length === 0 && errors.length > 0) {
      throw new Error(truncateToolOutput(
        `Parallel could not fetch any requested webpages:\n${errors.map(formatExtractError).join("\n")}`,
      ));
    }
    const warnings = response.warnings ?? [];
    return {
      content: [{ type: "text" as const, text: truncateToolOutput(formatExtractResponse(response)) }],
      details: {
        status: errors.length > 0 ? "partial" as const : "success" as const,
        durationMs: Date.now() - startedAt,
        extractId: response.extract_id,
        sessionId: response.session_id,
        results: response.results.slice(0, 20).map(summarizeResult),
        errors: errors.slice(0, 20).map(summarizeError),
        warnings: warnings.slice(0, 50).map(summarizeWarning),
        usage: (response.usage ?? []).slice(0, 50).map((item) => ({
          name: compactField(item.name, 200),
          count: item.count,
        })),
      } satisfies ExtractDetails,
    };
  },

  renderCall: renderExtractCall,
  renderResult: renderExtractResult,
};

function normalizeUrls(value: unknown): string[] {
  // Some models serialize the URL array as a JSON string (e.g. "[\"https://a\", \"https://b\"]").
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      value = JSON.parse(value);
    } catch {
      // Not JSON — fall through and validate as a plain URL string.
    }
  }
  const urls = Array.isArray(value) ? value : [value];
  if (urls.length === 0 || urls.length > 20 || !urls.every((url) => typeof url === "string" && url.trim())) {
    throw new Error("web_fetch requires one URL or an array of 1-20 URLs.");
  }

  return urls.map((url) => {
    const normalized = (url as string).trim();
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error(`Invalid URL: ${normalized}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Unsupported URL protocol for ${normalized}. Only http and https are supported.`);
    }
    return parsed.href;
  });
}

function formatExtractResponse(response: ExtractResponse): string {
  const sections = response.results.map((result) => {
    const content = result.full_content || result.excerpts.join("\n\n");
    return `## ${result.title || result.url}\n\nSource: ${result.url}${result.publish_date ? `\nPublished: ${result.publish_date}` : ""}${content ? `\n\n${content}` : ""}`;
  });

  const notices: string[] = [];
  if (response.errors.length > 0) {
    notices.push(`## Fetch errors\n\n${response.errors.map(formatExtractError).join("\n")}`);
  }
  if (response.warnings?.length) {
    notices.push(`## Warnings\n\n${response.warnings.map((warning) => `- ${warning.message}`).join("\n")}`);
  }

  const content = sections.length > 0
    ? sections.join("\n\n---\n\n")
    : "No page content was extracted.";
  return [...notices, content].join("\n\n---\n\n");
}

function formatExtractError(error: ExtractError): string {
  const status = error.http_status_code ? ` (HTTP ${error.http_status_code})` : "";
  const content = error.content ? `: ${error.content}` : "";
  return `- ${error.url} — ${error.error_type}${status}${content}`;
}

function summarizeResult(item: ExtractResultItem): ExtractResultSummary {
  return {
    url: compactField(item.url, 2_048),
    title: item.title ? compactField(item.title, 500) : item.title,
    publish_date: item.publish_date ? compactField(item.publish_date, 100) : item.publish_date,
  };
}

function summarizeError(error: ExtractError): ExtractErrorSummary {
  return {
    url: compactField(error.url, 2_048),
    error_type: compactField(error.error_type, 200),
    http_status_code: error.http_status_code,
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

function assertExtractResponse(response: ExtractResponse): void {
  if (
    typeof response.extract_id !== "string" ||
    typeof response.session_id !== "string" ||
    !Array.isArray(response.results) ||
    !response.results.every(isExtractResult) ||
    !Array.isArray(response.errors) ||
    !response.errors.every(isExtractError) ||
    !isWarnings(response.warnings) ||
    !isUsage(response.usage)
  ) {
    throw new Error("Parallel Extract API returned an unexpected response shape.");
  }
}

function isExtractResult(value: unknown): value is ExtractResultItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ExtractResultItem>;
  return (
    typeof item.url === "string" &&
    isNullableString(item.title) &&
    isNullableString(item.publish_date) &&
    isNullableString(item.full_content) &&
    Array.isArray(item.excerpts) &&
    item.excerpts.every((excerpt) => typeof excerpt === "string")
  );
}

function isExtractError(value: unknown): value is ExtractError {
  if (!value || typeof value !== "object") return false;
  const error = value as Partial<ExtractError>;
  return (
    typeof error.url === "string" &&
    typeof error.error_type === "string" &&
    (error.http_status_code == null || typeof error.http_status_code === "number") &&
    isNullableString(error.content)
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
