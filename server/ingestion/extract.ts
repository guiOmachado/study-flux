import path from 'node:path';
import mammoth from 'mammoth';
import { MAX_TEXT_CHARS } from '../config';
import { normalizeText } from '../util';

export interface ExtractResult {
  text: string;
  pages: number | null;
  warnings: string[];
  mime: string;
}

type PdfTextItem = { str: string; transform?: number[]; hasEOL?: boolean };

function pdfItemsToText(items: PdfTextItem[]): string {
  const lines: { y: number; parts: string[] }[] = [];
  for (const item of items) {
    const str = item.str ?? '';
    if (!str) continue;
    const y = item.transform?.[5] ?? 0;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) < 2.5) {
      last.parts.push(str);
    } else {
      lines.push({ y, parts: [str] });
    }
    if (item.hasEOL) lines.push({ y: y - 1000, parts: [] });
  }
  return lines
    .map((l) => l.parts.join(' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; pages: number; warning?: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  } as never).promise;
  const chunks: string[] = [];
  let looseItems = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as PdfTextItem[];
    looseItems += items.filter((it) => (it.str ?? '').trim().length > 0).length;
    const pageText = pdfItemsToText(items);
    if (pageText.trim()) chunks.push(pageText);
  }
  const text = chunks.join('\n\n');
  await doc.destroy();
  const warning =
    text.replace(/\s/g, '').length < Math.max(120, looseItems * 2)
      ? 'Pouco texto selecionável no PDF: ele pode ser digitalizado (imagem). A extração automática não lê imagens — cole o texto ou use um PDF com camada de texto.'
      : undefined;
  return { text, pages: doc.numPages, warning };
}

export async function extractDocument(buffer: Buffer, filename: string, mimeHint?: string): Promise<ExtractResult> {
  const ext = path.extname(filename).toLowerCase();
  const mime = mimeHint || guessMime(ext);
  const warnings: string[] = [];

  if (ext === '.pdf' || mime === 'application/pdf') {
    const { text, pages, warning } = await extractPdf(buffer);
    if (warning) warnings.push(warning);
    return finalize(text, pages, warnings, mime);
  }

  if (ext === '.docx' || mime.includes('wordprocessingml')) {
    const { value } = await mammoth.extractRawText({ buffer });
    return finalize(value, null, warnings, mime);
  }

  if (ext === '.doc') {
    throw new Error('Arquivos .doc antigos não são suportados. Salve como .docx ou PDF e tente novamente.');
  }

  if (ext === '.txt' || ext === '.md' || ext === '.markdown' || mime.startsWith('text/')) {
    const raw = buffer.toString('utf8');
    if (raw.includes('\uFFFD')) warnings.push('O arquivo de texto pode ter sido salvo em outra codificação; alguns caracteres podem estar incorretos.');
    return finalize(raw, null, warnings, mime);
  }

  throw new Error('Formato não suportado. Envie PDF, DOCX, TXT ou MD.');
}

function guessMime(ext: string): string {
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc':
      return 'application/msword';
    case '.md':
    case '.markdown':
      return 'text/markdown';
    default:
      return 'text/plain';
  }
}

function finalize(rawText: string, pages: number | null, warnings: string[], mime: string): ExtractResult {
  let text = normalizeText(rawText);
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    warnings.push(`Material muito grande: analisamos apenas os primeiros ${Math.round(MAX_TEXT_CHARS / 1000)} mil caracteres.`);
  }
  if (text.replace(/\s/g, '').length < 200) {
    warnings.push('Extraímos muito pouco texto deste arquivo. Confira se o conteúdo está legível ou cole o texto manualmente.');
  }
  return { text, pages, warnings, mime };
}
