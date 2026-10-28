import type { SourceAnalysis } from '../../shared/types';
import { stripDiacritics } from '../util';
import { AREA_KEYWORDS, SECTION_TYPES, TOPIC_LEXICON } from './lexicon';

export interface Section {
  heading: string;
  type: string;
  paragraphs: string[];
  facts: string[];
}

export interface ParsedQuestion {
  number: number;
  stem: string;
  options: { letter: string; text: string }[];
  answerLetter?: string;
  explanation?: string;
}

export interface ParsedSource {
  kind: SourceAnalysis['kind'];
  sections: Section[];
  questions: ParsedQuestion[];
  topics: string[];
  conditions: string[];
  area: string;
  words: number;
  warnings: string[];
  rawFacts: string[];
}

const norm = (s: string) => stripDiacritics(s).toLowerCase();
const MONTHS = /^(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/;

function countOccurrences(haystack: string, needle: string): number {
  const n = norm(needle).trim();
  if (!n) return 0;
  if (/\s/.test(n)) {
    let idx = 0;
    let count = 0;
    while ((idx = haystack.indexOf(n, idx)) !== -1) {
      count += 1;
      idx += n.length;
    }
    return count;
  }
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'g');
  return (haystack.match(re) ?? []).length;
}

function classifySection(heading: string): string {
  const h = norm(heading);
  for (const { type, keywords } of SECTION_TYPES) {
    if (keywords.some((k) => h.includes(k))) return type;
  }
  return 'outro';
}

function isHeading(line: string): boolean {
  const raw = line.trim();
  if (!raw) return false;
  if (/^#{1,6}\s+\S/.test(raw)) return true;
  if (raw.length > 110) return false;
  const t = raw.replace(/^#{1,6}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
  if (!t) return false;
  const lower = norm(t).replace(/[:\s]+$/, '');
  const sectionMatch = SECTION_TYPES.some(({ keywords }) => keywords.some((k) => lower === k || lower.startsWith(`${k} `) || lower.startsWith(`${k}:`)));
  if (sectionMatch && t.length <= 90) return true;
  if (t === t.toUpperCase() && t.length <= 70 && /[A-ZÀ-Ú]{3}/.test(t) && !/[.!?]$/.test(t)) return true;
  if (/^(\d+(\.\d+){0,2})[.)]?\s+\S/.test(t) && t.length <= 85 && !/[.;]$/.test(t)) {
    const after = t.replace(/^(\d+(\.\d+){0,2})[.)]?\s+/, '');
    if (after && after[0] === after[0].toUpperCase() && after.split(/\s+/).length <= 12) return true;
  }
  if (/^(cap[ií]tulo|se[cç][aã]o|unidade|m[oó]dulo|tema|aula)\s+\d+/i.test(t) && t.length <= 90) return true;
  return false;
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú0-9"(“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isUsefulFact(sentence: string): boolean {
  if (sentence.length < 45 || sentence.length > 420) return false;
  if (!/[a-zà-ú]{3,}/.test(sentence)) return false;
  const words = sentence.split(/\s+/).length;
  return words >= 7;
}

function parseSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (!current) return;
    const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
    buffer = [];
    if (!text) return;
    const paragraphs = text.length > 900 ? chunkParagraph(text) : [text];
    current.paragraphs.push(...paragraphs);
    for (const p of paragraphs) {
      for (const s of splitSentences(p)) {
        if (isUsefulFact(s)) current.facts.push(s);
      }
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (isHeading(line)) {
      flushParagraph();
      const heading = line.replace(/^#{1,6}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
      current = { heading, type: classifySection(heading), paragraphs: [], facts: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { heading: 'Conteúdo', type: 'outro', paragraphs: [], facts: [] };
      sections.push(current);
    }
    buffer.push(line.trim());
  }
  flushParagraph();
  return sections.filter((s) => s.paragraphs.length > 0 || s.heading);
}

function chunkParagraph(text: string): string[] {
  const sentences = splitSentences(text);
  const out: string[] = [];
  let buffer = '';
  for (const s of sentences) {
    if ((buffer + ' ' + s).trim().length > 700 && buffer) {
      out.push(buffer.trim());
      buffer = s;
    } else {
      buffer = `${buffer} ${s}`.trim();
    }
  }
  if (buffer) out.push(buffer.trim());
  return out;
}

const OPTION_RE = /^\s*\(?([a-eA-E])\)?\s*[).\-–]\s*(.+)$/;
const QUESTION_RE = /^\s*(?:quest[aã]o\s*)?(\d{1,3})\s*[).\-–]?\s+(.*)$/i;
const ANSWER_INLINE_RE = /(?:resposta|gabarito|alternativa correta|resposta correta)\s*[:=\-–]?\s*\(?([a-eA-E])\)?/i;

function parseQuestions(lines: string[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;
  let pendingOption: { letter: string; text: string } | null = null;
  let inAnswerKey = false;

  for (const raw of lines) {
    const line = raw.replace(/^\s+/, '');
    if (!line.trim()) continue;
    const lower = norm(line);

    if (isHeading(line) && /gabarito|respostas|answer key|comentarios/.test(lower)) {
      inAnswerKey = true;
      current = null;
      pendingOption = null;
      continue;
    }
    if (inAnswerKey) {
      const keyed = line.match(/^\s*(\d{1,3})\s*[).\-–:]\s*\(?([a-eA-E])\)?\b/);
      if (keyed) {
        const q = questions.find((item) => item.number === Number(keyed[1]));
        if (q && !q.answerLetter) q.answerLetter = keyed[2].toUpperCase();
        continue;
      }
      if (isHeading(line) && !/gabarito|respostas/.test(lower)) inAnswerKey = false;
      else continue;
    }

    const optMatch = line.match(OPTION_RE);
    const openQuestion = current as ParsedQuestion | null;
    if (optMatch && openQuestion) {
      const option = { letter: optMatch[1].toUpperCase(), text: optMatch[2].trim() };
      openQuestion.options.push(option);
      pendingOption = option;
      continue;
    }

    const qMatch = line.match(QUESTION_RE);
    const looksLikeStem = qMatch && qMatch[2].trim().length > 15;
    const canStart = looksLikeStem && (!openQuestion || openQuestion.options.length >= 2 || openQuestion.stem.length > 0);
    if (canStart) {
      const number = Number(qMatch![1]);
      const stem = qMatch![2].trim();
      if (openQuestion && number === openQuestion.number && openQuestion.options.length === 0) {
        openQuestion.stem = `${openQuestion.stem} ${stem}`.trim();
      } else {
        current = { number, stem, options: [] };
        questions.push(current);
        pendingOption = null;
        const inline = stem.match(ANSWER_INLINE_RE);
        if (inline) current.answerLetter = inline[1].toUpperCase();
      }
      continue;
    }

    if (openQuestion) {
      const inline = line.match(ANSWER_INLINE_RE);
      if (inline) {
        openQuestion.answerLetter = inline[1].toUpperCase();
        continue;
      }
      if (pendingOption) {
        pendingOption.text = `${pendingOption.text} ${line.trim()}`.replace(/\s+/g, ' ').trim();
      } else if (openQuestion.options.length === 0) {
        openQuestion.stem = `${openQuestion.stem} ${line.trim()}`.replace(/\s+/g, ' ').trim();
      }
    }
  }

  return questions.filter((q) => q.options.length >= 2).map((q) => ({ ...q, stem: q.stem.replace(/\s+/g, ' ').trim() }));
}

export function detectArea(text: string, fallback = 'Clínica Médica'): string {
  const normalized = norm(text);
  let best = { area: fallback, hits: 0 };
  for (const { area, keywords } of AREA_KEYWORDS) {
    const hits = keywords.reduce((acc, k) => acc + countOccurrences(normalized, k), 0);
    if (hits > best.hits) best = { area, hits };
  }
  return best.area;
}

export function detectTopics(text: string): { topics: { topic: string; area: string; hits: number }[]; conditions: string[] } {
  const normalized = norm(text);
  const topics: { topic: string; area: string; hits: number }[] = [];
  const conditions = new Set<string>();
  for (const entry of TOPIC_LEXICON) {
    const hits = entry.keywords.reduce((acc, k) => acc + countOccurrences(normalized, k), 0);
    if (hits >= 2) {
      topics.push({ topic: entry.topic, area: entry.area, hits });
      for (const condition of entry.conditions) {
        if (countOccurrences(normalized, condition) > 0) conditions.add(condition);
      }
    }
  }
  topics.sort((a, b) => b.hits - a.hits);
  return { topics, conditions: [...conditions].slice(0, 12) };
}

export function analyzeSource(rawText: string, title: string, discipline?: string | null): ParsedSource {
  const lines = rawText.split('\n').map((l) => l.replace(/\s+$/g, ''));
  const words = rawText.split(/\s+/).filter(Boolean).length;
  const sections = parseSections(lines);
  const questions = parseQuestions(lines);
  const withAnswer = questions.filter((q) => q.answerLetter);
  const headings = sections.map((s) => s.heading).join(' ');
  const weighted = `${title} ${title} ${title} ${title} ${headings} ${headings} ${headings} ${rawText}`;
  const detected = detectTopics(weighted);
  const topHits = detected.topics[0]?.hits ?? 0;
  const keptTopics = detected.topics.filter((t) => t.hits >= Math.max(3, topHits * 0.35));
  const topics = keptTopics.map((t) => t.topic);
  const keptSet = new Set(topics);
  const conditions = [
    ...new Set(
      TOPIC_LEXICON.filter((entry) => keptSet.has(entry.topic))
        .flatMap((entry) => entry.conditions)
        .filter((condition) => countOccurrences(norm(rawText), condition) > 0),
    ),
  ].slice(0, 12);
  const area = detectArea(`${title} ${discipline ?? ''} ${rawText.slice(0, 4000)}`, discipline ?? undefined);
  const warnings: string[] = [];

  const hasQuestionsSection = sections.some((s) => s.type === 'questoes' || s.type === 'gabarito');
  let kind: ParsedSource['kind'] = 'resumo';
  if (questions.length >= 3 || (hasQuestionsSection && questions.length >= 1)) kind = 'prova';
  else if (sections.length >= 3 && words > 400) kind = 'capitulo';

  if (sections.length <= 1 && words > 900) {
    warnings.push('Não identificamos títulos/seções no texto. A geração estruturada funcionará melhor se o material tiver subtítulos.');
  }
  if (kind === 'prova' && withAnswer.length === 0) {
    warnings.push('Encontramos questões, mas nenhum gabarito. Sem gabarito, só a geração por IA consegue montar casos completos.');
  }
  if (kind === 'prova' && questions.length > 0 && withAnswer.length > 0 && withAnswer.length < questions.length) {
    warnings.push(`Gabarito encontrado para ${withAnswer.length} de ${questions.length} questões.`);
  }
  if (topics.length === 0) {
    warnings.push('Nenhum tema do currículo foi reconhecido automaticamente; a área será inferida pelo texto.');
  }
  if (words < 250) {
    warnings.push('Material curto: pode gerar poucos casos e com menos contexto.');
  }

  const rawFacts: string[] = [];
  for (const section of sections) rawFacts.push(...section.facts);

  return {
    kind,
    sections,
    questions,
    topics,
    conditions,
    area,
    words,
    warnings,
    rawFacts,
  };
}

export function toAnalysis(parsed: ParsedSource, extraWarnings: string[] = []): SourceAnalysis {
  const seen = new Set<string>();
  const sections = parsed.sections
    .filter((s) => {
      const key = `${s.heading}|${s.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => ({ heading: s.heading, type: s.type, facts: s.facts.length }));
  return {
    kind: parsed.kind,
    sections,
    topics: parsed.topics,
    conditions: parsed.conditions,
    examQuestions: parsed.questions.length,
    examQuestionsWithKey: parsed.questions.filter((q) => q.answerLetter).length,
    words: parsed.words,
    readingMinutes: Math.max(1, Math.round(parsed.words / 200)),
    warnings: [...parsed.warnings, ...extraWarnings],
  };
}

export function preferredSections(parsed: ParsedSource, type: string, limit = 6): string[] {
  return parsed.sections
    .filter((s) => s.type === type)
    .flatMap((s) => s.facts)
    .slice(0, limit);
}

export function sectionTexts(parsed: ParsedSource, maxChars: number): { heading: string; type: string; text: string }[] {
  const chunks: { heading: string; type: string; text: string }[] = [];
  let buffer = { heading: '', type: 'outro', text: '' };
  for (const section of parsed.sections) {
    const body = section.paragraphs.join('\n');
    const piece = `## ${section.heading}\n${body}`;
    if (buffer.text && buffer.text.length + piece.length > maxChars) {
      chunks.push(buffer);
      buffer = { heading: section.heading, type: section.type, text: piece };
    } else {
      if (!buffer.text) buffer = { heading: section.heading, type: section.type, text: piece };
      else buffer.text += `\n\n${piece}`;
    }
  }
  if (buffer.text.trim()) chunks.push(buffer);
  if (chunks.length === 0) chunks.push({ heading: 'Conteúdo', type: 'outro', text: '' });
  return chunks;
}

export { countOccurrences, norm };
