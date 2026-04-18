import { describe, expect, it } from 'vitest';

import { OPS_NAV_SECTIONS } from '@/components/features/ops-shell/navigation';

describe('OPS_NAV_SECTIONS restaurant settings', () => {
  it('includes Google Business Profile in the main sidebar section', () => {
    const restaurantSettings = OPS_NAV_SECTIONS.find((section) => section.label === 'Restaurant Settings');

    expect(restaurantSettings).toBeDefined();
    expect(restaurantSettings?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Google Business Profile',
          href: '/app/settings/restaurant/google-business-profile',
        }),
      ]),
    );

    const gbpItem = restaurantSettings?.items.find((item) => item.title === 'Google Business Profile');
    expect(gbpItem?.match?.('/app/settings/restaurant/google-business-profile')).toBe(true);
    expect(gbpItem?.match?.('/app/settings/restaurant/google-business-profile/details')).toBe(true);
  });
});
