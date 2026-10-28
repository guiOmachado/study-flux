import { Router } from 'express';
import type { ProviderId } from '../discovery/types';
import { requireUser } from '../auth';
import { storeSource } from '../sources/store';
import { generateForSource } from '../generation/service';
import { get, run, type SourceRow } from '../db';
import { providerCatalog, searchRepositories, lookupResult, fetchFromUrl, getProvider, DiscoveryError } from '../discovery';
import { isAiReady } from '../generation/service';
import { nowIso } from '../util';
import { sourceSummary } from './helpers';
import type { DiscoveryResult } from '../discovery/types';
import { formatReference } from '../discovery/reference';

export const discoveryRouter = Router();
discoveryRouter.use(requireUser);

const VALID_TYPES: DiscoveryResult['type'][] = ['artigo', 'capitulo', 'preprint', 'material'];

function sanitizeResult(raw: unknown): DiscoveryResult | null {
  const item = (raw ?? {}) as Record<string, unknown>;
  const provider = String(item.provider ?? '');
  const id = String(item.id ?? '').slice(0, 200);
  if (!provider || !id) return null;
  const extraRaw = (item.extra ?? {}) as Record<string, unknown>;
  const extra: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(extraRaw).slice(0, 8)) {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
      extra[key.slice(0, 40)] = typeof value === 'string' ? value.slice(0, 800) : value;
    }
  }
  return {
    provider: provider as ProviderId,
    providerLabel: String(item.providerLabel ?? '').slice(0, 60),
    id,
    title: String(item.title ?? 'Sem título').slice(0, 300),
    authors: Array.isArray(item.authors) ? item.authors.slice(0, 8).map(String) : [],
    journal: item.journal ? String(item.journal).slice(0, 200) : null,
    year: item.year ? String(item.year).slice(0, 8) : null,
    doi: item.doi ? String(item.doi).slice(0, 140) : null,
    url: item.url ? String(item.url).slice(0, 600) : null,
    abstract: item.abstract ? String(item.abstract).slice(0, 6000) : null,
    openAccess: Boolean(item.openAccess),
    license: item.license ? String(item.license).slice(0, 140) : null,
    hasFullText: Boolean(item.hasFullText),
    type: VALID_TYPES.includes(item.type as DiscoveryResult['type']) ? (item.type as DiscoveryResult['type']) : 'artigo',
    language: item.language ? String(item.language).slice(0, 20) : null,
    extra,
  };
}

discoveryRouter.get('/providers', (req, res) => {
  res.json({
    providers: providerCatalog(),
    aiReady: isAiReady(req.user!.id),
    note: 'Acervos externos consultados publicamente. Texto completo só é importado quando a fonte é de acesso aberto.',
  });
});

discoveryRouter.get('/search', async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (query.length < 2) {
    return res.status(400).json({ error: 'Digite pelo menos 2 caracteres para buscar.' });
  }
  const providersParam = String(req.query.providers ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const limitRaw = Number(req.query.limit ?? 8);
  const limit = Math.min(20, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 8));
  const onlyOpenAccess = req.query.oa === '1' || req.query.oa === 'true';

  try {
    const response = await searchRepositories(query, providersParam, {
      limit,
      onlyOpenAccess,
      userId: req.user!.id,
    });
    return res.json(response);
  } catch (error) {
    if (error instanceof DiscoveryError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Falha inesperada ao consultar os acervos.' });
  }
});

async function importAndMaybeGenerate(
  userId: number,
  input: {
    title: string;
    text: string;
    discipline?: string | null;
    originLabel: string;
    originUrl: string | null;
    license: string | null;
    quality: 'resumo' | 'texto_completo';
    notes: string[];
    generate: boolean;
    aiMode: 'auto' | 'estruturado' | 'ia';
    publish: boolean;
    maxCases: number;
    sourceKind?: string;
  },
) {
  const warnings = [...input.notes];
  if (input.quality === 'resumo') {
    warnings.push('Material importado como resumo. Para casos clínicos completos, prefira fontes com texto completo aberto.');
  }
  if (input.license) warnings.push(`Licença/fonte: ${input.license}.`);

  const stored = storeSource(userId, {
    title: input.title,
    text: input.text,
    discipline: input.discipline ?? null,
    filename: null,
    mime: 'text/plain',
    pages: null,
    kind: input.sourceKind ?? 'outro',
    extraWarnings: warnings,
  });
  run('UPDATE sources SET filename = ? WHERE id = ?', input.originLabel.slice(0, 200), stored.row.id);
  const source = get<typeof stored.row>('SELECT * FROM sources WHERE id = ?', stored.row.id)!;

  let generation: { created: number; updated: number; mode: string; warnings: string[]; caseIds: number[] } | null = null;
  let generationError: string | null = null;

  if (input.generate) {
    try {
      const outcome = await generateForSource(userId, source, {
        mode: input.aiMode,
        maxCases: input.maxCases,
        publish: input.publish,
      });
      generation = {
        created: outcome.created,
        updated: outcome.updated,
        mode: outcome.mode,
        warnings: outcome.warnings,
        caseIds: outcome.caseIds,
      };
    } catch (error) {
      generationError = error instanceof Error ? error.message : 'Não foi possível gerar casos automaticamente.';
    }
  }

  return {
    source: sourceSummary({ ...source, case_count: generation?.created ?? 0 }),
    generation,
    generationError,
    importedAt: nowIso(),
  };
}

discoveryRouter.post('/import', async (req, res) => {
  const userId = req.user!.id;
  const provider = String(req.body?.provider ?? '').trim();
  const id = String(req.body?.id ?? '').trim();
  const mode = req.body?.mode === 'abstract' ? 'abstract' : 'fulltext';
  const generate = req.body?.generate !== false;
  const aiMode = ['auto', 'estruturado', 'ia'].includes(String(req.body?.aiMode)) ? (req.body.aiMode as 'auto' | 'estruturado' | 'ia') : 'auto';
  const publish = req.body?.publish !== false;
  const maxCases = Math.min(8, Math.max(1, Number(req.body?.maxCases ?? 3) || 3));

  // Reaproveitar um material da própria biblioteca: gera casos na fonte existente, sem duplicar.
  if (provider === 'local') {
    const existing = get<SourceRow>('SELECT * FROM sources WHERE id = ? AND user_id = ?', Number(id), userId);
    if (!existing) return res.status(404).json({ error: 'Material não encontrado na sua biblioteca.' });
    let generation: { created: number; updated: number; mode: string; warnings: string[]; caseIds: number[] } | null = null;
    let generationError: string | null = null;
    if (generate) {
      try {
        const outcome = await generateForSource(userId, existing, { mode: aiMode, maxCases, publish });
        generation = {
          created: outcome.created,
          updated: outcome.updated,
          mode: outcome.mode,
          warnings: outcome.warnings,
          caseIds: outcome.caseIds,
        };
      } catch (error) {
        generationError = error instanceof Error ? error.message : 'Não foi possível gerar casos deste material.';
      }
    }
    const caseCount = get<{ n: number }>('SELECT COUNT(*) AS n FROM cases WHERE source_id = ?', existing.id)?.n ?? 0;
    return res.status(200).json({
      source: sourceSummary({ ...existing, case_count: caseCount }),
      generation,
      generationError,
      importedAt: nowIso(),
      reused: true,
    });
  }

  const result = lookupResult(provider, id) ?? sanitizeResult(req.body?.result);
  if (!result) {
    return res.status(400).json({ error: 'Referência inválida. Faça a busca novamente e escolha um resultado da lista.' });
  }

  const sourceProvider = getProvider(result.provider);
  if (!sourceProvider) return res.status(400).json({ error: 'Acervo desconhecido.' });

  try {
    const fetched = await sourceProvider.fetchText(result, mode);
    const payload = await importAndMaybeGenerate(userId, {
      title: fetched.title || result.title,
      text: fetched.text,
      discipline: null,
      originLabel: formatReference(result, fetched.originUrl),
      originUrl: fetched.originUrl ?? result.url,
      license: fetched.license ?? result.license,
      quality: fetched.quality,
      notes: [...fetched.notes, `Fonte: ${formatReference(result, fetched.originUrl)}`],
      generate,
      aiMode,
      publish,
      maxCases,
    });
    return res.status(201).json(payload);
  } catch (error) {
    if (error instanceof DiscoveryError) return res.status(error.status).json({ error: error.message });
    const message = error instanceof Error ? error.message : 'Não foi possível importar este material.';
    return res.status(500).json({ error: message });
  }
});

discoveryRouter.post('/url', async (req, res) => {
  const userId = req.user!.id;
  const url = String(req.body?.url ?? '').trim();
  if (!url) return res.status(400).json({ error: 'Informe o link da página ou do PDF.' });
  const generate = req.body?.generate !== false;
  const aiMode = ['auto', 'estruturado', 'ia'].includes(String(req.body?.aiMode)) ? (req.body.aiMode as 'auto' | 'estruturado' | 'ia') : 'auto';
  const publish = req.body?.publish !== false;
  const maxCases = Math.min(8, Math.max(1, Number(req.body?.maxCases ?? 3) || 3));

  try {
    const fetched = await fetchFromUrl(url);
    const payload = await importAndMaybeGenerate(userId, {
      title: String(req.body?.title ?? '').trim() || fetched.title,
      text: fetched.text,
      discipline: req.body?.discipline ? String(req.body.discipline) : null,
      originLabel: fetched.originUrl ?? url,
      originUrl: fetched.originUrl ?? url,
      license: fetched.license,
      quality: fetched.quality,
      notes: [...fetched.notes, `Fonte: ${fetched.originUrl ?? url}`],
      generate,
      aiMode,
      publish,
      maxCases,
    });
    return res.status(201).json(payload);
  } catch (error) {
    if (error instanceof DiscoveryError) return res.status(error.status).json({ error: error.message });
    const message = error instanceof Error ? error.message : 'Não foi possível importar este link.';
    return res.status(500).json({ error: message });
  }
});
