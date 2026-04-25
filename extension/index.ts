import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { searchTool } from "./tools/search.js";
import { extractTool } from "./tools/extract.js";
import { researchTool } from "./tools/research.js";
import { enrichTool } from "./tools/enrich.js";
import { runCli } from "./cli.js";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  pi.registerTool(searchTool);
  pi.registerTool(extractTool);
  pi.registerTool(researchTool);
  pi.registerTool(enrichTool);

  pi.registerCommand("parallel-setup", {
    description: "Check parallel-cli installation and authentication status",
    handler: async (_args: string[], ctx: any) => {
      // 1. Check if parallel-cli is installed
      let version: string | null = null;
      try {
        version = execSync("parallel-cli --version", { encoding: "utf-8" }).trim();
      } catch {
        ctx.ui.notify(
          "✗ parallel-cli not found\n\nInstall it:\n  npm install -g parallel-web-cli\n\nThen authenticate:\n  parallel-cli login",
          "error"
        );
        return;
      }

      // 2. Check authentication
      try {
        const auth = await runCli(["auth", "--json"]) as {
          authenticated: boolean;
          method: string;
          token_file: string;
        };

        if (auth.authenticated) {
          ctx.ui.notify(`✓ parallel-cli ${version} · authenticated via ${auth.method}`, "success");
        } else {
          ctx.ui.notify(
            `✗ parallel-cli ${version} found but not authenticated\n\nRun: parallel-cli login`,
            "warning"
          );
        }
      } catch {
        ctx.ui.notify(
          `✗ parallel-cli ${version} found but auth check failed\n\nRun: parallel-cli login`,
          "warning"
        );
      }

      // 3. Print tool summary
      ctx.ui.notify(
        "Available tools:\n" +
        "  web_search    — web search with excerpts\n" +
        "  web_fetch     — fetch content from URLs\n" +
        "  deep_research — deep async AI research\n" +
        "  batch_enrich  — batch data enrichment",
        "info"
      );
    },
  });
}
