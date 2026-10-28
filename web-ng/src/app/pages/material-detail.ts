import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { SettingsDTO, SourceSummary } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { ToastService } from '../core/toast';
import { formatDate, kindLabel, plural } from '../core/format';
import { EmptyState, LoadingBlock, Modal, PageHeader } from '../shared/ui';
import { Icon } from '../shared/icon';

const TYPE_LABEL: Record<string, string> = {
  definicao: 'Definição',
  epidemiologia: 'Epidemiologia',
  fisiopatologia: 'Fisiopatologia',
  quadro_clinico: 'Quadro clínico',
  diagnostico: 'Diagnóstico',
  tratamento: 'Tratamento',
  complicacoes: 'Complicações',
  prevencao: 'Prevenção',
  caso: 'Caso clínico',
  questoes: 'Questões',
  gabarito: 'Gabarito',
  referencias: 'Referências',
  outro: 'Conteúdo',
};

type GenMode = 'auto' | 'estruturado' | 'ia';

interface PreviewData {
  analysis: {
    kind: string;
    topics: string[];
    conditions: string[];
    area: string;
    sections: { heading: string; type: string; facts: number }[];
    questions: number;
    questionsWithKey: number;
    warnings: string[];
  };
  drafts: {
    key: string;
    title: string;
    area: string;
    topic: string;
    difficulty: string;
    format: string;
    minutes: number;
    questions: { prompt: string; options: { id: string; text: string }[]; correctOptionId: string; rationale: string }[];
  }[];
  aiAvailable: boolean;
}

interface GeneratedResult {
  created: number;
  updated: number;
  mode: string;
  warnings: string[];
  cases: { id: number; title: string }[];
}

@Component({
  selector: 'sf-material-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, EmptyState, LoadingBlock, Modal, PageHeader],
  template: `
    @if (loading()) {
      <sf-loading label="Abrindo material…" />
    } @else if (error() || !source()) {
      <sf-empty icon="alert" title="Material não encontrado" [description]="error() ?? 'Talvez ele tenha sido excluído.'">
        <a class="btn btn-secondary" routerLink="/materiais">Voltar para materiais</a>
      </sf-empty>
    } @else {
      @let item = source()!;
      <sf-page-header [title]="item.title">
        <p subtitle>
          {{ kindLabel(item.kind) }}
          @if (item.discipline) {
            · {{ item.discipline }}
          }
          @if (analysis()?.language) {
            · idioma {{ analysis()!.language!.toUpperCase() }}
          }
          · enviado em {{ date(item.createdAt) }}
          @if (item.pages) {
            · {{ pluralText(item.pages, 'página', 'páginas') }}
          }
        </p>
        <a actions class="btn btn-ghost" routerLink="/materiais">
          <sf-icon name="arrowLeft" [size]="15" />
          Materiais
        </a>
        <button actions class="btn btn-secondary" type="button" (click)="reanalyze()">
          <sf-icon name="refresh" [size]="15" />
          Reanalisar
        </button>
        <button actions class="btn btn-primary" type="button" (click)="openGenerate()">
          <sf-icon name="sparkles" [size]="15" />
          Gerar casos
        </button>
      </sf-page-header>

      @if (analysis()?.warnings?.length) {
        <div class="feedback" style="background: var(--warn-50); border-color: #f4e2b7; margin-bottom: 16px">
          <div class="feedback-title" style="color: var(--warn)">
            <sf-icon name="alert" [size]="16" />
            Pontos de atenção na leitura deste material
          </div>
          <ul style="margin: 0; padding-left: 18px; color: var(--ink-2)">
            @for (warning of analysis()!.warnings; track warning) {
              <li class="small">{{ warning }}</li>
            }
          </ul>
        </div>
      }

      <div class="analysis-grid" style="margin-bottom: 16px">
        <div class="card">
          <div class="card-head">
            <h3>O que identificamos</h3>
            <span [class]="'badge ' + (item.kind === 'prova' ? 'badge-info' : item.kind === 'capitulo' ? 'badge-brand' : 'badge-neutral')">
              {{ kindLabel(item.kind) }}
            </span>
          </div>
          <div class="card-body stack">
            <div class="grid grid-3" style="gap: 10px">
              <div class="vital">
                <div class="vital-label">Palavras</div>
                <div class="vital-value">{{ analysis() ? number(analysis()!.words) : number(item.chars) }}</div>
              </div>
              <div class="vital">
                <div class="vital-label">Leitura</div>
                <div class="vital-value">{{ analysis() ? analysis()!.readingMinutes + ' min' : '—' }}</div>
              </div>
              <div class="vital">
                <div class="vital-label">Questões</div>
                <div class="vital-value">
                  {{ analysis() ? analysis()!.examQuestionsWithKey + '/' + analysis()!.examQuestions : '—' }}
                </div>
              </div>
            </div>

            @if (analysis()?.topics?.length) {
              <div>
                <div class="section-label">Temas reconhecidos</div>
                <div class="pill-list">
                  @for (topic of analysis()!.topics; track topic) {
                    <span class="badge badge-brand">{{ topic }}</span>
                  }
                </div>
              </div>
            }

            @if (analysis()?.conditions?.length) {
              <div>
                <div class="section-label">Condições citadas</div>
                <div class="pill-list">
                  @for (condition of analysis()!.conditions.slice(0, 10); track condition) {
                    <span class="badge badge-neutral">{{ condition }}</span>
                  }
                </div>
              </div>
            }

            @if (analysis()?.sections?.length) {
              <div>
                <div class="section-label">Estrutura do material</div>
                <div class="section-list">
                  @for (section of analysis()!.sections; track section.heading + $index) {
                    <div class="section-row">
                      <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                        {{ section.heading }}
                      </span>
                      <span class="section-type">{{ typeLabel[section.type] ?? section.type }}</span>
                      <span class="tiny muted" style="width: 62px; text-align: right">
                        {{ section.facts }} trecho{{ section.facts === 1 ? '' : 's' }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            }

            <details>
              <summary class="small" style="cursor: pointer; color: var(--brand); font-weight: 600">
                Ver o texto que foi extraído
              </summary>
              <pre
                class="tiny"
                style="white-space: pre-wrap; background: var(--surface-2); padding: 12px; border-radius: 10px; max-height: 260px; overflow: auto; margin-top: 8px; font-family: ui-monospace, Menlo, monospace"
                >{{ textPreview() || 'Sem texto extraído.' }}</pre
              >
            </details>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Prévia do que será gerado</h3>
            <span class="tiny muted">modo estruturado</span>
          </div>
          <div class="card-body">
            @if (previewLoading()) {
              <sf-loading label="Montando prévia…" />
            } @else if (previewError()) {
              <p class="small" style="color: var(--danger)">{{ previewError() }}</p>
            } @else if (preview()) {
              @if (preview()!.drafts.length === 0) {
                <div class="stack-sm">
                  <p class="small muted">
                    O modo estruturado (sem IA) não encontrou trechos suficientes. Ele precisa de subtítulos com conteúdo clínico ou de
                    questões com gabarito.
                  </p>
                  <div class="row">
                    <a class="btn btn-secondary btn-sm" routerLink="/configuracoes">Ativar IA</a>
                    <button class="btn btn-ghost btn-sm" type="button" (click)="openGenerate()">Ver opções</button>
                  </div>
                </div>
              } @else {
                <div class="stack-sm">
                  <p class="small muted">
                    {{ pluralText(preview()!.drafts.length, 'bloco', 'blocos') }} com {{ totalDraftQuestions() }} perguntas, montadas a
                    partir de trechos literais do material. Revise antes de publicar.
                  </p>
                  @for (draft of preview()!.drafts; track draft.key) {
                    @let expanded = openDraft() === draft.key;
                    <div class="draft">
                      <div class="draft-head" (click)="toggleDraft(draft.key)">
                        <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ draft.title }}</span>
                        <span class="row" style="gap: 8px">
                          <span class="tiny muted">{{ draft.questions.length }} perguntas</span>
                          <sf-icon [name]="expanded ? 'chevronDown' : 'chevronRight'" [size]="15" />
                        </span>
                      </div>
                      @if (expanded) {
                        <div class="draft-body">
                          @for (question of draft.questions; track $index) {
                            <div>
                              <div class="draft-q">{{ question.prompt }}</div>
                              <div class="draft-options">
                                @for (option of question.options; track option.id) {
                                  <div [class]="'draft-option' + (option.id === question.correctOptionId ? ' correct' : '')">
                                    {{ option.id.toUpperCase() }}) {{ option.text }}
                                  </div>
                                }
                              </div>
                              <div class="tiny muted" style="margin-top: 6px">{{ question.rationale }}</div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="row between row-wrap">
          <div class="row" style="gap: 10px">
            <div class="file-icon" style="width: 34px; height: 34px; border-radius: 10px">
              <sf-icon [name]="aiReady() ? 'sparkles' : 'info'" [size]="16" />
            </div>
            <div>
              <strong class="small">{{ aiReady() ? 'IA ativa' : 'IA desativada' }}</strong>
              <div class="tiny muted">
                @if (aiReady()) {
                  Modelo {{ settings()?.ai.model }} · {{ settings()?.ai.provider }}
                } @else {
                  Sem IA, a plataforma usa o próprio texto do material: perguntas de completar e questões de provas antigas.
                }
              </div>
            </div>
          </div>
          <div class="row" style="gap: 8px">
            <a class="btn btn-secondary btn-sm" routerLink="/configuracoes">
              <sf-icon name="settings" [size]="14" />
              Configurar IA
            </a>
            <button class="btn btn-primary btn-sm" type="button" (click)="openGenerate()">
              <sf-icon name="sparkles" [size]="14" />
              Gerar casos
            </button>
            <button class="btn btn-danger-ghost btn-sm" type="button" (click)="remove(item)">
              <sf-icon name="trash" [size]="14" />
              Excluir material
            </button>
          </div>
        </div>
      </div>

      <sf-modal
        [open]="genOpen()"
        title="Gerar casos a partir do material"
        [description]="item.title"
        [wide]="true"
        (closed)="closeGenerate()"
      >
        @if (generated(); as result) {
          <div class="stack">
            <div class="feedback ok">
              <div class="feedback-title">
                <sf-icon name="check" [size]="16" />
                {{ result.created }} criado(s) · {{ result.updated }} atualizado(s)
              </div>
              <span class="small">
                Modo utilizado: {{ result.mode === 'ia' ? 'IA' : 'estruturado (sem IA)' }}.
                {{ publish() ? 'Os casos ficaram publicados na sua biblioteca.' : 'Os casos ficaram como rascunho — publique quando revisar.' }}
              </span>
            </div>
            @if (result.warnings.length > 0) {
              <div class="stack-sm">
                @for (warning of result.warnings; track warning) {
                  <div class="small" style="color: var(--muted)">• {{ warning }}</div>
                }
              </div>
            }
            <div class="stack-sm">
              @for (created of result.cases; track created.id) {
                <a
                  [routerLink]="'/casos/' + created.id"
                  class="draft-head"
                  style="text-decoration: none; color: inherit; border-radius: 10px; border: 1px solid var(--line)"
                >
                  <span>{{ created.title }}</span>
                  <sf-icon name="chevronRight" [size]="15" />
                </a>
              }
            </div>
          </div>
        } @else {
          <div class="stack">
            <div class="field">
              <span class="label">Como gerar</span>
              <div class="stack-sm">
                <label [class]="'option' + (mode() === 'auto' ? ' selected' : '')" style="cursor: pointer">
                  <input type="radio" name="mode" [checked]="mode() === 'auto'" (change)="mode.set('auto')" style="margin-top: 6px" />
                  <span>
                    <strong>Automático</strong>
                    <span class="tiny muted" style="display: block">
                      Usa IA quando estiver configurada; caso contrário, monta blocos fiéis ao texto.
                    </span>
                  </span>
                </label>
                <label
                  [class]="'option' + (mode() === 'estruturado' ? ' selected' : '')"
                  [style.opacity]="canStructured() ? 1 : 0.6"
                  style="cursor: pointer"
                >
                  <input type="radio" name="mode" [checked]="mode() === 'estruturado'" (change)="mode.set('estruturado')" style="margin-top: 6px" />
                  <span>
                    <strong>Estruturado (sem IA)</strong>
                    <span class="tiny muted" style="display: block">
                      Perguntas de completar a partir de trechos literais + questões de provas antigas com gabarito.
                    </span>
                  </span>
                </label>
                <label [class]="'option' + (mode() === 'ia' ? ' selected' : '')" [style.opacity]="aiReady() ? 1 : 0.6" style="cursor: pointer">
                  <input type="radio" name="mode" [checked]="mode() === 'ia'" [disabled]="!aiReady()" (change)="mode.set('ia')" style="margin-top: 6px" />
                  <span>
                    <strong>Somente IA</strong>
                    <span class="tiny muted" style="display: block">
                      {{
                        aiReady()
                          ? 'Cria casos clínicos completos, com paciente, exames e perguntas em progressão.'
                          : 'Ative a IA em Configurações para usar este modo.'
                      }}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div class="form-grid">
              <div class="field">
                <label for="max-cases">Quantidade de casos</label>
                <input
                  id="max-cases"
                  type="number"
                  min="1"
                  max="8"
                  class="input"
                  [ngModel]="maxCases()"
                  (ngModelChange)="setMaxCases($event)"
                  name="maxCases"
                />
              </div>
              <div class="field" style="justify-content: flex-end">
                <label class="switch">
                  <input type="checkbox" [checked]="publish()" (change)="publish.set(checked($event))" />
                  Publicar automaticamente
                </label>
                <span class="hint">Rascunhos ficam visíveis só para você até publicar.</span>
              </div>
            </div>

            @if (genError()) {
              <div class="feedback bad" style="padding: 10px 12px"><span>{{ genError() }}</span></div>
            }

            <p class="tiny muted">
              A geração substitui casos anteriores deste mesmo material quando o conteúdo muda, preservando seu histórico de respostas.
            </p>
          </div>
        }

        <div footer class="row" style="gap: 8px; justify-content: flex-end; width: 100%">
          @if (generated()) {
            <button class="btn btn-secondary" type="button" (click)="closeGenerate()">Fechar</button>
            <button class="btn btn-primary" type="button" (click)="seeGenerated(item)">
              Ver casos gerados
              <sf-icon name="arrowRight" [size]="15" />
            </button>
          } @else {
            <button class="btn btn-secondary" type="button" (click)="closeGenerate()" [disabled]="genBusy()">Cancelar</button>
            <button class="btn btn-primary" type="button" (click)="runGenerate(item)" [disabled]="genBusy()">
              @if (genBusy()) {
                <span class="spinner" aria-hidden="true"></span>
                Gerando… pode levar até 1 minuto
              } @else {
                <sf-icon name="sparkles" [size]="15" />
                Gerar casos
              }
            </button>
          }
        </div>
      </sf-modal>
    }
  `,
})
export class MaterialDetailPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly sourceId = Number(this.route.snapshot.paramMap.get('id'));
  readonly source = signal<SourceSummary | null>(null);
  readonly excerpt = signal('');
  readonly textPreview = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly preview = signal<PreviewData | null>(null);
  readonly previewLoading = signal(true);
  readonly previewError = signal<string | null>(null);
  readonly openDraft = signal<string | null>(null);

  readonly settings = signal<SettingsDTO | null>(null);
  readonly analysis = computed(() => this.source()?.analysis ?? null);
  readonly aiReady = computed(() => Boolean(this.settings()?.ai.enabled && this.settings()?.ai.hasKey));
  readonly canStructured = computed(() => (this.preview()?.drafts.length ?? 0) > 0);
  readonly totalDraftQuestions = computed(() =>
    (this.preview()?.drafts ?? []).reduce((acc, draft) => acc + draft.questions.length, 0),
  );

  readonly genOpen = signal(this.route.snapshot.queryParamMap.get('gerar') === '1');
  readonly mode = signal<GenMode>('auto');
  readonly maxCases = signal(4);
  readonly publish = signal(true);
  readonly genBusy = signal(false);
  readonly genError = signal<string | null>(null);
  readonly generated = signal<GeneratedResult | null>(null);

  readonly typeLabel = TYPE_LABEL;
  date = formatDate;
  kindLabel = kindLabel;
  pluralText = plural;

  constructor() {
    this.load();
    this.loadPreview();
    this.api.settings
      .get()
      .then((settings) => {
        this.settings.set(settings);
        if (!this.aiReady()) this.mode.set('estruturado');
      })
      .catch(() => undefined);
  }

  number(value: number): string {
    return value.toLocaleString('pt-BR');
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  setMaxCases(value: number | string): void {
    this.maxCases.set(Math.max(1, Math.min(8, Number(value) || 1)));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.sources
      .get(this.sourceId)
      .then(({ source, excerpt, textPreview }) => {
        this.source.set(source);
        this.excerpt.set(excerpt);
        this.textPreview.set(textPreview);
      })
      .catch((error) => this.error.set(errorMessage(error, 'Não foi possível abrir o material.')))
      .finally(() => this.loading.set(false));
  }

  loadPreview(): void {
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.api.generate
      .preview(this.sourceId)
      .then((preview) => {
        this.preview.set(preview as PreviewData);
        if (this.openDraft() === null && preview.drafts[0]) this.openDraft.set(preview.drafts[0].key);
      })
      .catch((error) => this.previewError.set(errorMessage(error, 'Não foi possível montar a prévia.')))
      .finally(() => this.previewLoading.set(false));
  }

  toggleDraft(key: string): void {
    this.openDraft.set(this.openDraft() === key ? null : key);
  }

  openGenerate(): void {
    this.generated.set(null);
    this.genError.set(null);
    this.mode.set(this.aiReady() ? 'auto' : 'estruturado');
    this.genOpen.set(true);
  }

  closeGenerate(): void {
    if (this.genBusy()) return;
    this.genOpen.set(false);
  }

  seeGenerated(item: SourceSummary): void {
    this.genOpen.set(false);
    void this.router.navigate(['/casos'], { queryParams: { fonte: item.id } });
  }

  async reanalyze(): Promise<void> {
    try {
      await this.api.sources.reanalyze(this.sourceId);
      this.toast.success('Análise refeita.');
      this.load();
      this.loadPreview();
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível reanalisar.'));
    }
  }

  async remove(item: SourceSummary): Promise<void> {
    if (!window.confirm(`Excluir “${item.title}”?`)) return;
    try {
      await this.api.sources.remove(item.id);
      this.toast.success('Material excluído.');
      await this.router.navigate(['/materiais']);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível excluir.'));
    }
  }

  async runGenerate(item: SourceSummary): Promise<void> {
    this.genBusy.set(true);
    this.genError.set(null);
    try {
      const response = await this.api.generate.source(item.id, {
        mode: this.mode(),
        maxCases: this.maxCases(),
        publish: this.publish(),
      });
      this.generated.set(response);
      this.load();
      this.loadPreview();
      this.toast.success(`${response.created} caso(s) criado(s), ${response.updated} atualizado(s).`);
    } catch (error) {
      this.genError.set(errorMessage(error, 'Não foi possível gerar os casos.'));
    } finally {
      this.genBusy.set(false);
    }
  }
}
