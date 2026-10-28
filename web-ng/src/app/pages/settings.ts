import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AISettings, SettingsDTO } from '@shared/types';
import { Api, errorMessage } from '../core/api';
import { AuthService } from '../core/auth';
import { ToastService } from '../core/toast';
import { LoadingBlock, PageHeader } from '../shared/ui';
import { Icon } from '../shared/icon';

const PROVIDERS: { value: AISettings['provider']; label: string; defaultUrl: string; hint: string }[] = [
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', hint: 'Modelos como gpt-4o-mini e gpt-4.1-mini.' },
  { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com', hint: 'Modelos Claude, como claude-3-5-haiku.' },
  {
    value: 'compatible',
    label: 'API compatível com OpenAI',
    defaultUrl: '',
    hint: 'Groq, OpenRouter, Together, Ollama ou seu próprio servidor.',
  },
];

@Component({
  selector: 'sf-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, LoadingBlock, PageHeader],
  template: `
    @if (loading()) {
      <sf-loading label="Carregando configurações…" />
    } @else {
      <sf-page-header
        title="Configurações"
        subtitle="Preferências de estudo, conta e integração com IA. Sem IA, a plataforma continua funcionando com o modo estruturado."
      >
        <button actions class="btn btn-primary" type="button" (click)="save()" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner" aria-hidden="true"></span>
            Salvando…
          } @else {
            <sf-icon name="check" [size]="15" />
            Salvar alterações
          }
        </button>
      </sf-page-header>

      <div class="stack">
        <section class="card card-pad stack">
          <h2>Conta e rotina</h2>
          <div class="form-grid">
            <div class="field">
              <label for="settings-name">Nome</label>
              <input id="settings-name" class="input" [ngModel]="name()" (ngModelChange)="name.set($event)" />
            </div>
            <div class="field">
              <label for="settings-email">E-mail</label>
              <input id="settings-email" class="input" [value]="auth.user()?.email ?? ''" disabled />
            </div>
            <div class="field">
              <label for="settings-goal">Meta diária de questões</label>
              <input
                id="settings-goal"
                type="number"
                min="5"
                max="200"
                class="input"
                [ngModel]="dailyGoal()"
                (ngModelChange)="setGoal($event)"
              />
            </div>
            <div class="field">
              <label for="settings-exam">Data da prova</label>
              <input id="settings-exam" type="date" class="input" [ngModel]="examDate()" (ngModelChange)="examDate.set($event)" />
              <span class="hint">Usada para mostrar a contagem regressiva no início.</span>
            </div>
          </div>
          <label class="switch">
            <input type="checkbox" [ngModel]="srsAutoCreate()" (ngModelChange)="srsAutoCreate.set($event)" />
            Criar cards de revisão automaticamente quando eu errar
          </label>
        </section>

        <section class="card card-pad stack">
          <div class="row between row-wrap">
            <div>
              <h2>Geração por IA</h2>
              <p class="small muted" style="margin-top: 4px; max-width: 620px">
                Opcional. Com uma chave de API, o Study Flux transforma capítulos e resumos em casos clínicos completos. Sem isso, o
                modo estruturado continua gerando perguntas a partir do próprio texto.
              </p>
            </div>
            <label class="switch">
              <input type="checkbox" [ngModel]="enabled()" (ngModelChange)="enabled.set($event)" />
              Usar IA
            </label>
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="ai-provider">Provedor</label>
              <select id="ai-provider" class="select" [ngModel]="provider()" (ngModelChange)="setProvider($event)">
                @for (item of providers; track item.value) {
                  <option [value]="item.value">{{ item.label }}</option>
                }
              </select>
              <span class="hint">{{ currentProvider()?.hint }}</span>
            </div>
            <div class="field">
              <label for="ai-base">URL da API</label>
              <input
                id="ai-base"
                class="input"
                [placeholder]="currentProvider()?.defaultUrl || 'https://seu-provedor/v1'"
                [ngModel]="baseUrl()"
                (ngModelChange)="baseUrl.set($event)"
              />
              <span class="hint">Para APIs compatíveis com OpenAI, informe a base terminando em /v1.</span>
            </div>
            <div class="field">
              <label for="ai-model">Modelo</label>
              @if (models().length > 0) {
                <select id="ai-model" class="select" [ngModel]="model()" (ngModelChange)="model.set($event)">
                  <option value="">Selecione um modelo</option>
                  @for (item of models(); track item) {
                    <option [value]="item">{{ item }}</option>
                  }
                </select>
              } @else {
                <input id="ai-model" class="input" placeholder="gpt-4o-mini" [ngModel]="model()" (ngModelChange)="model.set($event)" />
              }
              <div class="row" style="gap: 6px">
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  (click)="detect()"
                  [disabled]="detecting() || (!hasKey() && !apiKey().trim())"
                >
                  @if (detecting()) {
                    <span class="spinner dark" aria-hidden="true"></span>
                  } @else {
                    <sf-icon name="refresh" [size]="13" />
                  }
                  Listar modelos disponíveis
                </button>
                @if (models().length > 0) {
                  <button class="btn btn-ghost btn-sm" type="button" (click)="models.set([])">Digitar manualmente</button>
                }
              </div>
            </div>
            <div class="field">
              <label for="ai-key">Chave de API</label>
              <input
                id="ai-key"
                type="password"
                class="input"
                [placeholder]="hasKey() ? '•••••••••• (chave já salva)' : 'sk-…'"
                [ngModel]="apiKey()"
                (ngModelChange)="apiKey.set($event)"
                autocomplete="off"
              />
              <span class="hint">A chave é criptografada e fica apenas neste servidor. Ela nunca aparece de volta na interface.</span>
              @if (hasKey()) {
                <button class="btn btn-danger-ghost btn-sm" style="align-self: flex-start" type="button" (click)="removeKey()">
                  <sf-icon name="trash" [size]="13" /> Remover chave salva
                </button>
              }
            </div>
          </div>

          <div class="row" style="gap: 8px; flex-wrap: wrap">
            <button class="btn btn-secondary" type="button" (click)="test()" [disabled]="testing()">
              @if (testing()) {
                <span class="spinner dark" aria-hidden="true"></span>
              } @else {
                <sf-icon name="target" [size]="15" />
              }
              Testar conexão
            </button>
            <button class="btn btn-primary" type="button" (click)="save()" [disabled]="saving()">Salvar</button>
            @if (testResult()) {
              <span [class]="'badge ' + (testResult()!.ok ? 'badge-success' : 'badge-danger')" style="padding: 6px 10px">
                {{ testResult()!.message }}
              </span>
            }
          </div>

          <div class="divider"></div>
          <div class="row" style="align-items: flex-start; gap: 10px">
            <sf-icon name="info" [size]="16" style="color: var(--muted); flex: none; margin-top: 2px" />
            <p class="tiny muted">
              Ao gerar com IA, o texto do material é enviado ao provedor escolhido. O Study Flux não guarda a resposta do provedor
              além do caso criado. Use apenas materiais que você tem direito de compartilhar.
            </p>
          </div>
        </section>

        <section class="card card-pad stack">
          <h2>Seus dados</h2>
          <p class="small muted">
            Tudo fica no banco local do Study Flux (SQLite). Você pode exportar seu histórico de respostas a qualquer momento.
          </p>
          <div class="row" style="gap: 8px; flex-wrap: wrap">
            <a class="btn btn-secondary" [href]="exportUrl()">
              <sf-icon name="download" [size]="15" />
              Baixar desempenho (CSV)
            </a>
            <a class="btn btn-secondary" routerLink="/materiais">
              <sf-icon name="folder" [size]="15" />
              Meus materiais
            </a>
            <a class="btn btn-secondary" routerLink="/casos">
              <sf-icon name="library" [size]="15" />
              Meus casos
            </a>
          </div>
        </section>

        <section class="card card-pad stack">
          <h2>Sobre o Study Flux</h2>
          <p class="small muted">
            Plataforma de estudo por casos clínicos. O fluxo é sempre o mesmo: material → casos → treino → revisão. A mesma
            arquitetura serve para outras profissões no futuro, trocando o léxico e o formato de caso.
          </p>
          <div class="grid grid-3" style="gap: 10px">
            @for (item of about; track item.title) {
              <div class="vital">
                <div class="vital-label">{{ item.title }}</div>
                <div class="small" style="color: var(--ink-2); margin-top: 4px">{{ item.text }}</div>
              </div>
            }
          </div>
          <span class="tiny muted">Versão 0.1 · banco local · API Express + Angular</span>
        </section>
      </div>
    }
  `,
})
export class SettingsPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly providers = PROVIDERS;
  readonly about = [
    { title: 'Privado por padrão', text: 'Rascunhos e histórico só aparecem para você. Publicar é opcional.' },
    { title: 'Funciona offline', text: 'Sem IA, o modo estruturado cria perguntas fiéis ao texto.' },
    { title: 'Feito para provas', text: 'Simulados, revisão espaçada e desempenho por tema.' },
  ];

  readonly loading = signal(true);
  readonly name = signal('');
  readonly enabled = signal(false);
  readonly provider = signal<AISettings['provider']>('openai');
  readonly baseUrl = signal('');
  readonly model = signal('');
  readonly apiKey = signal('');
  readonly hasKey = signal(false);
  readonly models = signal<string[]>([]);
  readonly srsAutoCreate = signal(true);
  readonly dailyGoal = signal(20);
  readonly examDate = signal('');
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly detecting = signal(false);
  readonly testResult = signal<{ ok: boolean; message: string } | null>(null);

  readonly currentProvider = computed(() => PROVIDERS.find((item) => item.value === this.provider()));

  constructor() {
    this.name.set(this.auth.user()?.name ?? '');
    this.api.settings
      .get()
      .then((settings) => this.apply(settings))
      .catch((error) => this.toast.error(errorMessage(error, 'Não foi possível carregar as configurações.')))
      .finally(() => this.loading.set(false));
  }

  private apply(settings: SettingsDTO): void {
    this.enabled.set(settings.ai.enabled);
    this.provider.set(settings.ai.provider);
    this.baseUrl.set(settings.ai.baseUrl);
    this.model.set(settings.ai.model);
    this.hasKey.set(settings.ai.hasKey);
    this.srsAutoCreate.set(settings.srsAutoCreate);
    this.dailyGoal.set(settings.dailyGoal);
    this.examDate.set(settings.examDate ?? '');
  }

  exportUrl(): string {
    return this.api.stats.exportUrl();
  }

  setGoal(value: number | string): void {
    this.dailyGoal.set(Math.max(5, Math.min(200, Number(value) || 5)));
  }

  setProvider(value: AISettings['provider']): void {
    const previous = this.currentProvider()?.defaultUrl ?? '';
    this.provider.set(value);
    if (!this.baseUrl() || this.baseUrl() === previous) {
      this.baseUrl.set(PROVIDERS.find((item) => item.value === value)?.defaultUrl ?? '');
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const name = this.name().trim();
      if (name && name !== this.auth.user()?.name) await this.auth.updateName(name);
      const payload: Partial<SettingsDTO> & { apiKey?: string } = {
        ai: { enabled: this.enabled(), provider: this.provider(), baseUrl: this.baseUrl(), model: this.model(), hasKey: this.hasKey() },
        srsAutoCreate: this.srsAutoCreate(),
        dailyGoal: this.dailyGoal(),
        examDate: this.examDate() || null,
      };
      if (this.apiKey().trim()) payload.apiKey = this.apiKey().trim();
      const updated = await this.api.settings.save(payload);
      this.hasKey.set(updated.ai.hasKey);
      this.apiKey.set('');
      this.toast.success('Configurações salvas.');
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível salvar.'));
    } finally {
      this.saving.set(false);
    }
  }

  async test(): Promise<void> {
    this.testing.set(true);
    this.testResult.set(null);
    try {
      const result = await this.api.settings.testAI({
        provider: this.provider(),
        baseUrl: this.baseUrl(),
        apiKey: this.apiKey().trim() || undefined,
      });
      this.testResult.set(result);
      if (result.models && result.models.length > 0) this.models.set(result.models);
    } catch (error) {
      this.testResult.set({ ok: false, message: errorMessage(error, 'Falha ao testar.') });
    } finally {
      this.testing.set(false);
    }
  }

  async detect(): Promise<void> {
    this.detecting.set(true);
    try {
      const result = await this.api.settings.detectModels({
        provider: this.provider(),
        baseUrl: this.baseUrl(),
        apiKey: this.apiKey().trim() || undefined,
      });
      this.models.set(result.models);
      this.toast.success(`${result.models.length} modelos encontrados.`);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível listar os modelos.'));
    } finally {
      this.detecting.set(false);
    }
  }

  async removeKey(): Promise<void> {
    if (!window.confirm('Remover a chave de API salva? A geração por IA deixará de funcionar.')) return;
    try {
      const updated = await this.api.settings.save({ apiKey: '' });
      this.hasKey.set(updated.ai.hasKey);
      this.enabled.set(false);
      this.toast.success('Chave removida.');
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível remover a chave.'));
    }
  }
}
