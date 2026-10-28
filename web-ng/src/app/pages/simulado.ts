import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AREAS } from '@shared/types';
import type { AttemptDTO } from '@shared/types';
import { Api, errorMessage, type PlayableCase } from '../core/api';
import { ToastService } from '../core/toast';
import { CasePresentation } from '../shared/case-presentation';
import { PageHeader, ProgressRing } from '../shared/ui';
import { Icon } from '../shared/icon';

interface BatchItem {
  attemptId: number;
  attempt: AttemptDTO;
  case: PlayableCase;
}

type ResultMap = Record<number, { questionId: string; correct: boolean }[]>;

@Component({
  selector: 'sf-simulado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CasePresentation, PageHeader, ProgressRing],
  template: `
    @if (phase() === 'running' && currentItem(); as item) {
      @let question = currentQuestion()!;
      <div class="train-shell">
        <div class="train-head">
          <button class="icon-btn" type="button" (click)="stopEarly()" aria-label="Encerrar simulado">
            <sf-icon name="close" [size]="19" />
          </button>
          <div class="train-progress">
            <div class="row">
              <span>Caso {{ caseIndex() + 1 }} de {{ items().length }} · {{ answeredCount() }} de {{ totalQuestions() }} questões</span>
              <span class="mono">
                <sf-icon name="clock" [size]="12" style="vertical-align: -2px; margin-right: 4px" />
                {{ minutes() }}:{{ padSeconds() }}
              </span>
            </div>
            <div class="progress"><span [style.width.%]="progress()"></span></div>
          </div>
        </div>

        <div class="row row-wrap" style="gap: 6px; margin-bottom: 12px">
          <span class="badge badge-info">Simulado — sem correção até o final</span>
          <span class="badge badge-neutral">{{ item.case.area }}</span>
          <span class="badge badge-neutral">{{ item.case.difficulty }}</span>
        </div>

        <h2 style="margin-bottom: 12px">{{ item.case.title }}</h2>

        <div class="card" style="margin-bottom: 16px">
          <div class="card-head">
            <h3>Dados do caso</h3>
            <span class="tiny muted">leitura antes de responder</span>
          </div>
          <div class="card-body">
            <sf-case-presentation [presentation]="item.case.presentation" />
          </div>
        </div>

        <div class="card question-card">
          <div class="row between">
            <span class="badge badge-neutral">Questão {{ questionIndex() + 1 }} de {{ item.case.questions.length }}</span>
            <span class="tiny muted">responda e siga em frente</span>
          </div>
          <div class="question-prompt">{{ question.prompt }}</div>
          <div class="options">
            @for (option of question.options; track option.id) {
              <button [class]="'option' + (selected() === option.id ? ' selected' : '')" type="button" (click)="selected.set(option.id)" [disabled]="submitting()">
                <span class="option-key">{{ option.id.toUpperCase() }}</span>
                <span>{{ option.text }}</span>
              </button>
            }
          </div>
          <div class="row" style="justify-content: flex-end; gap: 8px">
            <button class="btn btn-primary" type="button" (click)="confirm()" [disabled]="!selected() || submitting()">
              @if (submitting()) {
                <span class="spinner" aria-hidden="true"></span>
              }
              Responder e avançar
              <sf-icon name="arrowRight" [size]="15" />
            </button>
          </div>
        </div>
      </div>
    } @else if (phase() === 'done') {
      <sf-page-header
        title="Resultado do simulado"
        [subtitle]="totalScore() + ' acertos de ' + totalDone() + ' questões em ' + minutes() + ' min ' + seconds() + 's'"
      >
        <button actions class="btn btn-secondary" type="button" (click)="reset()">
          <sf-icon name="refresh" [size]="15" />
          Novo simulado
        </button>
        <a actions class="btn btn-primary" routerLink="/progresso">
          Ver progresso
          <sf-icon name="arrowRight" [size]="15" />
        </a>
      </sf-page-header>

      <div class="grid dash-split" style="margin-bottom: 16px">
        <div class="card card-pad row" style="gap: 22px; align-items: center; justify-content: center">
          <sf-progress-ring [value]="overallPct()" [size]="120" [stroke]="10" />
          <div>
            <div class="section-label">Aproveitamento</div>
            <div style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em">{{ overallPct() }}%</div>
            <p class="small muted" style="max-width: 260px">
              {{
                overallPct() >= 70
                  ? 'Bom desempenho para o período de provas. Revise os erros e mantenha a constância.'
                  : 'Os temas com erro entraram na revisão espaçada. Uma nova rodada neles tende a melhorar rápido.'
              }}
            </p>
          </div>
        </div>
        <div class="card card-pad stack-sm">
          <div class="row between small">
            <span class="muted">Casos respondidos</span>
            <strong>{{ finalAttempts().length }}</strong>
          </div>
          <div class="row between small">
            <span class="muted">Questões</span>
            <strong>{{ totalDone() }}</strong>
          </div>
          <div class="row between small">
            <span class="muted">Tempo total</span>
            <strong>{{ minutes() }} min</strong>
          </div>
          <div class="row between small">
            <span class="muted">Revisões geradas</span>
            <strong>a partir dos erros</strong>
          </div>
          <a class="btn btn-secondary btn-sm" routerLink="/revisao" style="align-self: flex-start; margin-top: 6px">
            <sf-icon name="layers" [size]="14" />
            Revisar erros
          </a>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Desempenho por caso</h3></div>
        <div class="card-body stack">
          @for (attempt of finalAttempts(); track attempt.id) {
            <div class="row between" style="gap: 12px; border-bottom: 1px solid var(--line-2); padding-bottom: 10px">
              <div style="min-width: 0">
                <div style="font-weight: 600; font-size: 13.5px">{{ attempt.caseTitle }}</div>
                <div class="tiny muted">{{ attempt.area }} · {{ attempt.topic }}</div>
              </div>
              <div class="row" style="gap: 10px">
                <span [class]="'badge ' + caseTone(attempt)">{{ attempt.score }}/{{ attempt.total }}</span>
                @if (attempt.caseId) {
                  <a class="btn btn-ghost btn-sm" [routerLink]="'/casos/' + attempt.caseId">
                    <sf-icon name="eye" [size]="14" />
                    Ver caso
                  </a>
                }
              </div>
            </div>
          }
          @if (finalAttempts().length === 0) {
            <p class="small muted">Nenhuma questão respondida neste simulado.</p>
          }
        </div>
      </div>
    } @else {
      <sf-page-header
        title="Simulado"
        subtitle="Monte uma sequência de casos da sua biblioteca e da comunidade. Sem correção durante o percurso: o resultado aparece no final, como em uma prova."
      />
      @if (error()) {
        <div class="feedback bad" style="margin-bottom: 16px">
          <div class="feedback-title">
            <sf-icon name="alert" [size]="15" />
            Não foi possível iniciar
          </div>
          <span class="small">{{ error() }}</span>
          <div>
            <a class="btn btn-secondary btn-sm" routerLink="/casos">Ver biblioteca de casos</a>
          </div>
        </div>
      }
      <div class="grid dash-split">
        <div class="card card-pad stack">
          <h2>Configurar simulado</h2>
          <div class="form-grid">
            <div class="field">
              <label for="sim-area">Área</label>
              <select id="sim-area" class="select" [value]="area()" (change)="area.set(value($event))">
                <option value="">Todas as áreas</option>
                @for (item of areas; track item) {
                  <option [value]="item">{{ item }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="sim-limit">Quantidade de casos</label>
              <select id="sim-limit" class="select" [value]="limit()" (change)="setLimit($event)">
                <option [value]="3">3 casos (~15 questões)</option>
                <option [value]="5">5 casos (~25 questões)</option>
                <option [value]="8">8 casos (~40 questões)</option>
              </select>
            </div>
          </div>
          <p class="small muted">
            Os casos são sorteados entre os seus publicados e os da comunidade. Cada caso mantém sua própria pontuação, e os erros
            entram na revisão espaçada ao final.
          </p>
          <div>
            <button class="btn btn-primary btn-lg" type="button" (click)="start()" [disabled]="starting()">
              @if (starting()) {
                <span class="spinner" aria-hidden="true"></span>
              } @else {
                <sf-icon name="play" [size]="16" />
              }
              {{ starting() ? 'Montando simulado…' : 'Iniciar simulado' }}
            </button>
          </div>
        </div>

        <div class="card card-pad stack-sm">
          <h3>Como funciona</h3>
          @for (row of howItWorks; track row.title) {
            <div class="row" style="align-items: flex-start; gap: 10px; padding: 6px 0">
              <div class="file-icon" style="width: 32px; height: 32px; border-radius: 9px">
                <sf-icon [name]="row.icon" [size]="15" />
              </div>
              <div>
                <strong class="small">{{ row.title }}</strong>
                <div class="tiny muted">{{ row.text }}</div>
              </div>
            </div>
          }
          <div class="divider"></div>
          <a class="btn btn-secondary btn-sm" routerLink="/casos">
            <sf-icon name="library" [size]="14" />
            Ver casos disponíveis
          </a>
        </div>
      </div>
    }
  `,
})
export class SimuladoPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly areas = AREAS;
  readonly phase = signal<'config' | 'running' | 'done'>('config');
  readonly area = signal('');
  readonly limit = signal(3);
  readonly starting = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<BatchItem[]>([]);
  readonly caseIndex = signal(0);
  readonly questionIndex = signal(0);
  readonly selected = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly finalAttempts = signal<AttemptDTO[]>([]);
  readonly elapsed = signal(0);

  private results: ResultMap = {};
  private readonly resultsVersion = signal(0);
  private startedAt = Date.now();
  private questionStart = Date.now();

  readonly howItWorks = [
    { icon: 'layers', title: 'Casos em sequência', text: 'Um caso por vez, com o prontuário sempre visível.' },
    { icon: 'eye', title: 'Sem gabarito na hora', text: 'Você responde e segue; o comentário vem no final.' },
    { icon: 'chart', title: 'Resultado por caso', text: 'Acertos, tempo e os temas que precisam voltar.' },
  ];

  readonly currentItem = computed(() => this.items()[this.caseIndex()] ?? null);
  readonly currentQuestion = computed(() => this.currentItem()?.case.questions[this.questionIndex()] ?? null);
  readonly totalQuestions = computed(() => this.items().reduce((acc, item) => acc + item.case.questions.length, 0));
  readonly answeredCount = computed(() => {
    this.resultsVersion();
    return Object.values(this.results).reduce((acc, list) => acc + list.length, 0);
  });
  readonly progress = computed(() => {
    const total = this.totalQuestions();
    return total ? Math.round((this.answeredCount() / total) * 100) : 0;
  });
  readonly minutes = computed(() => Math.floor(this.elapsed() / 60));
  readonly seconds = computed(() => this.elapsed() % 60);
  readonly padSeconds = computed(() => String(this.seconds()).padStart(2, '0'));
  readonly totalScore = computed(() => this.finalAttempts().reduce((acc, attempt) => acc + attempt.score, 0));
  readonly totalDone = computed(() => this.finalAttempts().reduce((acc, attempt) => acc + attempt.total, 0));
  readonly overallPct = computed(() => {
    const total = this.totalDone();
    return total ? Math.round((this.totalScore() / total) * 100) : 0;
  });

  constructor() {
    const timer = setInterval(() => {
      if (this.phase() === 'running') this.elapsed.set(Math.floor((Date.now() - this.startedAt) / 1000));
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  setLimit(event: Event): void {
    this.limit.set(Number(this.value(event)));
  }

  caseTone(attempt: AttemptDTO): string {
    const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
    return pct >= 70 ? 'badge-success' : pct >= 50 ? 'badge-warn' : 'badge-danger';
  }

  async start(): Promise<void> {
    this.starting.set(true);
    this.error.set(null);
    try {
      const response = await this.api.attempts.startBatch({ mode: 'simulado', area: this.area() || undefined, limit: this.limit() });
      this.items.set(response.items);
      this.results = {};
      this.resultsVersion.update((value) => value + 1);
      this.caseIndex.set(0);
      this.questionIndex.set(0);
      this.selected.set(null);
      this.phase.set('running');
      this.startedAt = Date.now();
      this.questionStart = Date.now();
      this.elapsed.set(0);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível montar o simulado.'));
    } finally {
      this.starting.set(false);
    }
  }

  private async finishAll(current: ResultMap, list = this.items()): Promise<void> {
    const finished: AttemptDTO[] = [];
    for (const item of list) {
      if ((current[item.attemptId] ?? []).length === 0) continue;
      try {
        const response = await this.api.attempts.finish(item.attemptId);
        finished.push(response.attempt);
      } catch {
        /* segue para o próximo */
      }
    }
    this.finalAttempts.set(finished);
    this.phase.set('done');
    window.dispatchEvent(new Event('sf:srs-changed'));
  }

  private async advance(currentResults: ResultMap): Promise<void> {
    const item = this.currentItem();
    if (!item) return;
    if (this.questionIndex() + 1 < item.case.questions.length) {
      this.questionIndex.update((value) => value + 1);
      this.selected.set(null);
      this.questionStart = Date.now();
      return;
    }
    if (this.caseIndex() + 1 < this.items().length) {
      this.caseIndex.update((value) => value + 1);
      this.questionIndex.set(0);
      this.selected.set(null);
      this.questionStart = Date.now();
      return;
    }
    await this.finishAll(currentResults);
  }

  async confirm(): Promise<void> {
    const item = this.currentItem();
    const question = this.currentQuestion();
    const selected = this.selected();
    if (!item || !question || !selected || this.submitting()) return;
    this.submitting.set(true);
    try {
      const feedback = await this.api.attempts.answer(item.attemptId, {
        questionId: question.id,
        optionId: selected,
        timeMs: Date.now() - this.questionStart,
      });
      const nextResults: ResultMap = {
        ...this.results,
        [item.attemptId]: [...(this.results[item.attemptId] ?? []), { questionId: question.id, correct: feedback.correct }],
      };
      this.results = nextResults;
      this.resultsVersion.update((value) => value + 1);
      await this.advance(nextResults);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível registrar a resposta.'));
    } finally {
      this.submitting.set(false);
    }
  }

  async stopEarly(): Promise<void> {
    if (!window.confirm('Encerrar o simulado agora? As questões já respondidas entram no histórico.')) return;
    await this.finishAll(this.results);
  }

  reset(): void {
    this.phase.set('config');
    this.items.set([]);
    this.results = {};
    this.resultsVersion.update((value) => value + 1);
    this.finalAttempts.set([]);
    this.selected.set(null);
    this.error.set(null);
  }
}
