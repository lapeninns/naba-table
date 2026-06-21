import { describe, expect, it } from 'vitest';

import { getRestaurantSettingsHeadingContext } from '@/components/features/restaurant-settings/restaurantSettingsHeading';
import { RESTAURANT_SETTINGS_AVAILABILITY_ALIASES } from '@/components/features/restaurant-settings/routes';

describe('getRestaurantSettingsHeadingContext', () => {
  it('suppresses duplicate page titles for primary settings routes', () => {
    const context = getRestaurantSettingsHeadingContext('/app/settings/restaurant/profile');

    expect(context.pageTitle).toBe('Restaurant profile');
    expect(context.suppressVisiblePageTitle).toBe(true);
    expect(context.hidePageIntro).toBe(true);
    expect(context.chromeBreadcrumb).toBeNull();
    expect(context.chromeLeafTitle).toBe('Restaurant profile');
  });

  it('hides page intro on availability routes with section nav', () => {
    const context = getRestaurantSettingsHeadingContext('/app/settings/restaurant/availability');

    expect(context.hidePageIntro).toBe(true);
  });

  it('keeps page intro on routes without section nav', () => {
    const context = getRestaurantSettingsHeadingContext('/app/settings/restaurant/menu');

    expect(context.hidePageIntro).toBe(false);
    expect(context.suppressVisiblePageTitle).toBe(true);
  });

  it('builds availability alias breadcrumbs', () => {
    const context = getRestaurantSettingsHeadingContext('/app/settings/restaurant/service-periods');

    expect(context.chromeBreadcrumb).toEqual({
      parentTitle: 'Availability & Booking types',
      parentHref: '/app/settings/restaurant/availability',
      leafTitle: 'Service periods',
    });
    expect(context.suppressVisiblePageTitle).toBe(true);
    expect(context.pageDescription).toMatch(/booking windows/i);
  });

  it('keeps availability alias anchors aligned with rendered workspace ids', () => {
    expect(RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.map((route) => route.href)).toEqual([
      '/app/settings/restaurant/service-periods#service-windows',
      '/app/settings/restaurant/operating-hours#weekly-hours',
      '/app/settings/restaurant/turn-durations#booking-occasions',
      '/app/settings/restaurant/occasions#booking-occasions',
    ]);
  });
});
