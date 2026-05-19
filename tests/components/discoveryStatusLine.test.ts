import { describe, expect, it } from 'vitest';

import { formatDiscoveryStatus } from '@/components/features/restaurant-settings/discovery/DiscoveryPanelChrome';

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
});
