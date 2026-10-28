import { Router } from 'express';
import type { StatsDTO } from '../../shared/types';
import { requireUser } from '../auth';
import { all, get, type AnswerRow, type AttemptRow } from '../db';
import { attemptDTO } from './statsHelpers';
import { csvEscape, nowIso, safeJson } from '../util';
import { readSettings } from '../settings';

export const statsRouter = Router();
statsRouter.use(requireUser);

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

statsRouter.get('/', (req, res) => {
  const userId = req.user!.id;
  const settings = readSettings(userId);
  const overall = get<{ answered: number; correct: number; avg_ms: number | null }>(
    'SELECT COUNT(*) AS answered, COALESCE(SUM(correct), 0) AS correct, AVG(time_ms) AS avg_ms FROM answers WHERE user_id = ?',
    userId,
  )!;
  const casesSolved = get<{ n: number }>(
    `SELECT COUNT(DISTINCT case_id) AS n FROM attempts WHERE user_id = ? AND status = 'concluido'`,
    userId,
  )!.n;
  const dueCards = get<{ n: number }>('SELECT COUNT(*) AS n FROM cards WHERE user_id = ? AND due_at <= ?', userId, nowIso())!.n;
  const publishedCases = get<{ n: number }>(`SELECT COUNT(*) AS n FROM cases WHERE user_id = ? AND status = 'publicado'`, userId)!.n;
  const materials = get<{ n: number }>('SELECT COUNT(*) AS n FROM sources WHERE user_id = ?', userId)!.n;

  const byArea = all<{ area: string; answered: number; correct: number }>(
    `SELECT COALESCE(area, 'Sem área') AS area, COUNT(*) AS answered, SUM(correct) AS correct
     FROM answers WHERE user_id = ? GROUP BY area ORDER BY answered DESC`,
    userId,
  ).map((row) => ({ ...row, accuracy: row.answered ? Math.round((row.correct / row.answered) * 100) : 0 }));

  const topics = all<{ topic: string; area: string; answered: number; correct: number }>(
    `SELECT COALESCE(topic, 'Sem tema') AS topic, COALESCE(area, 'Sem área') AS area, COUNT(*) AS answered, SUM(correct) AS correct
     FROM answers WHERE user_id = ? GROUP BY topic, area HAVING COUNT(*) >= 2`,
    userId,
  ).map((row) => ({ ...row, accuracy: row.answered ? Math.round((row.correct / row.answered) * 100) : 0 }));

  const weakTopics = topics.filter((t) => t.accuracy < 75).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
  const strongTopics = topics.filter((t) => t.accuracy >= 75).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5);

  const days: { date: string; answered: number; correct: number }[] = [];
  const dailyRows = all<{ d: string; answered: number; correct: number }>(
    `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS answered, SUM(correct) AS correct
     FROM answers WHERE user_id = ? AND created_at >= ? GROUP BY d`,
    userId,
    new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10),
  );
  const dailyMap = new Map(dailyRows.map((r) => [r.d, r]));
  for (let i = 13; i >= 0; i -= 1) {
    const date = isoDay(new Date(Date.now() - i * 86_400_000));
    const row = dailyMap.get(date);
    days.push({ date, answered: row?.answered ?? 0, correct: row?.correct ?? 0 });
  }

  const answeredDays = new Set(
    all<{ d: string }>('SELECT DISTINCT substr(created_at, 1, 10) AS d FROM answers WHERE user_id = ? ORDER BY d DESC LIMIT 400', userId).map((r) => r.d),
  );
  let streak = 0;
  for (let i = 0; i < 400; i += 1) {
    const date = isoDay(new Date(Date.now() - i * 86_400_000));
    if (answeredDays.has(date)) streak += 1;
    else if (i === 0) continue;
    else break;
  }

  const recentRows = all<AttemptRow>(
    'SELECT * FROM attempts WHERE user_id = ? AND status = ? ORDER BY started_at DESC LIMIT 5',
    userId,
    'concluido',
  );

  const doneToday = dailyMap.get(isoDay(new Date()))?.answered ?? 0;
  const stats: StatsDTO = {
    totals: {
      casesSolved,
      questionsAnswered: overall.answered,
      accuracy: overall.answered ? Math.round((overall.correct / overall.answered) * 100) : 0,
      avgTimeSec: Math.round((overall.avg_ms ?? 0) / 1000),
      dueCards,
      streak,
      publishedCases,
      materials,
    },
    byArea,
    weakTopics,
    strongTopics,
    daily: days,
    recentAttempts: recentRows.map(attemptDTO),
    goal: { target: settings.dailyGoal, doneToday },
  };
  res.json(stats);
});

statsRouter.get('/export.csv', (req, res) => {
  const rows = all<AnswerRow & { case_title: string | null; attempt_started: string | null }>(
    `SELECT a.*, at.case_title AS case_title, at.started_at AS attempt_started
     FROM answers a LEFT JOIN attempts at ON at.id = a.attempt_id
     WHERE a.user_id = ? ORDER BY a.created_at ASC`,
    req.user!.id,
  );
  const header = [
    'data',
    'caso',
    'area',
    'tema',
    'pergunta',
    'alternativa_marcada',
    'correta',
    'acertou',
    'tempo_segundos',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    const data = safeJson<{ prompt?: string; correctOptionId?: string } | null>(row.data, null);
    lines.push(
      [
        row.created_at,
        row.case_title ?? '',
        row.area ?? '',
        row.topic ?? '',
        data?.prompt ?? '',
        row.option_id ?? '',
        data?.correctOptionId ?? '',
        row.correct ? 'sim' : 'nao',
        (row.time_ms / 1000).toFixed(1),
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="studyflux-desempenho.csv"');
  res.send(`\uFEFF${lines.join('\n')}`);
});
