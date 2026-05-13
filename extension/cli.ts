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

// ── Helpers ──────────────────────────────────────────────────────────────────

const HEARTBEAT_MS = 10_000;

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
      // Strip INFO log lines that parallel-cli sometimes mixes with JSON
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

// ── Progress wrapper ─────────────────────────────────────────────────────────

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
 * Spawn a parallel-cli command with a TUI heartbeat ticker. The CLI does its
 * own work; we just emit a progress tick every 10s so the TUI stays alive
 * without extra API calls.
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
