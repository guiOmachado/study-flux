import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config';

export const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'outro',
  discipline TEXT,
  filename TEXT,
  mime TEXT,
  text TEXT NOT NULL DEFAULT '',
  pages INTEGER,
  chars INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processando',
  error TEXT,
  analysis TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'rascunho',
  origin TEXT NOT NULL DEFAULT 'manual',
  format TEXT NOT NULL DEFAULT 'caso',
  minutes INTEGER NOT NULL DEFAULT 8,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_source ON cases(source_id);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  case_title TEXT NOT NULL,
  area TEXT NOT NULL,
  topic TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'treino',
  batch_id TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, started_at);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id INTEGER,
  question_id TEXT NOT NULL,
  area TEXT,
  topic TEXT,
  option_id TEXT,
  correct INTEGER NOT NULL,
  time_ms INTEGER NOT NULL DEFAULT 0,
  data TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id, created_at);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  question_id TEXT,
  case_title TEXT,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  area TEXT,
  topic TEXT,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(user_id, due_at);
`);

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export interface SourceRow {
  id: number;
  user_id: number;
  title: string;
  kind: string;
  discipline: string | null;
  filename: string | null;
  mime: string | null;
  text: string;
  pages: number | null;
  chars: number;
  status: string;
  error: string | null;
  analysis: string | null;
  created_at: string;
}

export interface CaseRow {
  id: number;
  user_id: number;
  source_id: number | null;
  slug: string | null;
  title: string;
  area: string;
  topic: string | null;
  difficulty: string;
  status: string;
  origin: string;
  format: string;
  minutes: number;
  data: string;
  created_at: string;
  updated_at: string;
}

export interface AttemptRow {
  id: number;
  user_id: number;
  case_id: number | null;
  case_title: string;
  area: string;
  topic: string;
  mode: string;
  batch_id: string | null;
  status: string;
  score: number;
  total: number;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface AnswerRow {
  id: number;
  attempt_id: number;
  user_id: number;
  case_id: number | null;
  question_id: string;
  area: string | null;
  topic: string | null;
  option_id: string | null;
  correct: number;
  time_ms: number;
  data: string | null;
  created_at: string;
}

export interface CardRow {
  id: number;
  user_id: number;
  case_id: number | null;
  question_id: string | null;
  case_title: string | null;
  front: string;
  back: string;
  area: string | null;
  topic: string | null;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at: string;
  created_at: string;
  last_reviewed_at: string | null;
}

export function all<T>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function get<T>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as never[]));
}

export function getMeta(key: string): string | null {
  const row = get<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

// Migrações leves para bancos já existentes.
function ensureColumn(table: string, column: string, definition: string): void {
  const rows = all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!rows.some((r) => r.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('answers', 'data', 'TEXT');
