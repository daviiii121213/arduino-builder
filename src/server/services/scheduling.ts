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
export function endTimeOf(start: string, durationMinutes: number): string {
  return fromMinutes(toMinutes(start) + durationMinutes);
}

export function overflowMessage(duration: number, closingTime: string): string {
  return `Este serviço leva ${duration} minutos e não cabe antes do fechamento às ${closingTime}.`;
}

/**
 * Regras de agendamento aplicadas SEMPRE no servidor, considerando a duração
 * completa do serviço (o cliente nunca define duração nem horário de término).
 */
export function validateSchedule(
  date: string,
  time: string,
  durationMinutes: number,
  ignoreAppointmentId?: number
): void {
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

  if (minutes + durationMinutes > closing) {
    const overflow = overflowMessage(durationMinutes, settings.closingTime);
    throw badRequest(overflow, { time: overflow });
  }

  if (isSlotTaken(date, time, durationMinutes, ignoreAppointmentId)) {
    throw conflict(MESSAGES.occupied);
  }
}

/**
 * Conflito por SOBREPOSIÇÃO de períodos: duas consultas colidem quando
 * início_A < fim_B e início_B < fim_A. Comparar apenas o horário inicial
 * deixaria passar uma consulta começando no meio de outra.
 */
export function isSlotTaken(
  date: string,
  time: string,
  durationMinutes: number,
  ignoreAppointmentId?: number
): boolean {
  const row = db.prepare(`
    SELECT id FROM appointments
    WHERE date = @date
      AND status <> 'cancelada'
      AND id <> @ignore
      AND @start < end_time
      AND start_time < @end
    LIMIT 1
  `).get({
    date,
    start: time,
    end: endTimeOf(time, durationMinutes),
    ignore: ignoreAppointmentId ?? -1
  });
  return Boolean(row);
}

export interface SlotInfo {
  time: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

/** Gera dinamicamente os horários do dia com base nas configurações da clínica. */
export function generateSlots(date: string, durationMinutes?: number): {
  date: string;
  open: boolean;
  message?: string;
  interval: number;
  duration: number;
  slots: SlotInfo[];
} {
  const settings = getSettings();
  const duration = durationMinutes && durationMinutes > 0 ? durationMinutes : settings.slotInterval;
  if (!isValidIsoDate(date)) throw badRequest(MESSAGES.invalidDate, { date: MESSAGES.invalidDate });

  const weekday = weekdayOf(date);
  const today = todayIso();

  if (date < today) {
    return { date, open: false, message: MESSAGES.pastDate, interval: settings.slotInterval, duration, slots: [] };
  }
  if (settings.closedWeekdays.includes(weekday)) {
    return {
      date,
      open: false,
      message: weekday === 0 ? MESSAGES.sunday : MESSAGES.closedDay,
      interval: settings.slotInterval,
      duration,
      slots: []
    };
  }

  const booked = db.prepare(
    `SELECT start_time, end_time FROM appointments WHERE date = ? AND status <> 'cancelada'`
  ).all(date) as { start_time: string; end_time: string }[];

  const opening = toMinutes(settings.openingTime);
  const closing = toMinutes(settings.closingTime);
  const nowMinutes = date === today ? toMinutes(nowTimeIso()) : -1;

  const slots: SlotInfo[] = [];
  for (let m = opening; m < closing; m += settings.slotInterval) {
    const time = fromMinutes(m);
    const end = m + duration;
    const isPast = m < nowMinutes;
    const overflows = end > closing;
    const isTaken = booked.some((b) =>
      m < toMinutes(b.end_time) && toMinutes(b.start_time) < end);

    slots.push({
      time,
      endTime: fromMinutes(end),
      available: !isTaken && !isPast && !overflows,
      reason: isTaken ? MESSAGES.occupied
        : isPast ? 'Horário já passou'
        : overflows ? overflowMessage(duration, settings.closingTime)
        : undefined
    });
  }

  return { date, open: true, interval: settings.slotInterval, duration, slots };
}
