import { describe, expect, it } from 'vitest';

import { getRestaurantSettingsHeadingContext } from '@/components/features/restaurant-settings/restaurantSettingsHeading';

describe('getRestaurantSettingsHeadingContext', () => {
  it('names the page in the chrome and leaves the purpose line to the page', () => {
    const context = getRestaurantSettingsHeadingContext('/app/settings/restaurant/profile');

    expect(context.pageTitle).toBe('Profile');
    expect(context.chromeLeafTitle).toBe('Profile');
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
});
