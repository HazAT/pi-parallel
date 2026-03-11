import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export const searchTool = {
  name: "parallel_search",
  label: "Parallel Search",
  description: "Search the web using parallel.ai",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
    max_results: Type.Optional(Type.Number({ description: "Maximum results to return (default: 10)", default: 10 })),
  }),
  async execute(_toolCallId: string, _params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
    return { content: [{ type: "text" as const, text: "not implemented" }], details: {} };
  },
} as const;
