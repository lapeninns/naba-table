import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateRestaurantCapacityCachesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/ops/capacity-cache', () => ({
  invalidateRestaurantCapacityCaches: invalidateRestaurantCapacityCachesMock,
}));

import {
  OnboardingLayoutInvalidError,
  OnboardingLayoutLockedError,
  OnboardingLayoutRestaurantNotFoundError,
  OnboardingLayoutWriteError,
  replaceOnboardingLayout,
} from '@/server/onboarding/layout';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_ID = '33333333-3333-4333-8333-333333333333';

function makeClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc }, rpc };
}

beforeEach(() => {
  invalidateRestaurantCapacityCachesMock.mockReset();
});

describe('replaceOnboardingLayout', () => {
  it('sends the whole layout to the transactional RPC and maps the canonical rows', async () => {
    const { client, rpc } = makeClient({
      data: {
        zones: [{ id: ZONE_ID, name: 'Main Dining', sort_order: 0, active: true }],
        tables: [
          {
            id: 't1',
            table_number: 'T1',
            capacity: 2,
            min_party_size: 1,
            max_party_size: null,
            zone_id: ZONE_ID,
            category: 'dining',
            seating_type: 'standard',
            mobility: 'fixed',
            status: 'available',
          },
        ],
      },
      error: null,
    });

    const layout = await replaceOnboardingLayout(client as never, RESTAURANT_ID, {
      zones: [{ name: 'Main Dining' }],
      tables: [{ tableNumber: 'T1', capacity: 2 }],
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('onboarding_replace_layout', {
      p_restaurant_id: RESTAURANT_ID,
      p_zones: [{ name: 'Main Dining', sort_order: 0, active: true }],
      p_tables: [
        {
          table_number: 'T1',
          capacity: 2,
          min_party_size: null,
          max_party_size: null,
          zone_name: null,
          category: null,
          seating_type: null,
          mobility: null,
        },
      ],
    });
    expect(layout).toEqual({
      zones: [{ id: ZONE_ID, name: 'Main Dining', sortOrder: 0, active: true }],
      tables: [
        {
          id: 't1',
          tableNumber: 'T1',
          capacity: 2,
          minPartySize: 1,
          maxPartySize: null,
          zoneId: ZONE_ID,
          category: 'dining',
          seatingType: 'standard',
          mobility: 'fixed',
          status: 'available',
        },
      ],
    });
    expect(invalidateRestaurantCapacityCachesMock).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it.each([
    [{ code: '55000', message: 'ONBOARDING_LAYOUT_LOCKED' }, OnboardingLayoutLockedError],
    [
      { code: '22023', message: 'ONBOARDING_LAYOUT_INVALID: zone names must be unique' },
      OnboardingLayoutInvalidError,
    ],
    [
      { code: 'P0002', message: 'ONBOARDING_RESTAURANT_NOT_FOUND' },
      OnboardingLayoutRestaurantNotFoundError,
    ],
    [{ code: 'XX000', message: 'internal error with secret detail' }, OnboardingLayoutWriteError],
  ])('maps RPC error %o to a typed error', async (error, ErrorClass) => {
    const { client } = makeClient({ data: null, error });

    const failure = replaceOnboardingLayout(client as never, RESTAURANT_ID, {
      zones: [{ name: 'Main Dining' }],
      tables: [],
    });

    await expect(failure).rejects.toBeInstanceOf(ErrorClass);
    await expect(failure).rejects.not.toHaveProperty(
      'message',
      'internal error with secret detail',
    );
    expect(invalidateRestaurantCapacityCachesMock).not.toHaveBeenCalled();
  });

  it('rejects an RPC result that does not match the contract', async () => {
    const { client } = makeClient({ data: { zones: 'nope' }, error: null });

    await expect(
      replaceOnboardingLayout(client as never, RESTAURANT_ID, {
        zones: [{ name: 'A' }],
        tables: [],
      }),
    ).rejects.toBeInstanceOf(OnboardingLayoutWriteError);
  });

  it('defines a service-role-only transactional replace RPC with a booking lock', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260927190000_onboarding_replace_layout.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.onboarding_replace_layout');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('FROM public.bookings WHERE restaurant_id = p_restaurant_id');
    expect(migration).toContain('ON CONFLICT (restaurant_id, lower(name))');
    expect(migration).toContain('ON CONFLICT (restaurant_id, table_number)');
    expect(migration).toContain('FROM authenticated');
    expect(migration).toContain('TO service_role');
  });
});
