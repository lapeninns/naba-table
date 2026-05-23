import { normalizeText } from './businessInfoNormalizationCore';

export function normalizeBusinessStatus(value: string | null | undefined): string | null {
  const normalized = normalizeText(value)?.toUpperCase() ?? null;
  switch (normalized) {
    case 'OPEN':
      return 'open';
    case 'CLOSED_PERMANENTLY':
      return 'closed_permanently';
    case 'CLOSED_TEMPORARILY':
      return 'closed_temporarily';
    default:
      return null;
  }
}
