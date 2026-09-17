import { db } from '../db';
import { addDays, todayIso } from '../utils/dates';
import { financeSummary } from './payments';
import { getSettings } from './settings';
import { toMinutes } from '../utils/dates';

export interface Point {
  label: string;
  value: number;
  key?: string;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function lastMonths(count: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
};

/** Faturamento mês a mês, a partir dos pagamentos efetivamente recebidos. */
export function revenueByMonth(months = 6): Point[] {
  return lastMonths(months).map((ym) => {
    const row = db.prepare(
      `SELECT IFNULL(SUM(amount), 0) AS total FROM payments
       WHERE paid_at IS NOT NULL AND substr(paid_at, 1, 7) = ?`
    ).get(ym) as { total: number };
    return { key: ym, label: monthLabel(ym), value: row.total };
  });
}

export function newPatientsByMonth(months = 6): Point[] {
  return lastMonths(months).map((ym) => {
    const row = db.prepare(
      `SELECT COUNT(*) AS total FROM patients WHERE substr(created_at, 1, 7) = ?`
    ).get(ym) as { total: number };
    return { key: ym, label: monthLabel(ym), value: row.total };
  });
}

export function topServices(limit = 8): Point[] {
  const rows = db.prepare(`
    SELECT IFNULL(s.name, a.reason) AS label, COUNT(*) AS total
    FROM appointments a
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.status <> 'cancelada'
    GROUP BY label
    ORDER BY total DESC, label ASC
    LIMIT ?
  `).all(limit) as { label: string; total: number }[];
  return rows.map((r) => ({ label: r.label, value: r.total }));
}

export function appointmentsByStatus(): Point[] {
  const rows = db.prepare(
    'SELECT status, COUNT(*) AS total FROM appointments GROUP BY status'
  ).all() as { status: string; total: number }[];
  const labels: Record<string, string> = {
    atendida: 'Atendidas', confirmada: 'Confirmadas', aguardando: 'Aguardando',
    em_atendimento: 'Em atendimento', cancelada: 'Canceladas'
  };
  return Object.keys(labels).map((status) => ({
    key: status,
    label: labels[status],
    value: rows.find((r) => r.status === status)?.total ?? 0
  }));
}

/** Ocupação por faixa do dia, respeitando o horário de funcionamento. */
export function occupancyByBand(): Point[] {
  const settings = getSettings();
  const bands: [string, string, string][] = [
    ['Manhã', '08:00', '11:00'],
    ['Meio-dia', '11:00', '14:00'],
    ['Tarde', '14:00', '18:00'],
    ['Noite', '18:00', '22:00']
  ];
  const rows = db.prepare(
    `SELECT start_time FROM appointments WHERE status <> 'cancelada'`
  ).all() as { start_time: string }[];

  return bands
    .filter(([, from]) => toMinutes(from) < toMinutes(settings.closingTime))
    .map(([label, from, to]) => ({
      label,
      value: rows.filter((r) =>
        toMinutes(r.start_time) >= toMinutes(from) && toMinutes(r.start_time) < toMinutes(to)).length
    }));
}

/** Pacientes sem consulta há mais de N dias (recall). */
export function recallList(days = 180, limit = 20) {
  const limitDate = addDays(todayIso(), -days);
  const rows = db.prepare(`
    SELECT p.id, p.name, p.phone, p.email,
      (SELECT MAX(date) FROM appointments a
        WHERE a.patient_id = p.id AND a.status <> 'cancelada') AS last_date
    FROM patients p
    WHERE last_date IS NULL OR last_date < @limitDate
    ORDER BY last_date IS NOT NULL, last_date ASC, p.name ASC
    LIMIT @limit
  `).all({ limitDate, limit }) as
    { id: number; name: string; phone: string | null; email: string | null; last_date: string | null }[];

  return rows.map((r) => ({
    id: r.id, name: r.name, phone: r.phone, email: r.email, lastAppointment: r.last_date
  }));
}

/** Aniversariantes do mês informado (padrão: mês corrente). */
export function birthdays(month = todayIso().slice(5, 7)) {
  const rows = db.prepare(`
    SELECT id, name, birth_date, phone FROM patients
    WHERE substr(birth_date, 6, 2) = ?
    ORDER BY substr(birth_date, 9, 2) ASC
  `).all(month) as { id: number; name: string; birth_date: string; phone: string | null }[];
  return rows.map((r) => ({ id: r.id, name: r.name, birthDate: r.birth_date, phone: r.phone }));
}

export function planSummary() {
  const rows = db.prepare(`
    SELECT p.id, p.status, p.discount,
      IFNULL((SELECT SUM(price) FROM treatment_plan_items i WHERE i.plan_id = p.id), 0) AS items_total
    FROM treatment_plans p
  `).all() as { id: number; status: string; discount: number; items_total: number }[];

  const totalValue = rows.reduce((sum, r) => sum + Math.max(r.items_total - r.discount, 0), 0);
  const approved = rows.filter((r) => ['aprovado', 'em_andamento', 'concluido'].includes(r.status));
  return {
    total: rows.length,
    approved: approved.length,
    approvalRate: rows.length ? Math.round((approved.length / rows.length) * 100) : 0,
    totalValue
  };
}

export function reportsOverview() {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM patients) AS patients,
      (SELECT COUNT(*) FROM appointments) AS appointments,
      (SELECT COUNT(*) FROM appointments WHERE status = 'cancelada') AS cancelled,
      (SELECT COUNT(*) FROM clinical_records) AS records,
      (SELECT COUNT(*) FROM odontograms) AS odontograms
  `).get() as Record<string, number>;

  const month = todayIso().slice(0, 7);
  const monthEnd = `${month}-31`;

  return {
    totals: {
      patients: totals.patients,
      appointments: totals.appointments,
      records: totals.records,
      odontograms: totals.odontograms,
      cancelRate: totals.appointments
        ? Math.round((totals.cancelled / totals.appointments) * 100)
        : 0
    },
    finance: financeSummary(`${month}-01`, monthEnd),
    plans: planSummary(),
    revenueByMonth: revenueByMonth(),
    newPatientsByMonth: newPatientsByMonth(),
    topServices: topServices(),
    appointmentsByStatus: appointmentsByStatus(),
    occupancyByBand: occupancyByBand(),
    recall: recallList(),
    birthdays: birthdays()
  };
}
