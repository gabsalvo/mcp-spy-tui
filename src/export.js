/**
 * Export utilities — convert a log record to cURL or Postman format.
 */

/**
 * Generate a runnable curl command from a log entry.
 * @param {object} log  - SQLite log row (snake_case fields)
 * @param {number} port - The port to target (defaults to MCP-Spy's proxy port)
 */
export function toCurl(log, port = 4000) {
  const payload = typeof log.request_payload === 'string'
    ? log.request_payload
    : JSON.stringify(log.request_payload);

  // Pretty-print for readability
  let pretty = payload;
  try {
    pretty = JSON.stringify(JSON.parse(payload), null, 2);
  } catch { /* leave as-is */ }

  // Escape single quotes for shell safety
  const escaped = pretty.replace(/'/g, "'\\''");

  return [
    `curl -s -X POST http://localhost:${port} \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${escaped}'`,
  ].join('\n');
}

/**
 * Generate a minimal Postman Collection v2.1 JSON for an array of log entries.
 * Save the output as a .json file and import directly into Postman.
 */
export function toPostmanCollection(logs, port = 4000, collectionName = 'MCP-Spy Export') {
  const items = logs.map((log) => {
    let body = log.request_payload ?? '{}';
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch { /* leave */ }

    return {
      name: log.method ?? 'unknown',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: { mode: 'raw', raw: body, options: { raw: { language: 'json' } } },
        url: {
          raw: `http://localhost:${port}`,
          protocol: 'http',
          host: ['localhost'],
          port: String(port),
        },
      },
    };
  });

  return JSON.stringify({
    info: {
      name: collectionName,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  }, null, 2);
}
