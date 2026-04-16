import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Create ~/.mcp-spy directory if it doesn't exist
const mcpSpyDir = path.join(os.homedir(), '.mcp-spy');
if (!fs.existsSync(mcpSpyDir)) {
  fs.mkdirSync(mcpSpyDir, { recursive: true });
}

const dbPath = path.join(mcpSpyDir, 'mcp_logs.db');
const db = new Database(dbPath);

// Use Write-Ahead Logging for better performance
db.pragma('journal_mode = WAL');

// Initialize logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    timestamp INTEGER,
    method TEXT,
    request_payload TEXT,
    response_payload TEXT,
    duration_ms INTEGER,
    status INTEGER,
    server_name TEXT,
    token_count_req INTEGER,
    token_count_res INTEGER,
    was_redacted INTEGER DEFAULT 0
  )
`);

// Safe migrations for existing DBs
const migrations = [
  'ALTER TABLE logs ADD COLUMN server_name TEXT',
  'ALTER TABLE logs ADD COLUMN token_count_req INTEGER',
  'ALTER TABLE logs ADD COLUMN token_count_res INTEGER',
  'ALTER TABLE logs ADD COLUMN was_redacted INTEGER DEFAULT 0',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

export default db;