const path = require('path');
const fs = require('fs');
// Usa o módulo SQLite embutido do Node (>=22.5) em vez de better-sqlite3:
// evita depender de compilação nativa (node-gyp/Visual Studio) na máquina
// de quem for rodar o projeto.
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'essence-pause.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    date TEXT NOT NULL,        -- 'YYYY-MM-DD'
    start_time TEXT NOT NULL,  -- 'HH:MM'
    end_time TEXT NOT NULL,    -- 'HH:MM'
    subject TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
`);

module.exports = db;
