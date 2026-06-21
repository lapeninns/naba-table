import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// triage-041 (confirmed P2): a caller-supplied (cookie/RLS) read failure must NOT overwrite the
// process-wide occasion catalog cache with the empty fallback, or it poisons every subsequent
// service-role caller for up to CACHE_TTL_MS.

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: vi.fn(),
}));

import { getServiceSupabaseClient } from '@/server/supabase';
import {
  clearOccasionCatalogCache,
  getCachedOccasionCatalog,
  getOccasionCatalog,
} from '@/server/occasions/catalog';

type QueryResult = { data: unknown; error: unknown };

function makeClient(result: QueryResult): SupabaseClient<Database, 'public'> {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.is = () => builder;
  builder.order = () => builder;
  builder.then = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return { from: () => builder } as unknown as SupabaseClient<Database, 'public'>;
}

const dinnerRow = {
  key: 'dinner',
  label: 'Dinner',
  short_label: null,
  description: null,
  availability: null,
  default_duration_minutes: 120,
  display_order: 1,
  is_active: true,
};

const successClient = () => makeClient({ data: [dinnerRow], error: null });
const failingNonPermissionClient = () =>
  makeClient({ data: null, error: { code: '08006', message: 'connection failure' } });

const mockedGetService = vi.mocked(getServiceSupabaseClient);

describe('occasion catalog cache poisoning (triage-041)', () => {
  beforeEach(() => {
    clearOccasionCatalogCache();
    mockedGetService.mockReset();
  });
  afterEach(() => {
    clearOccasionCatalogCache();
  });

  it('does not poison the shared cache when a non-service (caller) read fails', async () => {
    // (1) prime the shared cache with a real catalog via a service-client read
    mockedGetService.mockReturnValue(successClient());
    const primed = await getOccasionCatalog({ forceRefresh: true });
    expect(primed.definitions).toHaveLength(1);
    expect(getCachedOccasionCatalog().byKey.has('dinner')).toBe(true);

    // (2) a caller-supplied (non-service) read fails with a non-permission error (08006),
    //     so the service-retry path is skipped
    await getOccasionCatalog({ client: failingNonPermissionClient(), forceRefresh: true });

    // (3) the shared cache must STILL hold the good catalog (not the empty fallback)
    const cached = getCachedOccasionCatalog();
    expect(cached.definitions).toHaveLength(1);
    expect(cached.byKey.has('dinner')).toBe(true);

    const subsequent = await getOccasionCatalog();
    expect(subsequent.definitions).toHaveLength(1);
  });

  it('still caches the fallback when the service client itself fails', async () => {
    // a genuine service-client failure may legitimately cache the fallback
    mockedGetService.mockReturnValue(failingNonPermissionClient());
    const result = await getOccasionCatalog({ forceRefresh: true });
    expect(result.definitions).toHaveLength(0);
    expect(getCachedOccasionCatalog().definitions).toHaveLength(0);
  });
});
