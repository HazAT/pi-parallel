import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export const researchTool = {
  name: "parallel_research",
  label: "Parallel Research",
  description: "Run deep research on any topic using parallel.ai",
  parameters: Type.Object({
    topic: Type.String({ description: "Research topic or question" }),
    speed: Type.Optional(Type.String({ description: "Speed tier: fast (default), balanced, best", default: "fast" })),
  }),
  async execute(_toolCallId: string, _params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
    return { content: [{ type: "text" as const, text: "not implemented" }], details: {} };
  },
} as const;
