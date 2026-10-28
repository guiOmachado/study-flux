import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth';
import { Api } from '../core/api';
import { initials } from '../core/format';
import { Icon, Logo } from './icon';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/descobrir', label: 'Descobrir', icon: 'globe' },
  { to: '/materiais', label: 'Materiais', icon: 'folder' },
  { to: '/casos', label: 'Casos clínicos', icon: 'library' },
  { to: '/simulado', label: 'Simulado', icon: 'play' },
  { to: '/progresso', label: 'Progresso', icon: 'chart' },
];

const GUEST_NAV: NavItem[] = [{ to: '/descobrir', label: 'Descobrir', icon: 'globe' }];

@Component({
  selector: 'sf-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo],
  template: `
    <div class="shell">
      @if (open()) {
        <div class="sidebar-overlay" (click)="open.set(false)"></div>
      }
      <aside class="sidebar" [class.open]="open()">
        <a class="brand" [routerLink]="isGuest() ? '/descobrir' : '/'" (click)="open.set(false)">
          <sf-logo />
          <div>
            <span class="brand-name">Study Flux</span>
            <span class="brand-sub">Casos clínicos</span>
          </div>
        </a>

        @if (isGuest()) {
          <span class="nav-label">Explorar</span>
          @for (item of guestNav; track item.to) {
            <a class="nav-link" [routerLink]="item.to" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.end }">
              <sf-icon [name]="item.icon" [size]="17" />
              {{ item.label }}
            </a>
          }

          <div class="sidebar-cta">
            <div class="sidebar-cta-title">
              <sf-icon name="lock" [size]="14" />
              Modo visitante
            </div>
            <p class="tiny muted">
              Você pode buscar e ler os resultados dos acervos. Para importar, gerar casos, treinar e revisar, entre na sua conta.
            </p>
            <a class="btn btn-primary btn-sm btn-block" routerLink="/login" [queryParams]="{ next: '/descobrir' }">
              <sf-icon name="user" [size]="14" />
              Entrar
            </a>
            <a class="btn btn-ghost btn-sm btn-block" routerLink="/login" [queryParams]="{ mode: 'register', next: '/descobrir' }">
              Criar conta grátis
            </a>
          </div>
        } @else {
          <span class="nav-label">Estudar</span>
          @for (item of nav; track item.to) {
            <a class="nav-link" [routerLink]="item.to" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.end }">
              <sf-icon [name]="item.icon" [size]="17" />
              {{ item.label }}
            </a>
          }

          <span class="nav-label">Revisar</span>
          <a class="nav-link" routerLink="/revisao" routerLinkActive="active">
            <sf-icon name="layers" [size]="17" />
            Revisão espaçada
            @if (due() > 0) {
              <span class="nav-badge">{{ due() }}</span>
            }
          </a>
          <a class="nav-link" routerLink="/configuracoes" routerLinkActive="active">
            <sf-icon name="settings" [size]="17" />
            Configurações
          </a>
        }

        <div class="sidebar-foot">
          @if (isGuest()) {
            <div class="user-chip">
              <div class="avatar">?</div>
              <div class="user-meta">
                <div class="user-name">Visitante</div>
                <div class="user-mail">sem conta</div>
              </div>
              <a class="icon-btn" routerLink="/login" [queryParams]="{ next: '/descobrir' }" title="Entrar" aria-label="Entrar">
                <sf-icon name="user" [size]="16" />
              </a>
            </div>
          } @else {
            <div class="user-chip">
              <div class="avatar">{{ userInitials() }}</div>
              <div class="user-meta">
                <div class="user-name">{{ auth.user()?.name }}</div>
                <div class="user-mail">{{ auth.user()?.email }}</div>
              </div>
              <button class="icon-btn" type="button" (click)="logout()" title="Sair" aria-label="Sair">
                <sf-icon name="logout" [size]="16" />
              </button>
            </div>
          }
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="icon-btn" type="button" (click)="open.set(true)" aria-label="Abrir menu">
            <sf-icon name="menu" [size]="20" />
          </button>
          <div class="row" style="gap: 8px">
            <sf-logo [size]="28" />
            <strong style="letter-spacing: -0.02em">Study Flux</strong>
          </div>
          @if (isGuest()) {
            <a class="btn btn-primary btn-sm" routerLink="/login" [queryParams]="{ next: '/descobrir' }">
              <sf-icon name="user" [size]="14" />
              Entrar
            </a>
          } @else {
            <button class="icon-btn" type="button" (click)="logout()" aria-label="Sair">
              <sf-icon name="logout" [size]="18" />
            </button>
          }
        </header>
        <main class="page">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class Layout {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly nav = NAV;
  readonly guestNav = GUEST_NAV;
  readonly open = signal(false);
  readonly due = signal(0);
  readonly isGuest = computed(() => !this.auth.user());
  readonly userInitials = computed(() => initials(this.auth.user()?.name ?? ''));

  constructor() {
    // Fecha o menu ao navegar e recarrega os cards vencidos no badge lateral.
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.open.set(false);
        this.loadDue();
      }
    });
    effect(() => {
      if (this.auth.user()) this.loadDue();
      else this.due.set(0);
    });
    window.addEventListener('sf:srs-changed', () => this.loadDue());
  }

  private loadDue(): void {
    if (!this.auth.user()) return;
    this.api.srs
      .list()
      .then(({ due }) => this.due.set(due))
      .catch(() => undefined);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
