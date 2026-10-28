import type { DiscoveryResult, FetchedText, SearchOptions, SourceProvider } from '../types';
import { DiscoveryError, truncate } from '../types';
import { decodeEntities, fetchJson, fetchText } from '../http';

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const LABEL = 'PubMed (MEDLINE)';

function firstMatch(xml: string, regex: RegExp): string | null {
  const match = xml.match(regex);
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : null;
}

function parseArticle(xml: string): DiscoveryResult | null {
  const pmid = firstMatch(xml, /<PMID[^>]*>(\d+)<\/PMID>/);
  const title = firstMatch(xml, /<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
  if (!pmid || !title) return null;
  const abstractParts = [...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi)].map((match) =>
    decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
  );
  const authors = [...xml.matchAll(/<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<Initials>([^<]+)<\/Initials>[\s\S]*?<\/Author>/gi)].map(
    (match) => `${match[1]} ${match[2]}`,
  );
  const year = firstMatch(xml, /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) ?? firstMatch(xml, /<MedlineDate>(\d{4})/);
  const journal = firstMatch(xml, /<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/);
  const doi = firstMatch(xml, /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
  const language = firstMatch(xml, /<Language>([^<]+)<\/Language>/);
  const pubTypes = [...xml.matchAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/gi)].map((match) => match[1].toLowerCase());
  return {
    provider: 'pubmed',
    providerLabel: LABEL,
    id: pmid,
    title: truncate(title, 300),
    authors: authors.slice(0, 8),
    journal,
    year,
    doi,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    abstract: abstractParts.length > 0 ? truncate(abstractParts.join(' '), 4000) : null,
    openAccess: false,
    license: null,
    hasFullText: false,
    type: pubTypes.some((type) => type.includes('preprint')) ? 'preprint' : 'artigo',
    language,
  };
}

export const pubmedProvider: SourceProvider = {
  id: 'pubmed',
  label: LABEL,
  description: 'Maior base biomédica. Entrega metadados e resumo; o texto completo costuma ficar na editora.',
  kinds: ['artigo', 'preprint'],
  async search(query, options: SearchOptions) {
    const searchUrl = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${options.limit}&sort=relevance`;
    const data = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl, 'pubmed');
    const ids = data.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];
    const xml = await fetchText(`${BASE}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`, 'pubmed', 'application/xml, text/xml');
    return [...xml.matchAll(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g)]
      .map((match) => parseArticle(match[0]))
      .filter((item): item is DiscoveryResult => Boolean(item));
  },
  async fetchText(result, mode): Promise<FetchedText> {
    if (!result.abstract) {
      throw new DiscoveryError('Este registro do PubMed não traz resumo. Tente outro artigo.', 'pubmed', 409);
    }
    const notes = ['Importamos apenas o resumo (resumo público do MEDLINE).'];
    if (mode === 'fulltext') notes.push('Texto completo não está disponível publicamente no PubMed; use o link para acessar na fonte.');
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
