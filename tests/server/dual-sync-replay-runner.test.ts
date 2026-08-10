import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetEnvCache } from '@/lib/env';
import {
  ATTRIBUTE_WIFI_FIELD_KEY,
  DUAL_SYNC_FAKE_GOOGLE_FAILURE_FIXTURES,
  DUAL_SYNC_STORED_REPLAY_FIXTURES,
  FakeGoogleBusinessProfileAdapter,
  FOOD_MENU_TIKKA_FIELD_KEY,
  computeReplayDecisionPins,
  createReplaySnapshot,
  runDualSyncReplayScenario,
} from '@/server/dual-sync/replay';

import type { DualSyncPublishDecision } from '@/server/dual-sync/publish';
import type {
  DualSyncBatchExportContext,
  DualSyncOperationContext,
} from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { DualSyncSectionKey } from '@/server/dual-sync/types';

const ENABLED_WRITE_FLAGS = [
  'GBP_IMPORT_ENABLED',
  'GBP_EXPORT_ENABLED',
  'GBP_HIGH_RISK_EXPORTS_ENABLED',
  'GBP_MENU_SYNC_ENABLED',
  'GBP_ATTRIBUTES_SYNC_ENABLED',
] as const;

beforeEach(() => {
  for (const name of ENABLED_WRITE_FLAGS) process.env[name] = 'true';
  resetEnvCache();
});

afterEach(() => {
  for (const name of ENABLED_WRITE_FLAGS) delete process.env[name];
  resetEnvCache();
});

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Old Crown Girton',
      businessDescription: 'Village pub',
      contactPhone: '01223 123456',
      address: '1 High Street',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    foodMenus: { items: [] },
    ...over,
  };
}

function decision(over: Partial<DualSyncPublishDecision>): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: null,
    pinnedGbpHash: null,
    ...over,
  };
}

function operationCtx(over: Partial<DualSyncOperationContext> = {}): DualSyncOperationContext {
  const coreSnapshot = makeSnapshot({
    profile: {
      ...makeSnapshot().profile,
      businessDescription: 'Core description',
    },
  });
  const gbpSnapshot = makeSnapshot({
    profile: {
      ...makeSnapshot().profile,
      businessDescription: 'Google description',
    },
  });
  return {
    client: {} as DualSyncOperationContext['client'],
    restaurantId: 'restaurant-1',
    publishJobId: 'publish-1',
    decision: decision({}),
    coreSnapshot,
    gbpSnapshot,
    actorUserId: 'user-1',
    ...over,
  };
}

function sectionForField(fieldKey: string): DualSyncSectionKey {
  if (fieldKey === ATTRIBUTE_WIFI_FIELD_KEY) return 'businessContext.attributes';
  if (fieldKey === FOOD_MENU_TIKKA_FIELD_KEY) return 'foodMenus';
  return 'profile';
}

describe('runDualSyncReplayScenario', () => {
  it('replays semantic state computation without database or Google access', async () => {
    const result = await runDualSyncReplayScenario({
      name: 'phone punctuation normalization',
      restaurantId: 'restaurant-1',
      coreSnapshot: makeSnapshot(),
      gbpSnapshot: makeSnapshot({
        profile: {
          ...makeSnapshot().profile,
          contactPhone: '(01223) 123456',
          businessDescription: 'Different on Google',
        },
      }),
    });

    const phone = result.fieldStates.find((field) => field.fieldKey === 'profile.contactPhone');
    const description = result.fieldStates.find(
      (field) => field.fieldKey === 'profile.businessDescription',
    );
    expect(phone?.state).toBe('in_sync');
    expect(description?.state).toBe('drifted');
    expect(result.publishPlan).toBeNull();
  });

  it('replays semantic golden equivalence across representative field types', async () => {
    const coreSnapshot = createReplaySnapshot({
      operatingHours: {
        weekly: [
          { dayOfWeek: 1, opensAt: '12:00', closesAt: '22:00', isClosed: false },
          { dayOfWeek: 0, opensAt: '12:00', closesAt: '22:00', isClosed: false },
        ],
      },
      businessContext: {
        categories: [
          {
            displayName: 'Pub',
            categoryCode: 'gcid:pub',
            isPrimary: true,
            moreHoursTypes: [],
          },
        ],
        serviceAreas: [
          {
            displayName: 'Girton',
            areaType: 'locality',
            regionCode: 'GB',
            placeData: { placeId: 'girton' },
          },
        ],
        attributes: [
          {
            attributeKey: 'has_wifi',
            attributeName: 'Wi-Fi',
            attributeId: 'has_wifi',
            valueType: 'BOOL',
            boolValue: true,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: ['b', 'a'],
            unsetEnumValues: [],
          },
        ],
        serviceItems: [
          {
            itemKey: 'item:bar/cocktails',
            itemType: 'structured_service_item',
            displayName: 'Cocktails',
            description: 'Classic cocktails',
            payload: { price: 'from 8 GBP' },
          },
        ],
      },
      foodMenus: {
        items: [
          {
            stableKey: 'foodMenu.item.mains/default.tikka-masala',
            itemName: ' Tikka Masala ',
            sectionLabel: 'Mains',
            description: ' Creamy curry with pilau rice. ',
            basePrice: 12.5,
            currency: 'gbp',
            dietaryTags: ['Vegetarian', 'Gluten free'],
            allergensContains: ['Milk', 'Nuts'],
            googlePath: 'menus[0].sections[0].items[0]',
          },
        ],
      },
    });
    const gbpSnapshot = createReplaySnapshot({
      operatingHours: {
        weekly: [
          { dayOfWeek: 0, opensAt: '12:00', closesAt: '22:00', isClosed: false },
          { dayOfWeek: 1, opensAt: '12:00', closesAt: '22:00', isClosed: false },
        ],
      },
      businessContext: {
        categories: [
          {
            displayName: 'pub',
            categoryCode: 'gcid:pub',
            isPrimary: true,
            moreHoursTypes: [],
          },
        ],
        serviceAreas: [
          {
            displayName: 'girton',
            areaType: 'locality',
            regionCode: 'GB',
            placeData: { placeId: 'girton' },
          },
        ],
        attributes: [
          {
            attributeKey: 'has_wifi',
            attributeName: 'Wi-Fi',
            attributeId: 'has_wifi',
            valueType: 'BOOL',
            boolValue: true,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: ['a', 'b'],
            unsetEnumValues: [],
          },
        ],
        serviceItems: [
          {
            itemKey: 'item:bar/cocktails',
            itemType: 'structured_service_item',
            displayName: 'cocktails',
            description: 'classic cocktails',
            payload: { price: 'from 8 GBP' },
          },
        ],
      },
      foodMenus: {
        items: [
          {
            stableKey: 'foodMenu.item.mains/default.tikka-masala',
            itemName: 'tikka masala',
            sectionLabel: 'mains',
            description: 'creamy curry with pilau rice.',
            basePrice: 12.5,
            currency: 'GBP',
            dietaryTags: ['Gluten free', 'Vegetarian'],
            allergensContains: ['Nuts', 'Milk'],
            googlePath: 'menus[0].sections[0].items[0]',
          },
        ],
      },
    });

    const result = await runDualSyncReplayScenario({
      name: 'semantic golden equivalence',
      restaurantId: 'restaurant-1',
      coreSnapshot,
      gbpSnapshot,
    });
    const stateByField = new Map(
      result.fieldStates.map((field) => [field.fieldKey, field.state] as const),
    );

    expect(stateByField.get('operatingHours.weekly.0')).toBe('in_sync');
    expect(stateByField.get('operatingHours.weekly.1')).toBe('in_sync');
    expect(stateByField.get('businessContext.categories.pub')).toBe('in_sync');
    expect(stateByField.get('businessContext.serviceAreas.girton')).toBe('in_sync');
    expect(stateByField.get(ATTRIBUTE_WIFI_FIELD_KEY)).toBe('in_sync');
    expect(stateByField.get('businessContext.serviceItems.item:bar/cocktails')).toBe('in_sync');
    expect(stateByField.get(FOOD_MENU_TIKKA_FIELD_KEY)).toBe('in_sync');
  });

  it('replays publish planning against fixture snapshots', async () => {
    const coreSnapshot = makeSnapshot();
    const gbpSnapshot = makeSnapshot();
    const result = await runDualSyncReplayScenario({
      name: 'profile export with rejected google-owned field',
      restaurantId: 'restaurant-1',
      coreSnapshot,
      gbpSnapshot,
      publishInput: {
        actorUserId: 'user-1',
        decisions: [
          {
            fieldKey: 'profile.contactPhone',
            sectionKey: 'profile',
            action: 'export_to_google',
            ...computeReplayDecisionPins({
              coreSnapshot,
              gbpSnapshot,
              fieldKey: 'profile.contactPhone',
            }),
          },
          {
            fieldKey: 'profile.googleMapUrl',
            sectionKey: 'profile',
            action: 'export_to_google',
            ...computeReplayDecisionPins({
              coreSnapshot,
              gbpSnapshot,
              fieldKey: 'profile.googleMapUrl',
            }),
          },
        ],
      },
    });

    expect(result.publishPlan?.acceptedCount).toBe(1);
    expect(result.publishPlan?.rejectedCount).toBe(1);
    expect(result.publishPlan?.groups).toHaveLength(1);
    expect(result.publishPlan?.groups[0]).toEqual(
      expect.objectContaining({
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        googleUpdateMasks: ['phoneNumbers'],
      }),
    );
    expect(result.publishPlan?.rejected[0]).toEqual(
      expect.objectContaining({
        fieldKey: 'profile.googleMapUrl',
      }),
    );
  });
});

describe('stored dual-sync replay fixtures', () => {
  it.each(DUAL_SYNC_STORED_REPLAY_FIXTURES)('replays $name', async (fixture) => {
    const result = await runDualSyncReplayScenario(fixture.scenario);

    for (const expectedState of fixture.expected.fieldStates ?? []) {
      expect(result.fieldStates.find((state) => state.fieldKey === expectedState.fieldKey)).toEqual(
        expect.objectContaining({ state: expectedState.state }),
      );
    }
    if (fixture.expected.acceptedCount !== undefined) {
      expect(result.publishPlan?.acceptedCount).toBe(fixture.expected.acceptedCount);
    }
    if (fixture.expected.rejectedCount !== undefined) {
      expect(result.publishPlan?.rejectedCount).toBe(fixture.expected.rejectedCount);
    }
    if (fixture.expected.rejectedCodes) {
      expect(result.publishPlan?.rejected.map((entry) => entry.failure.code)).toEqual(
        fixture.expected.rejectedCodes,
      );
    }
    if (fixture.expected.warningCodes) {
      expect(result.publishPlan?.warnings.map((warning) => warning.code)).toEqual(
        expect.arrayContaining(fixture.expected.warningCodes),
      );
    }
    if (fixture.expected.writeGroups) {
      expect(result.publishPlan?.groups.map((group) => group.writeGroup)).toEqual(
        expect.arrayContaining(fixture.expected.writeGroups),
      );
    }
  });
});

describe('FakeGoogleBusinessProfileAdapter', () => {
  it('exports profile batches with Google-style masks and in-memory mutation', async () => {
    const coreSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        name: 'Core Pub',
        contactPhone: '01223 999999',
        businessDescription: 'Core side copy',
      },
    });
    const gbpSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        name: 'Google Pub',
        contactPhone: '01223 111111',
        businessDescription: 'Google side copy',
      },
    });
    const adapter = new FakeGoogleBusinessProfileAdapter({ coreSnapshot, gbpSnapshot });
    const ports = adapter.createPorts();
    const decisions = [
      decision({ fieldKey: 'profile.name' }),
      decision({ fieldKey: 'profile.contactPhone' }),
      decision({ fieldKey: 'profile.businessDescription' }),
    ];

    const result = await ports.applyExportBatchToGoogle?.({
      client: {} as DualSyncBatchExportContext['client'],
      restaurantId: 'restaurant-1',
      publishJobId: 'publish-1',
      sectionKey: 'profile',
      decisions,
      coreSnapshot,
      gbpSnapshot,
      actorUserId: 'user-1',
    });

    expect(result?.supported).toBe(true);
    expect(adapter.gbpSnapshot.profile).toEqual(
      expect.objectContaining({
        name: 'Core Pub',
        contactPhone: '01223 999999',
        businessDescription: 'Core side copy',
      }),
    );
    expect(adapter.requests[0]).toEqual(
      expect.objectContaining({
        operation: 'locations.patch',
        fieldKeys: ['profile.name', 'profile.contactPhone', 'profile.businessDescription'],
        updateMask: expect.arrayContaining(['title', 'phoneNumbers', 'profile']),
      }),
    );
  });

  it('supports validate-only export checks without mutating the fake Google snapshot', async () => {
    const coreSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Validated only',
      },
    });
    const gbpSnapshot = makeSnapshot();
    const adapter = new FakeGoogleBusinessProfileAdapter({ coreSnapshot, gbpSnapshot });

    await adapter.exportFieldsToGoogle({
      decisions: [decision({ fieldKey: 'profile.businessDescription' })],
      validateOnly: true,
    });

    expect(adapter.gbpSnapshot.profile.businessDescription).toBe('Village pub');
    expect(adapter.requests[0]).toEqual(
      expect.objectContaining({
        operation: 'locations.patch',
        validateOnly: true,
        updateMask: ['profile'],
      }),
    );
  });

  it.each([
    {
      name: 'location.profile',
      fieldKey: 'profile.businessDescription',
      operation: 'locations.patch',
      updateMask: ['profile'],
      attributeMask: undefined,
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(snapshot.profile.businessDescription).toBe('Core fixture copy');
      },
    },
    {
      name: 'location.regularHours',
      fieldKey: 'operatingHours.weekly.1',
      operation: 'locations.patch',
      updateMask: ['regularHours'],
      attributeMask: undefined,
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(snapshot.operatingHours.weekly.find((day) => day.dayOfWeek === 1)).toEqual(
          expect.objectContaining({ opensAt: '09:00', closesAt: '17:00' }),
        );
      },
    },
    {
      name: 'location.moreHours',
      fieldKey: 'servicePeriods.lunch-monday',
      operation: 'locations.patch',
      updateMask: ['moreHours'],
      attributeMask: undefined,
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(
          snapshot.servicePeriods.periods.find((period) => period.stableKey === 'lunch-monday'),
        ).toEqual(expect.objectContaining({ startTime: '11:30', endTime: '14:30' }));
      },
    },
    {
      name: 'location.categories',
      fieldKey: 'businessContext.categories.pub',
      operation: 'locations.patch',
      updateMask: ['categories'],
      attributeMask: undefined,
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(
          snapshot.businessContext.categories.find((category) => category.displayName === 'Pub'),
        ).toEqual(expect.objectContaining({ categoryCode: 'gcid:british_pub' }));
      },
    },
    {
      name: 'location.serviceArea',
      fieldKey: 'businessContext.serviceAreas.girton',
      operation: 'locations.patch',
      updateMask: ['serviceArea'],
      attributeMask: undefined,
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(
          snapshot.businessContext.serviceAreas.find((area) => area.displayName === 'Girton'),
        ).toEqual(expect.objectContaining({ areaType: 'region' }));
      },
    },
    {
      name: 'location.attributes',
      fieldKey: ATTRIBUTE_WIFI_FIELD_KEY,
      operation: 'locations.updateAttributes',
      updateMask: undefined,
      attributeMask: ['has_wifi'],
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(
          snapshot.businessContext.attributes.find(
            (attribute) => attribute.attributeKey === 'has_wifi',
          ),
        ).toEqual(expect.objectContaining({ boolValue: false }));
      },
    },
    {
      name: 'location.services',
      fieldKey: 'businessContext.serviceItems.item:bar/cocktails',
      operation: 'locations.patch',
      updateMask: ['serviceItems'],
      attributeMask: undefined,
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(
          snapshot.businessContext.serviceItems.find(
            (item) => item.itemKey === 'item:bar/cocktails',
          ),
        ).toEqual(expect.objectContaining({ description: 'Seasonal cocktails' }));
      },
    },
    {
      name: 'location.foodMenus',
      fieldKey: FOOD_MENU_TIKKA_FIELD_KEY,
      operation: 'foodMenus.replace',
      updateMask: undefined,
      attributeMask: undefined,
      assertMutation: (snapshot: DualSyncCanonicalSnapshot) => {
        expect(snapshot.foodMenus?.items[0]).toEqual(expect.objectContaining({ basePrice: 13.25 }));
      },
    },
  ])(
    'covers fake Google replay exports for $name',
    async ({ fieldKey, operation, updateMask, attributeMask, assertMutation }) => {
      const base = createReplaySnapshot();
      const coreSnapshot = createReplaySnapshot({
        profile: {
          ...base.profile,
          businessDescription: 'Core fixture copy',
        },
        operatingHours: {
          weekly: [
            { dayOfWeek: 0, opensAt: '12:00', closesAt: '22:00', isClosed: false },
            { dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00', isClosed: false },
          ],
        },
        servicePeriods: {
          periods: [
            {
              stableKey: 'lunch-monday',
              name: 'Lunch',
              dayOfWeek: 1,
              startTime: '11:30',
              endTime: '14:30',
              bookingOption: 'lunch',
            },
          ],
        },
        businessContext: {
          categories: [
            {
              displayName: 'Pub',
              categoryCode: 'gcid:british_pub',
              isPrimary: true,
              moreHoursTypes: [],
            },
          ],
          serviceAreas: [
            {
              displayName: 'Girton',
              areaType: 'region',
              regionCode: 'GB',
              placeData: { placeId: 'girton' },
            },
          ],
          attributes: [
            {
              ...base.businessContext.attributes[0]!,
              boolValue: false,
            },
          ],
          serviceItems: [
            {
              ...base.businessContext.serviceItems[0]!,
              description: 'Seasonal cocktails',
            },
          ],
        },
        foodMenus: {
          items: [
            {
              ...base.foodMenus!.items[0]!,
              basePrice: 13.25,
            },
          ],
        },
      });
      const adapter = new FakeGoogleBusinessProfileAdapter({
        coreSnapshot,
        gbpSnapshot: base,
      });

      const result = await adapter.exportFieldsToGoogle({
        decisions: [{ fieldKey }],
      });

      expect(result[fieldKey]).toEqual(expect.objectContaining({ status: 'succeeded' }));
      expect(result[fieldKey]?.afterCoreHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
      expect(result[fieldKey]?.afterGbpHash).toBe(result[fieldKey]?.afterCoreHash);
      expect(adapter.requests[0]).toMatchObject({
        operation,
        validateOnly: false,
        fieldKeys: [fieldKey],
      });
      expect(adapter.requests[0]?.updateMask).toEqual(updateMask);
      expect(adapter.requests[0]?.attributeMask).toEqual(attributeMask);
      assertMutation(adapter.gbpSnapshot);
    },
  );

  it('injects Google failures and imports Google values back to Core', async () => {
    const coreSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Core stale copy',
      },
    });
    const gbpSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Fresh Google copy',
      },
    });
    const adapter = new FakeGoogleBusinessProfileAdapter({ coreSnapshot, gbpSnapshot });
    const ports = adapter.createPorts();

    adapter.failNext({
      operation: 'locations.patch',
      failure: {
        code: 'QUOTA_LIMITED',
        message: 'Fake Google edit quota exceeded.',
        retryable: true,
      },
    });

    const failedExport = await ports.applyExportToGoogle(
      operationCtx({
        coreSnapshot,
        gbpSnapshot,
        decision: decision({ fieldKey: 'profile.businessDescription' }),
      }),
    );
    expect(failedExport).toEqual(
      expect.objectContaining({
        status: 'failed',
        failure: expect.objectContaining({ code: 'QUOTA_LIMITED', retryable: true }),
      }),
    );
    expect(adapter.gbpSnapshot.profile.businessDescription).toBe('Fresh Google copy');

    const imported = await ports.applyImportToCore(
      operationCtx({
        coreSnapshot,
        gbpSnapshot,
        decision: decision({
          fieldKey: 'profile.businessDescription',
          action: 'import_from_google',
        }),
      }),
    );

    expect(imported.status).toBe('succeeded');
    expect(adapter.coreSnapshot.profile.businessDescription).toBe('Fresh Google copy');
    expect(adapter.requests[1]).toEqual(
      expect.objectContaining({
        operation: 'locations.get',
        fieldKeys: ['profile.businessDescription'],
      }),
    );
  });

  it.each(DUAL_SYNC_FAKE_GOOGLE_FAILURE_FIXTURES)(
    'replays failure fixture: $name',
    async (fixture) => {
      const coreSnapshot = createReplaySnapshot({
        profile: {
          ...createReplaySnapshot().profile,
          businessDescription: 'Core fixture copy',
        },
      });
      const gbpSnapshot = createReplaySnapshot({
        profile: {
          ...createReplaySnapshot().profile,
          businessDescription: 'Google fixture copy',
        },
      });
      const adapter = new FakeGoogleBusinessProfileAdapter({ coreSnapshot, gbpSnapshot });
      const ports = adapter.createPorts();
      adapter.failNext({
        operation: fixture.operation,
        failure: fixture.failure,
      });

      if (fixture.action === 'import_from_google') {
        const result = await ports.applyImportToCore(
          operationCtx({
            coreSnapshot,
            gbpSnapshot,
            decision: decision({
              fieldKey: fixture.fieldKeys[0],
              action: 'import_from_google',
            }),
          }),
        );
        expect(result).toEqual(
          expect.objectContaining({
            status: 'failed',
            failure: expect.objectContaining({ code: fixture.failure.code }),
          }),
        );
      } else {
        const result = await ports.applyExportBatchToGoogle?.({
          client: {} as DualSyncBatchExportContext['client'],
          restaurantId: 'restaurant-1',
          publishJobId: 'publish-1',
          sectionKey: sectionForField(fixture.fieldKeys[0]),
          decisions: fixture.fieldKeys.map((fieldKey) =>
            decision({
              fieldKey,
              sectionKey: sectionForField(fieldKey),
            }),
          ),
          coreSnapshot,
          gbpSnapshot,
          actorUserId: 'user-1',
        });
        expect(result?.supported).toBe(true);
        for (const fieldKey of fixture.fieldKeys) {
          expect(result?.perField[fieldKey]).toEqual(
            expect.objectContaining({
              status: 'failed',
              failure: expect.objectContaining({ code: fixture.failure.code }),
            }),
          );
        }
      }
      expect(adapter.requests[0]).toEqual(
        expect.objectContaining({
          operation: fixture.operation,
        }),
      );
    },
  );

  it('supports partial-success field failure injection in a batch export', async () => {
    const coreSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Core description wins',
        contactPhone: '01223 222222',
      },
    });
    const gbpSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Google description loses',
        contactPhone: '01223 111111',
      },
    });
    const adapter = new FakeGoogleBusinessProfileAdapter({ coreSnapshot, gbpSnapshot });
    const ports = adapter.createPorts();
    adapter.failField({
      fieldKey: 'profile.contactPhone',
      failure: {
        code: 'GOOGLE_VALIDATION_FAILED',
        message: 'Fixture rejected phone number.',
        retryable: false,
      },
    });

    const result = await ports.applyExportBatchToGoogle?.({
      client: {} as DualSyncBatchExportContext['client'],
      restaurantId: 'restaurant-1',
      publishJobId: 'publish-1',
      sectionKey: 'profile',
      decisions: [
        decision({ fieldKey: 'profile.businessDescription' }),
        decision({ fieldKey: 'profile.contactPhone' }),
      ],
      coreSnapshot,
      gbpSnapshot,
      actorUserId: 'user-1',
    });

    expect(result?.perField['profile.businessDescription']).toEqual(
      expect.objectContaining({ status: 'succeeded' }),
    );
    expect(result?.perField['profile.contactPhone']).toEqual(
      expect.objectContaining({
        status: 'failed',
        failure: expect.objectContaining({ code: 'GOOGLE_VALIDATION_FAILED' }),
      }),
    );
    expect(adapter.gbpSnapshot.profile.businessDescription).toBe('Core description wins');
    expect(adapter.gbpSnapshot.profile.contactPhone).toBe('01223 111111');
  });
});
