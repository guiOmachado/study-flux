import type { DiscoveryResult, FetchedText, SearchOptions, SourceProvider } from '../types';
import { DiscoveryError, truncate } from '../types';
import { cleanArticleText, fetchJson, fetchText, jatsToText } from '../http';

const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
const LABEL = 'Europe PMC';

interface EpmcItem {
  id?: string;
  source?: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
  abstractText?: string;
  isOpenAccess?: string;
  license?: string;
  pubType?: string;
  citedByCount?: number;
  language?: string;
  fullTextUrlList?: { fullTextUrl?: { availability?: string; documentStyle?: string; site?: string; url?: string }[] };
}

function toResult(item: EpmcItem): DiscoveryResult {
  const pmcid = item.pmcid?.trim() || null;
  const openAccess = (item.isOpenAccess ?? '').toUpperCase() === 'Y';
  return {
    provider: 'europepmc',
    providerLabel: LABEL,
    id: pmcid ?? item.pmid ?? item.id ?? '',
    title: truncate(item.title, 300) || 'Sem título',
    authors: (item.authorString ?? '')
      .split(/,\s*/)
      .map((author) => author.trim())
      .filter(Boolean)
      .slice(0, 8),
    journal: item.journalTitle ?? null,
    year: item.pubYear ?? null,
    doi: item.doi ?? null,
    url: item.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/` : pmcid ? `https://europepmc.org/article/PMC/${pmcid.replace(/^PMC/i, '')}` : null,
    abstract: item.abstractText ? truncate(item.abstractText.replace(/<[^>]+>/g, ' '), 4000) : null,
    openAccess,
    license: item.license ?? null,
    hasFullText: Boolean(openAccess && pmcid),
    type: (item.pubType ?? '').toLowerCase().includes('preprint') ? 'preprint' : 'artigo',
    language: item.language ?? null,
    extra: { citedBy: item.citedByCount ?? null, pmcid, pmid: item.pmid ?? null },
  };
}

export const europePmcProvider: SourceProvider = {
  id: 'europepmc',
  label: LABEL,
  description: 'Artigos em acesso aberto (inclui texto completo em XML JATS). Melhor fonte para gerar casos a partir de artigos.',
  kinds: ['artigo', 'preprint'],
  async search(query, options: SearchOptions) {
    const filters = options.onlyOpenAccess ? ' AND (OPEN_ACCESS:y)' : '';
    const url = `${BASE}/search?query=${encodeURIComponent(`${query}${filters}`)}&format=json&pageSize=${options.limit}&resultType=core&sort=CITED%20desc`;
    const data = await fetchJson<{ resultList?: { result?: EpmcItem[] } }>(url, 'europepmc');
    const items = data.resultList?.result ?? [];
    return items.map(toResult).filter((item) => item.id && item.title !== 'Sem título');
  },
  async fetchText(result, mode): Promise<FetchedText> {
    const notes: string[] = [];
    const pmcid = String(result.extra?.pmcid ?? result.id ?? '');
    if (mode === 'fulltext') {
      if (!result.openAccess || !pmcid) {
        throw new DiscoveryError(
          'Este artigo não tem texto completo aberto neste acervo. Importe o resumo ou use o link para acessar na fonte.',
          'europepmc',
          409,
        );
      }
      const xml = await fetchText(`${BASE}/${encodeURIComponent(pmcid)}/fullTextXML`, 'europepmc', 'application/xml, text/xml');
      const text = cleanArticleText(jatsToText(xml));
      if (text.replace(/\s/g, '').length < 500) {
        throw new DiscoveryError('O texto completo veio vazio ou muito curto. Tente importar o resumo.', 'europepmc', 422);
      }
      notes.push('Texto completo em acesso aberto obtido no Europe PMC.');
      if (result.license) notes.push(`Licença informada pela fonte: ${result.license}.`);
      return {
        title: result.title,
        text: `# ${result.title}\n\n${text}`,
        originUrl: result.url,
        license: result.license,
        quality: 'texto_completo',
        notes,
      };
    }
    if (!result.abstract) {
      throw new DiscoveryError('Este registro não traz resumo no acervo. Tente o texto completo.', 'europepmc', 409);
    }
    notes.push('Importamos apenas o resumo do artigo (metadados públicos).');
    return {
      title: result.title,
      text: `# ${result.title}\n\n## Resumo\n${result.abstract}`,
      originUrl: result.url,
      license: result.license,
      quality: 'resumo',
      notes,
    };
  },
};
