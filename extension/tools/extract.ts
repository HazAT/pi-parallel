import { Type } from "@sinclair/typebox";
import { runCli, type ExtractResult } from "../cli.js";
import { renderExtractCall, renderExtractResult } from "../render.js";

export const extractTool = {
  name: "parallel_extract",
  label: "Parallel Extract",
  description: "Extract clean markdown content from one or more URLs",
  promptSnippet: "Use parallel_extract when you have a specific URL and need its content",
  promptGuidelines: [
    "Call this tool directly as parallel_extract({...}) — do NOT route through the mcp() tool",
    "Use when the user provides a URL and wants its content",
    "Accepts a single URL string or an array of URLs for batch extraction",
    "Use the objective param to focus extraction on specific information (e.g. 'API pricing', 'changelog')",
    "Do NOT use for general searches — use parallel_search when you don't have a specific URL",
    "The extracted content is clean markdown, suitable for further analysis",
  ],
  parameters: Type.Object({
    url: Type.Union([
      Type.String({ description: "URL to extract content from" }),
      Type.Array(Type.String(), { description: "Multiple URLs to extract" }),
    ], { description: "URL or array of URLs to extract content from" }),
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
