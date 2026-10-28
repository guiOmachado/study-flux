import type { CardRow } from './db';
import { all, get, run } from './db';
import type { SrsCardDTO, SrsGrade } from '../shared/types';
import { nowIso } from './util';

/** Algoritmo SM-2 simplificado (mesma família usada pelo Anki). */
export function reviewCard(card: CardRow, grade: SrsGrade, reviewedAt = new Date()): {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string;
} {
  let { ease, interval_days: interval, reps, lapses } = card;
  const quality = grade === 'errei' ? 1 : grade === 'dificil' ? 3 : grade === 'bom' ? 4 : 5;

  if (quality < 3) {
    reps = 0;
    lapses += 1;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = grade === 'facil' ? 4 : 3;
    else {
      const factor = grade === 'dificil' ? 1.2 : grade === 'facil' ? ease * 1.3 : ease;
      interval = Math.max(1, Math.round(interval * factor));
    }
    ease = Math.max(1.3, Math.min(3.2, ease + (grade === 'facil' ? 0.15 : grade === 'dificil' ? -0.15 : 0)));
  }
  interval = Math.min(interval, 180);
  const due = new Date(reviewedAt.getTime() + interval * 86_400_000);
  return { ease, intervalDays: interval, reps, lapses, dueAt: due.toISOString() };
}

export function upsertCard(input: {
  userId: number;
  caseId: number | null;
  questionId: string;
  caseTitle: string;
  front: string;
  back: string;
  area: string | null;
  topic: string | null;
  dueAt?: string;
}): void {
  const existing = get<CardRow>(
    'SELECT * FROM cards WHERE user_id = ? AND case_id IS ? AND question_id = ?',
    input.userId,
    input.caseId,
    input.questionId,
  );
  if (existing) {
    run(
      'UPDATE cards SET front = ?, back = ?, area = ?, topic = ?, case_title = ? WHERE id = ?',
      input.front,
      input.back,
      input.area,
      input.topic,
      input.caseTitle,
      existing.id,
    );
    return;
  }
  run(
    `INSERT INTO cards (user_id, case_id, question_id, case_title, front, back, area, topic, due_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId,
    input.caseId,
    input.questionId,
    input.caseTitle,
    input.front,
    input.back,
    input.area,
    input.topic,
    input.dueAt ?? nowIso(),
    nowIso(),
  );
}

export function toCardDTO(row: CardRow): SrsCardDTO {
  return {
    id: row.id,
    caseId: row.case_id,
    caseTitle: row.case_title,
    front: row.front,
    back: row.back,
    area: row.area,
    topic: row.topic,
    ease: row.ease,
    intervalDays: row.interval_days,
    reps: row.reps,
    lapses: row.lapses,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
  };
}

export function dueCards(userId: number, limit = 50): CardRow[] {
  return all<CardRow>(
    'SELECT * FROM cards WHERE user_id = ? AND due_at <= ? ORDER BY due_at ASC LIMIT ?',
    userId,
    nowIso(),
    limit,
  );
}
