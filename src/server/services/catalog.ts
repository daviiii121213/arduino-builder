import { db } from '../db';
import { ServiceRow } from '../types';
import { badRequest, notFound } from '../utils/http';
import { cleanOptional, cleanText } from '../utils/sanitize';

export const ALLOWED_DURATIONS = [30, 60, 90];

export const DURATION_LABEL: Record<number, string> = {
  30: '30 minutos',
  60: '1 hora',
  90: '1 hora e 30 minutos'
};

export interface Service {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  durationMinutes: number;
  durationLabel: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    durationMinutes: row.duration_minutes,
    durationLabel: DURATION_LABEL[row.duration_minutes] ?? `${row.duration_minutes} minutos`,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listServices(onlyActive = false): Service[] {
  const rows = db.prepare(
    `SELECT * FROM services ${onlyActive ? 'WHERE active = 1' : ''}
     ORDER BY category COLLATE NOCASE ASC, name COLLATE NOCASE ASC`
  ).all() as ServiceRow[];
  return rows.map(mapService);
}

/**
 * Carrega o serviço direto do banco. É a única origem de preço e duração:
 * valores enviados pelo cliente nunca são considerados.
 */
export function getServiceRow(id: number): ServiceRow {
  const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as ServiceRow | undefined;
  if (!row) throw notFound('Serviço não encontrado.');
  if (row.active !== 1) throw badRequest('Este serviço não está disponível para agendamento.');
  return row;
}

export function getService(id: number): Service {
  return mapService(getServiceRow(id));
}

interface ServiceInput {
  name: string;
  description: string;
  category: string;
  price: number;
  durationMinutes: number;
  active: number;
}

function validateService(payload: Record<string, unknown>, current?: ServiceRow): ServiceInput {
  const name = cleanText(payload.name ?? current?.name, 120);
  const description = cleanOptional(payload.description ?? current?.description, 400) ?? '';
  const category = cleanText(payload.category ?? current?.category ?? 'Geral', 60) || 'Geral';
  const price = Number(payload.price ?? current?.price);
  const durationMinutes = Number(payload.durationMinutes ?? current?.duration_minutes);

  const details: Record<string, string> = {};
  if (name.length < 3) details.name = 'Informe o nome do serviço.';
  if (!Number.isFinite(price) || price < 0) details.price = 'Informe um preço válido.';
  if (!ALLOWED_DURATIONS.includes(durationMinutes)) {
    details.durationMinutes = 'A duração deve ser 30, 60 ou 90 minutos.';
  }
  if (Object.keys(details).length) throw badRequest('Verifique os dados do serviço.', details);

  const active = payload.active === undefined ? (current?.active ?? 1) : (payload.active ? 1 : 0);
  return { name, description, category, price, durationMinutes, active };
}

export function createService(payload: Record<string, unknown>): Service {
  const input = validateService(payload);
  const exists = db.prepare('SELECT id FROM services WHERE lower(name) = lower(?)').get(input.name);
  if (exists) throw badRequest('Já existe um serviço com este nome.', { name: 'Nome já cadastrado.' });

  const info = db.prepare(`
    INSERT INTO services (name, description, category, price, duration_minutes, active)
    VALUES (@name, @description, @category, @price, @durationMinutes, @active)
  `).run(input);
  return getService(Number(info.lastInsertRowid));
}

export function updateService(id: number, payload: Record<string, unknown>): Service {
  const current = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as ServiceRow | undefined;
  if (!current) throw notFound('Serviço não encontrado.');
  const input = validateService(payload, current);

  db.prepare(`
    UPDATE services SET name = @name, description = @description, category = @category,
      price = @price, duration_minutes = @durationMinutes, active = @active,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...input, id });
  return mapService(db.prepare('SELECT * FROM services WHERE id = ?').get(id) as ServiceRow);
}

export function deleteService(id: number): void {
  const used = db.prepare('SELECT COUNT(*) AS total FROM appointments WHERE service_id = ?')
    .get(id) as { total: number };
  if (used.total > 0) {
    // mantém o histórico das consultas: o serviço é apenas desativado
    db.prepare(`UPDATE services SET active = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
    return;
  }
  const info = db.prepare('DELETE FROM services WHERE id = ?').run(id);
  if (info.changes === 0) throw notFound('Serviço não encontrado.');
}
