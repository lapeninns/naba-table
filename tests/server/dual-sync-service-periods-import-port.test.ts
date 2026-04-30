import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const getServicePeriodsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: getServicePeriodsMock,
  updateServicePeriods: updateServicePeriodsMock,
}));

import { applyServicePeriodsImportToCore } from '@/server/dual-sync/publish/ports/service-periods-import';
import type { DualSyncOperationContext } from '@/server/dual-sync/publish/types';
import type {
  DualSyncCanonicalSnapshot,
  DualSyncServicePeriod,
} from '@/server/dual-sync/snapshots/types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

const STABLE_KEY_DINNER_MON = '1|17:00:00|22:00:00|dining|dinner';

function makePeriod(over: Partial<DualSyncServicePeriod> = {}): DualSyncServicePeriod {
  return {
    stableKey: STABLE_KEY_DINNER_MON,
    name: 'Dinner',
    dayOfWeek: 1,
    startTime: '17:00:00',
    endTime: '22:00:00',
    bookingOption: 'dining',
    ...over,
  };
}

function makeSnapshot(
  periods: ReadonlyArray<DualSyncServicePeriod>,
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: null,
      contactPhone: null,
      address: null,
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
  };
}

function makeCtx(over: Partial<DualSyncOperationContext> = {}): DualSyncOperationContext {
  const corePeriod = makePeriod({ name: 'Dinner Old', stableKey: '1|17:00:00|22:00:00|dining|dinner old' });
  const googlePeriod = makePeriod();
  return {
    client,
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    decision: {
      fieldKey: `servicePeriods.${STABLE_KEY_DINNER_MON}`,
      sectionKey: 'servicePeriods',
      action: 'import_from_google',
      pinnedCoreHash: null,
      pinnedGbpHash: null,
    },
    coreSnapshot: makeSnapshot([corePeriod]),
    gbpSnapshot: makeSnapshot([googlePeriod]),
    actorUserId: null,
    ...over,
  };
}

describe('applyServicePeriodsImportToCore', () => {
  beforeEach(() => {
    updateServicePeriodsMock.mockReset();
    getServicePeriodsMock.mockReset();
    getServicePeriodsMock.mockResolvedValue([
      {
        id: 'core-other-1',
        name: 'Lunch',
        dayOfWeek: 2,
        startTime: '11:00:00',
        endTime: '14:00:00',
        bookingOption: 'dining',
        updatedAt: null,
      },
    ]);
    updateServicePeriodsMock.mockResolvedValue([]);
  });

  it('imports a Google period that has no Core counterpart', async () => {
    const result = await applyServicePeriodsImportToCore(makeCtx());

    expect(updateServicePeriodsMock).toHaveBeenCalledTimes(1);
    const [restaurantId, payload] = updateServicePeriodsMock.mock.calls[0] ?? [];
    expect(restaurantId).toBe(RESTAURANT_ID);
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lunch', dayOfWeek: 2 }),
        expect.objectContaining({ name: 'Dinner', dayOfWeek: 1, startTime: '17:00:00', endTime: '22:00:00' }),
      ]),
    );
    expect(result.status).toBe('succeeded');
    expect(result.afterCoreHash).toBe(result.afterGbpHash);
  });

  it('preserves the existing row id when stableKey matches', async () => {
    getServicePeriodsMock.mockResolvedValue([
      {
        id: 'core-dinner-old',
        name: 'Dinner',
        dayOfWeek: 1,
        startTime: '17:00:00',
        endTime: '22:00:00',
        bookingOption: 'dining',
        updatedAt: null,
      },
    ]);
    const ctx = makeCtx();

    await applyServicePeriodsImportToCore(ctx);

    const [, payload] = updateServicePeriodsMock.mock.calls[0] ?? [];
    const dinnerEntry = payload?.find((p: { name: string }) => p.name === 'Dinner');
    expect(dinnerEntry?.id).toBe('core-dinner-old');
  });

  it('removes the period when Google does not contain the stableKey (delete semantic)', async () => {
    const ctx = makeCtx({
      gbpSnapshot: makeSnapshot([]),
    });
    getServicePeriodsMock.mockResolvedValue([
      {
        id: 'core-dinner-1',
        name: 'Dinner',
        dayOfWeek: 1,
        startTime: '17:00:00',
        endTime: '22:00:00',
        bookingOption: 'dining',
        updatedAt: null,
      },
    ]);
    // ensure registry is built from before-snapshot, where the field still exists
    ctx.coreSnapshot = makeSnapshot([makePeriod()]);

    const result = await applyServicePeriodsImportToCore(ctx);

    expect(updateServicePeriodsMock).toHaveBeenCalledWith(RESTAURANT_ID, [], client);
    expect(result.status).toBe('succeeded');
  });

  it('rejects fields outside the servicePeriods. prefix', async () => {
    const result = await applyServicePeriodsImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'profile.name',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('PORT_FAILURE');
  });
});
