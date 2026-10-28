import type { FetchedText } from '../types';
import { DiscoveryError } from '../types';
import { assertPublicUrl, cleanArticleText, fetchExternal, htmlToText } from '../http';
import { extractDocument } from '../../ingestion/extract';

const LABEL = 'Link direto';

function titleFromText(text: string, url: URL): string {
  const heading = text.split('\n').find((line) => line.startsWith('## ')) ?? text.split('\n').find((line) => line.trim().length > 20);
  const guess = heading?.replace(/^##\s*/, '').trim();
  if (guess && guess.length > 8) return guess.slice(0, 180);
  const slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? 'Material importado');
  return slug.replace(/[-_]+/g, ' ').replace(/\.(html?|pdf)$/i, '').slice(0, 180) || 'Material importado';
}

/** Importa uma página de artigo, diretriz, capítulo aberto ou PDF a partir de uma URL pública. */
export async function fetchFromUrl(rawUrl: string): Promise<FetchedText> {
  const url = assertPublicUrl(rawUrl.trim());
  const response = await fetchExternal(url.toString(), {
    provider: 'url',
    accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5',
    binary: true,
    timeoutMs: 30_000,
  });
  if (response.status >= 400) {
    throw new DiscoveryError(`O link respondeu HTTP ${response.status}. Confira se a página é pública.`, 'url', 502);
  }
  const isPdf = /pdf/i.test(response.contentType) || /\.pdf$/i.test(url.pathname);

  if (isPdf) {
    const extracted = await extractDocument(response.buffer, 'material.pdf', response.contentType || 'application/pdf');
    if (extracted.text.replace(/\s/g, '').length < 500) {
      throw new DiscoveryError('O PDF não tem texto selecionável (parece digitalizado). Baixe e cole o texto, ou use outro link.', 'url', 422);
    }
    return {
      title: titleFromText(extracted.text, url),
      text: extracted.text,
      originUrl: url.toString(),
      license: null,
      quality: 'texto_completo',
      notes: ['PDF baixado e convertido automaticamente.', ...extracted.warnings],
    };
  }

  const html = response.buffer.toString('utf8');
  if (!/html|xml/i.test(response.contentType) && !html.includes('<')) {
    throw new DiscoveryError('O link não retornou uma página ou PDF legível.', 'url', 415);
  }
  const text = cleanArticleText(htmlToText(html));
  if (text.replace(/\s/g, '').length < 700) {
    throw new DiscoveryError(
      'Conseguiu baixar a página, mas quase não havia texto (talvez exija login ou seja carregada por JavaScript). Tente o link do PDF ou outro endereço.',
      'url',
      422,
    );
  }
  return {
    title: titleFromText(text, url),
    text,
    originUrl: url.toString(),
    license: null,
    quality: 'texto_completo',
    notes: ['Página lida e limpa automaticamente. Confira se o conteúdo principal foi capturado na prévia.'],
  };
}

export const urlProviderLabel = LABEL;
