import type { AISettings, SettingsDTO } from '../shared/types';
import { get, run } from './db';
import { decryptSecret, encryptSecret, safeJson } from './util';

interface StoredSettings {
  ai: {
    enabled: boolean;
    provider: AISettings['provider'];
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  srsAutoCreate: boolean;
  dailyGoal: number;
  examDate: string | null;
}

const DEFAULTS: StoredSettings = {
  ai: { enabled: false, provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' },
  srsAutoCreate: true,
  dailyGoal: 20,
  examDate: null,
};

export function readSettings(userId: number): StoredSettings {
  const row = get<{ data: string }>('SELECT data FROM settings WHERE user_id = ?', userId);
  const parsed = safeJson<Partial<StoredSettings>>(row?.data, {});
  return {
    ...DEFAULTS,
    ...parsed,
    ai: { ...DEFAULTS.ai, ...(parsed.ai ?? {}), apiKey: parsed.ai?.apiKey ?? '' },
  };
}

export function writeSettings(userId: number, next: StoredSettings): void {
  run(
    'INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data',
    userId,
    JSON.stringify(next),
  );
}

export function publicSettings(userId: number): SettingsDTO {
  const s = readSettings(userId);
  return {
    ai: {
      enabled: s.ai.enabled,
      provider: s.ai.provider,
      baseUrl: s.ai.baseUrl,
      model: s.ai.model,
      hasKey: Boolean(s.ai.apiKey),
    },
    srsAutoCreate: s.srsAutoCreate,
    dailyGoal: s.dailyGoal,
    examDate: s.examDate,
  };
}

export function savePublicSettings(userId: number, patch: Partial<SettingsDTO> & { apiKey?: string }): SettingsDTO {
  const current = readSettings(userId);
  const next: StoredSettings = {
    ...current,
    ai: {
      ...current.ai,
      enabled: patch.ai?.enabled ?? current.ai.enabled,
      provider: patch.ai?.provider ?? current.ai.provider,
      baseUrl: patch.ai?.baseUrl ?? current.ai.baseUrl,
      model: patch.ai?.model ?? current.ai.model,
    },
    srsAutoCreate: patch.srsAutoCreate ?? current.srsAutoCreate,
    dailyGoal: patch.dailyGoal ?? current.dailyGoal,
    examDate: patch.examDate === undefined ? current.examDate : patch.examDate,
  };
  if (patch.apiKey === '') next.ai.apiKey = '';
  else if (patch.apiKey) next.ai.apiKey = encryptSecret(patch.apiKey.trim());
  writeSettings(userId, next);
  return publicSettings(userId);
}

export function aiRuntimeConfig(userId: number) {
  const s = readSettings(userId);
  return {
    enabled: s.ai.enabled,
    provider: s.ai.provider,
    baseUrl: s.ai.baseUrl.trim().replace(/\/+$/, ''),
    model: s.ai.model.trim(),
    apiKey: decryptSecret(s.ai.apiKey),
  };
}
