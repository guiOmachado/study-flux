import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { CaseSummary } from '@shared/types';
import { AREAS } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useDebounced } from '../lib/useDebounced';
import { useToast } from '../lib/toast';
import { accuracyTone, difficultyLabel, difficultyTone, formatLabel, originLabel, relativeDate, statusLabel } from '../lib/format';
import { EmptyState, LoadingBlock, PageHeader } from '../components/ui';
import { Icon } from '../components/Icon';

export function CasesPage() {
  const [params] = useSearchParams();
  const sourceId = params.get('fonte') ? Number(params.get('fonte')) : undefined;
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [mine, setMine] = useState(true);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const debouncedSearch = useDebounced(search.trim(), 400);

  const { data, loading, error, reload } = useFetch(
    () => api.cases.list({ q: debouncedSearch || undefined, area: area || undefined, difficulty: difficulty || undefined, mine, status: status || undefined, sourceId }),
    [debouncedSearch, area, difficulty, mine, status, sourceId],
  );

  const duplicate = async (item: CaseSummary) => {
    try {
      const result = await api.cases.duplicate(item.id);
      toast.success('Caso duplicado para você.');
      navigate(`/casos/${result.case.id}/editar`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível duplicar.');
    }
  };

  const remove = async (item: CaseSummary) => {
    if (!window.confirm(`Excluir “${item.title}”? O histórico de respostas é mantido.`)) return;
    try {
      await api.cases.remove(item.id);
      toast.success('Caso excluído.');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir.');
    }
  };

  const togglePublish = async (item: CaseSummary) => {
    try {
      await api.cases.publish(item.id, item.status !== 'publicado');
      toast.success(item.status === 'publicado' ? 'Caso voltou para rascunho.' : 'Caso publicado na sua biblioteca.');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível alterar a publicação.');
    }
  };

  return (
    <>
      <PageHeader
        title="Biblioteca de casos"
        subtitle="Seus casos e os publicados por outros estudantes. Rascunhos só aparecem para você."
        actions={
          <>
            <Link className="btn btn-secondary" to="/materiais">
              <Icon name="sparkles" size={15} />
              Gerar de material
            </Link>
            <Link className="btn btn-primary" to="/casos/novo">
              <Icon name="plus" size={15} />
              Novo caso
            </Link>
          </>
        }
      />

      <div className="toolbar">
        <div className="search-wrap">
          <Icon name="search" size={16} />
          <input className="input" placeholder="Buscar por título ou tema…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select className="select" value={area} onChange={(event) => setArea(event.target.value)} aria-label="Filtrar por área">
          <option value="">Todas as áreas</option>
          {AREAS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select className="select" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Filtrar por dificuldade">
          <option value="">Dificuldade</option>
          <option value="facil">Fácil</option>
          <option value="media">Média</option>
          <option value="dificil">Difícil</option>
        </select>
        <select className="select" value={mine ? 'mine' : 'all'} onChange={(event) => setMine(event.target.value === 'mine')} aria-label="Escopo">
          <option value="mine">Meus casos</option>
          <option value="all">Todos (inclui comunidade)</option>
        </select>
        {mine ? (
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="publicado">Publicados</option>
            <option value="rascunho">Rascunhos</option>
            <option value="arquivado">Arquivados</option>
          </select>
        ) : null}
      </div>

      {sourceId ? (
        <div className="row" style={{ marginBottom: 14, gap: 8 }}>
          <span className="badge badge-brand">Filtrando pelo material selecionado</span>
          <Link className="tiny" to="/casos">limpar filtro</Link>
        </div>
      ) : null}

      {loading ? <LoadingBlock label="Carregando casos…" /> : null}
      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar a biblioteca" description={error} action={<button className="btn btn-secondary" onClick={reload}>Tentar novamente</button>} />
      ) : null}

      {!loading && !error && data ? (
        data.cases.length === 0 ? (
          <EmptyState
            icon="library"
            title="Nenhum caso encontrado"
            description={
              mine
                ? 'Gere casos a partir de um material ou crie um caso manualmente. Depois de publicar, eles aparecem aqui para treinar.'
                : 'Ajuste os filtros ou envie um material para gerar novos casos.'
            }
            action={
              <div className="row" style={{ gap: 8 }}>
                <Link className="btn btn-secondary" to="/materiais">Enviar material</Link>
                <Link className="btn btn-primary" to="/casos/novo">Criar caso manualmente</Link>
              </div>
            }
          />
        ) : (
          <>
            <div className="tiny muted" style={{ marginBottom: 10 }}>
              {data.total} caso{data.total === 1 ? '' : 's'}
            </div>
            <div className="case-grid">
              {data.cases.map((item) => {
                const own = item.canEdit !== false;
                return (
                  <article key={item.id} className="case-card">
                    <div className="row row-wrap" style={{ gap: 6 }}>
                      <span className="badge badge-neutral">{item.area}</span>
                      <span className={`badge ${difficultyTone[item.difficulty] ?? 'badge-neutral'}`}>{difficultyLabel[item.difficulty] ?? item.difficulty}</span>
                      {item.status !== 'publicado' ? <span className="badge badge-warn">{statusLabel[item.status]}</span> : null}
                      <span className="spacer" />
                      <span className="tiny muted">{relativeDate(item.updatedAt)}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <div className="meta">
                      <span>{formatLabel[item.format] ?? item.format}</span>
                      <span>·</span>
                      <span>{item.questionCount} perguntas</span>
                      <span>·</span>
                      <span>{item.minutes} min</span>
                      {item.attempts ? (
                        <>
                          <span>·</span>
                          <span>{item.attempts} treino{item.attempts === 1 ? '' : 's'}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="tags">
                      <span className="badge badge-neutral">{originLabel[item.origin] ?? item.origin}</span>
                      {item.sourceTitle ? <span className="badge badge-info" style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.sourceTitle}</span> : null}
                      {item.accuracy !== null && item.accuracy !== undefined ? (
                        <span className={`badge ${accuracyTone(item.accuracy)}`}>{item.accuracy}% de acerto</span>
                      ) : null}
                    </div>
                    <div className="case-actions">
                      <Link className="btn btn-primary btn-sm" to={`/treinar/${item.id}`}>
                        <Icon name="play" size={13} />
                        Treinar
                      </Link>
                      <Link className="btn btn-secondary btn-sm" to={`/casos/${item.id}`}>
                        Ver
                      </Link>
                      <span className="spacer" />
                      <details className="menu">
                        <summary className="icon-btn" aria-label="Mais ações" title="Mais ações">
                          <Icon name="settings" size={15} />
                        </summary>
                        <div className="menu-panel">
                          {own ? (
                            <Link to={`/casos/${item.id}/editar`} className="menu-item">
                              <Icon name="edit" size={14} /> Editar
                            </Link>
                          ) : null}
                          {own ? (
                            <button className="menu-item" onClick={() => togglePublish(item)}>
                              <Icon name={item.status === 'publicado' ? 'eye' : 'bookmark'} size={14} />
                              {item.status === 'publicado' ? 'Despublicar' : 'Publicar'}
                            </button>
                          ) : null}
                          <button className="menu-item" onClick={() => duplicate(item)}>
                            <Icon name="copy" size={14} /> Duplicar para mim
                          </button>
                          <a className="menu-item" href={api.cases.exportUrl(item.id)}>
                            <Icon name="download" size={14} /> Exportar JSON
                          </a>
                          {own ? (
                            <button className="menu-item danger" onClick={() => remove(item)}>
                              <Icon name="trash" size={14} /> Excluir
                            </button>
                          ) : null}
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )
      ) : null}
    </>
  );
}
