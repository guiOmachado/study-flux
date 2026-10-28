import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AttemptDTO, StatsDTO } from '@shared/types';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { accuracyTone, formatShortDate, relativeDate } from '../lib/format';
import { EmptyState, LoadingBlock, PageHeader, SectionCard, StatCard } from '../components/ui';
import { Icon } from '../components/Icon';

const MODE_LABEL: Record<string, string> = {
  treino: 'Treino',
  simulado: 'Simulado',
  revisao: 'Revisão',
};

export function ProgressPage() {
  const stats = useFetch<StatsDTO>(() => api.stats.get(), []);
  const attempts = useFetch(() => api.attempts.list(30), []);

  if (stats.loading) return <LoadingBlock label="Calculando seu progresso…" />;
  if (stats.error || !stats.data) {
    return (
      <EmptyState
        icon="alert"
        title="Não foi possível carregar o progresso"
        description={stats.error ?? 'Tente novamente.'}
        action={<button className="btn btn-secondary" onClick={stats.reload}>Tentar novamente</button>}
      />
    );
  }

  const data = stats.data;
  const maxDaily = Math.max(1, ...data.daily.map((day) => day.answered));
  const noData = data.totals.questionsAnswered === 0;
  const history = attempts.data?.attempts ?? [];

  return (
    <>
      <PageHeader
        title="Seu progresso"
        subtitle="O que já está sólido, o que precisa voltar e como está sua constância."
        actions={
          <>
            <a className="btn btn-secondary" href={api.stats.exportUrl()}>
              <Icon name="download" size={15} />
              Exportar CSV
            </a>
            <Link className="btn btn-primary" to="/simulado">
              <Icon name="play" size={15} />
              Novo simulado
            </Link>
          </>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Questões respondidas" value={data.totals.questionsAnswered} foot={`${data.totals.casesSolved} casos concluídos`} />
        <StatCard label="Acerto geral" value={`${data.totals.accuracy}%`} foot={`tempo médio ${data.totals.avgTimeSec ? `${data.totals.avgTimeSec}s` : '—'}`} />
        <StatCard label="Sequência atual" value={`${data.totals.streak} d`} foot="dias com estudo" />
        <StatCard label="Revisões pendentes" value={data.totals.dueCards} foot={data.totals.dueCards > 0 ? 'comece por elas' : 'revisão em dia'} />
      </div>

      {noData ? (
        <EmptyState
          icon="chart"
          title="Ainda sem dados suficientes"
          description="Assim que você responder questões, esta página mostra desempenho por área, temas frágeis e histórico de treinos."
          action={<Link className="btn btn-primary" to="/casos">Começar a treinar</Link>}
        />
      ) : (
        <>
          <div className="grid dash-split" style={{ marginBottom: 18 }}>
            <SectionCard title="Constância" action={<span className="tiny muted">últimos 14 dias</span>}>
              <div className="chart">
                {data.daily.map((day) => {
                  const height = day.answered === 0 ? 3 : Math.max(8, Math.round((day.answered / maxDaily) * 100));
                  return (
                    <div className="chart-col" key={day.date} title={`${formatShortDate(day.date)}: ${day.answered} questões, ${day.correct} acertos`}>
                      <div className={`chart-bar${day.answered === 0 ? ' empty' : ''}`} style={{ height: `${height}%` }} />
                      <span className="chart-x">{formatShortDate(day.date)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="divider" />
              <div className="row between small">
                <span className="muted">Meta diária</span>
                <strong>{data.goal.doneToday} / {data.goal.target}</strong>
              </div>
              <div className="progress" style={{ marginTop: 8 }}>
                <span style={{ width: `${Math.min(100, Math.round((data.goal.doneToday / Math.max(1, data.goal.target)) * 100))}%` }} />
              </div>
            </SectionCard>

            <SectionCard title="Desempenho por área" action={<span className="tiny muted">% de acerto</span>}>
              <div className="stack">
                {data.byArea.length === 0 ? <p className="small muted">Sem respostas por área ainda.</p> : null}
                {data.byArea.map((area) => (
                  <div key={area.area} className="stack-sm">
                    <div className="row between small">
                      <span style={{ fontWeight: 600 }}>{area.area}</span>
                      <span className={`badge ${accuracyTone(area.accuracy)}`}>{area.accuracy}%</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${area.accuracy}%` }} />
                    </div>
                    <span className="tiny muted">{area.answered} questões · {area.correct} acertos</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            <SectionCard title="Precisa reforçar" action={<span className="tiny muted">até 75% de acerto</span>}>
              {data.weakTopics.length === 0 ? (
                <p className="small muted">Nenhum tema frágil identificado. Continue treinando para confirmar.</p>
              ) : (
                <div className="stack-sm">
                  {data.weakTopics.map((topic) => (
                    <div key={`${topic.area}-${topic.topic}`} className="row between" style={{ gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="small" style={{ fontWeight: 600 }}>{topic.topic}</div>
                        <div className="tiny muted">{topic.area} · {topic.answered} questões</div>
                      </div>
                      <span className={`badge ${accuracyTone(topic.accuracy)}`}>{topic.accuracy}%</span>
                    </div>
                  ))}
                  <Link className="btn btn-secondary btn-sm" to="/simulado" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                    Montar simulado destes temas
                  </Link>
                </div>
              )}
            </SectionCard>
            <SectionCard title="Pontos fortes" action={<span className="tiny muted">acima de 75%</span>}>
              {data.strongTopics.length === 0 ? (
                <p className="small muted">Ainda não há temas com desempenho consistente. É normal no começo.</p>
              ) : (
                <div className="stack-sm">
                  {data.strongTopics.map((topic) => (
                    <div key={`${topic.area}-${topic.topic}`} className="row between" style={{ gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="small" style={{ fontWeight: 600 }}>{topic.topic}</div>
                        <div className="tiny muted">{topic.area} · {topic.answered} questões</div>
                      </div>
                      <span className={`badge ${accuracyTone(topic.accuracy)}`}>{topic.accuracy}%</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Histórico de treinos</h3>
          <span className="tiny muted">{history.length} registros</span>
        </div>
        <div className="card-body">
          {attempts.loading ? <LoadingBlock label="Carregando histórico…" /> : null}
          {!attempts.loading && history.length === 0 ? <p className="small muted">Nenhum treino concluído ainda.</p> : null}
          {!attempts.loading ? (
            <div className="stack-sm">
              {history.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function AttemptRow({ attempt }: { attempt: AttemptDTO }) {
  const [open, setOpen] = useState(false);
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const minutes = attempt.durationMs ? Math.round(attempt.durationMs / 60000) : null;
  return (
    <div style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: 8 }}>
      <button
        className="row between"
        style={{ width: '100%', background: 'transparent', border: 0, padding: '6px 0', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
        onClick={() => setOpen((value) => !value)}
      >
        <div style={{ minWidth: 0 }}>
          <div className="small" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attempt.caseTitle}
          </div>
          <div className="tiny muted">
            {relativeDate(attempt.finishedAt ?? attempt.startedAt)} · {attempt.area} · {MODE_LABEL[attempt.mode] ?? attempt.mode}
            {minutes !== null ? ` · ${minutes} min` : ''}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`badge ${attempt.status === 'concluido' ? accuracyTone(pct) : 'badge-warn'}`}>
            {attempt.score}/{attempt.total}
          </span>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} style={{ color: 'var(--muted)' }} />
        </div>
      </button>
      {open ? (
        <div className="stack-sm" style={{ padding: '6px 0 4px' }}>
          {attempt.caseId ? (
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn btn-secondary btn-sm" to={`/casos/${attempt.caseId}`}>
                <Icon name="eye" size={13} /> Ver caso
              </Link>
              <Link className="btn btn-ghost btn-sm" to={`/treinar/${attempt.caseId}`}>
                <Icon name="refresh" size={13} /> Refazer
              </Link>
            </div>
          ) : null}
          {attempt.results.map((result, index) => (
            <div key={`${result.questionId}-${index}`} className="small" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span className={`badge ${result.correct ? 'badge-success' : 'badge-danger'}`} style={{ flex: 'none' }}>
                {result.correct ? '✓' : '✕'}
              </span>
              <span style={{ color: 'var(--ink-2)' }}>{result.prompt}</span>
            </div>
          ))}
          {attempt.results.length === 0 ? <span className="tiny muted">Sem respostas registradas.</span> : null}
        </div>
      ) : null}
    </div>
  );
}
