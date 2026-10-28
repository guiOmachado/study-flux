import { Router } from 'express';
import type { AISettings, SettingsDTO } from '../../shared/types';
import { requireUser } from '../auth';
import { aiRuntimeConfig, publicSettings, readSettings, savePublicSettings } from '../settings';
import { AIError, testAIConnection } from '../generation/llm';

export const settingsRouter = Router();
settingsRouter.use(requireUser);

settingsRouter.get('/', (req, res) => {
  res.json(publicSettings(req.user!.id));
});

settingsRouter.put('/', (req, res) => {
  const body = req.body ?? {};
  const patch: Partial<SettingsDTO> & { apiKey?: string } = {
    ai: body.ai,
    srsAutoCreate: typeof body.srsAutoCreate === 'boolean' ? body.srsAutoCreate : undefined,
    dailyGoal: typeof body.dailyGoal === 'number' ? body.dailyGoal : undefined,
    examDate: typeof body.examDate === 'string' || body.examDate === null ? body.examDate : undefined,
    apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
  };
  if (patch.ai) {
    const allowed: AISettings['provider'][] = ['openai', 'anthropic', 'compatible'];
    patch.ai = {
      ...patch.ai,
      provider: allowed.includes(patch.ai.provider) ? patch.ai.provider : 'openai',
      enabled: Boolean(patch.ai.enabled),
      baseUrl: String(patch.ai.baseUrl ?? '').trim(),
      model: String(patch.ai.model ?? '').trim(),
    };
  }
  if (patch.dailyGoal !== undefined) patch.dailyGoal = Math.max(5, Math.min(200, Math.round(patch.dailyGoal)));
  res.json(savePublicSettings(req.user!.id, patch));
});

settingsRouter.post('/ai/test', async (req, res) => {
  const stored = aiRuntimeConfig(req.user!.id);
  const provider = (req.body?.provider ?? stored.provider) as AISettings['provider'];
  const apiKey = String(req.body?.apiKey ?? '').trim() || stored.apiKey;
  const baseUrl = String(req.body?.baseUrl ?? stored.baseUrl).trim();
  const result = await testAIConnection({ enabled: true, provider, baseUrl, model: stored.model, apiKey });
  return res.json(result);
});

settingsRouter.post('/ai/detect-model', async (req, res) => {
  const stored = aiRuntimeConfig(req.user!.id);
  const provider = (req.body?.provider ?? stored.provider) as AISettings['provider'];
  const apiKey = String(req.body?.apiKey ?? '').trim() || stored.apiKey;
  const baseUrl = String(req.body?.baseUrl ?? stored.baseUrl).trim();
  const result = await testAIConnection({ enabled: true, provider, baseUrl, model: stored.model, apiKey });
  if (!result.ok) return res.status(400).json({ error: result.message });
  return res.json({ models: result.models ?? [] });
});

settingsRouter.get('/usage', (req, res) => {
  const s = readSettings(req.user!.id);
  res.json({ aiEnabled: s.ai.enabled, provider: s.ai.provider, model: s.ai.model, hasKey: Boolean(s.ai.apiKey) });
});

export { AIError };
