import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

// triage-039 (confirmed P2): GET /api/restaurants / the public marketing list must not expose
// owner contact PII (contact_email / contact_phone) for all restaurants to anonymous callers.

vi.mock('@/server/restaurants/qa-fixtures', () => ({
  listQaRestaurantFixtures: () => undefined,
}));
vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: vi.fn(),
}));

import { getServiceSupabaseClient } from '@/server/supabase';
import { listRestaurants } from '@/server/restaurants/listRestaurants';

const row = {
  id: 'r1',
  name: 'Acme',
  slug: 'acme',
  timezone: 'UTC',
  capacity: 40,
  address: '1 High St',
  booking_policy: 'No-shows charged',
  contact_email: 'owner@private.example',
  contact_phone: '+15551230000',
  google_map_url: 'https://maps.example/acme',
  logo_url: null,
  is_active: true,
  reservation_interval_minutes: 15,
  reservation_default_duration_minutes: 120,
  reservation_lifecycle_grace_minutes: 30,
  reservation_last_seating_buffer_minutes: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

function makeClient(rows: unknown[]): SupabaseClient {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.ilike = () => builder;
  builder.gte = () => builder;
  builder.order = () => builder;
  builder.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
    resolve({ data: rows, error: null });
  return { from: () => builder } as unknown as SupabaseClient;
}

describe('listRestaurants public projection (triage-039)', () => {
  it('does not expose contact email/phone in the public restaurant list', async () => {
    vi.mocked(getServiceSupabaseClient).mockReturnValue(makeClient([row]));

    const result = await listRestaurants();

    expect(result).toHaveLength(1);
    expect('contactEmail' in result[0]).toBe(false);
    expect('contactPhone' in result[0]).toBe(false);
    expect((result[0] as Record<string, unknown>).contactEmail).toBeUndefined();
    expect((result[0] as Record<string, unknown>).contactPhone).toBeUndefined();
    // public, non-sensitive venue fields remain available
    expect(result[0].name).toBe('Acme');
    expect(result[0].slug).toBe('acme');
  });
});
