import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SourceSummary } from '@shared/types';
import { AREAS } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { formatDate, kindLabel, plural } from '../lib/format';
import { EmptyState, LoadingBlock, Modal, PageHeader, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';

type Tab = 'arquivo' | 'texto';

function statusBadge(source: SourceSummary) {
  if (source.status === 'erro') return <span className="badge badge-danger">Erro na análise</span>;
  if (source.status === 'gerado') return <span className="badge badge-success">{source.caseCount} casos gerados</span>;
  if (source.status === 'processando') return <span className="badge badge-info">Analisando</span>;
  return <span className="badge badge-brand">Analisado</span>;
}

export function MaterialsPage() {
  const { data, loading, error, reload } = useFetch(() => api.sources.list(), []);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const remove = async (source: SourceSummary) => {
    if (!window.confirm(`Excluir “${source.title}”? Os casos gerados a partir dele serão mantidos, mas perderão o vínculo.`)) return;
    try {
      await api.sources.remove(source.id);
      toast.success('Material excluído.');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir.');
    }
  };

  return (
    <>
      <PageHeader
        title="Materiais de estudo"
        subtitle="Envie provas antigas, capítulos de livros ou resumos. O Study Flux lê o conteúdo e mostra o que conseguiu identificar antes de gerar os casos."
        actions={
          <>
            <Link className="btn btn-secondary" to="/casos/novo">
              <Icon name="edit" size={15} />
              Criar caso manualmente
            </Link>
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              <Icon name="plus" size={15} />
              Novo material
            </button>
          </>
        }
      />

      {loading ? <LoadingBlock /> : null}
      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar seus materiais" description={error} action={<button className="btn btn-secondary" onClick={reload}>Tentar novamente</button>} />
      ) : null}

      {!loading && !error && data ? (
        data.sources.length === 0 ? (
          <EmptyState
            icon="folder"
            title="Nenhum material ainda"
            description="Comece enviando uma prova antiga com gabarito ou um capítulo que você precisa revisar. Também dá para colar um texto direto."
            action={
              <button className="btn btn-primary" onClick={() => setOpen(true)}>
                <Icon name="upload" size={15} />
                Enviar meu primeiro material
              </button>
            }
          />
        ) : (
          <div className="stack">
            {data.sources.map((source) => (
              <div key={source.id} className="card source-card">
                <div className="file-icon">
                  <Icon name="file" size={19} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="row row-wrap" style={{ gap: 8 }}>
                    <Link to={`/materiais/${source.id}`} style={{ color: 'inherit', fontWeight: 650, fontSize: 15 }}>
                      {source.title}
                    </Link>
                    {statusBadge(source)}
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {kindLabel(source.kind)}
                    {source.discipline ? ` · ${source.discipline}` : ''}
                    {source.pages ? ` · ${plural(source.pages, 'página', 'páginas')}` : ''}
                    {source.analysis ? ` · ${source.analysis.words.toLocaleString('pt-BR')} palavras` : ''}
                    {' · '}
                    {formatDate(source.createdAt)}
                  </div>
                  {source.analysis ? (
                    <div className="pill-list" style={{ marginTop: 8 }}>
                      {source.analysis.topics.slice(0, 4).map((topic) => (
                        <span key={topic} className="badge badge-neutral">{topic}</span>
                      ))}
                      {source.analysis.examQuestions > 0 ? (
                        <span className="badge badge-info">
                          {source.analysis.examQuestions} questões · {source.analysis.examQuestionsWithKey} com gabarito
                        </span>
                      ) : null}
                      {source.analysis.topics.length === 0 && source.analysis.examQuestions === 0 ? (
                        <span className="badge badge-warn">Sem temas reconhecidos — veja a análise</span>
                      ) : null}
                    </div>
                  ) : null}
                  {source.error ? <div className="tiny" style={{ color: 'var(--danger)', marginTop: 6 }}>{source.error}</div> : null}
                </div>
                <div className="source-actions row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Link className="btn btn-secondary btn-sm" to={`/materiais/${source.id}`}>
                    <Icon name="eye" size={14} />
                    Ver análise
                  </Link>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/materiais/${source.id}?gerar=1`)}>
                    <Icon name="sparkles" size={14} />
                    Gerar casos
                  </button>
                  <button className="icon-btn" onClick={() => remove(source)} aria-label="Excluir material" title="Excluir material">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      <UploadModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(source) => {
          setOpen(false);
          reload();
          navigate(`/materiais/${source.id}?gerar=1`);
        }}
      />
    </>
  );
}

function UploadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (source: SourceSummary) => void }) {
  const [tab, setTab] = useState<Tab>('arquivo');
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const reset = () => {
    setTitle('');
    setDiscipline('');
    setText('');
    setFile(null);
    setError(null);
    setTab('arquivo');
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDrag(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (tab === 'arquivo' && !file) {
      setError('Escolha um arquivo PDF, DOCX, TXT ou MD.');
      return;
    }
    if (tab === 'texto' && text.trim().length < 60) {
      setError('Cole pelo menos alguns parágrafos do material.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      if (tab === 'arquivo' && file) form.append('file', file);
      if (tab === 'texto') form.append('text', text);
      if (title.trim()) form.append('title', title.trim());
      if (discipline) form.append('discipline', discipline);
      const result = await api.sources.create(form);
      if (result.warnings.length > 0) toast.show(result.warnings[0], 'info');
      toast.success('Material analisado.');
      reset();
      onCreated(result.source);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o material.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Novo material de estudo"
      description="Provas antigas com gabarito geram casos fiéis. Capítulos e resumos geram blocos de fixação; com IA ativada, viram casos clínicos completos."
      wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={close} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : <Icon name="upload" size={15} />}
            {busy ? 'Analisando material…' : 'Enviar e analisar'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="stack">
        <div className="row" style={{ gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 10, alignSelf: 'flex-start' }}>
          {(['arquivo', 'texto'] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm ${tab === value ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setTab(value)}
              style={tab === value ? { boxShadow: 'var(--shadow-sm)' } : undefined}
            >
              <Icon name={value === 'arquivo' ? 'upload' : 'file'} size={14} />
              {value === 'arquivo' ? 'Enviar arquivo' : 'Colar texto'}
            </button>
          ))}
        </div>

        {tab === 'arquivo' ? (
          <div
            className={`dropzone${drag ? ' drag' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
          >
            <div className="empty-icon" style={{ marginBottom: 2 }}>
              <Icon name="file" size={20} />
            </div>
            <strong>{file ? file.name : 'Arraste o arquivo ou clique para escolher'}</strong>
            <span className="tiny muted">
              {file ? `${(file.size / 1024).toFixed(0)} KB · troque clicando aqui` : 'PDF, DOCX, TXT ou MD · até 25 MB'}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              hidden
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="material-text">Texto do material</label>
            <textarea
              id="material-text"
              className="textarea"
              style={{ minHeight: 190 }}
              placeholder="Cole aqui o capítulo, o resumo ou as questões da prova…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <span className="hint">{text.trim() ? `${text.trim().split(/\s+/).length.toLocaleString('pt-BR')} palavras` : 'Quanto mais estruturado o texto (com títulos), melhor a análise.'}</span>
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="material-title">Título (opcional)</label>
            <input
              id="material-title"
              className="input"
              placeholder="Ex.: Prova de Clínica Médica 2024"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="material-discipline">Disciplina</label>
            <select id="material-discipline" className="select" value={discipline} onChange={(event) => setDiscipline(event.target.value)}>
              <option value="">Detectar automaticamente</option>
              {AREAS.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="feedback bad" style={{ padding: '10px 12px' }}>
            <span>{error}</span>
          </div>
        ) : null}
        <p className="tiny muted">
          Privacidade: o material fica apenas no seu banco local do Study Flux. Nada é enviado a terceiros — exceto se você ativar
          a geração por IA em Configurações, quando apenas o texto necessário é enviado ao provedor escolhido.
        </p>
      </form>
    </Modal>
  );
}
