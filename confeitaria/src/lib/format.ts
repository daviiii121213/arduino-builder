const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const formatMoney = (value: number): string => brl.format(Number.isFinite(value) ? value : 0);
export const formatNumber = (value: number): string => numberFmt.format(value || 0);

export function parseMoneyInput(raw: string): number {
  const clean = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? value : 0;
}

/** Converte "2026-09-14" em Date local (evita o deslocamento de fuso do ISO puro). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return parseDate(iso).toLocaleDateString('pt-BR');
}

export function formatDateLong(iso: string): string {
  if (!iso) return '—';
  return parseDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatWeekday(iso: string): string {
  return parseDate(iso).toLocaleDateString('pt-BR', { weekday: 'long' });
}

export function formatDateTime(isoDateTime: string): string {
  if (!isoDateTime) return '—';
  const d = new Date(isoDateTime);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(isoDateTime: string): string {
  const diff = Date.now() - new Date(isoDateTime).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return formatDateTime(isoDateTime);
}

export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const onlyDigits = (raw: string): string => raw.replace(/\D/g, '');

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function slugify(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
/** Formato curto para eixos de gráficos: R$ 1,2 mil */
export const formatMoneyShort = (value: number): string => `R$ ${compact.format(value || 0)}`;

/** Primeira letra maiúscula, preservando o restante (ex.: "segunda-feira" -> "Segunda-feira"). */
export const capitalizeFirst = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
