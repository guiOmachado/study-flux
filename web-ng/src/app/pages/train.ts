import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { AttemptDTO } from '@shared/types';
import { Api, errorMessage, type AnswerFeedback, type PlayableCase } from '../core/api';
import { ToastService } from '../core/toast';
import { difficultyLabel, formatLabel } from '../core/format';
import { CasePresentation } from '../shared/case-presentation';
import { EmptyState, LoadingBlock, ProgressRing } from '../shared/ui';
import { Icon } from '../shared/icon';

interface LocalFeedback {
  optionId: string;
  correct: boolean;
  correctOptionId: string;
  rationale: string;
  keyPoint?: string;
  sourceExcerpt?: string;
}

@Component({
  selector: 'sf-train',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CasePresentation, EmptyState, LoadingBlock, ProgressRing],
  template: `
    @if (loading()) {
      <sf-loading label="Preparando o caso…" />
    } @else if (error() || !attempt() || !playable()) {
      <sf-empty icon="alert" title="Não foi possível treinar este caso" [description]="error() ?? 'Caso indisponível.'">
        <a class="btn btn-secondary" routerLink="/casos">Voltar para a biblioteca</a>
      </sf-empty>
    } @else if (finished()) {
      @let done = finished()!;
      @let pct = scorePct(done.score, done.total);
      <div class="train-shell">
        <div class="card card-pad" style="text-align: center; margin-bottom: 16px">
          <span class="badge badge-brand" style="margin-bottom: 10px">Treino concluído</span>
          <h1 style="margin-bottom: 4px">{{ playable()!.title }}</h1>
          <p class="small muted">
            Você acertou {{ done.score }} de {{ done.total }} em {{ minutes() }} min {{ seconds() }}s.
          </p>
          <div class="row" style="justify-content: center; margin: 18px 0 6px">
            <sf-progress-ring [value]="pct" [size]="110" [stroke]="9" />
          </div>
          <p class="small muted" style="max-width: 460px; margin: 0 auto">
            {{
              pct >= 80
                ? 'Ótimo desempenho. Uma revisão rápida amanhã consolida o aprendizado.'
                : pct >= 50
                  ? 'Bom progresso. Os erros foram enviados para a revisão espaçada.'
                  : 'Vale reler os pontos-chave do caso. As questões erradas voltam amanhã na revisão.'
            }}
          </p>
          <div class="row" style="justify-content: center; gap: 8px; margin-top: 18px; flex-wrap: wrap">
            <button class="btn btn-secondary" type="button" (click)="restart()">
              <sf-icon name="refresh" [size]="15" />
              Refazer treino
            </button>
            <a class="btn btn-secondary" routerLink="/revisao">
              <sf-icon name="layers" [size]="15" />
              Ir para revisão
            </a>
            <a class="btn btn-primary" routerLink="/casos">
              <sf-icon name="library" [size]="15" />
              Outros casos
            </a>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Revisão do que você respondeu</h3>
            <span class="tiny muted">{{ wrongCount() }} para revisar</span>
          </div>
          <div class="card-body stack">
            @for (result of done.results; track result.questionId; let index = $index) {
              <div [style.borderBottom]="index + 1 < done.results.length ? '1px solid var(--line-2)' : 'none'" style="padding-bottom: 14px">
                <div class="row" style="gap: 8px; margin-bottom: 6px">
                  <span [class]="'badge ' + (result.correct ? 'badge-success' : 'badge-danger')">
                    {{ result.correct ? 'Acertou' : 'Errou' }}
                  </span>
                  <span class="tiny muted">Pergunta {{ index + 1 }}</span>
                </div>
                <div class="small" style="font-weight: 600; margin-bottom: 4px">{{ result.prompt }}</div>
                <div class="tiny" style="color: var(--ink-2)">
                  Correta: <strong>{{ result.correctOptionId.toUpperCase() }}</strong>
                  {{ correctOptionText(result.questionId, result.correctOptionId) }}
                  @if (!result.correct) {
                    · Você marcou {{ result.chosenOptionId?.toUpperCase() ?? '—' }}
                  }
                </div>
                <div class="tiny muted" style="margin-top: 4px">{{ result.rationale }}</div>
              </div>
            }
          </div>
        </div>
      </div>
    } @else {
      @let item = playable()!;
      @let question = currentQuestion();
      <div class="train-shell">
        <div class="train-head">
          <a class="icon-btn" [routerLink]="'/casos/' + item.id" aria-label="Voltar ao caso">
            <sf-icon name="close" [size]="19" />
          </a>
          <div class="train-progress">
            <div class="row">
              <span>{{ answered() }} de {{ item.questions.length }} respondidas</span>
              <span class="mono">
                <sf-icon name="clock" [size]="12" style="vertical-align: -2px; margin-right: 4px" />
                {{ minutes() }}:{{ padSeconds() }}
              </span>
            </div>
            <div class="progress"><span [style.width.%]="progress()"></span></div>
          </div>
        </div>

        <div class="row row-wrap" style="gap: 6px; margin-bottom: 12px">
          <span class="badge badge-brand">{{ item.area }}</span>
          <span class="badge badge-neutral">{{ formatLabel[item.format] ?? item.format }}</span>
          <span class="badge badge-neutral">{{ difficultyLabel[item.difficulty] ?? item.difficulty }}</span>
          @if (item.sourceTitle) {
            <span class="badge badge-info" style="max-width: 280px; overflow: hidden; text-overflow: ellipsis">{{ item.sourceTitle }}</span>
          }
        </div>

        <h2 style="margin-bottom: 12px">{{ item.title }}</h2>

        <div class="card" style="margin-bottom: 16px">
          <div class="card-head">
            <h3>Dados do caso</h3>
            <button class="btn btn-ghost btn-sm" type="button" (click)="showPresentation.set(!showPresentation())">
              <sf-icon [name]="showPresentation() ? 'chevronDown' : 'chevronRight'" [size]="14" />
              {{ showPresentation() ? 'Recolher' : 'Abrir' }}
            </button>
          </div>
          @if (showPresentation()) {
            <div class="card-body">
              <sf-case-presentation [presentation]="item.presentation" />
            </div>
          }
        </div>

        @if (question) {
          <div class="card question-card">
            <div class="row between">
              <span class="badge badge-neutral">Pergunta {{ index() + 1 }} de {{ item.questions.length }}</span>
              <span class="tiny muted">{{ feedback() ? 'confira o comentário abaixo' : 'selecione e confirme' }}</span>
            </div>
            <div class="question-prompt">{{ question.prompt }}</div>
            <div class="options">
              @for (option of question.options; track option.id) {
                @let fb = feedback();
                <button
                  [class]="
                    'option' +
                    (!fb && selected() === option.id ? ' selected' : '') +
                    (fb && option.id === fb.correctOptionId ? ' correct' : '') +
                    (fb && option.id === fb.optionId && option.id !== fb.correctOptionId ? ' wrong' : '')
                  "
                  type="button"
                  (click)="select(option.id)"
                  [disabled]="!!fb"
                >
                  <span class="option-key">{{ option.id.toUpperCase() }}</span>
                  <span>{{ option.text }}</span>
                  @if (fb && option.id === fb.correctOptionId) {
                    <sf-icon name="check" [size]="17" style="margin-left: auto; flex: none; color: var(--success)" />
                  }
                  @if (fb && option.id === fb.optionId && option.id !== fb.correctOptionId) {
                    <sf-icon name="x" [size]="17" style="margin-left: auto; flex: none; color: var(--danger)" />
                  }
                </button>
              }
            </div>

            @if (feedback(); as fb) {
              <div [class]="'feedback ' + (fb.correct ? 'ok' : 'bad')">
                <div class="feedback-title">
                  <sf-icon [name]="fb.correct ? 'check' : 'x'" [size]="16" />
                  {{ fb.correct ? 'Resposta correta' : 'Resposta incorreta' }}
                  @if (!fb.correct) {
                    <span class="small" style="font-weight: 500">· correta: {{ fb.correctOptionId.toUpperCase() }}</span>
                  }
                </div>
                <span>{{ fb.rationale }}</span>
                @if (fb.keyPoint) {
                  <div class="small"><strong>Ponto-chave:</strong> {{ fb.keyPoint }}</div>
                }
                @if (fb.sourceExcerpt) {
                  <div class="quote">{{ fb.sourceExcerpt }}</div>
                }
              </div>
            }

            <div class="row" style="justify-content: flex-end; gap: 8px">
              @if (!feedback()) {
                <button class="btn btn-primary" type="button" (click)="confirm()" [disabled]="!selected() || submitting()">
                  @if (submitting()) {
                    <span class="spinner" aria-hidden="true"></span>
                  }
                  Confirmar resposta
                  <span class="tiny" style="opacity: 0.7">Enter</span>
                </button>
              } @else {
                <button class="btn btn-primary" type="button" (click)="next()" [disabled]="submitting()">
                  {{ index() + 1 < item.questions.length ? 'Próxima pergunta' : 'Ver resultado' }}
                  @if (submitting()) {
                    <span class="spinner" aria-hidden="true"></span>
                  } @else {
                    <sf-icon name="arrowRight" [size]="15" />
                  }
                </button>
              }
            </div>
          </div>
        }

        <p class="tiny muted" style="text-align: center; margin-top: 14px">Atalhos: 1–5 escolhem a alternativa, Enter confirma e avança.</p>
      </div>
    }
  `,
})
export class TrainPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly attempt = signal<AttemptDTO | null>(null);
  readonly playable = signal<PlayableCase | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly index = signal(0);
  readonly selected = signal<string | null>(null);
  readonly feedback = signal<LocalFeedback | null>(null);
  readonly answers = signal<{ questionId: string; correct: boolean }[]>([]);
  readonly finished = signal<AttemptDTO | null>(null);
  readonly submitting = signal(false);
  readonly showPresentation = signal(true);
  readonly elapsed = signal(0);

  private readonly caseId = Number(this.route.snapshot.paramMap.get('id'));
  private startedAt = Date.now();
  private questionStart = Date.now();

  readonly currentQuestion = computed(() => this.playable()?.questions[this.index()] ?? null);
  readonly answered = computed(() => this.answers().length);
  readonly progress = computed(() => {
    const total = this.playable()?.questions.length ?? 0;
    return total ? Math.round((this.answered() / total) * 100) : 0;
  });
  readonly minutes = computed(() => Math.floor(this.elapsed() / 60));
  readonly seconds = computed(() => this.elapsed() % 60);
  readonly padSeconds = computed(() => String(this.seconds()).padStart(2, '0'));
  readonly wrongCount = computed(() => (this.finished()?.results ?? []).filter((result) => !result.correct).length);

  formatLabel = formatLabel;
  difficultyLabel = difficultyLabel;

  scorePct(score: number, total: number): number {
    return total ? Math.round((score / total) * 100) : 0;
  }

  constructor() {
    this.start();
    const timer = setInterval(() => {
      if (!this.finished()) this.elapsed.set(Math.floor((Date.now() - this.startedAt) / 1000));
    }, 1000);

    const onKey = (event: KeyboardEvent) => {
      if (!this.currentQuestion() || this.finished()) return;
      if (/^[1-5]$/.test(event.key)) {
        const option = this.currentQuestion()!.options[Number(event.key) - 1];
        if (option && !this.feedback()) this.selected.set(option.id);
      }
      if (event.key === 'Enter') {
        if (this.feedback()) void this.next();
        else if (this.selected()) void this.confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
    });
  }

  private start(): void {
    this.loading.set(true);
    this.api.attempts
      .start(this.caseId, 'treino')
      .then(({ attempt, case: playable }) => {
        this.attempt.set(attempt);
        this.playable.set(playable);
        this.questionStart = Date.now();
        this.startedAt = Date.now();
      })
      .catch((error) => this.error.set(errorMessage(error, 'Não foi possível iniciar o treino.')))
      .finally(() => this.loading.set(false));
  }

  select(optionId: string): void {
    if (!this.feedback()) this.selected.set(optionId);
  }

  async confirm(): Promise<void> {
    const attempt = this.attempt();
    const question = this.currentQuestion();
    const selected = this.selected();
    if (!attempt || !question || !selected || this.feedback() || this.submitting()) return;
    this.submitting.set(true);
    try {
      const response: AnswerFeedback = await this.api.attempts.answer(attempt.id, {
        questionId: question.id,
        optionId: selected,
        timeMs: Date.now() - this.questionStart,
      });
      this.feedback.set({
        optionId: selected,
        correct: response.correct,
        correctOptionId: response.correctOptionId,
        rationale: response.rationale,
        keyPoint: response.keyPoint,
        sourceExcerpt: response.sourceExcerpt,
      });
      this.answers.update((prev) => [...prev, { questionId: question.id, correct: response.correct }]);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível registrar a resposta.'));
    } finally {
      this.submitting.set(false);
    }
  }

  async next(): Promise<void> {
    const item = this.playable();
    const attempt = this.attempt();
    if (!item || !attempt) return;
    if (this.index() + 1 < item.questions.length) {
      this.index.update((value) => value + 1);
      this.selected.set(null);
      this.feedback.set(null);
      this.questionStart = Date.now();
      return;
    }
    this.submitting.set(true);
    try {
      const result = await this.api.attempts.finish(attempt.id, Date.now() - this.startedAt);
      window.dispatchEvent(new Event('sf:srs-changed'));
      this.finished.set(result.attempt);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível finalizar o treino.'));
    } finally {
      this.submitting.set(false);
    }
  }

  correctOptionText(questionId: string, optionId: string): string {
    const question = this.playable()?.questions.find((item) => item.id === questionId);
    const option = question?.options.find((item) => item.id === optionId);
    return option ? ` — ${option.text}` : '';
  }

  restart(): void {
    // Mesmo comportamento do navigate(0): novo treino do zero.
    window.location.reload();
  }
}
