import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createRestaurant } from '@/server/restaurants/create';

function makeRestaurantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'restaurant-1',
    name: 'The Atomic Arms',
    slug: 'the-atomic-arms',
    timezone: 'Europe/London',
    capacity: 80,
    contact_email: 'hello@example.com',
    contact_phone: '012345678',
    address: '1 Pub Street',
    manager_daily_summary_enabled: false,
    manager_notification_phone: null,
    google_map_url: null,
    google_review_url: null,
    booking_policy: null,
    logo_url: null,
    email_send_reminder_24h: true,
    email_send_reminder_short: true,
    email_send_review_request: true,
    reservation_interval_minutes: 30,
    reservation_default_duration_minutes: 90,
    reservation_last_seating_buffer_minutes: 90,
    reservation_lifecycle_grace_minutes: 30,
    created_at: '2026-05-16T09:39:00.000Z',
    updated_at: '2026-05-16T09:39:00.000Z',
    ...overrides,
  };
}

function makeClient(options: {
  existingSlugRows?: Array<{ id: string } | null>;
  rpcResult?: { data: unknown; error: { message: string } | null };
}) {
  const maybeSingle = vi.fn();
  for (const row of options.existingSlugRows ?? [null]) {
    maybeSingle.mockResolvedValueOnce({ data: row, error: null });
  }
  maybeSingle.mockResolvedValue({ data: null, error: null });

  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    if (table !== 'restaurants') {
      throw new Error(`Unexpected table access: ${table}`);
    }
    return { select };
  });
  const rpc = vi
    .fn()
    .mockResolvedValue(options.rpcResult ?? { data: makeRestaurantRow(), error: null });

  return {
    client: { from, rpc },
    eq,
    from,
    maybeSingle,
    rpc,
    select,
  };
}

describe('createRestaurant', () => {
  it('creates the restaurant and owner membership through one atomic RPC', async () => {
    const { client, rpc } = makeClient({
      rpcResult: { data: makeRestaurantRow({ slug: 'operator-local' }), error: null },
    });

    const result = await createRestaurant(
      {
        name: 'Operator Local',
        timezone: 'Europe/London',
        capacity: 42,
        contactEmail: 'team@example.com',
        reservationLastSeatingBufferMinutes: 120,
      },
      'user-1',
      client as never,
    );

    expect(rpc).toHaveBeenCalledWith('create_restaurant_with_owner', {
      p_address: null,
      p_booking_policy: null,
      p_capacity: 42,
      p_contact_email: 'team@example.com',
      p_contact_phone: null,
      p_email_send_reminder_24h: true,
      p_email_send_reminder_short: true,
      p_email_send_review_request: true,
      p_google_map_url: null,
      p_google_review_url: null,
      p_logo_url: null,
      p_manager_daily_summary_enabled: false,
      p_manager_notification_phone: null,
      p_name: 'Operator Local',
      p_reservation_default_duration_minutes: 90,
      p_reservation_interval_minutes: 30,
      p_reservation_last_seating_buffer_minutes: 120,
      p_reservation_lifecycle_grace_minutes: 30,
      p_slug: 'operator-local',
      p_timezone: 'Europe/London',
      p_user_id: 'user-1',
    });
    expect(result.id).toBe('restaurant-1');
    expect(result.slug).toBe('operator-local');
  });

  it('uses the collision-resolved slug in the atomic creation call', async () => {
    const { client, rpc } = makeClient({
      existingSlugRows: [{ id: 'existing-1' }, null],
      rpcResult: { data: makeRestaurantRow({ slug: 'operator-local-1' }), error: null },
    });

    await createRestaurant(
      { name: 'Operator Local', timezone: 'Europe/London' },
      'user-1',
      client as never,
    );

    expect(rpc).toHaveBeenCalledWith(
      'create_restaurant_with_owner',
      expect.objectContaining({ p_slug: 'operator-local-1' }),
    );
  });

  it('fails before any standalone membership write when atomic creation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, from } = makeClient({
      rpcResult: { data: null, error: { message: 'membership insert failed' } },
    });

    try {
      await expect(
        createRestaurant(
          { name: 'Operator Local', timezone: 'Europe/London' },
          'user-1',
          client as never,
        ),
      ).rejects.toThrow('Failed to create restaurant: membership insert failed');

      expect(from).toHaveBeenCalledTimes(1);
      expect(from).toHaveBeenCalledWith('restaurants');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('defines a service-role-only transactional restaurant creation RPC', () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        'supabase/migrations/20260516093900_atomic_create_restaurant_with_owner.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner');
    expect(migration).toContain('RETURNS public.restaurants');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('INSERT INTO public.restaurants');
    expect(migration).toContain('INSERT INTO public.restaurant_memberships');
    expect(migration).toContain('RETURN created_restaurant');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.create_restaurant_with_owner');
    expect(migration).toContain('FROM authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner');
    expect(migration).toContain('TO service_role');
  });
});
