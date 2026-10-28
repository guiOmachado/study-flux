import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AREAS } from '@shared/types';
import type { SourceSummary } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { ToastService } from '../core/toast';
import { formatDate, kindLabel, plural } from '../core/format';
import { EmptyState, LoadingBlock, Modal, PageHeader } from '../shared/ui';
import { Icon } from '../shared/icon';

@Component({
  selector: 'sf-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, EmptyState, LoadingBlock, Modal, PageHeader],
  template: `
    <sf-page-header
      title="Materiais de estudo"
      subtitle="Envie provas antigas, capítulos de livros ou resumos. O Study Flux lê o conteúdo e mostra o que conseguiu identificar antes de gerar os casos."
    >
      <a actions class="btn btn-ghost" routerLink="/descobrir">
        <sf-icon name="globe" [size]="15" />
        Descobrir conteúdo
      </a>
      <a actions class="btn btn-secondary" routerLink="/casos/novo">
        <sf-icon name="edit" [size]="15" />
        Criar caso manualmente
      </a>
      <button actions class="btn btn-primary" type="button" (click)="open.set(true)">
        <sf-icon name="plus" [size]="15" />
        Novo material
      </button>
    </sf-page-header>

    @if (loading()) {
      <sf-loading />
    } @else if (error()) {
      <sf-empty icon="alert" title="Não foi possível carregar seus materiais" [description]="error()!">
        <button class="btn btn-secondary" type="button" (click)="load()">Tentar novamente</button>
      </sf-empty>
    } @else if (sources().length === 0) {
      <sf-empty
        icon="folder"
        title="Nenhum material ainda"
        description="Envie uma prova antiga com gabarito, um capítulo ou cole um texto direto. Se preferir, busque artigos e capítulos abertos em Descobrir."
      >
        <div class="row" style="gap: 8px">
          <a class="btn btn-secondary" routerLink="/descobrir">
            <sf-icon name="globe" [size]="15" />
            Buscar em acervos
          </a>
          <button class="btn btn-primary" type="button" (click)="open.set(true)">
            <sf-icon name="upload" [size]="15" />
            Enviar meu primeiro material
          </button>
        </div>
      </sf-empty>
    } @else {
      <div class="stack">
        @for (source of sources(); track source.id) {
          <div class="card source-card">
            <div class="file-icon"><sf-icon name="file" [size]="19" /></div>
            <div style="min-width: 0">
              <div class="row row-wrap" style="gap: 8px">
                <a [routerLink]="'/materiais/' + source.id" style="color: inherit; font-weight: 650; font-size: 15px">{{ source.title }}</a>
                @switch (true) {
                  @case (source.status === 'erro') {
                    <span class="badge badge-danger">Erro na análise</span>
                  }
                  @case (source.status === 'gerado') {
                    <span class="badge badge-success">{{ source.caseCount }} casos gerados</span>
                  }
                  @case (source.status === 'processando') {
                    <span class="badge badge-info">Analisando</span>
                  }
                  @default {
                    <span class="badge badge-brand">Analisado</span>
                  }
                }
              </div>
              <div class="tiny muted" style="margin-top: 4px">
                {{ kindLabel(source.kind) }}
                @if (source.discipline) {
                  · {{ source.discipline }}
                }
                @if (source.pages) {
                  · {{ pluralText(source.pages, 'página', 'páginas') }}
                }
                @if (source.analysis) {
                  · {{ words(source.analysis.words) }} palavras
                }
                · {{ date(source.createdAt) }}
              </div>
              @if (source.analysis) {
                <div class="pill-list" style="margin-top: 8px">
                  @for (topic of source.analysis.topics.slice(0, 4); track topic) {
                    <span class="badge badge-neutral">{{ topic }}</span>
                  }
                  @if (source.analysis.examQuestions > 0) {
                    <span class="badge badge-info">
                      {{ source.analysis.examQuestions }} questões · {{ source.analysis.examQuestionsWithKey }} com gabarito
                    </span>
                  }
                  @if (source.analysis.topics.length === 0 && source.analysis.examQuestions === 0) {
                    <span class="badge badge-warn">Sem temas reconhecidos — veja a análise</span>
                  }
                </div>
              }
              @if (source.error) {
                <div class="tiny" style="color: var(--danger); margin-top: 6px">{{ source.error }}</div>
              }
            </div>
            <div class="source-actions row" style="gap: 6px; flex-wrap: wrap; justify-content: flex-end">
              <a class="btn btn-secondary btn-sm" [routerLink]="'/materiais/' + source.id">
                <sf-icon name="eye" [size]="14" />
                Ver análise
              </a>
              <button class="btn btn-primary btn-sm" type="button" (click)="generate(source)">
                <sf-icon name="sparkles" [size]="14" />
                Gerar casos
              </button>
              <button class="icon-btn" type="button" (click)="remove(source)" aria-label="Excluir material" title="Excluir material">
                <sf-icon name="trash" [size]="15" />
              </button>
            </div>
          </div>
        }
      </div>
    }

    <sf-modal
      [open]="open()"
      title="Novo material de estudo"
      description="Provas antigas com gabarito geram casos fiéis. Capítulos e resumos geram blocos de fixação; com IA ativada, viram casos clínicos completos."
      [wide]="true"
      (closed)="close()"
    >
      <form class="stack" (ngSubmit)="submit()">
        <div class="row" style="gap: 6px; background: var(--surface-2); padding: 4px; border-radius: 10px; align-self: flex-start">
          <button
            type="button"
            [class]="'btn btn-sm ' + (tab() === 'arquivo' ? 'btn-secondary' : 'btn-ghost')"
            (click)="tab.set('arquivo')"
          >
            <sf-icon name="upload" [size]="14" />
            Enviar arquivo
          </button>
          <button type="button" [class]="'btn btn-sm ' + (tab() === 'texto' ? 'btn-secondary' : 'btn-ghost')" (click)="tab.set('texto')">
            <sf-icon name="file" [size]="14" />
            Colar texto
          </button>
        </div>

        @if (tab() === 'arquivo') {
          <div
            [class]="'dropzone' + (drag() ? ' drag' : '')"
            (click)="pickFile()"
            (dragover)="onDragOver($event)"
            (dragleave)="drag.set(false)"
            (drop)="onDrop($event)"
            role="button"
            tabindex="0"
            (keydown.enter)="pickFile()"
          >
            <div class="empty-icon" style="margin-bottom: 2px">
              <sf-icon name="file" [size]="20" />
            </div>
            <strong>{{ file()?.name ?? 'Arraste o arquivo ou clique para escolher' }}</strong>
            <span class="tiny muted">
              {{ file() ? fileSize() + ' · troque clicando aqui' : 'PDF, DOCX, TXT ou MD · até 25 MB' }}
            </span>
            <input #filePicker type="file" accept=".pdf,.docx,.txt,.md,.markdown" hidden (change)="onFileChange($event)" />
          </div>
        } @else {
          <div class="field">
            <label for="material-text">Texto do material</label>
            <textarea
              id="material-text"
              class="textarea"
              style="min-height: 190px"
              placeholder="Cole aqui o capítulo, o resumo ou as questões da prova…"
              [(ngModel)]="text"
              name="text"
            ></textarea>
            <span class="hint">
              {{ text.trim() ? textWords() + ' palavras' : 'Quanto mais estruturado o texto (com títulos), melhor a análise.' }}
            </span>
          </div>
        }

        <div class="form-grid">
          <div class="field">
            <label for="material-title">Título (opcional)</label>
            <input id="material-title" class="input" placeholder="Ex.: Prova de Clínica Médica 2024" [(ngModel)]="title" name="title" />
          </div>
          <div class="field">
            <label for="material-discipline">Disciplina</label>
            <select id="material-discipline" class="select" [(ngModel)]="discipline" name="discipline">
              <option value="">Detectar automaticamente</option>
              @for (area of areas; track area) {
                <option [value]="area">{{ area }}</option>
              }
            </select>
          </div>
        </div>

        @if (uploadError()) {
          <div class="feedback bad" style="padding: 10px 12px"><span>{{ uploadError() }}</span></div>
        }
        <p class="tiny muted">
          Privacidade: o material fica apenas no seu banco local do Study Flux. Nada é enviado a terceiros — exceto se você ativar
          a geração por IA em Configurações, quando apenas o texto necessário é enviado ao provedor escolhido.
        </p>
      </form>

      <div footer class="row" style="gap: 8px; justify-content: flex-end; width: 100%">
        <button class="btn btn-secondary" type="button" (click)="close()" [disabled]="busy()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="submit()" [disabled]="busy()">
          @if (busy()) {
            <span class="spinner" aria-hidden="true"></span>
            Analisando material…
          } @else {
            <sf-icon name="upload" [size]="15" />
            Enviar e analisar
          }
        </button>
      </div>
    </sf-modal>
  `,
})
export class MaterialsPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly filePicker = viewChild.required<ElementRef<HTMLInputElement>>('filePicker');
  readonly areas = AREAS;
  readonly sources = signal<SourceSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly open = signal(false);
  readonly tab = signal<'arquivo' | 'texto'>('arquivo');
  readonly file = signal<File | null>(null);
  readonly drag = signal(false);
  readonly busy = signal(false);
  readonly uploadError = signal<string | null>(null);

  title = '';
  discipline = '';
  text = '';

  date = formatDate;
  kindLabel = kindLabel;
  pluralText = plural;

  constructor() {
    this.load();
  }

  words(value: number): string {
    return value.toLocaleString('pt-BR');
  }

  textWords(): string {
    return this.text.trim().split(/\s+/).length.toLocaleString('pt-BR');
  }

  pickFile(): void {
    this.filePicker().nativeElement.click();
  }

  fileSize(): string {
    const file = this.file();
    return file ? `${(file.size / 1024).toFixed(0)} KB` : '';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.sources
      .list()
      .then(({ sources }) => this.sources.set(sources))
      .catch((error) => this.error.set(errorMessage(error)))
      .finally(() => this.loading.set(false));
  }

  generate(source: SourceSummary): void {
    void this.router.navigate(['/materiais', source.id], { queryParams: { gerar: '1' } });
  }

  async remove(source: SourceSummary): Promise<void> {
    if (!window.confirm(`Excluir “${source.title}”? Os casos gerados a partir dele serão mantidos, mas perderão o vínculo.`)) return;
    try {
      await this.api.sources.remove(source.id);
      this.toast.success('Material excluído.');
      this.load();
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível excluir.'));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.drag.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.drag.set(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) this.file.set(dropped);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
  }

  private reset(): void {
    this.title = '';
    this.discipline = '';
    this.text = '';
    this.file.set(null);
    this.uploadError.set(null);
    this.tab.set('arquivo');
  }

  close(): void {
    if (this.busy()) return;
    this.reset();
    this.open.set(false);
  }

  async submit(): Promise<void> {
    this.uploadError.set(null);
    const file = this.file();
    if (this.tab() === 'arquivo' && !file) {
      this.uploadError.set('Escolha um arquivo PDF, DOCX, TXT ou MD.');
      return;
    }
    if (this.tab() === 'texto' && this.text.trim().length < 60) {
      this.uploadError.set('Cole pelo menos alguns parágrafos do material.');
      return;
    }
    this.busy.set(true);
    try {
      const form = new FormData();
      if (this.tab() === 'arquivo' && file) form.append('file', file);
      if (this.tab() === 'texto') form.append('text', this.text);
      if (this.title.trim()) form.append('title', this.title.trim());
      if (this.discipline) form.append('discipline', this.discipline);
      const result = await this.api.sources.create(form);
      if (result.warnings.length > 0) this.toast.show(result.warnings[0], 'info');
      this.toast.success('Material analisado.');
      const created = result.source;
      this.reset();
      this.open.set(false);
      await this.router.navigate(['/materiais', created.id], { queryParams: { gerar: '1' } });
    } catch (error) {
      this.uploadError.set(errorMessage(error, 'Não foi possível enviar o material.'));
    } finally {
      this.busy.set(false);
    }
  }
}
