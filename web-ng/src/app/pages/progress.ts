import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AttemptDTO, StatsDTO } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { accuracyTone, formatShortDate, relativeDate } from '../core/format';
import { EmptyState, LoadingBlock, PageHeader, SectionCard, StatCard } from '../shared/ui';
import { Icon } from '../shared/icon';

const MODE_LABEL: Record<string, string> = {
  treino: 'Treino',
  simulado: 'Simulado',
  revisao: 'Revisão',
};

@Component({
  selector: 'sf-attempt-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    @let pct = pctValue();
    <div style="border-bottom: 1px solid var(--line-2); padding-bottom: 8px">
      <button
        class="row between"
        style="width: 100%; background: transparent; border: 0; padding: 6px 0; cursor: pointer; text-align: left; color: inherit"
        type="button"
        (click)="open.set(!open())"
      >
        <div style="min-width: 0">
          <div class="small" style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
            {{ attempt().caseTitle }}
          </div>
          <div class="tiny muted">
            {{ relDate(attempt().finishedAt ?? attempt().startedAt) }} · {{ attempt().area }} · {{ modeLabel[attempt().mode] ?? attempt().mode }}
            @if (minutes() !== null) {
              · {{ minutes() }} min
            }
          </div>
        </div>
        <div class="row" style="gap: 8px">
          <span [class]="'badge ' + (attempt().status === 'concluido' ? tone(pct) : 'badge-warn')">
            {{ attempt().score }}/{{ attempt().total }}
          </span>
          <sf-icon [name]="open() ? 'chevronDown' : 'chevronRight'" [size]="15" style="color: var(--muted)" />
        </div>
      </button>
      @if (open()) {
        <div class="stack-sm" style="padding: 6px 0 4px">
          @if (attempt().caseId) {
            <div class="row" style="gap: 8px">
              <a class="btn btn-secondary btn-sm" [routerLink]="'/casos/' + attempt().caseId">
                <sf-icon name="eye" [size]="13" /> Ver caso
              </a>
              <a class="btn btn-ghost btn-sm" [routerLink]="'/treinar/' + attempt().caseId">
                <sf-icon name="refresh" [size]="13" /> Refazer
              </a>
            </div>
          }
          @for (result of attempt().results; track result.questionId + $index) {
            <div class="small" style="display: flex; gap: 8px; align-items: flex-start">
              <span [class]="'badge ' + (result.correct ? 'badge-success' : 'badge-danger')" style="flex: none">
                {{ result.correct ? '✓' : '✕' }}
              </span>
              <span style="color: var(--ink-2)">{{ result.prompt }}</span>
            </div>
          }
          @if (attempt().results.length === 0) {
            <span class="tiny muted">Sem respostas registradas.</span>
          }
        </div>
      }
    </div>
  `,
})
export class AttemptRow {
  readonly attempt = input.required<AttemptDTO>();
  readonly open = signal(false);
  readonly modeLabel = MODE_LABEL;
  readonly tone = accuracyTone;
  readonly relDate = relativeDate;
  readonly pctValue = computed(() => {
    const item = this.attempt();
    return item.total ? Math.round((item.score / item.total) * 100) : 0;
  });
  readonly minutes = computed(() => {
    const duration = this.attempt().durationMs;
    return duration ? Math.round(duration / 60000) : null;
  });
}

@Component({
  selector: 'sf-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, AttemptRow, EmptyState, LoadingBlock, PageHeader, SectionCard, StatCard],
  template: `
    @if (loading()) {
      <sf-loading label="Calculando seu progresso…" />
    } @else if (error() || !stats()) {
      <sf-empty icon="alert" title="Não foi possível carregar o progresso" [description]="error() ?? 'Tente novamente.'">
        <button class="btn btn-secondary" type="button" (click)="load()">Tentar novamente</button>
      </sf-empty>
    } @else {
      @let data = stats()!;
      <sf-page-header title="Seu progresso" subtitle="O que já está sólido, o que precisa voltar e como está sua constância.">
        <a actions class="btn btn-secondary" [href]="exportUrl()">
          <sf-icon name="download" [size]="15" />
          Exportar CSV
        </a>
        <a actions class="btn btn-primary" routerLink="/simulado">
          <sf-icon name="play" [size]="15" />
          Novo simulado
        </a>
      </sf-page-header>

      <div class="grid grid-4" style="margin-bottom: 18px">
        <sf-stat label="Questões respondidas" [value]="data.totals.questionsAnswered">
          {{ data.totals.casesSolved }} casos concluídos
        </sf-stat>
        <sf-stat label="Acerto geral" [value]="data.totals.accuracy + '%'">
          tempo médio {{ data.totals.avgTimeSec ? data.totals.avgTimeSec + 's' : '—' }}
        </sf-stat>
        <sf-stat label="Sequência atual" [value]="data.totals.streak + ' d'">dias com estudo</sf-stat>
        <sf-stat label="Revisões pendentes" [value]="data.totals.dueCards">
          {{ data.totals.dueCards > 0 ? 'comece por elas' : 'revisão em dia' }}
        </sf-stat>
      </div>

      @if (data.totals.questionsAnswered === 0) {
        <sf-empty
          icon="chart"
          title="Ainda sem dados suficientes"
          description="Assim que você responder questões, esta página mostra desempenho por área, temas frágeis e histórico de treinos."
        >
          <a class="btn btn-primary" routerLink="/casos">Começar a treinar</a>
        </sf-empty>
      } @else {
        <div class="grid dash-split" style="margin-bottom: 18px">
          <sf-section title="Constância">
            <span action class="tiny muted">últimos 14 dias</span>
            <div class="chart">
              @for (day of data.daily; track day.date) {
                <div class="chart-col" [title]="shortDate(day.date) + ': ' + day.answered + ' questões, ' + day.correct + ' acertos'">
                  <div class="chart-bar" [class.empty]="day.answered === 0" [style.height.%]="barHeight(day.answered)"></div>
                  <span class="chart-x">{{ shortDate(day.date) }}</span>
                </div>
              }
            </div>
            <div class="divider"></div>
            <div class="row between small">
              <span class="muted">Meta diária</span>
              <strong>{{ data.goal.doneToday }} / {{ data.goal.target }}</strong>
            </div>
            <div class="progress" style="margin-top: 8px">
              <span [style.width.%]="goalPct(data)"></span>
            </div>
          </sf-section>

          <sf-section title="Desempenho por área">
            <span action class="tiny muted">% de acerto</span>
            <div class="stack">
              @if (data.byArea.length === 0) {
                <p class="small muted">Sem respostas por área ainda.</p>
              }
              @for (area of data.byArea; track area.area) {
                <div class="stack-sm">
                  <div class="row between small">
                    <span style="font-weight: 600">{{ area.area }}</span>
                    <span [class]="'badge ' + tone(area.accuracy)">{{ area.accuracy }}%</span>
                  </div>
                  <div class="progress"><span [style.width.%]="area.accuracy"></span></div>
                  <span class="tiny muted">{{ area.answered }} questões · {{ area.correct }} acertos</span>
                </div>
              }
            </div>
          </sf-section>
        </div>

        <div class="grid grid-2" style="margin-bottom: 18px">
          <sf-section title="Precisa reforçar">
            <span action class="tiny muted">até 75% de acerto</span>
            @if (data.weakTopics.length === 0) {
              <p class="small muted">Nenhum tema frágil identificado. Continue treinando para confirmar.</p>
            } @else {
              <div class="stack-sm">
                @for (topic of data.weakTopics; track topic.area + topic.topic) {
                  <div class="row between" style="gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line-2)">
                    <div style="min-width: 0">
                      <div class="small" style="font-weight: 600">{{ topic.topic }}</div>
                      <div class="tiny muted">{{ topic.area }} · {{ topic.answered }} questões</div>
                    </div>
                    <span [class]="'badge ' + tone(topic.accuracy)">{{ topic.accuracy }}%</span>
                  </div>
                }
                <a class="btn btn-secondary btn-sm" routerLink="/simulado" style="align-self: flex-start; margin-top: 4px">
                  Montar simulado destes temas
                </a>
              </div>
            }
          </sf-section>
          <sf-section title="Pontos fortes">
            <span action class="tiny muted">acima de 75%</span>
            @if (data.strongTopics.length === 0) {
              <p class="small muted">Ainda não há temas com desempenho consistente. É normal no começo.</p>
            } @else {
              <div class="stack-sm">
                @for (topic of data.strongTopics; track topic.area + topic.topic) {
                  <div class="row between" style="gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line-2)">
                    <div style="min-width: 0">
                      <div class="small" style="font-weight: 600">{{ topic.topic }}</div>
                      <div class="tiny muted">{{ topic.area }} · {{ topic.answered }} questões</div>
                    </div>
                    <span [class]="'badge ' + tone(topic.accuracy)">{{ topic.accuracy }}%</span>
                  </div>
                }
              </div>
            }
          </sf-section>
        </div>
      }

      <div class="card">
        <div class="card-head">
          <h3>Histórico de treinos</h3>
          <span class="tiny muted">{{ history().length }} registros</span>
        </div>
        <div class="card-body">
          @if (attemptsLoading()) {
            <sf-loading label="Carregando histórico…" />
          } @else if (history().length === 0) {
            <p class="small muted">Nenhum treino concluído ainda.</p>
          } @else {
            <div class="stack-sm">
              @for (attempt of history(); track attempt.id) {
                <sf-attempt-row [attempt]="attempt" />
              }
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class ProgressPage {
  private readonly api = inject(Api);

  readonly stats = signal<StatsDTO | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly history = signal<AttemptDTO[]>([]);
  readonly attemptsLoading = signal(true);

  tone = accuracyTone;
  shortDate = formatShortDate;

  constructor() {
    this.load();
    this.api.attempts
      .list(30)
      .then(({ attempts }) => this.history.set(attempts))
      .catch(() => undefined)
      .finally(() => this.attemptsLoading.set(false));
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

  exportUrl(): string {
    return this.api.stats.exportUrl();
  }

  barHeight(answered: number): number {
    const max = Math.max(1, ...(this.stats()?.daily.map((day) => day.answered) ?? [1]));
    return answered === 0 ? 3 : Math.max(8, Math.round((answered / max) * 100));
  }

  goalPct(data: StatsDTO): number {
    return Math.min(100, Math.round((data.goal.doneToday / Math.max(1, data.goal.target)) * 100));
  }
}
