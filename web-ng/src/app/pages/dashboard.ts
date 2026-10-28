import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SettingsDTO, StatsDTO } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { AuthService } from '../core/auth';
import { accuracyTone, formatShortDate, plural, relativeDate } from '../core/format';
import { EmptyState, LoadingBlock, ProgressRing, SectionCard, StatCard } from '../shared/ui';
import { Icon } from '../shared/icon';

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

@Component({
  selector: 'sf-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, EmptyState, LoadingBlock, ProgressRing, SectionCard, StatCard],
  template: `
    @if (loading()) {
      <sf-loading label="Preparando seu painel…" />
    } @else if (error() || !stats()) {
      <sf-empty icon="alert" title="Não foi possível carregar o painel" [description]="error() ?? 'Tente novamente.'">
        <button class="btn btn-secondary" type="button" (click)="load()">Tentar novamente</button>
      </sf-empty>
    } @else {
      @let data = stats()!;
      <div class="hero">
        <div>
          <h1>{{ greetingText }}, {{ firstName() }}.</h1>
          <p>
            @if (examDays() !== null && examDays()! >= 0) {
              Faltam {{ pluralText(examDays()!, 'dia', 'dias') }} para a sua prova.
            }
            @if (data.totals.dueCards > 0) {
              Você tem {{ pluralText(data.totals.dueCards, 'card', 'cards') }} de revisão esperando — começar por eles rende mais.
            } @else {
              Treine com casos clínicos ou envie um novo material para ampliar seu banco de questões.
            }
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" routerLink="/simulado">
              <sf-icon name="play" [size]="15" />
              Montar simulado
            </a>
            <a class="btn btn-secondary" routerLink="/materiais">
              <sf-icon name="upload" [size]="15" />
              Enviar material
            </a>
            <a class="btn btn-ghost" routerLink="/descobrir">
              <sf-icon name="globe" [size]="15" />
              Descobrir conteúdo
            </a>
            @if (data.totals.dueCards > 0) {
              <a class="btn btn-ghost" routerLink="/revisao">Revisar {{ data.totals.dueCards }}</a>
            }
          </div>
        </div>
        <div class="hero-ring">
          <sf-progress-ring [value]="goalPct(data)" [size]="82" />
          <div>
            <div class="tiny muted" style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em">Meta diária</div>
            <div style="font-weight: 700; font-size: 16px">{{ data.goal.doneToday }} de {{ target(data) }} questões</div>
            <div class="tiny muted">{{ goalPct(data) >= 100 ? 'Meta batida. Bom trabalho!' : 'Cada questão conta.' }}</div>
          </div>
        </div>
      </div>

      @if (isEmpty(data)) {
        <div class="card card-pad" style="margin-bottom: 18px; background: linear-gradient(180deg,#ffffff,#f8fcfb)">
          <div class="row between" style="align-items: flex-start; gap: 18px; flex-wrap: wrap">
            <div style="max-width: 560px">
              <span class="badge badge-brand" style="margin-bottom: 8px">Comece por aqui</span>
              <h2>Três passos para transformar seu material em treino</h2>
              <p class="small muted" style="margin-top: 6px">
                Você pode subir uma prova antiga, um capítulo de livro ou um resumo. O Study Flux identifica os temas, monta casos
                e guarda o que você errou para revisar depois.
              </p>
            </div>
            <div class="stack-sm" style="min-width: 0; flex: 1; max-width: 420px">
              @for (step of steps; track step.title) {
                <div class="row" style="align-items: flex-start; gap: 10px">
                  <div class="file-icon" style="width: 32px; height: 32px; border-radius: 9px">
                    <sf-icon [name]="step.icon" [size]="15" />
                  </div>
                  <div>
                    <strong class="small">{{ step.title }}</strong>
                    <div class="tiny muted">{{ step.text }}</div>
                  </div>
                </div>
              }
              <div class="row" style="gap: 6px; margin-top: 4px; flex-wrap: wrap">
                <a class="btn btn-primary btn-sm" routerLink="/materiais">
                  Enviar material
                  <sf-icon name="arrowRight" [size]="14" />
                </a>
                <a class="btn btn-secondary btn-sm" routerLink="/descobrir">
                  <sf-icon name="globe" [size]="14" />
                  Buscar em acervos
                </a>
              </div>
            </div>
          </div>
        </div>
      }

      <div class="grid grid-4" style="margin-bottom: 18px">
        <sf-stat label="Casos concluídos" [value]="data.totals.casesSolved">
          {{ data.totals.publishedCases }} casos publicados
        </sf-stat>
        <sf-stat label="Questões respondidas" [value]="data.totals.questionsAnswered">
          {{ data.byArea.length }} áreas treinadas
        </sf-stat>
        <sf-stat label="Acerto geral" [value]="data.totals.accuracy + '%'">
          <span [class]="'badge ' + tone(data.totals.accuracy)" style="margin-top: 2px">
            {{ data.totals.accuracy >= 80 ? 'Muito bom' : data.totals.accuracy >= 60 ? 'Evoluindo' : 'Atenção' }}
          </span>
        </sf-stat>
        <sf-stat label="Sequência" [value]="data.totals.streak + ' d'">{{ data.totals.dueCards }} cards para revisar</sf-stat>
      </div>

      <div class="grid dash-split" style="margin-bottom: 18px">
        <sf-section title="Atividade dos últimos 14 dias">
          <span action class="tiny muted">questões por dia</span>
          @if (data.totals.questionsAnswered === 0) {
            <p class="small muted" style="padding: 18px 0">
              Sem respostas ainda. Assim que você treinar, o gráfico mostra sua constância.
            </p>
          } @else {
            <div class="chart">
              @for (day of data.daily; track day.date) {
                <div class="chart-col" [title]="shortDate(day.date) + ': ' + day.answered + ' questões, ' + day.correct + ' acertos'">
                  <div class="chart-bar" [class.empty]="day.answered === 0" [style.height.%]="barHeight(day.answered, maxDaily(data))"></div>
                  <span class="chart-x">{{ shortDate(day.date) }}</span>
                </div>
              }
            </div>
            <div class="divider"></div>
            <div class="row between small">
              <span class="muted">Total no período</span>
              <strong>{{ totalPeriod(data) }} questões</strong>
            </div>
          }
        </sf-section>

        <sf-section title="Revisão de hoje">
          @if (data.totals.dueCards > 0) {
            <span action class="badge badge-warn">{{ data.totals.dueCards }}</span>
          }
          @if (data.totals.dueCards > 0) {
            <p class="small muted" style="margin-bottom: 14px">
              Cards de questões que você errou ou marcou como difíceis. Revisar agora é o que consolida a memória.
            </p>
            <a class="btn btn-primary btn-block" routerLink="/revisao">
              <sf-icon name="layers" [size]="15" />
              Revisar {{ data.totals.dueCards }} cards
            </a>
          } @else {
            <div class="stack-sm">
              <div class="row" style="gap: 10px">
                <div class="file-icon" style="width: 34px; height: 34px; border-radius: 10px">
                  <sf-icon name="check" [size]="16" />
                </div>
                <div>
                  <strong class="small">Revisão em dia</strong>
                  <div class="tiny muted">Nenhum card vencido agora.</div>
                </div>
              </div>
              <a class="btn btn-secondary btn-sm" routerLink="/casos" style="align-self: flex-start">Praticar mais casos</a>
            </div>
          }
          <div class="divider"></div>
          <div class="row between small">
            <span class="muted">Tempo médio por questão</span>
            <strong>{{ data.totals.avgTimeSec > 0 ? data.totals.avgTimeSec + 's' : '—' }}</strong>
          </div>
          <div class="row between small" style="margin-top: 6px">
            <span class="muted">Materiais enviados</span>
            <strong>{{ data.totals.materials }}</strong>
          </div>
        </sf-section>
      </div>

      <div class="grid grid-2" style="margin-bottom: 18px">
        <sf-section title="Pontos para reforçar">
          <span action class="tiny muted">acerto abaixo de 75%</span>
          @if (data.weakTopics.length === 0) {
            <p class="small muted">
              {{
                data.byArea.length === 0
                  ? 'Responda algumas questões para identificar seus temas mais frágeis.'
                  : 'Nenhum tema frágil identificado ainda. Continue treinando para consolidar.'
              }}
            </p>
          } @else {
            <div class="stack">
              @for (topic of data.weakTopics; track topic.area + topic.topic) {
                <div class="stack-sm">
                  <div class="row between">
                    <div style="min-width: 0">
                      <div style="font-weight: 600; font-size: 13px">{{ topic.topic }}</div>
                      <div class="tiny muted">{{ topic.area }} · {{ pluralText(topic.answered, 'questão', 'questões') }}</div>
                    </div>
                    <span [class]="'badge ' + tone(topic.accuracy)">{{ topic.accuracy }}%</span>
                  </div>
                  <div class="progress"><span [style.width.%]="topic.accuracy"></span></div>
                </div>
              }
              <a class="btn btn-secondary btn-sm" routerLink="/simulado" style="align-self: flex-start">Treinar estes temas</a>
            </div>
          }
        </sf-section>

        <sf-section title="Últimos treinos">
          <a action class="tiny" routerLink="/progresso">ver histórico</a>
          @if (data.recentAttempts.length === 0) {
            <p class="small muted">Nenhum treino concluído ainda. Escolha um caso da biblioteca para começar.</p>
          } @else {
            <div class="stack-sm">
              @for (attempt of data.recentAttempts; track attempt.id) {
                <a
                  [routerLink]="attempt.caseId ? '/casos/' + attempt.caseId : '/progresso'"
                  class="row between"
                  style="text-decoration: none; color: inherit; padding: 6px 0; border-bottom: 1px solid var(--line-2)"
                >
                  <div style="min-width: 0">
                    <div style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                      {{ attempt.caseTitle }}
                    </div>
                    <div class="tiny muted">{{ attempt.area }} · {{ relDate(attempt.finishedAt ?? attempt.startedAt) }}</div>
                  </div>
                  <span [class]="'badge ' + tone(attemptPct(attempt.score, attempt.total))">
                    {{ attempt.score }}/{{ attempt.total }}
                  </span>
                </a>
              }
            </div>
          }
        </sf-section>
      </div>
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  readonly stats = signal<StatsDTO | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly greetingText = greeting();
  readonly steps = [
    { icon: 'upload', title: '1. Traga o material', text: 'PDF, prova com gabarito, texto colado, link ou busca em acervos abertos.' },
    { icon: 'sparkles', title: '2. Gere os casos', text: 'Modo estruturado (sem IA) ou caso clínico completo com IA.' },
    { icon: 'play', title: '3. Treine e revisar', text: 'Feedback imediato com o trecho do material na justificativa.' },
  ];

  private readonly settings = signal<SettingsDTO | null>(null);

  readonly firstName = computed(() => this.auth.user()?.name?.split(' ')[0] ?? 'estudante');
  readonly examDays = computed(() => daysUntil(this.settings()?.examDate ?? null));

  constructor() {
    this.load();
    this.api.settings
      .get()
      .then((settings) => this.settings.set(settings))
      .catch(() => undefined);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.stats
      .get()
      .then((stats) => this.stats.set(stats))
      .catch((error) => this.error.set(errorMessage(error)))
      .finally(() => this.loading.set(false));
  }

  target(data: StatsDTO): number {
    return data.goal.target || 20;
  }

  goalPct(data: StatsDTO): number {
    return Math.min(100, Math.round((data.goal.doneToday / this.target(data)) * 100));
  }

  isEmpty(data: StatsDTO): boolean {
    return data.totals.questionsAnswered === 0 && data.totals.materials === 0;
  }

  maxDaily(data: StatsDTO): number {
    return Math.max(1, ...data.daily.map((day) => day.answered));
  }

  barHeight(answered: number, max: number): number {
    return answered === 0 ? 3 : Math.max(8, Math.round((answered / max) * 100));
  }

  totalPeriod(data: StatsDTO): number {
    return data.daily.reduce((acc, day) => acc + day.answered, 0);
  }

  attemptPct(score: number, total: number): number {
    return total ? Math.round((score / total) * 100) : 0;
  }

  tone = accuracyTone;
  shortDate = formatShortDate;
  relDate = relativeDate;
  pluralText = plural;
}
