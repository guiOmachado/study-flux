import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AISettings, SettingsDTO } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { LoadingBlock, PageHeader, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';

const PROVIDERS: { value: AISettings['provider']; label: string; defaultUrl: string; hint: string }[] = [
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', hint: 'Modelos como gpt-4o-mini e gpt-4.1-mini.' },
  { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com', hint: 'Modelos Claude, como claude-3-5-haiku.' },
  { value: 'compatible', label: 'API compatível com OpenAI', defaultUrl: '', hint: 'Groq, OpenRouter, Together, Ollama ou seu próprio servidor.' },
];

export function SettingsPage() {
  const settings = useFetch<SettingsDTO>(() => api.settings.get(), []);
  const { user, updateName } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AISettings['provider']>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [srsAutoCreate, setSrsAutoCreate] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [examDate, setExamDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (settings.data) {
      setEnabled(settings.data.ai.enabled);
      setProvider(settings.data.ai.provider);
      setBaseUrl(settings.data.ai.baseUrl);
      setModel(settings.data.ai.model);
      setHasKey(settings.data.ai.hasKey);
      setSrsAutoCreate(settings.data.srsAutoCreate);
      setDailyGoal(settings.data.dailyGoal);
      setExamDate(settings.data.examDate ?? '');
    }
  }, [settings.data]);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  if (settings.loading) return <LoadingBlock label="Carregando configurações…" />;

  const currentProvider = PROVIDERS.find((item) => item.value === provider);

  const save = async () => {
    setSaving(true);
    try {
      if (name.trim() && name.trim() !== user?.name) await updateName(name.trim());
      const payload: Partial<SettingsDTO> & { apiKey?: string } = {
        ai: { enabled, provider, baseUrl, model, hasKey },
        srsAutoCreate,
        dailyGoal,
        examDate: examDate || null,
      };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      const updated = await api.settings.save(payload);
      setHasKey(updated.ai.hasKey);
      setApiKey('');
      toast.success('Configurações salvas.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.settings.testAI({ provider, baseUrl, apiKey: apiKey.trim() || undefined });
      setTestResult(result);
      if (result.models && result.models.length > 0) setModels(result.models);
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof ApiError ? err.message : 'Falha ao testar.' });
    } finally {
      setTesting(false);
    }
  };

  const detect = async () => {
    setDetecting(true);
    try {
      const result = await api.settings.detectModels({ provider, baseUrl, apiKey: apiKey.trim() || undefined });
      setModels(result.models);
      toast.success(`${result.models.length} modelos encontrados.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível listar os modelos.');
    } finally {
      setDetecting(false);
    }
  };

  const removeKey = async () => {
    if (!window.confirm('Remover a chave de API salva? A geração por IA deixará de funcionar.')) return;
    try {
      const updated = await api.settings.save({ apiKey: '' });
      setHasKey(updated.ai.hasKey);
      setEnabled(false);
      toast.success('Chave removida.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível remover a chave.');
    }
  };

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Preferências de estudo, conta e integração com IA. Sem IA, a plataforma continua funcionando com o modo estruturado."
        actions={
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : <Icon name="check" size={15} />}
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        }
      />

      <div className="stack">
        <section className="card card-pad stack">
          <h2>Conta e rotina</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="settings-name">Nome</label>
              <input id="settings-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="settings-email">E-mail</label>
              <input id="settings-email" className="input" value={user?.email ?? ''} disabled />
            </div>
            <div className="field">
              <label htmlFor="settings-goal">Meta diária de questões</label>
              <input
                id="settings-goal"
                type="number"
                min={5}
                max={200}
                className="input"
                value={dailyGoal}
                onChange={(event) => setDailyGoal(Math.max(5, Math.min(200, Number(event.target.value) || 5)))}
              />
            </div>
            <div className="field">
              <label htmlFor="settings-exam">Data da prova</label>
              <input id="settings-exam" type="date" className="input" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
              <span className="hint">Usada para mostrar a contagem regressiva no início.</span>
            </div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={srsAutoCreate} onChange={(event) => setSrsAutoCreate(event.target.checked)} />
            Criar cards de revisão automaticamente quando eu errar
          </label>
        </section>

        <section className="card card-pad stack">
          <div className="row between row-wrap">
            <div>
              <h2>Geração por IA</h2>
              <p className="small muted" style={{ marginTop: 4, maxWidth: 620 }}>
                Opcional. Com uma chave de API, o Study Flux transforma capítulos e resumos em casos clínicos completos. Sem isso, o
                modo estruturado continua gerando perguntas a partir do próprio texto.
              </p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Usar IA
            </label>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="ai-provider">Provedor</label>
              <select
                id="ai-provider"
                className="select"
                value={provider}
                onChange={(event) => {
                  const next = event.target.value as AISettings['provider'];
                  const previous = PROVIDERS.find((item) => item.value === provider)?.defaultUrl ?? '';
                  setProvider(next);
                  if (!baseUrl || baseUrl === previous) {
                    setBaseUrl(PROVIDERS.find((item) => item.value === next)?.defaultUrl ?? '');
                  }
                }}
              >
                {PROVIDERS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <span className="hint">{currentProvider?.hint}</span>
            </div>
            <div className="field">
              <label htmlFor="ai-base">URL da API</label>
              <input id="ai-base" className="input" placeholder={currentProvider?.defaultUrl || 'https://seu-provedor/v1'} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
              <span className="hint">Para APIs compatíveis com OpenAI, informe a base terminando em /v1.</span>
            </div>
            <div className="field">
              <label htmlFor="ai-model">Modelo</label>
              {models.length > 0 ? (
                <select
                  id="ai-model"
                  className="select"
                  value={models.includes(model) ? model : ''}
                  onChange={(event) => setModel(event.target.value)}
                >
                  <option value="">Selecione um modelo</option>
                  {models.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              ) : (
                <input id="ai-model" className="input" placeholder="gpt-4o-mini" value={model} onChange={(event) => setModel(event.target.value)} />
              )}
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={detect} disabled={detecting || !hasKey && !apiKey.trim()} type="button">
                  {detecting ? <Spinner dark /> : <Icon name="refresh" size={13} />}
                  Listar modelos disponíveis
                </button>
                {models.length > 0 ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => setModels([])} type="button">Digitar manualmente</button>
                ) : null}
              </div>
            </div>
            <div className="field">
              <label htmlFor="ai-key">Chave de API</label>
              <input
                id="ai-key"
                type="password"
                className="input"
                placeholder={hasKey ? '•••••••••• (chave já salva)' : 'sk-…'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
              />
              <span className="hint">
                A chave é criptografada e fica apenas neste servidor. Ela nunca aparece de volta na interface.
              </span>
              {hasKey ? (
                <button className="btn btn-danger-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={removeKey} type="button">
                  <Icon name="trash" size={13} /> Remover chave salva
                </button>
              ) : null}
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={test} disabled={testing} type="button">
              {testing ? <Spinner dark /> : <Icon name="target" size={15} />}
              Testar conexão
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving} type="button">Salvar</button>
            {testResult ? (
              <span className={`badge ${testResult.ok ? 'badge-success' : 'badge-danger'}`} style={{ padding: '6px 10px' }}>
                {testResult.message}
              </span>
            ) : null}
          </div>

          <div className="divider" />
          <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <Icon name="info" size={16} style={{ color: 'var(--muted)', flex: 'none', marginTop: 2 }} />
            <p className="tiny muted">
              Ao gerar com IA, o texto do material é enviado ao provedor escolhido. O Study Flux não guarda a resposta do provedor
              além do caso criado. Use apenas materiais que você tem direito de compartilhar.
            </p>
          </div>
        </section>

        <section className="card card-pad stack">
          <h2>Seus dados</h2>
          <p className="small muted">
            Tudo fica no banco local do Study Flux (SQLite). Você pode exportar seu histórico de respostas a qualquer momento.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <a className="btn btn-secondary" href={api.stats.exportUrl()}>
              <Icon name="download" size={15} />
              Baixar desempenho (CSV)
            </a>
            <Link className="btn btn-secondary" to="/materiais">
              <Icon name="folder" size={15} />
              Meus materiais
            </Link>
            <Link className="btn btn-secondary" to="/casos">
              <Icon name="library" size={15} />
              Meus casos
            </Link>
          </div>
        </section>

        <section className="card card-pad stack">
          <h2>Sobre o Study Flux</h2>
          <p className="small muted">
            Plataforma de estudo por casos clínicos. O fluxo é sempre o mesmo: material → casos → treino → revisão. A mesma
            arquitetura serve para outras profissões no futuro, trocando o léxico e o formato de caso.
          </p>
          <div className="grid grid-3" style={{ gap: 10 }}>
            {[
              { title: 'Privado por padrão', text: 'Rascunhos e histórico só aparecem para você. Publicar é opcional.' },
              { title: 'Funciona offline', text: 'Sem IA, o modo estruturado cria perguntas fiéis ao texto.' },
              { title: 'Feito para provas', text: 'Simulados, revisão espaçada e desempenho por tema.' },
            ].map((item) => (
              <div key={item.title} className="vital">
                <div className="vital-label">{item.title}</div>
                <div className="small" style={{ color: 'var(--ink-2)', marginTop: 4 }}>{item.text}</div>
              </div>
            ))}
          </div>
          <span className="tiny muted">Versão 0.1 · banco local · API Express + React</span>
        </section>
      </div>
    </>
  );
}
