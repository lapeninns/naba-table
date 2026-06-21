import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRestaurantBySlugMock = vi.hoisted(() => vi.fn());
const getDefaultRestaurantIdMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const MockMissingRestaurantContextError = vi.hoisted(
  () =>
    class MockMissingRestaurantContextError extends Error {
      constructor(message = 'Missing restaurant context') {
        super(message);
        this.name = 'MissingRestaurantContextError';
      }
    },
);

vi.mock('@/server/restaurants/getActiveRestaurantId', () => ({
  getActiveRestaurantId: getActiveRestaurantIdMock,
}));

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: getRestaurantBySlugMock,
}));

vi.mock('@/server/supabase', () => ({
  getDefaultRestaurantId: getDefaultRestaurantIdMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
  MissingRestaurantContextError: MockMissingRestaurantContextError,
}));

import { resolveBookingRestaurantId } from '@/server/bookings/restaurant-resolution';

function createRestaurantsClient(result: { data: unknown; error: unknown }) {
  const log: Array<
    | { op: 'from'; table: string }
    | { op: 'select'; columns: string }
    | { op: 'eq'; column: string; value: unknown }
    | { op: 'maybeSingle' }
  > = [];

  const query = {
    select(columns: string) {
      log.push({ op: 'select', columns });
      return this;
    },
    eq(column: string, value: unknown) {
      log.push({ op: 'eq', column, value });
      return this;
    },
    async maybeSingle() {
      log.push({ op: 'maybeSingle' });
      return result;
    },
  };

  return {
    log,
    client: {
      from(table: string) {
        log.push({ op: 'from', table });
        return query;
      },
    },
  };
}

describe('booking restaurant resolution', () => {
  beforeEach(() => {
    getActiveRestaurantIdMock.mockReset();
    getRestaurantBySlugMock.mockReset();
    getDefaultRestaurantIdMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
  });

  it('resolves slug input before other restaurant sources', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'restaurant-slug' });

    await expect(
      resolveBookingRestaurantId({
        restaurantSlug: '  Old-Crown  ',
        restaurantId: 'restaurant-direct',
      }),
    ).resolves.toEqual({ ok: true, restaurantId: 'restaurant-slug', source: 'slug' });

    expect(getRestaurantBySlugMock).toHaveBeenCalledWith('old-crown');
    expect(getActiveRestaurantIdMock).not.toHaveBeenCalled();
    expect(getDefaultRestaurantIdMock).not.toHaveBeenCalled();
  });

  it('returns slug not-found and lookup-failed results', async () => {
    getRestaurantBySlugMock.mockResolvedValueOnce(null);

    await expect(resolveBookingRestaurantId({ restaurantSlug: 'missing' })).resolves.toEqual({
      ok: false,
      status: 404,
      code: 'RESTAURANT_NOT_FOUND',
      error: 'Restaurant not found',
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getRestaurantBySlugMock.mockRejectedValueOnce(new Error('slug failed'));

    await expect(resolveBookingRestaurantId({ restaurantSlug: 'broken' })).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'RESTAURANT_LOOKUP_FAILED',
      error: 'Unable to resolve restaurant',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[bookings][POST][slug-lookup]',
      expect.stringContaining('slug failed'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('resolves direct restaurant id input', async () => {
    getActiveRestaurantIdMock.mockResolvedValue('restaurant-direct');

    await expect(
      resolveBookingRestaurantId({ restaurantId: '  restaurant-direct  ' }),
    ).resolves.toEqual({ ok: true, restaurantId: 'restaurant-direct', source: 'payload' });

    expect(getActiveRestaurantIdMock).toHaveBeenCalledWith('restaurant-direct');
    expect(getDefaultRestaurantIdMock).not.toHaveBeenCalled();
  });

  it('returns direct-id not-found and lookup-failed results', async () => {
    getActiveRestaurantIdMock.mockResolvedValueOnce(null);

    await expect(resolveBookingRestaurantId({ restaurantId: 'missing' })).resolves.toEqual({
      ok: false,
      status: 404,
      code: 'RESTAURANT_NOT_FOUND',
      error: 'Restaurant not found',
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getActiveRestaurantIdMock.mockRejectedValueOnce(new Error('direct failed'));

    await expect(resolveBookingRestaurantId({ restaurantId: 'broken' })).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'RESTAURANT_LOOKUP_FAILED',
      error: 'Unable to resolve restaurant',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[bookings][POST][restaurant-id-lookup]',
      expect.stringContaining('direct failed'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('resolves the active default restaurant when no input is provided', async () => {
    getDefaultRestaurantIdMock.mockResolvedValue('restaurant-default');
    const { client, log } = createRestaurantsClient({
      data: { id: 'restaurant-default' },
      error: null,
    });
    getServiceSupabaseClientMock.mockReturnValue(client);

    await expect(resolveBookingRestaurantId({})).resolves.toEqual({
      ok: true,
      restaurantId: 'restaurant-default',
      source: 'default',
    });
    expect(log).toEqual([
      { op: 'from', table: 'restaurants' },
      { op: 'select', columns: 'id' },
      { op: 'eq', column: 'id', value: 'restaurant-default' },
      { op: 'eq', column: 'is_active', value: true },
      { op: 'maybeSingle' },
    ]);
  });

  it('maps default restaurant missing context, inactive rows, and lookup errors', async () => {
    getDefaultRestaurantIdMock.mockRejectedValueOnce(new MockMissingRestaurantContextError());

    await expect(resolveBookingRestaurantId({})).resolves.toEqual({
      ok: false,
      status: 400,
      code: 'RESTAURANT_REQUIRED',
      error: 'restaurantId or restaurantSlug is required',
    });

    getDefaultRestaurantIdMock.mockResolvedValueOnce('restaurant-default');
    getServiceSupabaseClientMock.mockReturnValueOnce(
      createRestaurantsClient({ data: null, error: null }).client,
    );

    await expect(resolveBookingRestaurantId({})).resolves.toEqual({
      ok: false,
      status: 404,
      code: 'RESTAURANT_NOT_FOUND',
      error: 'Restaurant not found',
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getDefaultRestaurantIdMock.mockResolvedValueOnce('restaurant-default');
    getServiceSupabaseClientMock.mockReturnValueOnce(
      createRestaurantsClient({ data: null, error: new Error('default failed') }).client,
    );

    await expect(resolveBookingRestaurantId({})).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'RESTAURANT_LOOKUP_FAILED',
      error: 'Unable to resolve restaurant',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[bookings][POST][default-restaurant]',
      expect.stringContaining('default failed'),
    );
    consoleErrorSpy.mockRestore();
  });
});
