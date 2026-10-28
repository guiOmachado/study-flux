import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AREAS } from '@shared/types';
import type { CaseSummary } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { ToastService } from '../core/toast';
import { accuracyTone, difficultyLabel, difficultyTone, formatLabel, originLabel, relativeDate, statusLabel } from '../core/format';
import { EmptyState, LoadingBlock, PageHeader } from '../shared/ui';
import { Icon } from '../shared/icon';

@Component({
  selector: 'sf-cases',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, EmptyState, LoadingBlock, PageHeader],
  template: `
    <sf-page-header
      title="Biblioteca de casos"
      subtitle="Seus casos e os publicados por outros estudantes. Rascunhos só aparecem para você."
    >
      <a actions class="btn btn-secondary" routerLink="/materiais">
        <sf-icon name="sparkles" [size]="15" />
        Gerar de material
      </a>
      <a actions class="btn btn-primary" routerLink="/casos/novo">
        <sf-icon name="plus" [size]="15" />
        Novo caso
      </a>
    </sf-page-header>

    <div class="toolbar">
      <div class="search-wrap">
        <sf-icon name="search" [size]="16" />
        <input class="input" placeholder="Buscar por título ou tema…" [value]="search()" (input)="onSearch($event)" />
      </div>
      <select class="select" [value]="area()" (change)="onArea($event)" aria-label="Filtrar por área">
        <option value="">Todas as áreas</option>
        @for (item of areas; track item) {
          <option [value]="item">{{ item }}</option>
        }
      </select>
      <select class="select" [value]="difficulty()" (change)="onDifficulty($event)" aria-label="Filtrar por dificuldade">
        <option value="">Dificuldade</option>
        <option value="facil">Fácil</option>
        <option value="media">Média</option>
        <option value="dificil">Difícil</option>
      </select>
      <select class="select" [value]="mine() ? 'mine' : 'all'" (change)="setMine($event)" aria-label="Escopo">
        <option value="mine">Meus casos</option>
        <option value="all">Todos (inclui comunidade)</option>
      </select>
      @if (mine()) {
        <select class="select" [value]="status()" (change)="onStatus($event)" aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          <option value="publicado">Publicados</option>
          <option value="rascunho">Rascunhos</option>
          <option value="arquivado">Arquivados</option>
        </select>
      }
    </div>

    @if (sourceId()) {
      <div class="row" style="margin-bottom: 14px; gap: 8px">
        <span class="badge badge-brand">Filtrando pelo material selecionado</span>
        <a class="tiny" routerLink="/casos">limpar filtro</a>
      </div>
    }

    @if (loading()) {
      <sf-loading label="Carregando casos…" />
    } @else if (error()) {
      <sf-empty icon="alert" title="Não foi possível carregar a biblioteca" [description]="error()!">
        <button class="btn btn-secondary" type="button" (click)="load()">Tentar novamente</button>
      </sf-empty>
    } @else if (cases().length === 0) {
      <sf-empty
        icon="library"
        title="Nenhum caso encontrado"
        [description]="
          mine()
            ? 'Gere casos a partir de um material ou crie um caso manualmente. Depois de publicar, eles aparecem aqui para treinar.'
            : 'Ajuste os filtros ou envie um material para gerar novos casos.'
        "
      >
        <div class="row" style="gap: 8px">
          <a class="btn btn-secondary" routerLink="/materiais">Enviar material</a>
          <a class="btn btn-primary" routerLink="/casos/novo">Criar caso manualmente</a>
        </div>
      </sf-empty>
    } @else {
      <div class="tiny muted" style="margin-bottom: 10px">{{ total() }} caso{{ total() === 1 ? '' : 's' }}</div>
      <div class="case-grid">
        @for (item of cases(); track item.id) {
          @let own = item.canEdit !== false;
          <article class="case-card">
            <div class="row row-wrap" style="gap: 6px">
              <span class="badge badge-neutral">{{ item.area }}</span>
              <span [class]="'badge ' + (difficultyTone[item.difficulty] ?? 'badge-neutral')">
                {{ difficultyLabel[item.difficulty] ?? item.difficulty }}
              </span>
              @if (item.status !== 'publicado') {
                <span class="badge badge-warn">{{ statusLabel[item.status] }}</span>
              }
              <span class="spacer"></span>
              <span class="tiny muted">{{ relDate(item.updatedAt) }}</span>
            </div>
            <h3>{{ item.title }}</h3>
            <div class="meta">
              <span>{{ formatLabel[item.format] ?? item.format }}</span>
              <span>·</span>
              <span>{{ item.questionCount }} perguntas</span>
              <span>·</span>
              <span>{{ item.minutes }} min</span>
              @if (item.attempts) {
                <span>·</span>
                <span>{{ item.attempts }} treino{{ item.attempts === 1 ? '' : 's' }}</span>
              }
            </div>
            <div class="tags">
              <span class="badge badge-neutral">{{ originLabel[item.origin] ?? item.origin }}</span>
              @if (item.sourceTitle) {
                <span class="badge badge-info" style="max-width: 190px; overflow: hidden; text-overflow: ellipsis">{{ item.sourceTitle }}</span>
              }
              @if (item.accuracy !== null && item.accuracy !== undefined) {
                <span [class]="'badge ' + tone(item.accuracy)">{{ item.accuracy }}% de acerto</span>
              }
            </div>
            <div class="case-actions">
              <a class="btn btn-primary btn-sm" [routerLink]="'/treinar/' + item.id">
                <sf-icon name="play" [size]="13" />
                Treinar
              </a>
              <a class="btn btn-secondary btn-sm" [routerLink]="'/casos/' + item.id">Ver</a>
              <span class="spacer"></span>
              <details class="menu">
                <summary class="icon-btn" aria-label="Mais ações" title="Mais ações">
                  <sf-icon name="settings" [size]="15" />
                </summary>
                <div class="menu-panel">
                  @if (own) {
                    <a class="menu-item" [routerLink]="'/casos/' + item.id + '/editar'">
                      <sf-icon name="edit" [size]="14" /> Editar
                    </a>
                  }
                  @if (own) {
                    <button class="menu-item" type="button" (click)="togglePublish(item)">
                      <sf-icon [name]="item.status === 'publicado' ? 'eye' : 'bookmark'" [size]="14" />
                      {{ item.status === 'publicado' ? 'Despublicar' : 'Publicar' }}
                    </button>
                  }
                  <button class="menu-item" type="button" (click)="duplicate(item)">
                    <sf-icon name="copy" [size]="14" /> Duplicar para mim
                  </button>
                  <a class="menu-item" [href]="exportUrl(item.id)">
                    <sf-icon name="download" [size]="14" /> Exportar JSON
                  </a>
                  @if (own) {
                    <button class="menu-item danger" type="button" (click)="remove(item)">
                      <sf-icon name="trash" [size]="14" /> Excluir
                    </button>
                  }
                </div>
              </details>
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class CasesPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly areas = AREAS;
  readonly cases = signal<CaseSummary[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly search = signal('');
  readonly area = signal('');
  readonly difficulty = signal('');
  readonly mine = signal(true);
  readonly status = signal('');
  readonly sourceId = signal<number | undefined>(undefined);

  private debounce?: ReturnType<typeof setTimeout>;
  private requestId = 0;

  constructor() {
    const fonte = this.route.snapshot.queryParamMap.get('fonte');
    if (fonte && Number.isFinite(Number(fonte))) this.sourceId.set(Number(fonte));
    this.load();
  }

  value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  setMine(event: Event): void {
    this.mine.set(this.value(event) === 'mine');
    this.load();
  }

  onArea(event: Event): void {
    this.area.set(this.value(event));
    this.load();
  }

  onDifficulty(event: Event): void {
    this.difficulty.set(this.value(event));
    this.load();
  }

  onStatus(event: Event): void {
    this.status.set(this.value(event));
    this.load();
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.load(), 400);
  }

  load(): void {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    this.api.cases
      .list({
        q: this.search().trim() || undefined,
        area: this.area() || undefined,
        difficulty: this.difficulty() || undefined,
        mine: this.mine(),
        status: this.status() || undefined,
        sourceId: this.sourceId(),
      })
      .then((result) => {
        if (requestId !== this.requestId) return;
        this.cases.set(result.cases);
        this.total.set(result.total);
      })
      .catch((error) => {
        if (requestId === this.requestId) this.error.set(errorMessage(error));
      })
      .finally(() => {
        if (requestId === this.requestId) this.loading.set(false);
      });
  }

  exportUrl(id: number): string {
    return this.api.cases.exportUrl(id);
  }

  tone = accuracyTone;
  relDate = relativeDate;
  difficultyLabel = difficultyLabel;
  difficultyTone = difficultyTone;
  statusLabel = statusLabel;
  formatLabel = formatLabel;
  originLabel = originLabel;

  async duplicate(item: CaseSummary): Promise<void> {
    try {
      const result = await this.api.cases.duplicate(item.id);
      this.toast.success('Caso duplicado para você.');
      await this.router.navigate(['/casos', result.case.id, 'editar']);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível duplicar.'));
    }
  }

  async remove(item: CaseSummary): Promise<void> {
    if (!window.confirm(`Excluir “${item.title}”? O histórico de respostas é mantido.`)) return;
    try {
      await this.api.cases.remove(item.id);
      this.toast.success('Caso excluído.');
      this.load();
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível excluir.'));
    }
  }

  async togglePublish(item: CaseSummary): Promise<void> {
    try {
      await this.api.cases.publish(item.id, item.status !== 'publicado');
      this.toast.success(item.status === 'publicado' ? 'Caso voltou para rascunho.' : 'Caso publicado na sua biblioteca.');
      this.load();
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível alterar a publicação.'));
    }
  }
}
