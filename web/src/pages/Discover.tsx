import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SettingsDTO } from '@shared/types';
import { AREAS } from '@shared/types';
import {
  api,
  ApiError,
  type DiscoveryImportOutcome,
  type DiscoveryProviderInfo,
  type DiscoveryProviderStatus,
  type DiscoveryResultDTO,
  type DiscoverySearchDTO,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { useFetch } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { PageHeader, SectionCard, Spinner, LoadingBlock } from '../components/ui';
import { Icon } from '../components/Icon';

type Tab = 'acervos' | 'tema' | 'link';

const DEFAULT_PROVIDERS = ['local', 'europepmc', 'bookshelf'];

const TYPE_LABEL: Record<string, string> = {
  artigo: 'Artigo',
  capitulo: 'Capítulo',
  preprint: 'Preprint',
  material: 'Meu material',
};

function providerIcon(id: string): string {
  if (id === 'local') return 'folder';
  if (id === 'bookshelf') return 'bookOpen';
  if (id === 'openalex') return 'globe';
  return 'file';
}

function authorsLine(result: DiscoveryResultDTO): string {
  if (result.authors.length === 0) return 'Autoria não informada';
  const shown = result.authors.slice(0, 3).join(', ');
  return result.authors.length > 3 ? `${shown} e outros` : shown;
}

export function DiscoverPage() {
  const [tab, setTab] = useState<Tab>('acervos');
  const [notice, setNotice] = useState<string | null>(null);
  const toast = useToast();
  const { user } = useAuth();
  const isGuest = !user;

  const providers = useFetch(() => api.discovery.providers(), [user?.id]);
  // Preferências exigem sessão; visitante não precisa delas (IA fica desligada).
  const settings = useFetch<SettingsDTO | null>(() => (user ? api.settings.get() : Promise.resolve(null)), [user?.id]);
  const aiReady = Boolean(settings.data?.ai.enabled && settings.data?.ai.hasKey);
  const loginHref = '/login?next=%2Fdescobrir';
  const registerHref = '/login?mode=register&next=%2Fdescobrir';

  const handleImported = (outcome: DiscoveryImportOutcome, openMaterial: boolean, navigate: (path: string) => void) => {
    if (outcome.generation && outcome.generation.created + outcome.generation.updated > 0) {
      toast.success(`${outcome.generation.created} caso(s) criado(s) a partir da fonte.`);
      if (!openMaterial) navigate(`/casos?fonte=${outcome.source.id}`);
      return;
    }
    if (outcome.generationError) {
      toast.error(outcome.generationError);
    } else {
      setNotice(
        'Material importado, mas nenhum caso foi gerado automaticamente. Abra o material para revisar a leitura e gerar manualmente — ou ative a IA em Configurações.',
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Descobrir conteúdo"
        subtitle={
          isGuest
            ? 'Busque artigos e capítulos em acervos científicos abertos, sem precisar de conta. Para importar e transformar em casos, é só entrar.'
            : 'Busque em acervos científicos abertos, importe por link ou peça casos a partir de um tema. Tudo entra na sua biblioteca como material, com fonte e licença registradas.'
        }
        actions={
          isGuest ? (
            <Link className="btn btn-primary" to={loginHref}>
              <Icon name="user" size={15} />
              Entrar para importar
            </Link>
          ) : (
            <Link className="btn btn-secondary" to="/configuracoes">
              <Icon name="settings" size={15} />
              {aiReady ? 'IA ativa' : 'Configurar IA'}
            </Link>
          )
        }
      />

      {isGuest ? (
        <div className="guest-banner">
          <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <Icon name="globe" size={17} style={{ color: 'var(--brand-700)', flex: 'none', marginTop: 2 }} />
            <div>
              <strong className="small">Você está no modo visitante.</strong>
              <div className="tiny muted">
                A busca nos acervos é livre — dá para ler resumos e conferir a fonte. Importar para a sua biblioteca, gerar casos,
                treinar e revisar pedem uma conta (leva menos de um minuto e é grátis).
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary btn-sm" to={loginHref}>
              Entrar
            </Link>
            <Link className="btn btn-secondary btn-sm" to={registerHref}>
              Criar conta
            </Link>
          </div>
        </div>
      ) : null}

      <div className="tabs" role="tablist">
        {[
          { id: 'acervos' as Tab, label: 'Acervos científicos', icon: 'globe' },
          { id: 'tema' as Tab, label: 'Gerar por tema', icon: 'sparkles' },
          { id: 'link' as Tab, label: 'Importar por link', icon: 'link' },
        ].map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`tab${tab === item.id ? ' active' : ''}`}
            onClick={() => {
              setTab(item.id);
              setNotice(null);
            }}
          >
            <Icon name={item.icon} size={15} />
            {item.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="feedback" style={{ background: 'var(--warn-50)', borderColor: '#f4e2b7', marginBottom: 16 }}>
          <div className="feedback-title" style={{ color: 'var(--warn)' }}>
            <Icon name="alert" size={16} />
            Quase lá
          </div>
          <span className="small">{notice}</span>
        </div>
      ) : null}

      {tab === 'acervos' ? (
        <RepositoriesTab
          providers={providers.data?.providers ?? []}
          aiReady={aiReady}
          isGuest={isGuest}
          loginHref={loginHref}
          onImported={handleImported}
        />
      ) : null}
      {tab === 'tema' ? (
        isGuest ? (
          <GuestGate
            title="Gerar casos por tema precisa de conta"
            description="Este modo cria casos direto na sua biblioteca — não tem material de origem. Entre para usar (precisa de IA configurada)."
            loginHref={loginHref}
            registerHref={registerHref}
          />
        ) : (
          <TopicTab aiReady={aiReady} />
        )
      ) : null}
      {tab === 'link' ? (
        isGuest ? (
          <GuestGate
            title="Importar por link precisa de conta"
            description="O link vira um material na sua biblioteca, com referência e licença. Entre para importar e gerar casos a partir dele."
            loginHref={loginHref}
            registerHref={registerHref}
          />
        ) : (
          <LinkTab aiReady={aiReady} onImported={handleImported} />
        )
      ) : null}

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
          <Icon name="info" size={16} style={{ color: 'var(--muted)', flex: 'none', marginTop: 2 }} />
          <div className="tiny muted">
            <strong style={{ color: 'var(--ink-2)' }}>Sobre uso e direitos autorais.</strong> Os acervos são consultados por APIs
            públicas. Guardamos metadados e o resumo; o texto completo só é importado quando a fonte é de acesso aberto (Europe PMC,
            NCBI Bookshelf, PDFs abertos). O material fica no seu banco local e é marcado como rascunho/pessoal — use conforme as
            regras da sua instituição e a licença de cada obra. Prefira fontes abertas e sempre cite a origem.
          </div>
        </div>
      </div>
    </>
  );
}

function RepositoriesTab({
  providers,
  aiReady,
  isGuest,
  loginHref,
  onImported,
}: {
  providers: DiscoveryProviderInfo[];
  aiReady: boolean;
  isGuest: boolean;
  loginHref: string;
  onImported: (outcome: DiscoveryImportOutcome, openMaterial: boolean, navigate: (path: string) => void) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(DEFAULT_PROVIDERS);
  const [onlyOA, setOnlyOA] = useState(false);
  const [limit, setLimit] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DiscoverySearchDTO | null>(null);
  const [importTarget, setImportTarget] = useState<DiscoveryResultDTO | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  // A lista de acervos muda com a sessão (visitante não tem "Minha biblioteca").
  useEffect(() => {
    if (providers.length === 0) return;
    setSelected((prev) => {
      const valid = prev.filter((id) => providers.some((provider) => provider.id === id));
      if (valid.length > 0) return valid;
      return providers.filter((provider) => provider.id !== 'local').slice(0, 3).map((provider) => provider.id);
    });
  }, [providers]);

  const toggleProvider = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (query.trim().length < 2) {
      setError('Digite pelo menos 2 caracteres.');
      return;
    }
    if (selected.length === 0) {
      setError('Selecione pelo menos um acervo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.discovery.search({ q: query.trim(), providers: selected, limit, oa: onlyOA });
      setData(response);
      if (response.results.length === 0) {
        const failed = response.statuses.filter((status) => !status.ok);
        if (failed.length > 0) {
          setError('Nenhum resultado: os acervos externos não responderam. Veja os detalhes por acervo abaixo.');
        } else {
          setError('Nenhum resultado encontrado. Tente termos mais amplos (ex.: “sepse”, “heart failure”) ou em inglês.');
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível consultar os acervos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card card-pad stack" style={{ marginBottom: 16 }}>
        <form onSubmit={runSearch} className="stack-sm">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
              <Icon name="search" size={16} />
              <input
                className="input"
                placeholder="Ex.: sepse, insuficiência cardíaca, bronchiolitis, diabetes gestacional…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? <Spinner /> : <Icon name="search" size={15} />}
              Buscar
            </button>
          </div>

          <div className="row row-wrap" style={{ gap: 8 }}>
            <span className="tiny muted" style={{ fontWeight: 600 }}>Acervos:</span>
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={`chip${selected.includes(provider.id) ? ' active' : ''}`}
                onClick={() => toggleProvider(provider.id)}
                title={provider.description}
              >
                <Icon name={providerIcon(provider.id)} size={13} />
                {provider.label}
              </button>
            ))}
          </div>

          <div className="row row-wrap" style={{ gap: 14 }}>
            <label className="checkbox">
              <input type="checkbox" checked={onlyOA} onChange={(event) => setOnlyOA(event.target.checked)} />
              Somente acesso aberto
            </label>
            <label className="row" style={{ gap: 6 }}>
              <span className="tiny muted">Resultados por acervo</span>
              <select className="select" style={{ width: 90, padding: '6px 10px' }} value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                {[5, 8, 12, 20].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <span className="tiny muted">
              Dica: artigos em inglês funcionam bem — o modo estruturado mantém o texto original e a IA responde em português.
            </span>
          </div>
        </form>

        {error ? (
          <div className="feedback bad" style={{ padding: '10px 12px' }}>
            <span className="small">{error}</span>
          </div>
        ) : null}

        {data ? (
          <div className="row row-wrap" style={{ gap: 6 }}>
            {data.statuses.map((status) => (
              <StatusChip key={status.id} status={status} />
            ))}
            {data.cached ? <span className="badge badge-neutral">cache de 10 min</span> : null}
          </div>
        ) : null}
      </div>

      {busy && !data ? <LoadingBlock label="Consultando acervos…" /> : null}

      {data && data.results.length > 0 ? (
        <div className="stack-sm">
          {data.results.map((result) => (
            <ResultCard
              key={`${result.provider}:${result.id}`}
              result={result}
              isGuest={isGuest}
              onImport={() => (isGuest ? navigate(loginHref) : setImportTarget(result))}
            />
          ))}
        </div>
      ) : null}

      {!data && !busy ? (
        <SectionCard title="Como funciona a descoberta">
          <div className="stack-sm">
            {[
              {
                icon: 'globe',
                title: '1. Busque por tema, condição ou autor',
                text: isGuest
                  ? 'Consultamos Europe PMC, NCBI Bookshelf, OpenAlex e PubMed. A busca é aberta — não precisa de conta.'
                  : 'Consultamos Europe PMC, NCBI Bookshelf, OpenAlex, PubMed e a sua própria biblioteca.',
              },
              { icon: 'bookOpen', title: '2. Escolha a fonte', text: 'Texto completo aberto gera casos melhores; resumos geram blocos de fixação curtos.' },
              {
                icon: isGuest ? 'lock' : 'sparkles',
                title: '3. Importe e gere',
                text: isGuest
                  ? 'Para importar, é preciso entrar: a fonte vira material com referência e licença, e os casos ficam na sua biblioteca.'
                  : 'A fonte vira material com referência e licença; depois os casos são gerados (IA ou modo estruturado).',
              },
            ].map((step) => (
              <div key={step.title} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
                <div className="file-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
                  <Icon name={step.icon} size={15} />
                </div>
                <div>
                  <strong className="small">{step.title}</strong>
                  <div className="tiny muted">{step.text}</div>
                </div>
              </div>
            ))}
            <div className="divider" />
            <p className="tiny muted">
              {isGuest
                ? 'Visitante pode buscar e ler os resultados à vontade. Importar e gerar casos faz parte da conta — a demo já vem com exemplos prontos.'
                : aiReady
                  ? 'IA ativa: os casos gerados a partir de artigos serão casos clínicos completos, com perguntas em progressão.'
                  : 'IA desativada: o modo estruturado monta perguntas de completar a partir dos trechos. Para artigos, a IA costuma render casos bem melhores.'}
            </p>
          </div>
        </SectionCard>
      ) : null}

      {importTarget ? (
        <ImportModal
          result={importTarget}
          aiReady={aiReady}
          onClose={() => setImportTarget(null)}
          onDone={(outcome, openMaterial, navigate) => {
            setImportTarget(null);
            onImported(outcome, openMaterial, navigate);
          }}
        />
      ) : null}
    </>
  );
}

function StatusChip({ status }: { status: DiscoveryProviderStatus }) {
  return (
    <span
      className={`badge ${status.ok ? 'badge-success' : 'badge-danger'}`}
      title={status.message ?? `${status.count} resultado(s)`}
      style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
    >
      {status.label}: {status.ok ? `${status.count} resultado${status.count === 1 ? '' : 's'}` : 'indisponível'}
    </span>
  );
}

function ResultCard({ result, isGuest, onImport }: { result: DiscoveryResultDTO; isGuest: boolean; onImport: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="result-card">
      <div className="row row-wrap" style={{ gap: 6 }}>
        <span className="badge badge-brand">
          <Icon name={providerIcon(result.provider)} size={12} />
          {result.providerLabel}
        </span>
        <span className="badge badge-neutral">{TYPE_LABEL[result.type] ?? result.type}</span>
        {result.openAccess ? <span className="badge badge-success">Acesso aberto</span> : <span className="badge badge-warn">Acesso restrito</span>}
        {result.hasFullText ? <span className="badge badge-info">Texto completo</span> : null}
        {result.year ? <span className="badge badge-neutral">{result.year}</span> : null}
        {result.language ? <span className="badge badge-neutral">{result.language.toUpperCase()}</span> : null}
      </div>
      <h3 style={{ fontSize: 15, lineHeight: 1.35 }}>{result.title}</h3>
      <div className="tiny muted">
        {authorsLine(result)}
        {result.journal ? ` · ${result.journal}` : ''}
        {result.doi ? ` · DOI ${result.doi}` : ''}
      </div>
      {result.abstract ? (
        <p className="small" style={{ color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>
          {expanded || result.abstract.length <= 320 ? result.abstract : `${result.abstract.slice(0, 320).trim()}…`}
          {result.abstract.length > 320 ? (
            <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px' }} onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'menos' : 'ler tudo'}
            </button>
          ) : null}
        </p>
      ) : (
        <p className="tiny muted">Sem resumo neste registro — o texto completo pode estar disponível.</p>
      )}
      <div className="row row-wrap" style={{ gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={onImport}>
          <Icon name={isGuest ? 'lock' : result.provider === 'local' ? 'folder' : 'sparkles'} size={13} />
          {isGuest ? 'Entrar para importar' : result.provider === 'local' ? 'Reaproveitar material' : 'Importar e gerar casos'}
        </button>
        {result.url ? (
          <a className="btn btn-secondary btn-sm" href={result.url} target="_blank" rel="noreferrer noopener">
            <Icon name="link" size={13} />
            Abrir na fonte
          </a>
        ) : null}
        {result.provider === 'local' && result.extra?.sourceId ? (
          <Link className="btn btn-ghost btn-sm" to={`/materiais/${result.extra.sourceId}`}>
            Ver material
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ImportModal({
  result,
  aiReady,
  onClose,
  onDone,
}: {
  result: DiscoveryResultDTO;
  aiReady: boolean;
  onClose: () => void;
  onDone: (outcome: DiscoveryImportOutcome, openMaterial: boolean, navigate: (path: string) => void) => void;
}) {
  const [mode, setMode] = useState<'fulltext' | 'abstract'>(result.hasFullText ? 'fulltext' : 'abstract');
  const [generate, setGenerate] = useState(true);
  const [aiMode, setAiMode] = useState<'auto' | 'estruturado' | 'ia'>(aiReady ? 'auto' : 'estruturado');
  const [publish, setPublish] = useState(true);
  const [maxCases, setMaxCases] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DiscoveryImportOutcome | null>(null);
  const navigate = useNavigate();

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.discovery.importResult({
        provider: result.provider,
        id: result.id,
        result,
        mode,
        generate,
        aiMode,
        publish,
        maxCases,
      });
      setOutcome(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível importar esta fonte.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="modal modal-lg" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>{outcome ? 'Fonte importada' : 'Importar fonte'}</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              {result.providerLabel}
              {result.year ? ` · ${result.year}` : ''}
              {result.license ? ` · ${result.license}` : ''}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar" disabled={busy}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="modal-body stack">
          <div>
            <h3 style={{ fontSize: 15 }}>{result.title}</h3>
            <div className="tiny muted" style={{ marginTop: 2 }}>{authorsLine(result)}{result.journal ? ` · ${result.journal}` : ''}</div>
          </div>

          {outcome ? (
            <div className="stack">
              <div className={`feedback ${outcome.generation ? 'ok' : ''}`} style={outcome.generation ? undefined : { background: 'var(--warn-50)', borderColor: '#f4e2b7' }}>
                <div className="feedback-title">
                  <Icon name={outcome.generation ? 'check' : 'alert'} size={16} />
                  {outcome.generation
                    ? `${outcome.generation.created} caso(s) criado(s) · modo ${outcome.generation.mode === 'ia' ? 'IA' : 'estruturado'}`
                    : 'Material importado sem casos'}
                </div>
                <span className="small">
                  {outcome.generation
                    ? 'Os casos já estão na sua biblioteca. Revise antes de compartilhar — a IA pode errar detalhes.'
                    : outcome.generationError ?? 'Abra o material para revisar a leitura e gerar casos manualmente.'}
                </span>
                {outcome.generation?.warnings?.length ? (
                  <div className="tiny muted">{outcome.generation.warnings.slice(0, 3).join(' ')}</div>
                ) : null}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-secondary btn-sm" to={`/materiais/${outcome.source.id}`}>
                  <Icon name="eye" size={14} />
                  Ver material e análise
                </Link>
                {outcome.generation && outcome.generation.caseIds.length > 0 ? (
                  <Link className="btn btn-primary btn-sm" to={`/casos?fonte=${outcome.source.id}`}>
                    <Icon name="library" size={14} />
                    Ver casos gerados
                  </Link>
                ) : null}
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <span className="label">O que importar</span>
                <div className="stack-sm">
                  <label className={`option${mode === 'fulltext' ? ' selected' : ''}`} style={{ cursor: result.hasFullText ? 'pointer' : 'not-allowed', opacity: result.hasFullText ? 1 : 0.55 }}>
                    <input type="radio" checked={mode === 'fulltext'} disabled={!result.hasFullText} onChange={() => setMode('fulltext')} style={{ marginTop: 6 }} />
                    <span>
                      <strong>Texto completo</strong>
                      <span className="tiny muted" style={{ display: 'block' }}>
                        {result.hasFullText
                          ? 'Conteúdo integral em acesso aberto. Gera casos clínicos mais completos.'
                          : 'Não disponível para esta fonte (acesso restrito).'}
                      </span>
                    </span>
                  </label>
                  <label className={`option${mode === 'abstract' ? ' selected' : ''}`} style={{ cursor: 'pointer' }}>
                    <input type="radio" checked={mode === 'abstract'} onChange={() => setMode('abstract')} style={{ marginTop: 6 }} />
                    <span>
                      <strong>Somente o resumo</strong>
                      <span className="tiny muted" style={{ display: 'block' }}>
                        Mais seguro em relação a direitos autorais; rende blocos de fixação curtos e depende mais da IA.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <label className="switch">
                <input type="checkbox" checked={generate} onChange={(event) => setGenerate(event.target.checked)} />
                Gerar casos automaticamente após importar
              </label>

              {generate ? (
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="import-mode">Como gerar</label>
                    <select id="import-mode" className="select" value={aiMode} onChange={(event) => setAiMode(event.target.value as typeof aiMode)}>
                      <option value="auto">Automático (IA se disponível)</option>
                      <option value="estruturado">Estruturado (sem IA)</option>
                      <option value="ia" disabled={!aiReady}>Somente IA {aiReady ? '' : '(não configurada)'}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="import-max">Quantidade de casos</label>
                    <input
                      id="import-max"
                      type="number"
                      min={1}
                      max={8}
                      className="input"
                      value={maxCases}
                      onChange={(event) => setMaxCases(Math.max(1, Math.min(8, Number(event.target.value) || 1)))}
                    />
                  </div>
                  <div className="field span-2">
                    <label className="switch">
                      <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
                      Publicar os casos gerados
                    </label>
                    <span className="hint">Desmarcado, eles ficam como rascunho para você revisar antes.</span>
                  </div>
                </div>
              ) : null}

              {!aiReady ? (
                <div className="tiny muted">
                  Dica: com IA configurada, artigos e capítulos viram casos clínicos completos. <Link to="/configuracoes">Configurar agora</Link>.
                </div>
              ) : null}

              {error ? (
                <div className="feedback bad" style={{ padding: '10px 12px' }}>
                  <span className="small">{error}</span>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!outcome ? (
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="btn btn-primary" onClick={run} disabled={busy}>
              {busy ? <Spinner /> : <Icon name="download" size={15} />}
              {busy ? 'Importando e gerando…' : 'Importar'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TopicTab({ aiReady }: { aiReady: boolean }) {
  const [topic, setTopic] = useState('');
  const [area, setArea] = useState('');
  const [difficulty, setDifficulty] = useState<'facil' | 'media' | 'dificil'>('media');
  const [count, setCount] = useState(2);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ created: number; updated: number; cases: { id: number; title: string }[] } | null>(null);
  const toast = useToast();

  const run = async () => {
    if (topic.trim().length < 3) {
      setError('Informe um tema com pelo menos 3 caracteres.');
      return;
    }
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const response = await api.generate.topic({ topic: topic.trim(), area: area || undefined, difficulty, count, publish });
      setCreated(response);
      toast.success(`${response.created} caso(s) criado(s) sobre “${topic.trim()}”.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar os casos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid dash-split">
      <div className="card card-pad stack">
        <h2>Gerar casos a partir de um tema</h2>
        <p className="small muted">
          Sem material nenhum: informe o tema e a IA cria casos clínicos do zero, dentro do currículo de medicina. Útil para
          cobrir lacunas que não estão nos seus materiais.
        </p>

        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="topic-input">Tema</label>
            <input
              id="topic-input"
              className="input"
              placeholder="Ex.: cetoacidose diabética, pré-eclâmpsia, sepse neonatal"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="topic-area">Área</label>
            <select id="topic-area" className="select" value={area} onChange={(event) => setArea(event.target.value)}>
              <option value="">Detectar pelo tema</option>
              {AREAS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="topic-difficulty">Dificuldade</label>
            <select id="topic-difficulty" className="select" value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
              <option value="facil">Fácil</option>
              <option value="media">Média</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="topic-count">Quantidade</label>
            <select id="topic-count" className="select" value={count} onChange={(event) => setCount(Number(event.target.value))}>
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>{value} caso{value === 1 ? '' : 's'}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="switch">
              <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
              Publicar
            </label>
          </div>
        </div>

        {!aiReady ? (
          <div className="feedback" style={{ background: 'var(--warn-50)', borderColor: '#f4e2b7' }}>
            <div className="feedback-title" style={{ color: 'var(--warn)' }}>
              <Icon name="alert" size={16} />
              A geração por tema depende de IA
            </div>
            <span className="small">
              Este modo não tem material de origem, então precisa de um provedor configurado. <Link to="/configuracoes">Configurar IA</Link>{' '}
              ou use a aba “Acervos científicos” (funciona sem IA).
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="feedback bad" style={{ padding: '10px 12px' }}>
            <span className="small">{error}</span>
          </div>
        ) : null}

        <div>
          <button className="btn btn-primary btn-lg" onClick={run} disabled={busy || !aiReady}>
            {busy ? <Spinner /> : <Icon name="sparkles" size={16} />}
            {busy ? 'Gerando casos…' : 'Gerar casos do tema'}
          </button>
        </div>

        {created ? (
          <div className="stack-sm">
            <div className="feedback ok">
              <div className="feedback-title"><Icon name="check" size={16} />{created.created} criado(s) · {created.updated} atualizado(s)</div>
            </div>
            {created.cases.map((item) => (
              <Link key={item.id} to={`/casos/${item.id}`} className="draft-head" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, border: '1px solid var(--line)' }}>
                <span>{item.title}</span>
                <Icon name="chevronRight" size={15} />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <SectionCard title="Quando usar cada caminho">
        <div className="stack-sm">
          {[
            { icon: 'folder', title: 'Material próprio', text: 'Já tem o PDF? Envie em Materiais. É a fonte mais fiel ao que a sua prova cobra.' },
            { icon: 'globe', title: 'Acervos científicos', text: 'Quer amplitude e atualidade? Busque artigos e capítulos abertos e importe com fonte.' },
            { icon: 'sparkles', title: 'Por tema (IA)', text: 'Precisa treinar um assunto que não está no seu material? Gere do zero e revise.' },
            { icon: 'link', title: 'Link direto', text: 'Achou uma diretriz ou PDF aberto? Cole o link e a plataforma extrai o texto.' },
          ].map((item) => (
            <div key={item.title} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
              <div className="file-icon" style={{ width: 30, height: 30, borderRadius: 9 }}>
                <Icon name={item.icon} size={14} />
              </div>
              <div>
                <strong className="small">{item.title}</strong>
                <div className="tiny muted">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function LinkTab({
  aiReady,
  onImported,
}: {
  aiReady: boolean;
  onImported: (outcome: DiscoveryImportOutcome, openMaterial: boolean, navigate: (path: string) => void) => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [generate, setGenerate] = useState(true);
  const [aiMode, setAiMode] = useState<'auto' | 'estruturado' | 'ia'>(aiReady ? 'auto' : 'estruturado');
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DiscoveryImportOutcome | null>(null);
  const navigate = useNavigate();

  const run = async () => {
    if (!/^https?:\/\//i.test(url.trim())) {
      setError('Informe uma URL completa, começando por https://');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.discovery.url({ url: url.trim(), title: title.trim() || undefined, generate, aiMode, publish, maxCases: 3 });
      setOutcome(response);
      onImported(response, true, navigate);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível importar este link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad stack">
      <h2>Importar por link</h2>
      <p className="small muted">
        Cole o endereço de uma diretriz, artigo aberto, capítulo público ou PDF. A plataforma baixa, limpa o conteúdo e transforma em
        material — com a referência guardada.
      </p>
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="link-url">Link</label>
          <input id="link-url" className="input" placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} />
          <span className="hint">Somente endereços públicos (http/https). Páginas com login ou carregadas por JavaScript podem não funcionar.</span>
        </div>
        <div className="field">
          <label htmlFor="link-title">Título (opcional)</label>
          <input id="link-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Detectado automaticamente" />
        </div>
        <div className="field">
          <label htmlFor="link-mode">Depois de importar</label>
          <select id="link-mode" className="select" value={aiMode} onChange={(event) => setAiMode(event.target.value as typeof aiMode)}>
            <option value="auto">Gerar casos automaticamente</option>
            <option value="estruturado">Gerar no modo estruturado</option>
            <option value="ia" disabled={!aiReady}>Gerar com IA {aiReady ? '' : '(não configurada)'}</option>
          </select>
        </div>
      </div>
      <label className="switch">
        <input type="checkbox" checked={generate} onChange={(event) => setGenerate(event.target.checked)} />
        Gerar casos depois de importar
      </label>
      <label className="switch">
        <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
        Publicar os casos gerados
      </label>

      {error ? (
        <div className="feedback bad" style={{ padding: '10px 12px' }}>
          <span className="small">{error}</span>
        </div>
      ) : null}

      <div>
        <button className="btn btn-primary btn-lg" onClick={run} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="download" size={16} />}
          {busy ? 'Baixando e analisando…' : 'Importar link'}
        </button>
      </div>

      {outcome ? (
        <div className="feedback ok">
          <div className="feedback-title"><Icon name="check" size={16} />Material importado</div>
          <span className="small">
            {outcome.source.title} · {outcome.generation ? `${outcome.generation.created} caso(s) gerado(s)` : 'sem casos ainda'}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn btn-secondary btn-sm" to={`/materiais/${outcome.source.id}`}>Ver material</Link>
            {outcome.generation ? <Link className="btn btn-primary btn-sm" to={`/casos?fonte=${outcome.source.id}`}>Ver casos</Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GuestGate({
  title,
  description,
  loginHref,
  registerHref,
}: {
  title: string;
  description: string;
  loginHref: string;
  registerHref: string;
}) {
  return (
    <div className="card card-pad stack" style={{ maxWidth: 640 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="file-icon" style={{ width: 38, height: 38, borderRadius: 10, flex: 'none' }}>
          <Icon name="lock" size={17} />
        </div>
        <div>
          <h2 style={{ fontSize: 17 }}>{title}</h2>
          <p className="small muted" style={{ marginTop: 4 }}>{description}</p>
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to={loginHref}>
          <Icon name="user" size={15} />
          Entrar
        </Link>
        <Link className="btn btn-secondary" to={registerHref}>
          Criar conta grátis
        </Link>
      </div>
      <div className="tiny muted">
        A aba <strong>Acervos científicos</strong> continua livre: dá para buscar e ler resumos sem conta.
      </div>
    </div>
  );
}
