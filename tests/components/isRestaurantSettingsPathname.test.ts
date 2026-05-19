import { describe, expect, it } from 'vitest';

import { isRestaurantSettingsPathname } from '@/components/features/ops-shell/isRestaurantSettingsPathname';

describe('isRestaurantSettingsPathname', () => {
  it('matches restaurant settings routes with or without /app prefix', () => {
    expect(isRestaurantSettingsPathname('/app/settings/restaurant')).toBe(true);
    expect(isRestaurantSettingsPathname('/app/settings/restaurant/profile')).toBe(true);
    expect(isRestaurantSettingsPathname('/settings/restaurant/menu')).toBe(true);
  });

  it('does not match other ops routes', () => {
    expect(isRestaurantSettingsPathname('/app/dashboard')).toBe(false);
    expect(isRestaurantSettingsPathname('/app/settings/tables')).toBe(false);
    expect(isRestaurantSettingsPathname(null)).toBe(false);
  });
});
