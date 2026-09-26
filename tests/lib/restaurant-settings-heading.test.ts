import { describe, expect, it } from 'vitest';

import { getRestaurantSettingsHeadingContext } from '@/components/features/restaurant-settings/restaurantSettingsHeading';
import {
  getRestaurantSettingsAvailabilityAlias,
  RESTAURANT_SETTINGS_AVAILABILITY_ALIASES,
} from '@/components/features/restaurant-settings/routes';

describe('getRestaurantSettingsHeadingContext', () => {
  it('names the page in the chrome and leaves the purpose line to the page', () => {
    const context = getRestaurantSettingsHeadingContext('/app/settings/restaurant/profile');

    expect(context.pageTitle).toBe('Restaurant profile');
    expect(context.chromeLeafTitle).toBe('Restaurant profile');
    expect(context.hidePageIntro).toBe(true);
  });

  it('lets every settings route own its purpose line', () => {
    for (const path of [
      '/app/settings/restaurant',
      '/app/settings/restaurant/profile',
      '/app/settings/restaurant/availability',
      '/app/settings/restaurant/discovery',
      '/app/settings/restaurant/menu',
      '/app/settings/restaurant/tables',
      '/app/settings/restaurant/team',
      '/app/settings/restaurant/google-business-profile',
    ]) {
      expect(getRestaurantSettingsHeadingContext(path).hidePageIntro).toBe(true);
    }
  });

  it('keeps the shell purpose line for paths without settings route copy', () => {
    expect(getRestaurantSettingsHeadingContext('/app/settings/unknown').hidePageIntro).toBe(false);
  });

  it('titles former availability routes as the Availability page they render', () => {
    const context = getRestaurantSettingsHeadingContext('/app/settings/restaurant/service-periods');

    expect(context.pageTitle).toBe('Availability & Booking types');
    expect(context.chromeLeafTitle).toBe('Availability & Booking types');
  });
});

describe('availability alias routes', () => {
  it('keeps alias anchors aligned with the Availability page sections', () => {
    expect(RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.map((route) => route.href)).toEqual([
      '/app/settings/restaurant/service-periods#service-windows',
      '/app/settings/restaurant/operating-hours#weekly-hours',
      '/app/settings/restaurant/turn-durations#booking-occasions',
      '/app/settings/restaurant/occasions#booking-occasions',
    ]);
  });

  it('detects an alias from the pathname only', () => {
    expect(
      getRestaurantSettingsAvailabilityAlias('/app/settings/restaurant/operating-hours'),
    ).toMatchObject({
      slug: 'operating-hours',
      title: 'Operating hours',
      availabilityAnchor: 'weekly-hours',
    });
    expect(
      getRestaurantSettingsAvailabilityAlias('/app/settings/restaurant/availability'),
    ).toBeNull();
    expect(getRestaurantSettingsAvailabilityAlias(null)).toBeNull();
  });
});
