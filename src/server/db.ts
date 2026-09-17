import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_FILE = path.join(DATA_DIR, process.env.DB_FILE || 'clinic.db');

/**
 * Conexao unica com o SQLite. O banco e a fonte de verdade persistente
 * da aplicacao (o JSON e usado apenas como formato de transporte da API).
 */
export const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'dentist',
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      birth_date  TEXT NOT NULL,
      sex         TEXT NOT NULL,
      phone       TEXT,
      email       TEXT,
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      date        TEXT NOT NULL,
      time        TEXT NOT NULL,
      reason      TEXT NOT NULL,
      notes       TEXT,
      status      TEXT NOT NULL DEFAULT 'aguardando',
      origin      TEXT NOT NULL DEFAULT 'clinica',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clinic_settings (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      clinic_name         TEXT NOT NULL,
      phone               TEXT NOT NULL,
      email               TEXT NOT NULL,
      address             TEXT NOT NULL,
      opening_time        TEXT NOT NULL DEFAULT '08:00',
      closing_time        TEXT NOT NULL DEFAULT '22:00',
      closed_weekdays     TEXT NOT NULL DEFAULT '[0]',
      slot_interval       INTEGER NOT NULL DEFAULT 30,
      dentist_name        TEXT NOT NULL,
      dentist_title       TEXT NOT NULL,
      dentist_cro         TEXT NOT NULL,
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      type           TEXT NOT NULL,
      title          TEXT NOT NULL,
      message        TEXT NOT NULL,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      patient_id     INTEGER REFERENCES patients(id) ON DELETE SET NULL,
      read           INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_slot
      ON appointments(date, time) WHERE status <> 'cancelada';
    CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
  `);
}

export function settingsRowExists(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS total FROM clinic_settings').get() as { total: number };
  return row.total > 0;
}

export function ensureDefaultSettings(): void {
  if (settingsRowExists()) return;
  db.prepare(`
    INSERT INTO clinic_settings
      (id, clinic_name, phone, email, address, opening_time, closing_time,
       closed_weekdays, slot_interval, dentist_name, dentist_title, dentist_cro)
    VALUES
      (1, @clinic_name, @phone, @email, @address, @opening_time, @closing_time,
       @closed_weekdays, @slot_interval, @dentist_name, @dentist_title, @dentist_cro)
  `).run({
    clinic_name: 'OdontoCare - Clínica Odontológica',
    phone: '(11) 4002-8922',
    email: 'contato@odontocare.com.br',
    address: 'Av. das Acácias, 1200 - Jardim Paulista, São Paulo - SP',
    opening_time: '08:00',
    closing_time: '22:00',
    closed_weekdays: '[0]',
    slot_interval: 30,
    dentist_name: 'Dra. Helena Vasconcelos',
    dentist_title: 'Cirurgiã-Dentista - Odontologia Estética e Implantes',
    dentist_cro: 'CRO-SP 54.120'
  });
}
