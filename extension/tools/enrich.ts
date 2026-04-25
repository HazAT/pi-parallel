import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { runCli, pollEnrich, type EnrichRunResult } from "../cli.js";
import { renderEnrichCall, renderEnrichResult } from "../render.js";

const SPEED_TO_PROCESSOR: Record<string, string> = {
  fast: "base-fast",
  balanced: "pro-fast",
  best: "ultra",
};

export const enrichTool = {
  name: "batch_enrich",
  label: "Batch Enrich",
  description: "Batch-enrich a list of structured entities (companies, people, domains, products, etc.) by looking up web-sourced information for each item concurrently using parallel.ai. Takes an array of objects (or CSV string) as input data and natural language instructions describing what to find, then returns each input row augmented with the requested fields. For example, given [{company: 'Anthropic'}, {company: 'OpenAI'}] with instructions 'Find the CEO and founding year', returns [{input: {company: 'Anthropic'}, output: {ceo: 'Dario Amodei', founding_year: 2021}}, ...]. The tool runs asynchronously, polling for completion automatically. Use this for batch data augmentation tasks — not for general web searches (use web_search) or single-entity lookups (use web_search or deep_research instead).",
  promptSnippet: "Batch-enrich a list of entities (companies, people, domains) with web-sourced data. Not for single lookups (use web_search).",
  promptGuidelines: [
    "Call this tool directly as batch_enrich({...}) — do NOT route through the mcp() tool",
    "Use when the user has a list of entities and wants to add the same type of information to each one",
    "data: array of objects with consistent keys, e.g. [{company: 'Anthropic'}, {company: 'OpenAI'}]",
    "instructions: natural language describing what to find, e.g. 'Find the CEO and founding year'",
    "Use web_search for one-off lookups — batch_enrich is for batch augmentation of multiple entities",
    "Results: [{input: {...}, output: {...}}] where output contains the enriched fields",
  ],
  parameters: Type.Object({
    data: Type.Any({ description: "The entities to enrich. Pass an array of objects with consistent keys (e.g. [{company: 'Anthropic'}, {company: 'OpenAI'}]) or a CSV string. Each object represents one entity to look up. Keep keys simple and descriptive — they help the enrichment engine understand what it's looking at." }),
    instructions: Type.String({ description: "Natural language description of what data to find for each entity. Be specific about the fields you want: 'Find the CEO name, founding year, and headquarters city' works better than just 'Find information'. The instructions apply uniformly to every item in the data array." }),
    speed: Type.Optional(StringEnum(["fast", "balanced", "best"] as const, {
      description: "Controls lookup depth per entity. 'fast' (default): quick lookups, good for well-known entities. 'best': deeper research per entity, better for obscure items. 'balanced': middle ground.",
    })),
  }),
  async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, _ctx: any) {
    const tmpFile = path.join(os.tmpdir(), `parallel-enrich-target-${Date.now()}.json`);
    try {
      const dataJson = typeof params.data === "string" ? params.data : JSON.stringify(params.data);
      const numItems = Array.isArray(params.data) ? params.data.length : "?";

      const args = [
        "enrich", "run",
        "--data", dataJson,
        "--intent", params.instructions,
        "--target", tmpFile,
        "--processor", SPEED_TO_PROCESSOR[params.speed ?? "fast"] ?? "base-fast",
        "--no-wait", "--json",
      ];

      const runResult: EnrichRunResult = await runCli(args);

      const { taskgroup_id, num_runs } = runResult;
      onUpdate({
        content: [{ type: "text" as const, text: `📊 Enrichment started · ${num_runs} items · ${taskgroup_id}` }],
        details: { status: "running", taskgroup_id, num_runs, poll_interval_seconds: 15 },
      });

      const startTime = Date.now();
      const items = await pollEnrich(taskgroup_id, signal, onUpdate, startTime);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const summary = items.slice(0, 3).map((item) => {
        const inputStr = Object.entries(item.input).map(([k, v]) => `${k}: ${v}`).join(", ");
        const outputStr = Object.entries(item.output).map(([k, v]) => `${k}: ${v}`).join(", ");
        return `- ${inputStr} → ${outputStr}`;
      }).join("\n");

      return {
        content: [{ type: "text" as const, text: `Enriched ${items.length} items:\n\n${summary}${items.length > 3 ? `\n... and ${items.length - 3} more` : ""}` }],
        details: { items, taskgroup_id, instructions: params.instructions, elapsed },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  },
  renderCall: renderEnrichCall,
  renderResult: renderEnrichResult,
};
