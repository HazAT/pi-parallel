import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { runCli, type SearchResult } from "../cli.js";
import { renderSearchCall, renderSearchResult } from "../render.js";

export const searchTool = {
  name: "parallel_search",
  label: "Parallel Search",
  description: "Search the web using parallel.ai's AI-powered search",
  promptSnippet: "Use parallel_search for web searches and looking up current information",
  promptGuidelines: [
    "Use for quick web searches: 'what is X', 'latest news on Y', 'how does Z work'",
    "Use parallel_research instead for deep open-ended questions requiring synthesis across many sources",
    "afterDate param is useful for finding recent events or news (format: YYYY-MM-DD)",
    "Returns excerpts from web pages — use parallel_extract if you need full page content from a specific URL",
  ],
  parameters: Type.Object({
    query: Type.String({ description: "Natural language search objective or keyword query" }),
    maxResults: Type.Optional(Type.Number({ description: "Max results (default: 10)" })),
    afterDate: Type.Optional(Type.String({ description: "Only results after this date (YYYY-MM-DD)" })),
  }),
  async execute(_toolCallId: string, params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
    try {
      const args = ["search", params.query, "--max-results", String(params.maxResults ?? 10), "--json"];
      if (params.afterDate) args.push("--after-date", params.afterDate);
      const result: SearchResult = await runCli(args);
      const count = result.results?.length ?? 0;
      const summary = result.results?.slice(0, 3).map((r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.excerpts?.[0]?.slice(0, 150) ?? ""}`
      ).join("\n\n") ?? "";
      return {
        content: [{ type: "text" as const, text: `Found ${count} results for: "${params.query}"\n\n${summary}` }],
        details: { ...result, query: params.query },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    }
  },
  renderCall: renderSearchCall,
  renderResult: renderSearchResult,
};
