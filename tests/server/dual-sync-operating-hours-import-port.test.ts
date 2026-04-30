import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const getOperatingHoursMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/operatingHours', () => ({
  getOperatingHours: getOperatingHoursMock,
  updateOperatingHours: updateOperatingHoursMock,
}));

import { applyOperatingHoursImportToCore } from '@/server/dual-sync/publish/ports/operating-hours-import';
import type { DualSyncOperationContext } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
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
    operatingHours: {
      weekly: [
        { dayOfWeek: 0, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
        { dayOfWeek: 1, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
        { dayOfWeek: 2, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
        { dayOfWeek: 3, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
        { dayOfWeek: 4, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
        { dayOfWeek: 5, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
        { dayOfWeek: 6, opensAt: null, closesAt: null, isClosed: true },
      ],
    },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    ...over,
  };
}

function makeCtx(over: Partial<DualSyncOperationContext> = {}): DualSyncOperationContext {
  return {
    client,
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    decision: {
      fieldKey: 'operatingHours.weekly.1',
      sectionKey: 'operatingHours',
      action: 'import_from_google',
      pinnedCoreHash: null,
      pinnedGbpHash: null,
    },
    coreSnapshot: makeSnapshot(),
    gbpSnapshot: makeSnapshot({
      operatingHours: {
        weekly: [
          { dayOfWeek: 0, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
          { dayOfWeek: 1, opensAt: '08:00:00', closesAt: '20:00:00', isClosed: false },
          { dayOfWeek: 2, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
          { dayOfWeek: 3, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
          { dayOfWeek: 4, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
          { dayOfWeek: 5, opensAt: '09:00:00', closesAt: '17:00:00', isClosed: false },
          { dayOfWeek: 6, opensAt: null, closesAt: null, isClosed: true },
        ],
      },
    }),
    actorUserId: null,
    ...over,
  };
}

describe('applyOperatingHoursImportToCore', () => {
  beforeEach(() => {
    updateOperatingHoursMock.mockReset();
    getOperatingHoursMock.mockReset();
    getOperatingHoursMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      timezone: 'America/Los_Angeles',
      updatedAt: null,
      weekly: [
        {
          dayOfWeek: 0,
          opensAt: '09:00:00',
          closesAt: '17:00:00',
          isClosed: false,
          notes: null,
          reservationIntervalMinutes: 30,
          reservationSlotTimes: null,
        },
        {
          dayOfWeek: 1,
          opensAt: '09:00:00',
          closesAt: '17:00:00',
          isClosed: false,
          notes: null,
          reservationIntervalMinutes: 30,
          reservationSlotTimes: null,
        },
      ],
      overrides: [],
    });
    updateOperatingHoursMock.mockResolvedValue({});
  });

  it('imports the targeted day from Google and preserves other days', async () => {
    const result = await applyOperatingHoursImportToCore(makeCtx());

    expect(updateOperatingHoursMock).toHaveBeenCalledTimes(1);
    const [restaurantId, payload] = updateOperatingHoursMock.mock.calls[0] ?? [];
    expect(restaurantId).toBe(RESTAURANT_ID);
    expect(payload?.weekly?.find((w: { dayOfWeek: number }) => w.dayOfWeek === 1)).toMatchObject({
      dayOfWeek: 1,
      opensAt: '08:00:00',
      closesAt: '20:00:00',
      isClosed: false,
    });
    expect(payload?.weekly?.find((w: { dayOfWeek: number }) => w.dayOfWeek === 0)).toMatchObject({
      dayOfWeek: 0,
      opensAt: '09:00:00',
      closesAt: '17:00:00',
      isClosed: false,
    });
    expect(result.status).toBe('succeeded');
    expect(result.afterCoreHash).toBe(result.afterGbpHash);
  });

  it('imports a closed day (sets isClosed=true and clears times)', async () => {
    const result = await applyOperatingHoursImportToCore(
      makeCtx({
        decision: {
          fieldKey: 'operatingHours.weekly.6',
          sectionKey: 'operatingHours',
          action: 'import_from_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );

    expect(updateOperatingHoursMock).toHaveBeenCalled();
    expect(result.status).toBe('succeeded');
  });

  it('rejects fields outside the operatingHours.weekly.N pattern', async () => {
    const result = await applyOperatingHoursImportToCore(
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

    expect(updateOperatingHoursMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('PORT_FAILURE');
  });

  it('fails when the Google snapshot is missing the targeted day', async () => {
    const result = await applyOperatingHoursImportToCore(
      makeCtx({
        gbpSnapshot: makeSnapshot({ operatingHours: { weekly: [] } }),
      }),
    );

    expect(updateOperatingHoursMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('PORT_FAILURE');
    expect(result.failure?.retryable).toBe(true);
  });
});
