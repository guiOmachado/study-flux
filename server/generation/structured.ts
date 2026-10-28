import type { CaseContent, CaseQuestion, Difficulty } from '../../shared/types';
import { detectArea, detectTopics, norm, preferredSections, type ParsedSource, type Section } from '../ingestion/analyze';
import { TOPIC_LEXICON } from '../ingestion/lexicon';
import { slugify } from '../util';
import { buildCloze } from './cloze';

export interface GeneratedCase {
  title: string;
  area: string;
  topic: string;
  difficulty: Difficulty;
  format: 'caso' | 'questao';
  minutes: number;
  key: string;
  content: CaseContent;
}

function shorten(text: string, limit = 240): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : `${cut.trim()}…`).trim();
}

function rotate<T>(items: T[], seed: number): T[] {
  if (items.length === 0) return items;
  const offset = seed % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function sectionFactsForTopic(parsed: ParsedSource, topic: string, types: string[], limit = 8): string[] {
  const entry = TOPIC_LEXICON.find((t) => t.topic === topic);
  const sectionHasTopic = (section: Section) => {
    if (!entry) return true;
    const heading = norm(section.heading);
    const body = norm(section.paragraphs.join(' ').slice(0, 1500));
    return entry.keywords.some((k) => heading.includes(norm(k)) || body.includes(norm(k)));
  };
  const matched = parsed.sections.filter((s) => types.includes(s.type) && sectionHasTopic(s));
  const pool = matched.length > 0 ? matched : parsed.sections.filter((s) => types.includes(s.type));
  const facts = pool.flatMap((s) => s.facts);
  const unique = [...new Set(facts)];
  if (unique.length === 0) return preferredSections(parsed, types[0] ?? 'quadro_clinico', limit);
  return unique.slice(0, limit);
}

function difficultyFromStats(facts: number, questions: number): Difficulty {
  if (facts >= 15 || questions >= 4) return 'dificil';
  if (facts >= 7) return 'media';
  return 'facil';
}

function buildPoolQuestions(
  parsed: ParsedSource,
  topic: string,
  pools: { label: string; types: string[] }[],
): CaseQuestion[] {
  const questions: CaseQuestion[] = [];
  for (const [poolIndex, pool] of pools.entries()) {
    const facts = sectionFactsForTopic(parsed, topic, pool.types, 6);
    let built = false;
    for (const [factIndex, fact] of facts.entries()) {
      const cloze = buildCloze(fact, poolIndex * 3 + factIndex + topic.length);
      if (!cloze) continue;
      const options = cloze.options.map((text, i) => ({ id: String.fromCharCode(97 + i), text: shorten(text, 120) }));
      const correctIndex = cloze.options.findIndex((text) => text === cloze.correct);
      if (correctIndex < 0) continue;
      questions.push({
        id: `q${questions.length + 1}`,
        stage: poolIndex,
        prompt: cloze.prompt,
        options,
        correctOptionId: options[correctIndex].id,
        rationale: cloze.explanation,
        keyPoint: `Revisar ${pool.label} de ${topic}.`,
        sourceExcerpt: shorten(fact, 320),
      });
      built = true;
      break;
    }
    if (built) continue;
  }
  return questions;
}

/** Gera blocos de fixação a partir de capítulos/resumos — 100% offline e fiéis ao texto. */
export function generateStudyBlocks(parsed: ParsedSource, sourceTitle: string): GeneratedCase[] {
  const topics = parsed.topics.length > 0 ? parsed.topics.slice(0, 4) : [parsed.sections[0]?.heading ?? sourceTitle];
  const cases: GeneratedCase[] = [];

  for (const [index, topic] of topics.entries()) {
    const entry = TOPIC_LEXICON.find((t) => t.topic === topic);
    const clinical = sectionFactsForTopic(parsed, topic, ['quadro_clinico', 'definicao', 'fisiopatologia'], 8);
    const diagnosis = sectionFactsForTopic(parsed, topic, ['diagnostico'], 8);
    const treatment = sectionFactsForTopic(parsed, topic, ['tratamento', 'prevencao', 'complicacoes'], 8);
    const allFacts = [...new Set([...clinical, ...diagnosis, ...treatment])];
    if (allFacts.length < 2) continue;

    const questions = buildPoolQuestions(parsed, topic, [
      { label: 'conceito e quadro clínico', types: ['definicao', 'quadro_clinico', 'fisiopatologia'] },
      { label: 'investigação diagnóstica', types: ['diagnostico'] },
      { label: 'tratamento e prevenção', types: ['tratamento', 'prevencao', 'complicacoes'] },
      { label: 'conceitos gerais', types: ['epidemiologia', 'outro'] },
    ]);

    if (questions.length < 2) continue;

    const area = entry?.area ?? parsed.area ?? detectArea(`${sourceTitle} ${topic}`);
    const key = `bloco-${slugify(topic)}`;
    const content: CaseContent = {
      title: `Fixação — ${topic}`,
      area,
      topic,
      difficulty: difficultyFromStats(allFacts.length, questions.length),
      format: 'questao',
      minutes: Math.max(4, questions.length * 2),
      objectives: [
        `Relembrar os pontos essenciais de ${topic}.`,
        'Fixar conceitos do material por recall ativo.',
      ],
      presentation: {
        paciente: `Revisão ativa do material “${sourceTitle}”`,
        queixa: `Perguntas de completar montadas a partir dos trechos do seu material sobre ${topic}.`,
        historia: rotate(allFacts, index).slice(0, 3).map((f) => shorten(f, 300)),
        antecedentes: [],
        exameFisico: [],
        sinaisVitais: [],
        exames: [],
      },
      questions,
      teachingPoints: rotate(allFacts, index + 1).slice(0, 4).map((f) => shorten(f, 300)),
      sourceRefs: [{ label: sourceTitle, excerpt: shorten(allFacts[0] ?? '', 300) }],
      generation: {
        mode: 'estruturado',
        warnings: [
          'Gerado sem IA: cada pergunta cita um trecho do material e usa termos do próprio conteúdo como alternativas.',
        ],
      },
    };
    cases.push({
      title: content.title,
      area,
      topic,
      difficulty: content.difficulty,
      format: 'questao',
      minutes: content.minutes,
      key,
      content,
    });
  }

  return cases;
}

/** Reaproveita questões de provas antigas que tenham gabarito. */
export function generateFromExam(parsed: ParsedSource, sourceTitle: string): GeneratedCase[] {
  const valid = parsed.questions.filter((q) => q.answerLetter && q.options.length >= 3 && q.stem.length > 30);
  if (valid.length === 0) return [];
  const blocks: typeof valid[] = [];
  for (let i = 0; i < valid.length; i += 4) blocks.push(valid.slice(i, i + 4));

  return blocks.map((block, blockIndex) => {
    const blockText = block.map((q) => q.stem).join(' ');
    const { topics, conditions } = detectTopics(blockText);
    const strongTopics = topics.filter((t) => t.hits >= 2);
    const area = strongTopics[0]
      ? TOPIC_LEXICON.find((t) => t.topic === strongTopics[0].topic)?.area ?? detectArea(blockText)
      : detectArea(blockText);
    const topic = strongTopics.length > 1 ? area : conditions[0] ?? strongTopics[0]?.topic ?? 'Questões de prova';
    const questions: CaseQuestion[] = block.map((q, i) => {
      const letters = q.options.map((o) => o.letter.toUpperCase());
      const correctLetter = q.answerLetter!.toUpperCase();
      const optionIds = new Map(letters.map((l) => [l, l.toLowerCase()]));
      const correctId = optionIds.get(correctLetter) ?? q.options[0].letter.toLowerCase();
      const options = q.options.map((o) => ({
        id: optionIds.get(o.letter.toUpperCase()) ?? o.letter.toLowerCase(),
        text: shorten(o.text, 300),
      }));
      return {
        id: `q${i + 1}`,
        stage: 0,
        prompt: q.stem,
        options,
        correctOptionId: options.some((o) => o.id === correctId) ? correctId : options[0].id,
        rationale: q.explanation
          ? shorten(q.explanation, 400)
          : `Gabarito do material: alternativa ${correctLetter}.`,
        keyPoint: `Questão ${q.number} da prova.`,
      };
    });

    const displayTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
    const title = `Prova comentada — ${displayTopic}${blocks.length > 1 ? ` (bloco ${blockIndex + 1})` : ''}`;
    const content: CaseContent = {
      title,
      area,
      topic,
      difficulty: 'media',
      format: 'questao',
      minutes: Math.max(5, questions.length * 3),
      objectives: [`Resolver questões de ${topic} com correção imediata e comentada.`],
      presentation: {
        paciente: `Prova: ${sourceTitle}`,
        queixa: 'Questões objetivas extraídas do seu material, com gabarito conferido na fonte.',
        historia: [],
        antecedentes: [],
        exameFisico: [],
        sinaisVitais: [],
        exames: [],
      },
      questions,
      teachingPoints: questions.map((q) => `Questão ${q.id.slice(1)}: alternativa correta ${q.correctOptionId.toUpperCase()}.`),
      sourceRefs: [{ label: sourceTitle }],
      generation: {
        mode: 'estruturado',
        warnings: ['Gerado sem IA a partir de questões e gabarito encontrados no material.'],
      },
    };
    return {
      title,
      area,
      topic,
      difficulty: content.difficulty,
      format: 'questao' as const,
      minutes: content.minutes,
      key: `prova-${blockIndex + 1}`,
      content,
    };
  });
}

export function generateStructured(parsed: ParsedSource, sourceTitle: string): GeneratedCase[] {
  const blocks = parsed.kind === 'prova' ? [] : generateStudyBlocks(parsed, sourceTitle);
  const exams = generateFromExam(parsed, sourceTitle);
  return [...exams, ...blocks].slice(0, 10);
}

export { shorten };
