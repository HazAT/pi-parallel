import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export const enrichTool = {
  name: "parallel_enrich",
  label: "Parallel Enrich",
  description: "Enrich structured data in bulk using parallel.ai",
  parameters: Type.Object({
    data: Type.Array(Type.Record(Type.String(), Type.Any()), { description: "Array of objects to enrich" }),
    intent: Type.String({ description: "What fields to add or fill in (e.g. 'add CEO name and HQ city')" }),
  }),
  async execute(_toolCallId: string, _params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
    return { content: [{ type: "text" as const, text: "not implemented" }], details: {} };
  },
} as const;
