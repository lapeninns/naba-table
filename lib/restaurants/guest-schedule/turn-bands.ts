/**
 * Table-time (turn band) selection shared by `server/capacity/policy.ts` and the Availability
 * booking preview. Pure and client-safe.
 */

export type TurnBand = {
  maxPartySize: number;
  durationMinutes: number;
};

export type TurnBandsByOption = Record<string, TurnBand[]>;

/** Built-in table times used when a restaurant has no bands for a booking type. */
export const DEFAULT_SERVICE_TURN_BANDS = {
  lunch: [
    { maxPartySize: 2, durationMinutes: 60 },
    { maxPartySize: 4, durationMinutes: 75 },
    { maxPartySize: 6, durationMinutes: 85 },
    { maxPartySize: 8, durationMinutes: 85 },
  ],
  dinner: [
    { maxPartySize: 2, durationMinutes: 60 },
    { maxPartySize: 4, durationMinutes: 75 },
    { maxPartySize: 6, durationMinutes: 85 },
    { maxPartySize: 8, durationMinutes: 90 },
  ],
} as const satisfies Record<'lunch' | 'dinner', readonly TurnBand[]>;

export function normalizeBookingOptionKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.toString().trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * The first band whose max party size covers the party, else the last band. A party size that
 * is not a positive number takes the first band. Null when there are no bands.
 */
export function selectTurnBandOrNull(
  bands: readonly TurnBand[] | null | undefined,
  partySize: number,
): TurnBand | null {
  if (!bands || bands.length === 0) {
    return null;
  }

  if (!Number.isFinite(partySize) || partySize <= 0) {
    return bands[0]!;
  }

  for (const band of bands) {
    if (partySize <= band.maxPartySize) {
      return band;
    }
  }

  return bands[bands.length - 1]!;
}
