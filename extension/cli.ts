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

const HEARTBEAT_MS = 10_000;
const RESEARCH_POLL_INTERVAL_SECS = 45;
const ENRICH_POLL_INTERVAL_SECS = 15;

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
        // Try to extract error message from stdout JSON (parallel-cli sometimes returns errors on stdout)
        let errorMsg = stderr;
        if (!errorMsg && stdout) {
          try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed?.error?.message) errorMsg = parsed.error.message;
          } catch { /* not JSON, fall through */ }
        }
        reject(new Error(errorMsg || `parallel-cli exited with code ${code}`));
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

export function runCliWithHeartbeat(
  args: string[],
  signal: AbortSignal | undefined,
  onUpdate: OnUpdateCallback | undefined,
  startTime: number,
  getUpdate: (elapsedSecs: number) => {
    content: Array<{ type: "text"; text: string }>;
    details: any;
  },
): Promise<any> {
  return runCliWithProgress(args, signal, (elapsed) => onUpdate?.(getUpdate(elapsed)), startTime);
}

/**
 * Delegates polling to `parallel-cli research poll` which handles its own
 * status checks internally (default: every 45s). A setInterval ticks the
 * elapsed timer in the TUI so the user sees progress without us burning
 * API calls on manual status checks.
 */
export function pollResearch(
  runId: string,
  signal: AbortSignal | undefined,
  onUpdate: OnUpdateCallback,
  startTime: number,
): Promise<ResearchResult> {
  return runCliWithProgress(
    [
      "research", "poll", runId,
      "--timeout", "540",
      "--poll-interval", String(RESEARCH_POLL_INTERVAL_SECS),
      "--json",
    ],
    signal,
    (elapsed) =>
      onUpdate({
        content: [{ type: "text", text: `⏳ Research running · ${formatElapsed(startTime)} · polling` }],
        details: {
          status: "running",
          run_id: runId,
          elapsed,
          poll_interval_seconds: RESEARCH_POLL_INTERVAL_SECS,
        },
      }),
    startTime,
  ) as Promise<ResearchResult>;
}

/**
 * Same approach for enrich — delegates to `parallel-cli enrich poll`.
 */
export function pollEnrich(
  taskgroupId: string,
  signal: AbortSignal | undefined,
  onUpdate: OnUpdateCallback,
  startTime: number,
): Promise<EnrichItem[]> {
  return runCliWithProgress(
    [
      "enrich", "poll", taskgroupId,
      "--timeout", "540",
      "--poll-interval", String(ENRICH_POLL_INTERVAL_SECS),
      "--json",
    ],
    signal,
    (elapsed) =>
      onUpdate({
        content: [{ type: "text", text: `⏳ Enrich running · ${formatElapsed(startTime)} · polling` }],
        details: {
          status: "running",
          taskgroup_id: taskgroupId,
          elapsed,
          poll_interval_seconds: ENRICH_POLL_INTERVAL_SECS,
        },
      }),
    startTime,
  ) as Promise<EnrichItem[]>;
}

/**
 * Spawn a long-running parallel-cli command with a progress ticker.
 * The CLI does its own work internally; we just emit a heartbeat every 10s
 * so the TUI stays alive without extra API calls.
 */
function runCliWithProgress(
  args: string[],
  signal: AbortSignal | undefined,
  tick: (elapsedSecs: number) => void,
  startTime: number,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("parallel-cli", args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    // Tick elapsed every 10s for TUI progress without extra API calls
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      tick(elapsed);
    }, HEARTBEAT_MS);

    proc.on("close", (code: number | null) => {
      clearInterval(timer);
      if (code !== 0) {
        let errorMsg = stderr;
        if (!errorMsg && stdout) {
          try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed?.error?.message) errorMsg = parsed.error.message;
          } catch { /* not JSON */ }
        }
        reject(new Error(errorMsg || `parallel-cli exited with code ${code}`));
        return;
      }
      const cleaned = stdout
        .split("\n")
        .filter((line) => !/^\d{4}-\d{2}-\d{2}/.test(line))
        .join("\n");
      try {
        resolve(JSON.parse(cleaned.trim() || stdout.trim()));
      } catch {
        reject(new Error(`Failed to parse result: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on("error", (err) => {
      clearInterval(timer);
      reject(err);
    });

    // AbortSignal support — kill the process immediately
    if (signal) {
      const killProc = () => {
        clearInterval(timer);
        proc.kill("SIGTERM");
        setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 3000);
      };
      if (signal.aborted) killProc();
      else signal.addEventListener("abort", killProc, { once: true });
    }
  });
}
