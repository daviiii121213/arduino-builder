import { db } from '../db';
import { badRequest, conflict } from '../utils/http';
import {
  fromMinutes, isValidIsoDate, isValidIsoTime, nowTimeIso,
  todayIso, toMinutes, weekdayOf
} from '../utils/dates';
import { getSettings } from './settings';

export const MESSAGES = {
  sunday: 'Não é possível agendar consultas aos domingos. A clínica não funciona neste dia.',
  closedDay: 'A clínica não atende no dia selecionado. Escolha outra data.',
  hours: 'Selecione um horário entre 08:00 e 22:00.',
  pastDate: 'Não é possível agendar uma consulta para uma data passada.',
  occupied: 'Este horário já está ocupado. Escolha outro horário.',
  invalidDate: 'Informe uma data válida no formato AAAA-MM-DD.',
  invalidTime: 'Informe um horário válido no formato HH:MM.'
};

export function hoursMessage(openingTime: string, closingTime: string): string {
  if (openingTime === '08:00' && closingTime === '22:00') return MESSAGES.hours;
  return `Selecione um horário entre ${openingTime} e ${closingTime}.`;
}

/**
 * Regras de negócio de agendamento aplicadas SEMPRE no servidor
 * (o mesmo conjunto é espelhado no cliente apenas para feedback imediato).
 */
export function validateSchedule(date: string, time: string, ignoreAppointmentId?: number): void {
  const settings = getSettings();

  if (!isValidIsoDate(date)) throw badRequest(MESSAGES.invalidDate, { date: MESSAGES.invalidDate });
  if (!isValidIsoTime(time)) throw badRequest(MESSAGES.invalidTime, { time: MESSAGES.invalidTime });

  const today = todayIso();
  if (date < today) throw badRequest(MESSAGES.pastDate, { date: MESSAGES.pastDate });
  if (date === today && toMinutes(time) < toMinutes(nowTimeIso())) {
    throw badRequest(MESSAGES.pastDate, { time: 'Este horário já passou. Escolha outro horário.' });
  }

  const weekday = weekdayOf(date);
  if (settings.closedWeekdays.includes(weekday)) {
    const message = weekday === 0 ? MESSAGES.sunday : MESSAGES.closedDay;
    throw badRequest(message, { date: message });
  }

  const minutes = toMinutes(time);
  const opening = toMinutes(settings.openingTime);
  const closing = toMinutes(settings.closingTime);
  const message = hoursMessage(settings.openingTime, settings.closingTime);
  if (minutes < opening || minutes >= closing) throw badRequest(message, { time: message });

  if (isSlotTaken(date, time, ignoreAppointmentId)) {
    throw conflict(MESSAGES.occupied);
  }
}

export function isSlotTaken(date: string, time: string, ignoreAppointmentId?: number): boolean {
  const row = db.prepare(`
    SELECT id FROM appointments
    WHERE date = ? AND time = ? AND status <> 'cancelada' AND id <> ?
    LIMIT 1
  `).get(date, time, ignoreAppointmentId ?? -1);
  return Boolean(row);
}

export interface SlotInfo {
  time: string;
  available: boolean;
  reason?: string;
}

/** Gera dinamicamente os horários do dia com base nas configurações da clínica. */
export function generateSlots(date: string, includeOccupied = false): {
  date: string;
  open: boolean;
  message?: string;
  interval: number;
  slots: SlotInfo[];
} {
  const settings = getSettings();
  if (!isValidIsoDate(date)) throw badRequest(MESSAGES.invalidDate, { date: MESSAGES.invalidDate });

  const weekday = weekdayOf(date);
  const today = todayIso();

  if (date < today) {
    return { date, open: false, message: MESSAGES.pastDate, interval: settings.slotInterval, slots: [] };
  }
  if (settings.closedWeekdays.includes(weekday)) {
    return {
      date,
      open: false,
      message: weekday === 0 ? MESSAGES.sunday : MESSAGES.closedDay,
      interval: settings.slotInterval,
      slots: []
    };
  }

  const taken = new Set(
    (db.prepare(
      `SELECT time FROM appointments WHERE date = ? AND status <> 'cancelada'`
    ).all(date) as { time: string }[]).map((r) => r.time)
  );

  const opening = toMinutes(settings.openingTime);
  const closing = toMinutes(settings.closingTime);
  const nowMinutes = date === today ? toMinutes(nowTimeIso()) : -1;

  const slots: SlotInfo[] = [];
  for (let m = opening; m < closing; m += settings.slotInterval) {
    const time = fromMinutes(m);
    const isPast = m < nowMinutes;
    const isTaken = taken.has(time);
    if ((isTaken || isPast) && !includeOccupied) continue;
    slots.push({
      time,
      available: !isTaken && !isPast,
      reason: isTaken ? 'Horário ocupado' : isPast ? 'Horário já passou' : undefined
    });
  }

  return { date, open: true, interval: settings.slotInterval, slots };
}
