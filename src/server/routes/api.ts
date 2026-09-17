import { Router } from 'express';
import { requireDentist } from '../middleware';
import {
  cancelAppointment, createAppointment, dashboardSummary, deleteAppointment,
  getAppointment, listAppointments, updateAppointment
} from '../services/appointments';
import {
  createPatient, deletePatient, getPatient, listPatients, updatePatient
} from '../services/patients';
import { generateSlots } from '../services/scheduling';
import { getSettings, updateSettings } from '../services/settings';
import { listNotifications, markAllRead, markRead } from '../services/notifications';
import { calculateAge, todayIso } from '../utils/dates';
import { badRequest } from '../utils/http';

export const api = Router();

const ok = (data: unknown) => ({ ok: true, data });

function id(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw badRequest('Identificador inválido.');
  return value;
}

/* ------------------------------------------------------------------ público */

api.get('/public/settings', (_req, res) => {
  const s = getSettings();
  res.json(ok({
    clinicName: s.clinicName,
    phone: s.phone,
    email: s.email,
    address: s.address,
    openingTime: s.openingTime,
    closingTime: s.closingTime,
    closedWeekdays: s.closedWeekdays,
    slotInterval: s.slotInterval,
    dentistName: s.dentistName,
    dentistTitle: s.dentistTitle,
    dentistCro: s.dentistCro
  }));
});

api.get('/public/slots', (req, res) => {
  const date = String(req.query.date || todayIso());
  res.json(ok(generateSlots(date)));
});

api.get('/public/age', (req, res) => {
  const birthDate = String(req.query.birthDate || '');
  res.json(ok(calculateAge(birthDate)));
});

/** Agendamento feito pelo próprio paciente no portal do cliente. */
api.post('/public/appointments', (req, res) => {
  const appointment = createAppointment(req.body ?? {}, { origin: 'portal' });
  res.status(201).json(ok(appointment));
});

/**
 * Consulta as marcações do próprio paciente. Exige nome + data de nascimento,
 * de forma que nenhum dado de terceiros seja exposto pelo endpoint público.
 */
api.post('/public/appointments/lookup', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const birthDate = String(req.body?.birthDate ?? '').trim();
  if (name.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw badRequest('Informe seu nome completo e a data de nascimento para consultar.', {
      name: name.length < 3 ? 'Informe seu nome completo.' : '',
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? '' : 'Informe a data de nascimento.'
    });
  }
  const patients = listPatients({ search: name })
    .filter((p) => p.birthDate === birthDate && p.name.toLowerCase() === name.toLowerCase());

  if (!patients.length) {
    res.json(ok({ patient: null, upcoming: [], history: [] }));
    return;
  }
  const patient = patients[0];
  res.json(ok({
    patient,
    upcoming: listAppointments({ patientId: patient.id, scope: 'upcoming' }),
    history: listAppointments({ patientId: patient.id, scope: 'history' }).reverse()
  }));
});

/** Cancelamento pelo portal: só permite cancelar a própria consulta. */
api.post('/public/appointments/:id/cancel', (req, res) => {
  const appointmentId = id(req.params.id);
  const name = String(req.body?.name ?? '').trim().toLowerCase();
  const birthDate = String(req.body?.birthDate ?? '').trim();
  const appointment = getAppointment(appointmentId);
  if (appointment.patient.name.toLowerCase() !== name || appointment.patient.birthDate !== birthDate) {
    throw badRequest('Não foi possível validar seus dados para cancelar esta consulta.');
  }
  res.json(ok(cancelAppointment(appointmentId)));
});

/* ----------------------------------------------------------------- dentista */

api.use('/dentist', requireDentist);

api.get('/dentist/summary', (_req, res) => res.json(ok(dashboardSummary())));

api.get('/dentist/patients', (req, res) => res.json(ok(listPatients(req.query as never))));
api.post('/dentist/patients', (req, res) => res.status(201).json(ok(createPatient(req.body ?? {}))));
api.get('/dentist/patients/:id', (req, res) => res.json(ok(getPatient(id(req.params.id)))));
api.put('/dentist/patients/:id', (req, res) => res.json(ok(updatePatient(id(req.params.id), req.body ?? {}))));
api.delete('/dentist/patients/:id', (req, res) => {
  deletePatient(id(req.params.id));
  res.json(ok({ deleted: true }));
});
api.get('/dentist/patients/:id/appointments', (req, res) =>
  res.json(ok(listAppointments({ patientId: id(req.params.id) }))));

api.get('/dentist/appointments', (req, res) => res.json(ok(listAppointments(req.query as never))));
api.post('/dentist/appointments', (req, res) =>
  res.status(201).json(ok(createAppointment(req.body ?? {}, { origin: 'clinica' }))));
api.get('/dentist/appointments/:id', (req, res) => res.json(ok(getAppointment(id(req.params.id)))));
api.put('/dentist/appointments/:id', (req, res) =>
  res.json(ok(updateAppointment(id(req.params.id), req.body ?? {}))));
api.delete('/dentist/appointments/:id', (req, res) => {
  deleteAppointment(id(req.params.id));
  res.json(ok({ deleted: true }));
});

api.get('/dentist/slots', (req, res) => {
  const date = String(req.query.date || todayIso());
  const includeOccupied = String(req.query.includeOccupied || '') === 'true';
  res.json(ok(generateSlots(date, includeOccupied)));
});

api.get('/dentist/settings', (_req, res) => res.json(ok(getSettings())));
api.put('/dentist/settings', (req, res) => res.json(ok(updateSettings(req.body ?? {}))));

api.get('/dentist/notifications', (_req, res) => res.json(ok(listNotifications())));
api.post('/dentist/notifications/read', (_req, res) => {
  markAllRead();
  res.json(ok({ updated: true }));
});
api.post('/dentist/notifications/:id/read', (req, res) => {
  markRead(id(req.params.id));
  res.json(ok({ updated: true }));
});
