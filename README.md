# pi-parallel

A [pi](https://github.com/badlogic/pi-mono) extension that gives agents web access through the [Parallel](https://parallel.ai) Search and Extract APIs.

| Tool | Use case |
|------|----------|
| `web_search` | Discover sources and find current information |
| `web_fetch` | Fetch clean markdown from known public webpages |

The tools call Parallel's V1 REST API directly. No CLI process, MCP server, or SDK is involved.

## Install

```bash
pi install git:github.com/HazAT/pi-parallel
```

Or clone it manually:

```bash
git clone https://github.com/HazAT/pi-parallel ~/.pi/agent/extensions/pi-parallel
```

## Authentication

The extension shares authentication with `parallel-cli` at:

```text
~/.config/parallel-web-tools/auth.json
```

If you already ran `parallel-cli login`, the extension uses the API key for the CLI's currently selected organization automatically.

Otherwise, start pi and run:

```text
/parallel-setup
```

Paste an API key from [platform.parallel.ai](https://platform.parallel.ai). The key is hidden while entering it and saved to the shared auth file with `0600` permissions. Run the command again to replace the key.

When a tool is called without authentication, it returns a clear error instructing the agent to ask you to run `/parallel-setup`.

## How it works

- `web_search` sends synchronous `POST /v1/search` requests in low-latency Turbo mode with ranked, LLM-optimized excerpts.
- `web_fetch` sends synchronous `POST /v1/extract` requests and reports both successful pages and per-URL failures.
- Requests use the configured key through the `x-api-key` header and support cancellation.
- Tool output is capped at 50KB or 2,000 lines.
- Collapsed tool rows stay compact; expanded rows show page content, warnings, and fetch failures.

The agent chooses between the tools using their built-in descriptions and prompt guidelines. Typical investigation flow is `web_search` to find sources, followed by `web_fetch` for the most relevant pages.

## License

MIT
