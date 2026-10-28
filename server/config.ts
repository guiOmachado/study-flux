import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = process.cwd();
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
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
