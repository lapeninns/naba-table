import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateRestaurant, updateRestaurantProfile } from '@/server/restaurants/update';
import { RestaurantUpdateError } from '@/server/restaurants/update-errors';

const RESTAURANT_ID = 'restaurant-1';
const ACTOR_ID = 'user-1';

const storedRow = {
  id: RESTAURANT_ID,
  name: 'The Bell',
  slug: 'the-bell',
  is_active: true,
  timezone: 'Europe/London',
  capacity: 40,
  contact_email: null,
  contact_phone: null,
  address: null,
  manager_daily_summary_enabled: true,
  manager_whatsapp_enabled: true,
  manager_name: 'Sam',
  manager_notification_phone: '+447700900123',
  google_map_url: null,
  google_review_url: null,
  booking_policy: null,
  logo_url: null,
  email_send_reminder_24h: true,
  email_send_reminder_short: true,
  email_send_review_request: true,
  reservation_interval_minutes: 15,
  reservation_default_duration_minutes: 90,
  reservation_last_seating_buffer_minutes: 15,
  reservation_lifecycle_grace_minutes: 15,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-09-26T10:00:00.000Z',
};

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function makeClient(options: { slugTaken?: boolean; rpcResult?: RpcResult } = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: options.slugTaken ? { id: 'other-restaurant' } : null,
    error: null,
  }));
  const slugQuery = {
    select: vi.fn(() => slugQuery),
    eq: vi.fn(() => slugQuery),
    neq: vi.fn(() => slugQuery),
    maybeSingle,
  };
  const rpc = vi.fn(
    async (): Promise<RpcResult> =>
      options.rpcResult ?? {
        data: {
          restaurant: storedRow,
          business_description: 'Cosy pub',
          previous: { name: 'The Old Bell', slug: 'the-bell', logo_url: 'https://cdn.test/old.png' },
        },
        error: null,
      },
  );
  return { from: vi.fn(() => slugQuery), rpc, slugQuery };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

describe('updateRestaurant (atomic RPC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends only the provided columns and keeps the stored WhatsApp consent', async () => {
    const client = makeClient();

    const result = await updateRestaurant(
      RESTAURANT_ID,
      { managerName: ' Alex ', managerWhatsappConsentActorId: ACTOR_ID },
      client as never,
    );

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('update_restaurant_profile_v1', {
      p_restaurant_id: RESTAURANT_ID,
      p_patch: { manager_name: 'Alex' },
      p_whatsapp_intent: null,
      p_actor_id: ACTOR_ID,
      p_set_business_description: false,
      p_business_description: null,
    });
    // No slug in the input, so no uniqueness lookup.
    expect(client.from).not.toHaveBeenCalled();
    expect(result.managerWhatsappEnabled).toBe(true);
    expect(result.businessDescription).toBe('Cosy pub');
  });

  it('maps the WhatsApp toggle to an intent the database compares with the stored consent', async () => {
    const client = makeClient();

    await updateRestaurant(
      RESTAURANT_ID,
      { managerWhatsappEnabled: true, managerWhatsappConsentActorId: ACTOR_ID },
      client as never,
    );
    await updateRestaurant(RESTAURANT_ID, { managerWhatsappEnabled: false }, client as never);

    expect(client.rpc.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      expect.objectContaining({ p_patch: {}, p_whatsapp_intent: 'enable', p_actor_id: ACTOR_ID }),
      expect.objectContaining({ p_patch: {}, p_whatsapp_intent: 'disable', p_actor_id: null }),
    ]);
  });

  it('writes the business description in the same call', async () => {
    const client = makeClient();

    await updateRestaurant(
      RESTAURANT_ID,
      { name: 'The Bell', businessDescription: '  Cosy pub ' },
      client as never,
    );

    expect(client.rpc).toHaveBeenCalledWith(
      'update_restaurant_profile_v1',
      expect.objectContaining({
        p_patch: { name: 'The Bell' },
        p_set_business_description: true,
        p_business_description: 'Cosy pub',
      }),
    );
  });

  it('returns the pre-update name, slug and logo read under the row lock', async () => {
    const client = makeClient();

    const { restaurant, previous } = await updateRestaurantProfile(
      RESTAURANT_ID,
      { name: 'The Bell' },
      client as never,
    );

    expect(restaurant.name).toBe('The Bell');
    expect(previous).toEqual({
      name: 'The Old Bell',
      slug: 'the-bell',
      logoUrl: 'https://cdn.test/old.png',
    });
  });

  it('treats an RPC result without previous values as an unexpected shape', async () => {
    const client = makeClient({
      rpcResult: { data: { restaurant: storedRow, business_description: null }, error: null },
    });

    await expect(updateRestaurant(RESTAURANT_ID, { name: 'X' }, client as never)).rejects.toThrow(
      'unexpected shape',
    );
  });

  it('maps an explicit daily summary request without a manager phone to a phone field error', async () => {
    const client = makeClient({
      rpcResult: { data: null, error: { code: '22023', message: 'MANAGER_PHONE_REQUIRED' } },
    });

    const error = await captureError(
      updateRestaurant(RESTAURANT_ID, { managerDailySummaryEnabled: true }, client as never),
    );

    expect(error).toBeInstanceOf(RestaurantUpdateError);
    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { managerNotificationPhone: [expect.any(String)] },
    });
  });

  it('returns SLUG_TAKEN with a slug field when another restaurant has the slug', async () => {
    const client = makeClient({ slugTaken: true });

    const error = await captureError(
      updateRestaurant(RESTAURANT_ID, { slug: 'the-crown' }, client as never),
    );

    expect(error).toBeInstanceOf(RestaurantUpdateError);
    expect(error).toMatchObject({ code: 'SLUG_TAKEN', status: 409 });
    expect((error as RestaurantUpdateError).fields?.slug?.[0]).toMatch(/already used/i);
    expect(client.slugQuery.neq).toHaveBeenCalledWith('id', RESTAURANT_ID);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('maps a unique violation from the write (a race after the pre-check) to SLUG_TAKEN', async () => {
    const client = makeClient({
      rpcResult: {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "restaurants_slug_key"',
        },
      },
    });

    const error = await captureError(
      updateRestaurant(RESTAURANT_ID, { slug: 'the-crown' }, client as never),
    );

    expect(error).toMatchObject({ code: 'SLUG_TAKEN', status: 409 });
    expect((error as RestaurantUpdateError).fields).toHaveProperty('slug');
  });

  it('maps database consent and check refusals to field validation errors', async () => {
    const phoneClient = makeClient({
      rpcResult: { data: null, error: { code: '22023', message: 'MANAGER_PHONE_REQUIRED' } },
    });
    const capacityClient = makeClient({
      rpcResult: {
        data: null,
        error: {
          code: '23514',
          message:
            'new row for relation "restaurants" violates check constraint "restaurants_capacity_check"',
        },
      },
    });

    const phoneError = await captureError(
      updateRestaurant(
        RESTAURANT_ID,
        { managerWhatsappEnabled: true, managerWhatsappConsentActorId: ACTOR_ID },
        phoneClient as never,
      ),
    );
    const capacityError = await captureError(
      updateRestaurant(RESTAURANT_ID, { capacity: 0 }, capacityClient as never),
    );

    expect(phoneError).toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    expect((phoneError as RestaurantUpdateError).fields).toHaveProperty('managerNotificationPhone');
    expect(capacityError).toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    expect((capacityError as RestaurantUpdateError).fields).toHaveProperty('capacity');
  });

  it('maps a missing restaurant to RESTAURANT_NOT_FOUND', async () => {
    const client = makeClient({
      rpcResult: { data: null, error: { code: 'P0002', message: 'RESTAURANT_NOT_FOUND' } },
    });

    const error = await captureError(
      updateRestaurant(RESTAURANT_ID, { name: 'The Bell' }, client as never),
    );

    expect(error).toMatchObject({ code: 'RESTAURANT_NOT_FOUND', status: 404 });
  });

  it('rejects out-of-range booking rules as field errors without writing', async () => {
    const client = makeClient();

    const error = await captureError(
      updateRestaurant(RESTAURANT_ID, { reservationIntervalMinutes: 500 }, client as never),
    );

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect((error as RestaurantUpdateError).fields).toHaveProperty('reservationIntervalMinutes');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('never carries database text in unexpected failures', async () => {
    const client = makeClient({
      rpcResult: {
        data: null,
        error: { code: 'XX000', message: 'SECRET_DB_DETAIL for owner@example.com' },
      },
    });

    const error = await captureError(
      updateRestaurant(RESTAURANT_ID, { name: 'The Bell' }, client as never),
    );

    expect(error).not.toBeInstanceOf(RestaurantUpdateError);
    expect(String((error as Error).message)).not.toContain('SECRET_DB_DETAIL');
    expect(String((error as Error).message)).not.toContain('owner@example.com');
  });
});
