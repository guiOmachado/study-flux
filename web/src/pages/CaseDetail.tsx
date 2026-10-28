import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CaseDetail, CaseQuestion } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { difficultyLabel, difficultyTone, formatLabel, relativeDate, statusLabel, originLabel } from '../lib/format';
import { CasePresentation } from '../components/CasePresentation';
import { EmptyState, LoadingBlock, PageHeader } from '../components/ui';
import { Icon } from '../components/Icon';

export function CaseDetailPage() {
  const { id } = useParams();
  const caseId = Number(id);
  const { data, loading, error, reload } = useFetch(() => api.cases.get(caseId), [caseId]);
  const [showAnswers, setShowAnswers] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  if (loading) return <LoadingBlock label="Abrindo caso…" />;
  if (error || !data) {
    return (
      <EmptyState
        icon="alert"
        title="Caso não encontrado"
        description={error ?? 'Talvez ele tenha sido removido ou esteja como rascunho de outra pessoa.'}
        action={<Link className="btn btn-secondary" to="/casos">Voltar para a biblioteca</Link>}
      />
    );
  }

  const item: CaseDetail = data.case;
  const own = item.canEdit;

  const togglePublish = async () => {
    try {
      await api.cases.publish(item.id, item.status !== 'publicado');
      toast.success(item.status === 'publicado' ? 'Caso despublicado.' : 'Caso publicado.');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível alterar.');
    }
  };

  const duplicate = async () => {
    try {
      const result = await api.cases.duplicate(item.id);
      toast.success('Caso duplicado para você.');
      navigate(`/casos/${result.case.id}/editar`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível duplicar.');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Excluir “${item.title}”?`)) return;
    try {
      await api.cases.remove(item.id);
      toast.success('Caso excluído.');
      navigate('/casos');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir.');
    }
  };

  return (
    <>
      <PageHeader
        title={item.title}
        subtitle={
          <span className="row row-wrap" style={{ gap: 6 }}>
            <span>{item.area}</span>
            <span>·</span>
            <span>{item.topic}</span>
            <span>·</span>
            <span>{formatLabel[item.format]} com {item.questionCount} perguntas</span>
            <span>·</span>
            <span>atualizado {relativeDate(item.updatedAt)}</span>
          </span>
        }
        actions={
          <>
            <Link className="btn btn-ghost" to="/casos">
              <Icon name="arrowLeft" size={15} />
              Biblioteca
            </Link>
            {own ? (
              <Link className="btn btn-secondary" to={`/casos/${item.id}/editar`}>
                <Icon name="edit" size={15} />
                Editar
              </Link>
            ) : null}
            <Link className="btn btn-primary" to={`/treinar/${item.id}`}>
              <Icon name="play" size={15} />
              Treinar este caso
            </Link>
          </>
        }
      />

      <div className="row row-wrap" style={{ gap: 6, marginBottom: 18 }}>
        <span className={`badge ${difficultyTone[item.difficulty]}`}>{difficultyLabel[item.difficulty]}</span>
        <span className={`badge ${item.status === 'publicado' ? 'badge-success' : 'badge-warn'}`}>{statusLabel[item.status]}</span>
        <span className="badge badge-neutral">{originLabel[item.origin]}</span>
        {item.sourceTitle ? <span className="badge badge-info">{item.sourceTitle}</span> : null}
        {!own ? <span className="badge badge-brand">Caso da comunidade</span> : null}
        {item.attempts ? <span className="badge badge-neutral">{item.attempts} treinos · {item.accuracy}% de acerto</span> : null}
      </div>

      <div className="grid dash-split">
        <div className="card">
          <div className="card-head">
            <h3>Apresentação do caso</h3>
            <span className="tiny muted">leitura de {item.minutes} min</span>
          </div>
          <div className="card-body">
            <CasePresentation presentation={item.data.presentation} objectives={item.data.objectives} />
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Perguntas ({item.data.questions.length})</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAnswers((value) => !value)}>
                <Icon name="eye" size={14} />
                {showAnswers ? 'Ocultar gabarito' : 'Mostrar gabarito'}
              </button>
            </div>
            <div className="card-body stack">
              {item.data.questions.map((question, index) => (
                <QuestionPreview key={question.id} question={question} index={index} showAnswer={showAnswers} />
              ))}
            </div>
          </div>

          {item.data.teachingPoints.length > 0 ? (
            <div className="card">
              <div className="card-head">
                <h3>Pontos-chave</h3>
              </div>
              <div className="card-body">
                <ul className="clinical-list">
                  {item.data.teachingPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {item.data.sourceRefs.length > 0 ? (
            <div className="card">
              <div className="card-head">
                <h3>Fontes</h3>
              </div>
              <div className="card-body stack-sm">
                {item.data.sourceRefs.map((ref, index) => (
                  <div key={index} className="small">
                    <strong>{ref.label}</strong>
                    {ref.excerpt ? <div className="quote" style={{ marginTop: 4 }}>{ref.excerpt}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {item.data.generation.warnings.length > 0 ? (
            <div className="card card-pad">
              <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <Icon name="info" size={16} style={{ color: 'var(--muted)', flex: 'none', marginTop: 2 }} />
                <div className="tiny muted">{item.data.generation.warnings.join(' ')}</div>
              </div>
            </div>
          ) : null}

          <div className="card card-pad">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Link className="btn btn-secondary btn-sm" to={`/treinar/${item.id}`}>
                <Icon name="play" size={14} />
                Treinar
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={duplicate}>
                <Icon name="copy" size={14} />
                Duplicar
              </button>
              <a className="btn btn-secondary btn-sm" href={api.cases.exportUrl(item.id)}>
                <Icon name="download" size={14} />
                Exportar
              </a>
              {own ? (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={togglePublish}>
                    <Icon name={item.status === 'publicado' ? 'eye' : 'bookmark'} size={14} />
                    {item.status === 'publicado' ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button className="btn btn-danger-ghost btn-sm" onClick={remove}>
                    <Icon name="trash" size={14} />
                    Excluir
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function QuestionPreview({ question, index, showAnswer }: { question: CaseQuestion; index: number; showAnswer: boolean }) {
  return (
    <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--line-2)' }}>
      <div className="row" style={{ gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
        <span className="badge badge-neutral">Pergunta {index + 1}</span>
        {question.keyPoint ? <span className="tiny muted">{question.keyPoint}</span> : null}
      </div>
      <div className="draft-q" style={{ fontWeight: 600 }}>{question.prompt}</div>
      <div className="draft-options">
        {question.options.map((option) => (
          <div
            key={option.id}
            className={`draft-option${showAnswer && option.id === question.correctOptionId ? ' correct' : ''}`}
          >
            {option.id.toUpperCase()}) {option.text}
          </div>
        ))}
      </div>
      {showAnswer ? (
        <div className="feedback ok" style={{ marginTop: 10 }}>
          <div className="feedback-title">
            <Icon name="check" size={15} />
            Alternativa correta: {question.correctOptionId.toUpperCase()}
          </div>
          <span className="small">{question.rationale}</span>
          {question.sourceExcerpt ? <div className="quote">{question.sourceExcerpt}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
