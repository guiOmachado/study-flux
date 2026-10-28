import type { CaseRow, SourceRow } from '../db';
import type { CaseContent, CaseDetail, CaseSummary, SourceAnalysis, SourceSummary } from '../../shared/types';
import { safeJson } from '../util';

export function sourceSummary(row: SourceRow & { case_count?: number }): SourceSummary {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    discipline: row.discipline,
    filename: row.filename,
    mime: row.mime,
    pages: row.pages,
    chars: row.chars,
    status: row.status as SourceSummary['status'],
    error: row.error,
    createdAt: row.created_at,
    caseCount: Number(row.case_count ?? 0),
    analysis: safeJson<SourceAnalysis | null>(row.analysis, null),
  };
}

export function caseContent(row: CaseRow): CaseContent {
  return safeJson<CaseContent>(row.data, {
    title: row.title,
    area: row.area,
    topic: row.topic ?? '',
    difficulty: (row.difficulty as CaseContent['difficulty']) ?? 'media',
    format: (row.format as CaseContent['format']) ?? 'caso',
    minutes: row.minutes,
    objectives: [],
    presentation: {
      paciente: '',
      queixa: '',
      historia: [],
      antecedentes: [],
      exameFisico: [],
      sinaisVitais: [],
      exames: [],
    },
    questions: [],
    teachingPoints: [],
    sourceRefs: [],
    generation: { mode: 'manual', warnings: [] },
  });
}

export function caseSummary(row: CaseRow & { source_title?: string | null; attempts?: number; accuracy?: number | null }): CaseSummary {
  const data = caseContent(row);
  return {
    id: row.id,
    title: row.title,
    area: row.area,
    topic: row.topic ?? '',
    difficulty: row.difficulty as CaseSummary['difficulty'],
    status: row.status as CaseSummary['status'],
    origin: row.origin as CaseSummary['origin'],
    format: row.format as CaseSummary['format'],
    minutes: row.minutes,
    questionCount: data.questions.length,
    sourceId: row.source_id,
    sourceTitle: row.source_title ?? null,
    updatedAt: row.updated_at,
    attempts: row.attempts ?? undefined,
    accuracy: row.accuracy ?? null,
    tags: data.questions.flatMap((q) => q.tags ?? []).slice(0, 6),
  };
}

export function caseDetail(row: CaseRow & { source_title?: string | null }, canEdit: boolean): CaseDetail {
  return { ...caseSummary(row), data: caseContent(row), canEdit };
}

/** Versão do caso para jogar: sem gabarito nem justificativas. */
export function playableCase(row: CaseRow & { source_title?: string | null }) {
  const data = caseContent(row);
  return {
    id: row.id,
    title: row.title,
    area: row.area,
    topic: row.topic ?? '',
    difficulty: row.difficulty,
    format: row.format,
    minutes: row.minutes,
    sourceTitle: row.source_title ?? null,
    presentation: data.presentation,
    objectives: data.objectives,
    questions: data.questions.map((q) => ({
      id: q.id,
      stage: q.stage,
      prompt: q.prompt,
      options: q.options,
    })),
    questionCount: data.questions.length,
  };
}

export type PlayableCase = ReturnType<typeof playableCase>;
