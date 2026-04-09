import { describe, expect, it } from 'vitest';

import { OPS_NAV_SECTIONS } from '@/components/features/ops-shell/navigation';
import {
  RESTAURANT_SETTINGS_NAV_ITEMS,
  RESTAURANT_SETTINGS_ROUTE_MAP,
} from '@/components/features/restaurant-settings/routes';

describe('restaurant settings route registration', () => {
  it('registers the dedicated Google Business Profile settings route', () => {
    expect(RESTAURANT_SETTINGS_ROUTE_MAP['google-business-profile']).toMatchObject({
      href: '/settings/restaurant/google-business-profile',
      title: 'Google Business Profile',
    });

    expect(
      RESTAURANT_SETTINGS_NAV_ITEMS.some(
        (item) => item.href === '/settings/restaurant/google-business-profile',
      ),
    ).toBe(true);
  });

  it('adds Google Business Profile to the ops restaurant settings navigation', () => {
    const restaurantSettings = OPS_NAV_SECTIONS.find((section) => section.label === 'Restaurant Settings');

    expect(restaurantSettings?.items.some((item) => item.href === '/app/settings/restaurant/google-business-profile')).toBe(
      true,
    );
  });
});
