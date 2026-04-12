import { Type } from "@sinclair/typebox";
import { runCliWithHeartbeat, type ExtractResult } from "../cli.js";
import { renderExtractCall, renderExtractResult } from "../render.js";

export const extractTool = {
  name: "parallel_extract",
  label: "Parallel Extract",
  description: "Extract and convert the content of one or more public web pages into clean, readable markdown using parallel.ai's content extraction. Handles JavaScript-rendered pages, strips navigation/ads/boilerplate, and returns the meaningful content with titles and text excerpts. Accepts a single URL or an array of URLs for batch extraction. Use this when you have a specific URL (or URLs) and need to read the page content — for example, reading documentation, blog posts, or articles the user shared. Do NOT use for URLs you can fetch directly with curl (raw GitHub files, API endpoints, JSON feeds, localhost) — those don't need content extraction. Do NOT use for general web discovery — use parallel_search when you don't have a URL yet.",
  promptSnippet: "Extract readable content from public web page URLs. Not for raw/API/localhost URLs (use curl) or general search (use parallel_search).",
  promptGuidelines: [
    "Call this tool directly as parallel_extract({...}) — do NOT route through the mcp() tool",
    "Use when you have a public web page URL and need its content as clean markdown",
    "Do NOT use for raw file URLs, API endpoints, localhost, or anything curl can fetch directly",
    "Accepts a single URL string or an array of URLs for batch extraction",
    "Use the objective param to focus extraction (e.g. 'pricing information', 'API reference', 'changelog')",
    "Do NOT use for general searches — use parallel_search when you don't have a specific URL",
  ],
  parameters: Type.Object({
    url: Type.Any({ description: "One or more public web page URLs to extract content from. Pass a single URL string for one page, or an array of URL strings for batch extraction. Must be publicly accessible web pages — not raw file URLs, API endpoints, or localhost addresses." }),
    objective: Type.Optional(Type.String({ description: "An optional extraction focus that guides what content to prioritize. For example, 'pricing information' will emphasize pricing tables and plan details, while 'API documentation' will focus on endpoints and code examples. When omitted, extracts all meaningful content from the page." })),
  }),
  async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, _ctx: any) {
    try {
      const urls = Array.isArray(params.url) ? params.url : [params.url];
      const args = ["extract", ...urls, "--json"];
      if (params.objective) args.push("--objective", params.objective);

      const startTime = Date.now();
      onUpdate?.({
        content: [{ type: "text" as const, text: `📄 Extract started · ${urls.length} URL${urls.length !== 1 ? "s" : ""}` }],
        details: { status: "running", urls, objective: params.objective },
      });

      const result: ExtractResult = await runCliWithHeartbeat(
        args,
        signal,
        onUpdate,
        startTime,
        (elapsed) => ({
          content: [{ type: "text" as const, text: `📄 Extracting ${urls.length} URL${urls.length !== 1 ? "s" : ""}` }],
          details: {
            status: "running",
            urls,
            objective: params.objective,
            elapsed,
          },
        }),
      );
      const content = result.results?.map(r =>
        `## ${r.title}\n\n${r.excerpts?.join("\n\n") ?? ""}`
      ).join("\n\n---\n\n") ?? "";
      return {
        content: [{ type: "text" as const, text: content || "No content extracted" }],
        details: {
          extract_id: result.extract_id,
          status: result.status,
          urls,
          results: result.results?.map((r: any) => ({
            url: r.url,
            title: r.title,
            excerpts: r.excerpts,
          })),
        },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    }
  },
  renderCall: renderExtractCall,
  renderResult: renderExtractResult,
};
