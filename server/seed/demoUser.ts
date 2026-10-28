import type { CaseContent } from '../../shared/types';
import { db, get, getMeta, run, setMeta, type CaseRow, type UserRow } from '../db';
import { analyzeSource } from '../ingestion/analyze';
import { generateStructured } from '../generation/structured';
import { hashPassword, nowIso } from '../util';
import { upsertCard } from '../srs';
import { DEMO_CASES } from './demoCases';
import { SAMPLE_CHAPTER, SAMPLE_EXAM } from './sampleSources';

export const DEMO_EMAIL = 'demo@studyflux.app';
export const DEMO_PASSWORD = 'estudar123';
const SEED_VERSION = 'v1';

function insertCase(
  userId: number,
  content: CaseContent,
  status: string,
  origin: string,
  sourceId: number | null,
  slug: string,
): number {
  const now = nowIso();
  const result = run(
    `INSERT INTO cases (user_id, source_id, slug, title, area, topic, difficulty, status, origin, format, minutes, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    sourceId,
    slug,
    content.title,
    content.area,
    content.topic,
    content.difficulty,
    status,
    origin,
    content.format,
    content.minutes,
    JSON.stringify(content),
    now,
    now,
  );
  return Number(result.lastInsertRowid);
}

function seedSources(userId: number): void {
  const sources = [
    { title: 'Resumo — Hipertensão arterial sistêmica (demo)', text: SAMPLE_CHAPTER, discipline: 'Clínica Médica', filename: 'resumo-has.md' },
    { title: 'Prova de Clínica Médica 2023 (demo)', text: SAMPLE_EXAM, discipline: 'Clínica Médica', filename: 'prova-clinica-2023.md' },
  ];
  for (const item of sources) {
    const parsed = analyzeSource(item.text, item.title, item.discipline);
    const now = nowIso();
    const result = run(
      `INSERT INTO sources (user_id, title, kind, discipline, filename, mime, text, pages, chars, status, analysis, created_at)
       VALUES (?, ?, ?, ?, ?, 'text/markdown', ?, NULL, ?, 'gerado', ?, ?)`,
      userId,
      item.title,
      parsed.kind,
      item.discipline,
      item.filename,
      item.text,
      item.text.length,
      JSON.stringify({
        kind: parsed.kind,
        sections: parsed.sections.slice(0, 12).map((s) => ({ heading: s.heading, type: s.type, facts: s.facts.length })),
        topics: parsed.topics,
        conditions: parsed.conditions,
        examQuestions: parsed.questions.length,
        examQuestionsWithKey: parsed.questions.filter((q) => q.answerLetter).length,
        words: parsed.words,
        readingMinutes: Math.max(1, Math.round(parsed.words / 200)),
        warnings: parsed.warnings,
      }),
      now,
    );
    const sourceId = Number(result.lastInsertRowid);
    const generated = generateStructured(parsed, item.title);
    for (const generatedCase of generated) {
      insertCase(userId, generatedCase.content, 'publicado', 'estruturado', sourceId, `demo-s${sourceId}-${generatedCase.key}`);
    }
  }
}

function seedHistory(userId: number, caseIds: number[]): void {
  const patterns = [
    { daysAgo: 4, correct: [1, 1, 0, 1] },
    { daysAgo: 2, correct: [1, 0, 0, 1] },
    { daysAgo: 1, correct: [1, 1, 1, 0] },
  ];
  for (const [index, pattern] of patterns.entries()) {
    const caseId = caseIds[index % Math.max(1, caseIds.length)];
    if (!caseId) continue;
    const row = get<CaseRow>('SELECT * FROM cases WHERE id = ?', caseId);
    if (!row) continue;
    const content = JSON.parse(row.data) as CaseContent;
    if (content.questions.length === 0) continue;
    const started = new Date(Date.now() - pattern.daysAgo * 86_400_000);
    started.setHours(19, 10, 0, 0);
    const finished = new Date(started.getTime() + 1000 * 60 * 12);
    const score = content.questions.filter((_, qi) => pattern.correct[qi % pattern.correct.length]).length;
    const attemptId = Number(
      run(
        `INSERT INTO attempts (user_id, case_id, case_title, area, topic, mode, status, score, total, started_at, finished_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, 'treino', 'concluido', ?, ?, ?, ?, ?)`,
        userId,
        row.id,
        row.title,
        row.area,
        row.topic ?? '',
        score,
        content.questions.length,
        started.toISOString(),
        finished.toISOString(),
        finished.getTime() - started.getTime(),
      ).lastInsertRowid,
    );
    content.questions.forEach((question, qi) => {
      const isCorrect = Boolean(pattern.correct[qi % pattern.correct.length]);
      const correctOption = question.options.find((o) => o.id === question.correctOptionId);
      const chosen = isCorrect ? question.correctOptionId : question.options.find((o) => o.id !== question.correctOptionId)?.id ?? null;
      const at = new Date(started.getTime() + (qi + 1) * 45_000);
      run(
        `INSERT INTO answers (attempt_id, user_id, case_id, question_id, area, topic, option_id, correct, time_ms, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        attemptId,
        userId,
        row.id,
        question.id,
        row.area,
        row.topic,
        chosen,
        isCorrect ? 1 : 0,
        35_000 + qi * 4000,
        JSON.stringify({
          questionId: question.id,
          prompt: question.prompt,
          correctOptionId: question.correctOptionId,
          chosenOptionId: chosen,
          correct: isCorrect,
          rationale: question.rationale,
          keyPoint: question.keyPoint,
          sourceExcerpt: question.sourceExcerpt,
          timeMs: 35_000 + qi * 4000,
          stage: question.stage,
        }),
        at.toISOString(),
      );
      if (!isCorrect && correctOption) {
        upsertCard({
          userId,
          caseId: row.id,
          questionId: question.id,
          caseTitle: row.title,
          front: question.prompt,
          back: `${correctOption.text}\n\n${question.rationale}`,
          area: row.area,
          topic: row.topic,
          dueAt: nowIso(),
        });
      }
    });
  }
}

function seedDemoContent(user: UserRow): void {
  if (getMeta('demo_seed_version') === SEED_VERSION) return;
  db.exec('BEGIN');
  try {
    const caseIds: number[] = [];
    DEMO_CASES.forEach((content, index) => {
      const existing = get<CaseRow>('SELECT * FROM cases WHERE slug = ?', `demo-case-${index + 1}`);
      if (existing) {
        caseIds.push(existing.id);
        return;
      }
      caseIds.push(insertCase(user.id, content, 'publicado', 'demo', null, `demo-case-${index + 1}`));
    });
    seedSources(user.id);
    seedHistory(user.id, caseIds);
    setMeta('demo_seed_version', SEED_VERSION);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function ensureDemoUser(): UserRow {
  let user = get<UserRow>('SELECT * FROM users WHERE email = ?', DEMO_EMAIL);
  if (!user) {
    run(
      'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      'Ana (conta demo)',
      DEMO_EMAIL,
      hashPassword(DEMO_PASSWORD),
      'student',
      nowIso(),
    );
    user = get<UserRow>('SELECT * FROM users WHERE email = ?', DEMO_EMAIL)!;
  }
  seedDemoContent(user);
  return user;
}
