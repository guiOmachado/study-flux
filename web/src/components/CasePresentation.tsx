import type { ReactNode } from 'react';
import type { CasePresentation as Presentation } from '@shared/types';
import { Icon } from './Icon';

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="section-label">{label}</div>
      {children}
    </div>
  );
}

export function CasePresentation({ presentation, objectives }: { presentation: Presentation; objectives?: string[] }) {
  const hasVitals = presentation.sinaisVitais?.length > 0;
  const hasExams = presentation.exames?.length > 0;
  return (
    <div className="case-presentation">
      <div className="patient-head">
        <div className="patient-avatar">
          <Icon name="stethoscope" size={22} />
        </div>
        <div>
          <div className="section-label" style={{ marginBottom: 2 }}>Paciente</div>
          <h3 style={{ fontSize: 16 }}>{presentation.paciente || 'Paciente'}</h3>
          {presentation.queixa ? <p className="small" style={{ color: 'var(--ink-2)', marginTop: 2 }}>{presentation.queixa}</p> : null}
        </div>
      </div>

      {objectives && objectives.length > 0 ? (
        <Block label="Objetivos de aprendizagem">
          <div className="pill-list">
            {objectives.map((objective) => (
              <span key={objective} className="badge badge-neutral">{objective}</span>
            ))}
          </div>
        </Block>
      ) : null}

      {presentation.historia?.length > 0 ? (
        <Block label="História">
          <ul className="clinical-list">
            {presentation.historia.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </Block>
      ) : null}

      {presentation.antecedentes?.length > 0 ? (
        <Block label="Antecedentes">
          <ul className="clinical-list">
            {presentation.antecedentes.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </Block>
      ) : null}

      {presentation.exameFisico?.length > 0 ? (
        <Block label="Exame físico">
          <ul className="clinical-list">
            {presentation.exameFisico.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </Block>
      ) : null}

      {hasVitals ? (
        <Block label="Sinais vitais">
          <div className="vitals">
            {presentation.sinaisVitais.map((vital, index) => (
              <div key={`${vital.label}-${index}`} className="vital">
                <div className="vital-label">{vital.label}</div>
                <div className={`vital-value ${vital.flag ?? 'normal'}`}>{vital.value}</div>
              </div>
            ))}
          </div>
        </Block>
      ) : null}

      {hasExams ? (
        <Block label="Exames complementares">
          <table className="labs">
            <thead>
              <tr>
                <th>Exame</th>
                <th>Resultado</th>
                <th>Referência</th>
              </tr>
            </thead>
            <tbody>
              {presentation.exames.map((exam, index) => (
                <tr key={`${exam.nome}-${index}`}>
                  <td style={{ fontWeight: 600 }}>{exam.nome}</td>
                  <td>{exam.resultado}</td>
                  <td className="ref">{exam.ref ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      ) : null}

      {presentation.imagem ? (
        <Block label="Imagem / traçado">
          <div className="image-report">{presentation.imagem}</div>
        </Block>
      ) : null}
    </div>
  );
}
