import { describe, expect, it } from 'vitest';

import { updateRestaurantSchema } from '@/src/app/api/ops/restaurants/schema';

describe('restaurant profile partial-update schema', () => {
  it('keeps a brand-only save from clearing omitted contact and manager fields', () => {
    const brand = { name: 'Village Pub', businessDescription: 'A village pub and kitchen.' };

    expect(updateRestaurantSchema.parse(brand)).toEqual(brand);
  });

  it('preserves explicit clears without adding other field updates', () => {
    const clears = {
      contactEmail: null,
      contactPhone: null,
      address: null,
      businessDescription: null,
      managerNotificationPhone: null,
      managerName: null,
      bookingPolicy: null,
    };

    expect(updateRestaurantSchema.parse(clears)).toEqual(clears);
  });

  it('clears explicitly blank text while preserving omitted fields', () => {
    expect(updateRestaurantSchema.parse({ businessDescription: '   ' })).toEqual({
      businessDescription: null,
    });
  });
});
