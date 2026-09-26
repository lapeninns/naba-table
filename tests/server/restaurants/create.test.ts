import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createRestaurant } from '@/server/restaurants/create';
import {
  RestaurantAccessExistsError,
  RestaurantCreateValidationError,
  RestaurantSlugUnavailableError,
} from '@/server/restaurants/create-errors';

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

type RpcResult = {
  data: unknown;
  error: { message: string; code?: string; details?: string } | null;
};

function makeClient(options: { rpcResults?: RpcResult[] } = {}) {
  const from = vi.fn((table: string) => {
    throw new Error(`Unexpected table access: ${table}`);
  });
  const rpc = vi.fn();
  for (const result of options.rpcResults ?? []) {
    rpc.mockResolvedValueOnce(result);
  }
  rpc.mockResolvedValue({ data: makeRestaurantRow(), error: null });

  return { client: { from, rpc }, from, rpc };
}

const SLUG_TAKEN = {
  data: null,
  error: {
    code: '23505',
    message: 'duplicate key value violates unique constraint "restaurants_slug_key"',
    details: 'Key (slug)=(operator-local) already exists.',
  },
};

describe('createRestaurant', () => {
  it('creates the restaurant and owner membership through one atomic RPC', async () => {
    const { client, from, rpc } = makeClient({
      rpcResults: [{ data: makeRestaurantRow({ slug: 'operator-local' }), error: null }],
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
    // No SELECT probing: the unique index inside the RPC is the source of truth.
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('retries with a suffixed slug when the RPC reports a slug unique violation', async () => {
    const { client, from, rpc } = makeClient({
      rpcResults: [
        SLUG_TAKEN,
        { data: makeRestaurantRow({ slug: 'operator-local-x1y2' }), error: null },
      ],
    });

    const result = await createRestaurant(
      { name: 'Operator Local', timezone: 'Europe/London' },
      'user-1',
      client as never,
    );

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_slug: 'operator-local' });
    expect(rpc.mock.calls[1]?.[1].p_slug).toMatch(/^operator-local-[a-z0-9]{4}$/);
    expect(result.slug).toBe('operator-local-x1y2');
    expect(from).not.toHaveBeenCalled();
  });

  it('gives up with a typed error after the slug attempts are exhausted', async () => {
    const { client, rpc } = makeClient({
      rpcResults: [SLUG_TAKEN, SLUG_TAKEN, SLUG_TAKEN, SLUG_TAKEN],
    });

    await expect(
      createRestaurant(
        { name: 'Operator Local', timezone: 'Europe/London' },
        'user-1',
        client as never,
      ),
    ).rejects.toBeInstanceOf(RestaurantSlugUnavailableError);
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it('maps the membership invariant to RestaurantAccessExistsError without retrying', async () => {
    const { client, rpc } = makeClient({
      rpcResults: [
        { data: null, error: { code: '23505', message: 'User already has restaurant access' } },
      ],
    });

    await expect(
      createRestaurant(
        { name: 'Operator Local', timezone: 'Europe/London' },
        'user-1',
        client as never,
      ),
    ).rejects.toBeInstanceOf(RestaurantAccessExistsError);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('falls back to a valid slug when the name has no slug characters', async () => {
    const { client, rpc } = makeClient();

    await createRestaurant({ name: '!!!', timezone: 'Europe/London' }, 'user-1', client as never);

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_slug: 'restaurant' });
  });

  it('throws typed validation errors for out-of-range settings', async () => {
    const { client, rpc } = makeClient();

    await expect(
      createRestaurant(
        { name: 'Operator Local', timezone: 'Europe/London', reservationIntervalMinutes: 0 },
        'user-1',
        client as never,
      ),
    ).rejects.toBeInstanceOf(RestaurantCreateValidationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails before any standalone membership write when atomic creation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, from } = makeClient({
      rpcResults: [{ data: null, error: { message: 'membership insert failed' } }],
    });

    try {
      await expect(
        createRestaurant(
          { name: 'Operator Local', timezone: 'Europe/London' },
          'user-1',
          client as never,
        ),
      ).rejects.toThrow('Failed to create restaurant: membership insert failed');

      expect(from).not.toHaveBeenCalled();
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
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('FROM public.restaurant_memberships');
    expect(migration).toContain('WHERE user_id = p_user_id');
    expect(migration).toContain('User already has restaurant access');
    expect(migration).toContain('INSERT INTO public.restaurants');
    expect(migration).toContain('INSERT INTO public.restaurant_memberships');
    expect(migration).toContain('RETURN created_restaurant');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.create_restaurant_with_owner');
    expect(migration).toContain('FROM authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner');
    expect(migration).toContain('TO service_role');
  });
});
