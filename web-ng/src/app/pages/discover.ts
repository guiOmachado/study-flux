import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AREAS } from '@shared/types';
import type { SettingsDTO } from '@shared/types';
import {
  Api,
  errorMessage,
  type DiscoveryImportOutcome,
  type DiscoveryProviderInfo,
  type DiscoveryResultDTO,
  type DiscoverySearchDTO,
} from '../core/api';
import { AuthService } from '../core/auth';
import { ToastService } from '../core/toast';
import { LoadingBlock, Modal, PageHeader, SectionCard } from '../shared/ui';
import { Icon } from '../shared/icon';

type Tab = 'acervos' | 'tema' | 'link';

const DEFAULT_PROVIDERS = ['local', 'europepmc', 'bookshelf'];

const TYPE_LABEL: Record<string, string> = {
  artigo: 'Artigo',
  capitulo: 'Capítulo',
  preprint: 'Preprint',
  material: 'Meu material',
};

function providerIcon(id: string): string {
  if (id === 'local') return 'folder';
  if (id === 'bookshelf') return 'bookOpen';
  if (id === 'openalex') return 'globe';
  return 'file';
}

function authorsLine(result: DiscoveryResultDTO): string {
  if (result.authors.length === 0) return 'Autoria não informada';
  const shown = result.authors.slice(0, 3).join(', ');
  return result.authors.length > 3 ? `${shown} e outros` : shown;
}

@Component({
  selector: 'sf-discover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, LoadingBlock, Modal, PageHeader, SectionCard],
  template: `
    <sf-page-header
      title="Descobrir conteúdo"
      [subtitle]="
        isGuest()
          ? 'Busque artigos e capítulos em acervos científicos abertos, sem precisar de conta. Para importar e transformar em casos, é só entrar.'
          : 'Busque em acervos científicos abertos, importe por link ou peça casos a partir de um tema. Tudo entra na sua biblioteca como material, com fonte e licença registradas.'
      "
    >
      @if (isGuest()) {
        <a actions class="btn btn-primary" [routerLink]="'/login'" [queryParams]="{ next: '/descobrir' }">
          <sf-icon name="user" [size]="15" />
          Entrar para importar
        </a>
      } @else {
        <a actions class="btn btn-secondary" routerLink="/configuracoes">
          <sf-icon name="settings" [size]="15" />
          {{ aiReady() ? 'IA ativa' : 'Configurar IA' }}
        </a>
      }
    </sf-page-header>

    @if (isGuest()) {
      <div class="guest-banner">
        <div class="row" style="align-items: flex-start; gap: 10px">
          <sf-icon name="globe" [size]="17" style="color: var(--brand-700); flex: none; margin-top: 2px" />
          <div>
            <strong class="small">Você está no modo visitante.</strong>
            <div class="tiny muted">
              A busca nos acervos é livre — dá para ler resumos e conferir a fonte. Importar para a sua biblioteca, gerar casos,
              treinar e revisar pedem uma conta (leva menos de um minuto e é grátis).
            </div>
          </div>
        </div>
        <div class="row" style="gap: 8px; flex-wrap: wrap">
          <a class="btn btn-primary btn-sm" [routerLink]="'/login'" [queryParams]="{ next: '/descobrir' }">Entrar</a>
          <a class="btn btn-secondary btn-sm" [routerLink]="'/login'" [queryParams]="{ mode: 'register', next: '/descobrir' }">
            Criar conta
          </a>
        </div>
      </div>
    }

    <div class="tabs" role="tablist">
      @for (item of tabs; track item.id) {
        <button
          role="tab"
          [attr.aria-selected]="tab() === item.id"
          [class]="'tab' + (tab() === item.id ? ' active' : '')"
          type="button"
          (click)="setTab(item.id)"
        >
          <sf-icon [name]="item.icon" [size]="15" />
          {{ item.label }}
        </button>
      }
    </div>

    @if (notice()) {
      <div class="feedback" style="background: var(--warn-50); border-color: #f4e2b7; margin-bottom: 16px">
        <div class="feedback-title" style="color: var(--warn)">
          <sf-icon name="alert" [size]="16" />
          Quase lá
        </div>
        <span class="small">{{ notice() }}</span>
      </div>
    }

    @if (tab() === 'acervos') {
      <div class="card card-pad stack" style="margin-bottom: 16px">
        <div class="stack-sm">
          <div class="row" style="gap: 8px; flex-wrap: wrap">
            <div class="search-wrap" style="flex: 1; min-width: 220px">
              <sf-icon name="search" [size]="16" />
              <input
                class="input"
                placeholder="Ex.: sepse, insuficiência cardíaca, bronchiolitis, diabetes gestacional…"
                [ngModel]="query()"
                (ngModelChange)="query.set($event)"
                (keydown.enter)="runSearch()"
              />
            </div>
            <button class="btn btn-primary" type="button" (click)="runSearch()" [disabled]="busy()">
              @if (busy()) {
                <span class="spinner" aria-hidden="true"></span>
              } @else {
                <sf-icon name="search" [size]="15" />
              }
              Buscar
            </button>
          </div>

          <div class="row row-wrap" style="gap: 8px">
            <span class="tiny muted" style="font-weight: 600">Acervos:</span>
            @for (provider of providerList(); track provider.id) {
              <button
                type="button"
                [class]="'chip' + (selectedProviders().includes(provider.id) ? ' active' : '')"
                [title]="provider.description"
                (click)="toggleProvider(provider.id)"
              >
                <sf-icon [name]="providerIcon(provider.id)" [size]="13" />
                {{ provider.label }}
              </button>
            }
          </div>

          <div class="row row-wrap" style="gap: 14px">
            <label class="checkbox">
              <input type="checkbox" [ngModel]="onlyOA()" (ngModelChange)="onlyOA.set($event)" />
              Somente acesso aberto
            </label>
            <label class="row" style="gap: 6px">
              <span class="tiny muted">Resultados por acervo</span>
              <select class="select" style="width: 90px; padding: 6px 10px" [ngModel]="limit()" (ngModelChange)="limit.set($event)">
                @for (value of limits; track value) {
                  <option [value]="value">{{ value }}</option>
                }
              </select>
            </label>
            <span class="tiny muted">
              Dica: artigos em inglês funcionam bem — o modo estruturado mantém o texto original e a IA responde em português.
            </span>
          </div>
        </div>

        @if (searchError()) {
          <div class="feedback bad" style="padding: 10px 12px"><span class="small">{{ searchError() }}</span></div>
        }

        @if (searchData(); as data) {
          <div class="row row-wrap" style="gap: 6px">
            @for (status of data.statuses; track status.id) {
              <span
                [class]="'badge ' + (status.ok ? 'badge-success' : 'badge-danger')"
                [title]="status.message ?? status.count + ' resultado(s)'"
                style="max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block"
              >
                {{ status.label }}: {{ status.ok ? status.count + ' resultado' + (status.count === 1 ? '' : 's') : 'indisponível' }}
              </span>
            }
            @if (data.cached) {
              <span class="badge badge-neutral">cache de 10 min</span>
            }
          </div>
        }
      </div>

      @if (busy() && !searchData()) {
        <sf-loading label="Consultando acervos…" />
      }

      @if (searchData() && searchData()!.results.length > 0) {
        <div class="stack-sm">
          @for (result of searchData()!.results; track result.provider + ':' + result.id) {
            <article class="result-card">
              <div class="row row-wrap" style="gap: 6px">
                <span class="badge badge-brand">
                  <sf-icon [name]="providerIcon(result.provider)" [size]="12" />
                  {{ result.providerLabel }}
                </span>
                <span class="badge badge-neutral">{{ typeLabel[result.type] ?? result.type }}</span>
                @if (result.openAccess) {
                  <span class="badge badge-success">Acesso aberto</span>
                } @else {
                  <span class="badge badge-warn">Acesso restrito</span>
                }
                @if (result.hasFullText) {
                  <span class="badge badge-info">Texto completo</span>
                }
                @if (result.year) {
                  <span class="badge badge-neutral">{{ result.year }}</span>
                }
                @if (result.language) {
                  <span class="badge badge-neutral">{{ result.language.toUpperCase() }}</span>
                }
              </div>
              <h3 style="font-size: 15px; line-height: 1.35">{{ result.title }}</h3>
              <div class="tiny muted">
                {{ authors(result) }}
                @if (result.journal) {
                  · {{ result.journal }}
                }
                @if (result.doi) {
                  · DOI {{ result.doi }}
                }
              </div>
              @if (result.abstract) {
                <p class="small" style="color: var(--ink-2); white-space: pre-line">
                  {{ expandedKey() === result.provider + ':' + result.id || result.abstract.length <= 320
                    ? result.abstract
                    : result.abstract.slice(0, 320).trim() + '…' }}
                  @if (result.abstract.length > 320) {
                    <button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      style="padding: 0 4px"
                      (click)="toggleExpanded(result.provider + ':' + result.id)"
                    >
                      {{ expandedKey() === result.provider + ':' + result.id ? 'menos' : 'ler tudo' }}
                    </button>
                  }
                </p>
              } @else {
                <p class="tiny muted">Sem resumo neste registro — o texto completo pode estar disponível.</p>
              }
              <div class="row row-wrap" style="gap: 6px">
                <button class="btn btn-primary btn-sm" type="button" (click)="requestImport(result)">
                  <sf-icon [name]="isGuest() ? 'lock' : result.provider === 'local' ? 'folder' : 'sparkles'" [size]="13" />
                  {{
                    isGuest() ? 'Entrar para importar' : result.provider === 'local' ? 'Reaproveitar material' : 'Importar e gerar casos'
                  }}
                </button>
                @if (result.url) {
                  <a class="btn btn-secondary btn-sm" [href]="result.url" target="_blank" rel="noreferrer noopener">
                    <sf-icon name="link" [size]="13" />
                    Abrir na fonte
                  </a>
                }
                @if (result.provider === 'local' && result.extra?.['sourceId']) {
                  <a class="btn btn-ghost btn-sm" [routerLink]="'/materiais/' + result.extra!['sourceId']">Ver material</a>
                }
              </div>
            </article>
          }
        </div>
      }

      @if (!searchData() && !busy()) {
        <sf-section title="Como funciona a descoberta">
          <div class="stack-sm">
            @for (step of discoverySteps(); track step.title) {
              <div class="row" style="align-items: flex-start; gap: 10px; padding: 6px 0">
                <div class="file-icon" style="width: 32px; height: 32px; border-radius: 9px">
                  <sf-icon [name]="step.icon" [size]="15" />
                </div>
                <div>
                  <strong class="small">{{ step.title }}</strong>
                  <div class="tiny muted">{{ step.text }}</div>
                </div>
              </div>
            }
            <div class="divider"></div>
            <p class="tiny muted">
              @if (isGuest()) {
                Visitante pode buscar e ler os resultados à vontade. Importar e gerar casos faz parte da conta — a demo já vem com
                exemplos prontos.
              } @else if (aiReady()) {
                IA ativa: os casos gerados a partir de artigos serão casos clínicos completos, com perguntas em progressão.
              } @else {
                IA desativada: o modo estruturado monta perguntas de completar a partir dos trechos. Para artigos, a IA costuma render
                casos bem melhores.
              }
            </p>
          </div>
        </sf-section>
      }
    }

    @if (tab() === 'tema') {
      @if (isGuest()) {
        <div class="card card-pad stack" style="max-width: 640px">
          <div class="row" style="align-items: flex-start; gap: 12px">
            <div class="file-icon" style="width: 38px; height: 38px; border-radius: 10px; flex: none">
              <sf-icon name="lock" [size]="17" />
            </div>
            <div>
              <h2 style="font-size: 17px">Gerar casos por tema precisa de conta</h2>
              <p class="small muted" style="margin-top: 4px">
                Este modo cria casos direto na sua biblioteca — não tem material de origem. Entre para usar (precisa de IA
                configurada).
              </p>
            </div>
          </div>
          <div class="row" style="gap: 8px; flex-wrap: wrap">
            <a class="btn btn-primary" [routerLink]="'/login'" [queryParams]="{ next: '/descobrir' }">
              <sf-icon name="user" [size]="15" />
              Entrar
            </a>
            <a class="btn btn-secondary" [routerLink]="'/login'" [queryParams]="{ mode: 'register', next: '/descobrir' }">
              Criar conta grátis
            </a>
          </div>
          <div class="tiny muted">
            A aba <strong>Acervos científicos</strong> continua livre: dá para buscar e ler resumos sem conta.
          </div>
        </div>
      } @else {
        <div class="grid dash-split">
          <div class="card card-pad stack">
            <h2>Gerar casos a partir de um tema</h2>
            <p class="small muted">
              Sem material nenhum: informe o tema e a IA cria casos clínicos do zero, dentro do currículo de medicina. Útil para
              cobrir lacunas que não estão nos seus materiais.
            </p>

            <div class="form-grid">
              <div class="field span-2">
                <label for="topic-input">Tema</label>
                <input
                  id="topic-input"
                  class="input"
                  placeholder="Ex.: cetoacidose diabética, pré-eclâmpsia, sepse neonatal"
                  [ngModel]="topic()"
                  (ngModelChange)="topic.set($event)"
                />
              </div>
              <div class="field">
                <label for="topic-area">Área</label>
                <select id="topic-area" class="select" [ngModel]="topicArea()" (ngModelChange)="topicArea.set($event)">
                  <option value="">Detectar pelo tema</option>
                  @for (item of areas; track item) {
                    <option [value]="item">{{ item }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="topic-difficulty">Dificuldade</label>
                <select id="topic-difficulty" class="select" [ngModel]="topicDifficulty()" (ngModelChange)="topicDifficulty.set($event)">
                  <option value="facil">Fácil</option>
                  <option value="media">Média</option>
                  <option value="dificil">Difícil</option>
                </select>
              </div>
              <div class="field">
                <label for="topic-count">Quantidade</label>
                <select id="topic-count" class="select" [ngModel]="topicCount()" (ngModelChange)="topicCount.set($event)">
                  @for (value of counts; track value) {
                    <option [value]="value">{{ value }} caso{{ value === 1 ? '' : 's' }}</option>
                  }
                </select>
              </div>
              <div class="field" style="justify-content: flex-end">
                <label class="switch">
                  <input type="checkbox" [ngModel]="topicPublish()" (ngModelChange)="topicPublish.set($event)" />
                  Publicar
                </label>
              </div>
            </div>

            @if (!aiReady()) {
              <div class="feedback" style="background: var(--warn-50); border-color: #f4e2b7">
                <div class="feedback-title" style="color: var(--warn)">
                  <sf-icon name="alert" [size]="16" />
                  A geração por tema depende de IA
                </div>
                <span class="small">
                  Este modo não tem material de origem, então precisa de um provedor configurado.
                  <a routerLink="/configuracoes">Configurar IA</a> ou use a aba “Acervos científicos” (funciona sem IA).
                </span>
              </div>
            }

            @if (topicError()) {
              <div class="feedback bad" style="padding: 10px 12px"><span class="small">{{ topicError() }}</span></div>
            }

            <div>
              <button class="btn btn-primary btn-lg" type="button" (click)="runTopic()" [disabled]="topicBusy() || !aiReady()">
                @if (topicBusy()) {
                  <span class="spinner" aria-hidden="true"></span>
                } @else {
                  <sf-icon name="sparkles" [size]="16" />
                }
                {{ topicBusy() ? 'Gerando casos…' : 'Gerar casos do tema' }}
              </button>
            </div>

            @if (topicCreated(); as created) {
              <div class="stack-sm">
                <div class="feedback ok">
                  <div class="feedback-title">
                    <sf-icon name="check" [size]="16" />
                    {{ created.created }} criado(s) · {{ created.updated }} atualizado(s)
                  </div>
                </div>
                @for (item of created.cases; track item.id) {
                  <a
                    [routerLink]="'/casos/' + item.id"
                    class="draft-head"
                    style="text-decoration: none; color: inherit; border-radius: 10px; border: 1px solid var(--line)"
                  >
                    <span>{{ item.title }}</span>
                    <sf-icon name="chevronRight" [size]="15" />
                  </a>
                }
              </div>
            }
          </div>

          <sf-section title="Quando usar cada caminho">
            <div class="stack-sm">
              @for (item of pathGuide; track item.title) {
                <div class="row" style="align-items: flex-start; gap: 10px; padding: 6px 0">
                  <div class="file-icon" style="width: 30px; height: 30px; border-radius: 9px">
                    <sf-icon [name]="item.icon" [size]="14" />
                  </div>
                  <div>
                    <strong class="small">{{ item.title }}</strong>
                    <div class="tiny muted">{{ item.text }}</div>
                  </div>
                </div>
              }
            </div>
          </sf-section>
        </div>
      }
    }

    @if (tab() === 'link') {
      @if (isGuest()) {
        <div class="card card-pad stack" style="max-width: 640px">
          <div class="row" style="align-items: flex-start; gap: 12px">
            <div class="file-icon" style="width: 38px; height: 38px; border-radius: 10px; flex: none">
              <sf-icon name="lock" [size]="17" />
            </div>
            <div>
              <h2 style="font-size: 17px">Importar por link precisa de conta</h2>
              <p class="small muted" style="margin-top: 4px">
                O link vira um material na sua biblioteca, com referência e licença. Entre para importar e gerar casos a partir dele.
              </p>
            </div>
          </div>
          <div class="row" style="gap: 8px; flex-wrap: wrap">
            <a class="btn btn-primary" [routerLink]="'/login'" [queryParams]="{ next: '/descobrir' }">
              <sf-icon name="user" [size]="15" />
              Entrar
            </a>
            <a class="btn btn-secondary" [routerLink]="'/login'" [queryParams]="{ mode: 'register', next: '/descobrir' }">
              Criar conta grátis
            </a>
          </div>
          <div class="tiny muted">
            A aba <strong>Acervos científicos</strong> continua livre: dá para buscar e ler resumos sem conta.
          </div>
        </div>
      } @else {
        <div class="card card-pad stack">
          <h2>Importar por link</h2>
          <p class="small muted">
            Cole o endereço de uma diretriz, artigo aberto, capítulo público ou PDF. A plataforma baixa, limpa o conteúdo e
            transforma em material — com a referência guardada.
          </p>
          <div class="form-grid">
            <div class="field span-2">
              <label for="link-url">Link</label>
              <input id="link-url" class="input" placeholder="https://…" [ngModel]="url()" (ngModelChange)="url.set($event)" />
              <span class="hint">
                Somente endereços públicos (http/https). Páginas com login ou carregadas por JavaScript podem não funcionar.
              </span>
            </div>
            <div class="field">
              <label for="link-title">Título (opcional)</label>
              <input
                id="link-title"
                class="input"
                placeholder="Detectado automaticamente"
                [ngModel]="linkTitle()"
                (ngModelChange)="linkTitle.set($event)"
              />
            </div>
            <div class="field">
              <label for="link-mode">Depois de importar</label>
              <select id="link-mode" class="select" [ngModel]="linkAiMode()" (ngModelChange)="linkAiMode.set($event)">
                <option value="auto">Gerar casos automaticamente</option>
                <option value="estruturado">Gerar no modo estruturado</option>
                <option value="ia" [disabled]="!aiReady()">Gerar com IA {{ aiReady() ? '' : '(não configurada)' }}</option>
              </select>
            </div>
          </div>
          <label class="switch">
            <input type="checkbox" [ngModel]="linkGenerate()" (ngModelChange)="linkGenerate.set($event)" />
            Gerar casos depois de importar
          </label>
          <label class="switch">
            <input type="checkbox" [ngModel]="linkPublish()" (ngModelChange)="linkPublish.set($event)" />
            Publicar os casos gerados
          </label>

          @if (linkError()) {
            <div class="feedback bad" style="padding: 10px 12px"><span class="small">{{ linkError() }}</span></div>
          }

          <div>
            <button class="btn btn-primary btn-lg" type="button" (click)="runLink()" [disabled]="linkBusy()">
              @if (linkBusy()) {
                <span class="spinner" aria-hidden="true"></span>
              } @else {
                <sf-icon name="download" [size]="16" />
              }
              {{ linkBusy() ? 'Baixando e analisando…' : 'Importar link' }}
            </button>
          </div>

          @if (linkOutcome(); as outcome) {
            <div class="feedback ok">
              <div class="feedback-title">
                <sf-icon name="check" [size]="16" />
                Material importado
              </div>
              <span class="small">
                {{ outcome.source.title }} · {{ outcome.generation ? outcome.generation.created + ' caso(s) gerado(s)' : 'sem casos ainda' }}
              </span>
              <div class="row" style="gap: 8px">
                <a class="btn btn-secondary btn-sm" [routerLink]="'/materiais/' + outcome.source.id">Ver material</a>
                @if (outcome.generation) {
                  <a class="btn btn-primary btn-sm" [routerLink]="'/casos'" [queryParams]="{ fonte: outcome.source.id }">Ver casos</a>
                }
              </div>
            </div>
          }
        </div>
      }
    }

    <div class="card card-pad" style="margin-top: 18px">
      <div class="row" style="align-items: flex-start; gap: 10px">
        <sf-icon name="info" [size]="16" style="color: var(--muted); flex: none; margin-top: 2px" />
        <div class="tiny muted">
          <strong style="color: var(--ink-2)">Sobre uso e direitos autorais.</strong> Os acervos são consultados por APIs públicas.
          Guardamos metadados e o resumo; o texto completo só é importado quando a fonte é de acesso aberto (Europe PMC, NCBI
          Bookshelf, PDFs abertos). O material fica no seu banco local e é marcado como rascunho/pessoal — use conforme as regras da
          sua instituição e a licença de cada obra. Prefira fontes abertas e sempre cite a origem.
        </div>
      </div>
    </div>

    <sf-modal
      [open]="importTarget() !== null"
      [title]="importOutcome() ? 'Fonte importada' : 'Importar fonte'"
      [description]="importSubtitle()"
      [wide]="true"
      (closed)="closeImport()"
    >
      @if (importTarget(); as target) {
        <div class="stack">
          <div>
            <h3 style="font-size: 15px">{{ target.title }}</h3>
            <div class="tiny muted" style="margin-top: 2px">
              {{ authors(target) }}
              @if (target.journal) {
                · {{ target.journal }}
              }
            </div>
          </div>

          @if (importOutcome(); as outcome) {
            <div class="stack">
              <div
                [class]="'feedback ' + (outcome.generation ? 'ok' : '')"
                [style.background]="outcome.generation ? null : 'var(--warn-50)'"
                [style.borderColor]="outcome.generation ? null : '#f4e2b7'"
              >
                <div class="feedback-title">
                  <sf-icon [name]="outcome.generation ? 'check' : 'alert'" [size]="16" />
                  @if (outcome.generation) {
                    {{ outcome.generation.created }} caso(s) criado(s) · modo
                    {{ outcome.generation.mode === 'ia' ? 'IA' : 'estruturado' }}
                  } @else {
                    Material importado sem casos
                  }
                </div>
                <span class="small">
                  @if (outcome.generation) {
                    Os casos já estão na sua biblioteca. Revise antes de compartilhar — a IA pode errar detalhes.
                  } @else {
                    {{ outcome.generationError ?? 'Abra o material para revisar a leitura e gerar casos manualmente.' }}
                  }
                </span>
                @if (outcome.generation?.warnings?.length) {
                  <div class="tiny muted">{{ outcome.generation!.warnings.slice(0, 3).join(' ') }}</div>
                }
              </div>
              <div class="row" style="gap: 8px; flex-wrap: wrap">
                <a class="btn btn-secondary btn-sm" [routerLink]="'/materiais/' + outcome.source.id">
                  <sf-icon name="eye" [size]="14" />
                  Ver material e análise
                </a>
                @if (outcome.generation && outcome.generation!.caseIds.length > 0) {
                  <a class="btn btn-primary btn-sm" [routerLink]="'/casos'" [queryParams]="{ fonte: outcome.source.id }">
                    <sf-icon name="library" [size]="14" />
                    Ver casos gerados
                  </a>
                }
                <button class="btn btn-ghost btn-sm" type="button" (click)="closeImport()">Fechar</button>
              </div>
            </div>
          } @else {
            <div class="field">
              <span class="label">O que importar</span>
              <div class="stack-sm">
                <label
                  [class]="'option' + (importMode() === 'fulltext' ? ' selected' : '')"
                  [style.opacity]="target.hasFullText ? 1 : 0.55"
                  [style.cursor]="target.hasFullText ? 'pointer' : 'not-allowed'"
                >
                  <input
                    type="radio"
                    [checked]="importMode() === 'fulltext'"
                    [disabled]="!target.hasFullText"
                    (change)="importMode.set('fulltext')"
                    style="margin-top: 6px"
                  />
                  <span>
                    <strong>Texto completo</strong>
                    <span class="tiny muted" style="display: block">
                      {{
                        target.hasFullText
                          ? 'Conteúdo integral em acesso aberto. Gera casos clínicos mais completos.'
                          : 'Não disponível para esta fonte (acesso restrito).'
                      }}
                    </span>
                  </span>
                </label>
                <label [class]="'option' + (importMode() === 'abstract' ? ' selected' : '')" style="cursor: pointer">
                  <input type="radio" [checked]="importMode() === 'abstract'" (change)="importMode.set('abstract')" style="margin-top: 6px" />
                  <span>
                    <strong>Somente o resumo</strong>
                    <span class="tiny muted" style="display: block">
                      Mais seguro em relação a direitos autorais; rende blocos de fixação curtos e depende mais da IA.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <label class="switch">
              <input type="checkbox" [ngModel]="importGenerate()" (ngModelChange)="importGenerate.set($event)" />
              Gerar casos automaticamente após importar
            </label>

            @if (importGenerate()) {
              <div class="form-grid">
                <div class="field">
                  <label for="import-mode">Como gerar</label>
                  <select id="import-mode" class="select" [ngModel]="importAiMode()" (ngModelChange)="importAiMode.set($event)">
                    <option value="auto">Automático (IA se disponível)</option>
                    <option value="estruturado">Estruturado (sem IA)</option>
                    <option value="ia" [disabled]="!aiReady()">Somente IA {{ aiReady() ? '' : '(não configurada)' }}</option>
                  </select>
                </div>
                <div class="field">
                  <label for="import-max">Quantidade de casos</label>
                  <input
                    id="import-max"
                    type="number"
                    min="1"
                    max="8"
                    class="input"
                    [ngModel]="importMaxCases()"
                    (ngModelChange)="setImportMax($event)"
                  />
                </div>
                <div class="field span-2">
                  <label class="switch">
                    <input type="checkbox" [ngModel]="importPublish()" (ngModelChange)="importPublish.set($event)" />
                    Publicar os casos gerados
                  </label>
                  <span class="hint">Desmarcado, eles ficam como rascunho para você revisar antes.</span>
                </div>
              </div>
            }

            @if (!aiReady()) {
              <div class="tiny muted">
                Dica: com IA configurada, artigos e capítulos viram casos clínicos completos.
                <a routerLink="/configuracoes">Configurar agora</a>.
              </div>
            }

            @if (importError()) {
              <div class="feedback bad" style="padding: 10px 12px"><span class="small">{{ importError() }}</span></div>
            }
          }
        </div>

      }
      <div footer class="row" style="gap: 8px; justify-content: flex-end; width: 100%">
        @if (!importOutcome() && importTarget()) {
          <button class="btn btn-secondary" type="button" (click)="closeImport()" [disabled]="importBusy()">Cancelar</button>
          <button class="btn btn-primary" type="button" (click)="runImport()" [disabled]="importBusy()">
            @if (importBusy()) {
              <span class="spinner" aria-hidden="true"></span>
              Importando e gerando…
            } @else {
              <sf-icon name="download" [size]="15" />
              Importar
            }
          </button>
        }
      </div>
    </sf-modal>
  `,
})
export class DiscoverPage {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'acervos', label: 'Acervos científicos', icon: 'globe' },
    { id: 'tema', label: 'Gerar por tema', icon: 'sparkles' },
    { id: 'link', label: 'Importar por link', icon: 'link' },
  ];
  readonly areas = AREAS;
  readonly limits = [5, 8, 12, 20];
  readonly counts = [1, 2, 3, 4];
  readonly typeLabel = TYPE_LABEL;
  readonly providerIcon = providerIcon;
  readonly authors = authorsLine;

  readonly pathGuide = [
    { icon: 'folder', title: 'Material próprio', text: 'Já tem o PDF? Envie em Materiais. É a fonte mais fiel ao que a sua prova cobra.' },
    { icon: 'globe', title: 'Acervos científicos', text: 'Quer amplitude e atualidade? Busque artigos e capítulos abertos e importe com fonte.' },
    { icon: 'sparkles', title: 'Por tema (IA)', text: 'Precisa treinar um assunto que não está no seu material? Gere do zero e revise.' },
    { icon: 'link', title: 'Link direto', text: 'Achou uma diretriz ou PDF aberto? Cole o link e a plataforma extrai o texto.' },
  ];

  readonly tab = signal<Tab>('acervos');
  readonly notice = signal<string | null>(null);
  readonly settings = signal<SettingsDTO | null>(null);
  readonly aiReady = computed(() => Boolean(this.settings()?.ai.enabled && this.settings()?.ai.hasKey));
  readonly isGuest = computed(() => !this.auth.user());

  readonly providerList = signal<DiscoveryProviderInfo[]>([]);
  readonly selectedProviders = signal<string[]>(DEFAULT_PROVIDERS);
  readonly discoverySteps = computed(() => {
    const guest = this.isGuest();
    return [
      {
        icon: 'globe',
        title: '1. Busque por tema, condição ou autor',
        text: guest
          ? 'Consultamos Europe PMC, NCBI Bookshelf, OpenAlex e PubMed. A busca é aberta — não precisa de conta.'
          : 'Consultamos Europe PMC, NCBI Bookshelf, OpenAlex, PubMed e a sua própria biblioteca.',
      },
      { icon: 'bookOpen', title: '2. Escolha a fonte', text: 'Texto completo aberto gera casos melhores; resumos geram blocos de fixação curtos.' },
      {
        icon: guest ? 'lock' : 'sparkles',
        title: '3. Importe e gere',
        text: guest
          ? 'Para importar, é preciso entrar: a fonte vira material com referência e licença, e os casos ficam na sua biblioteca.'
          : 'A fonte vira material com referência e licença; depois os casos são gerados (IA ou modo estruturado).',
      },
    ];
  });

  // busca
  readonly query = signal('');
  readonly onlyOA = signal(false);
  readonly limit = signal(8);
  readonly busy = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly searchData = signal<DiscoverySearchDTO | null>(null);
  readonly expandedKey = signal<string | null>(null);

  // importação
  readonly importTarget = signal<DiscoveryResultDTO | null>(null);
  readonly importMode = signal<'fulltext' | 'abstract'>('abstract');
  readonly importGenerate = signal(true);
  readonly importAiMode = signal<'auto' | 'estruturado' | 'ia'>('auto');
  readonly importPublish = signal(true);
  readonly importMaxCases = signal(3);
  readonly importBusy = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importOutcome = signal<DiscoveryImportOutcome | null>(null);
  readonly importSubtitle = computed(() => {
    const target = this.importTarget();
    if (!target) return '';
    return [target.providerLabel, target.year, target.license].filter(Boolean).join(' · ');
  });

  // tema
  readonly topic = signal('');
  readonly topicArea = signal('');
  readonly topicDifficulty = signal<'facil' | 'media' | 'dificil'>('media');
  readonly topicCount = signal(2);
  readonly topicPublish = signal(true);
  readonly topicBusy = signal(false);
  readonly topicError = signal<string | null>(null);
  readonly topicCreated = signal<{ created: number; updated: number; cases: { id: number; title: string }[] } | null>(null);

  // link
  readonly url = signal('');
  readonly linkTitle = signal('');
  readonly linkGenerate = signal(true);
  readonly linkAiMode = signal<'auto' | 'estruturado' | 'ia'>('auto');
  readonly linkPublish = signal(true);
  readonly linkBusy = signal(false);
  readonly linkError = signal<string | null>(null);
  readonly linkOutcome = signal<DiscoveryImportOutcome | null>(null);

  constructor() {
    this.loadProviders();
    if (this.auth.user()) {
      this.api.settings
        .get()
        .then((settings) => {
          this.settings.set(settings);
          if (this.aiReady()) {
            this.importAiMode.set('auto');
            this.linkAiMode.set('auto');
          } else {
            this.importAiMode.set('estruturado');
            this.linkAiMode.set('estruturado');
          }
        })
        .catch(() => undefined);
    }
  }

  private loadProviders(): void {
    this.api.discovery
      .providers()
      .then(({ providers }) => {
        this.providerList.set(providers);
        if (providers.length === 0) return;
        const valid = this.selectedProviders().filter((id) => providers.some((provider) => provider.id === id));
        this.selectedProviders.set(
          valid.length > 0 ? valid : providers.filter((provider) => provider.id !== 'local').slice(0, 3).map((provider) => provider.id),
        );
      })
      .catch(() => undefined);
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.notice.set(null);
  }

  toggleProvider(id: string): void {
    this.selectedProviders.update((list) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id]));
  }

  toggleExpanded(key: string): void {
    this.expandedKey.set(this.expandedKey() === key ? null : key);
  }

  setImportMax(value: number | string): void {
    this.importMaxCases.set(Math.max(1, Math.min(8, Number(value) || 1)));
  }

  private handleImported(outcome: DiscoveryImportOutcome, openMaterial: boolean): void {
    if (outcome.generation && outcome.generation.created + outcome.generation.updated > 0) {
      this.toast.success(`${outcome.generation.created} caso(s) criado(s) a partir da fonte.`);
      if (!openMaterial) void this.router.navigate(['/casos'], { queryParams: { fonte: outcome.source.id } });
      return;
    }
    if (outcome.generationError) {
      this.toast.error(outcome.generationError);
    } else {
      this.notice.set(
        'Material importado, mas nenhum caso foi gerado automaticamente. Abra o material para revisar a leitura e gerar manualmente — ou ative a IA em Configurações.',
      );
    }
  }

  async runSearch(): Promise<void> {
    const query = this.query().trim();
    if (query.length < 2) {
      this.searchError.set('Digite pelo menos 2 caracteres.');
      return;
    }
    if (this.selectedProviders().length === 0) {
      this.searchError.set('Selecione pelo menos um acervo.');
      return;
    }
    this.busy.set(true);
    this.searchError.set(null);
    try {
      const response = await this.api.discovery.search({
        q: query,
        providers: this.selectedProviders(),
        limit: this.limit(),
        oa: this.onlyOA(),
      });
      this.searchData.set(response);
      if (response.results.length === 0) {
        const failed = response.statuses.filter((status) => !status.ok);
        this.searchError.set(
          failed.length > 0
            ? 'Nenhum resultado: os acervos externos não responderam. Veja os detalhes por acervo abaixo.'
            : 'Nenhum resultado encontrado. Tente termos mais amplos (ex.: “sepse”, “heart failure”) ou em inglês.',
        );
      }
    } catch (error) {
      this.searchError.set(errorMessage(error, 'Não foi possível consultar os acervos.'));
    } finally {
      this.busy.set(false);
    }
  }

  requestImport(result: DiscoveryResultDTO): void {
    if (this.isGuest()) {
      void this.router.navigate(['/login'], { queryParams: { next: '/descobrir' } });
      return;
    }
    this.importTarget.set(result);
    this.importOutcome.set(null);
    this.importError.set(null);
    this.importMode.set(result.hasFullText ? 'fulltext' : 'abstract');
    this.importGenerate.set(true);
    this.importPublish.set(true);
    this.importMaxCases.set(3);
    this.importAiMode.set(this.aiReady() ? 'auto' : 'estruturado');
  }

  closeImport(): void {
    if (this.importBusy()) return;
    this.importTarget.set(null);
    this.importOutcome.set(null);
    this.importError.set(null);
  }

  async runImport(): Promise<void> {
    const target = this.importTarget();
    if (!target) return;
    this.importBusy.set(true);
    this.importError.set(null);
    try {
      const outcome = await this.api.discovery.importResult({
        provider: target.provider,
        id: target.id,
        result: target,
        mode: this.importMode(),
        generate: this.importGenerate(),
        aiMode: this.importAiMode(),
        publish: this.importPublish(),
        maxCases: this.importMaxCases(),
      });
      this.importOutcome.set(outcome);
      this.handleImported(outcome, true);
    } catch (error) {
      this.importError.set(errorMessage(error, 'Não foi possível importar esta fonte.'));
    } finally {
      this.importBusy.set(false);
    }
  }

  async runTopic(): Promise<void> {
    const topic = this.topic().trim();
    if (topic.length < 3) {
      this.topicError.set('Informe um tema com pelo menos 3 caracteres.');
      return;
    }
    this.topicBusy.set(true);
    this.topicError.set(null);
    this.topicCreated.set(null);
    try {
      const response = await this.api.generate.topic({
        topic,
        area: this.topicArea() || undefined,
        difficulty: this.topicDifficulty(),
        count: this.topicCount(),
        publish: this.topicPublish(),
      });
      this.topicCreated.set(response);
      this.toast.success(`${response.created} caso(s) criado(s) sobre “${topic}”.`);
    } catch (error) {
      this.topicError.set(errorMessage(error, 'Não foi possível gerar os casos.'));
    } finally {
      this.topicBusy.set(false);
    }
  }

  async runLink(): Promise<void> {
    const url = this.url().trim();
    if (!/^https?:\/\//i.test(url)) {
      this.linkError.set('Informe uma URL completa, começando por https://');
      return;
    }
    this.linkBusy.set(true);
    this.linkError.set(null);
    try {
      const outcome = await this.api.discovery.url({
        url,
        title: this.linkTitle().trim() || undefined,
        generate: this.linkGenerate(),
        aiMode: this.linkAiMode(),
        publish: this.linkPublish(),
        maxCases: 3,
      });
      this.linkOutcome.set(outcome);
      this.handleImported(outcome, true);
    } catch (error) {
      this.linkError.set(errorMessage(error, 'Não foi possível importar este link.'));
    } finally {
      this.linkBusy.set(false);
    }
  }
}
