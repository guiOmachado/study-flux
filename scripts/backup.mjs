/**
 * Backup consistente do SQLite (sem parar o servidor).
 *
 * Usa `VACUUM INTO`, que gera uma cópia íntegra mesmo com o banco em uso —
 * diferente de copiar o arquivo, que pode pegar um estado intermediário do
 * WAL e resultar em backup corrompido.
 *
 * Uso:
 *   npm run db:backup
 *   DATA_DIR=/data npm run db:backup
 *   BACKUP_DIR=/backups BACKUP_KEEP=14 npm run db:backup
 *
 * `BACKUP_KEEP` (padrão 7) mantém os N arquivos mais recentes da pasta.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'studyflux.db');
const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(DATA_DIR, 'backups');
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP ?? 7) || 7);

if (!fs.existsSync(DB_PATH)) {
  console.error(`Banco não encontrado em ${DB_PATH}.`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = path.join(BACKUP_DIR, `studyflux-${stamp}.db`);

const db = new DatabaseSync(DB_PATH, { readOnly: true });
try {
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

const size = fs.statSync(target).size;
const files = fs
  .readdirSync(BACKUP_DIR)
  .filter((name) => name.startsWith('studyflux-') && name.endsWith('.db'))
  .sort()
  .reverse();

for (const name of files.slice(KEEP)) {
  fs.unlinkSync(path.join(BACKUP_DIR, name));
}

console.log(`Backup criado: ${target} (${(size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Mantidos: ${Math.min(files.length, KEEP)} arquivo(s) em ${BACKUP_DIR}`);
