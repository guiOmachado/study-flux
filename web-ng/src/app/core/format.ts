const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3_600_000);
    if (hours <= 0) {
      const minutes = Math.floor(diff / 60_000);
      return minutes <= 1 ? 'agora' : `há ${minutes} min`;
    }
    return `há ${hours} h`;
  }
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} sem`;
  return formatDate(iso);
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export const difficultyLabel: Record<string, string> = {
  facil: 'Fácil',
  media: 'Média',
  dificil: 'Difícil',
};

export const difficultyTone: Record<string, string> = {
  facil: 'badge-success',
  media: 'badge-warn',
  dificil: 'badge-danger',
};

export const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
};

export const originLabel: Record<string, string> = {
  demo: 'Demonstração',
  estruturado: 'Gerado do material',
  ia: 'Gerado por IA',
  manual: 'Manual',
};

export const formatLabel: Record<string, string> = {
  caso: 'Caso clínico',
  questao: 'Questões',
};

export function kindLabel(kind: string): string {
  if (kind === 'prova') return 'Prova antiga';
  if (kind === 'capitulo') return 'Capítulo';
  return 'Resumo';
}

export function accuracyTone(value: number): string {
  if (value >= 80) return 'badge-success';
  if (value >= 60) return 'badge-warn';
  return 'badge-danger';
}
