import type { DiscoveryResult, FetchedText, SearchOptions, SourceProvider } from '../types';
import { DiscoveryError, truncate } from '../types';
import { fetchJson, fetchText, ncbiXmlToText } from '../http';

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const LABEL = 'NCBI Bookshelf';

interface SummaryItem {
  uid?: string;
  title?: string;
  authors?: { name?: string }[] | string;
  pubdate?: string;
  publisher?: string;
  booktitle?: string;
  fulljournalname?: string;
  lang?: string[] | string;
}

export const bookshelfProvider: SourceProvider = {
  id: 'bookshelf',
  label: LABEL,
  description: 'Capítulos de livros e revisões abertas (ex.: StatPearls). Ideal para material de estudo com texto completo.',
  kinds: ['capitulo'],
  async search(query, options: SearchOptions) {
    const searchUrl = `${BASE}/esearch.fcgi?db=books&term=${encodeURIComponent(query)}&retmode=json&retmax=${options.limit}&sort=relevance`;
    const data = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl, 'bookshelf');
    const ids = data.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];
    const summary = await fetchJson<{ result?: Record<string, SummaryItem> }>(
      `${BASE}/esummary.fcgi?db=books&id=${ids.join(',')}&retmode=json`,
      'bookshelf',
    );
    const results: DiscoveryResult[] = [];
    for (const id of ids) {
      const item = summary.result?.[id];
      if (!item?.title) continue;
      const authors = Array.isArray(item.authors)
        ? item.authors.map((author) => (typeof author === 'string' ? author : author?.name ?? '')).filter(Boolean)
        : typeof item.authors === 'string'
          ? [item.authors]
          : [];
      results.push({
        provider: 'bookshelf',
        providerLabel: LABEL,
        id,
        title: truncate(item.title, 300),
        authors: authors.slice(0, 6),
        journal: item.publisher ?? item.booktitle ?? null,
        year: item.pubdate ? (item.pubdate.match(/\d{4}/)?.[0] ?? null) : null,
        doi: null,
        url: `https://www.ncbi.nlm.nih.gov/books/${id}/`,
        abstract: null,
        openAccess: true,
        license: 'NCBI Bookshelf (acesso aberto)',
        hasFullText: true,
        type: 'capitulo',
        language: Array.isArray(item.lang) ? item.lang[0] ?? null : item.lang ?? null,
      });
    }
    return results;
  },
  async fetchText(result): Promise<FetchedText> {
    const xml = await fetchText(`${BASE}/efetch.fcgi?db=books&id=${encodeURIComponent(result.id)}&retmode=xml`, 'bookshelf', 'application/xml, text/xml');
    const text = ncbiXmlToText(xml);
    if (text.replace(/\s/g, '').length < 500) {
      throw new DiscoveryError('Não foi possível obter o texto deste capítulo (talvez sem acesso aberto).', 'bookshelf', 409);
    }
    return {
      title: result.title,
      text: `# ${result.title}\n\n${text}`,
      originUrl: result.url,
      license: result.license,
      quality: 'texto_completo',
      notes: [
        'Texto completo obtido no NCBI Bookshelf (acesso aberto).',
        `Autores: ${result.authors.slice(0, 4).join(', ') || 'não informados'}.`,
      ],
    };
  },
};
