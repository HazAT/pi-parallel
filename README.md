# pi-parallel

Web intelligence tools for the [pi coding agent](https://github.com/mariozechner/pi-mono) — powered by [parallel.ai](https://parallel.ai).

Exposes four tools the LLM can call natively, with live progress updates and rich TUI rendering:

| Tool | What it does |
|------|-------------|
| `parallel_search` | AI-powered web search with excerpts |
| `parallel_extract` | Extract clean markdown content from URLs |
| `parallel_research` | Deep async research with multi-source synthesis |
| `parallel_enrich` | Batch-enrich structured data from the web |

---

## Prerequisites

1. A [parallel.ai](https://parallel.ai) account
2. `parallel-cli` installed and authenticated:
   ```bash
   npm install -g @parallel-web/cli
   parallel-cli login
   ```

---

## Install

**1. Clone into the pi extensions directory:**
```bash
git clone https://github.com/mariozechner/pi-parallel ~/.pi/agent/extensions/pi-parallel
```

**2. Add to `~/.pi/settings.json`:**
```json
{
  "extensions": [
    "~/.pi/agent/extensions/pi-parallel"
  ]
}
```

If `~/.pi/settings.json` doesn't exist yet, create it with the above content.

**3. Verify the setup:**

Start pi and run:
```
/parallel-setup
```

This checks that `parallel-cli` is installed and authenticated, and lists the available tools.

---

## Tools

### `parallel_search`

AI-powered web search. Returns excerpts from relevant pages.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Natural language search objective or keyword query |
| `maxResults` | number? | Max results to return (default: 10) |
| `afterDate` | string? | Only results after this date (YYYY-MM-DD) |

**Example prompts:**
- *"Search for the latest benchmarks comparing Claude and GPT-4o"*
- *"What are the new features in TypeScript 5.8? Search after 2025-01-01"*

---

### `parallel_extract`

Fetches one or more URLs and returns clean, readable markdown. Use this when you have a specific URL and need its full content — not for general searches.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string \| string[] | URL or array of URLs to extract |
| `objective` | string? | Focus extraction on specific information (e.g. `"pricing"`, `"changelog"`) |

**Example prompts:**
- *"Extract the content from https://docs.anthropic.com/en/api/getting-started"*
- *"Get the pricing information from these three pages: [urls]"*

---

### `parallel_research`

Runs deep, multi-source research asynchronously. Synthesizes findings across many pages into a structured report. Takes 2–10 minutes depending on speed.

| Parameter | Type | Description |
|-----------|------|-------------|
| `topic` | string | Research question or topic |
| `speed` | `fast` \| `balanced` \| `best` | Depth: fast (~2min, default), balanced (~5min, 2× cost), best (~10min, 3× cost) |
| `context` | string? | Additional constraints or framing for the research |

The tool polls automatically and streams progress updates — no need to check status separately.

**Example prompts:**
- *"Research the current state of open-source LLM fine-tuning frameworks"*
- *"Do a deep research on the tradeoffs between RAG and fine-tuning for domain-specific Q&A"*
- *"Research competitors to Vercel for Next.js hosting, speed=balanced"*

---

### `parallel_enrich`

Batch-enriches a list of structured records (companies, people, domains, etc.) with information sourced from the web. Runs asynchronously like research.

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | object[] \| string | Array of objects or CSV string to enrich |
| `instructions` | string | What to find for each record |
| `speed` | `fast` \| `balanced` \| `best` | Processing depth (default: fast) |

**Example prompts:**
- *"Enrich this list of companies with their CEO name and founding year: [{company: 'Stripe'}, {company: 'Linear'}]"*
- *"Find the pricing page URL for each of these SaaS tools: [list]"*

---

## How it works

pi-parallel is a TypeScript pi extension (`extension/index.ts`) that registers four tools and one command with the pi agent. Each tool delegates to `parallel-cli` — the official parallel.ai command-line client — via JSON output mode.

`parallel_search` and `parallel_extract` are synchronous: they call the CLI and return results immediately. `parallel_research` and `parallel_enrich` are asynchronous: they start a run, then poll in a loop until completion, streaming intermediate status updates back to the TUI via `onUpdate`.

---

## License

MIT
