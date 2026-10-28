export type ProviderId = 'europepmc' | 'pubmed' | 'openalex' | 'bookshelf' | 'local' | 'url';

export interface DiscoveryResult {
  provider: ProviderId;
  providerLabel: string;
  id: string;
  title: string;
  authors: string[];
  journal: string | null;
  year: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  openAccess: boolean;
  license: string | null;
  hasFullText: boolean;
  type: 'artigo' | 'capitulo' | 'preprint' | 'material';
  language: string | null;
  extra?: Record<string, string | number | null>;
}

export interface SearchOptions {
  limit: number;
  onlyOpenAccess: boolean;
  language?: string;
  userId?: number;
}

export interface FetchedText {
  title: string;
  text: string;
  originUrl: string | null;
  license: string | null;
  /** 'abstract' quando só o resumo está disponível (texto curto, sem seções). */
  quality: 'resumo' | 'texto_completo';
  notes: string[];
}

export interface SourceProvider {
  id: ProviderId;
  label: string;
  description: string;
  kinds: DiscoveryResult['type'][];
  requiresQuery?: boolean;
  search(query: string, options: SearchOptions): Promise<DiscoveryResult[]>;
  fetchText(result: DiscoveryResult, mode: 'abstract' | 'fulltext'): Promise<FetchedText>;
}

export class DiscoveryError extends Error {
  status: number;
  provider: string;
  constructor(message: string, provider: string, status = 502) {
    super(message);
    this.provider = provider;
    this.status = status;
  }
}

export const GENERIC_CONNECTIVITY_HINT =
  'Não foi possível alcançar o acervo externo. Verifique a conexão do servidor ou tente outro provedor.';

export function truncate(value: unknown, limit = 400): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

export function asArray<T>(value: T[] | T | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
