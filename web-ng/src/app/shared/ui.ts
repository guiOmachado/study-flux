import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Icon } from './icon';

/* ------------------------------- spinner ------------------------------- */

@Component({
  selector: 'sf-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span class="spinner" [class.dark]="dark()" aria-hidden="true"></span>',
})
export class Spinner {
  readonly dark = input(false);
}

@Component({
  selector: 'sf-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner],
  template: `
    <div class="row" style="justify-content: center; padding: 40px 0; color: var(--muted); gap: 10px">
      <sf-spinner [dark]="true" />
      <span class="small">{{ label() }}</span>
    </div>
  `,
})
export class LoadingBlock {
  readonly label = input('Carregando…');
}

/* ------------------------------ page head ------------------------------ */

@Component({
  selector: 'sf-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
        <ng-content select="[subtitle]" />
      </div>
      <div class="head-actions"><ng-content select="[actions]" /></div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}

/* ------------------------------ empty state ---------------------------- */

@Component({
  selector: 'sf-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="empty">
      <div class="empty-icon"><sf-icon [name]="icon()" [size]="22" /></div>
      <h3>{{ title() }}</h3>
      @if (description()) {
        <p>{{ description() }}</p>
      }
      <div style="margin-top: 8px"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('stethoscope');
  readonly title = input.required<string>();
  readonly description = input<string>('');
}

/* -------------------------------- section ------------------------------ */

@Component({
  selector: 'sf-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      @if (title()) {
        <div class="card-head">
          <h3>{{ title() }}</h3>
          <ng-content select="[action]" />
        </div>
      }
      <div class="card-body"><ng-content /></div>
    </div>
  `,
})
export class SectionCard {
  readonly title = input<string>('');
}

/* --------------------------------- stats ------------------------------- */

@Component({
  selector: 'sf-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat">
      <span class="stat-label">{{ label() }}</span>
      <span class="stat-value">{{ value() }}</span>
      <span class="stat-foot"><ng-content /></span>
    </div>
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
}

@Component({
  selector: 'sf-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring" [style.width.px]="size()" [style.height.px]="size()">
      <svg [attr.width]="size()" [attr.height]="size()">
        <circle [attr.cx]="size() / 2" [attr.cy]="size() / 2" [attr.r]="radius()" fill="none" stroke="#dbeae7" [attr.stroke-width]="stroke()" />
        <circle
          [attr.cx]="size() / 2"
          [attr.cy]="size() / 2"
          [attr.r]="radius()"
          fill="none"
          stroke="var(--brand)"
          [attr.stroke-width]="stroke()"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="offset()"
          style="transition: stroke-dashoffset .5s ease"
        />
      </svg>
      <div class="ring-label">{{ label() ?? rounded() + '%' }}</div>
    </div>
  `,
})
export class ProgressRing {
  readonly value = input.required<number>();
  readonly size = input(84);
  readonly stroke = input(8);
  readonly label = input<string | null>(null);
  readonly rounded = computed(() => Math.round(Math.max(0, Math.min(100, this.value()))));
  readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  readonly offset = computed(() => this.circumference() - (this.rounded() / 100) * this.circumference());
}

/* --------------------------------- modal ------------------------------- */

@Component({
  selector: 'sf-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div
      class="modal-backdrop"
      [style.display]="open() ? 'flex' : 'none'"
      [attr.inert]="open() ? null : ''"
      [attr.aria-hidden]="open() ? null : 'true'"
      (mousedown)="onBackdrop($event)"
    >
      <div class="modal" [class.modal-lg]="wide()" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h2>{{ title() }}</h2>
            @if (description()) {
              <p class="small muted" style="margin-top: 4px">{{ description() }}</p>
            }
          </div>
          <button class="icon-btn" type="button" (click)="closed.emit()" aria-label="Fechar">
            <sf-icon name="close" [size]="18" />
          </button>
        </div>
        <div class="modal-body"><ng-content /></div>
        <div class="modal-foot"><ng-content select="[footer]" /></div>
      </div>
    </div>
  `,
})
export class Modal {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly wide = input(false);
  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.closed.emit();
  };

  constructor() {
    // Trava o scroll do fundo e fecha com Esc enquanto o modal está aberto.
    effect((onCleanup) => {
      if (!this.open()) return;
      const body = this.document.body;
      const previous = body.style.overflow;
      body.style.overflow = 'hidden';
      this.document.addEventListener('keydown', this.onKey);
      onCleanup(() => {
        body.style.overflow = previous;
        this.document.removeEventListener('keydown', this.onKey);
      });
    });
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}

@Component({
  selector: 'sf-confirm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Spinner],
  template: `
    <sf-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      <div class="small" style="color: var(--ink-2)">{{ message() }}</div>
      <div footer class="row" style="gap: 8px; justify-content: flex-end; width: 100%">
        <button class="btn btn-secondary" type="button" (click)="closed.emit()" [disabled]="busy()">Cancelar</button>
        <button class="btn" [class.btn-danger]="danger()" [class.btn-primary]="!danger()" type="button" (click)="confirmed.emit()" [disabled]="busy()">
          @if (busy()) {
            <sf-spinner />
          }
          {{ confirmLabel() }}
        </button>
      </div>
    </sf-modal>
  `,
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly danger = input(false);
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly closed = output<void>();
}
