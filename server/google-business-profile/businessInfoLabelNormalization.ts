import { normalizeText } from './businessInfoNormalizationCore';

export function humanizeIdentifier(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .split(/[._/\s-]+/)
    .map((segment) =>
      segment.length > 0
        ? `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`
        : '',
    )
    .filter(Boolean)
    .join(' ');
}
