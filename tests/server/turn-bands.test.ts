import { describe, expect, it } from 'vitest';

import { getVenuePolicy, resolveTurnBand } from '@/server/capacity/policy';
import { normalizeTurnBandsPayload } from '@/server/restaurants/turnBands';

describe('turn bands', () => {
  it('normalizes and sorts payload bands', () => {
    const payload = {
      lunch: [
        { maxPartySize: 4, durationMinutes: 75 },
        { maxPartySize: 2, durationMinutes: 60 },
      ],
    };

    const normalized = normalizeTurnBandsPayload(payload);

    expect(normalized.lunch).toHaveLength(2);
    expect(normalized.lunch[0]?.maxPartySize).toBe(2);
    expect(normalized.lunch[1]?.maxPartySize).toBe(4);
  });

  it('rejects duplicate max party sizes', () => {
    const payload = {
      lunch: [
        { maxPartySize: 2, durationMinutes: 60 },
        { maxPartySize: 2, durationMinutes: 75 },
      ],
    };

    expect(() => normalizeTurnBandsPayload(payload)).toThrow(/unique max party sizes/i);
  });

  it('uses booking option overrides when present', () => {
    const policy = getVenuePolicy({
      turnBandsByOption: {
        lunch: [
          { maxPartySize: 2, durationMinutes: 50 },
          { maxPartySize: 4, durationMinutes: 70 },
        ],
      },
    });

    const band = resolveTurnBand({
      serviceKey: 'lunch',
      partySize: 3,
      bookingOption: 'lunch',
      policy,
    });

    expect(band.durationMinutes).toBe(70);
  });

  it('falls back to service bands when no override exists', () => {
    const policy = getVenuePolicy();
    const band = resolveTurnBand({
      serviceKey: 'dinner',
      partySize: 2,
      bookingOption: 'brunch',
      policy,
    });

    expect(band.durationMinutes).toBe(policy.services.dinner?.turnBands[0]?.durationMinutes);
  });
});
