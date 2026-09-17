import { NextFunction, Request, Response } from 'express';
import { readSessionToken, SESSION_COOKIE } from './services/auth';
import { ApiError } from './utils/http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function parseCookies(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  (req as Request & { cookies: Record<string, string> }).cookies = cookies;
  next();
}

export function currentSession(req: Request): { userId: number } | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies || {};
  return readSessionToken(cookies[SESSION_COOKIE]);
}

/** Protege todas as rotas do dentista (API e páginas). */
export function requireDentist(req: Request, res: Response, next: NextFunction): void {
  const session = currentSession(req);
  if (!session) {
    // dentro de um Router, req.path é relativo ao mount: usar a URL original
    if ((req.originalUrl || req.path).startsWith('/api')) {
      res.status(401).json({
        ok: false,
        error: { code: 'unauthorized', message: 'Sessão expirada. Faça login novamente.' }
      });
      return;
    }
    res.redirect('/?login=1');
    return;
  }
  req.userId = session.userId;
  next();
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details ?? undefined }
    });
    return;
  }
  // Nunca expor stack trace ou erro bruto do banco para o cliente.
  console.error('[erro interno]', err);
  res.status(500).json({
    ok: false,
    error: { code: 'internal_error', message: 'Ocorreu um erro inesperado. Tente novamente.' }
  });
}
