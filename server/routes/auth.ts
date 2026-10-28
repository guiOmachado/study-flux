import { Router } from 'express';
import { get, run } from '../db';
import type { UserRow } from '../db';
import { createSession, destroySession, publicUser } from '../auth';
import { hashPassword, nowIso, verifyPassword } from '../util';
import { ensureDemoUser } from '../seed/demoUser';

export const authRouter = Router();

const failures = new Map<string, { count: number; until: number }>();

function checkLock(email: string): string | null {
  const entry = failures.get(email);
  if (entry && entry.until > Date.now()) {
    const seconds = Math.ceil((entry.until - Date.now()) / 1000);
    return `Muitas tentativas. Tente novamente em ${seconds}s.`;
  }
  return null;
}

function registerFailure(email: string): void {
  const entry = failures.get(email) ?? { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= 8) {
    entry.until = Date.now() + 5 * 60_000;
    entry.count = 0;
  }
  failures.set(email, entry);
}

authRouter.post('/register', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (name.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (password.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (get('SELECT id FROM users WHERE email = ?', email)) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  }
  const result = run(
    'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    name,
    email,
    hashPassword(password),
    'student',
    nowIso(),
  );
  const user = get<UserRow>('SELECT * FROM users WHERE id = ?', Number(result.lastInsertRowid))!;
  createSession(res, user.id);
  return res.status(201).json({ user: publicUser(user) });
});

authRouter.post('/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const locked = checkLock(email);
  if (locked) return res.status(429).json({ error: locked });
  const user = get<UserRow>('SELECT * FROM users WHERE email = ?', email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    registerFailure(email);
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  failures.delete(email);
  createSession(res, user.id);
  return res.json({ user: publicUser(user) });
});

authRouter.post('/demo', (_req, res) => {
  const user = ensureDemoUser();
  createSession(res, user.id);
  return res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  return res.json({ user: publicUser(req.user) });
});

authRouter.patch('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  const name = String(req.body?.name ?? '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
  run('UPDATE users SET name = ? WHERE id = ?', name, req.user.id);
  const user = get<UserRow>('SELECT * FROM users WHERE id = ?', req.user.id)!;
  return res.json({ user: publicUser(user) });
});
