import type { DiscoveryResult, FetchedText, SearchOptions, SourceProvider } from '../types';
import { DiscoveryError, truncate } from '../types';
import { fetchExternal, fetchJson } from '../http';
import { extractDocument } from '../../ingestion/extract';

const BASE = 'https://api.openalex.org/works';
const LABEL = 'OpenAlex';
const MAILTO = process.env.OPENALEX_MAILTO ?? 'studyflux@example.com';

interface OpenAlexWork {
  id?: string;
  doi?: string;
  display_name?: string;
  publication_year?: number;
  language?: string;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { source?: { display_name?: string } | null; pdf_url?: string | null; landing_page_url?: string | null };
  best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null };
  type?: string;
}

function abstractFromIndex(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const entries: { word: string; position: number }[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) entries.push({ word, position });
  }
  if (entries.length === 0) return null;
  entries.sort((a, b) => a.position - b.position);
  const text = entries.map((entry) => entry.word).join(' ');
  return truncate(text.replace(/\s+/g, ' ').trim(), 4000);
}

function toResult(work: OpenAlexWork): DiscoveryResult | null {
  const title = truncate(work.display_name, 300);
  if (!title) return null;
  const pdfUrl = work.best_oa_location?.pdf_url ?? work.primary_location?.pdf_url ?? null;
  const landing = work.best_oa_location?.landing_page_url ?? work.primary_location?.landing_page_url ?? work.open_access?.oa_url ?? null;
  const openAccess = Boolean(work.open_access?.is_oa);
  return {
    provider: 'openalex',
    providerLabel: LABEL,
    id: (work.id ?? '').replace('https://openalex.org/', '') || title,
    title,
    authors: (work.authorships ?? [])
      .map((authorship) => authorship.author?.display_name?.trim())
      .filter((name): name is string => Boolean(name))
      .slice(0, 8),
    journal: work.primary_location?.source?.display_name ?? null,
    year: work.publication_year ? String(work.publication_year) : null,
    doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
    url: landing ?? (work.doi ? work.doi.replace('https://doi.org/', 'https://doi.org/') : null),
    abstract: abstractFromIndex(work.abstract_inverted_index),
    openAccess,
    license: null,
    hasFullText: Boolean(openAccess && pdfUrl),
    type: work.type === 'preprint' ? 'preprint' : 'artigo',
    language: work.language ?? null,
    extra: { pdfUrl },
  };
}

export const openAlexProvider: SourceProvider = {
  id: 'openalex',
  label: LABEL,
  description: 'Catálogo aberto e amplo (inclui revistas brasileiras e SciELO). Resumos e PDFs quando disponíveis.',
  kinds: ['artigo', 'preprint'],
  async search(query, options: SearchOptions) {
    const filters = options.onlyOpenAccess ? '&filter=is_oa:true' : '';
    const url = `${BASE}?search=${encodeURIComponent(query)}&per-page=${options.limit}${filters}&mailto=${encodeURIComponent(MAILTO)}`;
    const data = await fetchJson<{ results?: OpenAlexWork[] }>(url, 'openalex');
    return (data.results ?? []).map(toResult).filter((item): item is DiscoveryResult => Boolean(item));
  },
  async fetchText(result, mode): Promise<FetchedText> {
    const notes: string[] = [];
    const pdfUrl = result.extra?.pdfUrl ? String(result.extra.pdfUrl) : '';
    if (mode === 'fulltext' && pdfUrl) {
      const response = await fetchExternal(pdfUrl, { provider: 'openalex', accept: 'application/pdf', binary: true, timeoutMs: 30_000 });
      if (response.status >= 400) {
        throw new DiscoveryError('Não foi possível baixar o PDF aberto deste artigo.', 'openalex', 502);
      }
      try {
        const extracted = await extractDocument(response.buffer, 'artigo.pdf', response.contentType || 'application/pdf');
        if (extracted.text.replace(/\s/g, '').length < 500) {
          throw new Error('pouco texto');
        }
        notes.push('PDF em acesso aberto baixado e convertido automaticamente.');
        notes.push(...extracted.warnings);
        return {
          title: result.title,
          text: `# ${result.title}\n\n${extracted.text}`,
          originUrl: result.url,
          license: result.license,
          quality: 'texto_completo',
          notes,
        };
      } catch {
        throw new DiscoveryError('O PDF aberto não tem texto selecionável (talvez seja digitalizado). Importe o resumo.', 'openalex', 422);
      }
    }
    if (!result.abstract) {
      throw new DiscoveryError('Sem resumo disponível neste registro. Tente o PDF aberto ou outro artigo.', 'openalex', 409);
    }
    notes.push('Importamos o resumo disponível no catálogo aberto.');
    return {
      title: result.title,
      text: `# ${result.title}\n\n## Resumo\n${result.abstract}`,
      originUrl: result.url,
      license: null,
      quality: 'resumo',
      notes,
    };
  },
};
