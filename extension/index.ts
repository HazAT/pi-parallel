import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { Input, truncateToWidth, type Component, type Focusable, type TUI } from "@mariozechner/pi-tui";
import { getApiKey, getAuthPath, saveApiKey } from "./config.js";
import { extractTool } from "./tools/extract.js";
import { searchTool } from "./tools/search.js";

class MaskedInput extends Input {
  override render(width: number): string[] {
    const value = this.getValue();
    this.setValue("•".repeat(value.length));
    const lines = super.render(width);
    this.setValue(value);
    return lines;
  }
}

class ApiKeyPrompt implements Component, Focusable {
  private readonly input = new MaskedInput();

  get focused(): boolean {
    return this.input.focused;
  }

  set focused(value: boolean) {
    this.input.focused = value;
  }

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    replacing: boolean,
    done: (value: string | undefined) => void,
  ) {
    this.input.onSubmit = (value) => done(value);
    this.input.onEscape = () => done(undefined);
    this.replacing = replacing;
  }

  private readonly replacing: boolean;

  handleInput(data: string): void {
    this.input.handleInput(data);
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const title = this.replacing ? "Replace Parallel API key" : "Configure Parallel API key";
    return [
      truncateToWidth(this.theme.fg("accent", this.theme.bold(title)), width),
      truncateToWidth(this.theme.fg("muted", "Paste the key from https://platform.parallel.ai and press Enter."), width),
      ...this.input.render(width),
      truncateToWidth(this.theme.fg("dim", "The key is hidden while typing · Escape to cancel"), width),
    ];
  }

  invalidate(): void {
    this.input.invalidate();
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool(searchTool);
  pi.registerTool(extractTool);

  pi.registerCommand("parallel-setup", {
    description: "Configure the Parallel API key used by web_search and web_fetch",
    handler: async (_args, ctx) => {
      const mode = (ctx as typeof ctx & { mode?: string }).mode;
      if (!ctx.hasUI || (mode !== undefined && mode !== "tui")) {
        ctx.ui.notify("/parallel-setup requires pi's interactive TUI.", "error");
        return;
      }

      let replacing = false;
      try {
        replacing = Boolean(await getApiKey());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(message, "error");
        return;
      }

      const apiKey = await ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) =>
        new ApiKeyPrompt(tui, theme, replacing, done));

      if (apiKey === undefined) {
        ctx.ui.notify("Parallel setup cancelled; existing authentication was not changed.", "info");
        return;
      }
      if (!apiKey.trim()) {
        ctx.ui.notify("Parallel API key cannot be empty; existing authentication was not changed.", "warning");
        return;
      }

      try {
        await saveApiKey(apiKey);
        ctx.ui.notify(
          `Parallel API key saved to ${getAuthPath()}. web_search and web_fetch are ready.`,
          "info",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Could not save Parallel API key: ${message}`, "error");
      }
    },
  });
}
