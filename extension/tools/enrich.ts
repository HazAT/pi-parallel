import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { runCli, pollEnrich, type EnrichRunResult } from "../cli.js";
import { renderEnrichCall, renderEnrichResult } from "../render.js";

export const enrichTool = {
  name: "parallel_enrich",
  label: "Parallel Enrich",
  description: "Batch-enrich structured data (companies, people, domains) with web-sourced information",
  promptSnippet: "Use parallel_enrich to augment a list of entities with data from the web",
  promptGuidelines: [
    "Use when the user has a structured list (companies, people, domains) and wants to add web data to each item",
    "data should be an array of objects: [{company: 'Anthropic'}, {company: 'OpenAI'}]",
    "instructions is natural language: 'Find the CEO', 'Get founding year and HQ location', 'Find the pricing page URL'",
    "Use parallel_search for general web searches — enrich is specifically for batch structured data augmentation",
    "Results are returned as [{input: {...}, output: {...}}] where output contains the enriched fields",
  ],
  parameters: Type.Object({
    data: Type.Union([
      Type.Array(Type.Record(Type.String(), Type.Any()), { description: "Array of objects to enrich" }),
      Type.String({ description: "CSV string to enrich" }),
    ], { description: "Data to enrich: array of objects or CSV string" }),
    instructions: Type.String({ description: "What data to add, e.g. 'Find the CEO and founding year'" }),
    speed: Type.Optional(StringEnum(["fast", "balanced", "best"] as const, {
      description: "Processing depth (default: fast)",
    })),
  }),
  async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, _ctx: any) {
    const dataFile = path.join(os.tmpdir(), `parallel-enrich-data-${Date.now()}.json`);
    const tmpFile = path.join(os.tmpdir(), `parallel-enrich-target-${Date.now()}.json`);
    try {
      const dataJson = typeof params.data === "string" ? params.data : JSON.stringify(params.data);
      const numItems = Array.isArray(params.data) ? params.data.length : "?";

      // Write data to temp file to avoid OS arg length limits with large datasets
      fs.writeFileSync(dataFile, dataJson, "utf-8");

      const args = [
        "enrich", "run",
        "--source-type", "json",
        "--source", dataFile,
        "--intent", params.instructions,
        "--target", tmpFile,
        "--no-wait", "--json",
      ];
      if (params.speed === "balanced") args.push("--processor", "ultra-fast");
      if (params.speed === "best") args.push("--processor", "ultra");

      const runResult: EnrichRunResult = await runCli(args);

      const { taskgroup_id, num_runs } = runResult;
      onUpdate({
        content: [{ type: "text" as const, text: `📊 Enrichment started · ${num_runs} items · ${taskgroup_id}` }],
        details: { status: "running", taskgroup_id, num_runs },
      });

      const items = await pollEnrich(taskgroup_id, signal, onUpdate, Date.now());
      const summary = items.slice(0, 3).map((item) => {
        const inputStr = Object.entries(item.input).map(([k, v]) => `${k}: ${v}`).join(", ");
        const outputStr = Object.entries(item.output).map(([k, v]) => `${k}: ${v}`).join(", ");
        return `- ${inputStr} → ${outputStr}`;
      }).join("\n");

      return {
        content: [{ type: "text" as const, text: `Enriched ${items.length} items:\n\n${summary}${items.length > 3 ? `\n... and ${items.length - 3} more` : ""}` }],
        details: { items, taskgroup_id, instructions: params.instructions },
      };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: err.message }], details: {}, isError: true };
    } finally {
      try { fs.unlinkSync(dataFile); } catch { /* ignore */ }
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  },
  renderCall: renderEnrichCall,
  renderResult: renderEnrichResult,
};
