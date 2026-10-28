import type { DiscoveryResult } from './types';

/** Monta uma referência curta e legível (ABNT simplificada) para guardar com o material. */
export function formatReference(result: DiscoveryResult, url?: string | null): string {
  const authors = result.authors.slice(0, 3).join('; ');
  const parts = [
    authors ? `${authors}${result.authors.length > 3 ? ' et al.' : ''}` : result.providerLabel,
    result.title,
    result.journal,
    result.year,
    result.doi ? `DOI ${result.doi}` : null,
    url ?? result.url,
  ].filter(Boolean);
  return parts.join(' · ').slice(0, 380);
}
