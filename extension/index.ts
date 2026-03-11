import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { searchTool } from "./tools/search.js";
import { extractTool } from "./tools/extract.js";
import { researchTool } from "./tools/research.js";
import { enrichTool } from "./tools/enrich.js";

export function activate(pi: ExtensionAPI) {
  pi.registerTool(searchTool);
  pi.registerTool(extractTool);
  pi.registerTool(researchTool);
  pi.registerTool(enrichTool);

  pi.registerCommand("parallel-setup", {
    description: "Check parallel-cli installation and authentication status",
    handler: async (_args: string[], ctx: any) => {
      ctx.ui.notify("Setup check coming soon", "info");
    },
  });
}
