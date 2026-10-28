// Tipos compartilhados entre servidor e cliente.
export const AREAS = [
  'Clínica Médica',
  'Cirurgia',
  'Pediatria',
  'Ginecologia e Obstetrícia',
  'Saúde Coletiva',
  'Psiquiatria',
] as const;
export type Area = (typeof AREAS)[number];

export type Difficulty = 'facil' | 'media' | 'dificil';
export type CaseStatus = 'rascunho' | 'publicado' | 'arquivado';
export type CaseOrigin = 'demo' | 'estruturado' | 'ia' | 'manual';
export type CaseFormat = 'caso' | 'questao';
export type AttemptMode = 'treino' | 'simulado' | 'revisao';
export type SrsGrade = 'errei' | 'dificil' | 'bom' | 'facil';

export interface CaseOption {
  id: string;
  text: string;
}

export interface CaseQuestion {
  id: string;
  stage: number; // 0..3 — controla o que do prontuário é revelado
  prompt: string;
  options: CaseOption[];
  correctOptionId: string;
  rationale: string;
  keyPoint?: string;
  sourceExcerpt?: string;
  tags?: string[];
}

export interface VitalSign {
  label: string;
  value: string;
  flag?: 'alta' | 'baixa' | 'normal';
}

export interface LabResult {
  nome: string;
  resultado: string;
  ref?: string;
}

export interface CasePresentation {
  paciente: string;
  queixa: string;
  historia: string[];
  antecedentes: string[];
  exameFisico: string[];
  sinaisVitais: VitalSign[];
  exames: LabResult[];
  imagem?: string; // descrição textual de imagem/ECG, exibida como "laudo"
}

export interface CaseContent {
  title: string;
  area: Area | string;
  topic: string;
  difficulty: Difficulty;
  format: CaseFormat;
  minutes: number;
  objectives: string[];
  presentation: CasePresentation;
  questions: CaseQuestion[];
  teachingPoints: string[];
  sourceRefs: { label: string; excerpt?: string }[];
  generation: {
    mode: 'demo' | 'estruturado' | 'ia' | 'manual';
    warnings: string[];
    confidence?: number;
    model?: string;
  };
}

export interface CaseSummary {
  id: number;
  title: string;
  area: string;
  topic: string;
  difficulty: Difficulty;
  status: CaseStatus;
  origin: CaseOrigin;
  format: CaseFormat;
  minutes: number;
  questionCount: number;
  sourceId: number | null;
  sourceTitle: string | null;
  updatedAt: string;
  attempts?: number;
  accuracy?: number | null;
  tags?: string[];
  canEdit?: boolean;
}

export interface CaseDetail extends CaseSummary {
  data: CaseContent;
  canEdit: boolean;
}

export interface SourceSummary {
  id: number;
  title: string;
  kind: string;
  discipline: string | null;
  filename: string | null;
  mime: string | null;
  pages: number | null;
  chars: number;
  status: 'processando' | 'pronto' | 'gerando' | 'gerado' | 'erro';
  error: string | null;
  createdAt: string;
  caseCount: number;
  analysis: SourceAnalysis | null;
}

export interface SourceAnalysis {
  kind: 'prova' | 'capitulo' | 'resumo';
  language?: 'pt' | 'en' | 'es' | 'outro';
  sections: { heading: string; type: string; facts: number }[];
  topics: string[];
  conditions: string[];
  examQuestions: number;
  examQuestionsWithKey: number;
  words: number;
  readingMinutes: number;
  warnings: string[];
}

export interface SourceDetail extends SourceSummary {
  excerpt: string;
  textPreview: string;
}

export interface UserDTO {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export interface AISettings {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'compatible';
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export interface SettingsDTO {
  ai: AISettings;
  srsAutoCreate: boolean;
  dailyGoal: number;
  examDate: string | null;
}

export interface AttemptQuestionResult {
  questionId: string;
  prompt: string;
  correctOptionId: string;
  chosenOptionId: string | null;
  correct: boolean;
  rationale: string;
  keyPoint?: string;
  sourceExcerpt?: string;
  timeMs: number;
  stage: number;
}

export interface AttemptDTO {
  id: number;
  caseId: number | null;
  caseTitle: string;
  area: string;
  topic: string;
  mode: AttemptMode;
  status: 'em_andamento' | 'concluido' | 'abandonado';
  score: number;
  total: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  batchId: string | null;
  results: AttemptQuestionResult[];
}

export interface SrsCardDTO {
  id: number;
  caseId: number | null;
  caseTitle: string | null;
  front: string;
  back: string;
  area: string | null;
  topic: string | null;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

export interface AreaStat {
  area: string;
  answered: number;
  correct: number;
  accuracy: number;
}

export interface TopicStat {
  topic: string;
  area: string;
  answered: number;
  correct: number;
  accuracy: number;
}

export interface StatsDTO {
  totals: {
    casesSolved: number;
    questionsAnswered: number;
    accuracy: number;
    avgTimeSec: number;
    dueCards: number;
    streak: number;
    publishedCases: number;
    materials: number;
  };
  byArea: AreaStat[];
  weakTopics: TopicStat[];
  strongTopics: TopicStat[];
  daily: { date: string; answered: number; correct: number }[];
  recentAttempts: AttemptDTO[];
  goal: { target: number; doneToday: number };
}

export interface GenerationResultDTO {
  sourceId: number;
  created: number;
  updated: number;
  mode: 'estruturado' | 'ia';
  warnings: string[];
  caseIds: number[];
}
