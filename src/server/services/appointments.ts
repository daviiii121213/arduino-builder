import { db } from '../db';
import { AppointmentRow, APPOINTMENT_STATUSES, AppointmentStatus, PatientRow } from '../types';
import { badRequest, notFound } from '../utils/http';
import { cleanOptional, cleanText } from '../utils/sanitize';
import { addDays, calculateAge, todayIso } from '../utils/dates';
import { validateSchedule } from './scheduling';
import { findOrCreatePatient, getPatient, mapPatient, Patient } from './patients';
import { pushNotification } from './notifications';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  aguardando: 'Aguardando',
  confirmada: 'Confirmada',
  em_atendimento: 'Em atendimento',
  atendida: 'Atendida',
  cancelada: 'Cancelada'
};

export interface Appointment {
  id: number;
  date: string;
  time: string;
  reason: string;
  notes: string | null;
  status: AppointmentStatus;
  statusLabel: string;
  origin: string;
  createdAt: string;
  updatedAt: string;
  patient: Patient;
  ageAtAppointment: string;
}

type JoinedRow = AppointmentRow & { p_id: number };

export function mapAppointment(row: AppointmentRow): Appointment {
  const patientRow = db.prepare('SELECT * FROM patients WHERE id = ?')
    .get(row.patient_id) as PatientRow;
  const patient = mapPatient(patientRow);
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    reason: row.reason,
    notes: row.notes,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    origin: row.origin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    patient,
    ageAtAppointment: calculateAge(patientRow.birth_date, row.date).label
  };
}

export function getAppointment(id: number): Appointment {
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow | undefined;
  if (!row) throw notFound('Consulta não encontrada.');
  return mapAppointment(row);
}

export interface AppointmentQuery {
  from?: string;
  to?: string;
  date?: string;
  status?: string;
  patientId?: string | number;
  search?: string;
  scope?: string;
  limit?: string | number;
}

export function listAppointments(query: AppointmentQuery): Appointment[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  const today = todayIso();

  if (query.date) {
    where.push('a.date = @date');
    params.date = cleanText(query.date, 10);
  }
  if (query.from) {
    where.push('a.date >= @from');
    params.from = cleanText(query.from, 10);
  }
  if (query.to) {
    where.push('a.date <= @to');
    params.to = cleanText(query.to, 10);
  }
  const status = cleanText(query.status ?? '', 20);
  if (status && APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    where.push('a.status = @status');
    params.status = status;
  }
  if (query.patientId) {
    where.push('a.patient_id = @patientId');
    params.patientId = Number(query.patientId);
  }
  const search = cleanText(query.search ?? '', 80);
  if (search) {
    where.push('(p.name LIKE @search OR a.reason LIKE @search)');
    params.search = `%${search}%`;
  }
  if (query.scope === 'upcoming') {
    where.push(`a.date >= @today AND a.status IN ('aguardando','confirmada','em_atendimento')`);
    params.today = today;
  }
  if (query.scope === 'history') {
    where.push(`(a.date < @today OR a.status IN ('atendida','cancelada'))`);
    params.today = today;
  }

  const limit = Math.min(Number(query.limit ?? 500) || 500, 1000);

  const rows = db.prepare(`
    SELECT a.* FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.date ASC, a.time ASC
    LIMIT ${limit}
  `).all(params) as AppointmentRow[];

  return rows.map(mapAppointment);
}

function validateAppointmentFields(payload: Record<string, unknown>) {
  const date = cleanText(payload.date, 10);
  const time = cleanText(payload.time, 5);
  const reason = cleanText(payload.reason, 300);
  const notes = cleanOptional(payload.notes, 1000);

  const details: Record<string, string> = {};
  if (reason.length < 3) details.reason = 'Descreva o motivo da consulta.';
  if (Object.keys(details).length) throw badRequest('Verifique os dados da consulta.', details);

  return { date, time, reason, notes };
}

export interface CreateAppointmentOptions {
  origin?: 'clinica' | 'portal';
}

export function createAppointment(
  payload: Record<string, unknown>,
  options: CreateAppointmentOptions = {}
): Appointment {
  const origin = options.origin ?? 'clinica';
  const fields = validateAppointmentFields(payload);

  let patient: Patient;
  if (payload.patientId) {
    patient = getPatient(Number(payload.patientId));
  } else {
    patient = findOrCreatePatient(payload);
  }

  validateSchedule(fields.date, fields.time);

  const info = db.prepare(`
    INSERT INTO appointments (patient_id, date, time, reason, notes, status, origin)
    VALUES (@patientId, @date, @time, @reason, @notes, 'aguardando', @origin)
  `).run({ ...fields, patientId: patient.id, origin });

  const appointment = getAppointment(Number(info.lastInsertRowid));
  pushNotification({
    type: origin === 'portal' ? 'novo_agendamento' : 'consulta_criada',
    title: origin === 'portal' ? 'Novo agendamento pelo portal' : 'Consulta criada',
    message: `${appointment.patient.name} - ${formatDateBr(appointment.date)} às ${appointment.time}.`,
    appointmentId: appointment.id,
    patientId: patient.id
  });
  return appointment;
}

export function updateAppointment(id: number, payload: Record<string, unknown>): Appointment {
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?')
    .get(id) as AppointmentRow | undefined;
  if (!existing) throw notFound('Consulta não encontrada.');

  const date = cleanText(payload.date ?? existing.date, 10);
  const time = cleanText(payload.time ?? existing.time, 5);
  const reason = cleanText(payload.reason ?? existing.reason, 300);
  const notes = payload.notes === undefined ? existing.notes : cleanOptional(payload.notes, 1000);
  const status = cleanText(payload.status ?? existing.status, 20) as AppointmentStatus;

  if (reason.length < 3) {
    throw badRequest('Verifique os dados da consulta.', { reason: 'Descreva o motivo da consulta.' });
  }
  if (!APPOINTMENT_STATUSES.includes(status)) {
    throw badRequest('Status inválido.', { status: 'Selecione um status válido.' });
  }

  const scheduleChanged = date !== existing.date || time !== existing.time;
  if (scheduleChanged && status !== 'cancelada') {
    validateSchedule(date, time, id);
  }

  db.prepare(`
    UPDATE appointments SET date = @date, time = @time, reason = @reason,
      notes = @notes, status = @status, updated_at = datetime('now')
    WHERE id = @id
  `).run({ date, time, reason, notes, status, id });

  const appointment = getAppointment(id);
  if (status !== existing.status) {
    pushNotification({
      type: status === 'cancelada' ? 'cancelamento' : 'status_alterado',
      title: status === 'cancelada' ? 'Consulta cancelada' : 'Status da consulta alterado',
      message: `${appointment.patient.name} - ${formatDateBr(appointment.date)} às ${appointment.time}: ${appointment.statusLabel}.`,
      appointmentId: appointment.id,
      patientId: appointment.patient.id
    });
  }
  return appointment;
}

export function cancelAppointment(id: number): Appointment {
  return updateAppointment(id, { status: 'cancelada' });
}

export function deleteAppointment(id: number): void {
  const info = db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  if (info.changes === 0) throw notFound('Consulta não encontrada.');
}

export function formatDateBr(dateIso: string): string {
  const [y, m, d] = dateIso.split('-');
  return `${d}/${m}/${y}`;
}

export interface DashboardSummary {
  today: number;
  upcoming: number;
  patients: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  attended: number;
  weekLoad: { date: string; total: number }[];
  todayList: Appointment[];
  nextList: Appointment[];
}

export function dashboardSummary(): DashboardSummary {
  const today = todayIso();
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM appointments WHERE date = @today AND status <> 'cancelada') AS today,
      (SELECT COUNT(*) FROM appointments WHERE date > @today AND status IN ('aguardando','confirmada')) AS upcoming,
      (SELECT COUNT(*) FROM patients) AS patients,
      (SELECT COUNT(*) FROM appointments WHERE status = 'aguardando' AND date >= @today) AS pending,
      (SELECT COUNT(*) FROM appointments WHERE status = 'confirmada' AND date >= @today) AS confirmed,
      (SELECT COUNT(*) FROM appointments WHERE status = 'cancelada') AS cancelled,
      (SELECT COUNT(*) FROM appointments WHERE status = 'atendida') AS attended
  `).get({ today }) as Record<string, number>;

  const weekLoad: { date: string; total: number }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(today, i);
    const row = db.prepare(
      `SELECT COUNT(*) AS total FROM appointments WHERE date = ? AND status <> 'cancelada'`
    ).get(date) as { total: number };
    weekLoad.push({ date, total: row.total });
  }

  return {
    today: counts.today,
    upcoming: counts.upcoming,
    patients: counts.patients,
    pending: counts.pending,
    confirmed: counts.confirmed,
    cancelled: counts.cancelled,
    attended: counts.attended,
    weekLoad,
    todayList: listAppointments({ date: today }),
    nextList: listAppointments({ scope: 'upcoming', limit: 6 }).slice(0, 6)
  };
}
