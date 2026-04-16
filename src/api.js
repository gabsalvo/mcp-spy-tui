import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startApiServer(targetPort) {
  const app = express();
  const PORT = 4001;

  app.use(express.json());

  // CORS — allow the mcpspy.dev dashboard and localhost dev to call this
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowed = ['https://mcpspy.dev', 'http://localhost:3000', 'http://localhost:3001'];
    if (allowed.includes(origin) || origin.startsWith('http://localhost')) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Health check — dashboard pings this to know the CLI is running
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, port: targetPort, version: '1.0.0' });
  });

  // Logs endpoint
  app.get('/api/logs', (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
      const stmt = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?');
      const logs = stmt.all(limit);
      const formatted = logs.map(log => ({
        ...log,
        request_payload: safeParseJson(log.request_payload),
        response_payload: safeParseJson(log.response_payload),
      }));
      res.json(formatted);
    } catch (err) {
      console.error('❌ Failed to fetch logs:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Replay endpoint — receives edited payload, forwards to target MCP server, returns response
  app.post('/api/replay', async (req, res) => {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing payload' });

    try {
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const start = Date.now();

      const response = await fetch(`http://localhost:${targetPort}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const durationMs = Date.now() - start;
      const responseText = await response.text();

      res.json({
        status: response.status,
        durationMs,
        response: safeParseJson(responseText),
      });
    } catch (err) {
      res.status(502).json({ error: `Could not reach MCP server on port ${targetPort}: ${err.message}` });
    }
  });

  app.listen(PORT, () => {
    console.log(`📊 Local API listening on http://localhost:${PORT}`);
  });
}

function safeParseJson(str) {
  try { return JSON.parse(str); } catch { return str; }
}
