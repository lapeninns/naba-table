import { describe, expect, it } from 'vitest';

import { buildGoogleUpdateOverlay } from '@/server/dual-sync/freshness/google-update-overlay';

describe('Google update metadata overlay', () => {
  it('combines location and attribute masks without retaining provider values', () => {
    // Given
    const input = {
      location: { diffMasks: ['title'], pendingMasks: ['phoneNumbers.primaryPhone'] },
      attributes: { diffMasks: ['attributes.has_wifi'], pendingMasks: [] },
    };

    // When
    const overlay = buildGoogleUpdateOverlay(input);

    // Then
    expect(overlay).toEqual({
      state: 'actionable',
      updateMasks: ['attributes.has_wifi', 'phoneNumbers.primaryPhone', 'title'],
      displayOnlyPaths: [],
    });
  });

  it('makes unknown roots and prefix-conflicting paths display-only', () => {
    // Given
    const input = {
      location: { diffMasks: ['title', 'title.value', 'futureField.value'], pendingMasks: [] },
      attributes: {
        diffMasks: ['attributes.has_wifi'],
        pendingMasks: ['attributes.has_wifi.value'],
      },
    };

    // When
    const overlay = buildGoogleUpdateOverlay(input);

    // Then
    expect(overlay).toEqual({
      state: 'display_only',
      updateMasks: [],
      displayOnlyPaths: [
        'attributes.has_wifi',
        'attributes.has_wifi.value',
        'futureField.value',
        'title',
        'title.value',
      ],
    });
  });

  it('retains provider-classified unknown paths and keeps menu changes display-only', () => {
    // Given
    const input = {
      location: { diffMasks: ['menus'], pendingMasks: [], unknownPaths: ['futureLocation.child'] },
      attributes: { diffMasks: [], pendingMasks: [], unknownPaths: ['futureAttribute.child'] },
    };

    // When
    const overlay = buildGoogleUpdateOverlay(input);

    // Then
    expect(overlay).toEqual({
      state: 'display_only',
      updateMasks: [],
      displayOnlyPaths: ['futureAttribute.child', 'futureLocation.child', 'menus'],
    });
  });
});
