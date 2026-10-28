import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';
import { Api, errorMessage } from '../core/api';
import { Icon, Logo } from '../shared/icon';
import { Spinner } from '../shared/ui';

@Component({
  selector: 'sf-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, Logo, Spinner],
  template: `
    <div class="auth">
      <aside class="auth-aside">
        <div class="brand">
          <sf-logo [size]="40" />
          <div>
            <span class="brand-name">Study Flux</span>
            <span class="brand-sub">Do material ao caso clínico</span>
          </div>
        </div>

        <div style="position: relative; z-index: 1">
          <h2>Suas provas antigas viram casos clínicos para treinar.</h2>
          <p>
            Envie um PDF de prova, um capítulo de livro ou cole um resumo. O Study Flux organiza o conteúdo, gera casos e ainda
            monta revisões espaçadas dos pontos que você errou.
          </p>
          <div class="auth-features">
            <div class="auth-feature">
              <sf-icon name="file" [size]="18" />
              <div>
                Material vira questão
                <small>PDF, DOCX, texto colado ou prova antiga com gabarito.</small>
              </div>
            </div>
            <div class="auth-feature">
              <sf-icon name="globe" [size]="18" />
              <div>
                Busca em acervos abertos
                <small>Artigos e capítulos do Europe PMC, NCBI Bookshelf, OpenAlex e PubMed.</small>
              </div>
            </div>
            <div class="auth-feature">
              <sf-icon name="stethoscope" [size]="18" />
              <div>
                Casos clínicos completos
                <small>Anamnese, exame físico, exames e perguntas em progressão.</small>
              </div>
            </div>
            <div class="auth-feature">
              <sf-icon name="layers" [size]="18" />
              <div>
                Revisão que acompanha você
                <small>O que você erra volta no momento certo, com repetição espaçada.</small>
              </div>
            </div>
            <div class="auth-feature">
              <sf-icon name="chart" [size]="18" />
              <div>
                Clareza sobre o que falta
                <small>Desempenho por área e tema, direto ao ponto.</small>
              </div>
            </div>
          </div>
        </div>

        <div class="auth-quote">Feito para o período de provas: estudar com casos rende mais do que reler o capítulo.</div>
      </aside>

      <main class="auth-main">
        <div class="auth-card">
          <div class="row" style="margin-bottom: 22px">
            <sf-logo [size]="34" />
            <strong style="font-size: 15px; letter-spacing: -0.02em">Study Flux</strong>
          </div>
          <h1>{{ mode() === 'login' ? 'Entrar na sua conta' : 'Criar conta' }}</h1>
          <p class="small muted" style="margin-bottom: 20px">
            @if (mode() === 'login') {
              Continue de onde parou e mantenha sua sequência de estudo.
            } @else {
              Leva menos de um minuto. Seus materiais ficam vinculados à sua conta.
            }
          </p>

          <form class="stack" (ngSubmit)="submit()">
            @if (mode() === 'register') {
              <div class="field">
                <label for="name">Nome</label>
                <input id="name" class="input" [(ngModel)]="name" name="name" placeholder="Como podemos te chamar?" autocomplete="name" required />
              </div>
            }
            <div class="field">
              <label for="email">E-mail</label>
              <input id="email" type="email" class="input" [(ngModel)]="email" name="email" placeholder="voce@exemplo.com" autocomplete="email" required />
            </div>
            <div class="field">
              <label for="password">Senha</label>
              <input
                id="password"
                type="password"
                class="input"
                [(ngModel)]="password"
                name="password"
                [placeholder]="mode() === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'"
                [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'"
                [minLength]="mode() === 'register' ? 8 : 0"
                required
              />
            </div>

            @if (error()) {
              <div class="feedback bad" style="padding: 10px 12px"><span>{{ error() }}</span></div>
            }

            <button class="btn btn-primary btn-block btn-lg" type="submit" [disabled]="busy() !== null">
              @if (busy() === 'form') {
                <sf-spinner />
              }
              {{ mode() === 'login' ? 'Entrar' : 'Criar minha conta' }}
            </button>
          </form>

          @if (demoEnabled()) {
            <div class="demo-box">
              <div>
                <strong class="small">Só quer ver como funciona?</strong>
                <div class="tiny muted">Conta demo com casos, materiais e histórico prontos.</div>
              </div>
              <button class="btn btn-secondary btn-sm" type="button" (click)="enterDemo()" [disabled]="busy() !== null">
                @if (busy() === 'demo') {
                  <sf-spinner [dark]="true" />
                } @else {
                  <sf-icon name="sparkles" [size]="14" />
                }
                Entrar como demo
              </button>
            </div>
          }

          <div class="auth-guest">
            <div class="tiny muted" style="margin-bottom: 6px">Ainda só quer pesquisar?</div>
            <a class="btn btn-secondary btn-block" routerLink="/descobrir">
              <sf-icon name="globe" [size]="15" />
              Buscar em acervos científicos sem conta
            </a>
          </div>

          <div class="auth-switch">
            @if (mode() === 'login') {
              Ainda não tem conta?
              <button class="btn btn-ghost btn-sm" type="button" style="padding: 2px 4px" (click)="setMode('register')">Criar agora</button>
            } @else {
              Já tem conta?
              <button class="btn btn-ghost btn-sm" type="button" style="padding: 2px 4px" (click)="setMode('login')">Entrar</button>
            }
          </div>
        </div>
      </main>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly mode = signal<'login' | 'register'>('login');
  readonly busy = signal<'form' | 'demo' | null>(null);
  readonly error = signal<string | null>(null);
  readonly demoEnabled = signal(false);
  /** Para onde voltar depois do login (ex.: /descobrir?tab=acervos). Só caminhos internos. */
  readonly redirectTo = (() => {
    const next = this.route.snapshot.queryParamMap.get('next') ?? '';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/';
  })();

  name = '';
  email = '';
  password = '';

  constructor() {
    if (this.route.snapshot.queryParamMap.get('mode') === 'register') this.mode.set('register');
    this.api
      .health()
      .then((health) => this.demoEnabled.set(health.demo))
      .catch(() => undefined);
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.busy.set('form');
    try {
      if (this.mode() === 'register') await this.auth.register(this.name, this.email, this.password);
      else await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(this.redirectTo);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível entrar. Tente novamente.'));
    } finally {
      this.busy.set(null);
    }
  }

  async enterDemo(): Promise<void> {
    this.error.set(null);
    this.busy.set('demo');
    try {
      await this.auth.demo();
      await this.router.navigateByUrl(this.redirectTo);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível abrir a conta demo.'));
    } finally {
      this.busy.set(null);
    }
  }
}
