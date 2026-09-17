import { Router } from 'express';
import { createSessionToken, SESSION_COOKIE, verifyPassword } from '../services/auth';
import { currentSession } from '../middleware';
import { getSettings } from '../services/settings';

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const password = String(req.body?.password ?? '');
  const user = verifyPassword(password);
  const token = createSessionToken(user.id);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 8
  });
  res.json({ ok: true, data: { name: user.name, role: user.role, redirect: '/dentista' } });
});

authRoutes.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true, data: { loggedOut: true } });
});

authRoutes.get('/session', (req, res) => {
  const session = currentSession(req);
  const settings = getSettings();
  res.json({
    ok: true,
    data: {
      authenticated: Boolean(session),
      dentistName: session ? settings.dentistName : null,
      dentistTitle: session ? settings.dentistTitle : null,
      clinicName: settings.clinicName
    }
  });
});
