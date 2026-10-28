import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { CaseDetail } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { ToastService } from '../core/toast';
import { difficultyLabel, difficultyTone, formatLabel, originLabel, relativeDate, statusLabel } from '../core/format';
import { CasePresentation } from '../shared/case-presentation';
import { EmptyState, LoadingBlock, PageHeader } from '../shared/ui';
import { Icon } from '../shared/icon';

@Component({
  selector: 'sf-case-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CasePresentation, EmptyState, LoadingBlock, PageHeader],
  template: `
    @if (loading()) {
      <sf-loading label="Abrindo caso…" />
    } @else if (error() || !item()) {
      <sf-empty
        icon="alert"
        title="Caso não encontrado"
        [description]="error() ?? 'Talvez ele tenha sido removido ou esteja como rascunho de outra pessoa.'"
      >
        <a class="btn btn-secondary" routerLink="/casos">Voltar para a biblioteca</a>
      </sf-empty>
    } @else {
      @let data = item()!;
      <sf-page-header [title]="data.title">
        <p subtitle class="row row-wrap" style="gap: 6px">
          <span>{{ data.area }}</span>
          <span>·</span>
          <span>{{ data.topic }}</span>
          <span>·</span>
          <span>{{ formatLabel[data.format] }} com {{ data.questionCount }} perguntas</span>
          <span>·</span>
          <span>atualizado {{ relDate(data.updatedAt) }}</span>
        </p>
        <a actions class="btn btn-ghost" routerLink="/casos">
          <sf-icon name="arrowLeft" [size]="15" />
          Biblioteca
        </a>
        @if (data.canEdit) {
          <a actions class="btn btn-secondary" [routerLink]="'/casos/' + data.id + '/editar'">
            <sf-icon name="edit" [size]="15" />
            Editar
          </a>
        }
        <a actions class="btn btn-primary" [routerLink]="'/treinar/' + data.id">
          <sf-icon name="play" [size]="15" />
          Treinar este caso
        </a>
      </sf-page-header>

      <div class="row row-wrap" style="gap: 6px; margin-bottom: 18px">
        <span [class]="'badge ' + (difficultyTone[data.difficulty] ?? 'badge-neutral')">{{ difficultyLabel[data.difficulty] }}</span>
        <span [class]="'badge ' + (data.status === 'publicado' ? 'badge-success' : 'badge-warn')">{{ statusLabel[data.status] }}</span>
        <span class="badge badge-neutral">{{ originLabel[data.origin] }}</span>
        @if (data.sourceTitle) {
          <span class="badge badge-info">{{ data.sourceTitle }}</span>
        }
        @if (!data.canEdit) {
          <span class="badge badge-brand">Caso da comunidade</span>
        }
        @if (data.attempts) {
          <span class="badge badge-neutral">{{ data.attempts }} treinos · {{ data.accuracy }}% de acerto</span>
        }
      </div>

      <div class="grid dash-split">
        <div class="card">
          <div class="card-head">
            <h3>Apresentação do caso</h3>
            <span class="tiny muted">leitura de {{ data.minutes }} min</span>
          </div>
          <div class="card-body">
            <sf-case-presentation [presentation]="data.data.presentation" [objectives]="data.data.objectives" />
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head">
              <h3>Perguntas ({{ data.data.questions.length }})</h3>
              <button class="btn btn-ghost btn-sm" type="button" (click)="showAnswers.set(!showAnswers())">
                <sf-icon name="eye" [size]="14" />
                {{ showAnswers() ? 'Ocultar gabarito' : 'Mostrar gabarito' }}
              </button>
            </div>
            <div class="card-body stack">
              @for (question of data.data.questions; track question.id; let index = $index) {
                <div style="padding-bottom: 14px; border-bottom: 1px solid var(--line-2)">
                  <div class="row" style="gap: 8px; align-items: baseline; margin-bottom: 6px">
                    <span class="badge badge-neutral">Pergunta {{ index + 1 }}</span>
                    @if (question.keyPoint) {
                      <span class="tiny muted">{{ question.keyPoint }}</span>
                    }
                  </div>
                  <div class="draft-q" style="font-weight: 600">{{ question.prompt }}</div>
                  <div class="draft-options">
                    @for (option of question.options; track option.id) {
                      <div [class]="'draft-option' + (showAnswers() && option.id === question.correctOptionId ? ' correct' : '')">
                        {{ option.id.toUpperCase() }}) {{ option.text }}
                      </div>
                    }
                  </div>
                  @if (showAnswers()) {
                    <div class="feedback ok" style="margin-top: 10px">
                      <div class="feedback-title">
                        <sf-icon name="check" [size]="15" />
                        Alternativa correta: {{ question.correctOptionId.toUpperCase() }}
                      </div>
                      <span class="small">{{ question.rationale }}</span>
                      @if (question.sourceExcerpt) {
                        <div class="quote">{{ question.sourceExcerpt }}</div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          @if (data.data.teachingPoints.length > 0) {
            <div class="card">
              <div class="card-head"><h3>Pontos-chave</h3></div>
              <div class="card-body">
                <ul class="clinical-list">
                  @for (point of data.data.teachingPoints; track $index) {
                    <li>{{ point }}</li>
                  }
                </ul>
              </div>
            </div>
          }

          @if (data.data.sourceRefs.length > 0) {
            <div class="card">
              <div class="card-head"><h3>Fontes</h3></div>
              <div class="card-body stack-sm">
                @for (ref of data.data.sourceRefs; track $index) {
                  <div class="small">
                    <strong>{{ ref.label }}</strong>
                    @if (ref.excerpt) {
                      <div class="quote" style="margin-top: 4px">{{ ref.excerpt }}</div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          @if (data.data.generation.warnings.length > 0) {
            <div class="card card-pad">
              <div class="row" style="gap: 8px; align-items: flex-start">
                <sf-icon name="info" [size]="16" style="color: var(--muted); flex: none; margin-top: 2px" />
                <div class="tiny muted">{{ data.data.generation.warnings.join(' ') }}</div>
              </div>
            </div>
          }

          <div class="card card-pad">
            <div class="row" style="gap: 8px; flex-wrap: wrap">
              <a class="btn btn-secondary btn-sm" [routerLink]="'/treinar/' + data.id">
                <sf-icon name="play" [size]="14" />
                Treinar
              </a>
              <button class="btn btn-secondary btn-sm" type="button" (click)="duplicate(data)">
                <sf-icon name="copy" [size]="14" />
                Duplicar
              </button>
              <a class="btn btn-secondary btn-sm" [href]="exportUrl(data.id)">
                <sf-icon name="download" [size]="14" />
                Exportar
              </a>
              @if (data.canEdit) {
                <button class="btn btn-secondary btn-sm" type="button" (click)="togglePublish(data)">
                  <sf-icon [name]="data.status === 'publicado' ? 'eye' : 'bookmark'" [size]="14" />
                  {{ data.status === 'publicado' ? 'Despublicar' : 'Publicar' }}
                </button>
                <button class="btn btn-danger-ghost btn-sm" type="button" (click)="remove(data)">
                  <sf-icon name="trash" [size]="14" />
                  Excluir
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class CaseDetailPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly item = signal<CaseDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showAnswers = signal(false);

  private readonly caseId = Number(this.route.snapshot.paramMap.get('id'));

  formatLabel = formatLabel;
  difficultyLabel = difficultyLabel;
  difficultyTone = difficultyTone;
  statusLabel = statusLabel;
  originLabel = originLabel;
  relDate = relativeDate;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.cases
      .get(this.caseId)
      .then(({ case: item }) => this.item.set(item))
      .catch((error) => this.error.set(errorMessage(error, 'Não foi possível abrir o caso.')))
      .finally(() => this.loading.set(false));
  }

  exportUrl(id: number): string {
    return this.api.cases.exportUrl(id);
  }

  async togglePublish(item: CaseDetail): Promise<void> {
    try {
      await this.api.cases.publish(item.id, item.status !== 'publicado');
      this.toast.success(item.status === 'publicado' ? 'Caso despublicado.' : 'Caso publicado.');
      this.load();
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível alterar.'));
    }
  }

  async duplicate(item: CaseDetail): Promise<void> {
    try {
      const result = await this.api.cases.duplicate(item.id);
      this.toast.success('Caso duplicado para você.');
      await this.router.navigate(['/casos', result.case.id, 'editar']);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível duplicar.'));
    }
  }

  async remove(item: CaseDetail): Promise<void> {
    if (!window.confirm(`Excluir “${item.title}”?`)) return;
    try {
      await this.api.cases.remove(item.id);
      this.toast.success('Caso excluído.');
      await this.router.navigate(['/casos']);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível excluir.'));
    }
  }
}
