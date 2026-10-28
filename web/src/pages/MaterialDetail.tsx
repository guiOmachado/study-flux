import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { SettingsDTO, SourceSummary } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { formatDate, kindLabel, plural } from '../lib/format';
import { EmptyState, LoadingBlock, Modal, PageHeader, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';

const TYPE_LABEL: Record<string, string> = {
  definicao: 'Definição',
  epidemiologia: 'Epidemiologia',
  fisiopatologia: 'Fisiopatologia',
  quadro_clinico: 'Quadro clínico',
  diagnostico: 'Diagnóstico',
  tratamento: 'Tratamento',
  complicacoes: 'Complicações',
  prevencao: 'Prevenção',
  caso: 'Caso clínico',
  questoes: 'Questões',
  gabarito: 'Gabarito',
  referencias: 'Referências',
  outro: 'Conteúdo',
};

type GenMode = 'auto' | 'estruturado' | 'ia';

export function MaterialDetailPage() {
  const { id } = useParams();
  const sourceId = Number(id);
  const [searchParams] = useSearchParams();
  const [genOpen, setGenOpen] = useState(searchParams.get('gerar') === '1');
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  const source = useFetch(() => api.sources.get(sourceId), [sourceId]);
  const preview = useFetch(() => api.generate.preview(sourceId), [sourceId]);
  const settings = useFetch<SettingsDTO>(() => api.settings.get(), []);

  useEffect(() => {
    if (preview.data && openDraft === null && preview.data.drafts[0]) setOpenDraft(preview.data.drafts[0].key);
  }, [preview.data, openDraft]);

  if (source.loading) return <LoadingBlock label="Abrindo material…" />;
  if (source.error || !source.data) {
    return (
      <EmptyState
        icon="alert"
        title="Material não encontrado"
        description={source.error ?? 'Talvez ele tenha sido excluído.'}
        action={<Link className="btn btn-secondary" to="/materiais">Voltar para materiais</Link>}
      />
    );
  }

  const item: SourceSummary = source.data.source;
  const analysis = item.analysis;
  const aiReady = Boolean(settings.data?.ai.enabled && settings.data?.ai.hasKey);
  const drafts = preview.data?.drafts ?? [];
  const canGenerateStructured = drafts.length > 0;

  const remove = async () => {
    if (!window.confirm(`Excluir “${item.title}”?`)) return;
    try {
      await api.sources.remove(item.id);
      toast.success('Material excluído.');
      navigate('/materiais');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir.');
    }
  };

  const reanalyze = async () => {
    try {
      await api.sources.reanalyze(item.id);
      toast.success('Análise refeita.');
      source.reload();
      preview.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível reanalisar.');
    }
  };

  return (
    <>
      <PageHeader
        title={item.title}
        subtitle={
          <span>
            {kindLabel(item.kind)}
            {item.discipline ? ` · ${item.discipline}` : ''}
            {analysis?.language ? ` · idioma ${analysis.language.toUpperCase()}` : ''} · enviado em {formatDate(item.createdAt)}
            {item.pages ? ` · ${plural(item.pages, 'página', 'páginas')}` : ''}
          </span>
        }
        actions={
          <>
            <Link className="btn btn-ghost" to="/materiais">
              <Icon name="arrowLeft" size={15} />
              Materiais
            </Link>
            <button className="btn btn-secondary" onClick={reanalyze}>
              <Icon name="refresh" size={15} />
              Reanalisar
            </button>
            <button className="btn btn-primary" onClick={() => setGenOpen(true)}>
              <Icon name="sparkles" size={15} />
              Gerar casos
            </button>
          </>
        }
      />

      {analysis?.warnings?.length ? (
        <div className="feedback" style={{ background: 'var(--warn-50)', borderColor: '#f4e2b7', marginBottom: 16 }}>
          <div className="feedback-title" style={{ color: 'var(--warn)' }}>
            <Icon name="alert" size={16} />
            Pontos de atenção na leitura deste material
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)' }}>
            {analysis.warnings.map((warning) => (
              <li key={warning} className="small">{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="analysis-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>O que identificamos</h3>
            <span className={`badge ${item.kind === 'prova' ? 'badge-info' : item.kind === 'capitulo' ? 'badge-brand' : 'badge-neutral'}`}>
              {kindLabel(item.kind)}
            </span>
          </div>
          <div className="card-body stack">
            <div className="grid grid-3" style={{ gap: 10 }}>
              <div className="vital">
                <div className="vital-label">Palavras</div>
                <div className="vital-value">{analysis ? analysis.words.toLocaleString('pt-BR') : item.chars.toLocaleString('pt-BR')}</div>
              </div>
              <div className="vital">
                <div className="vital-label">Leitura</div>
                <div className="vital-value">{analysis ? `${analysis.readingMinutes} min` : '—'}</div>
              </div>
              <div className="vital">
                <div className="vital-label">Questões</div>
                <div className="vital-value">{analysis ? `${analysis.examQuestionsWithKey}/${analysis.examQuestions}` : '—'}</div>
              </div>
            </div>

            {analysis && analysis.topics.length > 0 ? (
              <div>
                <div className="section-label">Temas reconhecidos</div>
                <div className="pill-list">
                  {analysis.topics.map((topic) => (
                    <span key={topic} className="badge badge-brand">{topic}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis && analysis.conditions.length > 0 ? (
              <div>
                <div className="section-label">Condições citadas</div>
                <div className="pill-list">
                  {analysis.conditions.slice(0, 10).map((condition) => (
                    <span key={condition} className="badge badge-neutral">{condition}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis && analysis.sections.length > 0 ? (
              <div>
                <div className="section-label">Estrutura do material</div>
                <div className="section-list">
                  {analysis.sections.map((section, index) => (
                    <div key={`${section.heading}-${index}`} className="section-row">
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {section.heading}
                      </span>
                      <span className="section-type">{TYPE_LABEL[section.type] ?? section.type}</span>
                      <span className="tiny muted" style={{ width: 62, textAlign: 'right' }}>
                        {section.facts} trecho{section.facts === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <details>
              <summary className="small" style={{ cursor: 'pointer', color: 'var(--brand)', fontWeight: 600 }}>
                Ver o texto que foi extraído
              </summary>
              <pre
                className="tiny"
                style={{
                  whiteSpace: 'pre-wrap',
                  background: 'var(--surface-2)',
                  padding: 12,
                  borderRadius: 10,
                  maxHeight: 260,
                  overflow: 'auto',
                  marginTop: 8,
                  fontFamily: 'ui-monospace, Menlo, monospace',
                }}
              >
                {source.data.textPreview || source.data.excerpt || 'Sem texto extraído.'}
              </pre>
            </details>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Prévia do que será gerado</h3>
            <span className="tiny muted">modo estruturado</span>
          </div>
          <div className="card-body">
            {preview.loading ? <LoadingBlock label="Montando prévia…" /> : null}
            {preview.error ? <p className="small" style={{ color: 'var(--danger)' }}>{preview.error}</p> : null}
            {!preview.loading && preview.data ? (
              preview.data.drafts.length === 0 ? (
                <div className="stack-sm">
                  <p className="small muted">
                    O modo estruturado (sem IA) não encontrou trechos suficientes. Ele precisa de subtítulos com conteúdo clínico ou de
                    questões com gabarito.
                  </p>
                  <div className="row">
                    <Link className="btn btn-secondary btn-sm" to="/configuracoes">Ativar IA</Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => setGenOpen(true)}>Ver opções</button>
                  </div>
                </div>
              ) : (
                <div className="stack-sm">
                  <p className="small muted">
                    {plural(preview.data.drafts.length, 'bloco', 'blocos')} com{' '}
                    {preview.data.drafts.reduce((acc, draft) => acc + draft.questions.length, 0)} perguntas, montadas a partir de trechos
                    literais do material. Revise antes de publicar.
                  </p>
                  {preview.data.drafts.map((draft) => {
                    const expanded = openDraft === draft.key;
                    return (
                      <div key={draft.key} className="draft">
                        <div className="draft-head" onClick={() => setOpenDraft(expanded ? null : draft.key)}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.title}</span>
                          <span className="row" style={{ gap: 8 }}>
                            <span className="tiny muted">{draft.questions.length} perguntas</span>
                            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={15} />
                          </span>
                        </div>
                        {expanded ? (
                          <div className="draft-body">
                            {draft.questions.map((question, index) => (
                              <div key={index}>
                                <div className="draft-q">{question.prompt}</div>
                                <div className="draft-options">
                                  {question.options.map((option) => (
                                    <div key={option.id} className={`draft-option${option.id === question.correctOptionId ? ' correct' : ''}`}>
                                      {option.id.toUpperCase()}) {option.text}
                                    </div>
                                  ))}
                                </div>
                                <div className="tiny muted" style={{ marginTop: 6 }}>{question.rationale}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row between row-wrap">
          <div className="row" style={{ gap: 10 }}>
            <div className="file-icon" style={{ width: 34, height: 34, borderRadius: 10 }}>
              <Icon name={aiReady ? 'sparkles' : 'info'} size={16} />
            </div>
            <div>
              <strong className="small">{aiReady ? 'IA ativa' : 'IA desativada'}</strong>
              <div className="tiny muted">
                {aiReady
                  ? `Modelo ${settings.data?.ai.model} · ${settings.data?.ai.provider}`
                  : 'Sem IA, a plataforma usa o próprio texto do material: perguntas de completar e questões de provas antigas.'}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn btn-secondary btn-sm" to="/configuracoes">
              <Icon name="settings" size={14} />
              Configurar IA
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => setGenOpen(true)}>
              <Icon name="sparkles" size={14} />
              Gerar casos
            </button>
            <button className="btn btn-danger-ghost btn-sm" onClick={remove}>
              <Icon name="trash" size={14} />
              Excluir material
            </button>
          </div>
        </div>
      </div>

      <GenerateModal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        source={item}
        aiReady={aiReady}
        canStructured={canGenerateStructured}
        onGenerated={() => {
          source.reload();
          preview.reload();
        }}
      />
    </>
  );
}

function GenerateModal({
  open,
  onClose,
  source,
  aiReady,
  canStructured,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  source: SourceSummary;
  aiReady: boolean;
  canStructured: boolean;
  onGenerated: () => void;
}) {
  const [mode, setMode] = useState<GenMode>(aiReady ? 'auto' : 'estruturado');
  const [maxCases, setMaxCases] = useState(4);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; mode: string; warnings: string[]; cases: { id: number; title: string }[] } | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setMode(aiReady ? 'auto' : 'estruturado');
    }
  }, [open, aiReady]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.generate.source(source.id, { mode, maxCases, publish });
      setResult(response);
      onGenerated();
      toast.success(`${response.created} caso(s) criado(s), ${response.updated} atualizado(s).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar os casos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title="Gerar casos a partir do material"
      description={source.title}
      wide
      footer={
        result ? (
          <>
            <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
            <button className="btn btn-primary" onClick={() => navigate(`/casos?fonte=${source.id}`)}>
              Ver casos gerados
              <Icon name="arrowRight" size={15} />
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="btn btn-primary" onClick={run} disabled={busy}>
              {busy ? <Spinner /> : <Icon name="sparkles" size={15} />}
              {busy ? 'Gerando… pode levar até 1 minuto' : 'Gerar casos'}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="stack">
          <div className="feedback ok">
            <div className="feedback-title">
              <Icon name="check" size={16} />
              {result.created} criado(s) · {result.updated} atualizado(s)
            </div>
            <span className="small">
              Modo utilizado: {result.mode === 'ia' ? 'IA' : 'estruturado (sem IA)'}.{' '}
              {publish ? 'Os casos ficaram publicados na sua biblioteca.' : 'Os casos ficaram como rascunho — publique quando revisar.'}
            </span>
          </div>
          {result.warnings.length > 0 ? (
            <div className="stack-sm">
              {result.warnings.map((warning) => (
                <div key={warning} className="small" style={{ color: 'var(--muted)' }}>• {warning}</div>
              ))}
            </div>
          ) : null}
          <div className="stack-sm">
            {result.cases.map((item) => (
              <Link key={item.id} to={`/casos/${item.id}`} className="draft-head" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, border: '1px solid var(--line)' }}>
                <span>{item.title}</span>
                <Icon name="chevronRight" size={15} />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <span className="label">Como gerar</span>
            <div className="stack-sm">
              <label className={`option${mode === 'auto' ? ' selected' : ''}`} style={{ cursor: 'pointer' }}>
                <input type="radio" name="mode" checked={mode === 'auto'} onChange={() => setMode('auto')} style={{ marginTop: 6 }} />
                <span>
                  <strong>Automático</strong>
                  <span className="tiny muted" style={{ display: 'block' }}>
                    Usa IA quando estiver configurada; caso contrário, monta blocos fiéis ao texto.
                  </span>
                </span>
              </label>
              <label className={`option${mode === 'estruturado' ? ' selected' : ''}`} style={{ cursor: 'pointer', opacity: canStructured ? 1 : 0.6 }}>
                <input type="radio" name="mode" checked={mode === 'estruturado'} onChange={() => setMode('estruturado')} style={{ marginTop: 6 }} />
                <span>
                  <strong>Estruturado (sem IA)</strong>
                  <span className="tiny muted" style={{ display: 'block' }}>
                    Perguntas de completar a partir de trechos literais + questões de provas antigas com gabarito.
                  </span>
                </span>
              </label>
              <label className={`option${mode === 'ia' ? ' selected' : ''}`} style={{ cursor: 'pointer', opacity: aiReady ? 1 : 0.6 }}>
                <input type="radio" name="mode" checked={mode === 'ia'} onChange={() => setMode('ia')} disabled={!aiReady} style={{ marginTop: 6 }} />
                <span>
                  <strong>Somente IA</strong>
                  <span className="tiny muted" style={{ display: 'block' }}>
                    {aiReady ? 'Cria casos clínicos completos, com paciente, exames e perguntas em progressão.' : 'Ative a IA em Configurações para usar este modo.'}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="max-cases">Quantidade de casos</label>
              <input
                id="max-cases"
                type="number"
                min={1}
                max={8}
                className="input"
                value={maxCases}
                onChange={(event) => setMaxCases(Math.max(1, Math.min(8, Number(event.target.value) || 1)))}
              />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label className="switch">
                <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
                Publicar automaticamente
              </label>
              <span className="hint">Rascunhos ficam visíveis só para você até publicar.</span>
            </div>
          </div>

          {error ? (
            <div className="feedback bad" style={{ padding: '10px 12px' }}>
              <span>{error}</span>
            </div>
          ) : null}

          <p className="tiny muted">
            A geração substitui casos anteriores deste mesmo material quando o conteúdo muda, preservando seu histórico de respostas.
          </p>
        </div>
      )}
    </Modal>
  );
}
