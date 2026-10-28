import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SrsCardDTO, SrsGrade } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { formatDate, relativeDate } from '../lib/format';
import { EmptyState, LoadingBlock, PageHeader, ProgressRing, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';

const GRADES: { grade: SrsGrade; label: string; hint: string; tone: string }[] = [
  { grade: 'errei', label: 'Errei', hint: 'volta amanhã', tone: 'btn-danger-ghost' },
  { grade: 'dificil', label: 'Difícil', hint: 'intervalo curto', tone: 'btn-secondary' },
  { grade: 'bom', label: 'Bom', hint: 'intervalo médio', tone: 'btn-secondary' },
  { grade: 'facil', label: 'Fácil', hint: 'intervalo longo', tone: 'btn-primary' },
];

export function ReviewPage() {
  const { data, loading, error, reload } = useFetch(() => api.srs.list(), []);
  const [queue, setQueue] = useState<SrsCardDTO[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<SrsGrade, number>>({ errei: 0, dificil: 0, bom: 0, facil: 0 });
  const toast = useToast();

  if (loading) return <LoadingBlock label="Carregando revisão…" />;
  if (error || !data) {
    return (
      <EmptyState
        icon="alert"
        title="Não foi possível carregar a revisão"
        description={error ?? 'Tente novamente.'}
        action={<button className="btn btn-secondary" onClick={reload}>Tentar novamente</button>}
      />
    );
  }

  const now = Date.now();
  const due = data.cards.filter((card) => new Date(card.dueAt).getTime() <= now);
  const upcoming = data.cards
    .filter((card) => new Date(card.dueAt).getTime() > now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 6);

  const activeQueue = queue ?? due;
  const card = activeQueue[index];
  const finished = queue !== null && index >= activeQueue.length;
  const totalStart = activeQueue.length;

  const grade = async (value: SrsGrade) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await api.srs.review(card.id, value);
      if (queue === null) setQueue(due);
      window.dispatchEvent(new Event('sf:srs-changed'));
      setCounts((prev) => ({ ...prev, [value]: prev[value] + 1 }));
      setRevealed(false);
      setIndex((prev) => prev + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar a revisão.');
    } finally {
      setBusy(false);
    }
  };

  if (finished) {
    const reviewed = totalStart;
    const hits = counts.bom + counts.facil;
    return (
      <>
        <PageHeader title="Revisão concluída" subtitle="A repetição espaçada distribui as próximas revisões conforme sua memória." />
        <div className="card card-pad" style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto' }}>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 14 }}>
            <ProgressRing value={reviewed ? Math.round((hits / reviewed) * 100) : 0} size={108} stroke={9} />
          </div>
          <h2>{reviewed} cards revisados</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            {counts.errei > 0 ? `${counts.errei} voltam amanhã para reforço. ` : ''}
            {counts.facil > 0 ? `${counts.facil} vão demorar mais para reaparecer. ` : ''}
            O importante é a constância — volte amanhã.
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <Link className="btn btn-secondary" to="/casos">Treinar novos casos</Link>
            <Link className="btn btn-primary" to="/">Voltar ao início</Link>
          </div>
        </div>
      </>
    );
  }

  if (card) {
    const progress = totalStart ? Math.round((index / totalStart) * 100) : 0;
    return (
      <div className="train-shell">
        <div className="train-head">
          <Link className="icon-btn" to="/" aria-label="Sair da revisão">
            <Icon name="close" size={19} />
          </Link>
          <div className="train-progress">
            <div className="row">
              <span>{index + 1} de {totalStart} cards</span>
              <span className="tiny muted">{card.area ?? ''}{card.topic ? ` · ${card.topic}` : ''}</span>
            </div>
            <div className="progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="flashcard" onClick={() => setRevealed(true)} role="button" tabIndex={0} onKeyDown={(event) => event.key === ' ' && setRevealed(true)}>
          <span className="badge badge-brand" style={{ alignSelf: 'center' }}>Pergunta</span>
          <div className="front">{card.front}</div>
          {revealed ? (
            <div className="back">{card.back}</div>
          ) : (
            <span className="tiny muted">Clique no card (ou pressione espaço) para ver a resposta</span>
          )}
          {card.caseTitle ? <span className="tiny muted">Caso: {card.caseTitle}</span> : null}
        </div>

        {revealed ? (
          <div className="stack-sm" style={{ marginTop: 16 }}>
            <span className="tiny muted" style={{ textAlign: 'center' }}>Como foi lembrar desta resposta?</span>
            <div className="grade-grid">
              {GRADES.map((option) => (
                <button key={option.grade} className={`btn ${option.tone}`} onClick={() => grade(option.grade)} disabled={busy}>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span>{option.label}</span>
                    <span className="tiny" style={{ opacity: 0.7, fontWeight: 500 }}>{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {busy ? <div className="row" style={{ justifyContent: 'center' }}><Spinner dark /></div> : null}
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setRevealed(true)}>
              <Icon name="eye" size={15} />
              Ver resposta
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Revisão espaçada"
        subtitle="As questões que você errou voltam em intervalos crescentes — o mesmo princípio de um bom caderno de erros, sem trabalho manual."
        actions={<Link className="btn btn-secondary" to="/casos"><Icon name="play" size={15} />Treinar casos</Link>}
      />
      <div className="grid dash-split">
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
            <ProgressRing value={0} size={100} stroke={9} label="0" />
          </div>
          <h2>Nenhum card vencido agora</h2>
          <p className="small muted" style={{ maxWidth: 380, margin: '6px auto 0' }}>
            {data.cards.length === 0
              ? 'Ao errar uma questão, ela entra automaticamente na revisão. Você também pode criar cards ao abrir um caso.'
              : `Você tem ${data.cards.length} cards na revisão. O próximo vence ${relativeDate(upcoming[0]?.dueAt)}.`}
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Link className="btn btn-secondary" to="/casos">Escolher um caso</Link>
            {data.cards.length > 0 ? (
              <button className="btn btn-ghost" onClick={() => { setQueue(data.cards); setIndex(0); setRevealed(false); }}>
                Revisar tudo agora
              </button>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Próximos cards</h3>
            <span className="tiny muted">{data.cards.length} no total</span>
          </div>
          <div className="card-body stack-sm">
            {upcoming.length === 0 ? (
              <p className="small muted">Sem cards agendados. Eles aparecem quando você erra questões ou cria cards de um caso.</p>
            ) : (
              upcoming.map((item) => (
                <div key={item.id} className="row between" style={{ gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                      {item.caseTitle ?? item.topic ?? 'Card'}
                    </div>
                    <div className="tiny muted">{item.area} · {formatDate(item.dueAt)}</div>
                  </div>
                  <span className="badge badge-neutral">{item.intervalDays}d</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
