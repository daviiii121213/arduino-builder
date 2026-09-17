import { db } from '../db';
import { badRequest, notFound } from '../utils/http';
import { cleanText } from '../utils/sanitize';
import { isValidIsoDate, todayIso } from '../utils/dates';
import { getPatient } from './patients';
import { getPlan } from './plans';

export const PAY_METHODS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  convenio: 'Convênio',
  boleto: 'Boleto'
};

export const PAY_STATUS: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  vencido: 'Vencido'
};

export interface Payment {
  id: number;
  patientId: number;
  patientName: string;
  planId: number | null;
  planTitle: string | null;
  description: string;
  amount: number;
  method: string;
  methodLabel: string;
  installment: string;
  dueDate: string;
  paidAt: string | null;
  /** Derivado da data e da baixa — nunca gravado pelo cliente. */
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRow {
  id: number;
  patient_id: number;
  plan_id: number | null;
  description: string;
  amount: number;
  method: string;
  installment: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string;
  plan_title: string | null;
}

const SELECT = `
  SELECT p.*, pt.name AS patient_name, tp.title AS plan_title
  FROM payments p
  JOIN patients pt ON pt.id = p.patient_id
  LEFT JOIN treatment_plans tp ON tp.id = p.plan_id
`;

export function statusOf(paidAt: string | null, dueDate: string): string {
  if (paidAt) return 'pago';
  return dueDate < todayIso() ? 'vencido' : 'pendente';
}

function mapPayment(row: PaymentRow): Payment {
  const status = statusOf(row.paid_at, row.due_date);
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    planId: row.plan_id,
    planTitle: row.plan_title,
    description: row.description,
    amount: row.amount,
    method: row.method,
    methodLabel: PAY_METHODS[row.method] ?? row.method,
    installment: row.installment,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    status,
    statusLabel: PAY_STATUS[status],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function getPayment(id: number): Payment {
  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as PaymentRow | undefined;
  if (!row) throw notFound('Lançamento não encontrado.');
  return mapPayment(row);
}

export interface PaymentQuery {
  patientId?: number | string;
  planId?: number | string;
  status?: string;
  from?: string;
  to?: string;
}

export function listPayments(query: PaymentQuery = {}): Payment[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (query.patientId) { where.push('p.patient_id = @patientId'); params.patientId = Number(query.patientId); }
  if (query.planId) { where.push('p.plan_id = @planId'); params.planId = Number(query.planId); }
  if (query.from) { where.push('p.due_date >= @from'); params.from = cleanText(query.from, 10); }
  if (query.to) { where.push('p.due_date <= @to'); params.to = cleanText(query.to, 10); }

  const rows = db.prepare(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY p.due_date DESC, p.id DESC`
  ).all(params) as PaymentRow[];

  const list = rows.map(mapPayment);
  const status = cleanText(query.status ?? '', 20);
  return status && PAY_STATUS[status] ? list.filter((p) => p.status === status) : list;
}

interface PaymentInput {
  description: string;
  amount: number;
  method: string;
  dueDate: string;
  paidAt: string | null;
  installment: string;
  planId: number | null;
}

function validatePayment(payload: Record<string, unknown>, current?: Payment): PaymentInput {
  const description = cleanText(payload.description ?? current?.description, 200);
  const amount = Number(payload.amount ?? current?.amount);
  const method = String(payload.method ?? current?.method ?? 'pix');
  const dueDate = cleanText(payload.dueDate ?? current?.dueDate, 10);
  const installment = cleanText(payload.installment ?? current?.installment ?? '', 12);

  const details: Record<string, string> = {};
  if (description.length < 3) details.description = 'Descreva o lançamento.';
  if (!Number.isFinite(amount) || amount <= 0) details.amount = 'Informe um valor maior que zero.';
  if (!PAY_METHODS[method]) details.method = 'Forma de pagamento inválida.';
  if (!isValidIsoDate(dueDate)) details.dueDate = 'Informe uma data de vencimento válida.';

  let paidAt: string | null = current?.paidAt ?? null;
  if (payload.paidAt !== undefined) {
    if (payload.paidAt === null || payload.paidAt === '') paidAt = null;
    else {
      const value = cleanText(payload.paidAt, 10);
      if (!isValidIsoDate(value)) details.paidAt = 'Data de pagamento inválida.';
      else if (value > todayIso()) details.paidAt = 'A data de pagamento não pode estar no futuro.';
      else paidAt = value;
    }
  }

  let planId: number | null = current?.planId ?? null;
  if (payload.planId !== undefined && payload.planId !== null && payload.planId !== '') {
    planId = getPlan(Number(payload.planId)).id;
  }

  if (Object.keys(details).length) throw badRequest('Verifique os dados do lançamento.', details);
  return { description, amount, method, dueDate, paidAt, installment, planId };
}

export function createPayment(patientId: number, payload: Record<string, unknown>): Payment {
  getPatient(patientId);
  const input = validatePayment(payload);
  const info = db.prepare(`
    INSERT INTO payments (patient_id, plan_id, description, amount, method, installment, due_date, paid_at)
    VALUES (@patientId, @planId, @description, @amount, @method, @installment, @dueDate, @paidAt)
  `).run({ ...input, patientId });
  return getPayment(Number(info.lastInsertRowid));
}

export function updatePayment(id: number, payload: Record<string, unknown>): Payment {
  const current = getPayment(id);
  const input = validatePayment(payload, current);
  db.prepare(`
    UPDATE payments SET plan_id = @planId, description = @description, amount = @amount,
      method = @method, installment = @installment, due_date = @dueDate, paid_at = @paidAt,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...input, id });
  return getPayment(id);
}

/** Baixa do pagamento: a data vem do servidor, não do cliente. */
export function settlePayment(id: number, paid: boolean): Payment {
  const current = getPayment(id);
  if (paid && current.paidAt) return current;
  db.prepare(`UPDATE payments SET paid_at = @paidAt, updated_at = datetime('now') WHERE id = @id`)
    .run({ id, paidAt: paid ? todayIso() : null });
  return getPayment(id);
}

export function deletePayment(id: number): void {
  const info = db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  if (info.changes === 0) throw notFound('Lançamento não encontrado.');
}

/** Soma já lançada para um plano (para saber quanto ainda falta cobrar). */
export function planBilling(planId: number): { total: number; billed: number; remaining: number } {
  const plan = getPlan(planId);
  const row = db.prepare('SELECT IFNULL(SUM(amount), 0) AS billed FROM payments WHERE plan_id = ?')
    .get(planId) as { billed: number };
  return { total: plan.total, billed: row.billed, remaining: Math.max(plan.total - row.billed, 0) };
}

/**
 * Gera as parcelas de um plano. O parcelamento é calculado no servidor:
 * a última parcela absorve a diferença de arredondamento, e o total lançado
 * nunca ultrapassa o valor do plano.
 */
export function billPlan(planId: number, payload: Record<string, unknown>): Payment[] {
  const plan = getPlan(planId);
  const billing = planBilling(planId);
  const amount = Number(payload.amount ?? billing.remaining);
  const parts = Number(payload.parts ?? 1);
  const method = String(payload.method ?? 'pix');
  const dueDate = cleanText(payload.dueDate ?? todayIso(), 10);

  const details: Record<string, string> = {};
  if (!Number.isFinite(amount) || amount <= 0) details.amount = 'Informe um valor maior que zero.';
  if (!Number.isInteger(parts) || parts < 1 || parts > 24) details.parts = 'O parcelamento deve ser de 1 a 24 vezes.';
  if (!PAY_METHODS[method]) details.method = 'Forma de pagamento inválida.';
  if (!isValidIsoDate(dueDate)) details.dueDate = 'Informe a data do primeiro vencimento.';
  if (Number.isFinite(amount) && amount > billing.remaining + 0.001) {
    details.amount = `O plano já tem ${billing.billed.toFixed(2)} lançado; restam ${billing.remaining.toFixed(2)}.`;
  }
  if (Object.keys(details).length) throw badRequest('Não foi possível gerar a cobrança.', details);

  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / parts);
  const created: Payment[] = [];

  db.transaction(() => {
    for (let i = 0; i < parts; i += 1) {
      const value = (i === parts - 1 ? cents - base * (parts - 1) : base) / 100;
      const [y, m, d] = dueDate.split('-').map(Number);
      const due = new Date(Date.UTC(y, m - 1 + i, d)).toISOString().slice(0, 10);
      const info = db.prepare(`
        INSERT INTO payments (patient_id, plan_id, description, amount, method, installment, due_date)
        VALUES (@patientId, @planId, @description, @amount, @method, @installment, @dueDate)
      `).run({
        patientId: plan.patientId,
        planId: plan.id,
        description: `${plan.title}${parts > 1 ? ` — parcela ${i + 1}/${parts}` : ''}`,
        amount: value,
        method,
        installment: parts > 1 ? `${i + 1}/${parts}` : '',
        dueDate: due
      });
      created.push(getPayment(Number(info.lastInsertRowid)));
    }
  })();

  return created;
}

export interface FinanceSummary {
  received: number;
  expected: number;
  open: number;
  overdue: number;
}

export function financeSummary(from?: string, to?: string): FinanceSummary {
  const inRange = (column: string) => {
    const parts: string[] = [];
    if (from) parts.push(`${column} >= @from`);
    if (to) parts.push(`${column} <= @to`);
    return parts.length ? `AND ${parts.join(' AND ')}` : '';
  };
  const params = { from, to, today: todayIso() };

  const received = db.prepare(
    `SELECT IFNULL(SUM(amount), 0) AS total FROM payments WHERE paid_at IS NOT NULL ${inRange('paid_at')}`
  ).get(params) as { total: number };
  const expected = db.prepare(
    `SELECT IFNULL(SUM(amount), 0) AS total FROM payments WHERE paid_at IS NULL ${inRange('due_date')}`
  ).get(params) as { total: number };
  const open = db.prepare(
    'SELECT IFNULL(SUM(amount), 0) AS total FROM payments WHERE paid_at IS NULL'
  ).get() as { total: number };
  const overdue = db.prepare(
    'SELECT IFNULL(SUM(amount), 0) AS total FROM payments WHERE paid_at IS NULL AND due_date < @today'
  ).get(params) as { total: number };

  return {
    received: received.total,
    expected: expected.total,
    open: open.total,
    overdue: overdue.total
  };
}
