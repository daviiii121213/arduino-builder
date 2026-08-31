const db = require('./db');
const { businessHours, slotStepMinutes, services } = require('./config/business');

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function getService(serviceId) {
  return services.find((s) => s.id === serviceId) || null;
}

function isValidDateStr(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(new Date(`${dateStr}T00:00:00`).getTime());
}

function getDayHours(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return businessHours[day] || null;
}

/**
 * Verdade única de disponibilidade: consulta o banco para achar qualquer
 * agendamento confirmado do mesmo dia cujo intervalo [start,end) se
 * sobreponha ao intervalo solicitado. Overlap clássico: A.start < B.end && B.start < A.end.
 */
function hasConflict(dateStr, startHHMM, endHHMM, excludeId = null) {
  const rows = db
    .prepare(
      `SELECT id, start_time, end_time FROM appointments
       WHERE date = ? AND status = 'confirmed'
       ${excludeId ? 'AND id != ?' : ''}`
    )
    .all(...(excludeId ? [dateStr, excludeId] : [dateStr]));

  const reqStart = toMinutes(startHHMM);
  const reqEnd = toMinutes(endHHMM);

  return rows.some((r) => {
    const s = toMinutes(r.start_time);
    const e = toMinutes(r.end_time);
    return reqStart < e && s < reqEnd;
  });
}

/**
 * Checagem completa e autoritativa de um horário candidato:
 * dentro do funcionamento, não é no passado, e sem conflito de reserva.
 * Usada tanto para listar horários livres quanto para validar no momento
 * da confirmação (a mesma função = mesma verdade nos dois lugares).
 */
function isSlotAvailable({ serviceId, date, startTime, now = new Date() }) {
  const service = getService(serviceId);
  if (!service) return { ok: false, reason: 'SERVICE_NOT_FOUND' };
  if (!isValidDateStr(date)) return { ok: false, reason: 'INVALID_DATE' };

  const dayHours = getDayHours(date);
  if (!dayHours) return { ok: false, reason: 'CLOSED_ON_DATE' };

  if (!/^\d{2}:\d{2}$/.test(startTime)) return { ok: false, reason: 'INVALID_TIME' };

  const startMin = toMinutes(startTime);
  const endMin = startMin + service.durationMinutes;
  const openMin = toMinutes(dayHours.open);
  const closeMin = toMinutes(dayHours.close);

  if (startMin < openMin || endMin > closeMin) {
    return { ok: false, reason: 'OUTSIDE_BUSINESS_HOURS' };
  }

  const candidateDateTime = new Date(`${date}T${startTime}:00`);
  if (candidateDateTime.getTime() <= now.getTime()) {
    return { ok: false, reason: 'PAST_DATETIME' };
  }

  const endTime = toHHMM(endMin);
  if (hasConflict(date, startTime, endTime)) {
    return { ok: false, reason: 'SLOT_TAKEN' };
  }

  return { ok: true, endTime, service };
}

/**
 * Lista todos os horários livres de um dia para um serviço, varrendo o
 * expediente em passos de `slotStepMinutes` e reaproveitando isSlotAvailable
 * para cada candidato — garante que a lista mostrada nunca diverge da
 * validação real feita na confirmação.
 */
function listAvailableSlots({ serviceId, date, now = new Date() }) {
  const service = getService(serviceId);
  if (!service) return { ok: false, reason: 'SERVICE_NOT_FOUND' };
  if (!isValidDateStr(date)) return { ok: false, reason: 'INVALID_DATE' };

  const dayHours = getDayHours(date);
  if (!dayHours) return { ok: true, slots: [] };

  const openMin = toMinutes(dayHours.open);
  const closeMin = toMinutes(dayHours.close);
  const slots = [];

  for (let t = openMin; t + service.durationMinutes <= closeMin; t += slotStepMinutes) {
    const startTime = toHHMM(t);
    const check = isSlotAvailable({ serviceId, date, startTime, now });
    if (check.ok) slots.push(startTime);
  }

  return { ok: true, slots };
}

module.exports = {
  getService,
  isValidDateStr,
  getDayHours,
  hasConflict,
  isSlotAvailable,
  listAvailableSlots,
  toMinutes,
  toHHMM,
};
