import type { SourceAnalysis } from '../../shared/types';
import { get, run, type SourceRow } from '../db';
import { analyzeSource, toAnalysis, type ParsedSource } from '../ingestion/analyze';
import { MAX_TEXT_CHARS } from '../config';
import { normalizeText, nowIso } from '../util';

export interface StoreSourceInput {
  title: string;
  text: string;
  discipline?: string | null;
  filename?: string | null;
  mime?: string | null;
  pages?: number | null;
  kind?: string;
  extraWarnings?: string[];
}

export interface StoredSource {
  row: SourceRow;
  parsed: ParsedSource;
  analysis: SourceAnalysis;
}

/** Cria um material, roda a análise estrutural e guarda o resultado. */
export function storeSource(userId: number, input: StoreSourceInput): StoredSource {
  let text = normalizeText(input.text);
  const warnings = [...(input.extraWarnings ?? [])];
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    warnings.push('Material muito grande: analisamos apenas o início do texto.');
  }
  if (text.replace(/\s/g, '').length < 60) {
    throw new Error('Não há texto suficiente para analisar este material.');
  }

  const title = (input.title || 'Material sem título').trim().slice(0, 180);
  const discipline = input.discipline?.trim() || null;
  const result = run(
    `INSERT INTO sources (user_id, title, kind, discipline, filename, mime, text, pages, chars, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processando', ?)`,
    userId,
    title,
    input.kind ?? 'outro',
    discipline,
    input.filename ?? null,
    input.mime ?? null,
    text,
    input.pages ?? null,
    text.length,
    nowIso(),
  );
  const sourceId = Number(result.lastInsertRowid);

  const parsed = analyzeSource(text, title, discipline);
  let analysis = toAnalysis(parsed, warnings);
  try {
    run('UPDATE sources SET kind = ?, status = ?, analysis = ? WHERE id = ?', analysis.kind, 'pronto', JSON.stringify(analysis), sourceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao analisar o material.';
    run('UPDATE sources SET status = ?, error = ? WHERE id = ?', 'erro', message, sourceId);
    analysis = { ...analysis, warnings: [...analysis.warnings, message] };
  }
  const row = get<SourceRow>('SELECT * FROM sources WHERE id = ?', sourceId)!;
  return { row, parsed, analysis };
}
