import express from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import crypto from 'crypto';
import db from './db.js';
import { redact } from './redact.js';
import { estimateTokens } from './tokens.js';

export function startProxy(targetPort, serverName = 'default', options = {}) {
  const { redactPii = false, mockMode = false } = options;

  const app = express();

  // Parse JSON bodies but retain the raw buffer for proxying and logging
  app.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // ── MOCK MODE ──────────────────────────────────────────────────────────────
  // When --mock is active, return the latest saved successful response for the
  // incoming method instead of forwarding to the real server.
  if (mockMode) {
    app.post('/', (req, res) => {
      let method = 'unknown';
      try {
        const parsed = req.body ?? JSON.parse(req.rawBody?.toString('utf8') ?? '{}');
        method = parsed.method ?? 'unknown';
      } catch { /* ignore */ }

      const row = db.prepare(
        `SELECT response_payload FROM logs
         WHERE method = ? AND status < 400 AND response_payload IS NOT NULL
         ORDER BY timestamp DESC LIMIT 1`
      ).get(method);

      if (!row) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `No saved mock for method: ${method}` },
          id: req.body?.id ?? null,
        });
      }

      console.log(`🎭 MOCK  ${method}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(row.response_payload);
    });
  } else {
    // ── LIVE PROXY MODE ──────────────────────────────────────────────────────
    app.use(
      '/',
      createProxyMiddleware({
        target: `http://localhost:${targetPort}`,
        changeOrigin: true,
        selfHandleResponse: true,
        onProxyReq: (proxyReq, req) => {
          req.startTime = Date.now();
          req.mcpLogId = crypto.randomUUID();

          if (req.body && Object.keys(req.body).length > 0) {
            const bodyData = req.rawBody || Buffer.from(JSON.stringify(req.body));
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
          }
        },
        onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req) => {
          const duration_ms = Date.now() - req.startTime;
          let requestBody = req.rawBody ? req.rawBody.toString('utf8') : '';
          let responseBody = responseBuffer.toString('utf8');

          // Extract JSON-RPC method name
          let method = 'unknown';
          try {
            if (requestBody) {
              const parsedReq = JSON.parse(requestBody);
              method = parsedReq.method || 'unknown';
            }
          } catch { /* ignore non-JSON */ }

          // Auto-redaction
          let wasRedacted = false;
          if (redactPii) {
            const rReq = redact(requestBody);
            const rRes = redact(responseBody);
            requestBody = rReq.redacted;
            responseBody = rRes.redacted;
            wasRedacted = rReq.changed || rRes.changed;
          }

          // Token estimation
          const tokenCountReq = estimateTokens(requestBody);
          const tokenCountRes = estimateTokens(responseBody);

          // Save to SQLite
          try {
            db.prepare(`
              INSERT INTO logs
                (id, timestamp, method, request_payload, response_payload,
                 duration_ms, status, server_name,
                 token_count_req, token_count_res, was_redacted)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              req.mcpLogId,
              req.startTime,
              method,
              requestBody,
              responseBody,
              duration_ms,
              proxyRes.statusCode,
              serverName,
              tokenCountReq,
              tokenCountRes,
              wasRedacted ? 1 : 0
            );
          } catch (dbErr) {
            console.error('❌ Failed to save log to database:', dbErr.message);
          }

          return responseBuffer;
        }),
        onError: (err, req, res) => {
          console.error(`❌ Proxy Error: ${err.message}`);
          res.status(502).json({ error: 'Proxy error', details: err.message });
        },
      })
    );
  }

  const PORT = 4000;
  app.listen(PORT, () => {
    const mode = mockMode ? '🎭 MOCK MODE' : '📡 Proxy';
    console.log(`${mode} listening on http://localhost:${PORT} ➡️  target port ${targetPort}`);
  });
}
