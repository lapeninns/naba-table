import { describe, expect, it } from 'vitest';

import {
  profileProjectionCleanupTargets,
  serializeOrFilters,
} from '@/server/google-business-profile/workflowProfileProjectionCleanup';

describe('google business profile workflow profile projection cleanup policy', () => {
  it('returns no cleanup targets when no projected profile fields are selected', () => {
    expect(profileProjectionCleanupTargets(undefined)).toEqual([]);
    expect(profileProjectionCleanupTargets(['name'])).toEqual([]);
  });

  it('builds cleanup targets for phone and address projections', () => {
    expect(profileProjectionCleanupTargets(['contactPhone', 'address'])).toEqual([
      {
        table: 'restaurant_phone_numbers',
        filters: {
          source: 'nabatable',
          managed_by: 'nabatable',
        },
        anyOf: {
          phone_kind: 'primary',
          is_primary: true,
        },
      },
      {
        table: 'restaurant_addresses',
        filters: {
          source: 'nabatable',
          managed_by: 'nabatable',
        },
        anyOf: {
          address_type: 'storefront',
          is_primary: true,
        },
      },
    ]);
  });

  it('builds cleanup targets for Google link projections', () => {
    expect(profileProjectionCleanupTargets(['googleMapUrl', 'googleReviewUrl'])).toEqual([
      {
        table: 'restaurant_links',
        filters: {
          source: 'nabatable',
          managed_by: 'nabatable',
          link_type: 'google_map',
          link_status: 'current',
        },
      },
      {
        table: 'restaurant_links',
        filters: {
          source: 'nabatable',
          managed_by: 'nabatable',
          link_type: 'google_review',
          link_status: 'current',
        },
      },
    ]);
  });

  it('serializes Supabase OR filters deterministically', () => {
    expect(serializeOrFilters({ phone_kind: 'primary', is_primary: true })).toBe(
      'phone_kind.eq.primary,is_primary.eq.true',
    );
  });
});
