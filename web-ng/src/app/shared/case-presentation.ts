import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CasePresentation as Presentation } from '@shared/types';
import { Icon } from './icon';

@Component({
  selector: 'sf-case-presentation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @let p = presentation();
    <div class="case-presentation">
      <div class="patient-head">
        <div class="patient-avatar"><sf-icon name="stethoscope" [size]="22" /></div>
        <div>
          <div class="section-label" style="margin-bottom: 2px">Paciente</div>
          <h3 style="font-size: 16px">{{ p.paciente || 'Paciente' }}</h3>
          @if (p.queixa) {
            <p class="small" style="color: var(--ink-2); margin-top: 2px">{{ p.queixa }}</p>
          }
        </div>
      </div>

      @if (objectives().length > 0) {
        <div>
          <div class="section-label">Objetivos de aprendizagem</div>
          <div class="pill-list">
            @for (objective of objectives(); track objective) {
              <span class="badge badge-neutral">{{ objective }}</span>
            }
          </div>
        </div>
      }

      @if (p.historia.length) {
        <div>
          <div class="section-label">História</div>
          <ul class="clinical-list">
            @for (line of p.historia; track $index) {
              <li>{{ line }}</li>
            }
          </ul>
        </div>
      }

      @if (p.antecedentes.length) {
        <div>
          <div class="section-label">Antecedentes</div>
          <ul class="clinical-list">
            @for (line of p.antecedentes; track $index) {
              <li>{{ line }}</li>
            }
          </ul>
        </div>
      }

      @if (p.exameFisico.length) {
        <div>
          <div class="section-label">Exame físico</div>
          <ul class="clinical-list">
            @for (line of p.exameFisico; track $index) {
              <li>{{ line }}</li>
            }
          </ul>
        </div>
      }

      @if (p.sinaisVitais.length) {
        <div>
          <div class="section-label">Sinais vitais</div>
          <div class="vitals">
            @for (vital of p.sinaisVitais; track vital.label + $index) {
              <div class="vital">
                <div class="vital-label">{{ vital.label }}</div>
                <div class="vital-value" [class]="vital.flag ?? 'normal'">{{ vital.value }}</div>
              </div>
            }
          </div>
        </div>
      }

      @if (p.exames.length) {
        <div>
          <div class="section-label">Exames complementares</div>
          <table class="labs">
            <thead>
              <tr>
                <th>Exame</th>
                <th>Resultado</th>
                <th>Referência</th>
              </tr>
            </thead>
            <tbody>
              @for (exam of p.exames; track exam.nome + $index) {
                <tr>
                  <td style="font-weight: 600">{{ exam.nome }}</td>
                  <td>{{ exam.resultado }}</td>
                  <td class="ref">{{ exam.ref ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (p.imagem) {
        <div>
          <div class="section-label">Imagem / traçado</div>
          <div class="image-report">{{ p.imagem }}</div>
        </div>
      }
    </div>
  `,
})
export class CasePresentation {
  readonly presentation = input.required<Presentation>();
  readonly objectives = input<string[]>([]);
}
