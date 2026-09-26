import { describe, expect, it, vi } from 'vitest';

import { getOnboardingReadiness, OnboardingReadinessError } from '@/server/onboarding/readiness';

type CountResult = { count: number | null; error: { code?: string } | null };

function makeClient(counts: Record<string, CountResult>) {
  const filters: Array<{ table: string; column: string; value: unknown; op: string }> = [];
  const from = vi.fn((table: string) => {
    const result = counts[table];
    if (!result) throw new Error(`Unexpected table ${table}`);
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ table, column, value, op: 'eq' });
        return chain;
      }),
      is: vi.fn((column: string, value: unknown) => {
        filters.push({ table, column, value, op: 'is' });
        return chain;
      }),
      then: (resolve: (value: CountResult) => unknown) => resolve(result),
    };
    return chain;
  });
  return { client: { from }, filters };
}

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

describe('getOnboardingReadiness', () => {
  it('is ready when open weekly hours, a service period and a table exist', async () => {
    const { client, filters } = makeClient({
      restaurant_operating_hours: { count: 5, error: null },
      restaurant_service_periods: { count: 1, error: null },
      table_inventory: { count: 3, error: null },
    });

    await expect(getOnboardingReadiness(client as never, RESTAURANT_ID)).resolves.toEqual({
      ready: true,
      missing: [],
    });
    // Every query is tenant-scoped, and closed or dated override rows do not count as hours.
    for (const table of [
      'restaurant_operating_hours',
      'restaurant_service_periods',
      'table_inventory',
    ]) {
      expect(filters).toContainEqual({
        table,
        column: 'restaurant_id',
        value: RESTAURANT_ID,
        op: 'eq',
      });
    }
    expect(filters).toContainEqual({
      table: 'restaurant_operating_hours',
      column: 'is_closed',
      value: false,
      op: 'eq',
    });
    expect(filters).toContainEqual({
      table: 'restaurant_operating_hours',
      column: 'effective_date',
      value: null,
      op: 'is',
    });
  });

  it('lists every missing requirement in a stable order', async () => {
    const { client } = makeClient({
      restaurant_operating_hours: { count: 0, error: null },
      restaurant_service_periods: { count: null, error: null },
      table_inventory: { count: 0, error: null },
    });

    await expect(getOnboardingReadiness(client as never, RESTAURANT_ID)).resolves.toEqual({
      ready: false,
      missing: ['operating_hours', 'service_periods', 'tables'],
    });
  });

  it('throws a typed error carrying only the database code when a read fails', async () => {
    const { client } = makeClient({
      restaurant_operating_hours: { count: 1, error: null },
      restaurant_service_periods: { count: null, error: { code: '42P01' } },
      table_inventory: { count: 1, error: null },
    });

    const failure = getOnboardingReadiness(client as never, RESTAURANT_ID);
    await expect(failure).rejects.toBeInstanceOf(OnboardingReadinessError);
    await expect(failure).rejects.toMatchObject({
      requirement: 'service_periods',
      dbCode: '42P01',
    });
  });
});
