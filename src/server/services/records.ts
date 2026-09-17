import { db } from '../db';
import { badRequest, notFound } from '../utils/http';
import { cleanOptional, cleanText } from '../utils/sanitize';
import { isValidIsoDate, todayIso } from '../utils/dates';
import { getPatient } from './patients';
import { getServiceRow } from './catalog';

export interface ClinicalRecord {
  id: number;
  patientId: number;
  appointmentId: number | null;
  serviceId: number | null;
  serviceName: string | null;
  date: string;
  title: string;
  description: string;
  teeth: string;
  createdAt: string;
  updatedAt: string;
}

interface RecordRow {
  id: number;
  patient_id: number;
  appointment_id: number | null;
  service_id: number | null;
  date: string;
  title: string;
  description: string;
  teeth: string;
  created_at: string;
  updated_at: string;
  service_name: string | null;
}

const SELECT = `
  SELECT r.*, s.name AS service_name
  FROM clinical_records r
  LEFT JOIN services s ON s.id = r.service_id
`;

function mapRecord(row: RecordRow): ClinicalRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    date: row.date,
    title: row.title,
    description: row.description,
    teeth: row.teeth,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listRecords(patientId: number): ClinicalRecord[] {
  getPatient(patientId);
  const rows = db.prepare(`${SELECT} WHERE r.patient_id = ? ORDER BY r.date DESC, r.id DESC`)
    .all(patientId) as RecordRow[];
  return rows.map(mapRecord);
}

export function getRecord(id: number): ClinicalRecord {
  const row = db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as RecordRow | undefined;
  if (!row) throw notFound('Registro de evolução não encontrado.');
  return mapRecord(row);
}

interface RecordInput {
  appointmentId: number | null;
  serviceId: number | null;
  date: string;
  title: string;
  description: string;
  teeth: string;
}

function validateRecord(payload: Record<string, unknown>, patientId: number, current?: RecordRow): RecordInput {
  const date = cleanText(payload.date ?? current?.date ?? todayIso(), 10);
  const title = cleanText(payload.title ?? current?.title, 140);
  const description = cleanText(payload.description ?? current?.description, 4000);
  const teeth = cleanOptional(payload.teeth ?? current?.teeth, 120) ?? '';

  const details: Record<string, string> = {};
  if (title.length < 3) details.title = 'Informe um título para o registro.';
  if (description.length < 10) details.description = 'Descreva o atendimento com pelo menos 10 caracteres.';
  if (!isValidIsoDate(date)) details.date = 'Informe uma data válida.';
  else if (date > todayIso()) details.date = 'A evolução não pode ser registrada no futuro.';

  let serviceId: number | null = current?.service_id ?? null;
  if (payload.serviceId !== undefined && payload.serviceId !== null && payload.serviceId !== '') {
    serviceId = getServiceRow(Number(payload.serviceId)).id;
  }

  let appointmentId: number | null = current?.appointment_id ?? null;
  if (payload.appointmentId !== undefined && payload.appointmentId !== null && payload.appointmentId !== '') {
    const appointment = db.prepare('SELECT id, patient_id FROM appointments WHERE id = ?')
      .get(Number(payload.appointmentId)) as { id: number; patient_id: number } | undefined;
    if (!appointment) details.appointmentId = 'Consulta não encontrada.';
    else if (appointment.patient_id !== patientId) {
      details.appointmentId = 'A consulta pertence a outro paciente.';
    } else appointmentId = appointment.id;
  }

  if (Object.keys(details).length) throw badRequest('Verifique os dados da evolução.', details);
  return { appointmentId, serviceId, date, title, description, teeth };
}

export function createRecord(patientId: number, payload: Record<string, unknown>): ClinicalRecord {
  getPatient(patientId);
  const input = validateRecord(payload, patientId);
  const info = db.prepare(`
    INSERT INTO clinical_records
      (patient_id, appointment_id, service_id, date, title, description, teeth)
    VALUES (@patientId, @appointmentId, @serviceId, @date, @title, @description, @teeth)
  `).run({ ...input, patientId });
  return getRecord(Number(info.lastInsertRowid));
}

export function updateRecord(id: number, payload: Record<string, unknown>): ClinicalRecord {
  const current = db.prepare('SELECT * FROM clinical_records WHERE id = ?').get(id) as RecordRow | undefined;
  if (!current) throw notFound('Registro de evolução não encontrado.');
  const input = validateRecord(payload, current.patient_id, current);
  db.prepare(`
    UPDATE clinical_records SET appointment_id = @appointmentId, service_id = @serviceId,
      date = @date, title = @title, description = @description, teeth = @teeth,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...input, id });
  return getRecord(id);
}

export function deleteRecord(id: number): void {
  const info = db.prepare('DELETE FROM clinical_records WHERE id = ?').run(id);
  if (info.changes === 0) throw notFound('Registro de evolução não encontrado.');
}
