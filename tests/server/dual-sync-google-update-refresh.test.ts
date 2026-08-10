import { describe, expect, it, vi } from 'vitest';

import { refreshGoogleUpdateMasks } from '@/server/dual-sync/freshness/refresh-google-updates';

const FENCE = {
  restaurantId: 'rest-1',
  externalProfileRowId: 'profile-row-1',
  externalAccountId: 'account-1',
  externalProfileId: 'profile-1',
  externalLocationId: 'location-1',
  connectionGeneration: 2,
  consentEpoch: 3,
} as const;

describe('fenced Google update refresh', () => {
  it('reads location and attributes only and persists metadata under the exact connection fence', async () => {
    // Given
    const provider = {
      readLocationMasks: vi.fn(async () => ({ diffMasks: ['title'], pendingMasks: [] })),
      readAttributeMasks: vi.fn(async () => ({
        diffMasks: ['attributes.has_wifi'],
        pendingMasks: [],
      })),
    };
    const persist = vi.fn(async () => undefined);

    // When
    const result = await refreshGoogleUpdateMasks({
      fence: FENCE,
      eventId: 'message-1',
      observedAt: '2026-08-09T10:00:00.000Z',
      provider,
      persistence: { persist },
    });

    // Then
    expect(provider.readLocationMasks).toHaveBeenCalledWith('location-1');
    expect(provider.readAttributeMasks).toHaveBeenCalledWith('location-1');
    expect(persist).toHaveBeenCalledWith({
      fence: FENCE,
      eventId: 'message-1',
      observedAt: '2026-08-09T10:00:00.000Z',
      expiresAt: '2026-09-06T10:00:00.000Z',
      overlay: {
        state: 'actionable',
        updateMasks: ['attributes.has_wifi', 'title'],
        displayOnlyPaths: [],
      },
      locationMasks: ['title'],
      attributePaths: ['attributes.has_wifi'],
    });
    expect(result.updateMasks).not.toContain('foodMenus');
  });
});
