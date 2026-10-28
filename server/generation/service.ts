import type { CaseStatus } from '../../shared/types';
import { get, run, type CaseRow, type SourceRow } from '../db';
import { analyzeSource } from '../ingestion/analyze';
import { aiRuntimeConfig } from '../settings';
import { nowIso } from '../util';
import { AIError, generateCasesWithAI } from './llm';
import { generateStructured, type GeneratedCase } from './structured';

export type GenerationMode = 'auto' | 'estruturado' | 'ia';
export type ResolvedMode = 'estruturado' | 'ia';

export interface GenerationOptions {
  mode: GenerationMode;
  maxCases: number;
  publish: boolean;
}

export interface GenerationOutcome {
  mode: ResolvedMode;
  warnings: string[];
  generated: GeneratedCase[];
  created: number;
  updated: number;
  caseIds: number[];
}

export function isAiReady(userId: number): boolean {
  const config = aiRuntimeConfig(userId);
  return Boolean(config.enabled && config.apiKey && config.model);
}

function persistCases(userId: number, sourceId: number | null, generated: GeneratedCase[], publish: boolean) {
  let created = 0;
  let updated = 0;
  const caseIds: number[] = [];
  const now = nowIso();
  for (const item of generated) {
    const slug = `u${userId}-s${sourceId ?? 'x'}-${item.key}`;
    const existing = get<CaseRow>('SELECT * FROM cases WHERE slug = ? AND user_id = ?', slug, userId);
    if (existing) {
      if (existing.origin === 'manual') continue;
      const status: CaseStatus = existing.status === 'arquivado' ? 'arquivado' : publish ? 'publicado' : (existing.status as CaseStatus);
      run(
        `UPDATE cases SET title = ?, area = ?, topic = ?, difficulty = ?, format = ?, minutes = ?, data = ?, source_id = ?, status = ?, updated_at = ? WHERE id = ?`,
        item.title,
        item.area,
        item.topic,
        item.difficulty,
        item.format,
        item.minutes,
        JSON.stringify(item.content),
        sourceId,
        status,
        now,
        existing.id,
      );
      updated += 1;
      caseIds.push(existing.id);
      continue;
    }
    const result = run(
      `INSERT INTO cases (user_id, source_id, slug, title, area, topic, difficulty, status, origin, format, minutes, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'estruturado', ?, ?, ?, ?, ?)`,
      userId,
      sourceId,
      slug,
      item.title,
      item.area,
      item.topic,
      item.difficulty,
      publish ? 'publicado' : 'rascunho',
      item.format,
      item.minutes,
      JSON.stringify(item.content),
      now,
      now,
    );
    created += 1;
    caseIds.push(Number(result.lastInsertRowid));
  }
  return { created, updated, caseIds };
}

/** Gera casos para um material, com fallback automático de IA para o modo estruturado. */
export async function generateForSource(
  userId: number,
  source: SourceRow,
  options: GenerationOptions,
): Promise<GenerationOutcome> {
  const parsed = analyzeSource(source.text, source.title, source.discipline);
  const aiReady = isAiReady(userId);
  const wantsAi = options.mode === 'ia' || (options.mode === 'auto' && aiReady);
  let mode: ResolvedMode = 'estruturado';
  const warnings: string[] = [];
  let generated: GeneratedCase[] = [];

  if (wantsAi) {
    try {
      const config = aiRuntimeConfig(userId);
      const result = await generateCasesWithAI(config, {
        text: source.text,
        title: source.title,
        discipline: source.discipline ?? undefined,
        topic: parsed.topics[0],
        maxCases: options.maxCases,
      });
      generated = result.cases.map((item) => ({
        ...item,
        content: { ...item.content, generation: { ...item.content.generation, mode: 'ia' as const } },
      }));
      warnings.push(...result.warnings);
      mode = 'ia';
    } catch (error) {
      if (options.mode === 'ia') throw error;
      warnings.push(
        `IA indisponível (${error instanceof Error ? error.message : 'erro desconhecido'}). Usamos o modo estruturado, que aproveita o próprio texto do material.`,
      );
    }
  }

  if (generated.length === 0) {
    generated = generateStructured(parsed, source.title);
    if (generated.length === 0) {
      throw new AIError(
        'Não foi possível montar casos deste material. Ele precisa ter subtítulos com conteúdo clínico ou questões com gabarito. Você também pode ativar a IA em Configurações.',
        422,
      );
    }
  }

  const { created, updated, caseIds } = persistCases(userId, source.id, generated, options.publish);
  run('UPDATE sources SET status = ?, error = NULL WHERE id = ?', 'gerado', source.id);
  return { mode, warnings: [...parsed.warnings, ...warnings], generated, created, updated, caseIds };
}
