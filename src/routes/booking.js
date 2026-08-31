const express = require('express');
const db = require('../db');
const business = require('../config/business');
const { isSlotAvailable, listAvailableSlots, toMinutes, toHHMM } = require('../availability');

const router = express.Router();

const REASON_MESSAGES = {
  SERVICE_NOT_FOUND: 'Serviço inválido.',
  INVALID_DATE: 'Data inválida.',
  INVALID_TIME: 'Horário inválido.',
  CLOSED_ON_DATE: 'A Essence Pause está fechada nesta data.',
  OUTSIDE_BUSINESS_HOURS: 'Esse horário está fora do funcionamento para o serviço escolhido.',
  PAST_DATETIME: 'Não é possível agendar em uma data/horário que já passou.',
  SLOT_TAKEN: 'Esse horário acabou de ficar indisponível. Escolha outro horário.',
};

router.get('/services', (req, res) => {
  res.json({
    services: business.services.map((s) => ({
      id: s.id,
      name: s.name,
      shortDescription: s.shortDescription,
      durationMinutes: s.durationMinutes,
      priceLabel: s.priceLabel,
    })),
  });
});

router.get('/business-hours', (req, res) => {
  res.json({
    hoursConfirmed: business.hoursConfirmed,
    businessHours: business.businessHours,
  });
});

router.get('/availability', (req, res) => {
  const { serviceId, date } = req.query;
  if (!serviceId || !date) {
    return res.status(400).json({ error: 'MISSING_PARAMS', message: 'Informe serviceId e date.' });
  }

  const result = listAvailableSlots({ serviceId: String(serviceId), date: String(date) });
  if (!result.ok) {
    return res.status(400).json({ error: result.reason, message: REASON_MESSAGES[result.reason] || 'Requisição inválida.' });
  }

  res.json({ date, serviceId, slots: result.slots });
});

function validateContact({ customerName, customerPhone, customerEmail }) {
  if (!customerName || String(customerName).trim().length < 3) {
    return 'Informe o nome completo.';
  }
  const phoneDigits = String(customerPhone || '').replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return 'Informe um telefone/WhatsApp válido com DDD.';
  }
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return 'Informe um e-mail válido.';
  }
  return null;
}

router.post('/appointments', (req, res) => {
  const {
    serviceId,
    date,
    startTime,
    customerName,
    customerPhone,
    customerEmail,
    subject,
    notes,
  } = req.body || {};

  if (!serviceId || !date || !startTime) {
    return res.status(400).json({ error: 'MISSING_PARAMS', message: 'Preencha serviço, data e horário.' });
  }

  const contactError = validateContact({ customerName, customerPhone, customerEmail });
  if (contactError) {
    return res.status(400).json({ error: 'INVALID_CONTACT', message: contactError });
  }

  try {
    // Transação síncrona: node:sqlite (DatabaseSync) é bloqueante e o Node é
    // single-thread, então nenhuma outra requisição consegue intercalar
    // entre a checagem de disponibilidade e o INSERT — isso é o que
    // realmente impede dois clientes de reservarem o mesmo horário em uma
    // corrida. BEGIN IMMEDIATE já toma o lock de escrita na abertura.
    db.exec('BEGIN IMMEDIATE');
    let result;
    try {
      const check = isSlotAvailable({ serviceId: String(serviceId), date: String(date), startTime: String(startTime) });
      if (!check.ok) {
        const err = new Error(check.reason);
        err.reason = check.reason;
        throw err;
      }

      const info = db
        .prepare(
          `INSERT INTO appointments
            (service_id, service_name, duration_minutes, customer_name, customer_phone, customer_email, date, start_time, end_time, subject, notes)
           VALUES (@service_id, @service_name, @duration_minutes, @customer_name, @customer_phone, @customer_email, @date, @start_time, @end_time, @subject, @notes)`
        )
        .run({
          service_id: check.service.id,
          service_name: check.service.name,
          duration_minutes: check.service.durationMinutes,
          customer_name: String(customerName).trim(),
          customer_phone: String(customerPhone).trim(),
          customer_email: customerEmail ? String(customerEmail).trim() : null,
          date: String(date),
          start_time: String(startTime),
          end_time: check.endTime,
          subject: subject ? String(subject).trim() : null,
          notes: notes ? String(notes).trim() : null,
        });

      result = { id: info.lastInsertRowid, endTime: check.endTime, service: check.service };
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return res.status(201).json({
      ok: true,
      appointment: {
        id: result.id,
        serviceId: result.service.id,
        serviceName: result.service.name,
        date,
        startTime,
        endTime: result.endTime,
        customerName: String(customerName).trim(),
      },
    });
  } catch (err) {
    if (err.reason) {
      const status = err.reason === 'SLOT_TAKEN' ? 409 : 400;
      return res.status(status).json({ error: err.reason, message: REASON_MESSAGES[err.reason] || 'Não foi possível agendar.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno ao agendar. Tente novamente.' });
  }
});

module.exports = router;
