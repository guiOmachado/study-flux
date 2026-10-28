import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = process.cwd();
/**
 * Onde ficam o banco e o segredo. Ordem: DATA_DIR explícito → volume do Railway
 * (a variável é injetada pela plataforma) → pasta `data/` local.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
    : path.join(ROOT, 'data');
export const DB_PATH = path.join(DATA_DIR, 'studyflux.db');
export const WEB_DIST = path.join(ROOT, 'web', 'dist');
export const PORT = Number(process.env.PORT ?? 8787);

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadSecret(): string {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const file = path.join(DATA_DIR, 'app.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const APP_SECRET = loadSecret();
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_CHARS = 600_000;

/**
 * Conta demo (`demo@studyflux.app`) é ótima para avaliação e ruim para produção
 * aberta: todo mundo entra na mesma conta e vê os mesmos dados.
 * Em deploy público, use SEED_DEMO=0.
 */
export const SEED_DEMO = !['0', 'false', 'off'].includes(String(process.env.SEED_DEMO ?? '').toLowerCase());

/**
 * Cookie de sessão com `Secure`. Em `auto` (padrão) acompanha o protocolo da
 * requisição — funciona em http://localhost e vira secure atrás de HTTPS.
 * Forçar `always` exige HTTPS; `never` só para depuração.
 */
export type CookieSecureMode = 'auto' | 'always' | 'never';
const rawCookieSecure = String(process.env.COOKIE_SECURE ?? 'auto').toLowerCase();
export const COOKIE_SECURE: CookieSecureMode =
  rawCookieSecure === 'always' || rawCookieSecure === 'true' ? 'always' : rawCookieSecure === 'never' || rawCookieSecure === 'false' ? 'never' : 'auto';

/**
 * Salto de proxy confiável para ler X-Forwarded-For/Proto e limitar busca anônima
 * por visitante. `0` desliga (rede local sem proxy).
 */
export const TRUST_PROXY = process.env.TRUST_PROXY === '0' || process.env.TRUST_PROXY === 'false' ? false : 1;
