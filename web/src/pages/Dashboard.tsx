import { Link } from 'react-router-dom';
import type { SettingsDTO, StatsDTO } from '@shared/types';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { accuracyTone, formatShortDate, plural, relativeDate } from '../lib/format';
import { EmptyState, LoadingBlock, ProgressRing, SectionCard, StatCard } from '../components/ui';
import { Icon } from '../components/Icon';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

export function DashboardPage() {
  const { user } = useAuth();
  const stats = useFetch<StatsDTO>(() => api.stats.get(), []);
  const settings = useFetch<SettingsDTO>(() => api.settings.get(), []);

  if (stats.loading) return <LoadingBlock label="Preparando seu painel…" />;
  if (stats.error || !stats.data) {
    return (
      <EmptyState
        icon="alert"
        title="Não foi possível carregar o painel"
        description={stats.error ?? 'Tente novamente.'}
        action={<button className="btn btn-secondary" onClick={stats.reload}>Tentar novamente</button>}
      />
    );
  }

  const data = stats.data;
  const target = data.goal.target || 20;
  const goalPct = Math.min(100, Math.round((data.goal.doneToday / target) * 100));
  const examDays = daysUntil(settings.data?.examDate ?? null);
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.answered));
  const firstName = user?.name?.split(' ')[0] ?? 'estudante';
  const isEmpty = data.totals.questionsAnswered === 0 && data.totals.materials === 0;

  return (
    <>
      <div className="hero">
        <div>
          <h1>
            {greeting()}, {firstName}.
          </h1>
          <p>
            {examDays !== null && examDays >= 0
              ? `Faltam ${plural(examDays, 'dia', 'dias')} para a sua prova. `
              : ''}
            {data.totals.dueCards > 0
              ? `Você tem ${plural(data.totals.dueCards, 'card', 'cards')} de revisão esperando — começar por eles rende mais.`
              : 'Treine com casos clínicos ou envie um novo material para ampliar seu banco de questões.'}
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/simulado">
              <Icon name="play" size={15} />
              Montar simulado
            </Link>
            <Link className="btn btn-secondary" to="/materiais">
              <Icon name="upload" size={15} />
              Enviar material
            </Link>
            {data.totals.dueCards > 0 ? (
              <Link className="btn btn-ghost" to="/revisao">
                Revisar {data.totals.dueCards}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="hero-ring">
          <ProgressRing value={goalPct} size={82} />
          <div>
            <div className="tiny muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Meta diária
            </div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {data.goal.doneToday} de {target} questões
            </div>
            <div className="tiny muted">{goalPct >= 100 ? 'Meta batida. Bom trabalho!' : 'Cada questão conta.'}</div>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="card card-pad" style={{ marginBottom: 18, background: 'linear-gradient(180deg,#ffffff,#f8fcfb)' }}>
          <div className="row between" style={{ alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 560 }}>
              <span className="badge badge-brand" style={{ marginBottom: 8 }}>Comece por aqui</span>
              <h2>Três passos para transformar seu material em treino</h2>
              <p className="small muted" style={{ marginTop: 6 }}>
                Você pode subir uma prova antiga, um capítulo de livro ou um resumo. O Study Flux identifica os temas, monta casos
                e guarda o que você errou para revisar depois.
              </p>
            </div>
            <div className="stack-sm" style={{ minWidth: 0, flex: 1, maxWidth: 420 }}>
              {[
                { icon: 'upload', title: '1. Envie o material', text: 'PDF, DOCX, texto colado ou prova com gabarito.' },
                { icon: 'sparkles', title: '2. Gere os casos', text: 'Modo estruturado (sem IA) ou caso clínico completo com IA.' },
                { icon: 'play', title: '3. Treine e revisar', text: 'Feedback imediato com o trecho do material na justificativa.' },
              ].map((step) => (
                <div key={step.title} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div className="file-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
                    <Icon name={step.icon} size={15} />
                  </div>
                  <div>
                    <strong className="small">{step.title}</strong>
                    <div className="tiny muted">{step.text}</div>
                  </div>
                </div>
              ))}
              <Link className="btn btn-primary btn-sm" to="/materiais" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                Enviar meu primeiro material
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Casos concluídos" value={data.totals.casesSolved} foot={`${data.totals.publishedCases} casos publicados`} />
        <StatCard label="Questões respondidas" value={data.totals.questionsAnswered} foot={`${data.byArea.length} áreas treinadas`} />
        <StatCard
          label="Acerto geral"
          value={`${data.totals.accuracy}%`}
          foot={
            <span className={`badge ${accuracyTone(data.totals.accuracy)}`} style={{ marginTop: 2 }}>
              {data.totals.accuracy >= 80 ? 'Muito bom' : data.totals.accuracy >= 60 ? 'Evoluindo' : 'Atenção'}
            </span>
          }
        />
        <StatCard label="Sequência" value={`${data.totals.streak} d`} foot={`${data.totals.dueCards} cards para revisar`} />
      </div>

      <div className="grid dash-split" style={{ marginBottom: 18 }}>
        <SectionCard
          title="Atividade dos últimos 14 dias"
          action={<span className="tiny muted">questões por dia</span>}
        >
          {data.totals.questionsAnswered === 0 ? (
            <p className="small muted" style={{ padding: '18px 0' }}>
              Sem respostas ainda. Assim que você treinar, o gráfico mostra sua constância.
            </p>
          ) : (
            <>
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
                <span className="muted">Total no período</span>
                <strong>{data.daily.reduce((acc, d) => acc + d.answered, 0)} questões</strong>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Revisão de hoje" action={data.totals.dueCards > 0 ? <span className="badge badge-warn">{data.totals.dueCards}</span> : null}>
          {data.totals.dueCards > 0 ? (
            <>
              <p className="small muted" style={{ marginBottom: 14 }}>
                Cards de questões que você errou ou marcou como difíceis. Revisar agora é o que consolida a memória.
              </p>
              <Link className="btn btn-primary btn-block" to="/revisao">
                <Icon name="layers" size={15} />
                Revisar {data.totals.dueCards} cards
              </Link>
            </>
          ) : (
            <div className="stack-sm">
              <div className="row" style={{ gap: 10 }}>
                <div className="file-icon" style={{ width: 34, height: 34, borderRadius: 10 }}>
                  <Icon name="check" size={16} />
                </div>
                <div>
                  <strong className="small">Revisão em dia</strong>
                  <div className="tiny muted">Nenhum card vencido agora.</div>
                </div>
              </div>
              <Link className="btn btn-secondary btn-sm" to="/casos" style={{ alignSelf: 'flex-start' }}>
                Praticar mais casos
              </Link>
            </div>
          )}
          <div className="divider" />
          <div className="row between small">
            <span className="muted">Tempo médio por questão</span>
            <strong>{data.totals.avgTimeSec > 0 ? `${data.totals.avgTimeSec}s` : '—'}</strong>
          </div>
          <div className="row between small" style={{ marginTop: 6 }}>
            <span className="muted">Materiais enviados</span>
            <strong>{data.totals.materials}</strong>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <SectionCard title="Pontos para reforçar" action={<span className="tiny muted">acerto abaixo de 75%</span>}>
          {data.weakTopics.length === 0 ? (
            <p className="small muted">
              {data.byArea.length === 0
                ? 'Responda algumas questões para identificar seus temas mais frágeis.'
                : 'Nenhum tema frágil identificado ainda. Continue treinando para consolidar.'}
            </p>
          ) : (
            <div className="stack">
              {data.weakTopics.map((topic) => (
                <div key={`${topic.area}-${topic.topic}`} className="stack-sm">
                  <div className="row between">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{topic.topic}</div>
                      <div className="tiny muted">{topic.area} · {plural(topic.answered, 'questão', 'questões')}</div>
                    </div>
                    <span className={`badge ${accuracyTone(topic.accuracy)}`}>{topic.accuracy}%</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${topic.accuracy}%` }} />
                  </div>
                </div>
              ))}
              <Link className="btn btn-secondary btn-sm" to="/simulado" style={{ alignSelf: 'flex-start' }}>
                Treinar estes temas
              </Link>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Últimos treinos" action={<Link className="tiny" to="/progresso">ver histórico</Link>}>
          {data.recentAttempts.length === 0 ? (
            <p className="small muted">Nenhum treino concluído ainda. Escolha um caso da biblioteca para começar.</p>
          ) : (
            <div className="stack-sm">
              {data.recentAttempts.map((attempt) => {
                const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
                return (
                  <Link
                    key={attempt.id}
                    to={attempt.caseId ? `/casos/${attempt.caseId}` : '/progresso'}
                    className="row between"
                    style={{ textDecoration: 'none', color: 'inherit', padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {attempt.caseTitle}
                      </div>
                      <div className="tiny muted">
                        {attempt.area} · {relativeDate(attempt.finishedAt ?? attempt.startedAt)}
                      </div>
                    </div>
                    <span className={`badge ${accuracyTone(pct)}`}>{attempt.score}/{attempt.total}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
