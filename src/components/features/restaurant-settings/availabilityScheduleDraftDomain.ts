import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

/** Replaces one booking type's table-time bands; an empty list removes the type's bands. */
export function updateTurnBandsDraft(
  draft: TurnBandsPayload,
  optionKey: string,
  nextBands: TurnBandInput[],
): TurnBandsPayload {
  const next = { ...draft };
  if (!nextBands || nextBands.length === 0) {
    delete next[optionKey];
  } else {
    next[optionKey] = nextBands;
  }
  return next;
}
