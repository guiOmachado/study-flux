import type { DiscoveryResult, FetchedText, SourceProvider } from '../types';
import { DiscoveryError, truncate } from '../types';
import { all, get, type SourceRow } from '../../db';
import { safeJson, stripDiacritics } from '../../util';
import type { SourceAnalysis } from '../../../shared/types';

const LABEL = 'Minha biblioteca';

export const localProvider: SourceProvider = {
  id: 'local',
  label: LABEL,
  description: 'Materiais que você já enviou (PDF, prova, resumo). Reaproveite antes de buscar fora.',
  kinds: ['material'],
  async search(query, options) {
    if (!options.userId) return [];
    const rows = all<SourceRow & { case_count: number }>(
      `SELECT s.*, (SELECT COUNT(*) FROM cases c WHERE c.source_id = s.id) AS case_count
       FROM sources s WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 300`,
      options.userId,
    );
    const needle = stripDiacritics(query.trim().toLowerCase());
    const matched = rows.filter((row) => {
      if (needle.length < 2) return true;
      const haystack = stripDiacritics(
        `${row.title} ${row.discipline ?? ''} ${row.text.slice(0, 4000)}`.toLowerCase(),
      );
      return haystack.includes(needle);
    });
    return matched.slice(0, options.limit).map((row) => {
      const analysis = safeJson<SourceAnalysis | null>(row.analysis, null);
      // Ano do próprio título (ex.: "Prova 2023") é mais útil que o ano do upload.
      const titleYear = row.title.match(/\b(19|20)\d{2}\b/)?.[0] ?? row.created_at.slice(0, 4);
      return {
        provider: 'local' as const,
        providerLabel: LABEL,
        id: String(row.id),
        title: row.title,
        authors: ['Seu material'],
        journal: row.discipline,
        year: titleYear,
        doi: null,
        url: null,
        abstract: row.text
          .slice(0, 400)
          .replace(/[#>*_`]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 240),
        openAccess: true,
        license: 'Material do próprio usuário',
        hasFullText: true,
        type: 'material' as const,
        language: analysis?.language ?? 'pt',
        extra: { caseCount: row.case_count, kind: row.kind, chars: row.chars, sourceId: row.id },
      };
    });
  },
  async fetchText(result): Promise<FetchedText> {
    const row = get<SourceRow>('SELECT * FROM sources WHERE id = ?', Number(result.id));
    if (!row) throw new DiscoveryError('Material não encontrado na sua biblioteca.', 'local', 404);
    return {
      title: row.title,
      text: row.text,
      originUrl: null,
      license: 'Material do próprio usuário',
      quality: 'texto_completo',
      notes: ['Material já analisado na sua biblioteca; o texto foi reaproveitado sem novo upload.'],
    };
  },
};
