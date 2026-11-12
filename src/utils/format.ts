// Formatação em português do Brasil.

const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthNames = months;
export const weekdayShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const weekdayLong = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function toISODateTime(d: Date): string {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function today(): string {
  return toISODate(new Date());
}
export function parseISO(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}
export function hasTime(s?: string | null): boolean {
  return !!s && s.length > 10;
}
export function fmtDate(s?: string | null): string {
  const d = parseISO(s);
  if (!d) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function fmtDateTime(s?: string | null): string {
  const d = parseISO(s);
  if (!d) return "";
  return hasTime(s) ? `${fmtDate(s)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : fmtDate(s);
}
export function fmtTime(s?: string | null): string {
  const d = parseISO(s);
  return d && hasTime(s) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}
export function fmtLongDate(d: Date): string {
  return `${weekdayLong[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${months[m - 1]} de ${y}`;
}
/** Texto relativo: "hoje", "amanhã", "há 3 dias", "em 5 dias". */
export function relativeDay(s?: string | null): string {
  const d = parseISO(s);
  if (!d) return "";
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(d);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`;
}
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function money(v?: number | null): string {
  return brl.format(Number(v ?? 0));
}
export function num(v?: number | null, digits = 0): string {
  return Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
export function minutesLabel(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? `${h} h ${r ? `${r} min` : ""}`.trim() : `${r} min`;
}
