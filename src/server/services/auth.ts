import crypto from 'crypto';
import { db } from '../db';
import { unauthorized } from '../utils/http';

/**
 * Autenticação simples baseada em sessão assinada.
 * A senha fica sempre no banco como hash + salt (scrypt) e nunca no front-end.
 * Para trocar por um provedor real basta substituir verifyPassword/createSession.
 */
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
export const SESSION_COOKIE = 'odontocare_session';

export const DEMO_PASSWORD = process.env.DENTIST_PASSWORD || '123';
export const INVALID_PASSWORD_MESSAGE = 'Senha incorreta. Verifique suas credenciais.';

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function ensureDentistUser(): void {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('dentista');
  if (existing) return;
  const { salt, hash } = hashPassword(DEMO_PASSWORD);
  db.prepare(`
    INSERT INTO users (username, name, role, password_salt, password_hash)
    VALUES ('dentista', 'Dra. Helena Vasconcelos', 'dentist', ?, ?)
  `).run(salt, hash);
}

export function verifyPassword(password: string): { id: number; name: string; role: string } {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('dentista') as
    | { id: number; name: string; role: string; password_salt: string; password_hash: string }
    | undefined;
  if (!user) throw unauthorized(INVALID_PASSWORD_MESSAGE);

  const candidate = crypto.scryptSync(String(password ?? ''), user.password_salt, 64);
  const stored = Buffer.from(user.password_hash, 'hex');
  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    throw unauthorized(INVALID_PASSWORD_MESSAGE);
  }
  return { id: user.id, name: user.name, role: user.role };
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

export function createSessionToken(userId: number): string {
  const payload = `${userId}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): { userId: number } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  const payload = `${userId}.${expiresAt}`;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expiresAt) < Date.now()) return null;
  return { userId: Number(userId) };
}
