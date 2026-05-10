/**
 * Stored replay fixtures for dual-sync production hardening.
 *
 * Fixtures are deliberately synthetic: no tokens, customer payloads, or
 * live venue data. They give tests and operators a stable corpus for
 * clean, stale, high-risk, failure, and partial-success replay drills.
 */

import type { DualSyncPublishDecision } from '../publish';
import type { DualSyncFakeGoogleOperation } from './fake-google';
import type { DualSyncReplayScenario } from './runner';
import type { DualSyncOperationFailure } from '../publish/types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';

export interface DualSyncStoredReplayFixture {
  readonly name: string;
  readonly scenario: DualSyncReplayScenario;
  readonly expected: {
    readonly fieldStates?: ReadonlyArray<{
      readonly fieldKey: string;
      readonly state: string;
    }>;
    readonly acceptedCount?: number;
    readonly rejectedCount?: number;
    readonly rejectedCodes?: ReadonlyArray<string>;
    readonly warningCodes?: ReadonlyArray<string>;
    readonly writeGroups?: ReadonlyArray<string>;
  };
}

export interface DualSyncFakeGoogleFailureFixture {
  readonly name: string;
  readonly operation: DualSyncFakeGoogleOperation;
  readonly fieldKeys: ReadonlyArray<string>;
  readonly action: DualSyncPublishDecision['action'];
  readonly failure: DualSyncOperationFailure;
}

export const FOOD_MENU_TIKKA_FIELD_KEY =
  'foodMenus.items.mains.foodMenu_item_mains/default_tikka-masala';

export const ATTRIBUTE_WIFI_FIELD_KEY = 'businessContext.attributes.has_wifi';

export function createReplaySnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Fixture Pub',
      businessDescription: 'Warm village pub with seasonal food.',
      contactPhone: '01223 123456',
      address: '1 Fixture Street',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: {
      weekly: [
        { dayOfWeek: 0, opensAt: '12:00', closesAt: '22:00', isClosed: false },
        { dayOfWeek: 1, opensAt: '12:00', closesAt: '22:00', isClosed: false },
      ],
    },
    servicePeriods: {
      periods: [
        {
          stableKey: 'lunch-monday',
          name: 'Lunch',
          dayOfWeek: 1,
          startTime: '12:00',
          endTime: '15:00',
          bookingOption: 'lunch',
        },
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
          placeData: null,
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
          enumValues: [],
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
          itemName: 'Tikka Masala',
          sectionLabel: 'Mains',
          description: 'Creamy curry with pilau rice.',
          basePrice: 12.5,
          currency: 'GBP',
          dietaryTags: [],
          allergensContains: ['Milk'],
          googlePath: 'menus[0].sections[0].items[0]',
        },
      ],
    },
    ...overrides,
  };
}

function decision(overrides: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: null,
    pinnedGbpHash: null,
    ...overrides,
  };
}

export const DUAL_SYNC_STORED_REPLAY_FIXTURES: ReadonlyArray<DualSyncStoredReplayFixture> = [
  {
    name: 'clean in-sync profile',
    scenario: {
      name: 'clean in-sync profile',
      restaurantId: 'fixture-restaurant',
      coreSnapshot: createReplaySnapshot(),
      gbpSnapshot: createReplaySnapshot(),
    },
    expected: {
      fieldStates: [
        { fieldKey: 'profile.name', state: 'in_sync' },
        { fieldKey: 'profile.contactPhone', state: 'in_sync' },
      ],
    },
  },
  {
    name: 'stale core decision',
    scenario: {
      name: 'stale core decision',
      restaurantId: 'fixture-restaurant',
      coreSnapshot: createReplaySnapshot({
        profile: {
          ...createReplaySnapshot().profile,
          businessDescription: 'Updated Core copy.',
        },
      }),
      gbpSnapshot: createReplaySnapshot(),
      publishInput: {
        actorUserId: 'fixture-user',
        decisions: [decision({ pinnedCoreHash: 'stale-core-hash' })],
      },
    },
    expected: {
      acceptedCount: 0,
      rejectedCount: 1,
      rejectedCodes: ['CORE_DRIFT'],
    },
  },
  {
    name: 'stale google decision',
    scenario: {
      name: 'stale google decision',
      restaurantId: 'fixture-restaurant',
      coreSnapshot: createReplaySnapshot(),
      gbpSnapshot: createReplaySnapshot({
        profile: {
          ...createReplaySnapshot().profile,
          businessDescription: 'Updated Google copy.',
        },
      }),
      publishInput: {
        actorUserId: 'fixture-user',
        decisions: [decision({ action: 'import_from_google', pinnedGbpHash: 'stale-gbp-hash' })],
      },
    },
    expected: {
      acceptedCount: 0,
      rejectedCount: 1,
      rejectedCodes: ['GBP_DRIFT'],
    },
  },
  {
    name: 'high-risk food menu export',
    scenario: {
      name: 'high-risk food menu export',
      restaurantId: 'fixture-restaurant',
      coreSnapshot: createReplaySnapshot({
        foodMenus: {
          items: [
            {
              ...createReplaySnapshot().foodMenus!.items[0]!,
              description: 'Updated menu description.',
              basePrice: 13.25,
            },
          ],
        },
      }),
      gbpSnapshot: createReplaySnapshot(),
      publishInput: {
        actorUserId: 'fixture-user',
        decisions: [
          decision({
            fieldKey: FOOD_MENU_TIKKA_FIELD_KEY,
            sectionKey: 'foodMenus',
            action: 'export_to_google',
          }),
        ],
      },
    },
    expected: {
      acceptedCount: 1,
      rejectedCount: 0,
      warningCodes: ['PREFLIGHT_REQUIRED', 'HIGH_RISK', 'DESTRUCTIVE_WRITE'],
      writeGroups: ['location.foodMenus'],
    },
  },
];

export const DUAL_SYNC_FAKE_GOOGLE_FAILURE_FIXTURES: ReadonlyArray<DualSyncFakeGoogleFailureFixture> =
  [
    {
      name: 'quota-limited profile export',
      operation: 'locations.patch',
      fieldKeys: ['profile.businessDescription'],
      action: 'export_to_google',
      failure: {
        code: 'QUOTA_LIMITED',
        message: 'Fixture Google edit quota exceeded.',
        retryable: true,
      },
    },
    {
      name: 'reauth-required import',
      operation: 'locations.get',
      fieldKeys: ['profile.businessDescription'],
      action: 'import_from_google',
      failure: {
        code: 'REAUTH_REQUIRED',
        message: 'Fixture token expired.',
        retryable: false,
      },
    },
    {
      name: 'attribute validation failure',
      operation: 'locations.updateAttributes',
      fieldKeys: [ATTRIBUTE_WIFI_FIELD_KEY],
      action: 'export_to_google',
      failure: {
        code: 'GOOGLE_VALIDATION_FAILED',
        message: 'Fixture attribute rejected by Google.',
        retryable: false,
      },
    },
    {
      name: 'food menu external API failure',
      operation: 'foodMenus.replace',
      fieldKeys: [FOOD_MENU_TIKKA_FIELD_KEY],
      action: 'export_to_google',
      failure: {
        code: 'EXTERNAL_API_ERROR',
        message: 'Fixture FoodMenus endpoint failed.',
        retryable: true,
      },
    },
  ];
