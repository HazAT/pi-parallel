import { spawn } from "node:child_process";

// ── Types ────────────────────────────────────────────────────────────────────

export type SearchResult = {
  search_id: string;
  status: string;
  results: SearchItem[];
  warnings: string | null;
};
export type SearchItem = {
  url: string;
  title: string;
  publish_date?: string;
  excerpts: string[];
};

export type ExtractResult = {
  extract_id: string;
  status: string;
  results: ExtractItem[];
  errors: any[];
};
export type ExtractItem = { url: string; title: string; excerpts: string[] };

export type ResearchRunResult = {
  run_id: string;
  result_url: string;
  processor: string;
  status: string;
};
export type ResearchOutput = {
  type: string;
  content: any;
  basis: BasisItem[];
  beta_fields?: any;
  output_schema?: any;
};
export type BasisItem = {
  field: string;
  reasoning: string;
  citations: Citation[];
  confidence: number;
};
export type Citation = { url: string; title: string; excerpts: string[] };
export type ResearchResult = {
  run_id: string;
  result_url: string;
  status: string;
  output: ResearchOutput;
};

export type EnrichRunResult = {
  taskgroup_id: string;
  url: string;
  num_runs: number;
};
export type EnrichItem = {
  input: Record<string, any>;
  output: Record<string, any>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function formatElapsed(startTime: number): string {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ── runCli ───────────────────────────────────────────────────────────────────

export function runCli(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("parallel-cli", args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(stderr || `parallel-cli exited with code ${code}`));
        return;
      }
      // Strip INFO log lines — enrich mixes "2026-03-11 21:53:22,130 - INFO - ..." with JSON
      const cleaned = stdout
        .split("\n")
        .filter((line) => !/^\d{4}-\d{2}-\d{2}/.test(line))
        .join("\n");
      try {
        resolve(JSON.parse(cleaned.trim() || stdout.trim()));
      } catch {
        reject(new Error(`Failed to parse JSON: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if ((err as any).code === "ENOENT") {
        reject(new Error("parallel-cli not found. Run /parallel-setup for install instructions."));
      } else {
        reject(err);
      }
    });
  });
}

// ── Poll helpers ─────────────────────────────────────────────────────────────

type OnUpdateCallback = (partial: {
  content: Array<{ type: "text"; text: string }>;
  details: any;
}) => void;

export async function pollResearch(
  runId: string,
  signal: AbortSignal | undefined,
  onUpdate: OnUpdateCallback,
  startTime: number
): Promise<ResearchResult> {
  while (true) {
    if (signal?.aborted) throw new Error("Aborted");
    await sleep(10_000);
    if (signal?.aborted) throw new Error("Aborted");

    const status = await runCli(["research", "status", runId, "--json"]);
    const elapsed = formatElapsed(startTime);

    onUpdate({
      content: [{ type: "text", text: `⏳ Research running · ${elapsed} · ${status.status}` }],
      details: { status: "running", run_id: runId, elapsed },
    });

    if (status.status === "completed") {
      return runCli(["research", "poll", runId, "--json"]) as Promise<ResearchResult>;
    }
    if (status.status === "failed") {
      throw new Error(`Research failed: ${status.error || "unknown error"}`);
    }
  }
}

export async function pollEnrich(
  taskgroupId: string,
  signal: AbortSignal | undefined,
  onUpdate: OnUpdateCallback,
  startTime: number
): Promise<EnrichItem[]> {
  while (true) {
    if (signal?.aborted) throw new Error("Aborted");
    await sleep(5_000);
    if (signal?.aborted) throw new Error("Aborted");

    const status = await runCli(["enrich", "status", taskgroupId, "--json"]);
    const elapsed = formatElapsed(startTime);

    onUpdate({
      content: [{ type: "text", text: `⏳ Enrich running · ${elapsed} · ${status.status}` }],
      details: { status: "running", taskgroup_id: taskgroupId, elapsed },
    });

    if (status.status === "completed") {
      // enrich poll returns a bare array
      return runCli(["enrich", "poll", taskgroupId, "--json"]) as Promise<EnrichItem[]>;
    }
    if (status.status === "failed") {
      throw new Error(`Enrich failed: ${status.error || "unknown error"}`);
    }
  }
}
