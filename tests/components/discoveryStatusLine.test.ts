import { describe, expect, it } from 'vitest';

import {
  buildDiscoverySaveBoundaryState,
  DISCOVERY_SAVE_BOUNDARIES,
  formatDiscoveryStatus,
  getDiscoverySyncPosture,
} from '@/components/features/restaurant-settings/discovery/discoveryPanelChromeDomain';

describe('formatDiscoveryStatus', () => {
  it('hides suggested zero when GBP is disconnected', () => {
    expect(
      formatDiscoveryStatus({
        coreCount: 2,
        providerCount: 0,
        seedSource: 'empty',
        gbpLinked: false,
      }),
    ).toBe('Saved 2 · Connect Google Business Profile to import suggestions');
  });

  it('describes linked sections with no Google suggestions', () => {
    expect(
      formatDiscoveryStatus({
        coreCount: 1,
        providerCount: 0,
        seedSource: 'core',
        gbpLinked: true,
      }),
    ).toBe('Saved 1 · No Google suggestions for this section');
  });

  it('keeps suggested count when linked provider values exist', () => {
    expect(
      formatDiscoveryStatus({
        coreCount: 0,
        providerCount: 3,
        seedSource: 'provider',
        gbpLinked: true,
      }),
    ).toBe('Saved 0 · Suggested 3 · Pre-filled from Google until you save');
  });

  it('keeps save boundary copy stable by family', () => {
    expect(DISCOVERY_SAVE_BOUNDARIES).toMatchObject({
      businessDetails: 'This saves profile basics only.',
      links: 'This saves discovery links only.',
      categories: 'This saves dining categories only.',
      serviceAreas: 'This saves service areas only.',
      attributes: 'This saves amenities only.',
      serviceItems: 'This saves services only.',
    });
  });

  it('builds save boundary badge state for chrome rendering', () => {
    expect(
      buildDiscoverySaveBoundaryState({
        family: 'links',
        dirty: true,
        saved: false,
        hasError: true,
      }),
    ).toEqual({
      boundaryText: 'This saves discovery links only.',
      dirty: true,
      saved: false,
      hasError: true,
    });
  });

  it('looks up sync posture by family', () => {
    expect(getDiscoverySyncPosture('serviceItems')).toBe(
      'Use services to describe optional offers beyond the standard reservation flow.',
    );
  });
});
