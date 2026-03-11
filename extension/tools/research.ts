import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { runCli, pollResearch, type ResearchRunResult } from "../cli.js";
import { renderResearchCall, renderResearchResult, formatResearchContent } from "../render.js";

const SPEED_TO_PROCESSOR: Record<string, string> = {
  fast: "pro-fast",
  balanced: "ultra-fast",
  best: "ultra",
};

export const researchTool = {
  name: "parallel_research",
  label: "Parallel Research",
  description: "Run deep async research on a topic using parallel.ai — synthesizes information across many sources",
  promptSnippet: "Use parallel_research for deep open-ended questions requiring synthesis. It runs asynchronously and takes 2-10 minutes.",
  promptGuidelines: [
    "Use for deep research: 'explain the current state of X', 'what are the tradeoffs of Y', 'comprehensive overview of Z'",
    "Use parallel_search instead for quick factual lookups or finding specific pages",
    "speed=fast (default, ~2min) is sufficient for most questions",
    "speed=balanced (~5min, 2x cost) for more thorough technical analysis",
    "speed=best (~10min, 3x cost) only for critical research needing maximum depth",
    "The tool polls automatically — you don't need to check status separately",
  ],
  parameters: Type.Object({
    topic: Type.String({ description: "Research question or topic" }),
    speed: Type.Optional(StringEnum(["fast", "balanced", "best"] as const, {
      description: "Depth: fast (~2min, default), balanced (~5min, 2x cost), best (~10min, 3x cost)",
    })),
    context: Type.Optional(Type.String({ description: "Additional context or constraints for the research" })),
  }),
  async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, _ctx: any) {
    try {
      const processor = SPEED_TO_PROCESSOR[params.speed ?? "fast"] ?? "pro-fast";
      const topic = params.context ? `${params.context}\n\n${params.topic}` : params.topic;

      const runResult: ResearchRunResult = await runCli([
        "research", "run", topic, "--processor", processor, "--no-wait", "--json",
      ]);

      const { run_id } = runResult;
      onUpdate({
        content: [{ type: "text" as const, text: `🔍 Research started · ${run_id} · ${processor}` }],
        details: { status: "running", run_id, processor },
      });

      const result = await pollResearch(run_id, signal, onUpdate, Date.now());
      const text = formatResearchContent(result.output);

      return {
        content: [{ type: "text" as const, text }],
        details: { ...result, processor, query: params.topic },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    }
  },
  renderCall: renderResearchCall,
  renderResult: renderResearchResult,
};
