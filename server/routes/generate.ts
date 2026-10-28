import { Router } from 'express';
import { requireUser } from '../auth';
import { get, run, type CaseRow, type SourceRow } from '../db';
import { analyzeSource } from '../ingestion/analyze';
import { generateStructured, type GeneratedCase } from '../generation/structured';
import { AIError, generateCaseFromTopic, generateCasesWithAI } from '../generation/llm';
import { aiRuntimeConfig } from '../settings';
import { nowIso, stripDiacritics } from '../util';
import { caseDetail } from './helpers';

export const generateRouter = Router();
generateRouter.use(requireUser);

function sourceRow(userId: number, id: number) {
  return get<SourceRow>('SELECT * FROM sources WHERE id = ? AND user_id = ?', id, userId);
}

function aiModeAvailable(userId: number) {
  const cfg = aiRuntimeConfig(userId);
  return Boolean(cfg.enabled && cfg.apiKey && cfg.model);
}

/** Faz upsert dos casos gerados para um material, mantendo o histórico do aluno. */
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
        existing.status === 'arquivado' ? 'arquivado' : publish ? 'publicado' : existing.status,
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

function casesFromAI(userId: number, generated: GeneratedCase[]): GeneratedCase[] {
  return generated.map((g) => ({
    ...g,
    content: { ...g.content, generation: { ...g.content.generation, mode: 'ia' as const } },
  }));
}

generateRouter.post('/source/:id', async (req, res) => {
  const userId = req.user!.id;
  const source = sourceRow(userId, Number(req.params.id));
  if (!source) return res.status(404).json({ error: 'Material não encontrado.' });

  const requestedMode = String(req.body?.mode ?? 'auto');
  const publish = req.body?.publish !== false;
  const maxCases = Math.min(8, Math.max(1, Number(req.body?.maxCases ?? 4) || 4));
  const parsed = analyzeSource(source.text, source.title, source.discipline);

  const wantsAI = requestedMode === 'ia' || (requestedMode === 'auto' && aiModeAvailable(userId));
  let mode: 'estruturado' | 'ia' = 'estruturado';
  const warnings: string[] = [];
  let generated: GeneratedCase[] = [];

  if (wantsAI) {
    try {
      const cfg = aiRuntimeConfig(userId);
      const result = await generateCasesWithAI(cfg, {
        text: source.text,
        title: source.title,
        discipline: source.discipline ?? undefined,
        topic: parsed.topics[0],
        maxCases,
      });
      generated = casesFromAI(userId, result.cases);
      warnings.push(...result.warnings);
      mode = 'ia';
    } catch (error) {
      if (requestedMode === 'ia') {
        const status = error instanceof AIError ? error.status : 500;
        return res.status(status).json({ error: error instanceof Error ? error.message : 'Falha na geração por IA.' });
      }
      warnings.push(
        `IA indisponível (${error instanceof Error ? error.message : 'erro desconhecido'}). Usamos o modo estruturado, que aproveita o próprio texto do material.`,
      );
    }
  }

  if (generated.length === 0) {
    generated = generateStructured(parsed, source.title);
    if (generated.length === 0) {
      return res.status(422).json({
        error:
          'Não foi possível montar casos deste material. Ele precisa ter subtítulos com conteúdo clínico ou questões com gabarito. Você também pode ativar a IA em Configurações.',
        warnings: parsed.warnings,
      });
    }
  }

  const { created, updated, caseIds } = persistCases(userId, source.id, generated, publish);
  run('UPDATE sources SET status = ?, error = NULL WHERE id = ?', 'gerado', source.id);
  const cases = caseIds
    .map((id) => get<CaseRow & { source_title: string | null }>(
      `SELECT c.*, s.title AS source_title FROM cases c LEFT JOIN sources s ON s.id = c.source_id WHERE c.id = ?`,
      id,
    ))
    .filter(Boolean)
    .map((row) => caseDetail(row!, true));

  return res.json({
    sourceId: source.id,
    created,
    updated,
    mode,
    warnings: [...parsed.warnings, ...warnings],
    caseIds,
    cases,
  });
});

generateRouter.post('/topic', async (req, res) => {
  const userId = req.user!.id;
  if (!aiModeAvailable(userId)) {
    return res.status(400).json({
      error: 'Para gerar a partir de um tema, ative a geração por IA em Configurações e informe uma chave de API.',
    });
  }
  const topic = String(req.body?.topic ?? '').trim();
  if (topic.length < 3) return res.status(400).json({ error: 'Informe um tema com pelo menos 3 caracteres.' });
  const area = String(req.body?.area ?? '').trim() || undefined;
  const difficulty = ['facil', 'media', 'dificil'].includes(String(req.body?.difficulty)) ? req.body.difficulty : undefined;
  const count = Math.min(4, Math.max(1, Number(req.body?.count ?? 2) || 2));
  const publish = req.body?.publish !== false;

  try {
    const cfg = aiRuntimeConfig(userId);
    const result = await generateCaseFromTopic(cfg, { topic, area, difficulty, count });
    const generated = casesFromAI(userId, result.cases);
    const { created, updated, caseIds } = persistCases(userId, null, generated, publish);
    const cases = caseIds
      .map((id) => get<CaseRow & { source_title: string | null }>(
        `SELECT c.*, s.title AS source_title FROM cases c LEFT JOIN sources s ON s.id = c.source_id WHERE c.id = ?`,
        id,
      ))
      .filter(Boolean)
      .map((row) => caseDetail(row!, true));
    return res.json({ created, updated, mode: 'ia', warnings: result.warnings, caseIds, cases });
  } catch (error) {
    const status = error instanceof AIError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Falha na geração por IA.' });
  }
});

/** Pré-visualização: mostra o que o modo estruturado consegue extrair, sem salvar nada. */
generateRouter.post('/preview/:id', (req, res) => {
  const source = sourceRow(req.user!.id, Number(req.params.id));
  if (!source) return res.status(404).json({ error: 'Material não encontrado.' });
  const parsed = analyzeSource(source.text, source.title, source.discipline);
  const generated = generateStructured(parsed, source.title);
  res.json({
    analysis: {
      kind: parsed.kind,
      topics: parsed.topics,
      conditions: parsed.conditions,
      area: parsed.area,
      sections: parsed.sections.slice(0, 12).map((s) => ({ heading: s.heading, type: s.type, facts: s.facts.length })),
      questions: parsed.questions.length,
      questionsWithKey: parsed.questions.filter((q) => q.answerLetter).length,
      warnings: parsed.warnings,
    },
    drafts: generated.map((g) => ({
      key: g.key,
      title: g.title,
      area: g.area,
      topic: g.topic,
      difficulty: g.difficulty,
      format: g.format,
      minutes: g.minutes,
      questions: g.content.questions.map((q) => ({
        prompt: q.prompt,
        options: q.options,
        correctOptionId: q.correctOptionId,
        rationale: q.rationale,
      })),
    })),
    aiAvailable: aiModeAvailable(req.user!.id),
    slug: stripDiacritics(source.title).slice(0, 40),
  });
});
