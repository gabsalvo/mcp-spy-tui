# mcp-spy-proxy

> Zero-config observability proxy for the Model Context Protocol (MCP).  
> Intercept, inspect, and debug MCP traffic in real time — straight from your terminal.

<!-- SCREENSHOT: run `npx mcp-spy` with no args — shows the welcome/pricing TUI with the big ASCII banner -->
![MCP-SPY Welcome Screen](https://raw.githubusercontent.com/gabsalvo/mcp-spy-tui/main/docs/screenshot-welcome.png)

---

## What it does

`mcp-spy` sits between your MCP client (Claude Desktop, Cursor, etc.) and your MCP server. Every JSON-RPC call passes through it, gets logged to a local SQLite database, and shows up live in a terminal UI.

No config files. No agents. No cloud required.

---

## Install

```bash
npm install -g mcp-spy-proxy
```

Or use it without installing:

```bash
npx mcp-spy-proxy
```

---

## Quick start

**1. Start your MCP server** (example using the official filesystem server):

```bash
npx -y @modelcontextprotocol/server-filesystem \
     --transport sse --port 3001 ~/Documents
```

**2. Start the proxy** pointing at it:

```bash
mcp-spy -t 3001 --name filesystem
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

<!-- SCREENSHOT: run `mcp-spy -t 3001 --name filesystem` after some traffic — shows the full TUI with log list on left and payload inspector on right -->
![MCP-SPY Live TUI](https://raw.githubusercontent.com/gabsalvo/mcp-spy-tui/main/docs/screenshot-tui.png)

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

<!-- SCREENSHOT: press `c` in the TUI — shows the cURL export panel for a selected request -->
![cURL Export View](https://raw.githubusercontent.com/gabsalvo/mcp-spy-tui/main/docs/screenshot-curl.png)

Press `c` on any selected request to get a ready-to-paste `curl` command you can replay in a terminal or import into Postman.

---

## CLI options

```
mcp-spy [options]

Options:
  -t, --target <port>    Target port of the MCP server
  -n, --name <label>     Label for this server (e.g. "filesystem", "github")
  -s, --sync <api_key>   Pro: sync logs to cloud dashboard
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

```
>>> MCP-Spy Proxy
======================================
 [√] Target: port 3001  Label: filesystem
 [!] Cloud Sync Disabled. (Free Tier)
     → Upgrade at https://mcpspy.dev/pricing
 [√] Database ready (WAL mode)
======================================
🚀 MCP-Spy is listening on http://localhost:4000
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

## Pro: Cloud sync

```bash
mcp-spy -t 3001 --sync mcp_live_XXXX...
```

With a Pro API key, every captured call is synced to your [mcpspy.dev](https://mcpspy.dev) dashboard — shareable trace links, full token analytics, and team access.

Get your key at [mcpspy.dev/dashboard](https://mcpspy.dev/dashboard) → Settings.

---

## How it works

```
MCP Client (Claude Desktop, Cursor…)
        │
        ▼  port 4000
  [ mcp-spy proxy ]  ──── logs to SQLite ────► TUI / dashboard
        │
        ▼  port <target>
  MCP Server (@modelcontextprotocol/server-filesystem, etc.)
```

All traffic is intercepted via an HTTP proxy. Request and response payloads are captured, token-estimated, and stored locally in a SQLite database (WAL mode). The TUI polls the database every 1.5s and renders updates live.

---

## License

MIT — [gabsalvo.com](https://gabsalvo.com)
