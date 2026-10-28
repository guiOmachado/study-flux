import type {
  AttemptDTO,
  CaseDetail,
  CaseSummary,
  GenerationResultDTO,
  SettingsDTO,
  SourceDetail,
  SourceSummary,
  SrsCardDTO,
  SrsGrade,
  StatsDTO,
  UserDTO,
} from '@shared/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Erro ${response.status}. Tente novamente.`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export interface CaseListFilters {
  area?: string;
  difficulty?: string;
  q?: string;
  mine?: boolean;
  status?: string;
  sourceId?: number;
  limit?: number;
}

export interface PlayableCase {
  id: number;
  title: string;
  area: string;
  topic: string;
  difficulty: string;
  format: string;
  minutes: number;
  sourceTitle: string | null;
  presentation: CaseDetail['data']['presentation'];
  objectives: string[];
  questions: { id: string; stage: number; prompt: string; options: { id: string; text: string }[] }[];
  questionCount: number;
}

export interface AnswerFeedback {
  correct: boolean;
  correctOptionId: string;
  correctOptionText: string;
  rationale: string;
  keyPoint?: string;
  sourceExcerpt?: string;
  score: number;
  total: number;
  answered: number;
}

export const api = {
  me: () => request<{ user: UserDTO }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: UserDTO }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    request<{ user: UserDTO }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  demo: () => request<{ user: UserDTO }>('/auth/demo', { method: 'POST' }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  updateProfile: (name: string) => request<{ user: UserDTO }>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) }),

  sources: {
    list: () => request<{ sources: SourceSummary[] }>('/sources'),
    get: (id: number) => request<{ source: SourceSummary; excerpt: string; textPreview: string }>(`/sources/${id}`),
    create: (form: FormData) => request<{ source: SourceSummary; warnings: string[] }>('/sources', { method: 'POST', body: form }),
    remove: (id: number) => request<{ ok: true }>(`/sources/${id}`, { method: 'DELETE' }),
    reanalyze: (id: number) => request<{ source: SourceSummary }>(`/sources/${id}/reanalyze`, { method: 'POST' }),
    rename: (id: number, body: { title?: string; discipline?: string }) =>
      request<{ source: SourceSummary }>(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },

  cases: {
    list: (filters: CaseListFilters = {}) => {
      const params = new URLSearchParams();
      if (filters.area) params.set('area', filters.area);
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.q) params.set('q', filters.q);
      if (filters.mine) params.set('mine', '1');
      if (filters.status) params.set('status', filters.status);
      if (filters.sourceId) params.set('sourceId', String(filters.sourceId));
      if (filters.limit) params.set('limit', String(filters.limit));
      return request<{ cases: CaseSummary[]; total: number }>(`/cases?${params.toString()}`);
    },
    get: (id: number) => request<{ case: CaseDetail }>(`/cases/${id}`),
    play: (id: number) => request<{ case: PlayableCase }>(`/cases/${id}/play`),
    create: (body: unknown) => request<{ case: CaseDetail }>('/cases', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: unknown) => request<{ case: CaseDetail }>(`/cases/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    publish: (id: number, publish: boolean) =>
      request<{ case: CaseDetail }>(`/cases/${id}/publish`, { method: 'POST', body: JSON.stringify({ publish }) }),
    duplicate: (id: number) => request<{ case: CaseDetail }>(`/cases/${id}/duplicate`, { method: 'POST' }),
    remove: (id: number) => request<{ ok: true }>(`/cases/${id}`, { method: 'DELETE' }),
    importCase: (payload: unknown) => request<{ case: CaseDetail }>('/cases/import', { method: 'POST', body: JSON.stringify(payload) }),
    exportUrl: (id: number) => `/api/cases/${id}/export`,
  },

  generate: {
    preview: (sourceId: number) =>
      request<{
        analysis: {
          kind: string;
          topics: string[];
          conditions: string[];
          area: string;
          sections: { heading: string; type: string; facts: number }[];
          questions: number;
          questionsWithKey: number;
          warnings: string[];
        };
        drafts: {
          key: string;
          title: string;
          area: string;
          topic: string;
          difficulty: string;
          format: string;
          minutes: number;
          questions: { prompt: string; options: { id: string; text: string }[]; correctOptionId: string; rationale: string }[];
        }[];
        aiAvailable: boolean;
      }>(`/generate/preview/${sourceId}`, { method: 'POST' }),
    source: (sourceId: number, body: { mode: 'auto' | 'estruturado' | 'ia'; maxCases?: number; publish?: boolean }) =>
      request<GenerationResultDTO & { cases: CaseDetail[] }>(`/generate/source/${sourceId}`, { method: 'POST', body: JSON.stringify(body) }),
    topic: (body: { topic: string; area?: string; difficulty?: string; count?: number; publish?: boolean }) =>
      request<Omit<GenerationResultDTO, 'sourceId'> & { cases: CaseDetail[] }>('/generate/topic', { method: 'POST', body: JSON.stringify(body) }),
  },

  attempts: {
    start: (caseId: number, mode: 'treino' | 'simulado' | 'revisao' = 'treino') =>
      request<{ attempt: AttemptDTO; case: PlayableCase }>('/attempts', { method: 'POST', body: JSON.stringify({ caseId, mode }) }),
    startBatch: (body: { mode?: 'simulado' | 'treino'; caseIds?: number[]; area?: string; limit?: number }) =>
      request<{ batchId: string; items: { attemptId: number; attempt: AttemptDTO; case: PlayableCase }[] }>('/attempts/start-batch', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    get: (id: number) => request<{ attempt: AttemptDTO; case: PlayableCase | null }>(`/attempts/${id}`),
    answer: (id: number, body: { questionId: string; optionId: string; timeMs: number }) =>
      request<AnswerFeedback>(`/attempts/${id}/answer`, { method: 'POST', body: JSON.stringify(body) }),
    finish: (id: number, durationMs?: number) =>
      request<{ attempt: AttemptDTO }>(`/attempts/${id}/finish`, { method: 'POST', body: JSON.stringify({ durationMs }) }),
    list: (limit = 20) => request<{ attempts: AttemptDTO[] }>(`/attempts?limit=${limit}`),
  },

  srs: {
    list: () => request<{ cards: SrsCardDTO[]; due: number }>('/srs'),
    due: (limit = 30) => request<{ cards: SrsCardDTO[] }>(`/srs/due?limit=${limit}`),
    review: (id: number, grade: SrsGrade) => request<{ card: SrsCardDTO }>(`/srs/${id}/review`, { method: 'POST', body: JSON.stringify({ grade }) }),
    fromCase: (caseId: number) => request<{ created: number }>(`/srs/from-case/${caseId}`, { method: 'POST' }),
    remove: (id: number) => request<{ ok: true }>(`/srs/${id}`, { method: 'DELETE' }),
  },

  stats: {
    get: () => request<StatsDTO>('/stats'),
    exportUrl: () => '/api/stats/export.csv',
  },

  settings: {
    get: () => request<SettingsDTO>('/settings'),
    save: (body: Partial<SettingsDTO> & { apiKey?: string }) => request<SettingsDTO>('/settings', { method: 'PUT', body: JSON.stringify(body) }),
    testAI: (body: { provider?: string; baseUrl?: string; apiKey?: string }) =>
      request<{ ok: boolean; message: string; models?: string[] }>('/settings/ai/test', { method: 'POST', body: JSON.stringify(body) }),
    detectModels: (body: { provider?: string; baseUrl?: string; apiKey?: string }) =>
      request<{ models: string[] }>('/settings/ai/detect-model', { method: 'POST', body: JSON.stringify(body) }),
  },
};
