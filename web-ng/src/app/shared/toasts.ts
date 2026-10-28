import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast';
import { Icon } from './icon';

@Component({
  selector: 'sf-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (item of toast.items(); track item.id) {
        <div class="toast" [class.error]="item.tone === 'error'" [class.success]="item.tone === 'success'" (click)="toast.dismiss(item.id)">
          <sf-icon [name]="item.tone === 'error' ? 'alert' : item.tone === 'success' ? 'check' : 'info'" [size]="16" />
          <span>{{ item.message }}</span>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  readonly toast = inject(ToastService);
}
