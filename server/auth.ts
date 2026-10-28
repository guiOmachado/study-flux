import type { NextFunction, Request, Response } from 'express';
import { get, run, type UserRow } from './db';
import { newToken, nowIso, parseCookies } from './util';

const COOKIE = 'sf_session';
const SESSION_DAYS = 30;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export function createSession(res: Response, userId: number): string {
  const token = newToken();
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86_400_000);
  run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, userId, created.toISOString(), expires.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400_000,
  });
  return token;
}

export function destroySession(req: Request, res: Response): void {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  res.clearCookie(COOKIE, { path: '/' });
}

export function currentUser(req: Request): UserRow | null {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const row = get<UserRow & { expires_at: string }>(
    `SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    token,
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  const { expires_at: _expires, ...user } = row;
  return user;
}

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const user = currentUser(req);
  if (user) req.user = user;
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'É preciso entrar para continuar.' });
    return;
  }
  next();
}

export function publicUser(u: UserRow) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.created_at };
}

export { COOKIE, nowIso };
