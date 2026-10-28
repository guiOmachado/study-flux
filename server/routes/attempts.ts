import { Router } from 'express';
import crypto from 'node:crypto';
import type { AttemptMode, AttemptQuestionResult } from '../../shared/types';
import { requireUser } from '../auth';
import { all, get, run, type AnswerRow, type AttemptRow, type CaseRow } from '../db';
import { caseContent, playableCase } from './helpers';
import { nowIso } from '../util';
import { readSettings } from '../settings';
import { upsertCard } from '../srs';
import { attemptDTO } from './statsHelpers';

export const attemptsRouter = Router();
attemptsRouter.use(requireUser);

const MODES: AttemptMode[] = ['treino', 'simulado', 'revisao'];

function caseForUser(id: number, userId: number) {
  return get<CaseRow & { source_title: string | null }>(
    `SELECT c.*, s.title AS source_title FROM cases c LEFT JOIN sources s ON s.id = c.source_id
     WHERE c.id = ? AND (c.user_id = ? OR c.status = 'publicado')`,
    id,
    userId,
  );
}

function startAttempt(userId: number, caseRow: CaseRow & { source_title: string | null }, mode: AttemptMode, batchId: string | null) {
  const data = caseContent(caseRow);
  const now = nowIso();
  const result = run(
    `INSERT INTO attempts (user_id, case_id, case_title, area, topic, mode, batch_id, status, score, total, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'em_andamento', 0, ?, ?)`,
    userId,
    caseRow.id,
    caseRow.title,
    caseRow.area,
    caseRow.topic ?? '',
    mode,
    batchId,
    data.questions.length,
    now,
  );
  const attempt = get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', Number(result.lastInsertRowid))!;
  return { attempt, caseData: data };
}

attemptsRouter.post('/', (req, res) => {
  const mode = MODES.includes(req.body?.mode) ? (req.body.mode as AttemptMode) : 'treino';
  const caseRow = caseForUser(Number(req.body?.caseId), req.user!.id);
  if (!caseRow) return res.status(404).json({ error: 'Caso não encontrado.' });
  const { attempt } = startAttempt(req.user!.id, caseRow, mode, String(req.body?.batchId ?? '') || null);
  return res.status(201).json({ attempt: attemptDTO(attempt), case: playableCase(caseRow) });
});

attemptsRouter.post('/start-batch', (req, res) => {
  const mode = MODES.includes(req.body?.mode) ? (req.body.mode as AttemptMode) : 'simulado';
  const limit = Math.min(10, Math.max(1, Number(req.body?.limit ?? 5) || 5));
  const area = String(req.body?.area ?? '').trim();
  const requestedIds: number[] = Array.isArray(req.body?.caseIds) ? req.body.caseIds.map(Number).filter(Boolean) : [];

  let rows: (CaseRow & { source_title: string | null })[] = [];
  if (requestedIds.length > 0) {
    rows = requestedIds
      .map((id) => caseForUser(id, req.user!.id))
      .filter((row): row is CaseRow & { source_title: string | null } => Boolean(row));
  } else {
    const params: unknown[] = [req.user!.id, 'publicado'];
    let areaFilter = '';
    if (area) {
      areaFilter = ' AND c.area = ?';
      params.push(area);
    }
    const own = all<CaseRow & { source_title: string | null }>(
      `SELECT c.*, s.title AS source_title FROM cases c LEFT JOIN sources s ON s.id = c.source_id
       WHERE (c.user_id = ? OR c.status = ?) ${areaFilter} AND c.status != 'arquivado'
       ORDER BY RANDOM() LIMIT ?`,
      ...params,
      limit,
    );
    rows = own;
  }
  if (rows.length === 0) {
    return res.status(422).json({ error: 'Nenhum caso disponível para montar o simulado. Gere casos a partir de um material primeiro.' });
  }
  const batchId = crypto.randomUUID();
  const items = rows.slice(0, limit).map((row) => {
    const { attempt } = startAttempt(req.user!.id, row, mode, batchId);
    return { attemptId: attempt.id, attempt: attemptDTO(attempt), case: playableCase(row) };
  });
  return res.status(201).json({ batchId, items });
});

attemptsRouter.get('/', (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
  const rows = all<AttemptRow>('SELECT * FROM attempts WHERE user_id = ? ORDER BY started_at DESC LIMIT ?', req.user!.id, limit);
  res.json({ attempts: rows.map(attemptDTO) });
});

attemptsRouter.get('/:id', (req, res) => {
  const row = get<AttemptRow>('SELECT * FROM attempts WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  if (!row) return res.status(404).json({ error: 'Tentativa não encontrada.' });
  const caseRow = row.case_id ? caseForUser(row.case_id, req.user!.id) : undefined;
  return res.json({
    attempt: attemptDTO(row),
    case: caseRow ? playableCase(caseRow) : null,
  });
});

attemptsRouter.post('/:id/answer', (req, res) => {
  const attempt = get<AttemptRow>('SELECT * FROM attempts WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  if (!attempt) return res.status(404).json({ error: 'Tentativa não encontrada.' });
  if (attempt.status !== 'em_andamento') return res.status(409).json({ error: 'Esta tentativa já foi finalizada.' });
  const questionId = String(req.body?.questionId ?? '');
  const optionId = req.body?.optionId == null ? null : String(req.body.optionId);
  const timeMs = Math.max(0, Math.min(600_000, Number(req.body?.timeMs ?? 0) || 0));
  const caseRow = attempt.case_id ? caseForUser(attempt.case_id, req.user!.id) : undefined;
  if (!caseRow) return res.status(410).json({ error: 'O caso original não está mais disponível.' });
  const data = caseContent(caseRow);
  const question = data.questions.find((q) => q.id === questionId);
  if (!question) return res.status(400).json({ error: 'Pergunta inválida para este caso.' });
  const already = get<AnswerRow>('SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?', attempt.id, questionId);
  if (already) return res.status(409).json({ error: 'Esta pergunta já foi respondida.' });
  const correctOption = question.options.find((o) => o.id === question.correctOptionId);
  const correct = Boolean(optionId && optionId === question.correctOptionId);
  const result: AttemptQuestionResult = {
    questionId,
    prompt: question.prompt,
    correctOptionId: question.correctOptionId,
    chosenOptionId: optionId,
    correct,
    rationale: question.rationale,
    keyPoint: question.keyPoint,
    sourceExcerpt: question.sourceExcerpt,
    timeMs,
    stage: question.stage,
  };
  run(
    `INSERT INTO answers (attempt_id, user_id, case_id, question_id, area, topic, option_id, correct, time_ms, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    attempt.id,
    req.user!.id,
    caseRow.id,
    questionId,
    attempt.area,
    attempt.topic,
    optionId,
    correct ? 1 : 0,
    timeMs,
    JSON.stringify(result),
    nowIso(),
  );
  const score = attempt.score + (correct ? 1 : 0);
  run('UPDATE attempts SET score = ? WHERE id = ?', score, attempt.id);
  const answered = get<{ n: number }>('SELECT COUNT(*) AS n FROM answers WHERE attempt_id = ?', attempt.id)!.n;
  return res.json({
    correct,
    correctOptionId: question.correctOptionId,
    correctOptionText: correctOption?.text ?? '',
    rationale: question.rationale,
    keyPoint: question.keyPoint,
    sourceExcerpt: question.sourceExcerpt,
    score,
    total: attempt.total,
    answered,
  });
});

attemptsRouter.post('/:id/finish', (req, res) => {
  const attempt = get<AttemptRow>('SELECT * FROM attempts WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  if (!attempt) return res.status(404).json({ error: 'Tentativa não encontrada.' });
  const settings = readSettings(req.user!.id);
  if (attempt.status === 'em_andamento') {
    const finishedAt = new Date();
    const durationMs = Math.max(0, Number(req.body?.durationMs ?? 0) || finishedAt.getTime() - new Date(attempt.started_at).getTime());
    run(
      'UPDATE attempts SET status = ?, finished_at = ?, duration_ms = ? WHERE id = ?',
      'concluido',
      finishedAt.toISOString(),
      durationMs,
      attempt.id,
    );
    if (settings.srsAutoCreate) {
      const answers = all<AnswerRow>('SELECT * FROM answers WHERE attempt_id = ? AND correct = 0', attempt.id);
      const caseRow = attempt.case_id ? caseForUser(attempt.case_id, req.user!.id) : undefined;
      const data = caseRow ? caseContent(caseRow) : null;
      for (const answer of answers) {
        const question = data?.questions.find((q) => q.id === answer.question_id);
        const correctOption = question?.options.find((o) => o.id === question.correctOptionId);
        if (!question || !correctOption) continue;
        upsertCard({
          userId: req.user!.id,
          caseId: attempt.case_id,
          questionId: answer.question_id,
          caseTitle: attempt.case_title,
          front: question.prompt,
          back: `${correctOption.text}\n\n${question.rationale}`,
          area: attempt.area,
          topic: attempt.topic,
        });
      }
    }
  }
  const updated = get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', attempt.id)!;
  return res.json({ attempt: attemptDTO(updated) });
});
