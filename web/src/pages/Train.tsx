import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AttemptDTO } from '@shared/types';
import { api, ApiError, type AnswerFeedback, type PlayableCase } from '../lib/api';
import { useToast } from '../lib/toast';
import { difficultyLabel, formatLabel } from '../lib/format';
import { CasePresentation } from '../components/CasePresentation';
import { EmptyState, LoadingBlock, ProgressRing, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';

interface LocalFeedback {
  optionId: string;
  correct: boolean;
  correctOptionId: string;
  rationale: string;
  keyPoint?: string;
  sourceExcerpt?: string;
}

export function TrainPage() {
  const { id } = useParams();
  const caseId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptDTO | null>(null);
  const [playable, setPlayable] = useState<PlayableCase | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<LocalFeedback | null>(null);
  const [answers, setAnswers] = useState<{ questionId: string; correct: boolean }[]>([]);
  const [finished, setFinished] = useState<AttemptDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPresentation, setShowPresentation] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const questionStart = useRef(Date.now());
  const startedAt = useRef(Date.now());

  const startRequest = useRef<{ caseId: number; promise: ReturnType<typeof api.attempts.start> } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (!startRequest.current || startRequest.current.caseId !== caseId) {
      startRequest.current = { caseId, promise: api.attempts.start(caseId, 'treino') };
    }
    startRequest.current.promise
      .then((result) => {
        if (!alive) return;
        setAttempt(result.attempt);
        setPlayable(result.case);
        questionStart.current = Date.now();
        startedAt.current = Date.now();
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar o treino.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [caseId]);

  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [finished]);

  const questions = playable?.questions ?? [];
  const question = questions[index];
  const total = questions.length;

  const confirm = async () => {
    if (!attempt || !question || !selected || feedback || submitting) return;
    setSubmitting(true);
    try {
      const response: AnswerFeedback = await api.attempts.answer(attempt.id, {
        questionId: question.id,
        optionId: selected,
        timeMs: Date.now() - questionStart.current,
      });
      setFeedback({
        optionId: selected,
        correct: response.correct,
        correctOptionId: response.correctOptionId,
        rationale: response.rationale,
        keyPoint: response.keyPoint,
        sourceExcerpt: response.sourceExcerpt,
      });
      setAnswers((prev) => [...prev, { questionId: question.id, correct: response.correct }]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar a resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = async () => {
    if (index + 1 < total) {
      setIndex(index + 1);
      setSelected(null);
      setFeedback(null);
      questionStart.current = Date.now();
      return;
    }
    if (!attempt) return;
    setSubmitting(true);
    try {
      const result = await api.attempts.finish(attempt.id, Date.now() - startedAt.current);
      window.dispatchEvent(new Event('sf:srs-changed'));
      setFinished(result.attempt);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível finalizar o treino.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!question || finished) return;
      if (/^[1-5]$/.test(event.key)) {
        const option = question.options[Number(event.key) - 1];
        if (option && !feedback) setSelected(option.id);
      }
      if (event.key === 'Enter') {
        if (feedback) void next();
        else if (selected) void confirm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (loading) return <LoadingBlock label="Preparando o caso…" />;
  if (error || !attempt || !playable) {
    return (
      <EmptyState
        icon="alert"
        title="Não foi possível treinar este caso"
        description={error ?? 'Caso indisponível.'}
        action={<Link className="btn btn-secondary" to="/casos">Voltar para a biblioteca</Link>}
      />
    );
  }

  if (finished) {
    return <TrainSummary attempt={finished} playable={playable} elapsed={elapsed} onRestart={() => navigate(0)} />;
  }

  const answered = answers.length;
  const pct = total ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="train-shell">
      <div className="train-head">
        <Link className="icon-btn" to={`/casos/${playable.id}`} aria-label="Voltar ao caso">
          <Icon name="close" size={19} />
        </Link>
        <div className="train-progress">
          <div className="row">
            <span>
              {answered} de {total} respondidas
            </span>
            <span className="mono">
              <Icon name="clock" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="row row-wrap" style={{ gap: 6, marginBottom: 12 }}>
        <span className="badge badge-brand">{playable.area}</span>
        <span className="badge badge-neutral">{formatLabel[playable.format] ?? playable.format}</span>
        <span className="badge badge-neutral">{difficultyLabel[playable.difficulty] ?? playable.difficulty}</span>
        {playable.sourceTitle ? <span className="badge badge-info" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{playable.sourceTitle}</span> : null}
      </div>

      <h2 style={{ marginBottom: 12 }}>{playable.title}</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Dados do caso</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPresentation((value) => !value)}>
            <Icon name={showPresentation ? 'chevronDown' : 'chevronRight'} size={14} />
            {showPresentation ? 'Recolher' : 'Abrir'}
          </button>
        </div>
        {showPresentation ? (
          <div className="card-body">
            <CasePresentation presentation={playable.presentation} />
          </div>
        ) : null}
      </div>

      {question ? (
        <div className="card question-card">
          <div className="row between">
            <span className="badge badge-neutral">Pergunta {index + 1} de {total}</span>
            <span className="tiny muted">{feedback ? 'confira o comentário abaixo' : 'selecione e confirme'}</span>
          </div>
          <div className="question-prompt">{question.prompt}</div>
          <div className="options">
            {question.options.map((option) => {
              let className = 'option';
              if (!feedback && selected === option.id) className += ' selected';
              if (feedback) {
                if (option.id === feedback.correctOptionId) className += ' correct';
                else if (option.id === feedback.optionId) className += ' wrong';
              }
              return (
                <button
                  key={option.id}
                  className={className}
                  onClick={() => !feedback && setSelected(option.id)}
                  disabled={Boolean(feedback)}
                >
                  <span className="option-key">{option.id.toUpperCase()}</span>
                  <span>{option.text}</span>
                  {feedback && option.id === feedback.correctOptionId ? <Icon name="check" size={17} style={{ marginLeft: 'auto', flex: 'none', color: 'var(--success)' }} /> : null}
                  {feedback && option.id === feedback.optionId && option.id !== feedback.correctOptionId ? (
                    <Icon name="x" size={17} style={{ marginLeft: 'auto', flex: 'none', color: 'var(--danger)' }} />
                  ) : null}
                </button>
              );
            })}
          </div>

          {feedback ? (
            <div className={`feedback ${feedback.correct ? 'ok' : 'bad'}`}>
              <div className="feedback-title">
                <Icon name={feedback.correct ? 'check' : 'x'} size={16} />
                {feedback.correct ? 'Resposta correta' : 'Resposta incorreta'}
                {!feedback.correct ? <span className="small" style={{ fontWeight: 500 }}>· correta: {feedback.correctOptionId.toUpperCase()}</span> : null}
              </div>
              <span>{feedback.rationale}</span>
              {feedback.keyPoint ? <div className="small"><strong>Ponto-chave:</strong> {feedback.keyPoint}</div> : null}
              {feedback.sourceExcerpt ? <div className="quote">{feedback.sourceExcerpt}</div> : null}
            </div>
          ) : null}

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            {!feedback ? (
              <button className="btn btn-primary" onClick={confirm} disabled={!selected || submitting}>
                {submitting ? <Spinner /> : null}
                Confirmar resposta
                <span className="tiny" style={{ opacity: 0.7 }}>Enter</span>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={next} disabled={submitting}>
                {index + 1 < total ? 'Próxima pergunta' : 'Ver resultado'}
                {submitting ? <Spinner /> : <Icon name="arrowRight" size={15} />}
              </button>
            )}
          </div>
        </div>
      ) : null}

      <p className="tiny muted" style={{ textAlign: 'center', marginTop: 14 }}>
        Atalhos: 1–5 escolhem a alternativa, Enter confirma e avança.
      </p>
    </div>
  );
}

function TrainSummary({ attempt, playable, elapsed, onRestart }: { attempt: AttemptDTO; playable: PlayableCase; elapsed: number; onRestart: () => void }) {
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const wrong = attempt.results.filter((result) => !result.correct);
  return (
    <div className="train-shell">
      <div className="card card-pad" style={{ textAlign: 'center', marginBottom: 16 }}>
        <span className="badge badge-brand" style={{ marginBottom: 10 }}>Treino concluído</span>
        <h1 style={{ marginBottom: 4 }}>{playable.title}</h1>
        <p className="small muted">Você acertou {attempt.score} de {attempt.total} em {Math.floor(elapsed / 60)} min {elapsed % 60}s.</p>
        <div className="row" style={{ justifyContent: 'center', margin: '18px 0 6px' }}>
          <ProgressRing value={pct} size={110} stroke={9} />
        </div>
        <p className="small muted" style={{ maxWidth: 460, margin: '0 auto' }}>
          {pct >= 80
            ? 'Ótimo desempenho. Uma revisão rápida amanhã consolida o aprendizado.'
            : pct >= 50
              ? 'Bom progresso. Os erros foram enviados para a revisão espaçada.'
              : 'Vale reler os pontos-chave do caso. As questões erradas voltam amanhã na revisão.'}
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onRestart}>
            <Icon name="refresh" size={15} />
            Refazer treino
          </button>
          <Link className="btn btn-secondary" to="/revisao">
            <Icon name="layers" size={15} />
            Ir para revisão
          </Link>
          <Link className="btn btn-primary" to="/casos">
            <Icon name="library" size={15} />
            Outros casos
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Revisão do que você respondeu</h3>
          <span className="tiny muted">{wrong.length} para revisar</span>
        </div>
        <div className="card-body stack">
          {attempt.results.map((result, index) => {
            const question = playable.questions.find((q) => q.id === result.questionId);
            const correctOption = question?.options.find((option) => option.id === result.correctOptionId);
            return (
              <div key={result.questionId} style={{ paddingBottom: 14, borderBottom: index + 1 < attempt.results.length ? '1px solid var(--line-2)' : 'none' }}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className={`badge ${result.correct ? 'badge-success' : 'badge-danger'}`}>
                    {result.correct ? 'Acertou' : 'Errou'}
                  </span>
                  <span className="tiny muted">Pergunta {index + 1}</span>
                </div>
                <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{result.prompt}</div>
                <div className="tiny" style={{ color: 'var(--ink-2)' }}>
                  Correta: <strong>{result.correctOptionId.toUpperCase()}</strong>
                  {correctOption ? ` — ${correctOption.text}` : ''}
                  {!result.correct ? ` · Você marcou ${result.chosenOptionId?.toUpperCase() ?? '—'}` : ''}
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>{result.rationale}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
