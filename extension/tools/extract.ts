import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export const extractTool = {
  name: "parallel_extract",
  label: "Parallel Extract",
  description: "Extract full content from one or more URLs using parallel.ai",
  parameters: Type.Object({
    urls: Type.Array(Type.String({ description: "URL to extract" }), { description: "List of URLs to extract content from" }),
  }),
  async execute(_toolCallId: string, _params: any, _signal: AbortSignal | undefined, _onUpdate: any, _ctx: any) {
    return { content: [{ type: "text" as const, text: "not implemented" }], details: {} };
  },
} as const;
