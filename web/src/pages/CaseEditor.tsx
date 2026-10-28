import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CaseContent } from '@shared/types';
import { AREAS } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { EmptyState, LoadingBlock, PageHeader, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';

const LETTERS = ['a', 'b', 'c', 'd', 'e'];

interface OptionDraft {
  key: string;
  text: string;
}

interface QuestionDraft {
  key: string;
  prompt: string;
  options: OptionDraft[];
  correctKey: string;
  rationale: string;
  keyPoint: string;
  sourceExcerpt: string;
  stage: number;
}

interface VitalDraft {
  key: string;
  label: string;
  value: string;
  flag: 'normal' | 'alta' | 'baixa';
}

interface ExamDraft {
  key: string;
  nome: string;
  resultado: string;
  ref: string;
}

interface Draft {
  title: string;
  area: string;
  topic: string;
  difficulty: 'facil' | 'media' | 'dificil';
  format: 'caso' | 'questao';
  minutes: number;
  publish: boolean;
  objectives: string;
  paciente: string;
  queixa: string;
  historia: string;
  antecedentes: string;
  exameFisico: string;
  imagem: string;
  vitals: VitalDraft[];
  exams: ExamDraft[];
  questions: QuestionDraft[];
  teachingPoints: string;
}

const uid = () => Math.random().toString(36).slice(2, 9);

function textToLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function newQuestion(): QuestionDraft {
  const options = ['', '', '', ''].map((text) => ({ key: uid(), text }));
  return {
    key: uid(),
    prompt: '',
    options,
    correctKey: options[0].key,
    rationale: '',
    keyPoint: '',
    sourceExcerpt: '',
    stage: 0,
  };
}

function emptyDraft(): Draft {
  return {
    title: '',
    area: AREAS[0] as string,
    topic: '',
    difficulty: 'media',
    format: 'caso',
    minutes: 8,
    publish: false,
    objectives: '',
    paciente: '',
    queixa: '',
    historia: '',
    antecedentes: '',
    exameFisico: '',
    imagem: '',
    vitals: [],
    exams: [],
    questions: [newQuestion()],
    teachingPoints: '',
  };
}

function toDraft(data: CaseContent, status: string): Draft {
  return {
    title: data.title,
    area: data.area,
    topic: data.topic,
    difficulty: data.difficulty,
    format: data.format,
    minutes: data.minutes,
    publish: status === 'publicado',
    objectives: data.objectives.join('\n'),
    paciente: data.presentation.paciente,
    queixa: data.presentation.queixa,
    historia: data.presentation.historia.join('\n'),
    antecedentes: data.presentation.antecedentes.join('\n'),
    exameFisico: data.presentation.exameFisico.join('\n'),
    imagem: data.presentation.imagem ?? '',
    vitals: data.presentation.sinaisVitais.map((v) => ({ key: uid(), label: v.label, value: v.value, flag: v.flag ?? 'normal' })),
    exams: data.presentation.exames.map((e) => ({ key: uid(), nome: e.nome, resultado: e.resultado, ref: e.ref ?? '' })),
    questions: data.questions.map((q) => {
      const options = (q.options.length >= 3 ? q.options : [...q.options, ...Array.from({ length: 3 - q.options.length }, () => ({ id: uid(), text: '' }))]).map((o) => ({
        key: uid(),
        text: o.text,
      }));
      const correctIndex = Math.max(0, q.options.findIndex((o) => o.id === q.correctOptionId));
      return {
        key: uid(),
        prompt: q.prompt,
        options,
        correctKey: options[correctIndex]?.key ?? options[0].key,
        rationale: q.rationale,
        keyPoint: q.keyPoint ?? '',
        sourceExcerpt: q.sourceExcerpt ?? '',
        stage: q.stage ?? 0,
      };
    }),
    teachingPoints: data.teachingPoints.join('\n'),
  };
}

export function CaseEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const caseId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    api.cases
      .get(caseId)
      .then(({ case: item }) => {
        if (!alive) return;
        if (!item.canEdit) {
          setLoadError('Este caso não é seu. Duplique-o para editar.');
          return;
        }
        setDraft(toDraft(item.data, item.status));
      })
      .catch((err: unknown) => {
        if (alive) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível abrir o caso.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [editing, caseId]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) =>
    setDraft((prev) => ({ ...prev, questions: prev.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) }));

  const problems = useMemo(() => {
    const list: string[] = [];
    if (draft.title.trim().length < 3) list.push('Dê um título ao caso.');
    draft.questions.forEach((question, index) => {
      const filled = question.options.filter((option) => option.text.trim());
      if (!question.prompt.trim()) list.push(`Pergunta ${index + 1} sem enunciado.`);
      if (filled.length < 3) list.push(`Pergunta ${index + 1} precisa de pelo menos 3 alternativas preenchidas.`);
      if (!filled.some((option) => option.key === question.correctKey)) list.push(`Marque a alternativa correta da pergunta ${index + 1}.`);
    });
    return list;
  }, [draft]);

  const save = async () => {
    setError(null);
    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }
    setSaving(true);
    const payload = {
      title: draft.title,
      area: draft.area,
      topic: draft.topic,
      difficulty: draft.difficulty,
      format: draft.format,
      minutes: draft.minutes,
      status: draft.publish ? 'publicado' : 'rascunho',
      objectives: textToLines(draft.objectives),
      presentation: {
        paciente: draft.paciente,
        queixa: draft.queixa,
        historia: textToLines(draft.historia),
        antecedentes: textToLines(draft.antecedentes),
        exameFisico: textToLines(draft.exameFisico),
        sinaisVitais: draft.vitals.filter((v) => v.label.trim() && v.value.trim()).map((v) => ({ label: v.label, value: v.value, flag: v.flag })),
        exames: draft.exams.filter((e) => e.nome.trim() && e.resultado.trim()).map((e) => ({ nome: e.nome, resultado: e.resultado, ref: e.ref || undefined })),
        imagem: draft.imagem.trim() || undefined,
      },
      questions: draft.questions.map((question) => {
        const options = question.options.filter((option) => option.text.trim());
        const correctIndex = Math.max(0, options.findIndex((option) => option.key === question.correctKey));
        return {
          id: `q${question.key}`,
          stage: question.stage,
          prompt: question.prompt,
          options: options.map((option, index) => ({ id: LETTERS[index], text: option.text })),
          correctOptionId: LETTERS[correctIndex],
          rationale: question.rationale,
          keyPoint: question.keyPoint || undefined,
          sourceExcerpt: question.sourceExcerpt || undefined,
        };
      }),
      teachingPoints: textToLines(draft.teachingPoints),
    };
    try {
      const result = editing ? await api.cases.update(caseId, payload) : await api.cases.create(payload);
      toast.success(editing ? 'Caso atualizado.' : 'Caso criado.');
      navigate(`/casos/${result.case.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label="Abrindo editor…" />;
  if (loadError) {
    return (
      <EmptyState
        icon="alert"
        title="Não foi possível editar"
        description={loadError}
        action={<Link className="btn btn-secondary" to="/casos">Voltar para a biblioteca</Link>}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={editing ? 'Editar caso' : 'Novo caso clínico'}
        subtitle="Monte o caso do seu jeito. Você pode começar com a apresentação, as perguntas ou importar de um material depois."
        actions={
          <>
            <Link className="btn btn-secondary" to={editing ? `/casos/${caseId}` : '/casos'}>Cancelar</Link>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : <Icon name="check" size={15} />}
              {saving ? 'Salvando…' : 'Salvar caso'}
            </button>
          </>
        }
      />

      {error ? (
        <div className="feedback bad" style={{ marginBottom: 16 }}>
          <div className="feedback-title"><Icon name="alert" size={15} /> Não foi possível salvar</div>
          <span className="small">{error}</span>
        </div>
      ) : null}

      <div className="stack">
        <section className="card card-pad stack">
          <h2>Identificação</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="case-title">Título</label>
              <input id="case-title" className="input" placeholder="Ex.: Dor torácica em homem de 58 anos" value={draft.title} onChange={(event) => update('title', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="case-area">Área</label>
              <select id="case-area" className="select" value={draft.area} onChange={(event) => update('area', event.target.value)}>
                {AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="case-topic">Tema</label>
              <input id="case-topic" className="input" placeholder="Ex.: Síndromes coronarianas agudas" value={draft.topic} onChange={(event) => update('topic', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="case-difficulty">Dificuldade</label>
              <select id="case-difficulty" className="select" value={draft.difficulty} onChange={(event) => update('difficulty', event.target.value as Draft['difficulty'])}>
                <option value="facil">Fácil</option>
                <option value="media">Média</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="case-format">Formato</label>
              <select id="case-format" className="select" value={draft.format} onChange={(event) => update('format', event.target.value as Draft['format'])}>
                <option value="caso">Caso clínico</option>
                <option value="questao">Questões</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="case-minutes">Tempo estimado (min)</label>
              <input id="case-minutes" type="number" min={2} max={60} className="input" value={draft.minutes} onChange={(event) => update('minutes', Number(event.target.value) || 5)} />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label className="switch">
                <input type="checkbox" checked={draft.publish} onChange={(event) => update('publish', event.target.checked)} />
                Publicar na biblioteca
              </label>
              <span className="hint">Publicado, o caso fica disponível para outros estudantes treinarem.</span>
            </div>
            <div className="field span-2">
              <label htmlFor="case-objectives">Objetivos de aprendizagem (um por linha)</label>
              <textarea id="case-objectives" className="textarea" style={{ minHeight: 70 }} value={draft.objectives} onChange={(event) => update('objectives', event.target.value)} placeholder="Reconhecer a apresentação típica…&#10;Definir a conduta inicial…" />
            </div>
          </div>
        </section>

        <section className="card card-pad stack">
          <div className="row between">
            <h2>Apresentação do caso</h2>
            <span className="tiny muted">um item por linha</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="case-patient">Paciente</label>
              <input id="case-patient" className="input" placeholder="Mulher de 34 anos, professora" value={draft.paciente} onChange={(event) => update('paciente', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="case-complaint">Queixa principal</label>
              <input id="case-complaint" className="input" placeholder="Cefaleia há 2 dias" value={draft.queixa} onChange={(event) => update('queixa', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="case-history">História</label>
              <textarea id="case-history" className="textarea" value={draft.historia} onChange={(event) => update('historia', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="case-background">Antecedentes</label>
              <textarea id="case-background" className="textarea" value={draft.antecedentes} onChange={(event) => update('antecedentes', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="case-exam">Exame físico</label>
              <textarea id="case-exam" className="textarea" value={draft.exameFisico} onChange={(event) => update('exameFisico', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="case-image">Imagem / traçado (opcional)</label>
              <textarea id="case-image" className="textarea" placeholder="Descrição textual de ECG, radiografia…" value={draft.imagem} onChange={(event) => update('imagem', event.target.value)} />
            </div>
          </div>

          <div className="divider" />
          <div className="row between">
            <h3>Sinais vitais</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => update('vitals', [...draft.vitals, { key: uid(), label: '', value: '', flag: 'normal' }])}>
              <Icon name="plus" size={13} /> Adicionar
            </button>
          </div>
          {draft.vitals.length === 0 ? <p className="tiny muted">Opcional. Ex.: PA 150/95 mmHg, FC 98 bpm.</p> : null}
          {draft.vitals.map((vital) => (
            <div key={vital.key} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input className="input" style={{ width: 120 }} placeholder="PA" value={vital.label} onChange={(event) => update('vitals', draft.vitals.map((v) => (v.key === vital.key ? { ...v, label: event.target.value } : v)))} />
              <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="150/95 mmHg" value={vital.value} onChange={(event) => update('vitals', draft.vitals.map((v) => (v.key === vital.key ? { ...v, value: event.target.value } : v)))} />
              <select className="select" style={{ width: 130 }} value={vital.flag} onChange={(event) => update('vitals', draft.vitals.map((v) => (v.key === vital.key ? { ...v, flag: event.target.value as VitalDraft['flag'] } : v)))}>
                <option value="normal">Normal</option>
                <option value="alta">Alterado ↑</option>
                <option value="baixa">Alterado ↓</option>
              </select>
              <button className="icon-btn" onClick={() => update('vitals', draft.vitals.filter((v) => v.key !== vital.key))} aria-label="Remover sinal vital">
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}

          <div className="divider" />
          <div className="row between">
            <h3>Exames complementares</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => update('exams', [...draft.exams, { key: uid(), nome: '', resultado: '', ref: '' }])}>
              <Icon name="plus" size={13} /> Adicionar
            </button>
          </div>
          {draft.exams.length === 0 ? <p className="tiny muted">Opcional. Ex.: Troponina 0,8 ng/mL (ref &lt; 0,04).</p> : null}
          {draft.exams.map((exam) => (
            <div key={exam.key} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input className="input" style={{ width: 170 }} placeholder="Exame" value={exam.nome} onChange={(event) => update('exams', draft.exams.map((e) => (e.key === exam.key ? { ...e, nome: event.target.value } : e)))} />
              <input className="input" style={{ flex: 1, minWidth: 150 }} placeholder="Resultado" value={exam.resultado} onChange={(event) => update('exams', draft.exams.map((e) => (e.key === exam.key ? { ...e, resultado: event.target.value } : e)))} />
              <input className="input" style={{ width: 150 }} placeholder="Referência" value={exam.ref} onChange={(event) => update('exams', draft.exams.map((e) => (e.key === exam.key ? { ...e, ref: event.target.value } : e)))} />
              <button className="icon-btn" onClick={() => update('exams', draft.exams.filter((e) => e.key !== exam.key))} aria-label="Remover exame">
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
        </section>

        <section className="stack">
          <div className="row between">
            <h2>Perguntas ({draft.questions.length})</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => update('questions', [...draft.questions, newQuestion()])}>
              <Icon name="plus" size={13} /> Adicionar pergunta
            </button>
          </div>

          {draft.questions.map((question, qIndex) => (
            <div key={question.key} className="card card-pad stack">
              <div className="row between">
                <h3>Pergunta {qIndex + 1}</h3>
                <div className="row" style={{ gap: 8 }}>
                  <select
                    className="select"
                    style={{ width: 190 }}
                    value={question.stage}
                    onChange={(event) => updateQuestion(question.key, { stage: Number(event.target.value) })}
                    aria-label="Momento do caso"
                  >
                    <option value={0}>Apresentação inicial</option>
                    <option value={1}>Investigação</option>
                    <option value={2}>Diagnóstico / evolução</option>
                    <option value={3}>Conduta</option>
                  </select>
                  <button
                    className="icon-btn"
                    onClick={() => update('questions', draft.questions.filter((q) => q.key !== question.key))}
                    aria-label="Remover pergunta"
                    disabled={draft.questions.length === 1}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Enunciado</label>
                <textarea
                  className="textarea"
                  value={question.prompt}
                  onChange={(event) => updateQuestion(question.key, { prompt: event.target.value })}
                  placeholder="Qual é a hipótese diagnóstica e a conduta imediata?"
                />
              </div>

              <div className="field">
                <span className="label">Alternativas</span>
                <div className="stack-sm">
                  {question.options.map((option, oIndex) => (
                    <div key={option.key} className="row" style={{ gap: 8 }}>
                      <input
                        type="radio"
                        name={`correct-${question.key}`}
                        checked={question.correctKey === option.key}
                        onChange={() => updateQuestion(question.key, { correctKey: option.key })}
                        aria-label={`Marcar alternativa ${LETTERS[oIndex]} como correta`}
                        style={{ accentColor: 'var(--brand)', width: 16, height: 16, flex: 'none' }}
                      />
                      <span className="option-key" style={{ width: 24, height: 24 }}>{LETTERS[oIndex]}</span>
                      <input
                        className="input"
                        placeholder={`Alternativa ${LETTERS[oIndex].toUpperCase()}`}
                        value={option.text}
                        onChange={(event) =>
                          updateQuestion(question.key, {
                            options: question.options.map((o) => (o.key === option.key ? { ...o, text: event.target.value } : o)),
                          })
                        }
                      />
                      <button
                        className="icon-btn"
                        onClick={() => {
                          if (question.options.length <= 3) return;
                          const remaining = question.options.filter((o) => o.key !== option.key);
                          updateQuestion(question.key, {
                            options: remaining,
                            correctKey: question.correctKey === option.key ? remaining[0].key : question.correctKey,
                          });
                        }}
                        aria-label="Remover alternativa"
                        disabled={question.options.length <= 3}
                      >
                        <Icon name="close" size={15} />
                      </button>
                    </div>
                  ))}
                  {question.options.length < 5 ? (
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => updateQuestion(question.key, { options: [...question.options, { key: uid(), text: '' }] })}>
                      <Icon name="plus" size={13} /> Adicionar alternativa
                    </button>
                  ) : null}
                </div>
                <span className="hint">A bolinha marca a alternativa correta. Você precisa de 3 a 5 alternativas.</span>
              </div>

              <div className="form-grid">
                <div className="field span-2">
                  <label>Justificativa (aparece após a resposta)</label>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 80 }}
                    value={question.rationale}
                    onChange={(event) => updateQuestion(question.key, { rationale: event.target.value })}
                    placeholder="Explique por que a correta está certa e por que as outras estão erradas."
                  />
                </div>
                <div className="field">
                  <label>Ponto-chave (opcional)</label>
                  <input className="input" value={question.keyPoint} onChange={(event) => updateQuestion(question.key, { keyPoint: event.target.value })} placeholder="Ex.: ECG em até 10 minutos." />
                </div>
                <div className="field">
                  <label>Trecho da fonte (opcional)</label>
                  <input className="input" value={question.sourceExcerpt} onChange={(event) => updateQuestion(question.key, { sourceExcerpt: event.target.value })} placeholder="Trecho literal do material" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="card card-pad stack">
          <h2>Pontos-chave do caso</h2>
          <div className="field">
            <label htmlFor="case-teaching">Um ponto por linha</label>
            <textarea id="case-teaching" className="textarea" value={draft.teachingPoints} onChange={(event) => update('teachingPoints', event.target.value)} placeholder="O que o aluno deve levar deste caso…" />
          </div>
        </section>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <Link className="btn btn-secondary" to={editing ? `/casos/${caseId}` : '/casos'}>Cancelar</Link>
          <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : <Icon name="check" size={16} />}
            Salvar caso
          </button>
        </div>
      </div>
    </>
  );
}
