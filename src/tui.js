import React, { useState, useEffect, createElement as h } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { execSync } from 'child_process';
import db from './db.js';
import { toCurl } from './export.js';
import { fmtTokens } from './tokens.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function statusColor(code) {
  if (code >= 500) return 'red';
  if (code >= 400) return 'yellow';
  return 'greenBright';
}

function durationColor(ms) {
  if (ms > 1000) return 'red';
  if (ms > 300) return 'yellow';
  return 'greenBright';
}

function truncate(str, len) {
  if (!str) return '';
  const s = typeof str === 'string' ? str : JSON.stringify(str);
  return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

function getUniqueServers(logs) {
  const seen = new Set();
  for (const l of logs) if (l.server_name) seen.add(l.server_name);
  return ['all', ...seen];
}

// ── ASCII Banner ───────────────────────────────────────────────────────────

// MCP-SPY in block letters, 5-line tall
const BANNER_LINES = [
  ' ███╗   ███╗ ██████╗██████╗      ███████╗██████╗ ██╗   ██╗',
  ' ████╗ ████║██╔════╝██╔══██╗     ██╔════╝██╔══██╗╚██╗ ██╔╝',
  ' ██╔████╔██║██║     ██████╔╝     ███████╗██████╔╝ ╚████╔╝ ',
  ' ██║╚██╔╝██║██║     ██╔═══╝      ╚════██║██╔═══╝   ╚██╔╝  ',
  ' ██║ ╚═╝ ██║╚██████╗██║          ███████║██║        ██║   ',
  ' ╚═╝     ╚═╝ ╚═════╝╚═╝          ╚══════╝╚═╝        ╚═╝   ',
];

// Gradient-ish: cyan → blue across the banner lines
const BANNER_COLORS = ['cyanBright', 'cyanBright', 'cyan', 'blueBright', 'blueBright', 'blue'];

function Banner() {
  return h(Box, { flexDirection: 'column', alignItems: 'center', marginBottom: 1 },
    ...BANNER_LINES.map((line, i) =>
      h(Text, { key: i, color: BANNER_COLORS[i], bold: true }, line)
    ),
    h(Box, { gap: 4, marginTop: 0 },
      h(Text, { color: 'gray' }, '  mcpspy.dev'),
      h(Text, { color: 'gray' }, '·'),
      h(Text, { color: 'gray' }, 'by gabsalvo.com'),
      h(Text, { color: 'gray' }, '·'),
      h(Text, { color: 'gray' }, 'The MCP Observability Proxy'),
    )
  );
}

// ── Subscription Screen ────────────────────────────────────────────────────

function SubscriptionScreen({ onAccept, onDecline }) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) exit();
    if (input === 'y' || key.return) onAccept();
    if (input === 'n' || key.escape) onDecline();
  });

  return h(Box, { flexDirection: 'column', padding: 2, gap: 1 },
    h(Banner, null),

    h(Box, { borderStyle: 'round', borderColor: 'cyanBright', paddingX: 3, paddingY: 1, flexDirection: 'column', gap: 1 },
      h(Text, { bold: true, color: 'cyanBright' }, '  Welcome to MCP-SPY Pro  '),
      h(Text, { color: 'gray' }, '─────────────────────────────────────────────────────────────'),
      h(Text, { color: 'white' }, 'The TUI is part of the Pro tier — here\'s what you unlock:'),
      h(Text, null),
      h(Box, { flexDirection: 'column', gap: 0, paddingLeft: 2 },
        h(Text, null, h(Text, { color: 'greenBright' }, '  ✓ '), h(Text, { color: 'white' }, 'Real-time TUI — watch live MCP traffic as it happens')),
        h(Text, null, h(Text, { color: 'greenBright' }, '  ✓ '), h(Text, { color: 'white' }, 'Cloud Sync — every call saved to your web dashboard')),
        h(Text, null, h(Text, { color: 'greenBright' }, '  ✓ '), h(Text, { color: 'white' }, 'Shareable trace permalinks — send a URL, not a screenshot')),
        h(Text, null, h(Text, { color: 'greenBright' }, '  ✓ '), h(Text, { color: 'white' }, 'Token profiling — see which tool calls eat your context window')),
        h(Text, null, h(Text, { color: 'greenBright' }, '  ✓ '), h(Text, { color: 'white' }, 'PII auto-redaction & Mock mode for safe CI pipelines')),
        h(Text, null, h(Text, { color: 'greenBright' }, '  ✓ '), h(Text, { color: 'white' }, 'cURL / Postman export from any captured request')),
      ),
      h(Text, null),
      h(Box, { gap: 2 },
        h(Text, { color: 'gray' }, '  Price:'),
        h(Text, { color: 'white', bold: true }, '$12.50/mo'),
        h(Text, { color: 'gray' }, 'billed annually  ·  $15/mo monthly'),
      ),
    ),

    h(Box, { borderStyle: 'round', borderColor: 'blue', paddingX: 3, paddingY: 1, flexDirection: 'column', gap: 0 },
      h(Text, null,
        h(Text, { color: 'white' }, '  → '),
        h(Text, { bold: true, color: 'cyanBright' }, '[Y] '),
        h(Text, { color: 'white' }, 'Open '),
        h(Text, { color: 'cyanBright', bold: true }, 'mcpspy.dev/pricing'),
        h(Text, { color: 'white' }, ' in your browser'),
      ),
      h(Text, null,
        h(Text, { color: 'white' }, '  → '),
        h(Text, { bold: true, color: 'yellow' }, '[N] '),
        h(Text, { color: 'white' }, 'Skip for now — run the guided setup instead'),
      ),
      h(Text, null,
        h(Text, { color: 'white' }, '  → '),
        h(Text, { bold: true, color: 'gray' }, '[Q] '),
        h(Text, { color: 'gray' }, 'Quit'),
      ),
    ),
  );
}

// ── Guided Setup Wizard ────────────────────────────────────────────────────

const SETUP_STEPS = [
  {
    title: 'Step 1 — Install the Filesystem MCP Server',
    color: 'cyanBright',
    content: [
      "We'll use Anthropic's official @modelcontextprotocol/server-filesystem.",
      "It gives any MCP client (Claude Desktop, Cursor, etc.) access to a local directory.",
      '',
      'Run this in a new terminal:',
      '',
      '  npx -y @modelcontextprotocol/server-filesystem \\',
      '       --transport sse --port 3001 ~/Documents',
      '',
      'This starts the MCP server on port 3001 over HTTP/SSE.',
      'Leave that terminal running, then come back here.',
    ],
  },
  {
    title: 'Step 2 — Run MCP-SPY as your proxy',
    color: 'blueBright',
    content: [
      'MCP-SPY sits between your client and the MCP server.',
      'All traffic flows through port 4000 → port 3001.',
      '',
      'Open another terminal and run:',
      '',
      '  npx mcp-spy -t 3001 --name filesystem',
      '',
      'Or with cloud sync (Pro):',
      '',
      '  npx mcp-spy -t 3001 --name filesystem --sync mcp_live_XXXX...',
      '',
      'Your API key is at: mcpspy.dev/dashboard → Settings',
    ],
  },
  {
    title: 'Step 3 — Point Claude Desktop at the proxy',
    color: 'magentaBright',
    content: [
      'The server is already running (step 1). The proxy is running (step 2).',
      'Now tell Claude Desktop to connect to the PROXY (port 4000),',
      'NOT the server directly (port 3001).',
      '',
      'Edit your Claude Desktop config file:',
      '  macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json',
      '  Windows: %APPDATA%\\Claude\\claude_desktop_config.json',
      '',
      'Add this (use "url" — not "command"):',
      '',
      '  {',
      '    "mcpServers": {',
      '      "filesystem": {',
      '        "url": "http://localhost:4000"',
      '      }',
      '    }',
      '  }',
      '',
      'Save, then fully quit and relaunch Claude Desktop.',
      'Do NOT use "command"/"args" here — that bypasses the proxy.',
    ],
  },
  {
    title: 'Step 4 — Make a request & watch traffic',
    color: 'greenBright',
    content: [
      'In Claude Desktop (or any MCP client), ask something like:',
      '',
      '  "List the files in my Documents folder"',
      '',
      'You\'ll see the tools/list and tools/call payloads appear',
      'live in the MCP-SPY TUI as they happen.',
      '',
      'TUI keyboard shortcuts:',
      '  ↑ / ↓     navigate log entries',
      '  s         cycle server filter (if using --name)',
      '  c         toggle cURL export view',
      '  q         quit',
      '',
      'Pro users also get every call saved to mcpspy.dev/dashboard',
      'with full token analytics, shareable trace links, and replay.',
      '',
      'Happy debugging! — gabsalvo.com',
    ],
  },
];

function SetupWizard() {
  const { exit } = useApp();
  const [step, setStep] = useState(0);
  const totalSteps = SETUP_STEPS.length;
  const current = SETUP_STEPS[step];

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) exit();
    if (key.rightArrow || input === 'n' || key.return) {
      if (step < totalSteps - 1) setStep(s => s + 1);
    }
    if (key.leftArrow || input === 'p') {
      if (step > 0) setStep(s => s - 1);
    }
  });

  const dots = Array.from({ length: totalSteps }, (_, i) =>
    h(Text, { key: i, color: i === step ? current.color : 'gray', bold: i === step }, i === step ? ' ◉ ' : ' ○ ')
  );

  return h(Box, { flexDirection: 'column', padding: 2, gap: 1 },
    h(Banner, null),

    // Progress dots
    h(Box, { justifyContent: 'center', marginBottom: 1 },
      ...dots,
      h(Text, { color: 'gray' }, `  (${step + 1} / ${totalSteps})`),
    ),

    // Step content
    h(Box, {
      borderStyle: 'round',
      borderColor: current.color,
      paddingX: 3,
      paddingY: 1,
      flexDirection: 'column',
      gap: 0,
    },
      h(Text, { bold: true, color: current.color }, '  ' + current.title),
      h(Text, { color: 'gray' }, '─────────────────────────────────────────────────────────────'),
      h(Text, null),
      ...current.content.map((line, i) => {
        const isCommand = line.startsWith('  npx') || line.startsWith('  {') || line.startsWith('  "') || line.startsWith('  }') || line.startsWith('  ~/');
        return h(Text, {
          key: i,
          color: isCommand ? 'yellowBright' : line === '' ? undefined : 'white',
          dimColor: line === '',
        }, line || ' ');
      }),
    ),

    // Navigation
    h(Box, { borderStyle: 'round', borderColor: 'gray', paddingX: 3, paddingY: 0, gap: 3 },
      step > 0
        ? h(Text, null, h(Text, { color: 'gray' }, '['), h(Text, { color: 'white', bold: true }, '← / P'), h(Text, { color: 'gray' }, '] prev'))
        : h(Text, { color: 'gray' }, '             '),
      h(Text, { color: 'gray' }, '│'),
      step < totalSteps - 1
        ? h(Text, null, h(Text, { color: 'gray' }, '['), h(Text, { color: 'cyanBright', bold: true }, '→ / N / Enter'), h(Text, { color: 'gray' }, '] next'))
        : h(Text, { color: 'greenBright', bold: true }, '  You\'re all set!  '),
      h(Text, { color: 'gray' }, '│'),
      h(Text, null, h(Text, { color: 'gray' }, '['), h(Text, { color: 'gray', bold: true }, 'Q'), h(Text, { color: 'gray' }, '] quit')),
    ),
  );
}

// ── Standalone Entry (no --target) ─────────────────────────────────────────

function StandaloneApp() {
  const [screen, setScreen] = useState('subscription'); // 'subscription' | 'setup'

  const handleAccept = () => {
    // Open pricing page in browser
    const url = 'https://mcpspy.dev/pricing';
    try {
      const cmd = process.platform === 'win32'
        ? `start ${url}`
        : process.platform === 'darwin'
          ? `open ${url}`
          : `xdg-open ${url}`;
      execSync(cmd, { stdio: 'ignore' });
    } catch { /* ignore */ }
    setScreen('setup');
  };

  const handleDecline = () => {
    setScreen('setup');
  };

  if (screen === 'subscription') {
    return h(SubscriptionScreen, { onAccept: handleAccept, onDecline: handleDecline });
  }
  return h(SetupWizard, null);
}

// ── LogRow ─────────────────────────────────────────────────────────────────

function LogRow({ log, selected }) {
  const bg = selected ? 'blue' : undefined;
  const totalTokens = (log.token_count_req ?? 0) + (log.token_count_res ?? 0);

  return h(Box, { key: log.id },
    // Time
    h(Box, { width: 10 },
      h(Text, { color: selected ? 'white' : 'gray', backgroundColor: bg, bold: selected },
        ' ' + fmtTime(log.timestamp) + ' '
      )
    ),
    h(Box, { width: 1 }, h(Text, { color: 'gray', backgroundColor: bg }, '│')),
    // Server label
    h(Box, { width: 14 },
      h(Text, { color: selected ? 'white' : 'magentaBright', backgroundColor: bg },
        ' ' + truncate(log.server_name || '—', 12)
      )
    ),
    h(Box, { width: 1 }, h(Text, { color: 'gray', backgroundColor: bg }, '│')),
    // Method
    h(Box, { width: 24 },
      h(Text, { color: selected ? 'white' : 'cyanBright', backgroundColor: bg, bold: selected },
        ' ' + truncate(log.method, 22)
      )
    ),
    h(Box, { width: 1 }, h(Text, { color: 'gray', backgroundColor: bg }, '│')),
    // Status
    h(Box, { width: 6 },
      h(Text, { color: selected ? 'white' : statusColor(log.status), backgroundColor: bg, bold: true },
        ' ' + String(log.status)
      )
    ),
    h(Box, { width: 1 }, h(Text, { color: 'gray', backgroundColor: bg }, '│')),
    // Duration
    h(Box, { width: 8 },
      h(Text, { color: selected ? 'white' : durationColor(log.duration_ms), backgroundColor: bg },
        ' ' + log.duration_ms + 'ms'
      )
    ),
    h(Box, { width: 1 }, h(Text, { color: 'gray', backgroundColor: bg }, '│')),
    // Token count
    h(Box, { width: 8 },
      h(Text, { color: selected ? 'white' : 'gray', backgroundColor: bg },
        totalTokens > 0 ? ' ~' + fmtTokens(totalTokens) : ''
      )
    ),
    // Redacted indicator
    log.was_redacted
      ? h(Box, { width: 4 }, h(Text, { color: 'yellow', backgroundColor: bg }, ' 🔒'))
      : h(Box, { width: 4 }, h(Text, { backgroundColor: bg }, '    ')),
  );
}

// ── DetailPane ─────────────────────────────────────────────────────────────

function DetailPane({ log, showCurl, targetPort }) {
  if (!log) {
    return h(Box, { flexDirection: 'column', padding: 1, gap: 1 },
      h(Text, { color: 'gray' }, 'No request selected yet.'),
      h(Text, { color: 'gray' }, 'MCP traffic will appear automatically.'),
      h(Text, null),
      h(Box, { flexDirection: 'column', gap: 0 },
        h(Text, { color: 'gray' }, '  ↑ ↓   navigate   │   s  cycle server'),
        h(Text, { color: 'gray' }, '  c     cURL view  │   q  quit'),
      ),
    );
  }

  if (showCurl) {
    const curl = toCurl(log, targetPort);
    return h(Box, { flexDirection: 'column', padding: 1, gap: 1 },
      h(Text, { bold: true, color: 'yellowBright' }, '── cURL Export ──────────────────────────────────'),
      h(Text, { color: 'yellowBright', wrap: 'wrap' }, curl),
      h(Text, { color: 'gray', marginTop: 1 }, 'Press [c] to return to payload view'),
    );
  }

  const req = truncate(log.request_payload, 900);
  const res = truncate(log.response_payload, 900);
  const totalTokens = (log.token_count_req ?? 0) + (log.token_count_res ?? 0);

  return h(Box, { flexDirection: 'column', padding: 1, gap: 1 },
    // Header row
    h(Box, { gap: 3 },
      h(Text, null,
        h(Text, { color: 'gray' }, 'server '),
        h(Text, { color: 'magentaBright', bold: true }, log.server_name || '—'),
      ),
      h(Text, { color: 'gray' }, '│'),
      h(Text, null,
        h(Text, { color: 'gray' }, 'method '),
        h(Text, { color: 'cyanBright', bold: true }, log.method),
      ),
    ),
    h(Box, { gap: 3 },
      h(Text, null,
        h(Text, { color: 'gray' }, 'status '),
        h(Text, { color: statusColor(log.status), bold: true }, String(log.status)),
      ),
      h(Text, { color: 'gray' }, '│'),
      h(Text, null,
        h(Text, { color: 'gray' }, 'duration '),
        h(Text, { color: durationColor(log.duration_ms), bold: true }, log.duration_ms + 'ms'),
      ),
      h(Text, { color: 'gray' }, '│'),
      totalTokens > 0
        ? h(Text, null,
            h(Text, { color: 'gray' }, 'tokens '),
            h(Text, { color: 'white', bold: true }, '~' + fmtTokens(totalTokens)),
          )
        : null,
      log.was_redacted
        ? h(Text, { color: 'yellow' }, '🔒 redacted')
        : null,
    ),
    // Request payload
    h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'cyanBright' }, '── Request ──────────────────────────────────────'),
      h(Text, { color: 'white', wrap: 'wrap', dimColor: !req }, req || '(empty)'),
    ),
    // Response payload
    h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'magentaBright' }, '── Response ─────────────────────────────────────'),
      h(Text, { color: 'white', wrap: 'wrap', dimColor: !res }, res || '(empty)'),
    ),
  );
}

// ── StatsBar ───────────────────────────────────────────────────────────────

function StatsBar({ logs, targetPort, syncKey, serverFilter }) {
  const visibleLogs = serverFilter === 'all' ? logs : logs.filter(l => l.server_name === serverFilter);
  const errors = visibleLogs.filter(l => l.status >= 400).length;
  const avgDuration = visibleLogs.length
    ? Math.round(visibleLogs.reduce((a, b) => a + b.duration_ms, 0) / visibleLogs.length)
    : 0;
  const totalTokens = visibleLogs.reduce((a, b) => a + (b.token_count_req ?? 0) + (b.token_count_res ?? 0), 0);

  return h(Box, {
    borderStyle: 'single',
    borderColor: syncKey ? 'cyanBright' : 'gray',
    paddingX: 1,
    gap: 2,
    flexWrap: 'wrap',
  },
    // Logo
    h(Text, null,
      h(Text, { bold: true, color: 'greenBright' }, '● '),
      h(Text, { bold: true, color: 'cyanBright' }, 'MCP-SPY'),
      h(Text, { color: 'gray' }, ' →:' + targetPort),
    ),
    h(Text, { color: 'gray' }, '│'),
    // Requests
    h(Text, null,
      h(Text, { bold: true, color: 'white' }, String(visibleLogs.length)),
      h(Text, { color: 'gray' }, ' reqs'),
    ),
    h(Text, { color: 'gray' }, '│'),
    // Errors
    h(Text, null,
      h(Text, { color: errors > 0 ? 'red' : 'greenBright', bold: true }, String(errors)),
      h(Text, { color: 'gray' }, ' err'),
    ),
    h(Text, { color: 'gray' }, '│'),
    // Avg duration
    h(Text, null,
      h(Text, { color: 'yellow' }, avgDuration + 'ms'),
      h(Text, { color: 'gray' }, ' avg'),
    ),
    h(Text, { color: 'gray' }, '│'),
    // Tokens
    totalTokens > 0
      ? h(Text, null,
          h(Text, { color: 'gray' }, '~'),
          h(Text, { color: 'white', bold: true }, fmtTokens(totalTokens)),
          h(Text, { color: 'gray' }, ' tkns'),
        )
      : null,
    totalTokens > 0 ? h(Text, { color: 'gray' }, '│') : null,
    // Server filter
    serverFilter !== 'all'
      ? h(Text, null,
          h(Text, { color: 'gray' }, 'filter: '),
          h(Text, { color: 'magentaBright', bold: true }, serverFilter),
        )
      : h(Text, { color: 'gray' }, 'all servers'),
    h(Text, { color: 'gray' }, '│'),
    // Sync status
    syncKey
      ? h(Text, { color: 'cyanBright', bold: true }, '✨ PRO SYNC')
      : h(Text, { color: 'gray' }, 'free · mcpspy.dev/pricing'),
    h(Text, { color: 'gray' }, '│'),
    // Shortcuts
    h(Text, { color: 'gray', dimColor: true }, '↑↓ nav  s srv  c cURL  q quit'),
  );
}

// ── Column Header ──────────────────────────────────────────────────────────

function ColumnHeader() {
  return h(Box, { paddingX: 1, borderStyle: 'single', borderColor: 'gray',
    borderTop: false, borderLeft: false, borderRight: false },
    h(Text, { bold: true, color: 'gray' }, ' TIME    '),
    h(Text, { color: 'gray' }, '│'),
    h(Text, { bold: true, color: 'gray' }, ' SERVER        '),
    h(Text, { color: 'gray' }, '│'),
    h(Text, { bold: true, color: 'gray' }, ' METHOD                   '),
    h(Text, { color: 'gray' }, '│'),
    h(Text, { bold: true, color: 'gray' }, ' STATUS '),
    h(Text, { color: 'gray' }, '│'),
    h(Text, { bold: true, color: 'gray' }, ' DUR     '),
    h(Text, { color: 'gray' }, '│'),
    h(Text, { bold: true, color: 'gray' }, ' TOKENS '),
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

function App({ targetPort, syncKey, serverName }) {
  const { exit } = useApp();
  const [logs, setLogs] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [serverFilter, setServerFilter] = useState('all');
  const [showCurl, setShowCurl] = useState(false);

  useEffect(() => {
    function fetchLogs() {
      try {
        const rows = db.prepare(
          `SELECT id, timestamp, method, request_payload, response_payload,
                  duration_ms, status, server_name,
                  token_count_req, token_count_res, was_redacted
           FROM logs ORDER BY timestamp DESC LIMIT 200`
        ).all();
        setLogs(rows);
      } catch { /* DB not ready yet */ }
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, 1500);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = serverFilter === 'all'
    ? logs
    : logs.filter(l => l.server_name === serverFilter);

  const visibleLogs = filteredLogs.slice(0, 24);
  const selectedLog = filteredLogs[selectedIdx] ?? null;
  const servers = getUniqueServers(logs);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) exit();
    if (key.upArrow)   setSelectedIdx(i => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIdx(i => Math.min(filteredLogs.length - 1, i + 1));
    if (input === 'c') setShowCurl(v => !v);
    if (input === 's') {
      setServerFilter(cur => {
        const idx = servers.indexOf(cur);
        return servers[(idx + 1) % servers.length];
      });
      setSelectedIdx(0);
      setShowCurl(false);
    }
  });

  return h(Box, { flexDirection: 'column', width: '100%' },
    h(StatsBar, { logs, targetPort, syncKey, serverFilter }),
    h(Box, { flexDirection: 'row', flexGrow: 1 },
      // Left: log list
      h(Box, { flexDirection: 'column', width: 76, borderStyle: 'single', borderColor: 'gray' },
        h(ColumnHeader, null),
        visibleLogs.length === 0
          ? h(Box, { padding: 1, flexDirection: 'column', gap: 1 },
              h(Text, { color: 'gray' }, 'Waiting for MCP traffic on port ' + targetPort + '…'),
              h(Text, { color: 'gray', dimColor: true }, 'Make a request from your MCP client to see calls here.'),
            )
          : visibleLogs.map((log, idx) =>
              h(LogRow, { key: log.id, log, selected: idx === selectedIdx })
            )
      ),
      // Right: detail pane
      h(Box, { flexDirection: 'column', flexGrow: 1, borderStyle: 'single', borderColor: 'gray' },
        h(Box, { paddingX: 2, paddingY: 0,
          borderStyle: 'single', borderColor: 'gray',
          borderTop: false, borderLeft: false, borderRight: false },
          h(Text, { bold: true, color: showCurl ? 'yellowBright' : 'cyanBright' },
            showCurl ? 'CURL EXPORT' : 'PAYLOAD INSPECTOR'
          )
        ),
        h(DetailPane, { log: selectedLog, showCurl, targetPort }),
      ),
    ),
  );
}

// ── Exports ────────────────────────────────────────────────────────────────

export function startTUI(targetPort, syncKey, serverName) {
  render(h(App, { targetPort, syncKey, serverName }));
}

export function startStandaloneTUI() {
  render(h(StandaloneApp, null));
}
