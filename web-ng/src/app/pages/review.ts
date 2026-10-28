import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SrsCardDTO, SrsGrade } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { ToastService } from '../core/toast';
import { formatDate, relativeDate } from '../core/format';
import { EmptyState, LoadingBlock, PageHeader, ProgressRing } from '../shared/ui';
import { Icon } from '../shared/icon';

const GRADES: { grade: SrsGrade; label: string; hint: string; tone: string }[] = [
  { grade: 'errei', label: 'Errei', hint: 'volta amanhã', tone: 'btn-danger-ghost' },
  { grade: 'dificil', label: 'Difícil', hint: 'intervalo curto', tone: 'btn-secondary' },
  { grade: 'bom', label: 'Bom', hint: 'intervalo médio', tone: 'btn-secondary' },
  { grade: 'facil', label: 'Fácil', hint: 'intervalo longo', tone: 'btn-primary' },
];

@Component({
  selector: 'sf-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, EmptyState, LoadingBlock, PageHeader, ProgressRing],
  template: `
    @if (loading()) {
      <sf-loading label="Carregando revisão…" />
    } @else if (error() || !cards()) {
      <sf-empty icon="alert" title="Não foi possível carregar a revisão" [description]="error() ?? 'Tente novamente.'">
        <button class="btn btn-secondary" type="button" (click)="load()">Tentar novamente</button>
      </sf-empty>
    } @else if (finished()) {
      <sf-page-header title="Revisão concluída" subtitle="A repetição espaçada distribui as próximas revisões conforme sua memória." />
      <div class="card card-pad" style="text-align: center; max-width: 620px; margin: 0 auto">
        <div class="row" style="justify-content: center; margin-bottom: 14px">
          <sf-progress-ring [value]="hitPct()" [size]="108" [stroke]="9" />
        </div>
        <h2>{{ reviewed() }} cards revisados</h2>
        <p class="small muted" style="margin-top: 6px">
          @if (counts().errei > 0) {
            {{ counts().errei }} voltam amanhã para reforço.
          }
          @if (counts().facil > 0) {
            {{ counts().facil }} vão demorar mais para reaparecer.
          }
          O importante é a constância — volte amanhã.
        </p>
        <div class="row" style="justify-content: center; gap: 8px; margin-top: 18px; flex-wrap: wrap">
          <a class="btn btn-secondary" routerLink="/casos">Treinar novos casos</a>
          <a class="btn btn-primary" routerLink="/">Voltar ao início</a>
        </div>
      </div>
    } @else if (card(); as current) {
      <div class="train-shell">
        <div class="train-head">
          <a class="icon-btn" routerLink="/" aria-label="Sair da revisão">
            <sf-icon name="close" [size]="19" />
          </a>
          <div class="train-progress">
            <div class="row">
              <span>{{ index() + 1 }} de {{ queueSize() }} cards</span>
              <span class="tiny muted">{{ current.area ?? '' }}{{ current.topic ? ' · ' + current.topic : '' }}</span>
            </div>
            <div class="progress"><span [style.width.%]="progress()"></span></div>
          </div>
        </div>

        <div class="flashcard" (click)="revealed.set(true)" (keydown.space)="revealed.set(true)" role="button" tabindex="0">
          <span class="badge badge-brand" style="align-self: center">Pergunta</span>
          <div class="front">{{ current.front }}</div>
          @if (revealed()) {
            <div class="back">{{ current.back }}</div>
          } @else {
            <span class="tiny muted">Clique no card (ou pressione espaço) para ver a resposta</span>
          }
          @if (current.caseTitle) {
            <span class="tiny muted">Caso: {{ current.caseTitle }}</span>
          }
        </div>

        @if (revealed()) {
          <div class="stack-sm" style="margin-top: 16px">
            <span class="tiny muted" style="text-align: center">Como foi lembrar desta resposta?</span>
            <div class="grade-grid">
              @for (option of grades; track option.grade) {
                <button [class]="'btn ' + option.tone" type="button" (click)="grade(option.grade)" [disabled]="busy()">
                  <span style="display: flex; flex-direction: column; align-items: center; gap: 2px">
                    <span>{{ option.label }}</span>
                    <span class="tiny" style="opacity: 0.7; font-weight: 500">{{ option.hint }}</span>
                  </span>
                </button>
              }
            </div>
            @if (busy()) {
              <div class="row" style="justify-content: center"><span class="spinner dark" aria-hidden="true"></span></div>
            }
          </div>
        } @else {
          <div class="row" style="justify-content: center; margin-top: 16px">
            <button class="btn btn-primary" type="button" (click)="revealed.set(true)">
              <sf-icon name="eye" [size]="15" />
              Ver resposta
            </button>
          </div>
        }
      </div>
    } @else {
      <sf-page-header
        title="Revisão espaçada"
        subtitle="As questões que você errou voltam em intervalos crescentes — o mesmo princípio de um bom caderno de erros, sem trabalho manual."
      >
        <a actions class="btn btn-secondary" routerLink="/casos">
          <sf-icon name="play" [size]="15" />
          Treinar casos
        </a>
      </sf-page-header>
      <div class="grid dash-split">
        <div class="card card-pad" style="text-align: center">
          <div class="row" style="justify-content: center; margin-bottom: 12px">
            <sf-progress-ring [value]="0" [size]="100" [stroke]="9" label="0" />
          </div>
          <h2>Nenhum card vencido agora</h2>
          <p class="small muted" style="max-width: 380px; margin: 6px auto 0">
            @if (allCards().length === 0) {
              Ao errar uma questão, ela entra automaticamente na revisão. Você também pode criar cards ao abrir um caso.
            } @else {
              Você tem {{ allCards().length }} cards na revisão. O próximo vence {{ nextDue() }}.
            }
          </p>
          <div class="row" style="justify-content: center; gap: 8px; margin-top: 16px; flex-wrap: wrap">
            <a class="btn btn-secondary" routerLink="/casos">Escolher um caso</a>
            @if (allCards().length > 0) {
              <button class="btn btn-ghost" type="button" (click)="reviewEverything()">Revisar tudo agora</button>
            }
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Próximos cards</h3>
            <span class="tiny muted">{{ allCards().length }} no total</span>
          </div>
          <div class="card-body stack-sm">
            @if (upcoming().length === 0) {
              <p class="small muted">Sem cards agendados. Eles aparecem quando você erra questões ou cria cards de um caso.</p>
            } @else {
              @for (item of upcoming(); track item.id) {
                <div class="row between" style="gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line-2)">
                  <div style="min-width: 0">
                    <div
                      class="small"
                      style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px"
                    >
                      {{ item.caseTitle ?? item.topic ?? 'Card' }}
                    </div>
                    <div class="tiny muted">{{ item.area }} · {{ date(item.dueAt) }}</div>
                  </div>
                  <span class="badge badge-neutral">{{ item.intervalDays }}d</span>
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class ReviewPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  readonly grades = GRADES;
  readonly cards = signal<SrsCardDTO[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly queue = signal<SrsCardDTO[] | null>(null);
  readonly index = signal(0);
  readonly revealed = signal(false);
  readonly busy = signal(false);
  readonly counts = signal<Record<SrsGrade, number>>({ errei: 0, dificil: 0, bom: 0, facil: 0 });

  readonly allCards = computed(() => this.cards() ?? []);
  readonly due = computed(() => this.allCards().filter((card) => new Date(card.dueAt).getTime() <= Date.now()));
  readonly upcoming = computed(() =>
    this.allCards()
      .filter((card) => new Date(card.dueAt).getTime() > Date.now())
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, 6),
  );
  readonly nextDue = computed(() => relativeDate(this.upcoming()[0]?.dueAt));
  readonly activeQueue = computed(() => this.queue() ?? this.due());
  readonly card = computed(() => this.activeQueue()[this.index()] ?? null);
  readonly finished = computed(() => this.queue() !== null && this.index() >= this.activeQueue().length);
  readonly queueSize = computed(() => this.activeQueue().length);
  readonly progress = computed(() => {
    const total = this.queueSize();
    return total ? Math.round((this.index() / total) * 100) : 0;
  });
  readonly reviewed = computed(() => this.queueSize());
  readonly hitPct = computed(() => {
    const total = this.reviewed();
    const hits = this.counts().bom + this.counts().facil;
    return total ? Math.round((hits / total) * 100) : 0;
  });

  date = formatDate;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.srs
      .list()
      .then(({ cards }) => this.cards.set(cards))
      .catch((error) => this.error.set(errorMessage(error, 'Não foi possível carregar a revisão.')))
      .finally(() => this.loading.set(false));
  }

  reviewEverything(): void {
    this.queue.set(this.allCards());
    this.index.set(0);
    this.revealed.set(false);
  }

  async grade(value: SrsGrade): Promise<void> {
    const card = this.card();
    if (!card || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.srs.review(card.id, value);
      if (this.queue() === null) this.queue.set(this.due());
      window.dispatchEvent(new Event('sf:srs-changed'));
      this.counts.update((prev) => ({ ...prev, [value]: prev[value] + 1 }));
      this.revealed.set(false);
      this.index.update((prev) => prev + 1);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível registrar a revisão.'));
    } finally {
      this.busy.set(false);
    }
  }
}
