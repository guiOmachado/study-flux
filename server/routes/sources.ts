import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { MAX_UPLOAD_BYTES } from '../config';
import { all, get, run, type SourceRow } from '../db';
import { requireUser } from '../auth';
import { extractDocument } from '../ingestion/extract';
import { analyzeSource, toAnalysis } from '../ingestion/analyze';
import { normalizeText, nowIso } from '../util';
import { sourceSummary } from './helpers';

export const sourcesRouter = Router();
sourcesRouter.use(requireUser);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.docx', '.txt', '.md', '.markdown'];
    if (!allowed.includes(ext)) {
      cb(new Error('Formato não suportado. Envie PDF, DOCX, TXT ou MD.'));
      return;
    }
    cb(null, true);
  },
});

function listSources(userId: number) {
  return all<SourceRow & { case_count: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM cases c WHERE c.source_id = s.id) AS case_count
     FROM sources s WHERE s.user_id = ? ORDER BY s.created_at DESC`,
    userId,
  );
}

sourcesRouter.get('/', (req, res) => {
  res.json({ sources: listSources(req.user!.id).map(sourceSummary) });
});

sourcesRouter.get('/:id', (req, res) => {
  const row = get<SourceRow & { case_count: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM cases c WHERE c.source_id = s.id) AS case_count
     FROM sources s WHERE s.id = ? AND s.user_id = ?`,
    Number(req.params.id),
    req.user!.id,
  );
  if (!row) return res.status(404).json({ error: 'Material não encontrado.' });
  return res.json({
    source: sourceSummary(row),
    excerpt: row.text.slice(0, 1200),
    textPreview: row.text.slice(0, 6000),
  });
});

sourcesRouter.post('/', upload.single('file'), async (req, res) => {
  const userId = req.user!.id;
  let title = String(req.body?.title ?? '').trim();
  const discipline = String(req.body?.discipline ?? '').trim() || null;
  let text = String(req.body?.text ?? '');
  let filename: string | null = null;
  let mime: string | null = null;
  let pages: number | null = null;
  const warnings: string[] = [];

  if (req.file) {
    filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    mime = req.file.mimetype;
    if (!title) title = filename.replace(/\.[^.]+$/, '');
    try {
      const extracted = await extractDocument(req.file.buffer, filename, mime);
      text = extracted.text;
      pages = extracted.pages;
      mime = extracted.mime;
      warnings.push(...extracted.warnings);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao ler o arquivo.';
      return res.status(422).json({ error: message });
    }
  } else if (text.trim()) {
    text = normalizeText(text);
    if (!title) title = 'Material colado';
  } else {
    return res.status(400).json({ error: 'Envie um arquivo ou cole o texto do material.' });
  }

  if (text.trim().length < 60) {
    return res.status(422).json({ error: 'Não encontramos texto suficiente para analisar. Verifique o arquivo ou cole mais conteúdo.' });
  }
  if (!title) title = 'Material sem título';

  const created = nowIso();
  const result = run(
    `INSERT INTO sources (user_id, title, kind, discipline, filename, mime, text, pages, chars, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    title.slice(0, 180),
    'outro',
    discipline,
    filename,
    mime,
    text,
    pages,
    text.length,
    'processando',
    created,
  );
  const sourceId = Number(result.lastInsertRowid);

  try {
    const parsed = analyzeSource(text, title, discipline);
    const analysis = toAnalysis(parsed, warnings);
    run(
      'UPDATE sources SET kind = ?, status = ?, analysis = ? WHERE id = ?',
      analysis.kind,
      'pronto',
      JSON.stringify(analysis),
      sourceId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao analisar o material.';
    run('UPDATE sources SET status = ?, error = ? WHERE id = ?', 'erro', message, sourceId);
  }

  const row = get<SourceRow & { case_count: number }>(
    `SELECT s.*, 0 AS case_count FROM sources s WHERE s.id = ?`,
    sourceId,
  )!;
  return res.status(201).json({ source: sourceSummary(row), warnings });
});

sourcesRouter.patch('/:id', (req, res) => {
  const row = get<SourceRow>('SELECT * FROM sources WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  if (!row) return res.status(404).json({ error: 'Material não encontrado.' });
  const title = String(req.body?.title ?? row.title).trim().slice(0, 180) || row.title;
  const discipline = req.body?.discipline === undefined ? row.discipline : String(req.body.discipline).trim() || null;
  run('UPDATE sources SET title = ?, discipline = ? WHERE id = ?', title, discipline, row.id);
  const updated = get<SourceRow & { case_count: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM cases c WHERE c.source_id = s.id) AS case_count FROM sources s WHERE s.id = ?`,
    row.id,
  )!;
  return res.json({ source: sourceSummary(updated) });
});

sourcesRouter.post('/:id/reanalyze', (req, res) => {
  const row = get<SourceRow>('SELECT * FROM sources WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  if (!row) return res.status(404).json({ error: 'Material não encontrado.' });
  const parsed = analyzeSource(row.text, row.title, row.discipline);
  const analysis = toAnalysis(parsed);
  run('UPDATE sources SET analysis = ?, status = ?, kind = ?, error = NULL WHERE id = ?', JSON.stringify(analysis), 'pronto', analysis.kind, row.id);
  const updated = get<SourceRow & { case_count: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM cases c WHERE c.source_id = s.id) AS case_count FROM sources s WHERE s.id = ?`,
    row.id,
  )!;
  return res.json({ source: sourceSummary(updated) });
});

sourcesRouter.delete('/:id', (req, res) => {
  const row = get<SourceRow>('SELECT * FROM sources WHERE id = ? AND user_id = ?', Number(req.params.id), req.user!.id);
  if (!row) return res.status(404).json({ error: 'Material não encontrado.' });
  run('UPDATE cases SET source_id = NULL WHERE source_id = ? AND user_id = ?', row.id, req.user!.id);
  run('DELETE FROM sources WHERE id = ?', row.id);
  res.json({ ok: true });
});
