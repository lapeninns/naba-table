import { describe, expect, it } from 'vitest';

import { updateTurnBandsDraft } from '@/components/features/restaurant-settings/availabilityScheduleDraftDomain';

describe('availabilityScheduleDraftDomain', () => {
  it('removes a booking type’s bands when the list is emptied and sets them otherwise', () => {
    expect(
      updateTurnBandsDraft({ lunch: [{ maxPartySize: 4, durationMinutes: 90 }] }, 'lunch', []),
    ).toEqual({});
    expect(updateTurnBandsDraft({}, 'dinner', [{ maxPartySize: 6, durationMinutes: 120 }])).toEqual({
      dinner: [{ maxPartySize: 6, durationMinutes: 120 }],
    });
  });
});
