import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncProfileMock = vi.hoisted(() => vi.fn());
const syncOperatingHoursMock = vi.hoisted(() => vi.fn());
const syncServicePeriodsMock = vi.hoisted(() => vi.fn());
const patchLocationFieldsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/service', () => ({
  syncRestaurantProfileWithGoogleBusinessProfile: syncProfileMock,
  syncRestaurantOperatingHoursWithGoogleBusinessProfile: syncOperatingHoursMock,
  syncRestaurantServicePeriodsWithGoogleBusinessProfile: syncServicePeriodsMock,
  patchRestaurantGoogleBusinessProfileLocationFields: patchLocationFieldsMock,
}));

import {
  applyBusinessContextAttributeExportBatchToGoogle,
  applyBusinessContextAttributeExportToGoogle,
  applyBusinessContextCategoryExportBatchToGoogle,
  applyBusinessContextCategoryExportToGoogle,
  applyBusinessContextServiceAreaExportBatchToGoogle,
  applyBusinessContextServiceAreaExportToGoogle,
  applyBusinessContextServiceItemExportBatchToGoogle,
  applyBusinessContextServiceItemExportToGoogle,
} from '@/server/dual-sync/publish/ports/business-context-export';
import {
  applyOperatingHoursExportBatchToGoogle,
  applyOperatingHoursExportToGoogle,
} from '@/server/dual-sync/publish/ports/operating-hours-export';
import {
  applyProfileExportBatchToGoogle,
  applyProfileExportToGoogle,
} from '@/server/dual-sync/publish/ports/profile-export';
import {
  applyServicePeriodsExportBatchToGoogle,
  applyServicePeriodsExportToGoogle,
} from '@/server/dual-sync/publish/ports/service-periods-export';

import type {
  DualSyncBatchExportContext,
  DualSyncOperationContext,
  DualSyncPublishDecision,
} from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Best pizza in town.',
      contactPhone: '+1234567890',
      address: '123 Main St',
      storefrontAddress: {
        addressLines: ['Old line'],
        locality: 'San Francisco',
        administrativeArea: 'CA',
        postalCode: '94110',
        regionCode: 'US',
        languageCode: 'en',
        sublocality: null,
        organization: null,
        recipients: [],
      },
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: {
      weekly: [
        { dayOfWeek: 0, opensAt: null, closesAt: null, isClosed: true },
        { dayOfWeek: 1, opensAt: '08:00:00', closesAt: '20:00:00', isClosed: false },
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

function makeCtx(over: Partial<DualSyncOperationContext>): DualSyncOperationContext {
  return {
    client,
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    decision: {
      fieldKey: 'profile.name',
      sectionKey: 'profile',
      action: 'export_to_google',
      pinnedCoreHash: null,
      pinnedGbpHash: null,
    },
    coreSnapshot: makeSnapshot(),
    gbpSnapshot: makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        name: 'Acme Old',
        businessDescription: 'Old desc',
        contactPhone: '+1999',
        address: 'Old address',
      },
    }),
    actorUserId: null,
    ...over,
  };
}

beforeEach(() => {
  syncProfileMock.mockReset();
  syncOperatingHoursMock.mockReset();
  syncServicePeriodsMock.mockReset();
  patchLocationFieldsMock.mockReset();
  syncProfileMock.mockResolvedValue({});
  syncOperatingHoursMock.mockResolvedValue({});
  syncServicePeriodsMock.mockResolvedValue({});
  patchLocationFieldsMock.mockResolvedValue({});
});

describe('applyProfileExportToGoogle', () => {
  it('exports name via syncRestaurantProfileWithGoogleBusinessProfile', async () => {
    const result = await applyProfileExportToGoogle(makeCtx({}));
    expect(syncProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        direction: 'push_to_gbp',
        fields: ['name'],
      }),
    );
    expect(result.status).toBe('succeeded');
    expect(result.afterCoreHash).toBe(result.afterGbpHash);
  });

  it('exports contactPhone using the same helper', async () => {
    await applyProfileExportToGoogle(
      makeCtx({
        decision: {
          fieldKey: 'profile.contactPhone',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );
    expect(syncProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ fields: ['contactPhone'] }),
    );
  });

  it('exports businessDescription via the location patch', async () => {
    const result = await applyProfileExportToGoogle(
      makeCtx({
        decision: {
          fieldKey: 'profile.businessDescription',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );
    expect(patchLocationFieldsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locationPatch: { profile: { description: 'Best pizza in town.' } },
        updateMask: ['profile'],
      }),
    );
    expect(result.status).toBe('succeeded');
  });

  it('exports address as a storefrontAddress patch', async () => {
    const result = await applyProfileExportToGoogle(
      makeCtx({
        decision: {
          fieldKey: 'profile.address',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(['storefrontAddress']);
    expect(call?.locationPatch?.storefrontAddress).toEqual(
      expect.objectContaining({
        addressLines: ['123 Main St'],
        regionCode: 'US',
      }),
    );
    expect(result.status).toBe('succeeded');
  });

  it('rejects googleMapUrl as unsupported', async () => {
    const result = await applyProfileExportToGoogle(
      makeCtx({
        decision: {
          fieldKey: 'profile.googleMapUrl',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );
    expect(syncProfileMock).not.toHaveBeenCalled();
    expect(patchLocationFieldsMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('UNSUPPORTED_FIELD');
  });
});

describe('applyOperatingHoursExportToGoogle', () => {
  it('exports a single weekday via the legacy helper', async () => {
    const result = await applyOperatingHoursExportToGoogle(
      makeCtx({
        decision: {
          fieldKey: 'operatingHours.weekly.1',
          sectionKey: 'operatingHours',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );
    expect(syncOperatingHoursMock).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'push_to_gbp',
        selection: { weeklyDays: [1] },
      }),
    );
    expect(result.status).toBe('succeeded');
  });

  it('rejects non-weekly fields', async () => {
    const result = await applyOperatingHoursExportToGoogle(
      makeCtx({
        decision: {
          fieldKey: 'profile.name',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      }),
    );
    expect(syncOperatingHoursMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('PORT_FAILURE');
  });
});

describe('applyServicePeriodsExportToGoogle', () => {
  it('exports a weekday-bound period via the legacy helper', async () => {
    const stableKey = '1|17:00:00|22:00:00|dining|dinner';
    const ctx = makeCtx({
      decision: {
        fieldKey: `servicePeriods.${stableKey}`,
        sectionKey: 'servicePeriods',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
      coreSnapshot: makeSnapshot({
        servicePeriods: {
          periods: [
            {
              stableKey,
              name: 'Dinner',
              dayOfWeek: 1,
              startTime: '17:00:00',
              endTime: '22:00:00',
              bookingOption: 'dining',
            },
          ],
        },
      }),
      gbpSnapshot: makeSnapshot(),
    });
    const result = await applyServicePeriodsExportToGoogle(ctx);
    expect(syncServicePeriodsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'push_to_gbp',
        selection: { dayOfWeeks: [1] },
      }),
    );
    expect(result.status).toBe('succeeded');
  });

  it('rejects an all-week period (dayOfWeek=null)', async () => {
    const stableKey = 'any|10:00:00|11:00:00|dining|all day';
    const ctx = makeCtx({
      decision: {
        fieldKey: `servicePeriods.${stableKey}`,
        sectionKey: 'servicePeriods',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
      coreSnapshot: makeSnapshot({
        servicePeriods: {
          periods: [
            {
              stableKey,
              name: 'All Day',
              dayOfWeek: null,
              startTime: '10:00:00',
              endTime: '11:00:00',
              bookingOption: 'dining',
            },
          ],
        },
      }),
      gbpSnapshot: makeSnapshot(),
    });
    const result = await applyServicePeriodsExportToGoogle(ctx);
    expect(syncServicePeriodsMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('UNSUPPORTED_FIELD');
  });
});

describe('applyBusinessContextCategoryExportToGoogle', () => {
  it('builds a categories patch and pushes via patchLocationFields', async () => {
    const ctx = makeCtx({
      decision: {
        fieldKey: 'businessContext.categories.fine-dining',
        sectionKey: 'businessContext.categories',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
      coreSnapshot: makeSnapshot({
        businessContext: {
          categories: [
            {
              displayName: 'Fine Dining',
              categoryCode: 'gcid:fine-dining',
              isPrimary: true,
              moreHoursTypes: [],
            },
          ],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
      }),
      gbpSnapshot: makeSnapshot({
        businessContext: {
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
      }),
    });
    const result = await applyBusinessContextCategoryExportToGoogle(ctx);
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(['categories']);
    expect(call?.locationPatch?.categories).toEqual(
      expect.objectContaining({
        primaryCategory: expect.objectContaining({
          name: 'categories/gcid:fine-dining',
        }),
      }),
    );
    expect(result.status).toBe('succeeded');
  });

  it('fails when Core lacks the targeted category but Google has it', async () => {
    const result = await applyBusinessContextCategoryExportToGoogle(
      makeCtx({
        decision: {
          fieldKey: 'businessContext.categories.bar',
          sectionKey: 'businessContext.categories',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
        coreSnapshot: makeSnapshot(),
        gbpSnapshot: makeSnapshot({
          businessContext: {
            categories: [
              {
                displayName: 'Bar',
                categoryCode: 'gcid:bar',
                isPrimary: false,
                moreHoursTypes: [],
              },
            ],
            serviceAreas: [],
            attributes: [],
            serviceItems: [],
          },
        }),
      }),
    );
    expect(patchLocationFieldsMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure?.code).toBe('PORT_FAILURE');
  });
});

describe('applyBusinessContextServiceAreaExportToGoogle', () => {
  it('builds a serviceArea patch with merged Google list', async () => {
    const ctx = makeCtx({
      decision: {
        fieldKey: 'businessContext.serviceAreas.downtown',
        sectionKey: 'businessContext.serviceAreas',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
      coreSnapshot: makeSnapshot({
        businessContext: {
          categories: [],
          serviceAreas: [
            {
              displayName: 'Downtown',
              areaType: 'place',
              regionCode: 'US-CA',
              placeData: { businessType: 'CUSTOMER_AND_BUSINESS_LOCATION' },
            },
          ],
          attributes: [],
          serviceItems: [],
        },
      }),
      gbpSnapshot: makeSnapshot({
        businessContext: {
          categories: [],
          serviceAreas: [
            {
              displayName: 'Other Area',
              areaType: 'place',
              regionCode: 'US-CA',
              placeData: { regionCode: 'US-CA' },
            },
          ],
          attributes: [],
          serviceItems: [],
        },
      }),
    });
    const result = await applyBusinessContextServiceAreaExportToGoogle(ctx);
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(['serviceArea']);
    expect(call?.locationPatch?.serviceArea).toEqual(
      expect.objectContaining({ businessType: expect.any(String) }),
    );
    expect(result.status).toBe('succeeded');
  });
});

describe('applyBusinessContextAttributeExportToGoogle', () => {
  it('exports a bool attribute via the attributes patch', async () => {
    const ctx = makeCtx({
      decision: {
        fieldKey: 'businessContext.attributes.has_wheelchair_accessible_entrance',
        sectionKey: 'businessContext.attributes',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
      coreSnapshot: makeSnapshot({
        businessContext: {
          categories: [],
          serviceAreas: [],
          attributes: [
            {
              attributeKey: 'has_wheelchair_accessible_entrance',
              attributeName: 'attributes/has_wheelchair_accessible_entrance',
              attributeId: 'has_wheelchair_accessible_entrance',
              valueType: 'BOOL',
              boolValue: true,
              textValue: null,
              uriValue: null,
              uriValues: [],
              enumValues: [],
              unsetEnumValues: [],
            },
          ],
          serviceItems: [],
        },
      }),
      gbpSnapshot: makeSnapshot(),
    });
    const result = await applyBusinessContextAttributeExportToGoogle(ctx);
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.attributesPatch?.attributeMask).toEqual([
      'attributes/has_wheelchair_accessible_entrance',
    ]);
    expect(call?.attributesPatch?.attributes?.[0]).toEqual(
      expect.objectContaining({
        name: 'attributes/has_wheelchair_accessible_entrance',
        values: [{ boolValue: true }],
      }),
    );
    expect(result.status).toBe('succeeded');
  });
});

describe('applyBusinessContextServiceItemExportToGoogle', () => {
  it('exports a service item with its raw Google payload', async () => {
    const ctx = makeCtx({
      decision: {
        fieldKey: 'businessContext.serviceItems.brunch-deal',
        sectionKey: 'businessContext.serviceItems',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
      coreSnapshot: makeSnapshot({
        businessContext: {
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [
            {
              itemKey: 'brunch-deal',
              itemType: 'structured',
              displayName: 'Brunch Deal',
              description: 'Sat & Sun mornings',
              payload: { structuredServiceItem: { displayName: 'Brunch Deal' } },
            },
          ],
        },
      }),
      gbpSnapshot: makeSnapshot(),
    });
    const result = await applyBusinessContextServiceItemExportToGoogle(ctx);
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(['serviceItems']);
    expect(call?.locationPatch?.serviceItems).toEqual([
      { structuredServiceItem: { displayName: 'Brunch Deal' } },
    ]);
    expect(result.status).toBe('succeeded');
  });

  it('fails when Core service item is missing a payload', async () => {
    const ctx = makeCtx({
      decision: {
        fieldKey: 'businessContext.serviceItems.empty-item',
        sectionKey: 'businessContext.serviceItems',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
      coreSnapshot: makeSnapshot({
        businessContext: {
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [
            {
              itemKey: 'empty-item',
              itemType: null,
              displayName: 'Empty',
              description: null,
              payload: null,
            },
          ],
        },
      }),
      gbpSnapshot: makeSnapshot(),
    });
    let caught: unknown;
    try {
      await applyBusinessContextServiceItemExportToGoogle(ctx);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/canonical Google payload/);
    expect(patchLocationFieldsMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Section-level batch export ports
// ---------------------------------------------------------------------------

function makeDecision(over: Partial<DualSyncPublishDecision>): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.name',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: null,
    pinnedGbpHash: null,
    ...over,
  };
}

function makeBatchCtx(over: Partial<DualSyncBatchExportContext>): DualSyncBatchExportContext {
  return {
    client,
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    sectionKey: 'profile',
    decisions: [makeDecision({})],
    coreSnapshot: makeSnapshot(),
    gbpSnapshot: makeSnapshot(),
    actorUserId: null,
    ...over,
  };
}

describe('applyOperatingHoursExportBatchToGoogle', () => {
  it('issues a single push call covering every weekly day in the batch', async () => {
    const result = await applyOperatingHoursExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'operatingHours',
        decisions: [
          makeDecision({
            fieldKey: 'operatingHours.weekly.1',
            sectionKey: 'operatingHours',
          }),
          makeDecision({
            fieldKey: 'operatingHours.weekly.2',
            sectionKey: 'operatingHours',
          }),
          makeDecision({
            fieldKey: 'operatingHours.weekly.3',
            sectionKey: 'operatingHours',
          }),
        ],
        coreSnapshot: makeSnapshot({
          operatingHours: {
            weekly: [
              { dayOfWeek: 1, opensAt: '08:00:00', closesAt: '20:00:00', isClosed: false },
              { dayOfWeek: 2, opensAt: '08:00:00', closesAt: '20:00:00', isClosed: false },
              { dayOfWeek: 3, opensAt: '08:00:00', closesAt: '20:00:00', isClosed: false },
            ],
          },
        }),
      }),
    );
    expect(syncOperatingHoursMock).toHaveBeenCalledTimes(1);
    expect(syncOperatingHoursMock).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'push_to_gbp',
        selection: { weeklyDays: [1, 2, 3] },
      }),
    );
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(Object.keys(result.perField)).toEqual([
        'operatingHours.weekly.1',
        'operatingHours.weekly.2',
        'operatingHours.weekly.3',
      ]);
      expect(result.perField['operatingHours.weekly.1']?.status).toBe('succeeded');
    }
  });

  it('opts out when the batch contains an unparseable fieldKey', async () => {
    const result = await applyOperatingHoursExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'operatingHours',
        decisions: [
          makeDecision({ fieldKey: 'operatingHours.weekly.1', sectionKey: 'operatingHours' }),
          makeDecision({ fieldKey: 'profile.name', sectionKey: 'operatingHours' }),
        ],
      }),
    );
    expect(result.supported).toBe(false);
    expect(syncOperatingHoursMock).not.toHaveBeenCalled();
  });

  it('marks every decision in the batch as failed when the helper throws', async () => {
    syncOperatingHoursMock.mockRejectedValueOnce(new Error('upstream broke'));
    const result = await applyOperatingHoursExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'operatingHours',
        decisions: [
          makeDecision({ fieldKey: 'operatingHours.weekly.1', sectionKey: 'operatingHours' }),
          makeDecision({ fieldKey: 'operatingHours.weekly.2', sectionKey: 'operatingHours' }),
        ],
      }),
    );
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(Object.values(result.perField).every((r) => r.status === 'failed')).toBe(true);
      expect(result.perField['operatingHours.weekly.1']?.failure?.code).toBe('PORT_FAILURE');
    }
  });
});

describe('applyProfileExportBatchToGoogle', () => {
  it('coalesces name + contactPhone into one simple-push call', async () => {
    const result = await applyProfileExportBatchToGoogle(
      makeBatchCtx({
        decisions: [
          makeDecision({ fieldKey: 'profile.name' }),
          makeDecision({ fieldKey: 'profile.contactPhone' }),
        ],
      }),
    );
    expect(syncProfileMock).toHaveBeenCalledTimes(1);
    expect(syncProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'push_to_gbp',
        fields: expect.arrayContaining(['name', 'contactPhone']),
      }),
    );
    expect(patchLocationFieldsMock).not.toHaveBeenCalled();
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField['profile.name']?.status).toBe('succeeded');
      expect(result.perField['profile.contactPhone']?.status).toBe('succeeded');
    }
  });

  it('coalesces address + businessDescription into one location patch', async () => {
    const result = await applyProfileExportBatchToGoogle(
      makeBatchCtx({
        decisions: [
          makeDecision({ fieldKey: 'profile.address' }),
          makeDecision({ fieldKey: 'profile.businessDescription' }),
        ],
      }),
    );
    expect(syncProfileMock).not.toHaveBeenCalled();
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(expect.arrayContaining(['storefrontAddress', 'profile']));
    expect(call?.locationPatch?.profile).toEqual({
      description: 'Best pizza in town.',
    });
    expect(call?.locationPatch?.storefrontAddress?.addressLines).toEqual(['123 Main St']);
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField['profile.address']?.status).toBe('succeeded');
      expect(result.perField['profile.businessDescription']?.status).toBe('succeeded');
    }
  });

  it('combines simple-push and location-patch in one batch (2 Google calls total)', async () => {
    const result = await applyProfileExportBatchToGoogle(
      makeBatchCtx({
        decisions: [
          makeDecision({ fieldKey: 'profile.name' }),
          makeDecision({ fieldKey: 'profile.address' }),
          makeDecision({ fieldKey: 'profile.businessDescription' }),
        ],
      }),
    );
    expect(syncProfileMock).toHaveBeenCalledTimes(1);
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(Object.values(result.perField).every((r) => r.status === 'succeeded')).toBe(true);
    }
  });

  it('reports UNSUPPORTED_FIELD per fieldKey for read-only profile fields', async () => {
    const result = await applyProfileExportBatchToGoogle(
      makeBatchCtx({
        decisions: [
          makeDecision({ fieldKey: 'profile.name' }),
          makeDecision({ fieldKey: 'profile.googleMapUrl' }),
        ],
      }),
    );
    expect(syncProfileMock).toHaveBeenCalledTimes(1);
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField['profile.name']?.status).toBe('succeeded');
      expect(result.perField['profile.googleMapUrl']?.status).toBe('failed');
      expect(result.perField['profile.googleMapUrl']?.failure?.code).toBe('UNSUPPORTED_FIELD');
    }
  });

  it('marks simple-push decisions failed when the helper throws but still succeeds the location-patch decisions', async () => {
    syncProfileMock.mockRejectedValueOnce(new Error('boom'));
    const result = await applyProfileExportBatchToGoogle(
      makeBatchCtx({
        decisions: [
          makeDecision({ fieldKey: 'profile.name' }),
          makeDecision({ fieldKey: 'profile.address' }),
        ],
      }),
    );
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField['profile.name']?.status).toBe('failed');
      expect(result.perField['profile.name']?.failure?.code).toBe('PORT_FAILURE');
      expect(result.perField['profile.address']?.status).toBe('succeeded');
    }
  });
});

describe('applyServicePeriodsExportBatchToGoogle', () => {
  it('coalesces multi-period decisions into one push call covering all weekdays', async () => {
    const periods = [
      {
        stableKey: '1|17:00:00|22:00:00|dining|dinner',
        name: 'Mon Dinner',
        dayOfWeek: 1,
        startTime: '17:00:00',
        endTime: '22:00:00',
        bookingOption: 'dining' as const,
      },
      {
        stableKey: '3|17:00:00|22:00:00|dining|dinner',
        name: 'Wed Dinner',
        dayOfWeek: 3,
        startTime: '17:00:00',
        endTime: '22:00:00',
        bookingOption: 'dining' as const,
      },
    ];
    const result = await applyServicePeriodsExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'servicePeriods',
        coreSnapshot: makeSnapshot({ servicePeriods: { periods } }),
        gbpSnapshot: makeSnapshot(),
        decisions: periods.map((p) =>
          makeDecision({
            fieldKey: `servicePeriods.${p.stableKey}`,
            sectionKey: 'servicePeriods',
          }),
        ),
      }),
    );
    expect(syncServicePeriodsMock).toHaveBeenCalledTimes(1);
    expect(syncServicePeriodsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'push_to_gbp',
        selection: { dayOfWeeks: [1, 3] },
      }),
    );
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField[`servicePeriods.${periods[0].stableKey}`]?.status).toBe('succeeded');
      expect(result.perField[`servicePeriods.${periods[1].stableKey}`]?.status).toBe('succeeded');
    }
  });

  it('marks dayOfWeek=null periods UNSUPPORTED_FIELD per-field but still pushes the rest', async () => {
    const periods = [
      {
        stableKey: '2|17:00:00|22:00:00|dining|dinner',
        name: 'Tue Dinner',
        dayOfWeek: 2,
        startTime: '17:00:00',
        endTime: '22:00:00',
        bookingOption: 'dining' as const,
      },
      {
        stableKey: 'any|17:00:00|22:00:00|dining|all-week',
        name: 'All Week',
        dayOfWeek: null,
        startTime: '17:00:00',
        endTime: '22:00:00',
        bookingOption: 'dining' as const,
      },
    ];
    const result = await applyServicePeriodsExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'servicePeriods',
        coreSnapshot: makeSnapshot({ servicePeriods: { periods } }),
        gbpSnapshot: makeSnapshot(),
        decisions: periods.map((p) =>
          makeDecision({
            fieldKey: `servicePeriods.${p.stableKey}`,
            sectionKey: 'servicePeriods',
          }),
        ),
      }),
    );
    expect(syncServicePeriodsMock).toHaveBeenCalledTimes(1);
    expect(syncServicePeriodsMock).toHaveBeenCalledWith(
      expect.objectContaining({ selection: { dayOfWeeks: [2] } }),
    );
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField[`servicePeriods.${periods[0].stableKey}`]?.status).toBe('succeeded');
      expect(result.perField[`servicePeriods.${periods[1].stableKey}`]?.status).toBe('failed');
      expect(result.perField[`servicePeriods.${periods[1].stableKey}`]?.failure?.code).toBe(
        'UNSUPPORTED_FIELD',
      );
    }
  });

  it('does not call the helper when every decision is unexportable', async () => {
    const period = {
      stableKey: 'any|17:00:00|22:00:00|dining|all-week',
      name: 'All Week',
      dayOfWeek: null,
      startTime: '17:00:00',
      endTime: '22:00:00',
      bookingOption: 'dining' as const,
    };
    const result = await applyServicePeriodsExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'servicePeriods',
        coreSnapshot: makeSnapshot({ servicePeriods: { periods: [period] } }),
        gbpSnapshot: makeSnapshot(),
        decisions: [
          makeDecision({
            fieldKey: `servicePeriods.${period.stableKey}`,
            sectionKey: 'servicePeriods',
          }),
        ],
      }),
    );
    expect(syncServicePeriodsMock).not.toHaveBeenCalled();
    expect(result.supported).toBe(true);
  });
});

describe('applyBusinessContextCategoryExportBatchToGoogle', () => {
  it('coalesces multiple category decisions into a single merged-list patch', async () => {
    const result = await applyBusinessContextCategoryExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'businessContext.categories',
        coreSnapshot: makeSnapshot({
          businessContext: {
            categories: [
              {
                displayName: 'Fine Dining',
                categoryCode: 'gcid:fine-dining',
                isPrimary: true,
                moreHoursTypes: [],
              },
              {
                displayName: 'Bar',
                categoryCode: 'gcid:bar',
                isPrimary: false,
                moreHoursTypes: [],
              },
            ],
            serviceAreas: [],
            attributes: [],
            serviceItems: [],
          },
        }),
        gbpSnapshot: makeSnapshot({
          businessContext: {
            categories: [
              {
                displayName: 'Cafe',
                categoryCode: 'gcid:cafe',
                isPrimary: false,
                moreHoursTypes: [],
              },
            ],
            serviceAreas: [],
            attributes: [],
            serviceItems: [],
          },
        }),
        decisions: [
          makeDecision({
            fieldKey: 'businessContext.categories.fine-dining',
            sectionKey: 'businessContext.categories',
          }),
          makeDecision({
            fieldKey: 'businessContext.categories.bar',
            sectionKey: 'businessContext.categories',
          }),
        ],
      }),
    );
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(['categories']);
    // The merged list should still include 'cafe' from Google plus the
    // two Core entries.
    expect(call?.locationPatch?.categories?.additionalCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'categories/gcid:cafe' }),
        expect.objectContaining({ name: 'categories/gcid:bar' }),
      ]),
    );
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField['businessContext.categories.fine-dining']?.status).toBe('succeeded');
      expect(result.perField['businessContext.categories.bar']?.status).toBe('succeeded');
    }
  });

  it('reports per-field PORT_FAILURE for missing-core decisions and keeps the rest', async () => {
    const result = await applyBusinessContextCategoryExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'businessContext.categories',
        coreSnapshot: makeSnapshot({
          businessContext: {
            categories: [
              {
                displayName: 'Fine Dining',
                categoryCode: 'gcid:fine-dining',
                isPrimary: true,
                moreHoursTypes: [],
              },
            ],
            serviceAreas: [],
            attributes: [],
            serviceItems: [],
          },
        }),
        gbpSnapshot: makeSnapshot(),
        decisions: [
          makeDecision({
            fieldKey: 'businessContext.categories.fine-dining',
            sectionKey: 'businessContext.categories',
          }),
          makeDecision({
            fieldKey: 'businessContext.categories.does-not-exist',
            sectionKey: 'businessContext.categories',
          }),
        ],
      }),
    );
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField['businessContext.categories.fine-dining']?.status).toBe('succeeded');
      expect(result.perField['businessContext.categories.does-not-exist']?.status).toBe('failed');
      expect(result.perField['businessContext.categories.does-not-exist']?.failure?.code).toBe(
        'PORT_FAILURE',
      );
    }
  });

  it('does not call the patch helper when every decision is missing core', async () => {
    const result = await applyBusinessContextCategoryExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'businessContext.categories',
        coreSnapshot: makeSnapshot(),
        gbpSnapshot: makeSnapshot(),
        decisions: [
          makeDecision({
            fieldKey: 'businessContext.categories.does-not-exist',
            sectionKey: 'businessContext.categories',
          }),
        ],
      }),
    );
    expect(patchLocationFieldsMock).not.toHaveBeenCalled();
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.perField['businessContext.categories.does-not-exist']?.status).toBe('failed');
    }
  });
});

describe('applyBusinessContextServiceAreaExportBatchToGoogle', () => {
  it('coalesces service-area decisions into one merged patch', async () => {
    const result = await applyBusinessContextServiceAreaExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'businessContext.serviceAreas',
        coreSnapshot: makeSnapshot({
          businessContext: {
            categories: [],
            serviceAreas: [
              {
                displayName: 'Downtown',
                areaType: 'place',
                regionCode: 'US-CA',
                placeData: { businessType: 'CUSTOMER_AND_BUSINESS_LOCATION' },
              },
              {
                displayName: 'Uptown',
                areaType: 'place',
                regionCode: 'US-CA',
                placeData: { businessType: 'CUSTOMER_AND_BUSINESS_LOCATION' },
              },
            ],
            attributes: [],
            serviceItems: [],
          },
        }),
        gbpSnapshot: makeSnapshot(),
        decisions: [
          makeDecision({
            fieldKey: 'businessContext.serviceAreas.downtown',
            sectionKey: 'businessContext.serviceAreas',
          }),
          makeDecision({
            fieldKey: 'businessContext.serviceAreas.uptown',
            sectionKey: 'businessContext.serviceAreas',
          }),
        ],
      }),
    );
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(['serviceArea']);
    expect(result.supported).toBe(true);
  });
});

describe('applyBusinessContextAttributeExportBatchToGoogle', () => {
  it('merges multiple attribute decisions into one patch with combined mask', async () => {
    const result = await applyBusinessContextAttributeExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'businessContext.attributes',
        coreSnapshot: makeSnapshot({
          businessContext: {
            categories: [],
            serviceAreas: [],
            attributes: [
              {
                attributeKey: 'has_wheelchair_accessible_entrance',
                attributeName: 'attributes/has_wheelchair_accessible_entrance',
                attributeId: 'has_wheelchair_accessible_entrance',
                valueType: 'BOOL',
                boolValue: true,
                textValue: null,
                uriValue: null,
                uriValues: [],
                enumValues: [],
                unsetEnumValues: [],
              },
              {
                attributeKey: 'serves_dinner',
                attributeName: 'attributes/serves_dinner',
                attributeId: 'serves_dinner',
                valueType: 'BOOL',
                boolValue: true,
                textValue: null,
                uriValue: null,
                uriValues: [],
                enumValues: [],
                unsetEnumValues: [],
              },
            ],
            serviceItems: [],
          },
        }),
        gbpSnapshot: makeSnapshot(),
        decisions: [
          makeDecision({
            fieldKey: 'businessContext.attributes.has_wheelchair_accessible_entrance',
            sectionKey: 'businessContext.attributes',
          }),
          makeDecision({
            fieldKey: 'businessContext.attributes.serves_dinner',
            sectionKey: 'businessContext.attributes',
          }),
        ],
      }),
    );
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.attributesPatch?.attributeMask).toEqual(
      expect.arrayContaining([
        'attributes/has_wheelchair_accessible_entrance',
        'attributes/serves_dinner',
      ]),
    );
    expect(call?.attributesPatch?.attributes).toHaveLength(2);
    expect(result.supported).toBe(true);
  });
});

describe('applyBusinessContextServiceItemExportBatchToGoogle', () => {
  it('coalesces service-item decisions into one merged patch', async () => {
    const result = await applyBusinessContextServiceItemExportBatchToGoogle(
      makeBatchCtx({
        sectionKey: 'businessContext.serviceItems',
        coreSnapshot: makeSnapshot({
          businessContext: {
            categories: [],
            serviceAreas: [],
            attributes: [],
            serviceItems: [
              {
                itemKey: 'brunch-deal',
                itemType: 'structured',
                displayName: 'Brunch Deal',
                description: null,
                payload: { structuredServiceItem: { displayName: 'Brunch Deal' } },
              },
              {
                itemKey: 'happy-hour',
                itemType: 'structured',
                displayName: 'Happy Hour',
                description: null,
                payload: { structuredServiceItem: { displayName: 'Happy Hour' } },
              },
            ],
          },
        }),
        gbpSnapshot: makeSnapshot(),
        decisions: [
          makeDecision({
            fieldKey: 'businessContext.serviceItems.brunch-deal',
            sectionKey: 'businessContext.serviceItems',
          }),
          makeDecision({
            fieldKey: 'businessContext.serviceItems.happy-hour',
            sectionKey: 'businessContext.serviceItems',
          }),
        ],
      }),
    );
    expect(patchLocationFieldsMock).toHaveBeenCalledTimes(1);
    const call = patchLocationFieldsMock.mock.calls[0]?.[0];
    expect(call?.updateMask).toEqual(['serviceItems']);
    expect(call?.locationPatch?.serviceItems).toHaveLength(2);
    expect(result.supported).toBe(true);
  });
});
