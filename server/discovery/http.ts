import net from 'node:net';
import { DiscoveryError } from './types';

const USER_AGENT = 'StudyFlux/0.1 (plataforma de estudo; contato: studyflux@example.com)';
const MAX_BYTES = 12 * 1024 * 1024;

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?fd[0-9a-f]{2}:/i,
  /^\[?fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

function isPrivateHost(hostname: string): boolean {
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) return true;
  if (net.isIP(hostname) === 4) {
    const [a, b] = hostname.split('.').map(Number);
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/** Impede que a importação por link seja usada para acessar a rede interna (SSRF). */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DiscoveryError('Link inválido. Informe uma URL completa, com https://.', 'url', 400);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new DiscoveryError('Apenas links http e https podem ser importados.', 'url', 400);
  }
  if (isPrivateHost(url.hostname)) {
    throw new DiscoveryError('Este endereço não é público. Informe uma URL acessível na internet.', 'url', 400);
  }
  return url;
}

export interface FetchOptions {
  provider: string;
  accept?: string;
  timeoutMs?: number;
  binary?: boolean;
}

export interface FetchResponse {
  status: number;
  contentType: string;
  text: string;
  buffer: Buffer;
  finalUrl: string;
}

const connectivityMessage = (provider: string, detail: string) =>
  `Não foi possível alcançar o acervo (${detail}). Verifique a conexão do servidor com a internet.`;

export async function fetchExternal(url: string, options: FetchOptions): Promise<FetchResponse> {
  assertPublicUrl(url);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: options.accept ?? 'application/json, text/plain;q=0.9, */*;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DiscoveryError(connectivityMessage(options.provider, detail), options.provider, 502);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) {
    throw new DiscoveryError('O conteúdo é grande demais para ser importado (limite de 12 MB).', options.provider, 413);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    throw new DiscoveryError('O conteúdo é grande demais para ser importado (limite de 12 MB).', options.provider, 413);
  }

  return {
    status: response.status,
    contentType,
    text: options.binary ? '' : buffer.toString('utf8'),
    buffer,
    finalUrl: response.url || url,
  };
}

export async function fetchJson<T>(url: string, provider: string, timeoutMs = 20_000): Promise<T> {
  const response = await fetchExternal(url, { provider, accept: 'application/json', timeoutMs });
  if (response.status >= 400) {
    throw new DiscoveryError(`O acervo respondeu HTTP ${response.status}. Tente novamente em instantes.`, provider, 502);
  }
  try {
    return JSON.parse(response.text) as T;
  } catch {
    throw new DiscoveryError('O acervo respondeu em um formato inesperado.', provider, 502);
  }
}

export async function fetchText(url: string, provider: string, accept: string, timeoutMs = 20_000): Promise<string> {
  const response = await fetchExternal(url, { provider, accept, timeoutMs });
  if (response.status >= 400) {
    throw new DiscoveryError(`O acervo respondeu HTTP ${response.status}.`, provider, 502);
  }
  return response.text;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  hellip: '…',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[String(name).toLowerCase()] ?? match);
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Converte HTML genérico em texto com títulos preservados como "## Título". */
export function htmlToText(html: string): string {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi, (_, inner: string) => `\n\n## ${stripTags(inner)}\n`)
    .replace(/<\/(p|div|section|article|li|tr|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ');
  text = stripTags(text);
  return tidy(text);
}

/** Converte XML JATS (Europe PMC) em texto com títulos de seção preservados. */
export function jatsToText(xml: string): string {
  const body = xml.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? xml;
  const withoutRefs = body.replace(/<ref-list[\s\S]*?<\/ref-list>/gi, ' ').replace(/<back[\s\S]*?<\/back>/gi, ' ');
  let text = withoutRefs
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, (_, inner: string) => `\n\n## ${stripTags(inner)}\n`)
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<list-item[^>]*>/gi, '\n- ')
    .replace(/<table-wrap[\s\S]*?<\/table-wrap>/gi, ' ')
    .replace(/<disp-formula[\s\S]*?<\/disp-formula>/gi, ' ')
    .replace(/<xref[^>]*>([\s\S]*?)<\/xref>/gi, '$1')
    .replace(/<italic[^>]*>([\s\S]*?)<\/italic>/gi, '$1')
    .replace(/<bold[^>]*>([\s\S]*?)<\/bold>/gi, '$1');
  text = stripTags(text);
  return tidy(text);
}

/** Converte XML do NCBI Bookshelf em texto com títulos preservados. */
export function ncbiXmlToText(xml: string): string {
  let text = xml
    .replace(/<ref-list[\s\S]*?<\/ref-list>/gi, ' ')
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, (_, inner: string) => `\n\n## ${stripTags(inner)}\n`)
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<list-item[^>]*>/gi, '\n- ')
    .replace(/<table-wrap[\s\S]*?<\/table-wrap>/gi, ' ');
  text = stripTags(text);
  return tidy(text);
}

function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]+>/g, ' '));
}

function tidy(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Remove cabeçalhos/rodapés repetitivos comuns em páginas de artigos. */
export function cleanArticleText(text: string): string {
  const lines = text.split('\n');
  const noise = /^(cookie|aceitar cookies|política de privacidade|publicidade|compartilhe|download|assin(e|ar)|login|entrar|cadastre-se)\b/i;
  const filtered = lines.filter((line) => !noise.test(line.trim()));
  return tidy(filtered.join('\n'));
}
