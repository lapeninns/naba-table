import type { TurnBandInput } from '@/services/ops/restaurants';

export type TurnBandRowError = {
  maxPartySize?: string;
  durationMinutes?: string;
};

export function describeTurnBands(bands: TurnBandInput[] | undefined, fallback: string): string {
  if (!bands || bands.length === 0) return fallback;
  return bands.map((band) => `≤${band.maxPartySize}: ${band.durationMinutes} min`).join(' · ');
}

export function validateTurnBandRows(rows: TurnBandInput[]): {
  ok: boolean;
  errors: TurnBandRowError[];
} {
  if (!rows || rows.length === 0) {
    return { ok: true, errors: [] };
  }

  const errors: TurnBandRowError[] = rows.map(() => ({}));
  const seenSizes = new Map<number, number[]>();

  rows.forEach((row, index) => {
    const size = Number(row.maxPartySize);
    const duration = Number(row.durationMinutes);

    if (!Number.isInteger(size) || size <= 0) {
      errors[index].maxPartySize = 'Enter a positive whole number.';
    } else {
      const occurrences = seenSizes.get(size) ?? [];
      occurrences.push(index);
      seenSizes.set(size, occurrences);
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      errors[index].durationMinutes = 'Enter a positive whole number.';
    }
  });

  seenSizes.forEach((indices) => {
    if (indices.length > 1) {
      indices.forEach((index) => {
        errors[index] = {
          ...errors[index],
          maxPartySize: 'Max party size must be unique.',
        };
      });
    }
  });

  const ok = errors.every((entry) => Object.keys(entry).length === 0);
  return { ok, errors };
}
