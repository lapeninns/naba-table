import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import {
  clearOccasionCatalogCache,
  getCachedOccasionCatalog,
  getOccasionCatalog,
} from '@/server/occasions/catalog';

type FetchResult = { data: unknown; error: unknown };

/**
 * Minimal Supabase query-builder stub matching catalog.ts:
 *   client.from(table).select(...).is(...).order(...).order(...)
 * The terminal builder is awaited, so it must be thenable and resolve to {data,error}.
 */
function createQueryBuilder(result: FetchResult) {
  const builder = {
    select() {
      return builder;
    },
    is() {
      return builder;
    },
    order() {
      return builder;
    },
    then<TResult1 = FetchResult, TResult2 = never>(
      onfulfilled?: ((value: FetchResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };
  return builder;
}

function createSupabaseClient(result: FetchResult) {
  return {
    from: vi.fn(() => createQueryBuilder(result)),
  };
}

const REAL_ROW = {
  key: 'dinner',
  label: 'Dinner',
  short_label: 'Dinner',
  description: null,
  availability: [],
  default_duration_minutes: 120,
  display_order: 1,
  is_active: true,
};

describe('occasion catalog cache poisoning (triage-041)', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    clearOccasionCatalogCache();
  });

  afterEach(() => {
    clearOccasionCatalogCache();
  });

  it('does not poison the shared cache when a non-service (caller) read fails', async () => {
    // (1) Prime the cache via a service-client read returning a real catalog.
    const serviceClient = createSupabaseClient({ data: [REAL_ROW], error: null });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);

    const primed = await getOccasionCatalog();
    expect(primed.definitions).toHaveLength(1);
    expect(primed.byKey.get('dinner')).toBeDefined();

    // (2) A non-service read (caller-supplied client) fails. Use a non-permission
    //     error code so the service-retry path is skipped: the failure is entirely
    //     the caller-client's, and must NOT overwrite the known-good shared cache.
    const failingCallerClient = createSupabaseClient({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });

    const fallbackReturned = await getOccasionCatalog({
      client: failingCallerClient as never,
      forceRefresh: true,
    });

    // The failing caller still gets a safe (empty) fallback for its own response...
    expect(fallbackReturned.definitions).toHaveLength(0);

    // (3) ...but the SHARED cache must still hold the GOOD catalog, not the poison.
    const cachedAfterFailure = getCachedOccasionCatalog();
    expect(cachedAfterFailure.definitions).toHaveLength(1);
    expect(cachedAfterFailure.byKey.get('dinner')).toBeDefined();

    // A subsequent service-role caller (within TTL) must see the GOOD catalog.
    const subsequent = await getOccasionCatalog();
    expect(subsequent.definitions).toHaveLength(1);
    expect(subsequent.byKey.get('dinner')).toBeDefined();
  });
});
