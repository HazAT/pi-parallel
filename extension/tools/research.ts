import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { runCli, pollResearch, type ResearchRunResult } from "../cli.js";
import { renderResearchCall, renderResearchResult, formatResearchContent } from "../render.js";

const SPEED_TO_PROCESSOR: Record<string, string> = {
  fast: "base-fast",
  balanced: "pro-fast",
  best: "ultra",
};

export const researchTool = {
  name: "deep_research",
  label: "Deep Research",
  description: "Run an asynchronous deep-research job on a topic using parallel.ai, which searches the web, reads multiple sources, and synthesizes findings into a structured markdown report with cited sources. Unlike web_search (which returns a list of pages), this tool reads and reasons across many sources to produce a cohesive answer. The tool starts a research job, polls for completion automatically, and returns the full synthesized report with source citations. Use this for open-ended questions that require cross-source synthesis: 'what are the tradeoffs of X vs Y', 'current state of Z', 'comprehensive overview of W'. Use web_search instead for quick factual lookups or when you just need to find a specific page. The speed parameter controls depth: fast (default) is cheap and usually sufficient, best produces a thorough report but takes significantly longer.",
  promptSnippet: "Deep async research that synthesizes across many sources into a cited report. Use fast (default) for most questions, best for comprehensive reports.",
  promptGuidelines: [
    "Call this tool directly as deep_research({...}) — do NOT route through the mcp() tool",
    "Use for synthesis questions: 'explain the current state of X', 'tradeoffs of Y vs Z', 'comprehensive overview of W'",
    "Use web_search instead for quick factual lookups or finding specific pages",
    "Do not fan out multiple deep_research calls for sub-questions unless the user explicitly asked for that cost/depth — prefer a few searches or one synthesis run",
    "speed=fast (default) is right for almost everything — quick, cheap, good enough",
    "speed=best only when the user explicitly needs maximum depth or a comprehensive report",
    "The tool polls automatically and streams progress updates — no manual status checks needed",
  ],
  parameters: Type.Object({
    topic: Type.String({ description: "The research question or topic to investigate. Be specific — 'what are the performance tradeoffs of SQLite vs PostgreSQL for read-heavy web apps' yields better results than just 'SQLite vs PostgreSQL'. The more focused the question, the more relevant the synthesis." }),
    speed: Type.Optional(StringEnum(["fast", "balanced", "best"] as const, {
      description: "Controls research depth and cost. 'fast' (default): quick synthesis, usually 15-30s, sufficient for most questions. 'best': thorough multi-source report, can take 1-3 minutes, use only when comprehensive depth is needed. 'balanced': middle ground, rarely the right choice — prefer fast or best.",
    })),
    context: Type.Optional(Type.String({ description: "Additional context prepended to the topic to constrain or focus the research. For example, 'We are building a TypeScript CLI tool' helps the researcher tailor findings to your specific situation." })),
  }),
  async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, _ctx: any) {
    try {
      const processor = SPEED_TO_PROCESSOR[params.speed ?? "fast"] ?? "pro-fast";
      const topic = params.context ? `${params.context}\n\n${params.topic}` : params.topic;

      const runResult: ResearchRunResult = await runCli([
        "research", "run", topic, "--processor", processor, "--no-wait", "--json",
      ]);

      const { run_id } = runResult;
      const startTime = Date.now();
      onUpdate({
        content: [{ type: "text" as const, text: `🔍 Research started · ${run_id} · ${processor}` }],
        details: { status: "running", run_id, processor, poll_interval_seconds: 45 },
      });

      const result = await pollResearch(run_id, signal, onUpdate, startTime);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const text = formatResearchContent(result.output);

      return {
        content: [{ type: "text" as const, text }],
        details: {
          run_id: result.run_id,
          status: result.status,
          output: result.output,
          processor,
          query: params.topic,
          elapsed,
        },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    }
  },
  renderCall: renderResearchCall,
  renderResult: renderResearchResult,
};
