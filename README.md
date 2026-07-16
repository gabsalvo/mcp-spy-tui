# mcp-spy

> Free & open-source observability proxy for the Model Context Protocol (MCP).
> Intercept, inspect, and debug MCP traffic in real time — straight from your terminal.

Browser devtools, but for AI tool calls. No account. No cloud. No telemetry.

![mcp-spy — run npx mcp-spy for a guided setup](https://raw.githubusercontent.com/gabsalvo/mcp-spy-tui/main/docs/screenshot-welcome.png)

---

## What it does

`mcp-spy` sits between your MCP client (Claude Desktop, Cursor, etc.) and your MCP server. Every JSON-RPC call passes through it, gets logged to a local SQLite database, and shows up live in a terminal UI.

No config files. No agents. Everything stays on your machine.

---

## Install

```bash
npm install -g mcp-spy
```

Or use it without installing:

```bash
npx mcp-spy
```

Running it with no arguments opens a guided 4-step setup.

---

## Quick start

**1. Start your MCP server** (example using the official filesystem server):

```bash
npx -y @modelcontextprotocol/server-filesystem \
     --transport sse --port 3001 ~/Documents
```

**2. Start the proxy** pointing at it:

```bash
npx mcp-spy -t 3001 --name filesystem
```

**3. Point your MCP client at the proxy** (port `4000`) instead of the server directly.

For Claude Desktop, edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "url": "http://localhost:4000"
    }
  }
}
```

> Use `"url"`, not `"command"/"args"` — that bypasses the proxy.

Now make a request in your client and watch traffic appear live.

---

## Terminal UI

![mcp-spy live TUI](https://raw.githubusercontent.com/gabsalvo/mcp-spy-tui/main/docs/screenshot-tui.png)

The TUI has two panels:

- **Left** — live request log with time, server label, method, status, duration, and token count
- **Right** — full payload inspector for the selected request (request + response JSON)

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate log entries |
| `s` | Cycle server filter |
| `c` | Toggle cURL export view |
| `q` | Quit |

### cURL export

![cURL export view](https://raw.githubusercontent.com/gabsalvo/mcp-spy-tui/main/docs/screenshot-curl.png)

Press `c` on any selected request to get a ready-to-paste `curl` command you can replay in a terminal or import into Postman.

---

## CLI options

```
mcp-spy [options]

Options:
  -t, --target <port>    Target port of the MCP server
  -n, --name <label>     Label for this server (e.g. "filesystem", "github")
  --redact-pii           Auto-redact secrets (AWS keys, tokens, emails) before saving
  --mock                 Mock mode: return saved responses instead of forwarding
  --no-tui               Disable TUI, use plain console output
  -V, --version          Output version number
  -h, --help             Display help
```

### Plain output mode (`--no-tui`)

Useful for CI or headless environments:

```bash
mcp-spy -t 3001 --name filesystem --no-tui
```

---

## Mock mode

Replay saved responses without hitting the real server — useful for offline development or testing:

```bash
mcp-spy -t 3001 --mock
```

Once you've captured real traffic, `--mock` will return the last saved response for each method instead of forwarding the request.

---

## Replay & test

Replay captured requests against a target and assert valid JSON-RPC responses:

```bash
mcp-spy test -t 3001
mcp-spy test -t 3001 --method tools/call --count 5
mcp-spy test -t 3001 --name filesystem --timeout 3000
```

---

## PII redaction

Auto-scrub secrets from logs before they hit the database:

```bash
mcp-spy -t 3001 --redact-pii
```

Detects and redacts AWS keys, bearer tokens, emails, and other common secret patterns. Redacted entries are marked with 🔒 in the TUI.

---

## How it works

```
MCP Client (Claude Desktop, Cursor…)
        │
        ▼  port 4000
  [ mcp-spy proxy ]  ──── logs to SQLite ────► TUI
        │
        ▼  port <target>
  MCP Server (@modelcontextprotocol/server-filesystem, etc.)
```

All traffic is intercepted via an HTTP proxy. Request and response payloads are captured, token-estimated, and stored locally in a SQLite database (WAL mode) at `~/.mcp-spy/mcp_logs.db`. The TUI polls the database every 1.5s and renders updates live.

---

## Links

- Docs: [mcpspy.dev/docs](https://mcpspy.dev/docs)
- Website source: [github.com/gabsalvo/mcpspy.dev](https://github.com/gabsalvo/mcpspy.dev)

## License

MIT — [gabsalvo.com](https://gabsalvo.com)
