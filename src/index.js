#!/usr/bin/env node
import { program } from 'commander';
import { startProxy } from './proxy.js';
import { startApiServer } from './api.js';
import { startTUI, startStandaloneTUI } from './tui.js';
import { runTests } from './runner.js';
import { version } from './version.js';

// Options after a subcommand belong to the subcommand — without this, the main
// program's -t/--target steals the flag from `mcp-spy test -t <port>`.
program.enablePositionalOptions();

// ── TEST SUBCOMMAND ────────────────────────────────────────────────────────
program
  .command('test')
  .description('Replay saved requests against the target and assert valid JSON-RPC responses')
  .requiredOption('-t, --target <port>', 'Target MCP server port to test against')
  .option('-m, --method <method>', 'Only replay requests matching this method name')
  .option('-n, --name <label>', 'Only replay requests from this server label')
  .option('-c, --count <n>', 'Max number of requests to replay', '10')
  .option('--timeout <ms>', 'Per-request timeout in ms', '5000')
  .action((opts) => {
    runTests({
      targetPort: opts.target,
      method: opts.method,
      serverName: opts.name,
      count: parseInt(opts.count, 10),
      timeout: parseInt(opts.timeout, 10),
    });
  });

// ── MAIN PROXY COMMAND ─────────────────────────────────────────────────────
program
  .name('mcp-spy')
  .description('The Visual Debugger & Proxy for MCP')
  .version(version)
  .option('-t, --target <port>', 'Target port of the MCP server')
  .option('-n, --name <label>', 'Label for this MCP server (e.g. "filesystem", "github")')
  .option('--redact-pii', 'Auto-redact secrets (AWS keys, tokens, emails) before saving')
  .option('--mock', 'Mock mode: return saved responses instead of forwarding to server')
  .option('--no-tui', 'Disable the TUI and use plain console output instead')
  .action((options) => {
    // No target → standalone welcome/setup screen
    if (!options.target) {
      startStandaloneTUI();
      return;
    }

    const serverName = options.name || `port-${options.target}`;

    startProxy(options.target, serverName, {
      redactPii: !!options.redactPii,
      mockMode: !!options.mock,
    });

    startApiServer(options.target);

    if (options.tui) {
      startTUI(options.target, serverName);
    } else {
      console.log('');
      console.log('\x1b[36m>>> MCP-Spy Proxy\x1b[0m');
      console.log('\x1b[90m======================================\x1b[0m');
      console.log(`\x1b[32m [√] Target: port ${options.target}  Label: ${serverName}\x1b[0m`);

      if (options.mock)     console.log('\x1b[35m [🎭] MOCK MODE — real server will NOT be called\x1b[0m');
      if (options.redactPii) console.log('\x1b[33m [🔒] PII auto-redaction ON\x1b[0m');

      console.log('\x1b[32m [√] Database ready (WAL mode)\x1b[0m');
      console.log('\x1b[90m======================================\x1b[0m');
      console.log('\x1b[36m🚀 MCP-Spy is listening on http://localhost:4000\x1b[0m');
      console.log('\x1b[90m======================================\x1b[0m\n');
    }
  });

program.parse(process.argv);
