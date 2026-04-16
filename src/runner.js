/**
 * CI/CD Test Runner — replays saved requests against the target MCP server
 * and asserts valid JSON-RPC responses. Exits 0 on pass, 1 on any failure.
 */

import db from './db.js';

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

function pass(msg)  { return `${GREEN}✓${RESET} ${msg}`; }
function fail(msg)  { return `${RED}✗${RESET} ${msg}`; }
function info(msg)  { return `${DIM}${msg}${RESET}`; }

function isValidJsonRpc(body) {
  try {
    const obj = typeof body === 'string' ? JSON.parse(body) : body;
    return obj && obj.jsonrpc === '2.0' && ('result' in obj || 'error' in obj || 'id' in obj);
  } catch {
    return false;
  }
}

export async function runTests({ targetPort, method, serverName, count = 10, timeout = 5000 }) {
  console.log(`\n${BOLD}${CYAN}MCP-Spy Test Runner${RESET}`);
  console.log(`${DIM}Target: http://localhost:${targetPort}${RESET}`);

  // Fetch test cases from SQLite
  let query = 'SELECT * FROM logs WHERE status < 400';
  const params = [];
  if (method) { query += ' AND method = ?'; params.push(method); }
  if (serverName) { query += ' AND server_name = ?'; params.push(serverName); }
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(count);

  const cases = db.prepare(query).all(...params);

  if (cases.length === 0) {
    console.log(`\n${YELLOW}⚠ No test cases found. Run some MCP traffic first.${RESET}\n`);
    process.exit(0);
  }

  console.log(`${DIM}Found ${cases.length} test case(s) to replay${RESET}\n`);

  const results = [];

  for (const tc of cases) {
    const label = `[${tc.server_name ?? 'default'}] ${tc.method}`;
    const body = tc.request_payload ?? '{}';

    let passed = false;
    let statusCode = 0;
    let durationMs = 0;
    let errorMsg = '';

    try {
      const start = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(`http://localhost:${targetPort}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);
      durationMs = Date.now() - start;
      statusCode = res.status;

      if (res.status >= 500) {
        errorMsg = `HTTP ${res.status}`;
      } else {
        const responseText = await res.text();
        if (!isValidJsonRpc(responseText)) {
          errorMsg = 'Response is not valid JSON-RPC';
        } else {
          passed = true;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        errorMsg = `Timed out after ${timeout}ms`;
      } else {
        errorMsg = err.message;
      }
    }

    results.push({ label, passed, statusCode, durationMs, errorMsg });

    if (passed) {
      console.log(`  ${pass(label)} ${DIM}${durationMs}ms${RESET}`);
    } else {
      console.log(`  ${fail(label)} ${RED}${errorMsg}${RESET}`);
    }
  }

  const passCount = results.filter(r => r.passed).length;
  const failCount = results.length - passCount;

  console.log(`\n${BOLD}Results: ${GREEN}${passCount} passed${RESET}${BOLD}, ${failCount > 0 ? RED : DIM}${failCount} failed${RESET}${BOLD} / ${results.length} total${RESET}`);

  if (failCount > 0) {
    console.log(`\n${RED}${BOLD}FAILED${RESET} — exit code 1\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}PASSED${RESET} — exit code 0\n`);
    process.exit(0);
  }
}
