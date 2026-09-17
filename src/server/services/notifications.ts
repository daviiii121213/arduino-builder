import { db } from '../db';
import { NotificationRow } from '../types';

export type NotificationType =
  | 'novo_agendamento'
  | 'cancelamento'
  | 'consulta_proxima'
  | 'consulta_criada'
  | 'status_alterado'
  | 'paciente_criado';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  appointmentId: number | null;
  patientId: number | null;
  read: boolean;
  createdAt: string;
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    read: row.read === 1,
    createdAt: row.created_at
  };
}

export function pushNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
  appointmentId?: number | null;
  patientId?: number | null;
}): Notification {
  const info = db.prepare(`
    INSERT INTO notifications (type, title, message, appointment_id, patient_id)
    VALUES (@type, @title, @message, @appointmentId, @patientId)
  `).run({
    type: input.type,
    title: input.title,
    message: input.message,
    appointmentId: input.appointmentId ?? null,
    patientId: input.patientId ?? null
  });
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?')
    .get(info.lastInsertRowid) as NotificationRow;
  return mapNotification(row);
}

export function listNotifications(limit = 30): { items: Notification[]; unread: number } {
  const rows = db.prepare(
    'SELECT * FROM notifications ORDER BY datetime(created_at) DESC, id DESC LIMIT ?'
  ).all(limit) as NotificationRow[];
  const unread = (db.prepare('SELECT COUNT(*) AS total FROM notifications WHERE read = 0')
    .get() as { total: number }).total;
  return { items: rows.map(mapNotification), unread };
}

export function markAllRead(): void {
  db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
}

export function markRead(id: number): void {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}
