import { db } from '../db';
import { badRequest, notFound } from '../utils/http';
import { cleanOptional, cleanText } from '../utils/sanitize';
import { getPatient } from './patients';
import { getServiceRow } from './catalog';
import { pushNotification } from './notifications';

export const PLAN_STATUS: Record<string, string> = {
  proposto: 'Proposto',
  aprovado: 'Aprovado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  recusado: 'Recusado'
};

export const ITEM_STATUS: Record<string, string> = {
  pendente: 'Pendente',
  concluido: 'Concluído'
};

export interface PlanItem {
  id: number;
  serviceId: number | null;
  name: string;
  tooth: string;
  price: number;
  status: string;
}

export interface TreatmentPlan {
  id: number;
  patientId: number;
  patientName: string;
  title: string;
  status: string;
  statusLabel: string;
  discount: number;
  items: PlanItem[];
  itemsTotal: number;
  /** Total sempre recalculado a partir dos itens: nunca vem do cliente. */
  total: number;
  completedItems: number;
  createdAt: string;
  updatedAt: string;
}

interface PlanRow {
  id: number;
  patient_id: number;
  title: string;
  status: string;
  discount: number;
  created_at: string;
  updated_at: string;
  patient_name: string;
}

interface ItemRow {
  id: number;
  plan_id: number;
  service_id: number | null;
  name: string;
  tooth: string;
  price: number;
  status: string;
  position: number;
}

function mapPlan(row: PlanRow): TreatmentPlan {
  const items = (db.prepare(
    'SELECT * FROM treatment_plan_items WHERE plan_id = ? ORDER BY position ASC, id ASC'
  ).all(row.id) as ItemRow[]).map((i) => ({
    id: i.id,
    serviceId: i.service_id,
    name: i.name,
    tooth: i.tooth,
    price: i.price,
    status: i.status
  }));

  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    title: row.title,
    status: row.status,
    statusLabel: PLAN_STATUS[row.status] ?? row.status,
    discount: row.discount,
    items,
    itemsTotal,
    total: Math.max(itemsTotal - row.discount, 0),
    completedItems: items.filter((i) => i.status === 'concluido').length,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const SELECT = `
  SELECT p.*, pt.name AS patient_name
  FROM treatment_plans p
  JOIN patients pt ON pt.id = p.patient_id
`;

export function getPlan(id: number): TreatmentPlan {
  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as PlanRow | undefined;
  if (!row) throw notFound('Plano de tratamento não encontrado.');
  return mapPlan(row);
}

export function listPlans(filters: { patientId?: number; status?: string } = {}): TreatmentPlan[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filters.patientId) { where.push('p.patient_id = @patientId'); params.patientId = filters.patientId; }
  if (filters.status && PLAN_STATUS[filters.status]) { where.push('p.status = @status'); params.status = filters.status; }

  const rows = db.prepare(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY datetime(p.created_at) DESC, p.id DESC`
  ).all(params) as PlanRow[];
  return rows.map(mapPlan);
}

interface NormalizedItem {
  serviceId: number | null;
  name: string;
  tooth: string;
  price: number;
  status: string;
}

/**
 * Cada item nasce de um serviço do catálogo: nome e preço padrão vêm do banco.
 * A clínica pode ajustar o valor do item (desconto ou acréscimo negociado),
 * mas nunca o portal do paciente — os endpoints de plano são restritos.
 */
function normalizeItems(raw: unknown): NormalizedItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw badRequest('Adicione ao menos um item ao plano.', { items: 'Nenhum item informado.' });
  }
  return raw.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const service = getServiceRow(Number(item.serviceId));
    const price = item.price === undefined || item.price === null || item.price === ''
      ? service.price
      : Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      throw badRequest('Verifique os itens do plano.', { items: `Valor inválido no item ${index + 1}.` });
    }
    const status = String(item.status ?? 'pendente');
    if (!ITEM_STATUS[status]) {
      throw badRequest('Verifique os itens do plano.', { items: `Status inválido no item ${index + 1}.` });
    }
    return {
      serviceId: service.id,
      name: service.name,
      tooth: cleanOptional(item.tooth, 40) ?? '',
      price,
      status
    };
  });
}

function writeItems(planId: number, items: NormalizedItem[]): void {
  db.prepare('DELETE FROM treatment_plan_items WHERE plan_id = ?').run(planId);
  const insert = db.prepare(`
    INSERT INTO treatment_plan_items (plan_id, service_id, name, tooth, price, status, position)
    VALUES (@planId, @serviceId, @name, @tooth, @price, @status, @position)
  `);
  items.forEach((item, position) => insert.run({ ...item, planId, position }));
}

export function createPlan(patientId: number, payload: Record<string, unknown>): TreatmentPlan {
  const patient = getPatient(patientId);
  const title = cleanText(payload.title, 140);
  const discount = Number(payload.discount ?? 0);
  const status = String(payload.status ?? 'proposto');

  const details: Record<string, string> = {};
  if (title.length < 3) details.title = 'Dê um nome ao plano de tratamento.';
  if (!Number.isFinite(discount) || discount < 0) details.discount = 'Desconto inválido.';
  if (!PLAN_STATUS[status]) details.status = 'Status inválido.';
  if (Object.keys(details).length) throw badRequest('Verifique os dados do plano.', details);

  const items = normalizeItems(payload.items);
  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  if (discount > itemsTotal) {
    throw badRequest('Desconto maior que o total dos itens.', {
      discount: 'O desconto não pode ultrapassar o valor dos itens.'
    });
  }

  const plan = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO treatment_plans (patient_id, title, status, discount)
      VALUES (@patientId, @title, @status, @discount)
    `).run({ patientId, title, status, discount });
    const id = Number(info.lastInsertRowid);
    writeItems(id, items);
    return id;
  })();

  pushNotification({
    type: 'consulta_criada',
    title: 'Plano de tratamento criado',
    message: `${patient.name} — ${title}.`,
    patientId
  });
  return getPlan(plan);
}

export function updatePlan(id: number, payload: Record<string, unknown>): TreatmentPlan {
  const current = getPlan(id);
  const title = cleanText(payload.title ?? current.title, 140);
  const discount = Number(payload.discount ?? current.discount);
  const status = String(payload.status ?? current.status);

  const details: Record<string, string> = {};
  if (title.length < 3) details.title = 'Dê um nome ao plano de tratamento.';
  if (!Number.isFinite(discount) || discount < 0) details.discount = 'Desconto inválido.';
  if (!PLAN_STATUS[status]) details.status = 'Status inválido.';
  if (Object.keys(details).length) throw badRequest('Verifique os dados do plano.', details);

  const items = payload.items === undefined
    ? current.items.map((i) => ({
        serviceId: i.serviceId, name: i.name, tooth: i.tooth, price: i.price, status: i.status
      }))
    : normalizeItems(payload.items);

  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  if (discount > itemsTotal) {
    throw badRequest('Desconto maior que o total dos itens.', {
      discount: 'O desconto não pode ultrapassar o valor dos itens.'
    });
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE treatment_plans SET title = @title, status = @status, discount = @discount,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({ id, title, status, discount });
    if (payload.items !== undefined) writeItems(id, items as NormalizedItem[]);
  })();

  const plan = getPlan(id);
  if (status !== current.status) {
    pushNotification({
      type: 'status_alterado',
      title: 'Plano de tratamento atualizado',
      message: `${plan.patientName} — ${plan.title}: ${plan.statusLabel}.`,
      patientId: plan.patientId
    });
  }
  return plan;
}

/** Marca um item como concluído ou pendente sem reenviar o plano inteiro. */
export function setItemStatus(planId: number, itemId: number, status: string): TreatmentPlan {
  if (!ITEM_STATUS[status]) throw badRequest('Status do item inválido.', { status: 'Use pendente ou concluido.' });
  const info = db.prepare('UPDATE treatment_plan_items SET status = ? WHERE id = ? AND plan_id = ?')
    .run(status, itemId, planId);
  if (info.changes === 0) throw notFound('Item do plano não encontrado.');
  db.prepare(`UPDATE treatment_plans SET updated_at = datetime('now') WHERE id = ?`).run(planId);
  return getPlan(planId);
}

export function deletePlan(id: number): void {
  const info = db.prepare('DELETE FROM treatment_plans WHERE id = ?').run(id);
  if (info.changes === 0) throw notFound('Plano de tratamento não encontrado.');
}

/** Aceite do orçamento pelo próprio paciente, a partir do portal. */
export function acceptPlan(id: number): TreatmentPlan {
  const plan = getPlan(id);
  if (plan.status !== 'proposto') {
    throw badRequest('Este orçamento não está aguardando aprovação.');
  }
  db.prepare(`UPDATE treatment_plans SET status = 'aprovado', updated_at = datetime('now') WHERE id = ?`).run(id);
  pushNotification({
    type: 'status_alterado',
    title: 'Orçamento aprovado pelo paciente',
    message: `${plan.patientName} aceitou o plano "${plan.title}".`,
    patientId: plan.patientId
  });
  return getPlan(id);
}
