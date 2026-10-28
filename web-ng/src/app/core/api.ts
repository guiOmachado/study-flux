import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  AttemptDTO,
  CaseDetail,
  CaseSummary,
  GenerationResultDTO,
  SettingsDTO,
  SourceSummary,
  SrsCardDTO,
  SrsGrade,
  StatsDTO,
  UserDTO,
} from '@shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HealthDTO {
  ok: boolean;
  name: string;
  version: string;
  time: string;
  /** false quando o servidor roda com SEED_DEMO=0 (deploy público). */
  demo: boolean;
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

export interface DiscoveryProviderInfo {
  id: string;
  label: string;
  description: string;
  kinds: string[];
}

export interface DiscoveryProviderStatus {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  message?: string;
}

export interface DiscoveryResultDTO {
  provider: string;
  providerLabel: string;
  id: string;
  title: string;
  authors: string[];
  journal: string | null;
  year: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  openAccess: boolean;
  license: string | null;
  hasFullText: boolean;
  type: 'artigo' | 'capitulo' | 'preprint' | 'material';
  language: string | null;
  extra?: Record<string, string | number | null>;
}

export interface DiscoverySearchDTO {
  results: DiscoveryResultDTO[];
  statuses: DiscoveryProviderStatus[];
  cached: boolean;
  query: string;
}

export interface DiscoveryImportOutcome {
  source: SourceSummary;
  generation: { created: number; updated: number; mode: string; warnings: string[]; caseIds: number[] } | null;
  generationError: string | null;
  importedAt: string;
  reused?: boolean;
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

export interface DiscoveryProvidersDTO {
  providers: DiscoveryProviderInfo[];
  aiReady: boolean;
  guest: boolean;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private async request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, `/api${path}`, { body, withCredentials: true }));
    } catch (error) {
      throw toApiError(error);
    }
  }

  health = () => this.request<HealthDTO>('GET', '/health');

  me = () => this.request<{ user: UserDTO }>('GET', '/auth/me');
  login = (email: string, password: string) => this.request<{ user: UserDTO }>('POST', '/auth/login', { email, password });
  register = (name: string, email: string, password: string) =>
    this.request<{ user: UserDTO }>('POST', '/auth/register', { name, email, password });
  demo = () => this.request<{ user: UserDTO }>('POST', '/auth/demo');
  logout = () => this.request<{ ok: true }>('POST', '/auth/logout');
  updateProfile = (name: string) => this.request<{ user: UserDTO }>('PATCH', '/auth/me', { name });

  readonly sources = {
    list: () => this.request<{ sources: SourceSummary[] }>('GET', '/sources'),
    get: (id: number) => this.request<{ source: SourceSummary; excerpt: string; textPreview: string }>('GET', `/sources/${id}`),
    create: (form: FormData) => this.request<{ source: SourceSummary; warnings: string[] }>('POST', '/sources', form),
    remove: (id: number) => this.request<{ ok: true }>('DELETE', `/sources/${id}`),
    reanalyze: (id: number) => this.request<{ source: SourceSummary }>('POST', `/sources/${id}/reanalyze`),
    rename: (id: number, body: { title?: string; discipline?: string }) =>
      this.request<{ source: SourceSummary }>('PATCH', `/sources/${id}`, body),
  };

  readonly cases = {
    list: (filters: CaseListFilters = {}) => {
      let params = new HttpParams();
      if (filters.area) params = params.set('area', filters.area);
      if (filters.difficulty) params = params.set('difficulty', filters.difficulty);
      if (filters.q) params = params.set('q', filters.q);
      if (filters.mine) params = params.set('mine', '1');
      if (filters.status) params = params.set('status', filters.status);
      if (filters.sourceId) params = params.set('sourceId', String(filters.sourceId));
      if (filters.limit) params = params.set('limit', String(filters.limit));
      return this.request<{ cases: CaseSummary[]; total: number }>('GET', `/cases?${params.toString()}`);
    },
    get: (id: number) => this.request<{ case: CaseDetail }>('GET', `/cases/${id}`),
    play: (id: number) => this.request<{ case: PlayableCase }>('GET', `/cases/${id}/play`),
    create: (body: unknown) => this.request<{ case: CaseDetail }>('POST', '/cases', body),
    update: (id: number, body: unknown) => this.request<{ case: CaseDetail }>('PUT', `/cases/${id}`, body),
    publish: (id: number, publish: boolean) => this.request<{ case: CaseDetail }>('POST', `/cases/${id}/publish`, { publish }),
    duplicate: (id: number) => this.request<{ case: CaseDetail }>('POST', `/cases/${id}/duplicate`),
    remove: (id: number) => this.request<{ ok: true }>('DELETE', `/cases/${id}`),
    importCase: (payload: unknown) => this.request<{ case: CaseDetail }>('POST', '/cases/import', payload),
    exportUrl: (id: number) => `/api/cases/${id}/export`,
  };

  readonly generate = {
    preview: (sourceId: number) =>
      this.request<{
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
      }>('POST', `/generate/preview/${sourceId}`),
    source: (sourceId: number, body: { mode: 'auto' | 'estruturado' | 'ia'; maxCases?: number; publish?: boolean }) =>
      this.request<GenerationResultDTO & { cases: CaseDetail[] }>('POST', `/generate/source/${sourceId}`, body),
    topic: (body: { topic: string; area?: string; difficulty?: string; count?: number; publish?: boolean }) =>
      this.request<Omit<GenerationResultDTO, 'sourceId'> & { cases: CaseDetail[] }>('POST', '/generate/topic', body),
  };

  readonly attempts = {
    start: (caseId: number, mode: 'treino' | 'simulado' | 'revisao' = 'treino') =>
      this.request<{ attempt: AttemptDTO; case: PlayableCase }>('POST', '/attempts', { caseId, mode }),
    startBatch: (body: { mode?: 'simulado' | 'treino'; caseIds?: number[]; area?: string; limit?: number }) =>
      this.request<{ batchId: string; items: { attemptId: number; attempt: AttemptDTO; case: PlayableCase }[] }>(
        'POST',
        '/attempts/start-batch',
        body,
      ),
    get: (id: number) => this.request<{ attempt: AttemptDTO; case: PlayableCase | null }>('GET', `/attempts/${id}`),
    answer: (id: number, body: { questionId: string; optionId: string; timeMs: number }) =>
      this.request<AnswerFeedback>('POST', `/attempts/${id}/answer`, body),
    finish: (id: number, durationMs?: number) => this.request<{ attempt: AttemptDTO }>('POST', `/attempts/${id}/finish`, { durationMs }),
    list: (limit = 20) => this.request<{ attempts: AttemptDTO[] }>('GET', `/attempts?limit=${limit}`),
  };

  readonly srs = {
    list: () => this.request<{ cards: SrsCardDTO[]; due: number }>('GET', '/srs'),
    due: (limit = 30) => this.request<{ cards: SrsCardDTO[] }>('GET', `/srs/due?limit=${limit}`),
    review: (id: number, grade: SrsGrade) => this.request<{ card: SrsCardDTO }>('POST', `/srs/${id}/review`, { grade }),
    fromCase: (caseId: number) => this.request<{ created: number }>('POST', `/srs/from-case/${caseId}`),
    remove: (id: number) => this.request<{ ok: true }>('DELETE', `/srs/${id}`),
  };

  readonly stats = {
    get: () => this.request<StatsDTO>('GET', '/stats'),
    exportUrl: () => '/api/stats/export.csv',
  };

  readonly discovery = {
    providers: () => this.request<DiscoveryProvidersDTO>('GET', '/discovery/providers'),
    search: (params: { q: string; providers?: string[]; limit?: number; oa?: boolean }) => {
      let query = new HttpParams().set('q', params.q);
      if (params.providers?.length) query = query.set('providers', params.providers.join(','));
      if (params.limit) query = query.set('limit', String(params.limit));
      if (params.oa) query = query.set('oa', '1');
      return this.request<DiscoverySearchDTO>('GET', `/discovery/search?${query.toString()}`);
    },
    importResult: (body: {
      provider: string;
      id: string;
      mode: 'abstract' | 'fulltext';
      result?: DiscoveryResultDTO;
      generate?: boolean;
      aiMode?: 'auto' | 'estruturado' | 'ia';
      publish?: boolean;
      maxCases?: number;
    }) => this.request<DiscoveryImportOutcome>('POST', '/discovery/import', body),
    url: (body: { url: string; title?: string; generate?: boolean; aiMode?: 'auto' | 'estruturado' | 'ia'; publish?: boolean; maxCases?: number }) =>
      this.request<DiscoveryImportOutcome>('POST', '/discovery/url', body),
  };

  readonly settings = {
    get: () => this.request<SettingsDTO>('GET', '/settings'),
    save: (body: Partial<SettingsDTO> & { apiKey?: string }) => this.request<SettingsDTO>('PUT', '/settings', body),
    testAI: (body: { provider?: string; baseUrl?: string; apiKey?: string }) =>
      this.request<{ ok: boolean; message: string; models?: string[] }>('POST', '/settings/ai/test', body),
    detectModels: (body: { provider?: string; baseUrl?: string; apiKey?: string }) =>
      this.request<{ models: string[] }>('POST', '/settings/ai/detect-model', body),
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { error?: unknown } | string | null;
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : error.status === 0
          ? 'Sem conexão com o servidor. Verifique sua internet.'
          : `Erro ${error.status}. Tente novamente.`;
    return new ApiError(message, error.status);
  }
  return new ApiError('Erro inesperado. Tente novamente.', 0);
}

export function errorMessage(error: unknown, fallback = 'Não foi possível concluir. Tente novamente.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
