import { db } from '../db';
import { AppointmentRow, APPOINTMENT_STATUSES, AppointmentStatus, PatientRow } from '../types';
import { badRequest, conflict, notFound } from '../utils/http';
import { cleanOptional, cleanText } from '../utils/sanitize';
import { addDays, calculateAge, todayIso } from '../utils/dates';
import { endTimeOf, isSlotTaken, MESSAGES, validateSchedule } from './scheduling';
import { DURATION_LABEL, getServiceRow, Service, mapService } from './catalog';
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
  endTime: string;
  durationMinutes: number;
  durationLabel: string;
  price: number;
  service: Service | null;
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
  const serviceRow = row.service_id
    ? db.prepare('SELECT * FROM services WHERE id = ?').get(row.service_id)
    : null;

  return {
    id: row.id,
    date: row.date,
    time: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    durationLabel: DURATION_LABEL[row.duration_minutes] ?? `${row.duration_minutes} minutos`,
    price: row.price,
    service: serviceRow ? mapService(serviceRow as never) : null,
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
    ORDER BY a.date ASC, a.start_time ASC
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

  // Preço e duração vêm SEMPRE do serviço no banco, nunca do corpo da requisição.
  const serviceId = Number(payload.serviceId);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw badRequest('Selecione o serviço da consulta.', { serviceId: 'Selecione um serviço.' });
  }
  const service = getServiceRow(serviceId);
  const duration = service.duration_minutes;
  const endTime = endTimeOf(fields.time, duration);

  let patient: Patient;
  if (payload.patientId) {
    patient = getPatient(Number(payload.patientId));
  } else {
    patient = findOrCreatePatient(payload);
  }

  validateSchedule(fields.date, fields.time, duration);

  /**
   * A gravação acontece dentro de uma transação que refaz a checagem de
   * sobreposição imediatamente antes do INSERT. Como as transações do
   * better-sqlite3 são serializadas, dois pedidos simultâneos para o mesmo
   * período não conseguem criar consultas conflitantes.
   */
  const insert = db.transaction(() => {
    if (isSlotTaken(fields.date, fields.time, duration)) {
      throw conflict(MESSAGES.occupied);
    }
    return db.prepare(`
      INSERT INTO appointments
        (patient_id, service_id, date, start_time, end_time, duration_minutes, price,
         reason, notes, status, origin)
      VALUES
        (@patientId, @serviceId, @date, @time, @endTime, @duration, @price,
         @reason, @notes, 'aguardando', @origin)
    `).run({
      ...fields,
      patientId: patient.id,
      serviceId: service.id,
      endTime,
      duration,
      price: service.price,
      origin
    });
  });

  let info;
  try {
    info = insert();
  } catch (error) {
    // o índice único de (date, start_time) também barra corridas por igualdade
    if (error instanceof Error && /UNIQUE constraint/.test(error.message)) {
      throw conflict(MESSAGES.occupied);
    }
    throw error;
  }

  const appointment = getAppointment(Number(info.lastInsertRowid));
  pushNotification({
    type: origin === 'portal' ? 'novo_agendamento' : 'consulta_criada',
    title: origin === 'portal' ? 'Novo agendamento pelo portal' : 'Consulta criada',
    message: `${appointment.patient.name} - ${formatDateBr(appointment.date)}, ${appointment.time} às ${appointment.endTime} (${appointment.service?.name ?? 'serviço'}).`,
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
  const time = cleanText(payload.time ?? existing.start_time, 5);
  const reason = cleanText(payload.reason ?? existing.reason, 300);
  const notes = payload.notes === undefined ? existing.notes : cleanOptional(payload.notes, 1000);
  const status = cleanText(payload.status ?? existing.status, 20) as AppointmentStatus;

  if (reason.length < 3) {
    throw badRequest('Verifique os dados da consulta.', { reason: 'Descreva o motivo da consulta.' });
  }
  if (!APPOINTMENT_STATUSES.includes(status)) {
    throw badRequest('Status inválido.', { status: 'Selecione um status válido.' });
  }

  // Troca de serviço também recalcula preço, duração e término no servidor.
  let serviceId = existing.service_id;
  let duration = existing.duration_minutes;
  let price = existing.price;
  if (payload.serviceId !== undefined && Number(payload.serviceId) !== existing.service_id) {
    const service = getServiceRow(Number(payload.serviceId));
    serviceId = service.id;
    duration = service.duration_minutes;
    price = service.price;
  }
  const endTime = endTimeOf(time, duration);

  const scheduleChanged = date !== existing.date || time !== existing.start_time ||
    duration !== existing.duration_minutes;
  if (scheduleChanged && status !== 'cancelada') {
    validateSchedule(date, time, duration, id);
  }

  db.transaction(() => {
    if (scheduleChanged && status !== 'cancelada' && isSlotTaken(date, time, duration, id)) {
      throw conflict(MESSAGES.occupied);
    }
    db.prepare(`
      UPDATE appointments SET date = @date, start_time = @time, end_time = @endTime,
        service_id = @serviceId, duration_minutes = @duration, price = @price,
        reason = @reason, notes = @notes, status = @status, updated_at = datetime('now')
      WHERE id = @id
    `).run({ date, time, endTime, serviceId, duration, price, reason, notes, status, id });
  })();

  const appointment = getAppointment(id);
  if (status !== existing.status) {
    pushNotification({
      type: status === 'cancelada' ? 'cancelamento' : 'status_alterado',
      title: status === 'cancelada' ? 'Consulta cancelada' : 'Status da consulta alterado',
      message: `${appointment.patient.name} - ${formatDateBr(appointment.date)}, ${appointment.time} às ${appointment.endTime}: ${appointment.statusLabel}.`,
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
