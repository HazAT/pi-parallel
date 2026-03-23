import { Type } from "@sinclair/typebox";
import { runCli, type ExtractResult } from "../cli.js";
import { renderExtractCall, renderExtractResult } from "../render.js";

export const extractTool = {
  name: "parallel_extract",
  label: "Parallel Extract",
  description: "Extract clean markdown content from external websites the user wants to read or analyze",
  promptSnippet: "Use parallel_extract only for external websites the user wants to read — NOT for raw file URLs, GitHub raw content, APIs, or localhost (use curl/bash for those)",
  promptGuidelines: [
    "Call this tool directly as parallel_extract({...}) — do NOT route through the mcp() tool",
    "Use when the user shares an external website URL and wants its content extracted as clean markdown",
    "Do NOT use for URLs you construct yourself (e.g. raw.githubusercontent.com, API endpoints, localhost, file downloads) — use curl or bash instead",
    "Only appropriate for public web pages the user wants to read, not for fetching known resources programmatically",
    "Accepts a single URL string or an array of URLs for batch extraction",
    "Use the objective param to focus extraction on specific information (e.g. 'API pricing', 'changelog')",
    "Do NOT use for general searches — use parallel_search when you don't have a specific URL",
  ],
  parameters: Type.Object({
    url: Type.Any({ description: "URL or array of URLs to extract content from" }),
    objective: Type.Optional(Type.String({ description: "Focus extraction on a specific goal (e.g. 'pricing information', 'API docs')" })),
  }),
  async execute(_toolCallId: string, params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
    try {
      const urls = Array.isArray(params.url) ? params.url : [params.url];
      const args = ["extract", ...urls, "--json"];
      if (params.objective) args.push("--objective", params.objective);
      const result: ExtractResult = await runCli(args);
      const content = result.results?.map(r =>
        `## ${r.title}\n\n${r.excerpts?.join("\n\n") ?? ""}`
      ).join("\n\n---\n\n") ?? "";
      return {
        content: [{ type: "text" as const, text: content || "No content extracted" }],
        details: { ...result, urls },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    }
  },
  renderCall: renderExtractCall,
  renderResult: renderExtractResult,
};
