import { Router } from 'express';
import { AREAS, type CaseContent, type CaseStatus, type Difficulty } from '../../shared/types';
import { requireUser } from '../auth';
import { all, get, run, type CaseRow } from '../db';
import { caseContent, caseDetail, caseSummary, playableCase } from './helpers';
import { asArea, asDifficulty, sanitizePresentation, sanitizeQuestions } from '../generation/llm';
import { clamp, nowIso, slugify } from '../util';

export const casesRouter = Router();
casesRouter.use(requireUser);

const STATUSES: CaseStatus[] = ['rascunho', 'publicado', 'arquivado'];

function rowWithSource(id: number) {
  return get<CaseRow & { source_title: string | null }>(
    `SELECT c.*, s.title AS source_title FROM cases c LEFT JOIN sources s ON s.id = c.source_id WHERE c.id = ?`,
    id,
  );
}

casesRouter.get('/', (req, res) => {
  const userId = req.user!.id;
  const mine = req.query.mine === '1' || req.query.mine === 'true';
  const status = String(req.query.status ?? '').trim();
  const area = String(req.query.area ?? '').trim();
  const difficulty = String(req.query.difficulty ?? '').trim();
  const sourceId = Number(req.query.sourceId ?? 0);
  const q = String(req.query.q ?? '').trim();
  const limit = clamp(Number(req.query.limit ?? 60) || 60, 1, 200);
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);

  const where: string[] = [];
  const params: unknown[] = [];
  if (mine) {
    where.push('c.user_id = ?');
    params.push(userId);
  } else {
    where.push('(c.user_id = ? OR c.status = ?)');
    params.push(userId, 'publicado');
  }
  if (status && STATUSES.includes(status as CaseStatus) && mine) {
    where.push('c.status = ?');
    params.push(status);
  }
  if (area) {
    where.push('c.area = ?');
    params.push(area);
  }
  if (difficulty) {
    where.push('c.difficulty = ?');
    params.push(difficulty);
  }
  if (sourceId) {
    where.push('c.source_id = ?');
    params.push(sourceId);
  }
  if (q) {
    where.push('(c.title LIKE ? OR c.topic LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const rows = all<CaseRow & { source_title: string | null; attempts: number; accuracy: number | null }>(
    `SELECT c.*, s.title AS source_title,
       (SELECT COUNT(*) FROM attempts a WHERE a.case_id = c.id AND a.user_id = ? AND a.status = 'concluido') AS attempts,
       (SELECT ROUND(100.0 * SUM(ans.correct) / COUNT(*), 0) FROM answers ans WHERE ans.case_id = c.id AND ans.user_id = ?) AS accuracy
     FROM cases c LEFT JOIN sources s ON s.id = c.source_id
     WHERE ${where.join(' AND ')}
     ORDER BY (c.user_id = ?) DESC, c.updated_at DESC
     LIMIT ? OFFSET ?`,
    userId,
    userId,
    ...params,
    userId,
    limit,
    offset,
  );

  res.json({
    cases: rows.map((row) => ({ ...caseSummary(row), canEdit: row.user_id === userId })),
    total: rows.length,
  });
});

casesRouter.get('/:id', (req, res) => {
  const row = rowWithSource(Number(req.params.id));
  if (!row || (row.user_id !== req.user!.id && row.status !== 'publicado')) {
    return res.status(404).json({ error: 'Caso não encontrado.' });
  }
  return res.json({ case: caseDetail(row, row.user_id === req.user!.id) });
});

casesRouter.get('/:id/play', (req, res) => {
  const row = rowWithSource(Number(req.params.id));
  if (!row || (row.user_id !== req.user!.id && row.status !== 'publicado')) {
    return res.status(404).json({ error: 'Caso não encontrado.' });
  }
  return res.json({ case: playableCase(row) });
});

function buildContent(body: Record<string, unknown>, base?: CaseContent): CaseContent {
  const presentation = body.presentation ? sanitizePresentation(body.presentation) : base?.presentation;
  const questions = body.questions ? sanitizeQuestions(body.questions) : base?.questions;
  if (!presentation) throw new Error('Apresentação do caso ausente.');
  if (!questions || questions.length === 0) throw new Error('Adicione pelo menos uma pergunta com 3 alternativas.');
  const area = body.area ? asArea(body.area, base?.area ?? 'Clínica Médica') : base?.area ?? 'Clínica Médica';
  const topic = String(body.topic ?? base?.topic ?? '').trim();
  const format = body.format === 'questao' || body.format === 'caso' ? body.format : base?.format ?? (presentation.historia.length ? 'caso' : 'questao');
  return {
    title: String(body.title ?? base?.title ?? 'Caso clínico').trim().slice(0, 160),
    area,
    topic: topic.slice(0, 120),
    difficulty: body.difficulty ? asDifficulty(body.difficulty) : base?.difficulty ?? 'media',
    format,
    minutes: clamp(Number(body.minutes ?? base?.minutes ?? 8) || 8, 2, 60),
    objectives: Array.isArray(body.objectives) ? (body.objectives as string[]).map(String).slice(0, 8) : base?.objectives ?? [],
    presentation,
    questions,
    teachingPoints: Array.isArray(body.teachingPoints) ? (body.teachingPoints as string[]).map(String).slice(0, 10) : base?.teachingPoints ?? [],
    sourceRefs: base?.sourceRefs ?? [],
    generation: base?.generation ?? { mode: 'manual', warnings: [] },
  };
}

casesRouter.post('/', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  let content: CaseContent;
  try {
    content = buildContent(body);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Dados inválidos.' });
  }
  const now = nowIso();
  const status = body.status && (STATUSES as string[]).includes(String(body.status)) ? String(body.status) : 'rascunho';
  const result = run(
    `INSERT INTO cases (user_id, source_id, slug, title, area, topic, difficulty, status, origin, format, minutes, data, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?)`,
    req.user!.id,
    `u${req.user!.id}-manual-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    content.title,
    content.area,
    content.topic,
    content.difficulty,
    status,
    content.format,
    content.minutes,
    JSON.stringify(content),
    now,
    now,
  );
  const row = rowWithSource(Number(result.lastInsertRowid))!;
  return res.status(201).json({ case: caseDetail(row, true) });
});

casesRouter.put('/:id', (req, res) => {
  const row = rowWithSource(Number(req.params.id));
  if (!row || row.user_id !== req.user!.id) return res.status(404).json({ error: 'Caso não encontrado.' });
  const body = (req.body ?? {}) as Record<string, unknown>;
  const base = caseContent(row);
  let content: CaseContent;
  try {
    content = buildContent(body, base);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Dados inválidos.' });
  }
  const status = body.status && (STATUSES as string[]).includes(String(body.status)) ? String(body.status) : row.status;
  run(
    `UPDATE cases SET title = ?, area = ?, topic = ?, difficulty = ?, status = ?, format = ?, minutes = ?, data = ?, updated_at = ? WHERE id = ?`,
    content.title,
    content.area,
    content.topic,
    content.difficulty,
    status,
    content.format,
    content.minutes,
    JSON.stringify(content),
    nowIso(),
    row.id,
  );
  const updated = rowWithSource(row.id)!;
  return res.json({ case: caseDetail(updated, true) });
});

casesRouter.post('/:id/publish', (req, res) => {
  const row = rowWithSource(Number(req.params.id));
  if (!row || row.user_id !== req.user!.id) return res.status(404).json({ error: 'Caso não encontrado.' });
  const publish = req.body?.publish !== false;
  run('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?', publish ? 'publicado' : 'rascunho', nowIso(), row.id);
  const updated = rowWithSource(row.id)!;
  return res.json({ case: caseDetail(updated, true) });
});

casesRouter.post('/:id/duplicate', (req, res) => {
  const row = rowWithSource(Number(req.params.id));
  if (!row || (row.user_id !== req.user!.id && row.status !== 'publicado')) {
    return res.status(404).json({ error: 'Caso não encontrado.' });
  }
  const content = caseContent(row);
  const now = nowIso();
  const copy: CaseContent = {
    ...content,
    title: `${content.title} (cópia)`.slice(0, 160),
    generation: { ...content.generation, mode: 'manual', warnings: content.generation.warnings ?? [] },
  };
  const result = run(
    `INSERT INTO cases (user_id, source_id, slug, title, area, topic, difficulty, status, origin, format, minutes, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'rascunho', 'manual', ?, ?, ?, ?, ?)`,
    req.user!.id,
    row.source_id,
    `u${req.user!.id}-copy-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    copy.title,
    copy.area,
    copy.topic,
    copy.difficulty,
    copy.format,
    copy.minutes,
    JSON.stringify(copy),
    now,
    now,
  );
  const created = rowWithSource(Number(result.lastInsertRowid))!;
  return res.status(201).json({ case: caseDetail(created, true) });
});

casesRouter.get('/:id/export', (req, res) => {
  const row = rowWithSource(Number(req.params.id));
  if (!row || (row.user_id !== req.user!.id && row.status !== 'publicado')) {
    return res.status(404).json({ error: 'Caso não encontrado.' });
  }
  const payload = {
    version: 1,
    exportedAt: nowIso(),
    case: {
      ...caseContent(row),
      sourceRefs: row.source_title ? [{ label: row.source_title }] : [],
    },
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="studyflux-caso-${slugify(row.title) || row.id}.json"`);
  return res.send(JSON.stringify(payload, null, 2));
});

casesRouter.post('/import', (req, res) => {
  const payload = req.body ?? {};
  const raw = payload.case ?? payload;
  const title = String(raw.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'Arquivo inválido: título ausente.' });
  const now = nowIso();
  const content: CaseContent = {
    title,
    area: asArea(raw.area, (AREAS[0] as string) ?? 'Clínica Médica'),
    topic: String(raw.topic ?? ''),
    difficulty: asDifficulty(raw.difficulty),
    format: raw.format === 'questao' ? 'questao' : 'caso',
    minutes: clamp(Number(raw.minutes) || 8, 2, 60),
    objectives: Array.isArray(raw.objectives) ? raw.objectives.map(String) : [],
    presentation: sanitizePresentation(raw.presentation),
    questions: sanitizeQuestions(raw.questions),
    teachingPoints: Array.isArray(raw.teachingPoints) ? raw.teachingPoints.map(String) : [],
    sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs.map((r: { label?: string }) => ({ label: String(r.label ?? '') })) : [],
    generation: { mode: 'manual', warnings: ['Caso importado de arquivo.'] },
  };
  if (content.questions.length === 0) return res.status(400).json({ error: 'O arquivo não contém perguntas válidas.' });
  const result = run(
    `INSERT INTO cases (user_id, source_id, slug, title, area, topic, difficulty, status, origin, format, minutes, data, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, 'rascunho', 'manual', ?, ?, ?, ?, ?)`,
    req.user!.id,
    `u${req.user!.id}-import-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    content.title,
    content.area,
    content.topic,
    content.difficulty,
    content.format,
    content.minutes,
    JSON.stringify(content),
    now,
    now,
  );
  const created = rowWithSource(Number(result.lastInsertRowid))!;
  return res.status(201).json({ case: caseDetail(created, true) });
});

casesRouter.delete('/:id', (req, res) => {
  const row = rowWithSource(Number(req.params.id));
  if (!row || row.user_id !== req.user!.id) return res.status(404).json({ error: 'Caso não encontrado.' });
  run('DELETE FROM cases WHERE id = ?', row.id);
  res.json({ ok: true });
});
