import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AREAS } from '@shared/types';
import type { CaseContent } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { ToastService } from '../core/toast';
import { EmptyState, LoadingBlock, PageHeader } from '../shared/ui';
import { Icon } from '../shared/icon';

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
    vitals: data.presentation.sinaisVitais.map((vital) => ({ key: uid(), label: vital.label, value: vital.value, flag: vital.flag ?? 'normal' })),
    exams: data.presentation.exames.map((exam) => ({ key: uid(), nome: exam.nome, resultado: exam.resultado, ref: exam.ref ?? '' })),
    questions: data.questions.map((question) => {
      const source =
        question.options.length >= 3
          ? question.options
          : [...question.options, ...Array.from({ length: 3 - question.options.length }, () => ({ id: uid(), text: '' }))];
      const options = source.map((option) => ({ key: uid(), text: option.text }));
      const correctIndex = Math.max(0, question.options.findIndex((option) => option.id === question.correctOptionId));
      return {
        key: uid(),
        prompt: question.prompt,
        options,
        correctKey: options[correctIndex]?.key ?? options[0].key,
        rationale: question.rationale,
        keyPoint: question.keyPoint ?? '',
        sourceExcerpt: question.sourceExcerpt ?? '',
        stage: question.stage ?? 0,
      };
    }),
    teachingPoints: data.teachingPoints.join('\n'),
  };
}

@Component({
  selector: 'sf-case-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, EmptyState, LoadingBlock, PageHeader],
  template: `
    @if (loading()) {
      <sf-loading label="Abrindo editor…" />
    } @else if (loadError()) {
      <sf-empty icon="alert" title="Não foi possível editar" [description]="loadError()!">
        <a class="btn btn-secondary" routerLink="/casos">Voltar para a biblioteca</a>
      </sf-empty>
    } @else {
      <sf-page-header
        [title]="editing ? 'Editar caso' : 'Novo caso clínico'"
        subtitle="Monte o caso do seu jeito. Você pode começar com a apresentação, as perguntas ou importar de um material depois."
      >
        <a actions class="btn btn-secondary" [routerLink]="editing ? '/casos/' + caseId : '/casos'">Cancelar</a>
        <button actions class="btn btn-primary" type="button" (click)="save()" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner" aria-hidden="true"></span>
            Salvando…
          } @else {
            <sf-icon name="check" [size]="15" />
            Salvar caso
          }
        </button>
      </sf-page-header>

      @if (error()) {
        <div class="feedback bad" style="margin-bottom: 16px">
          <div class="feedback-title">
            <sf-icon name="alert" [size]="15" />
            Não foi possível salvar
          </div>
          <span class="small">{{ error() }}</span>
        </div>
      }

      @let draft = value();

      <div class="stack">
        <section class="card card-pad stack">
          <h2>Identificação</h2>
          <div class="form-grid">
            <div class="field span-2">
              <label for="case-title">Título</label>
              <input
                id="case-title"
                class="input"
                placeholder="Ex.: Dor torácica em homem de 58 anos"
                [ngModel]="draft.title"
                (ngModelChange)="set('title', $event)"
              />
            </div>
            <div class="field">
              <label for="case-area">Área</label>
              <select id="case-area" class="select" [ngModel]="draft.area" (ngModelChange)="set('area', $event)">
                @for (area of areas; track area) {
                  <option [value]="area">{{ area }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="case-topic">Tema</label>
              <input
                id="case-topic"
                class="input"
                placeholder="Ex.: Síndromes coronarianas agudas"
                [ngModel]="draft.topic"
                (ngModelChange)="set('topic', $event)"
              />
            </div>
            <div class="field">
              <label for="case-difficulty">Dificuldade</label>
              <select id="case-difficulty" class="select" [ngModel]="draft.difficulty" (ngModelChange)="set('difficulty', $event)">
                <option value="facil">Fácil</option>
                <option value="media">Média</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
            <div class="field">
              <label for="case-format">Formato</label>
              <select id="case-format" class="select" [ngModel]="draft.format" (ngModelChange)="set('format', $event)">
                <option value="caso">Caso clínico</option>
                <option value="questao">Questões</option>
              </select>
            </div>
            <div class="field">
              <label for="case-minutes">Tempo estimado (min)</label>
              <input
                id="case-minutes"
                type="number"
                min="2"
                max="60"
                class="input"
                [ngModel]="draft.minutes"
                (ngModelChange)="set('minutes', num($event) || 5)"
              />
            </div>
            <div class="field" style="justify-content: flex-end">
              <label class="switch">
                <input type="checkbox" [ngModel]="draft.publish" (ngModelChange)="set('publish', $event)" />
                Publicar na biblioteca
              </label>
              <span class="hint">Publicado, o caso fica disponível para outros estudantes treinarem.</span>
            </div>
            <div class="field span-2">
              <label for="case-objectives">Objetivos de aprendizagem (um por linha)</label>
              <textarea
                id="case-objectives"
                class="textarea"
                style="min-height: 70px"
                placeholder="Reconhecer a apresentação típica…&#10;Definir a conduta inicial…"
                [ngModel]="draft.objectives"
                (ngModelChange)="set('objectives', $event)"
              ></textarea>
            </div>
          </div>
        </section>

        <section class="card card-pad stack">
          <div class="row between">
            <h2>Apresentação do caso</h2>
            <span class="tiny muted">um item por linha</span>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="case-patient">Paciente</label>
              <input
                id="case-patient"
                class="input"
                placeholder="Mulher de 34 anos, professora"
                [ngModel]="draft.paciente"
                (ngModelChange)="set('paciente', $event)"
              />
            </div>
            <div class="field">
              <label for="case-complaint">Queixa principal</label>
              <input
                id="case-complaint"
                class="input"
                placeholder="Cefaleia há 2 dias"
                [ngModel]="draft.queixa"
                (ngModelChange)="set('queixa', $event)"
              />
            </div>
            <div class="field">
              <label for="case-history">História</label>
              <textarea id="case-history" class="textarea" [ngModel]="draft.historia" (ngModelChange)="set('historia', $event)"></textarea>
            </div>
            <div class="field">
              <label for="case-background">Antecedentes</label>
              <textarea id="case-background" class="textarea" [ngModel]="draft.antecedentes" (ngModelChange)="set('antecedentes', $event)"></textarea>
            </div>
            <div class="field">
              <label for="case-exam">Exame físico</label>
              <textarea id="case-exam" class="textarea" [ngModel]="draft.exameFisico" (ngModelChange)="set('exameFisico', $event)"></textarea>
            </div>
            <div class="field">
              <label for="case-image">Imagem / traçado (opcional)</label>
              <textarea
                id="case-image"
                class="textarea"
                placeholder="Descrição textual de ECG, radiografia…"
                [ngModel]="draft.imagem"
                (ngModelChange)="set('imagem', $event)"
              ></textarea>
            </div>
          </div>

          <div class="divider"></div>
          <div class="row between">
            <h3>Sinais vitais</h3>
            <button class="btn btn-secondary btn-sm" type="button" (click)="addVital()">
              <sf-icon name="plus" [size]="13" /> Adicionar
            </button>
          </div>
          @if (draft.vitals.length === 0) {
            <p class="tiny muted">Opcional. Ex.: PA 150/95 mmHg, FC 98 bpm.</p>
          }
          @for (vital of draft.vitals; track vital.key) {
            <div class="row" style="gap: 8px; flex-wrap: wrap">
              <input class="input" style="width: 120px" placeholder="PA" [ngModel]="vital.label" (ngModelChange)="patchVital(vital.key, 'label', $event)" />
              <input
                class="input"
                style="flex: 1; min-width: 160px"
                placeholder="150/95 mmHg"
                [ngModel]="vital.value"
                (ngModelChange)="patchVital(vital.key, 'value', $event)"
              />
              <select class="select" style="width: 130px" [ngModel]="vital.flag" (ngModelChange)="patchVital(vital.key, 'flag', $event)">
                <option value="normal">Normal</option>
                <option value="alta">Alterado ↑</option>
                <option value="baixa">Alterado ↓</option>
              </select>
              <button class="icon-btn" type="button" (click)="removeVital(vital.key)" aria-label="Remover sinal vital">
                <sf-icon name="trash" [size]="15" />
              </button>
            </div>
          }

          <div class="divider"></div>
          <div class="row between">
            <h3>Exames complementares</h3>
            <button class="btn btn-secondary btn-sm" type="button" (click)="addExam()">
              <sf-icon name="plus" [size]="13" /> Adicionar
            </button>
          </div>
          @if (draft.exams.length === 0) {
            <p class="tiny muted">Opcional. Ex.: Troponina 0,8 ng/mL (ref &lt; 0,04).</p>
          }
          @for (exam of draft.exams; track exam.key) {
            <div class="row" style="gap: 8px; flex-wrap: wrap">
              <input class="input" style="width: 170px" placeholder="Exame" [ngModel]="exam.nome" (ngModelChange)="patchExam(exam.key, 'nome', $event)" />
              <input
                class="input"
                style="flex: 1; min-width: 150px"
                placeholder="Resultado"
                [ngModel]="exam.resultado"
                (ngModelChange)="patchExam(exam.key, 'resultado', $event)"
              />
              <input class="input" style="width: 150px" placeholder="Referência" [ngModel]="exam.ref" (ngModelChange)="patchExam(exam.key, 'ref', $event)" />
              <button class="icon-btn" type="button" (click)="removeExam(exam.key)" aria-label="Remover exame">
                <sf-icon name="trash" [size]="15" />
              </button>
            </div>
          }
        </section>

        <section class="stack">
          <div class="row between">
            <h2>Perguntas ({{ draft.questions.length }})</h2>
            <button class="btn btn-secondary btn-sm" type="button" (click)="addQuestion()">
              <sf-icon name="plus" [size]="13" /> Adicionar pergunta
            </button>
          </div>

          @for (question of draft.questions; track question.key; let qIndex = $index) {
            <div class="card card-pad stack">
              <div class="row between">
                <h3>Pergunta {{ qIndex + 1 }}</h3>
                <div class="row" style="gap: 8px">
                  <select
                    class="select"
                    style="width: 190px"
                    aria-label="Momento do caso"
                    [ngModel]="question.stage"
                    (ngModelChange)="patchQuestion(question.key, { stage: num($event) })"
                  >
                    <option [ngValue]="0">Apresentação inicial</option>
                    <option [ngValue]="1">Investigação</option>
                    <option [ngValue]="2">Diagnóstico / evolução</option>
                    <option [ngValue]="3">Conduta</option>
                  </select>
                  <button
                    class="icon-btn"
                    type="button"
                    (click)="removeQuestion(question.key)"
                    aria-label="Remover pergunta"
                    [disabled]="draft.questions.length === 1"
                  >
                    <sf-icon name="trash" [size]="16" />
                  </button>
                </div>
              </div>
              <div class="field">
                <label>Enunciado</label>
                <textarea
                  class="textarea"
                  placeholder="Qual é a hipótese diagnóstica e a conduta imediata?"
                  [ngModel]="question.prompt"
                  (ngModelChange)="patchQuestion(question.key, { prompt: $event })"
                ></textarea>
              </div>

              <div class="field">
                <span class="label">Alternativas</span>
                <div class="stack-sm">
                  @for (option of question.options; track option.key; let oIndex = $index) {
                    <div class="row" style="gap: 8px">
                      <input
                        type="radio"
                        [name]="'correct-' + question.key"
                        [checked]="question.correctKey === option.key"
                        (change)="patchQuestion(question.key, { correctKey: option.key })"
                        [attr.aria-label]="'Marcar alternativa ' + letters[oIndex] + ' como correta'"
                        style="accent-color: var(--brand); width: 16px; height: 16px; flex: none"
                      />
                      <span class="option-key" style="width: 24px; height: 24px">{{ letters[oIndex] }}</span>
                      <input
                        class="input"
                        [placeholder]="'Alternativa ' + letters[oIndex].toUpperCase()"
                        [ngModel]="option.text"
                        (ngModelChange)="patchOption(question.key, option.key, $event)"
                      />
                      <button
                        class="icon-btn"
                        type="button"
                        (click)="removeOption(question.key, option.key)"
                        aria-label="Remover alternativa"
                        [disabled]="question.options.length <= 3"
                      >
                        <sf-icon name="close" [size]="15" />
                      </button>
                    </div>
                  }
                  @if (question.options.length < 5) {
                    <button class="btn btn-ghost btn-sm" type="button" style="align-self: flex-start" (click)="addOption(question.key)">
                      <sf-icon name="plus" [size]="13" /> Adicionar alternativa
                    </button>
                  }
                </div>
                <span class="hint">A bolinha marca a alternativa correta. Você precisa de 3 a 5 alternativas.</span>
              </div>

              <div class="form-grid">
                <div class="field span-2">
                  <label>Justificativa (aparece após a resposta)</label>
                  <textarea
                    class="textarea"
                    style="min-height: 80px"
                    placeholder="Explique por que a correta está certa e por que as outras estão erradas."
                    [ngModel]="question.rationale"
                    (ngModelChange)="patchQuestion(question.key, { rationale: $event })"
                  ></textarea>
                </div>
                <div class="field">
                  <label>Ponto-chave (opcional)</label>
                  <input
                    class="input"
                    placeholder="Ex.: ECG em até 10 minutos."
                    [ngModel]="question.keyPoint"
                    (ngModelChange)="patchQuestion(question.key, { keyPoint: $event })"
                  />
                </div>
                <div class="field">
                  <label>Trecho da fonte (opcional)</label>
                  <input
                    class="input"
                    placeholder="Trecho literal do material"
                    [ngModel]="question.sourceExcerpt"
                    (ngModelChange)="patchQuestion(question.key, { sourceExcerpt: $event })"
                  />
                </div>
              </div>
            </div>
          }
        </section>

        <section class="card card-pad stack">
          <h2>Pontos-chave do caso</h2>
          <div class="field">
            <label for="case-teaching">Um ponto por linha</label>
            <textarea
              id="case-teaching"
              class="textarea"
              placeholder="O que o aluno deve levar deste caso…"
              [ngModel]="draft.teachingPoints"
              (ngModelChange)="set('teachingPoints', $event)"
            ></textarea>
          </div>
        </section>

        <div class="row" style="justify-content: flex-end; gap: 8px">
          <a class="btn btn-secondary" [routerLink]="editing ? '/casos/' + caseId : '/casos'">Cancelar</a>
          <button class="btn btn-primary btn-lg" type="button" (click)="save()" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner" aria-hidden="true"></span>
            } @else {
              <sf-icon name="check" [size]="16" />
            }
            Salvar caso
          </button>
        </div>
      </div>
    }
  `,
})
export class CaseEditorPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly areas = AREAS;
  readonly letters = LETTERS;
  readonly editing = this.route.snapshot.paramMap.has('id');
  readonly caseId = Number(this.route.snapshot.paramMap.get('id'));

  readonly value = signal<Draft>(emptyDraft());
  readonly loading = signal(this.editing);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly problems = computed(() => {
    const draft = this.value();
    const list: string[] = [];
    if (draft.title.trim().length < 3) list.push('Dê um título ao caso.');
    draft.questions.forEach((question, index) => {
      const filled = question.options.filter((option) => option.text.trim());
      if (!question.prompt.trim()) list.push(`Pergunta ${index + 1} sem enunciado.`);
      if (filled.length < 3) list.push(`Pergunta ${index + 1} precisa de pelo menos 3 alternativas preenchidas.`);
      if (!filled.some((option) => option.key === question.correctKey)) list.push(`Marque a alternativa correta da pergunta ${index + 1}.`);
    });
    return list;
  });

  constructor() {
    if (!this.editing) return;
    this.api.cases
      .get(this.caseId)
      .then(({ case: item }) => {
        if (!item.canEdit) {
          this.loadError.set('Este caso não é seu. Duplique-o para editar.');
          return;
        }
        this.value.set(toDraft(item.data, item.status));
      })
      .catch((error) => this.loadError.set(errorMessage(error, 'Não foi possível abrir o caso.')))
      .finally(() => this.loading.set(false));
  }

  num(value: unknown): number {
    return Number(value);
  }

  set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.value.update((draft) => ({ ...draft, [key]: value }));
  }

  patchQuestion(key: string, patch: Partial<QuestionDraft>): void {
    this.value.update((draft) => ({
      ...draft,
      questions: draft.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)),
    }));
  }

  patchOption(questionKey: string, optionKey: string, text: string): void {
    this.value.update((draft) => ({
      ...draft,
      questions: draft.questions.map((question) =>
        question.key === questionKey
          ? { ...question, options: question.options.map((option) => (option.key === optionKey ? { ...option, text } : option)) }
          : question,
      ),
    }));
  }

  addOption(questionKey: string): void {
    this.value.update((draft) => ({
      ...draft,
      questions: draft.questions.map((question) =>
        question.key === questionKey ? { ...question, options: [...question.options, { key: uid(), text: '' }] } : question,
      ),
    }));
  }

  removeOption(questionKey: string, optionKey: string): void {
    this.value.update((draft) => ({
      ...draft,
      questions: draft.questions.map((question) => {
        if (question.key !== questionKey || question.options.length <= 3) return question;
        const remaining = question.options.filter((option) => option.key !== optionKey);
        return {
          ...question,
          options: remaining,
          correctKey: question.correctKey === optionKey ? remaining[0].key : question.correctKey,
        };
      }),
    }));
  }

  addQuestion(): void {
    this.value.update((draft) => ({ ...draft, questions: [...draft.questions, newQuestion()] }));
  }

  removeQuestion(key: string): void {
    this.value.update((draft) =>
      draft.questions.length === 1 ? draft : { ...draft, questions: draft.questions.filter((question) => question.key !== key) },
    );
  }

  addVital(): void {
    this.value.update((draft) => ({ ...draft, vitals: [...draft.vitals, { key: uid(), label: '', value: '', flag: 'normal' }] }));
  }

  patchVital(key: string, field: keyof Omit<VitalDraft, 'key'>, value: string): void {
    this.value.update((draft) => ({
      ...draft,
      vitals: draft.vitals.map((vital) => (vital.key === key ? { ...vital, [field]: value } : vital)),
    }));
  }

  removeVital(key: string): void {
    this.value.update((draft) => ({ ...draft, vitals: draft.vitals.filter((vital) => vital.key !== key) }));
  }

  addExam(): void {
    this.value.update((draft) => ({ ...draft, exams: [...draft.exams, { key: uid(), nome: '', resultado: '', ref: '' }] }));
  }

  patchExam(key: string, field: 'nome' | 'resultado' | 'ref', value: string): void {
    this.value.update((draft) => ({
      ...draft,
      exams: draft.exams.map((exam) => (exam.key === key ? { ...exam, [field]: value } : exam)),
    }));
  }

  removeExam(key: string): void {
    this.value.update((draft) => ({ ...draft, exams: draft.exams.filter((exam) => exam.key !== key) }));
  }

  async save(): Promise<void> {
    this.error.set(null);
    if (this.problems().length > 0) {
      this.error.set(this.problems()[0]);
      return;
    }
    this.saving.set(true);
    const draft = this.value();
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
        sinaisVitais: draft.vitals
          .filter((vital) => vital.label.trim() && vital.value.trim())
          .map((vital) => ({ label: vital.label, value: vital.value, flag: vital.flag })),
        exames: draft.exams
          .filter((exam) => exam.nome.trim() && exam.resultado.trim())
          .map((exam) => ({ nome: exam.nome, resultado: exam.resultado, ref: exam.ref || undefined })),
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
      const result = this.editing ? await this.api.cases.update(this.caseId, payload) : await this.api.cases.create(payload);
      this.toast.success(this.editing ? 'Caso atualizado.' : 'Caso criado.');
      await this.router.navigate(['/casos', result.case.id]);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível salvar.'));
    } finally {
      this.saving.set(false);
    }
  }
}
