import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AttemptDTO } from '@shared/types';
import { AREAS } from '@shared/types';
import { api, ApiError, type PlayableCase } from '../lib/api';
import { useToast } from '../lib/toast';
import { CasePresentation } from '../components/CasePresentation';
import { EmptyState, LoadingBlock, PageHeader, ProgressRing, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';

interface BatchItem {
  attemptId: number;
  attempt: AttemptDTO;
  case: PlayableCase;
}

type ResultMap = Record<number, { questionId: string; correct: boolean }[]>;

export function SimuladoPage() {
  const [phase, setPhase] = useState<'config' | 'running' | 'done'>('config');
  const [area, setArea] = useState('');
  const [limit, setLimit] = useState(3);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ResultMap>({});
  const [finalAttempts, setFinalAttempts] = useState<AttemptDTO[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const questionStart = useRef(Date.now());
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await api.attempts.startBatch({ mode: 'simulado', area: area || undefined, limit });
      setItems(response.items);
      setResults({});
      setCaseIndex(0);
      setQuestionIndex(0);
      setSelected(null);
      setPhase('running');
      startedAt.current = Date.now();
      questionStart.current = Date.now();
      setElapsed(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível montar o simulado.');
    } finally {
      setStarting(false);
    }
  };

  const finishAll = async (current: ResultMap, list = items) => {
    const finished: AttemptDTO[] = [];
    for (const item of list) {
      if ((current[item.attemptId] ?? []).length === 0) continue;
      try {
        const response = await api.attempts.finish(item.attemptId);
        finished.push(response.attempt);
      } catch {
        /* segue para o próximo */
      }
    }
    setFinalAttempts(finished);
    setPhase('done');
    window.dispatchEvent(new Event('sf:srs-changed'));
  };

  const advance = async (currentResults: ResultMap) => {
    const item = items[caseIndex];
    const totalQuestions = item.case.questions.length;
    if (questionIndex + 1 < totalQuestions) {
      setQuestionIndex(questionIndex + 1);
      setSelected(null);
      questionStart.current = Date.now();
      return;
    }
    if (caseIndex + 1 < items.length) {
      setCaseIndex(caseIndex + 1);
      setQuestionIndex(0);
      setSelected(null);
      questionStart.current = Date.now();
      return;
    }
    await finishAll(currentResults);
  };

  const confirm = async () => {
    const item = items[caseIndex];
    const question = item?.case.questions[questionIndex];
    if (!item || !question || !selected || submitting) return;
    setSubmitting(true);
    try {
      const feedback = await api.attempts.answer(item.attemptId, {
        questionId: question.id,
        optionId: selected,
        timeMs: Date.now() - questionStart.current,
      });
      const nextResults: ResultMap = {
        ...results,
        [item.attemptId]: [...(results[item.attemptId] ?? []), { questionId: question.id, correct: feedback.correct }],
      };
      setResults(nextResults);
      await advance(nextResults);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar a resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const stopEarly = async () => {
    if (!window.confirm('Encerrar o simulado agora? As questões já respondidas entram no histórico.')) return;
    await finishAll(results);
  };

  const reset = () => {
    setPhase('config');
    setItems([]);
    setResults({});
    setFinalAttempts([]);
    setSelected(null);
    setError(null);
  };

  const totalQuestions = items.reduce((acc, item) => acc + item.case.questions.length, 0);
  const answeredCount = Object.values(results).reduce((acc, list) => acc + list.length, 0);
  const item = items[caseIndex];
  const question = item?.case.questions[questionIndex];

  if (phase === 'running' && item && question) {
    const pct = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
    return (
      <div className="train-shell">
        <div className="train-head">
          <button className="icon-btn" onClick={stopEarly} aria-label="Encerrar simulado">
            <Icon name="close" size={19} />
          </button>
          <div className="train-progress">
            <div className="row">
              <span>
                Caso {caseIndex + 1} de {items.length} · {answeredCount} de {totalQuestions} questões
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
          <span className="badge badge-info">Simulado — sem correção até o final</span>
          <span className="badge badge-neutral">{item.case.area}</span>
          <span className="badge badge-neutral">{item.case.difficulty}</span>
        </div>

        <h2 style={{ marginBottom: 12 }}>{item.case.title}</h2>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3>Dados do caso</h3>
            <span className="tiny muted">leitura antes de responder</span>
          </div>
          <div className="card-body">
            <CasePresentation presentation={item.case.presentation} />
          </div>
        </div>

        <div className="card question-card">
          <div className="row between">
            <span className="badge badge-neutral">Questão {questionIndex + 1} de {item.case.questions.length}</span>
            <span className="tiny muted">responda e siga em frente</span>
          </div>
          <div className="question-prompt">{question.prompt}</div>
          <div className="options">
            {question.options.map((option) => (
              <button
                key={option.id}
                className={`option${selected === option.id ? ' selected' : ''}`}
                onClick={() => setSelected(option.id)}
                disabled={submitting}
              >
                <span className="option-key">{option.id.toUpperCase()}</span>
                <span>{option.text}</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-primary" onClick={confirm} disabled={!selected || submitting}>
              {submitting ? <Spinner /> : null}
              Responder e avançar
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const totalScore = finalAttempts.reduce((acc, attempt) => acc + attempt.score, 0);
    const totalDone = finalAttempts.reduce((acc, attempt) => acc + attempt.total, 0);
    const pct = totalDone ? Math.round((totalScore / totalDone) * 100) : 0;
    return (
      <>
        <PageHeader
          title="Resultado do simulado"
          subtitle={`${totalScore} acertos de ${totalDone} questões em ${Math.floor(elapsed / 60)} min ${elapsed % 60}s`}
          actions={
            <>
              <button className="btn btn-secondary" onClick={reset}>
                <Icon name="refresh" size={15} />
                Novo simulado
              </button>
              <Link className="btn btn-primary" to="/progresso">
                Ver progresso
                <Icon name="arrowRight" size={15} />
              </Link>
            </>
          }
        />
        <div className="grid dash-split" style={{ marginBottom: 16 }}>
          <div className="card card-pad row" style={{ gap: 22, alignItems: 'center', justifyContent: 'center' }}>
            <ProgressRing value={pct} size={120} stroke={10} />
            <div>
              <div className="section-label">Aproveitamento</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{pct}%</div>
              <p className="small muted" style={{ maxWidth: 260 }}>
                {pct >= 70
                  ? 'Bom desempenho para o período de provas. Revise os erros e mantenha a constância.'
                  : 'Os temas com erro entraram na revisão espaçada. Uma nova rodada neles tende a melhorar rápido.'}
              </p>
            </div>
          </div>
          <div className="card card-pad stack-sm">
            <div className="row between small">
              <span className="muted">Casos respondidos</span>
              <strong>{finalAttempts.length}</strong>
            </div>
            <div className="row between small">
              <span className="muted">Questões</span>
              <strong>{totalDone}</strong>
            </div>
            <div className="row between small">
              <span className="muted">Tempo total</span>
              <strong>{Math.floor(elapsed / 60)} min</strong>
            </div>
            <div className="row between small">
              <span className="muted">Revisões geradas</span>
              <strong>a partir dos erros</strong>
            </div>
            <Link className="btn btn-secondary btn-sm" to="/revisao" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <Icon name="layers" size={14} />
              Revisar erros
            </Link>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Desempenho por caso</h3>
          </div>
          <div className="card-body stack">
            {finalAttempts.map((attempt) => {
              const casePct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
              return (
                <div key={attempt.id} className="row between" style={{ gap: 12, borderBottom: '1px solid var(--line-2)', paddingBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{attempt.caseTitle}</div>
                    <div className="tiny muted">{attempt.area} · {attempt.topic}</div>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <span className={`badge ${casePct >= 70 ? 'badge-success' : casePct >= 50 ? 'badge-warn' : 'badge-danger'}`}>
                      {attempt.score}/{attempt.total}
                    </span>
                    {attempt.caseId ? (
                      <Link className="btn btn-ghost btn-sm" to={`/casos/${attempt.caseId}`}>
                        <Icon name="eye" size={14} />
                        Ver caso
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {finalAttempts.length === 0 ? <p className="small muted">Nenhuma questão respondida neste simulado.</p> : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Simulado"
        subtitle="Monte uma sequência de casos da sua biblioteca e da comunidade. Sem correção durante o percurso: o resultado aparece no final, como em uma prova."
      />
      {error ? (
        <div className="feedback bad" style={{ marginBottom: 16 }}>
          <div className="feedback-title"><Icon name="alert" size={15} /> Não foi possível iniciar</div>
          <span className="small">{error}</span>
          <div>
            <Link className="btn btn-secondary btn-sm" to="/casos">Ver biblioteca de casos</Link>
          </div>
        </div>
      ) : null}
      <div className="grid dash-split">
        <div className="card card-pad stack">
          <h2>Configurar simulado</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="sim-area">Área</label>
              <select id="sim-area" className="select" value={area} onChange={(event) => setArea(event.target.value)}>
                <option value="">Todas as áreas</option>
                {AREAS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sim-limit">Quantidade de casos</label>
              <select id="sim-limit" className="select" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={3}>3 casos (~15 questões)</option>
                <option value={5}>5 casos (~25 questões)</option>
                <option value={8}>8 casos (~40 questões)</option>
              </select>
            </div>
          </div>
          <p className="small muted">
            Os casos são sorteados entre os seus publicados e os da comunidade. Cada caso mantém sua própria pontuação, e os erros
            entram na revisão espaçada ao final.
          </p>
          <div>
            <button className="btn btn-primary btn-lg" onClick={start} disabled={starting}>
              {starting ? <Spinner /> : <Icon name="play" size={16} />}
              {starting ? 'Montando simulado…' : 'Iniciar simulado'}
            </button>
          </div>
        </div>

        <div className="card card-pad stack-sm">
          <h3>Como funciona</h3>
          {[
            { icon: 'layers', title: 'Casos em sequência', text: 'Um caso por vez, com o prontuário sempre visível.' },
            { icon: 'eye', title: 'Sem gabarito na hora', text: 'Você responde e segue; o comentário vem no final.' },
            { icon: 'chart', title: 'Resultado por caso', text: 'Acertos, tempo e os temas que precisam voltar.' },
          ].map((row) => (
            <div key={row.title} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
              <div className="file-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
                <Icon name={row.icon} size={15} />
              </div>
              <div>
                <strong className="small">{row.title}</strong>
                <div className="tiny muted">{row.text}</div>
              </div>
            </div>
          ))}
          <div className="divider" />
          <Link className="btn btn-secondary btn-sm" to="/casos">
            <Icon name="library" size={14} />
            Ver casos disponíveis
          </Link>
        </div>
      </div>
    </>
  );
}
