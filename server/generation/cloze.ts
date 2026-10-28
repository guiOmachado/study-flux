import { TOPIC_LEXICON } from '../ingestion/lexicon';

/**
 * Banco de termos por categoria. Serve para montar alternativas plausíveis em
 * perguntas de completar (cloze) sem depender de IA.
 */
export const TERM_BANK: Record<string, string[]> = {
  classe_farmaco: [
    'diuréticos tiazídicos',
    'inibidores da enzima conversora de angiotensina',
    'bloqueadores dos receptores de angiotensina',
    'bloqueadores dos canais de cálcio',
    'betabloqueadores',
    'estatinas',
    'antibióticos',
    'anticoagulantes',
    'corticosteroides',
    'anti-inflamatórios não esteroidais',
    'inibidores seletivos da recaptação de serotonina',
    'benzodiazepínicos',
    'antipsicóticos',
    'insulina',
    'metformina',
    'sulfato de magnésio',
    'nifedipino',
    'hidralazina',
    'ácido acetilsalicílico',
    'clopidogrel',
    'heparina',
    'trombolíticos',
    'broncodilatadores',
    'corticoide inalatório',
    'palivizumabe',
  ],
  exame: [
    'eletrocardiograma',
    'ecocardiograma',
    'monitorização ambulatorial da pressão arterial',
    'monitorização residencial da pressão arterial',
    'ultrassonografia',
    'tomografia computadorizada',
    'ressonância magnética',
    'biópsia',
    'hemograma',
    'gasometria arterial',
    'cultura',
    'teste rápido para VSR',
    'mamografia',
    'citologia oncótica',
    'espirometria',
    'cateterismo cardíaco',
    'angiotomografia',
    'proteinúria',
    'fundoscopia',
  ],
  conduta: [
    'angioplastia primária',
    'trombólise',
    'reperfusão',
    'internação hospitalar',
    'antibioticoterapia',
    'reposição volêmica',
    'hidratação',
    'insulina intravenosa',
    'cesariana',
    'parto vaginal',
    'interrupção da gestação',
    'apendicectomia',
    'videolaparoscopia',
    'oxigenoterapia',
    'suporte clínico',
    'psicoterapia',
  ],
  desfecho: [
    'insuficiência cardíaca',
    'choque',
    'edema cerebral',
    'hipocalemia',
    'eclâmpsia',
    'sepse',
    'lesão de órgão-alvo',
    'insuficiência renal',
    'acidente vascular cerebral',
    'morte',
  ],
  doenca: TOPIC_LEXICON.flatMap((t) => t.conditions).filter((c, i, arr) => arr.indexOf(c) === i),
};

const ACCENT_CLASS: Record<string, string> = {
  a: '[aáàâã]',
  e: '[eéê]',
  i: '[ií]',
  o: '[oóôõ]',
  u: '[uú]',
  c: '[cç]',
};

export function termRegex(term: string): RegExp {
  const pattern = term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((char) => {
      if (char === ' ') return '[\\s-]+';
      if (char === '-') return '[\\s-]?';
      const lower = char.toLowerCase();
      const cls = ACCENT_CLASS[lower];
      if (cls) return cls;
      return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`(?<![a-zà-ú])${pattern}(?![a-zà-ú])`, 'i');
}

interface TermMatch {
  category: string;
  term: string;
  index: number;
  length: number;
}

function findTerm(fact: string): TermMatch | null {
  const matches: TermMatch[] = [];
  for (const [category, terms] of Object.entries(TERM_BANK)) {
    for (const term of terms) {
      const re = termRegex(term);
      const found = fact.match(re);
      if (found && found.index != null) {
        matches.push({ category, term, index: found.index, length: found[0].length });
      }
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.length - a.length);
  return matches[0];
}

const NUMBER_UNITS = ['mmHg', 'mg/dL', 'mEq/L', 'mmol/L', 'mUI/L', 'ng/mL', 'U/L', 'mL/kg', '%', 'minutos', 'horas', 'dias', 'semanas', 'meses', 'anos', 'mm', 'cm', 'kg/m²', 'kg', 'bpm', 'irpm'];

interface NumberMatch {
  raw: string;
  unit: string;
  index: number;
}

function findNumber(fact: string): NumberMatch | null {
  const unitPattern = NUMBER_UNITS.join('|');
  const re = new RegExp(`(\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+(?:[.,]\\d+)?)?)\\s*(${unitPattern})`, 'i');
  const found = fact.match(re);
  if (!found || found.index == null) return null;
  return { raw: found[1], unit: found[2], index: found.index };
}

function numeral(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace('.', ',');
}

function numericDistractors(raw: string, unit: string): string[] {
  if (raw.includes('/')) {
    const [sys, dia] = raw.split('/').map((v) => Number(v.trim().replace(',', '.')));
    const candidates = [
      `${Math.round(sys * 0.9)}/${Math.round(dia * 0.85)}`,
      `${Math.round(sys * 1.15)}/${Math.round(dia * 1.1)}`,
      `${Math.round(sys * 0.8)}/${Math.round(dia * 0.9)}`,
      `${Math.round(sys * 1.3)}/${Math.round(dia * 1.2)}`,
    ];
    return candidates.filter((c) => c !== raw).slice(0, 3);
  }
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value === 0) return [];
  const factors = [0.5, 0.75, 1.5, 2];
  const out = new Set<string>();
  for (const factor of factors) {
    const candidate = value * factor;
    const rounded = value < 1 ? Math.round(candidate * 100) / 100 : Math.round(candidate);
    handle: {
      if (rounded <= 0) break handle;
      const label = numeral(rounded);
      if (label !== raw.replace('.', ',')) out.add(label);
    }
    if (out.size >= 3) break;
  }
  return [...out].slice(0, 3);
}

export interface ClozeQuestion {
  prompt: string;
  options: string[];
  correct: string;
  explanation: string;
}

function trimAroundBlank(blanked: string, limit = 340): string {
  const idx = blanked.indexOf('______');
  if (blanked.length <= limit || idx < 0) return blanked;
  const start = Math.max(0, idx - 170);
  const end = Math.min(blanked.length, idx + 60 + 120);
  return `${start > 0 ? '…' : ''}${blanked.slice(start, end).trim()}${end < blanked.length ? '…' : ''}`;
}

export function buildCloze(fact: string, seed = 0): ClozeQuestion | null {
  const clean = fact.replace(/\s+/g, ' ').trim();
  if (clean.length < 40) return null;
  const term = findTerm(clean);

  if (term) {
    const options = TERM_BANK[term.category];
    const correctText = clean.slice(term.index, term.index + term.length);
    const blanked = `${clean.slice(0, term.index)}______${clean.slice(term.index + term.length)}`;
    const distractors = [...options]
      .filter((o) => o.toLowerCase() !== term.term.toLowerCase())
      .filter((o) => !termRegex(o).test(blanked))
      .sort((a, b) => ((a.length + seed) % 7) - ((b.length + seed) % 7));
    const chosen = [...distractors.slice(0, 3)];
    if (chosen.length < 3) return null;
    const all = [correctText, ...chosen];
    const rotateBy = seed % all.length;
    const rotated = [...all.slice(rotateBy), ...all.slice(0, rotateBy)];
    return {
      prompt: `Complete a afirmação de acordo com o material:\n\n“${trimAroundBlank(blanked)}”`,
      options: rotated.map((o) => o.charAt(0).toUpperCase() + o.slice(1)),
      correct: (correctText.charAt(0).toUpperCase() + correctText.slice(1)),
      explanation: `Trecho do material: “${clean}”`,
    };
  }

  const number = findNumber(clean);
  if (number) {
    const distractors = numericDistractors(number.raw, number.unit);
    if (distractors.length < 3) return null;
    const blankSep = number.unit === '%' || number.unit === '°C' ? '' : ' ';
    const blanked = `${clean.slice(0, number.index)}______${blankSep}${number.unit}${clean.slice(number.index + number.raw.length + number.unit.length)}`;
    const sep = number.unit === '%' || number.unit === '°C' ? '' : ' ';
    const all = [`${number.raw}${sep}${number.unit}`, ...distractors.map((d) => `${d}${sep}${number.unit}`)];
    const rotateBy = seed % all.length;
    const rotated = [...all.slice(rotateBy), ...all.slice(0, rotateBy)];
    return {
      prompt: `Complete o valor correto, segundo o material:\n\n“${trimAroundBlank(blanked).replace(/\s+/g, ' ')}”`,
      options: rotated,
      correct: `${number.raw}${number.unit === '%' || number.unit === '°C' ? '' : ' '}${number.unit}`,
      explanation: `Trecho do material: “${clean}”`,
    };
  }

  return null;
}
