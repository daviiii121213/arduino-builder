const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'essence-pause.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
