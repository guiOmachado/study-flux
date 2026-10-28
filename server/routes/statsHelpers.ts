import type { AttemptDTO, AttemptMode, AttemptQuestionResult } from '../../shared/types';
import { all, type AnswerRow, type AttemptRow } from '../db';
import { safeJson } from '../util';

export function attemptDTO(row: AttemptRow): AttemptDTO {
  const answers = all<AnswerRow>('SELECT * FROM answers WHERE attempt_id = ? ORDER BY id ASC', row.id);
  const results = answers
    .map((a) => safeJson<AttemptQuestionResult | null>(a.data, null))
    .filter((r): r is AttemptQuestionResult => Boolean(r));
  return {
    id: row.id,
    caseId: row.case_id,
    caseTitle: row.case_title,
    area: row.area,
    topic: row.topic,
    mode: row.mode as AttemptMode,
    status: row.status as AttemptDTO['status'],
    score: row.score,
    total: row.total,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    batchId: row.batch_id,
    results,
  };
}
