import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { getActiveRestaurantId } from '@/server/restaurants/getActiveRestaurantId';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

function createSlugQueryResult(data: unknown, error: unknown = null) {
  return {
    eq: vi.fn(function eq(column: string, value: unknown) {
      if (column === 'slug') {
        expect(value).toBe('three-horseshoes');
      }
      if (column === 'is_active') {
        expect(value).toBe(true);
      }
      return this;
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createListQueryResult(data: unknown, error: unknown = null) {
  return {
    eq: vi.fn(function eq(column: string, value: unknown) {
      expect(column).toBe('is_active');
      expect(value).toBe(true);
      return this;
    }),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createActiveIdQueryResult(data: unknown, error: unknown = null) {
  return {
    eq: vi.fn(function eq(column: string, value: unknown) {
      if (column === 'id') {
        expect(value).toBe('rest-1');
      }
      if (column === 'is_active') {
        expect(value).toBe(true);
      }
      return this;
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('restaurant visibility readers', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('filters public slug lookups to active restaurants', async () => {
    const slugQuery = createSlugQueryResult({
      id: 'rest-1',
      name: 'Three Horseshoes',
      slug: 'three-horseshoes',
      timezone: 'Europe/London',
      capacity: 60,
      address: '1 High Street',
      booking_policy: null,
      contact_email: null,
      contact_phone: null,
      google_map_url: null,
      google_review_url: null,
      is_active: true,
      email_templates: null,
      email_send_reminder_24h: true,
      email_send_reminder_short: true,
      email_send_review_request: true,
      reservation_interval_minutes: 30,
      reservation_default_duration_minutes: 90,
      reservation_lifecycle_grace_minutes: 15,
      reservation_last_seating_buffer_minutes: 15,
      created_at: '2026-04-07T00:00:00Z',
      updated_at: '2026-04-07T00:00:00Z',
      logo_url: null,
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => slugQuery),
      })),
    });

    await expect(getRestaurantBySlug('three-horseshoes')).resolves.toMatchObject({
      id: 'rest-1',
      slug: 'three-horseshoes',
      isActive: true,
    });
  });

  it('filters public restaurant lists to active restaurants', async () => {
    const listQuery = createListQueryResult([
      {
        id: 'rest-1',
        name: 'Three Horseshoes',
        slug: 'three-horseshoes',
        timezone: 'Europe/London',
        capacity: 60,
        address: '1 High Street',
        booking_policy: null,
        contact_email: null,
        contact_phone: null,
        google_map_url: null,
        google_review_url: null,
        logo_url: null,
        is_active: true,
        reservation_interval_minutes: 30,
        reservation_default_duration_minutes: 90,
        reservation_last_seating_buffer_minutes: 15,
        reservation_lifecycle_grace_minutes: 15,
        created_at: '2026-04-07T00:00:00Z',
        updated_at: '2026-04-07T00:00:00Z',
      },
    ]);

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => listQuery),
      })),
    });

    await expect(listRestaurants()).resolves.toEqual([
      expect.objectContaining({
        id: 'rest-1',
        slug: 'three-horseshoes',
        isActive: true,
      }),
    ]);
  });

  it('returns null for inactive-or-missing ids in the active-id lookup', async () => {
    const activeIdQuery = createActiveIdQueryResult(null);

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => activeIdQuery),
      })),
    });

    await expect(getActiveRestaurantId('rest-1')).resolves.toBeNull();
  });
});
