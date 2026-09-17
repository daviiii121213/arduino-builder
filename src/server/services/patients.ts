import { db } from '../db';
import { PatientRow, Sex, SEXES } from '../types';
import { badRequest, notFound } from '../utils/http';
import { cleanOptional, cleanText, isEmail, isPhone } from '../utils/sanitize';
import { calculateAge, isValidIsoDate, todayIso } from '../utils/dates';
import { pushNotification } from './notifications';

export interface Patient {
  id: number;
  name: string;
  birthDate: string;
  sex: Sex;
  phone: string | null;
  email: string | null;
  notes: string | null;
  age: { years: number; months: number; label: string };
  initials: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalAppointments: number;
    lastAppointment: string | null;
    nextAppointment: string | null;
  };
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function mapPatient(row: PatientRow): Patient {
  const age = calculateAge(row.birth_date);
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM appointments WHERE patient_id = @id AND status <> 'cancelada') AS total,
      (SELECT MAX(date || ' ' || start_time) FROM appointments
         WHERE patient_id = @id AND status <> 'cancelada' AND date <= @today) AS last,
      (SELECT MIN(date || ' ' || start_time) FROM appointments
         WHERE patient_id = @id AND status IN ('aguardando','confirmada','em_atendimento')
           AND date >= @today) AS next
  `).get({ id: row.id, today: todayIso() }) as { total: number; last: string | null; next: string | null };

  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    sex: row.sex,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    age: { years: age.years, months: age.months, label: age.label },
    initials: initialsOf(row.name),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stats: {
      totalAppointments: stats.total,
      lastAppointment: stats.last,
      nextAppointment: stats.next
    }
  };
}

interface PatientInput {
  name: string;
  birthDate: string;
  sex: Sex;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export function validatePatient(payload: Record<string, unknown>): PatientInput {
  const name = cleanText(payload.name, 120);
  const birthDate = cleanText(payload.birthDate, 10);
  const sex = cleanText(payload.sex, 20).toLowerCase() as Sex;
  const phone = cleanOptional(payload.phone, 30);
  const email = cleanOptional(payload.email, 120);
  const notes = cleanOptional(payload.notes, 1000);

  const details: Record<string, string> = {};
  if (name.length < 3) details.name = 'Informe o nome completo do paciente.';
  if (!isValidIsoDate(birthDate)) {
    details.birthDate = 'Informe uma data de nascimento válida.';
  } else if (birthDate > todayIso()) {
    details.birthDate = 'A data de nascimento não pode estar no futuro.';
  } else if (calculateAge(birthDate).years > 120) {
    details.birthDate = 'Verifique a data de nascimento informada.';
  }
  if (!SEXES.includes(sex)) details.sex = 'Selecione o sexo do paciente.';
  if (phone && !isPhone(phone)) details.phone = 'Informe um telefone válido com DDD.';
  if (email && !isEmail(email)) details.email = 'Informe um e-mail válido.';

  if (Object.keys(details).length) {
    throw badRequest('Verifique os dados do paciente.', details);
  }
  return { name, birthDate, sex, phone, email, notes };
}

export function createPatient(payload: Record<string, unknown>, notify = true): Patient {
  const input = validatePatient(payload);
  const info = db.prepare(`
    INSERT INTO patients (name, birth_date, sex, phone, email, notes)
    VALUES (@name, @birthDate, @sex, @phone, @email, @notes)
  `).run(input);
  const patient = getPatient(Number(info.lastInsertRowid));
  if (notify) {
    pushNotification({
      type: 'paciente_criado',
      title: 'Novo paciente cadastrado',
      message: `${patient.name} foi adicionado à base de pacientes.`,
      patientId: patient.id
    });
  }
  return patient;
}

export function updatePatient(id: number, payload: Record<string, unknown>): Patient {
  const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined;
  if (!existing) throw notFound('Paciente não encontrado.');
  const input = validatePatient({
    name: payload.name ?? existing.name,
    birthDate: payload.birthDate ?? existing.birth_date,
    sex: payload.sex ?? existing.sex,
    phone: payload.phone ?? existing.phone,
    email: payload.email ?? existing.email,
    notes: payload.notes ?? existing.notes
  });
  db.prepare(`
    UPDATE patients SET name = @name, birth_date = @birthDate, sex = @sex,
      phone = @phone, email = @email, notes = @notes, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...input, id });
  return getPatient(id);
}

export function deletePatient(id: number): void {
  const info = db.prepare('DELETE FROM patients WHERE id = ?').run(id);
  if (info.changes === 0) throw notFound('Paciente não encontrado.');
}

export function getPatient(id: number): Patient {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined;
  if (!row) throw notFound('Paciente não encontrado.');
  return mapPatient(row);
}

export interface PatientQuery {
  search?: string;
  sex?: string;
  sort?: string;
}

export function listPatients(query: PatientQuery): Patient[] {
  const search = cleanText(query.search ?? '', 80);
  const sex = cleanText(query.sex ?? '', 20).toLowerCase();

  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (search) {
    // aspas simples: no SQLite, "" é identificador e quebra a consulta
    where.push(`(name LIKE @search OR IFNULL(phone, '') LIKE @search OR IFNULL(email, '') LIKE @search)`);
    params.search = `%${search}%`;
  }
  if (SEXES.includes(sex as Sex)) {
    where.push('sex = @sex');
    params.sex = sex;
  }

  const orderMap: Record<string, string> = {
    name: 'name COLLATE NOCASE ASC',
    recent: 'datetime(created_at) DESC, id DESC',
    oldest: 'datetime(created_at) ASC, id ASC',
    age_desc: 'birth_date ASC',
    age_asc: 'birth_date DESC'
  };
  const order = orderMap[query.sort ?? 'name'] ?? orderMap.name;

  const rows = db.prepare(
    `SELECT * FROM patients ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`
  ).all(params) as PatientRow[];

  return rows.map(mapPatient);
}

/** Localiza um paciente pelos dados do portal do cliente ou cria um novo. */
export function findOrCreatePatient(payload: Record<string, unknown>): Patient {
  const input = validatePatient(payload);
  const row = db.prepare(`
    SELECT * FROM patients
    WHERE lower(name) = lower(?) AND birth_date = ?
    LIMIT 1
  `).get(input.name, input.birthDate) as PatientRow | undefined;

  if (row) {
    // mantém os dados de contato mais recentes informados pelo próprio paciente
    db.prepare(`
      UPDATE patients SET phone = COALESCE(@phone, phone), email = COALESCE(@email, email),
        sex = @sex, updated_at = datetime('now')
      WHERE id = @id
    `).run({ phone: input.phone, email: input.email, sex: input.sex, id: row.id });
    return getPatient(row.id);
  }
  return createPatient(payload, false);
}
