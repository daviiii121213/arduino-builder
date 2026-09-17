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
import {
  createService, deleteService, getService, listServices, updateService
} from '../services/catalog';
import {
  clearTooth, getOdontogram, odontogramReference, replaceOdontogram, setTooth
} from '../services/odontogram';
import { getAnamnesis, QUESTIONS, saveAnamnesis } from '../services/anamnesis';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../services/records';
import {
  acceptPlan, createPlan, deletePlan, getPlan, listPlans, setItemStatus, updatePlan
} from '../services/plans';
import {
  billPlan, createPayment, deletePayment, financeSummary, listPayments,
  planBilling, settlePayment, updatePayment
} from '../services/payments';
import { reportsOverview } from '../services/reports';
import { getSettings, updateSettings } from '../services/settings';
import { listNotifications, markAllRead, markRead } from '../services/notifications';
import { calculateAge, todayIso } from '../utils/dates';
import { badRequest, notFound } from '../utils/http';

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

api.get('/public/services', (_req, res) => res.json(ok(listServices(true))));

api.get('/public/services/:id', (req, res) => res.json(ok(getService(id(req.params.id)))));

/** Horários do dia já filtrados pela duração do serviço escolhido. */
api.get('/public/slots', (req, res) => {
  const date = String(req.query.date || todayIso());
  const serviceId = Number(req.query.serviceId);
  const duration = Number.isInteger(serviceId) && serviceId > 0
    ? getService(serviceId).durationMinutes
    : undefined;
  res.json(ok(generateSlots(date, duration)));
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

/**
 * Área do paciente: exige nome + data de nascimento para devolver apenas os
 * dados da própria pessoa. Nenhum endpoint público expõe a base inteira.
 */
function identifyPatient(body: Record<string, unknown>) {
  const name = String(body?.name ?? '').trim();
  const birthDate = String(body?.birthDate ?? '').trim();
  if (name.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw badRequest('Informe seu nome completo e a data de nascimento.', {
      name: name.length < 3 ? 'Informe seu nome completo.' : '',
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? '' : 'Informe a data de nascimento.'
    });
  }
  const patient = listPatients({ search: name })
    .find((p) => p.birthDate === birthDate && p.name.toLowerCase() === name.toLowerCase());
  if (!patient) throw notFound('Não localizamos um cadastro com esses dados.');
  return patient;
}

api.get('/public/anamnesis/questions', (_req, res) => res.json(ok(QUESTIONS)));

/** O paciente responde a própria anamnese pelo portal. */
api.post('/public/anamnesis', (req, res) => {
  const patient = identifyPatient(req.body ?? {});
  res.json(ok(saveAnamnesis(patient.id, req.body ?? {}, 'paciente')));
});

api.post('/public/anamnesis/read', (req, res) => {
  const patient = identifyPatient(req.body ?? {});
  res.json(ok(getAnamnesis(patient.id)));
});

/** Orçamentos e pagamentos do próprio paciente. */
api.post('/public/plans', (req, res) => {
  const patient = identifyPatient(req.body ?? {});
  res.json(ok({
    plans: listPlans({ patientId: patient.id }),
    payments: listPayments({ patientId: patient.id })
  }));
});

api.post('/public/plans/:id/accept', (req, res) => {
  const patient = identifyPatient(req.body ?? {});
  const plan = getPlan(id(req.params.id));
  if (plan.patientId !== patient.id) {
    throw badRequest('Este orçamento não pertence ao seu cadastro.');
  }
  res.json(ok(acceptPlan(plan.id)));
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
  const serviceId = Number(req.query.serviceId);
  const duration = Number.isInteger(serviceId) && serviceId > 0
    ? getService(serviceId).durationMinutes
    : undefined;
  res.json(ok(generateSlots(date, duration)));
});

api.get('/dentist/services', (_req, res) => res.json(ok(listServices())));
api.post('/dentist/services', (req, res) => res.status(201).json(ok(createService(req.body ?? {}))));
api.put('/dentist/services/:id', (req, res) =>
  res.json(ok(updateService(id(req.params.id), req.body ?? {}))));
api.delete('/dentist/services/:id', (req, res) => {
  deleteService(id(req.params.id));
  res.json(ok({ deleted: true }));
});

api.get('/dentist/settings', (_req, res) => res.json(ok(getSettings())));
api.put('/dentist/settings', (req, res) => res.json(ok(updateSettings(req.body ?? {}))));

/* ---------- odontograma ---------- */
api.get('/dentist/odontogram/reference', (_req, res) => res.json(ok(odontogramReference())));
api.get('/dentist/patients/:id/odontogram', (req, res) =>
  res.json(ok(getOdontogram(id(req.params.id)))));
api.put('/dentist/patients/:id/odontogram', (req, res) =>
  res.json(ok(replaceOdontogram(id(req.params.id), req.body ?? {}))));
api.put('/dentist/patients/:id/odontogram/:tooth', (req, res) =>
  res.json(ok(setTooth(id(req.params.id), Number(req.params.tooth), req.body ?? {}))));
api.delete('/dentist/patients/:id/odontogram/:tooth', (req, res) =>
  res.json(ok(clearTooth(id(req.params.id), Number(req.params.tooth)))));

/* ---------- anamnese ---------- */
api.get('/dentist/anamnesis/questions', (_req, res) => res.json(ok(QUESTIONS)));
api.get('/dentist/patients/:id/anamnesis', (req, res) =>
  res.json(ok(getAnamnesis(id(req.params.id)))));
api.put('/dentist/patients/:id/anamnesis', (req, res) =>
  res.json(ok(saveAnamnesis(id(req.params.id), req.body ?? {}, 'clinica'))));

/* ---------- prontuário / evolução ---------- */
api.get('/dentist/patients/:id/records', (req, res) => res.json(ok(listRecords(id(req.params.id)))));
api.post('/dentist/patients/:id/records', (req, res) =>
  res.status(201).json(ok(createRecord(id(req.params.id), req.body ?? {}))));
api.put('/dentist/records/:id', (req, res) =>
  res.json(ok(updateRecord(id(req.params.id), req.body ?? {}))));
api.delete('/dentist/records/:id', (req, res) => {
  deleteRecord(id(req.params.id));
  res.json(ok({ deleted: true }));
});

/* ---------- planos de tratamento ---------- */
api.get('/dentist/plans', (req, res) => res.json(ok(listPlans({
  patientId: req.query.patientId ? Number(req.query.patientId) : undefined,
  status: req.query.status ? String(req.query.status) : undefined
}))));
api.get('/dentist/plans/:id', (req, res) => res.json(ok(getPlan(id(req.params.id)))));
api.post('/dentist/patients/:id/plans', (req, res) =>
  res.status(201).json(ok(createPlan(id(req.params.id), req.body ?? {}))));
api.put('/dentist/plans/:id', (req, res) => res.json(ok(updatePlan(id(req.params.id), req.body ?? {}))));
api.put('/dentist/plans/:id/items/:itemId', (req, res) =>
  res.json(ok(setItemStatus(id(req.params.id), id(req.params.itemId), String(req.body?.status ?? '')))));
api.delete('/dentist/plans/:id', (req, res) => {
  deletePlan(id(req.params.id));
  res.json(ok({ deleted: true }));
});

/* ---------- financeiro ---------- */
api.get('/dentist/payments', (req, res) => res.json(ok(listPayments(req.query as never))));
api.get('/dentist/payments/summary', (req, res) => res.json(ok(financeSummary(
  req.query.from ? String(req.query.from) : undefined,
  req.query.to ? String(req.query.to) : undefined
))));
api.post('/dentist/patients/:id/payments', (req, res) =>
  res.status(201).json(ok(createPayment(id(req.params.id), req.body ?? {}))));
api.put('/dentist/payments/:id', (req, res) =>
  res.json(ok(updatePayment(id(req.params.id), req.body ?? {}))));
api.post('/dentist/payments/:id/settle', (req, res) =>
  res.json(ok(settlePayment(id(req.params.id), req.body?.paid !== false))));
api.delete('/dentist/payments/:id', (req, res) => {
  deletePayment(id(req.params.id));
  res.json(ok({ deleted: true }));
});
api.get('/dentist/plans/:id/billing', (req, res) => res.json(ok(planBilling(id(req.params.id)))));
api.post('/dentist/plans/:id/billing', (req, res) =>
  res.status(201).json(ok(billPlan(id(req.params.id), req.body ?? {}))));

/* ---------- relatórios ---------- */
api.get('/dentist/reports', (_req, res) => res.json(ok(reportsOverview())));

api.get('/dentist/notifications', (_req, res) => res.json(ok(listNotifications())));
api.post('/dentist/notifications/read', (_req, res) => {
  markAllRead();
  res.json(ok({ updated: true }));
});
api.post('/dentist/notifications/:id/read', (req, res) => {
  markRead(id(req.params.id));
  res.json(ok({ updated: true }));
});
