import { Type } from "@sinclair/typebox";
import { runCli, type SearchResult } from "../cli.js";
import { renderSearchCall, renderSearchResult } from "../render.js";

export const searchTool = {
  name: "parallel_search",
  label: "Parallel Search",
  description: "Search the public web using parallel.ai's AI-powered search engine to find pages, articles, documentation, and other online resources matching a natural language query. Returns a ranked list of results with titles, URLs, publish dates, and relevant text excerpts from each page. Use this when you need to discover information, find specific pages, look up facts, or locate documentation — essentially any time you'd use a search engine. Do NOT use this when you already have a specific URL to fetch (use curl/bash instead), and prefer parallel_research over this tool when the question requires synthesizing information across many sources into a cohesive answer rather than just finding relevant pages.",
  promptSnippet: "Search the public web for pages, articles, and docs. Not for fetching known URLs (use curl/bash) or deep synthesis (use parallel_research).",
  promptGuidelines: [
    "Call this tool directly as parallel_search({...}) — do NOT route through the mcp() tool",
    "Use for web discovery: 'what is X', 'latest news on Y', 'find docs for Z', 'how does W work'",
    "Do NOT use when you already have a specific URL — use curl or bash instead (raw GitHub URLs, API endpoints, localhost)",
    "Use parallel_research instead when the answer requires synthesis across many sources, not just finding pages",
    "Use afterDate to scope results to recent content (e.g. news, releases, changelogs)",
    "Returns excerpts — if you need the full content of a found page, follow up with parallel_extract",
  ],
  parameters: Type.Object({
    query: Type.String({ description: "The search query — can be natural language ('how to deploy Next.js on Vercel') or keywords ('Next.js Vercel deployment guide'). More specific queries yield more relevant results." }),
    maxResults: Type.Optional(Type.Number({ description: "Maximum number of results to return. Defaults to 10. Lower values (3-5) are faster for quick lookups; higher values (15-20) are better when you need breadth." })),
    afterDate: Type.Optional(Type.String({ description: "Filter to results published after this date in YYYY-MM-DD format. Useful for finding recent releases, news, or ensuring up-to-date information." })),
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
        details: {
          query: params.query,
          search_id: result.search_id,
          status: result.status,
          results: result.results?.map((r: any) => ({
            url: r.url,
            title: r.title,
            publish_date: r.publish_date,
            excerpts: r.excerpts?.slice(0, 2),
          })),
        },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    }
  },
  renderCall: renderSearchCall,
  renderResult: renderSearchResult,
};
