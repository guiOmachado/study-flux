import type { DiscoveryResult, ProviderId, SearchOptions, SourceProvider } from './types';
import { DiscoveryError } from './types';
import { europePmcProvider } from './providers/europepmc';
import { pubmedProvider } from './providers/pubmed';
import { openAlexProvider } from './providers/openalex';
import { bookshelfProvider } from './providers/bookshelf';
import { localProvider } from './providers/local';

export { fetchFromUrl } from './providers/url';
export { DiscoveryError } from './types';
export type { DiscoveryResult, ProviderId } from './types';

export const PROVIDERS: SourceProvider[] = [localProvider, europePmcProvider, bookshelfProvider, openAlexProvider, pubmedProvider];

export function getProvider(id: string): SourceProvider | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

export function providerCatalog(includeLocal = true) {
  return PROVIDERS.filter((provider) => includeLocal || provider.id !== 'local').map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    kinds: provider.kinds,
  }));
}

export interface ProviderStatus {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  message?: string;
}

export interface SearchResponse {
  results: DiscoveryResult[];
  statuses: ProviderStatus[];
  cached: boolean;
  query: string;
}

interface CacheEntry {
  at: number;
  payload: SearchResponse;
}

const cache = new Map<string, CacheEntry>();
const resultIndex = new Map<string, { at: number; result: DiscoveryResult }>();
const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHE = 120;
const MAX_RESULTS = 400;

function cacheKey(query: string, ids: string[], options: SearchOptions): string {
  return `${options.userId ?? 0}|${ids.join(',')}|${options.limit}|${options.onlyOpenAccess ? 1 : 0}|${query.toLowerCase()}`;
}

function remember(key: string, payload: SearchResponse): void {
  if (cache.size >= MAX_CACHE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { at: Date.now(), payload });
}

export async function searchRepositories(
  query: string,
  requestedIds: string[],
  options: SearchOptions,
): Promise<SearchResponse> {
  const trimmed = query.trim();
  const ids = requestedIds.length > 0 ? requestedIds : ['local', 'europepmc', 'bookshelf'];
  // Sem sessão não há biblioteca pessoal: o acervo "local" só entra para usuários autenticados.
  const allowed = ids.filter((id) => id !== 'local' || Boolean(options.userId));
  const selected = allowed.map(getProvider).filter((provider): provider is SourceProvider => Boolean(provider));
  if (selected.length === 0) {
    throw new DiscoveryError('Nenhum acervo válido foi selecionado.', 'discovery', 400);
  }

  const key = cacheKey(trimmed || '*', selected.map((provider) => provider.id), options);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  const settled = await Promise.all(
    selected.map(async (provider): Promise<{ status: ProviderStatus; results: DiscoveryResult[] }> => {
      try {
        const results = await provider.search(trimmed || ' ', options);
        return {
          status: { id: provider.id, label: provider.label, ok: true, count: results.length },
          results,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao consultar o acervo.';
        return {
          status: {
            id: provider.id,
            label: provider.label,
            ok: false,
            count: 0,
            message:
              provider.id === 'local'
                ? message
                : `${message} (o preview pode não ter acesso à internet; rode o projeto localmente para consultar acervos externos)`,
          },
          results: [],
        };
      }
    }),
  );

  const results = settled.flatMap((entry) => entry.results);
  results.sort((a, b) => {
    const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return a.title.localeCompare(b.title);
  });

  const payload: SearchResponse = {
    results,
    statuses: settled.map((entry) => entry.status),
    cached: false,
    query: trimmed,
  };
  remember(key, payload);
  for (const result of results) {
    const resultKey = `${result.provider}:${result.id}`;
    resultIndex.delete(resultKey);
    resultIndex.set(resultKey, { at: Date.now(), result });
  }
  // Busca anônima também popula o índice: mantém um teto para não crescer sem limite.
  while (resultIndex.size > MAX_RESULTS) {
    const oldest = resultIndex.keys().next().value;
    if (!oldest) break;
    resultIndex.delete(oldest);
  }
  return payload;
}

/** Recupera o resultado original da última busca (evita confiar em dados vindos do cliente). */
export function lookupResult(provider: string, id: string): DiscoveryResult | null {
  const entry = resultIndex.get(`${provider}:${id}`);
  if (!entry) return null;
  if (Date.now() - entry.at > 30 * 60_000) {
    resultIndex.delete(`${provider}:${id}`);
    return null;
  }
  return entry.result;
}

export function clearDiscoveryCache(): void {
  cache.clear();
  resultIndex.clear();
}

export type { SourceProvider, SearchOptions };
export type ProviderIdType = ProviderId;
