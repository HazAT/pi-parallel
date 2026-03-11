# pi-parallel

> A pi coding agent extension that brings [parallel.ai](https://parallel.ai) research and enrichment tools directly into your AI coding sessions.

## Prerequisites

- [pi](https://github.com/mariozechner/pi-coding-agent) installed
- `parallel-cli` authenticated (`parallel-cli auth`)

## Install

```bash
# Clone and register the extension
git clone https://github.com/mariozechner/pi-parallel
pi extension add /path/to/pi-parallel/extension/index.ts
```

## Tools

| Tool | Command | Description |
|------|---------|-------------|
| `parallel_search` | — | Search the web using parallel.ai |
| `parallel_extract` | — | Extract full content from URLs |
| `parallel_research` | — | Deep research on any topic |
| `parallel_enrich` | — | Enrich structured data in bulk |

## Commands

| Command | Description |
|---------|-------------|
| `/parallel-setup` | Check parallel-cli installation and auth status |

## Verify

```bash
# In a pi session, ask Claude to run a quick search
parallel_search query="test"
```
