# pi-parallel

A [pi](https://github.com/badlogic/pi-mono) extension that gives your agent web intelligence via [parallel.ai](https://parallel.ai). Two tools, zero config once installed — the LLM picks the right one automatically.

| Tool | Use case |
|------|----------|
| `web_search` | Quick web lookups — "what is X", "latest news on Y" |
| `web_fetch` | Pull clean markdown from a URL |

For deeper investigation, the agent composes these itself: `web_search` to find candidates, then `web_fetch` on the best results.

## Setup

### 1. Get a parallel.ai account

Sign up at [parallel.ai](https://parallel.ai), then install and authenticate the CLI:

```bash
npm install -g parallel-web-cli
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

That's it. The two tools are now available to your agent.

## How it works

Each tool wraps `parallel-cli` via `spawn()` with JSON output. Both calls are synchronous — fire the CLI, parse the result, return. A 10s heartbeat ticks the TUI so the user sees progress without burning extra API calls.

The agent decides which tool to use based on `promptGuidelines` baked into each tool registration — no skill file needed.

## License

MIT
