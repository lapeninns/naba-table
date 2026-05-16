import { describe, expect, it } from 'vitest';

import {
  getQaRestaurantFixtureBySlug,
  listQaRestaurantFixtures,
  QA_PUBLIC_BOOKING_RESTAURANT_ID,
  QA_PUBLIC_BOOKING_RESTAURANT_SLUG,
} from '@/server/restaurants/qa-fixtures';

describe('QA restaurant fixtures', () => {
  it('stays disabled unless QA mocks are explicit', () => {
    expect(getQaRestaurantFixtureBySlug(QA_PUBLIC_BOOKING_RESTAURANT_SLUG, {})).toBeNull();
    expect(listQaRestaurantFixtures({}, {})).toBeNull();
  });

  it('returns a deterministic public booking restaurant when QA mocks are enabled', () => {
    const env = { QA_USE_MOCKS: '1' };

    expect(getQaRestaurantFixtureBySlug(QA_PUBLIC_BOOKING_RESTAURANT_SLUG, env)).toMatchObject({
      id: QA_PUBLIC_BOOKING_RESTAURANT_ID,
      slug: QA_PUBLIC_BOOKING_RESTAURANT_SLUG,
      timezone: 'Europe/London',
    });
    expect(listQaRestaurantFixtures({ search: 'public booking' }, env)).toHaveLength(1);
  });
});
