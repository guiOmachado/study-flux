import { Router } from 'express';
import type { SrsGrade } from '../../shared/types';
import { requireUser } from '../auth';
import { all, get, run, type CardRow } from '../db';
import { dueCards, reviewCard, toCardDTO, upsertCard } from '../srs';
import { caseContent } from './helpers';
import { get as dbGet, type CaseRow } from '../db';
import { nowIso } from '../util';

export const srsRouter = Router();
srsRouter.use(requireUser);

const GRADES: SrsGrade[] = ['errei', 'dificil', 'bom', 'facil'];

srsRouter.get('/', (req, res) => {
  const cards = all<CardRow>('SELECT * FROM cards WHERE user_id = ? ORDER BY due_at ASC LIMIT 500', req.user!.id);
  const now = Date.now();
  res.json({
    cards: cards.map(toCardDTO),
    due: cards.filter((c) => new Date(c.due_at).getTime() <= now).length,
  });
});

srsRouter.get('/due', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 30) || 30, 100);
  res.json({ cards: dueCards(req.user!.id, limit).map(toCardDTO) });
});

srsRouter.post('/:id/review', (req, res) => {
  const grade = String(req.body?.grade ?? '') as SrsGrade;
  if (!GRADES.includes(grade)) return res.status(400).json({ error: 'Nota inválida.' });
  const card = get<CardRow>('SELECT * FROM cards WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  if (!card) return res.status(404).json({ error: 'Card não encontrado.' });
  const next = reviewCard(card, grade);
  run(
    'UPDATE cards SET ease = ?, interval_days = ?, reps = ?, lapses = ?, due_at = ?, last_reviewed_at = ? WHERE id = ?',
    next.ease,
    next.intervalDays,
    next.reps,
    next.lapses,
    next.dueAt,
    nowIso(),
    card.id,
  );
  const updated = get<CardRow>('SELECT * FROM cards WHERE id = ?', card.id)!;
  return res.json({ card: toCardDTO(updated) });
});

srsRouter.delete('/:id', (req, res) => {
  run('DELETE FROM cards WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  res.json({ ok: true });
});

srsRouter.post('/from-case/:caseId', (req, res) => {
  const row = dbGet<CaseRow & { source_title: string | null }>(
    `SELECT c.*, s.title as source_title FROM cases c LEFT JOIN sources s ON s.id = c.source_id WHERE c.id = ?`,
    Number(req.params.caseId),
  );
  if (!row || (row.user_id !== req.user!.id && row.status !== 'publicado')) {
    return res.status(404).json({ error: 'Caso não encontrado.' });
  }
  const data = caseContent(row);
  let created = 0;
  for (const q of data.questions) {
    const correct = q.options.find((o) => o.id === q.correctOptionId);
    if (!correct) continue;
    upsertCard({
      userId: req.user!.id,
      caseId: row.id,
      questionId: q.id,
      caseTitle: row.title,
      front: q.prompt,
      back: `${correct.text}\n\n${q.rationale}`,
      area: row.area,
      topic: row.topic,
    });
    created += 1;
  }
  return res.json({ created });
});
