import { db, ensureDefaultSettings } from '../db';
import { SettingsRow } from '../types';
import { badRequest } from '../utils/http';
import { cleanText, isEmail, isPhone } from '../utils/sanitize';
import { isValidIsoTime, toMinutes } from '../utils/dates';

export interface ClinicSettings {
  clinicName: string;
  phone: string;
  email: string;
  address: string;
  openingTime: string;
  closingTime: string;
  closedWeekdays: number[];
  slotInterval: number;
  dentistName: string;
  dentistTitle: string;
  dentistCro: string;
  updatedAt: string;
}

export const ALLOWED_INTERVALS = [15, 30, 45, 60];

function parseWeekdays(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [0];
    return parsed.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  } catch {
    return [0];
  }
}

export function mapSettings(row: SettingsRow): ClinicSettings {
  return {
    clinicName: row.clinic_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    closedWeekdays: parseWeekdays(row.closed_weekdays),
    slotInterval: row.slot_interval,
    dentistName: row.dentist_name,
    dentistTitle: row.dentist_title,
    dentistCro: row.dentist_cro,
    updatedAt: row.updated_at
  };
}

export function getSettings(): ClinicSettings {
  ensureDefaultSettings();
  const row = db.prepare('SELECT * FROM clinic_settings WHERE id = 1').get() as SettingsRow;
  return mapSettings(row);
}

export function updateSettings(payload: Record<string, unknown>): ClinicSettings {
  const current = getSettings();

  const clinicName = cleanText(payload.clinicName ?? current.clinicName, 120);
  const phone = cleanText(payload.phone ?? current.phone, 30);
  const email = cleanText(payload.email ?? current.email, 120);
  const address = cleanText(payload.address ?? current.address, 200);
  const openingTime = cleanText(payload.openingTime ?? current.openingTime, 5);
  const closingTime = cleanText(payload.closingTime ?? current.closingTime, 5);
  const dentistName = cleanText(payload.dentistName ?? current.dentistName, 120);
  const dentistTitle = cleanText(payload.dentistTitle ?? current.dentistTitle, 160);
  const dentistCro = cleanText(payload.dentistCro ?? current.dentistCro, 40);
  const slotInterval = Number(payload.slotInterval ?? current.slotInterval);

  const details: Record<string, string> = {};
  if (clinicName.length < 3) details.clinicName = 'Informe o nome da clínica.';
  if (!isPhone(phone)) details.phone = 'Informe um telefone válido.';
  if (!isEmail(email)) details.email = 'Informe um e-mail válido.';
  if (address.length < 5) details.address = 'Informe o endereço da clínica.';
  if (!isValidIsoTime(openingTime)) details.openingTime = 'Horário de abertura inválido.';
  if (!isValidIsoTime(closingTime)) details.closingTime = 'Horário de fechamento inválido.';
  if (isValidIsoTime(openingTime) && isValidIsoTime(closingTime) &&
      toMinutes(openingTime) >= toMinutes(closingTime)) {
    details.closingTime = 'O fechamento deve ser depois da abertura.';
  }
  if (!ALLOWED_INTERVALS.includes(slotInterval)) {
    details.slotInterval = 'Intervalo deve ser 15, 30, 45 ou 60 minutos.';
  }
  if (dentistName.length < 3) details.dentistName = 'Informe o nome do dentista.';

  let closedWeekdays = current.closedWeekdays;
  if (Array.isArray(payload.closedWeekdays)) {
    closedWeekdays = (payload.closedWeekdays as unknown[])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  }

  if (Object.keys(details).length) {
    throw badRequest('Não foi possível salvar as configurações.', details);
  }

  db.prepare(`
    UPDATE clinic_settings SET
      clinic_name = @clinicName, phone = @phone, email = @email, address = @address,
      opening_time = @openingTime, closing_time = @closingTime,
      closed_weekdays = @closedWeekdays, slot_interval = @slotInterval,
      dentist_name = @dentistName, dentist_title = @dentistTitle, dentist_cro = @dentistCro,
      updated_at = datetime('now')
    WHERE id = 1
  `).run({
    clinicName, phone, email, address, openingTime, closingTime,
    closedWeekdays: JSON.stringify(closedWeekdays),
    slotInterval, dentistName, dentistTitle, dentistCro
  });

  return getSettings();
}
