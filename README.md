# pi-parallel

A [pi](https://github.com/badlogic/pi-mono) extension that gives your agent web intelligence via [parallel.ai](https://parallel.ai). Four tools, zero config once installed — the LLM picks the right one automatically.

| Tool | Use case |
|------|----------|
| `parallel_search` | Quick web lookups — "what is X", "latest news on Y" |
| `parallel_extract` | Pull clean markdown from a URL |
| `parallel_research` | Deep async research across many sources (2–10 min) |
| `parallel_enrich` | Augment a list of companies/people/domains with web data |

## Setup

### 1. Get a parallel.ai account

Sign up at [parallel.ai](https://parallel.ai), then install and authenticate the CLI:

```bash
npm install -g @parallel-web/cli
parallel-cli login
```

### 2. Install the extension

```bash
pi install git:github.com/HazAT/pi-parallel
```

Or manually:

```bash
git clone https://github.com/HazAT/pi-parallel ~/.pi/agent/extensions/pi-parallel
```

### 3. Verify

Start pi and run `/parallel-setup`. You should see:

```
✓ parallel-cli 0.1.2 · authenticated via oauth
```

That's it. The four tools are now available to your agent.

## How it works

Each tool wraps `parallel-cli` via `spawn()` with JSON output. Search and extract are synchronous — call the CLI, parse the result, done. Research and enrich are async — they fire a `--no-wait` run to get a job ID, then poll for completion with live progress updates streamed back to the TUI.

The agent decides which tool to use based on `promptGuidelines` baked into each tool registration — no skill file needed.

## License

MIT
