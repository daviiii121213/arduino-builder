/** Utilidades de data trabalhando sempre com datas civis (sem fuso horário). */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= 1 && d <= daysInMonth;
}

export function isValidIsoTime(value: string): boolean {
  return ISO_TIME.test(value);
}

/** Data de hoje no fuso local do servidor, em formato YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
}

export function nowTimeIso(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Dia da semana civil: 0 = domingo ... 6 = sábado. */
export function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface AgeParts {
  years: number;
  months: number;
  days: number;
  label: string;
}

/**
 * Idade exata em anos e meses, tratando anos bissextos, meses de tamanhos
 * diferentes e datas antes/depois do aniversário.
 */
export function calculateAge(birthDateIso: string, referenceIso = todayIso()): AgeParts {
  const [by, bm, bd] = birthDateIso.split('-').map(Number);
  const [ry, rm, rd] = referenceIso.split('-').map(Number);

  let years = ry - by;
  let months = rm - bm;
  let days = rd - bd;

  if (days < 0) {
    months -= 1;
    // dias do mês anterior à data de referência
    const prevMonthDays = new Date(Date.UTC(ry, rm - 1, 0)).getUTCDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) {
    return { years: 0, months: 0, days: 0, label: 'Data inválida' };
  }

  const yearLabel = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  const monthLabel = `${months} ${months === 1 ? 'mês' : 'meses'}`;
  return { years, months, days, label: `${yearLabel} e ${monthLabel}` };
}
